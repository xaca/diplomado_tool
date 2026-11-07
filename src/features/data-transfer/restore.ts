import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import {
  createBoard,
  saveBoardLook,
  setArchiveAfterDays,
} from '@/features/boards/api'
import { slideAssetIds, type BoardFile } from '@/features/data-transfer/backup'
import { saveCourse, saveEmailSender } from '@/features/course/api'
import { saveBoardStages } from '@/features/stages/api'
import { db } from '@/lib/firebase'
import { normalizeEmail } from '@/lib/collections'
import { paths, type AttendanceStatus } from '@/model'

// Restore always creates a NEW board (PLAN.md → Import / export). Students come back as
// "invited": they join again by signing in with any of their emails. Card covers are not restored
// (the rules only accept covers uploaded to this board); slide images keep their old references,
// which keep working until the original board is purged.

export async function restoreBoardFile(
  teacherEmail: string,
  { kind, file }: BoardFile,
  onProgress?: (done: number, total: number) => void,
) {
  const boardId = await createBoard(teacherEmail, {
    title: file.board.title,
    description: file.board.description,
  })
  if (file.board.archiveAfterDays !== 90)
    await setArchiveAfterDays(boardId, file.board.archiveAfterDays)
  if (file.board.stages) await saveBoardStages(boardId, file.board.stages)
  if (file.board.look) await saveBoardLook(boardId, file.board.look)
  // M24: the course setup (also from a template) and the sender; the counter starts over
  if (file.board.course)
    await saveCourse(boardId, { ...file.board.course, held: null })
  if (file.board.emailSender)
    await saveEmailSender(boardId, file.board.emailSender)
  if (kind === 'template') return boardId

  const spaces = new Map(file.spaces.map((space) => [space.studentId, space]))
  const total = file.students.length
  let done = 0
  for (const student of file.students) {
    const space = spaces.get(student.id)
    const batch = writeBatch(db)
    batch.set(doc(db, paths.student(boardId, student.id)), {
      displayName: student.name,
      emails: student.emails,
      group: student.group,
      status: 'invited',
      linkedUids: [],
      source: 'import',
      createdAt: serverTimestamp(),
    })
    for (const email of student.emails) {
      const id = normalizeEmail(email)
      batch.set(doc(db, paths.studentEmail(boardId, id)), {
        email: id,
        studentId: student.id,
      })
    }
    if (space) {
      batch.set(doc(db, paths.space(boardId, student.id)), {
        studentId: student.id,
        ownerName: student.name,
        ownerPhotoURL: null,
        ...(student.group ? { group: student.group } : {}),
        title: space.title,
        summary: space.summary,
        color: space.color,
        cover: null,
        ...(space.stage && { stage: space.stage, stageSetBy: 'student' }),
        slideOrder: space.slides.map((slide) => slide.id),
        slideCount: space.slides.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()

    // Slides one by one: each can be close to 1 MB (a batch is limited to 10 MB)
    for (const slide of space?.slides ?? []) {
      await setDoc(doc(db, paths.slide(boardId, student.id, slide.id)), {
        engine: 'excalidraw',
        content: slide.content,
        files: slide.files,
        assetIds: slideAssetIds(slide.files),
        bytes: new TextEncoder().encode(slide.content).length,
        schemaVersion: 1,
        updatedAt: serverTimestamp(),
      })
    }
    done += 1
    onProgress?.(done, total)
  }

  // M18: class dates, and each student's own summary rebuilt from them
  const summaries = new Map<string, Record<string, AttendanceStatus>>()
  const writes: [DocumentReference, Record<string, unknown>][] = []
  for (const day of file.attendance ?? []) {
    for (const [studentId, mark] of Object.entries(day.marks))
      summaries.set(studentId, {
        ...summaries.get(studentId),
        [day.date]: mark.status,
      })
    writes.push([
      doc(db, paths.attendance(boardId, day.date)),
      {
        date: day.date,
        topic: day.topic,
        marks: day.marks,
        takenBy: normalizeEmail(teacherEmail),
        updatedAt: serverTimestamp(),
      },
    ])
  }
  for (const [studentId, dates] of summaries)
    writes.push([
      doc(db, paths.attendanceSummary(boardId, studentId)),
      { dates, updatedAt: serverTimestamp() },
    ])
  // M19: announcements come back as new ones (read state starts empty)
  for (const announcement of file.announcements ?? [])
    writes.push([
      doc(collection(db, paths.announcements(boardId))),
      {
        ...announcement,
        authorEmail: normalizeEmail(teacherEmail),
        authorName: normalizeEmail(teacherEmail).split('@')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        remindedAt: serverTimestamp(),
      },
    ])
  // M10: classes come back with their slides, notes and reactions (closed, not followed)
  for (const klass of file.classes ?? []) {
    const classDoc = doc(collection(db, paths.classes(boardId)))
    const slideIds = klass.slides.map(
      () => doc(collection(db, paths.classSlides(boardId, classDoc.id))).id,
    )
    writes.push([
      classDoc,
      {
        title: klass.title,
        date: klass.date,
        status: klass.status,
        slideOrder: slideIds,
        follow: false,
        liveSlideId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ])
    klass.slides.forEach(({ notes, drawing, ...slide }, index) => {
      writes.push([
        doc(db, paths.classSlide(boardId, classDoc.id, slideIds[index])),
        {
          ...slide,
          reactions: slide.reactions ?? {},
          // M10b: the teacher's drawing keeps its image references
          ...(drawing && {
            content: drawing.content,
            files: drawing.files,
            bytes: new Blob([drawing.content]).size,
          }),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ])
      for (const { id, ...note } of notes)
        writes.push([
          doc(db, paths.stickyNote(boardId, classDoc.id, slideIds[index], id)),
          {
            ...note,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        ])
    })
  }
  // M23: playlists come back in their order (they're read from YouTube again on opening)
  ;(file.recordings ?? []).forEach((recording, position) =>
    writes.push([
      doc(collection(db, paths.recordings(boardId))),
      {
        ...recording,
        position,
        syncedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ]),
  )
  // M24: course news
  for (const item of file.news ?? [])
    writes.push([
      doc(collection(db, paths.news(boardId))),
      { ...item, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    ])
  for (let start = 0; start < writes.length; start += 450) {
    const batch = writeBatch(db)
    for (const [ref, data] of writes.slice(start, start + 450))
      batch.set(ref, data)
    await batch.commit()
  }
  return boardId
}
