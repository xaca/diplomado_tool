import { useMemo } from 'react'
import { query, where } from 'firebase/firestore'
import { groupNotes, notesCollection } from '@/features/notes/api'
import { useLiveQuery } from '@/lib/firestore-hooks'
import type { NoteDoc } from '@/model'

/**
 * Who reads a space's comments: `all` = the board's teacher and the owner; `public` = classmates
 * (M27: only the public ones, the rules refuse the rest); `none` = nothing (no listener).
 */
export type NotesAccess = 'all' | 'public' | 'none'

/** Live comments of a space, grouped by slide (project comments under PROJECT_NOTES). */
export function useNotes(
  boardId: string | undefined,
  studentId: string | undefined,
  access: NotesAccess,
) {
  const result = useLiveQuery<NoteDoc>(
    access !== 'none' && boardId && studentId
      ? access === 'public'
        ? query(
            notesCollection(boardId, studentId),
            where('visibility', '==', 'public'),
          )
        : notesCollection(boardId, studentId)
      : null,
    `notes:${boardId}:${studentId}:${access}`,
  )
  const bySlide = useMemo(() => groupNotes(result.data), [result.data])
  return { ...result, bySlide }
}
