import { useMemo } from 'react'
import {
  classesCollection,
  classRef,
  classSlidesCollection,
  stickyNotesCollection,
} from '@/features/classes/api'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import type { ClassDoc, ClassSlideDoc, StickyNoteDoc } from '@/model'
import { toDate } from '@/lib/time'

/** The board's classes, newest date first (members and the teacher). */
export function useClasses(boardId: string | undefined, enabled: boolean) {
  const result = useLiveQuery<ClassDoc>(
    enabled && boardId ? classesCollection(boardId) : null,
    `classes:${boardId}:${enabled}`,
  )
  const data = useMemo(
    () =>
      [...result.data].sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime(),
      ),
    [result.data],
  )
  return { ...result, data }
}

export function useClass(
  boardId: string | undefined,
  classId: string | undefined,
) {
  return useLiveDoc<ClassDoc>(
    boardId && classId ? classRef(boardId, classId) : null,
    `class:${boardId}:${classId}`,
  )
}

/** The class's slides in the teacher's order. */
export function useClassSlides(
  boardId: string | undefined,
  classId: string | undefined,
  order: readonly string[] | undefined,
) {
  const result = useLiveQuery<ClassSlideDoc>(
    boardId && classId ? classSlidesCollection(boardId, classId) : null,
    `classSlides:${boardId}:${classId}`,
  )
  const key = order?.join('|') ?? ''
  const data = useMemo(() => {
    const byId = new Map(result.data.map((slide) => [slide.id, slide]))
    return (order ?? []).flatMap((id) => byId.get(id) ?? [])
    // `key` stands for `order`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.data, key])
  return { ...result, data }
}

/** Notes of the slide on screen only (D87: listeners on one slide at a time). */
export function useStickyNotes(
  boardId: string | undefined,
  classId: string | undefined,
  slideId: string | null,
) {
  const result = useLiveQuery<StickyNoteDoc>(
    boardId && classId && slideId
      ? stickyNotesCollection(boardId, classId, slideId)
      : null,
    `stickyNotes:${boardId}:${classId}:${slideId}`,
  )
  const data = useMemo(
    () =>
      [...result.data].sort(
        (a, b) => toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime(),
      ),
    [result.data],
  )
  return { ...result, data }
}
