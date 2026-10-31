import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore'
import { isArchived, lifecycleOf } from '@/features/boards/lifecycle'
import {
  buildBackup,
  type BoardSnapshot,
} from '@/features/data-transfer/backup'
import { analyzeStorage, type AssetRow } from '@/features/storage/analysis'
import { slugify } from '@/lib/download'
import { toDate } from '@/lib/time'
import type {
  AssetDoc,
  BoardDoc,
  SlideDoc,
  SpaceDoc,
  StudentDoc,
} from '@/model'
import { deleteFolder, deleteImages } from './cloudinary.ts'
import { db } from './firebase.ts'
import { resolveLook } from '@/features/boards/look'

// Board lifecycle from the console (PLAN.md → Admin CLI). Same rules as the teacher dashboard
// (purge only archived boards, backup first), but with admin credentials: no Security Rules.

export const DEFAULT_BACKUP_DIR = path.resolve(
  import.meta.dirname,
  '../../backups',
)

const boardRef = (boardId: string) => db.collection('boards').doc(boardId)

async function getBoard(boardId: string) {
  const snapshot = await boardRef(boardId).get()
  if (!snapshot.exists) throw new Error(`Board not found: ${boardId}`)
  return snapshot.data() as BoardDoc
}

export async function listBoards() {
  const boards = await db.collection('boards').get()
  return boards.docs.map((doc) => ({ id: doc.id, ...(doc.data() as BoardDoc) }))
}

/** Everything in a board, in the same shape the dashboard uses. */
export async function loadBoard(boardId: string) {
  const board = await getBoard(boardId)
  const ref = boardRef(boardId)
  const [students, spaces, assets, emails, members] = await Promise.all([
    ref.collection('students').get(),
    ref.collection('spaces').get(),
    ref.collection('assets').get(),
    ref.collection('studentEmails').get(),
    ref.collection('members').get(),
  ])
  const [slides, notes] = await Promise.all([
    Promise.all(
      spaces.docs.map((space) => space.ref.collection('slides').get()),
    ),
    Promise.all(
      spaces.docs.map((space) => space.ref.collection('notes').get()),
    ),
  ])

  const snapshot: BoardSnapshot = {
    board: {
      title: board.title,
      description: board.description,
      archiveAfterDays: board.archiveAfterDays,
      stages: board.stages ?? null,
      look: resolveLook(board),
    },
    students: students.docs.map((doc) => {
      const data = doc.data() as StudentDoc
      return {
        id: doc.id,
        displayName: data.displayName,
        emails: data.emails,
        group: data.group ?? '',
      }
    }),
    spaces: spaces.docs.map((doc) => {
      const data = doc.data() as SpaceDoc
      return {
        studentId: doc.id,
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
        slides[index].docs.map((doc) => {
          const data = doc.data() as SlideDoc
          return { id: doc.id, content: data.content, files: data.files }
        }),
      ]),
    ),
  }
  const assetRows: AssetRow[] = assets.docs.map((doc) => {
    const data = doc.data() as AssetDoc
    return {
      id: doc.id,
      publicId: data.publicId,
      studentId: data.studentId,
      kind: data.kind,
      bytes: data.bytes,
      status: data.status,
      createdAt: toDate(data.createdAt),
    }
  })
  const refs: DocumentReference[] = [
    ...[...slides, ...notes].flatMap((s) => s.docs.map((doc) => doc.ref)),
    ...[spaces, members, emails, students, assets].flatMap((s) =>
      s.docs.map((doc) => doc.ref),
    ),
  ]
  return {
    board,
    snapshot,
    assets: assetRows,
    report: analyzeStorage({
      assets: assetRows,
      // the board logo (M12) counts like a card cover
      covers: [
        ...spaces.docs.map((doc) => (doc.data() as SpaceDoc).cover),
        board.logo,
      ],
      slideAssetIds: slides.flatMap((s) =>
        s.docs.map((doc) => (doc.data() as SlideDoc).assetIds ?? []),
      ),
    }),
    refs,
  }
}

export async function archiveBoard(boardId: string) {
  await getBoard(boardId)
  await boardRef(boardId).update({
    status: 'archived',
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function restoreBoard(boardId: string) {
  await getBoard(boardId)
  await boardRef(boardId).update({
    status: 'active',
    archivedAt: FieldValue.delete(),
    lastActivityAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

/** Writes the JSON backup (same format as the dashboard's) and returns its path. */
export async function backupBoard(boardId: string, dir = DEFAULT_BACKUP_DIR) {
  const { snapshot } = await loadBoard(boardId)
  mkdirSync(dir, { recursive: true })
  const file = path.join(
    dir,
    `${slugify(snapshot.board.title) || boardId}-${boardId}-${new Date().toISOString().slice(0, 10)}.json`,
  )
  writeFileSync(file, JSON.stringify(buildBackup(snapshot), null, 2))
  return file
}

/** Unused images of a board; deletes them from Cloudinary and marks them in the registry. */
export async function cleanupBoard(boardId: string, dryRun: boolean) {
  const { report } = await loadBoard(boardId)
  if (dryRun || report.unused.length === 0)
    return { unused: report.unused, deleted: 0 }
  const results = await deleteImages(report.unused.map((a) => a.publicId))
  const gone = report.unused.filter((asset) => results[asset.publicId])
  for (let i = 0; i < gone.length; i += 450) {
    const batch = db.batch()
    for (const asset of gone.slice(i, i + 450))
      batch.update(boardRef(boardId).collection('assets').doc(asset.id), {
        status: 'deleted',
        deletedAt: FieldValue.serverTimestamp(),
      })
    await batch.commit()
  }
  return { unused: report.unused, deleted: gone.length }
}

/**
 * Purge: archived boards only. Writes a backup first, deletes both Cloudinary folders (prod and
 * dev), then every Firestore document of the board, its invite code and the board itself.
 */
export async function purgeBoard(boardId: string, backupDir?: string) {
  const board = await getBoard(boardId)
  if (!isArchived(lifecycleOf(board)) || board.status !== 'archived')
    throw new Error(
      'Only archived boards can be purged. Run first: npm run admin -- board archive ' +
        boardId,
    )
  const backup = await backupBoard(boardId, backupDir)
  let images = 0
  for (const env of ['prod', 'dev'])
    images += await deleteFolder(`pbl/${env}/${boardId}/`)

  const { refs } = await loadBoard(boardId)
  for (let i = 0; i < refs.length; i += 450) {
    const batch = db.batch()
    for (const ref of refs.slice(i, i + 450)) batch.delete(ref)
    await batch.commit()
  }
  if (board.joinCode)
    await db.collection('joinCodes').doc(board.joinCode).delete()
  await boardRef(boardId).delete()
  return { backup, images, documents: refs.length + 1 }
}

/** Document counts per board (Firestore free tier: 1 GiB, 50K reads / 20K writes a day). */
export async function boardCounts() {
  const boards = await listBoards()
  return Promise.all(
    boards.map(async (board) => {
      const ref = boardRef(board.id)
      const [students, spaces, assets] = await Promise.all([
        ref.collection('students').count().get(),
        ref.collection('spaces').get(),
        ref.collection('assets').where('status', '!=', 'deleted').count().get(),
      ])
      const slideCounts = await Promise.all(
        spaces.docs.map((space) =>
          space.ref.collection('slides').count().get(),
        ),
      )
      return {
        board: board.title,
        id: board.id,
        archived: isArchived(lifecycleOf(board)),
        students: students.data().count,
        cards: spaces.size,
        slides: slideCounts.reduce((sum, count) => sum + count.data().count, 0),
        images: assets.data().count,
      }
    }),
  )
}
