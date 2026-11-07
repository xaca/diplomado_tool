import { useMemo } from 'react'
import { limit, query, where } from 'firebase/firestore'
import { presentationsCollection } from '@/features/presentations/api'
import { useLiveQuery } from '@/lib/firestore-hooks'
import type { PresentationDoc } from '@/model'

/**
 * The board's presentations in the teacher's order. Students ask only for the visible ones: the
 * rules refuse them the hidden ones (D121), so their query must say `enabled == true`.
 */
export function usePresentations(
  boardId: string | undefined,
  { load = true, onlyVisible = false } = {},
) {
  const list = useLiveQuery<PresentationDoc>(
    load && boardId
      ? onlyVisible
        ? query(presentationsCollection(boardId), where('enabled', '==', true))
        : presentationsCollection(boardId)
      : null,
    `presentations:${boardId}:${load}:${onlyVisible}`,
  )
  const data = useMemo(
    () => [...list.data].sort((a, b) => a.position - b.position),
    [list.data],
  )
  return { ...list, data }
}

/**
 * Whether the Presentaciones section shows (D120): always for the teacher (nothing is read),
 * for students only when one is visible.
 */
export function useHasPresentations(
  boardId: string | undefined,
  teacher: boolean,
) {
  const visible = useLiveQuery<PresentationDoc>(
    boardId && !teacher
      ? query(
          presentationsCollection(boardId),
          where('enabled', '==', true),
          limit(1),
        )
      : null,
    `presentations-any:${boardId}:${teacher}`,
  )
  return teacher || (!visible.loading && visible.data.length > 0)
}
