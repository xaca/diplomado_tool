import { useMemo } from 'react'
import { limit, query, where } from 'firebase/firestore'
import { evaluationsCollection } from '@/features/evaluations/api'
import { useLiveQuery } from '@/lib/firestore-hooks'
import type { EvaluationDoc } from '@/model'

/**
 * The board's evaluations in the teacher's order. Students ask only for the visible ones: the
 * rules refuse them the hidden ones (D121), so their query must say `enabled == true`.
 */
export function useEvaluations(
  boardId: string | undefined,
  { load = true, onlyVisible = false } = {},
) {
  const list = useLiveQuery<EvaluationDoc>(
    load && boardId
      ? onlyVisible
        ? query(evaluationsCollection(boardId), where('enabled', '==', true))
        : evaluationsCollection(boardId)
      : null,
    `evaluations:${boardId}:${load}:${onlyVisible}`,
  )
  const data = useMemo(
    () => [...list.data].sort((a, b) => a.position - b.position),
    [list.data],
  )
  return { ...list, data }
}

/**
 * Whether the Evaluaciones section shows (D120): always for the teacher (nothing is read),
 * for students only when one is visible.
 */
export function useHasEvaluations(
  boardId: string | undefined,
  teacher: boolean,
) {
  const visible = useLiveQuery<EvaluationDoc>(
    boardId && !teacher
      ? query(
          evaluationsCollection(boardId),
          where('enabled', '==', true),
          limit(1),
        )
      : null,
    `evaluations-any:${boardId}:${teacher}`,
  )
  return teacher || (!visible.loading && visible.data.length > 0)
}
