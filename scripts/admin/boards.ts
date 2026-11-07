import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore'
import { isArchived, lifecycleOf } from '@/features/boards/lifecycle'
import {
  buildBackup,
  classBackupOf,
  evaluationBackupOf,
  newsBackupOf,
  presentationBackupOf,
  recordingBackupOf,
  type BoardSnapshot,
} from '@/features/data-transfer/backup'
import { analyzeStorage, type AssetRow } from '@/features/storage/analysis'
import { slugify } from '@/lib/download'
import { toDate } from '@/lib/time'
import type {
  AssetDoc,
  BoardDoc,
  SlideDoc,
  AttendanceDoc,
  AnnouncementDoc,
  ClassDoc,
  NewsDoc,
  RecordingDoc,
  EvaluationDoc,
  PresentationDoc,
  ClassSlideDoc,
  SpaceDoc,
  StickyNoteDoc,
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
  const [
    students,
    spaces,
    assets,
    emails,
    members,
    attendance,
    summaries,
    announcements,
    announcementStates,
    classes,
    achievements,
    recordings,
    watchProgress,
    news,
    emailLog,
    presentations,
    evaluations,
  ] = await Promise.all([
    ref.collection('students').get(),
    ref.collection('spaces').get(),
    ref.collection('assets').get(),
    ref.collection('studentEmails').get(),
    ref.collection('members').get(),
    // M18: attendance goes into the backup and with the board on purge
    ref.collection('attendance').get(),
    ref.collection('attendanceByStudent').get(),
    // M19: announcements and each member's read state
    ref.collection('announcements').get(),
    ref.collection('announcementState').get(),
    // M10: class walls, their slides and notes
    ref.collection('classes').get(),
    // M22: achievements (the counters doc is deleted with them)
    ref.collection('achievements').get(),
    // M23: playlists (in the backup) and students' progress (only purged)
    ref.collection('recordings').get(),
    ref.collection('watchProgress').get(),
    // M24: course news (in the backup) and the email log (only purged)
    ref.collection('news').get(),
    ref.collection('emails').get(),
    // M25: Google Slides and Google Forms (in the backup)
    ref.collection('presentations').get(),
    ref.collection('evaluations').get(),
  ])
  const classSlides = await Promise.all(
    classes.docs.map((item) => item.ref.collection('slides').get()),
  )
  const classNotes = await Promise.all(
    classSlides.map((slides) =>
      Promise.all(
        slides.docs.map((slide) => slide.ref.collection('notes').get()),
      ),
    ),
  )
  // M16: polls and their votes go with the board too
  const polls = await Promise.all(
    spaces.docs.map((space) => space.ref.collection('polls').get()),
  )
  const votes = await Promise.all(
    polls.flatMap((s) =>
      s.docs.map((poll) => poll.ref.collection('votes').get()),
    ),
  )
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
      course: board.course ?? null,
      emailSender: board.emailSender ?? null,
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
    attendance: attendance.docs.map((doc) => {
      const data = doc.data() as AttendanceDoc
      return { date: data.date, topic: data.topic, marks: data.marks }
    }),
    announcements: announcements.docs
      .map((doc) => doc.data() as AnnouncementDoc)
      .sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime(),
      )
      .map(({ title, body, link, important }) => ({
        title,
        body,
        link,
        important,
      })),
    classes: classes.docs.map((item, index) =>
      classBackupOf(
        item.data() as ClassDoc,
        new Map(
          classSlides[index].docs.map((slide) => [
            slide.id,
            slide.data() as ClassSlideDoc,
          ]),
        ),
        new Map(
          classSlides[index].docs.map((slide, slideIndex) => [
            slide.id,
            classNotes[index][slideIndex].docs
              .map((note) => ({
                id: note.id,
                data: note.data() as StickyNoteDoc,
              }))
              .sort(
                (a, b) =>
                  toDate(a.data.createdAt).getTime() -
                  toDate(b.data.createdAt).getTime(),
              ),
          ]),
        ),
      ),
    ),
    recordings: recordings.docs
      .map((doc) => doc.data() as RecordingDoc)
      .sort((a, b) => a.position - b.position)
      .map(recordingBackupOf),
    news: news.docs.map((doc) => newsBackupOf(doc.data() as NewsDoc)),
    presentations: presentations.docs
      .map((doc) => doc.data() as PresentationDoc)
      .sort((a, b) => a.position - b.position)
      .map(presentationBackupOf),
    evaluations: evaluations.docs
      .map((doc) => doc.data() as EvaluationDoc)
      .sort((a, b) => a.position - b.position)
      .map(evaluationBackupOf),
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
    ...[...slides, ...notes, ...votes, ...polls].flatMap((s) =>
      s.docs.map((doc) => doc.ref),
    ),
    // kept versions and edit locks (M15), whether they exist or not
    ...slides.flatMap((s, index) =>
      s.docs.flatMap((slide) => [
        slide.ref.collection('versions').doc('student'),
        slide.ref.collection('versions').doc('teacher'),
        spaces.docs[index].ref.collection('locks').doc(slide.id),
      ]),
    ),
    ...classNotes.flat().flatMap((s) => s.docs.map((doc) => doc.ref)),
    ...classSlides.flatMap((s) => s.docs.map((doc) => doc.ref)),
    ref.collection('achievementStats').doc('counts'),
    ...[
      presentations,
      evaluations,
      news,
      emailLog,
      recordings,
      watchProgress,
      achievements,
      classes,
      spaces,
      members,
      emails,
      students,
      assets,
      announcements,
      announcementStates,
      attendance,
      summaries,
    ].flatMap((s) => s.docs.map((doc) => doc.ref)),
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
      // images of the kept versions (M15) count too
      slideAssetIds: [
        ...slides.flatMap((s) =>
          s.docs.map((doc) => {
            const data = doc.data() as SlideDoc
            return [...(data.assetIds ?? []), ...(data.versionAssetIds ?? [])]
          }),
        ),
        // M10b: images in the teacher's class drawings are in use too
        ...classSlides.flatMap((s) =>
          s.docs.map((doc) =>
            Object.values((doc.data() as ClassSlideDoc).files ?? {}).map(
              (file) => file.assetId,
            ),
          ),
        ),
      ],
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
