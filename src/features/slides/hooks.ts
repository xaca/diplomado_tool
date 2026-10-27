import { useMemo } from 'react'
import { useLiveQuery } from '@/lib/firestore-hooks'
import { orderSlides, slidesCollection } from '@/features/slides/api'
import type { SlideDoc } from '@/model'

/** Live slides of a space, in the space's order. */
export function useSlides(
  boardId: string | undefined,
  studentId: string | undefined,
  order: readonly string[] | undefined,
) {
  const result = useLiveQuery<SlideDoc>(
    boardId && studentId ? slidesCollection(boardId, studentId) : null,
    `slides:${boardId}:${studentId}`,
  )
  const slides = useMemo(
    () => orderSlides(order ?? [], result.data),
    [order, result.data],
  )
  return { ...result, data: slides }
}
