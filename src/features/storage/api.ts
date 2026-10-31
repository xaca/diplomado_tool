import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import type { BoardSnapshot } from '@/features/data-transfer/backup'
import { chunk, type AssetRow } from '@/features/storage/analysis'
import { db } from '@/lib/firebase'
import { MAX_DELETE_BATCH, mediaApi } from '@/lib/media-api'
import { toDate } from '@/lib/time'
import {
  paths,
  type AssetDoc,
  type BoardDoc,
  type SlideDoc,
  type SpaceDoc,
  type StudentDoc,
} from '@/model'
import { resolveLook } from '@/features/boards/look'

// Storage & cleanup, backup and purge (PLAN.md → Data lifecycle). Teacher only; one-shot reads
// (not live): the storage page loads the board once, on demand.

const BATCH_LIMIT = 450

export type BoardData = {
  snapshot: BoardSnapshot
  assets: AssetRow[]
  covers: SpaceDoc['cover'][]
  slideAssetIds: string[][]
  /** Every document of the board except the board itself (for purging) */
  refs: DocumentReference[]
}

/** Reads the whole board: students, cards, slides and the image registry. */
export async function loadBoardData(boardId: string): Promise<BoardData> {
  const [board, students, spaces, assets, emails, members] = await Promise.all([
    getDoc(doc(db, paths.board(boardId))),
    getDocs(collection(db, paths.students(boardId))),
    getDocs(collection(db, paths.spaces(boardId))),
    getDocs(collection(db, paths.assets(boardId))),
    getDocs(collection(db, paths.studentEmails(boardId))),
    getDocs(collection(db, paths.members(boardId))),
  ])
  if (!board.exists()) throw new Error('board not found')
  const [slides, notes] = await Promise.all([
    Promise.all(
      spaces.docs.map((space) =>
        getDocs(collection(db, paths.slides(boardId, space.id))),
      ),
    ),
    Promise.all(
      spaces.docs.map((space) =>
        getDocs(collection(db, paths.notes(boardId, space.id))),
      ),
    ),
  ])
  const boardData = board.data() as BoardDoc

  return {
    snapshot: {
      board: {
        title: boardData.title,
        description: boardData.description,
        archiveAfterDays: boardData.archiveAfterDays,
        stages: boardData.stages ?? null,
        look: resolveLook(boardData),
      },
      students: students.docs.map((student) => {
        const data = student.data() as StudentDoc
        return {
          id: student.id,
          displayName: data.displayName,
          emails: data.emails,
          group: data.group ?? '',
        }
      }),
      spaces: spaces.docs.map((space) => {
        const data = space.data() as SpaceDoc
        return {
          studentId: space.id,
          title: data.title,
          summary: data.summary,
          color: data.color,
          cover: data.cover ?? null,
          stage: data.stage ?? null,
          slideOrder: data.slideOrder,
        }
      }),
      slides: Object.fromEntries(
        spaces.docs.map((space, index) => [
          space.id,
          slides[index].docs.map((slide) => {
            const data = slide.data() as SlideDoc
            return { id: slide.id, content: data.content, files: data.files }
          }),
        ]),
      ),
    },
    assets: assets.docs.map((asset) => {
      const data = asset.data() as AssetDoc
      return {
        id: asset.id,
        publicId: data.publicId,
        studentId: data.studentId,
        kind: data.kind,
        bytes: data.bytes,
        status: data.status,
        createdAt: toDate(data.createdAt),
      }
    }),
    // the board logo (M12) counts like a card cover
    covers: [
      ...spaces.docs.map((space) => (space.data() as SpaceDoc).cover),
      boardData.logo,
    ],
    slideAssetIds: slides.flatMap((snapshot) =>
      snapshot.docs.map((slide) => (slide.data() as SlideDoc).assetIds ?? []),
    ),
    refs: [
      ...[...slides, ...notes].flatMap((snapshot) =>
        snapshot.docs.map((d) => d.ref),
      ),
      ...spaces.docs.map((d) => d.ref),
      ...members.docs.map((d) => d.ref),
      ...emails.docs.map((d) => d.ref),
      ...students.docs.map((d) => d.ref),
      ...assets.docs.map((d) => d.ref),
    ],
  }
}

async function updateInBatches(
  refs: DocumentReference[],
  data: Record<string, unknown>,
) {
  for (const group of chunk(refs, BATCH_LIMIT)) {
    const batch = writeBatch(db)
    for (const ref of group) batch.update(ref, data)
    await batch.commit()
  }
}

/**
 * Deletes unused images: marks them "orphaned" (the Worker only deletes those), asks the Worker
 * to delete them from Cloudinary in small batches, then marks them "deleted" in the registry.
 */
export async function cleanUpImages(
  boardId: string,
  assets: readonly AssetRow[],
  onProgress?: (done: number) => void,
) {
  const ref = (id: string) => doc(db, paths.asset(boardId, id))
  const pending = assets.filter((asset) => asset.status !== 'orphaned')
  await updateInBatches(
    pending.map((asset) => ref(asset.id)),
    { status: 'orphaned' },
  )

  let deleted = 0
  let skipped = 0
  for (const group of chunk(
    assets.map((asset) => asset.id),
    MAX_DELETE_BATCH,
  )) {
    const { results } = await mediaApi.deleteAssets(boardId, group)
    const gone = group.filter((id) => results[id] && results[id] !== 'skipped')
    await updateInBatches(gone.map(ref), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
    })
    deleted += gone.length
    skipped += group.length - gone.length
    onProgress?.(deleted + skipped)
  }
  return { deleted, skipped }
}

export type PurgeStep = 'images' | 'documents' | 'done'

/**
 * Purges an archived board (after its backup was downloaded): the Worker deletes the Cloudinary
 * folder, then the teacher's browser deletes every Firestore document (the rules allow it only for
 * archived boards). The board document goes last, so the rules can still check it.
 */
export async function purgeBoard(
  boardId: string,
  onStep?: (step: PurgeStep) => void,
) {
  onStep?.('images')
  for (let call = 0; call < 20; call++) {
    const { complete } = await mediaApi.purgeBoard(boardId)
    if (complete) break
  }

  onStep?.('documents')
  const data = await loadBoardData(boardId)
  for (const group of chunk(data.refs, BATCH_LIMIT)) {
    const batch = writeBatch(db)
    for (const ref of group) batch.delete(ref)
    await batch.commit()
  }
  const board = await getDoc(doc(db, paths.board(boardId)))
  const joinCode = (board.data() as BoardDoc | undefined)?.joinCode
  if (joinCode) await deleteDoc(doc(db, paths.joinCode(joinCode)))
  await deleteDoc(doc(db, paths.board(boardId)))
  onStep?.('done')
}
