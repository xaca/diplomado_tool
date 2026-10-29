import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import {
  DEFAULT_BACKGROUND,
  filesPayload,
  serializeScene,
} from '@/features/slides/engine/scene'
import { MAX_SLIDES, paths, type ImageRef, type SlideDoc } from '@/model'

// Slides of one space (PLAN.md → Data model). Saving a slide never touches the space document;
// only adding, deleting and reordering update `slideOrder` (dashboards listen to spaces).

export type Slide = WithId<SlideDoc>

export const slidesCollection = (boardId: string, studentId: string) =>
  collection(db, paths.slides(boardId, studentId))

export class TooManySlidesError extends Error {}

export type LateErrorHandler = (error: unknown) => void

/**
 * Writes go to the offline cache at once; the server confirms later (or never, while offline).
 * Wait a moment so permission errors still surface, then treat the write as done.
 * A rejection that arrives after the wait goes to `onLateError` (e.g. the board was locked).
 */
async function written(
  write: Promise<void>,
  onLateError?: LateErrorHandler,
  waitMs = 1_500,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  const tracked = write.finally(() => {
    settled = true
  })
  await Promise.race([
    tracked,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, waitMs)
    }),
  ])
  clearTimeout(timer)
  if (settled) return
  tracked.catch((error: unknown) => {
    console.error('[slides] write failed', error)
    onLateError?.(error)
  })
}

/** Slides in the space's order (ids without a document yet are skipped). */
export function orderSlides<T extends { id: string }>(
  order: readonly string[],
  slides: readonly T[],
) {
  const byId = new Map(slides.map((slide) => [slide.id, slide]))
  return order.flatMap((id) => byId.get(id) ?? [])
}

export function insertAt(order: readonly string[], index: number, id: string) {
  const next = [...order]
  next.splice(Math.max(0, Math.min(index, next.length)), 0, id)
  return next
}

function slideData(
  content: string,
  bytes: number,
  files: Record<string, ImageRef>,
) {
  return {
    engine: 'excalidraw' as const,
    content,
    bytes,
    ...filesPayload(files),
    schemaVersion: 1 as const,
    updatedAt: serverTimestamp(),
  }
}

function updateOrder(
  batch: ReturnType<typeof writeBatch>,
  boardId: string,
  studentId: string,
  order: string[],
) {
  batch.update(doc(db, paths.space(boardId, studentId)), {
    slideOrder: order,
    slideCount: order.length,
    updatedAt: serverTimestamp(),
  })
}

/** Adds a slide at `index` (a copy of `source` when duplicating). Returns the new id. */
export async function addSlide(
  boardId: string,
  studentId: string,
  order: readonly string[],
  index: number,
  source?: Pick<SlideDoc, 'content' | 'bytes' | 'files'>,
) {
  if (order.length >= MAX_SLIDES) throw new TooManySlidesError()
  const ref = doc(slidesCollection(boardId, studentId))
  const empty = serializeScene([], DEFAULT_BACKGROUND)
  const next = insertAt(order, index, ref.id)
  const batch = writeBatch(db)
  batch.set(
    ref,
    source
      ? slideData(source.content, source.bytes, source.files)
      : slideData(empty.content, empty.bytes, {}),
  )
  updateOrder(batch, boardId, studentId, next)
  await written(batch.commit())
  return ref.id
}

/** Deletes a slide and the teacher's notes on it (same batch: the rules check the slide is gone). */
export async function deleteSlide(
  boardId: string,
  studentId: string,
  order: readonly string[],
  slideId: string,
  noteIds: readonly string[] = [],
) {
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.slide(boardId, studentId, slideId)))
  for (const noteId of noteIds)
    batch.delete(doc(db, paths.note(boardId, studentId, noteId)))
  updateOrder(
    batch,
    boardId,
    studentId,
    order.filter((id) => id !== slideId),
  )
  await written(batch.commit())
}

export async function reorderSlides(
  boardId: string,
  studentId: string,
  order: string[],
) {
  const batch = writeBatch(db)
  updateOrder(batch, boardId, studentId, order)
  await written(batch.commit())
}

/** Dashboards show "updated …": slide saves refresh it at most every 10 minutes (review R2). */
export const SPACE_TOUCH_INTERVAL_MS = 10 * 60_000

export function shouldTouchSpace(lastUpdated: Date, now = Date.now()) {
  return now - lastUpdated.getTime() >= SPACE_TOUCH_INTERVAL_MS
}

export async function touchSpace(boardId: string, studentId: string) {
  await written(
    updateDoc(doc(db, paths.space(boardId, studentId)), {
      updatedAt: serverTimestamp(),
    }),
  )
}

export async function saveSlide(
  boardId: string,
  studentId: string,
  slideId: string,
  content: string,
  bytes: number,
  files: Record<string, ImageRef>,
  onLateError?: LateErrorHandler,
) {
  await written(
    setDoc(
      doc(db, paths.slide(boardId, studentId, slideId)),
      slideData(content, bytes, files),
    ),
    onLateError,
  )
}
