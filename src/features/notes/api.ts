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
import {
  noteTextSchema,
  paths,
  type NoteDoc,
  type NoteVisibility,
} from '@/model'

// The teacher's comments on a student's slides, or on the whole project (M27, `slideId: null`).
// One collection per space (one listener per page). Private ones: the board's teachers and the
// owner; public ones (M27, D128): classmates too.

export type Note = WithId<NoteDoc>

export const notesCollection = (boardId: string, studentId: string) =>
  collection(db, paths.notes(boardId, studentId))

/** Where project comments go in `groupNotes` (they have no slide) */
export const PROJECT_NOTES = '_project'

/**
 * Adds a comment (`slideId: null` = on the whole project) and lights the student's
 * "💬 Comentario nuevo" (best effort: on an archived board only the comment is written).
 */
export async function addNote(
  boardId: string,
  studentId: string,
  slideId: string | null,
  author: { email: string; name: string },
  text: string,
  visibility: NoteVisibility = 'private',
) {
  const ref = await addDoc(notesCollection(boardId, studentId), {
    slideId,
    text: noteTextSchema.parse(text),
    visibility,
    authorEmail: author.email,
    authorName: author.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  void updateDoc(doc(db, paths.space(boardId, studentId)), {
    teacherCommentsUnseen: true,
  }).catch(() => undefined)
  return ref
}

export function updateNote(
  boardId: string,
  studentId: string,
  noteId: string,
  text: string,
  visibility?: NoteVisibility,
) {
  return updateDoc(doc(db, paths.note(boardId, studentId, noteId)), {
    text: noteTextSchema.parse(text),
    ...(visibility && { visibility }),
    updatedAt: serverTimestamp(),
  })
}

/** M27: a note's visibility; notes from before M27 are private */
export function visibilityOf(
  note: Pick<NoteDoc, 'visibility'>,
): NoteVisibility {
  return note.visibility === 'public' ? 'public' : 'private'
}

export function deleteNote(boardId: string, studentId: string, noteId: string) {
  return deleteDoc(doc(db, paths.note(boardId, studentId, noteId)))
}

/** slideId (or PROJECT_NOTES) → its notes, oldest first (pure, unit-tested). */
export function groupNotes<T extends Pick<NoteDoc, 'slideId' | 'createdAt'>>(
  notes: readonly T[],
) {
  const bySlide = new Map<string, T[]>()
  const sorted = [...notes].sort(
    (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime(),
  )
  for (const note of sorted) {
    const key = note.slideId ?? PROJECT_NOTES
    bySlide.set(key, [...(bySlide.get(key) ?? []), note])
  }
  return bySlide
}
