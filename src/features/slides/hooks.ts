import { useMemo } from 'react'
import { useLiveQuery } from '@/lib/firestore-hooks'
import {
  deletedSlidesCollection,
  orderSlides,
  slidesCollection,
} from '@/features/slides/api'
import type { DeletedSlideDoc, SlideDoc } from '@/model'

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

/** M27: slides the teacher deleted (owner and board teacher only; `enabled: false` for others) */
export function useDeletedSlides(
  boardId: string | undefined,
  studentId: string | undefined,
  enabled: boolean,
) {
  return useLiveQuery<DeletedSlideDoc>(
    enabled && boardId && studentId
      ? deletedSlidesCollection(boardId, studentId)
      : null,
    `deletedSlides:${boardId}:${studentId}:${enabled}`,
  )
}
