import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import { noteTextSchema, paths, type NoteDoc } from '@/model'

// The teacher's annotations on a student's slides. One collection per space (one listener per
// page); each note points to its slide. Only the board's teachers and the owner read them.

export type Note = WithId<NoteDoc>

export const notesCollection = (boardId: string, studentId: string) =>
  collection(db, paths.notes(boardId, studentId))

export function addNote(
  boardId: string,
  studentId: string,
  slideId: string,
  author: { email: string; name: string },
  text: string,
) {
  return addDoc(notesCollection(boardId, studentId), {
    slideId,
    text: noteTextSchema.parse(text),
    authorEmail: author.email,
    authorName: author.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateNote(
  boardId: string,
  studentId: string,
  noteId: string,
  text: string,
) {
  return updateDoc(doc(db, paths.note(boardId, studentId, noteId)), {
    text: noteTextSchema.parse(text),
    updatedAt: serverTimestamp(),
  })
}

export function deleteNote(boardId: string, studentId: string, noteId: string) {
  return deleteDoc(doc(db, paths.note(boardId, studentId, noteId)))
}

/** slideId → its notes, oldest first (pure, unit-tested). */
export function groupNotes<T extends Pick<NoteDoc, 'slideId' | 'createdAt'>>(
  notes: readonly T[],
) {
  const bySlide = new Map<string, T[]>()
  const sorted = [...notes].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime(),
  )
  for (const note of sorted)
    bySlide.set(note.slideId, [...(bySlide.get(note.slideId) ?? []), note])
  return bySlide
}
