import { useMemo } from 'react'
import { groupNotes, notesCollection } from '@/features/notes/api'
import { useLiveQuery } from '@/lib/firestore-hooks'
import type { NoteDoc } from '@/model'

/**
 * Live notes of a space, grouped by slide. Pass `enabled: false` for classmates: they can't
 * read them (the listener would fail).
 */
export function useNotes(
  boardId: string | undefined,
  studentId: string | undefined,
  enabled: boolean,
) {
  const result = useLiveQuery<NoteDoc>(
    enabled && boardId && studentId
      ? notesCollection(boardId, studentId)
      : null,
    `notes:${boardId}:${studentId}:${enabled}`,
  )
  const bySlide = useMemo(() => groupNotes(result.data), [result.data])
  return { ...result, bySlide }
}
