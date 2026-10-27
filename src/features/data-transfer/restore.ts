import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { createBoard, setArchiveAfterDays } from '@/features/boards/api'
import { slideAssetIds, type BoardFile } from '@/features/data-transfer/backup'
import { db } from '@/lib/firebase'
import { normalizeEmail } from '@/lib/collections'
import { paths } from '@/model'

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
        title: space.title,
        summary: space.summary,
        color: space.color,
        cover: null,
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
  return boardId
}
