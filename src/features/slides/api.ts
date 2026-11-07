import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import {
  DEFAULT_BACKGROUND,
  filesPayload,
  serializeScene,
} from '@/features/slides/engine/scene'
import { versionAssetIds } from '@/features/slides/teacher-edits'
import {
  MAX_SLIDES,
  paths,
  VERSION_KINDS,
  type DeletedSlideDoc,
  type ImageRef,
  type SlideDoc,
  type SlideLockDoc,
  type SlideVersionDoc,
} from '@/model'

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

/** A slide's kept versions and edit lock (M15): deleted with the slide (missing docs are fine). */
export function deleteSlideExtras(
  batch: WriteBatch,
  boardId: string,
  studentId: string,
  slideId: string,
) {
  for (const kind of VERSION_KINDS)
    batch.delete(doc(db, paths.version(boardId, studentId, slideId, kind)))
  batch.delete(doc(db, paths.lock(boardId, studentId, slideId)))
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
  deleteSlideExtras(batch, boardId, studentId, slideId)
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

/** Who saves, and (teacher) the slide as the student left it, when it must be kept first (M15). */
export type SaveAuthor =
  | { role: 'student' }
  | {
      role: 'teacher'
      /** Set on the teacher's first save of a student's version (see needsStudentSnapshot) */
      keep?: Pick<SlideDoc, 'content' | 'files' | 'assetIds' | 'bytes'>
    }

export async function saveSlide(
  boardId: string,
  studentId: string,
  slideId: string,
  content: string,
  bytes: number,
  files: Record<string, ImageRef>,
  onLateError?: LateErrorHandler,
  author: SaveAuthor = { role: 'student' },
) {
  const data = {
    ...slideData(content, bytes, files),
    lastEditedBy: author.role,
    ...(author.role === 'teacher' && { teacherEditedAt: serverTimestamp() }),
  }
  const keep = author.role === 'teacher' ? author.keep : undefined
  const ref = doc(db, paths.slide(boardId, studentId, slideId))
  // Only these fields are replaced: the kept versions' images (versionAssetIds) survive
  const write = (batch: WriteBatch) =>
    batch.set(
      ref,
      keep ? { ...data, versionAssetIds: versionAssetIds(keep) } : data,
      {
        mergeFields: [
          ...Object.keys(data),
          ...(keep ? ['versionAssetIds'] : []),
        ],
      },
    )
  const batch = writeBatch(db)
  write(batch)
  if (keep) {
    batch.set(doc(db, paths.version(boardId, studentId, slideId, 'student')), {
      content: keep.content,
      files: keep.files ?? {},
      assetIds: keep.assetIds ?? [],
      bytes: keep.bytes,
      kind: 'student',
      createdAt: serverTimestamp(),
    })
    // the student's card shows "✎ Docente" until they look
    batch.update(doc(db, paths.space(boardId, studentId)), {
      teacherEditsUnseen: true,
    })
  }
  await written(batch.commit(), onLateError)
}

/** The teacher adds a slide at the end of the student's space (M15). Returns the new id. */
export async function addSlideAsTeacher(
  boardId: string,
  studentId: string,
  order: readonly string[],
) {
  if (order.length >= MAX_SLIDES) throw new TooManySlidesError()
  const ref = doc(slidesCollection(boardId, studentId))
  const empty = serializeScene([], DEFAULT_BACKGROUND)
  const batch = writeBatch(db)
  batch.set(ref, {
    ...slideData(empty.content, empty.bytes, {}),
    lastEditedBy: 'teacher',
    teacherEditedAt: serverTimestamp(),
  })
  batch.update(doc(db, paths.space(boardId, studentId)), {
    slideOrder: [...order, ref.id],
    slideCount: order.length + 1,
    teacherEditsUnseen: true,
  })
  await written(batch.commit())
  return ref.id
}

/**
 * The student brings back their version (M15). The teacher's version is kept, so it can be undone
 * with `swapToTeacher`.
 */
export async function restoreStudentVersion(
  boardId: string,
  studentId: string,
  slide: Slide,
  student: SlideVersionDoc,
) {
  const batch = writeBatch(db)
  batch.set(doc(db, paths.version(boardId, studentId, slide.id, 'teacher')), {
    content: slide.content,
    files: slide.files ?? {},
    assetIds: slide.assetIds ?? [],
    bytes: slide.bytes,
    kind: 'teacher',
    createdAt: serverTimestamp(),
  })
  batch.set(
    doc(db, paths.slide(boardId, studentId, slide.id)),
    {
      ...slideData(student.content, student.bytes, student.files),
      lastEditedBy: 'student',
      versionAssetIds: versionAssetIds(student, slide),
    },
    {
      mergeFields: [
        'engine',
        'content',
        'bytes',
        'files',
        'assetIds',
        'schemaVersion',
        'updatedAt',
        'lastEditedBy',
        'versionAssetIds',
      ],
    },
  )
  await batch.commit()
}

/** Undo of a restore: the teacher's version again (saved by the student, so no "editada" badge). */
export async function swapToTeacher(
  boardId: string,
  studentId: string,
  slideId: string,
  teacher: SlideVersionDoc,
) {
  await setDoc(
    doc(db, paths.slide(boardId, studentId, slideId)),
    {
      ...slideData(teacher.content, teacher.bytes, teacher.files),
      lastEditedBy: 'student',
    },
    {
      mergeFields: [
        'engine',
        'content',
        'bytes',
        'files',
        'assetIds',
        'schemaVersion',
        'updatedAt',
        'lastEditedBy',
      ],
    },
  )
}

/** The student looked at their slides: the card's "✎ Docente" badge goes away. */
export function markTeacherEditsSeen(boardId: string, studentId: string) {
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    teacherEditsUnseen: false,
  })
}

// ---------- edit lock (one editor per slide, M15) ----------

export const lockRef = (boardId: string, studentId: string, slideId: string) =>
  doc(db, paths.lock(boardId, studentId, slideId))

/** Takes or renews the lock; the rules refuse it while someone else holds a fresh one. */
export function holdLock(
  boardId: string,
  studentId: string,
  slideId: string,
  me: Pick<SlideLockDoc, 'uid' | 'name' | 'role'>,
) {
  return setDoc(lockRef(boardId, studentId, slideId), {
    ...me,
    at: serverTimestamp(),
  })
}

export function releaseLock(
  boardId: string,
  studentId: string,
  slideId: string,
) {
  return deleteDoc(lockRef(boardId, studentId, slideId))
}

// ---------- M27 (D129): the teacher reorders and deletes; the student restores ----------

export type DeletedSlide = WithId<DeletedSlideDoc>

export const deletedSlidesCollection = (boardId: string, studentId: string) =>
  collection(db, paths.deletedSlides(boardId, studentId))

/** The teacher's new order; the student's own order is kept the first time ("Restaurar el orden"). */
export async function reorderSlidesAsTeacher(
  boardId: string,
  studentId: string,
  order: readonly string[],
  next: string[],
  studentSlideOrder: readonly string[] | null | undefined,
) {
  await written(
    updateDoc(doc(db, paths.space(boardId, studentId)), {
      slideOrder: next,
      slideCount: next.length,
      studentSlideOrder: studentSlideOrder ?? [...order],
      teacherEditsUnseen: true,
      updatedAt: serverTimestamp(),
    }),
  )
}

/**
 * The teacher deletes a student's slide: a copy goes to "Eliminadas por el docente" in the same
 * batch (the rules require it), so the student can bring it back. Its notes stay with the copy.
 */
export async function deleteSlideAsTeacher(
  boardId: string,
  studentId: string,
  order: readonly string[],
  slide: Pick<Slide, 'id' | 'content' | 'files' | 'assetIds' | 'bytes'>,
  teacherName: string,
  studentSlideOrder: readonly string[] | null | undefined,
) {
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.slide(boardId, studentId, slide.id)))
  deleteSlideExtras(batch, boardId, studentId, slide.id)
  batch.set(doc(db, paths.deletedSlide(boardId, studentId, slide.id)), {
    content: slide.content,
    files: slide.files,
    assetIds: slide.assetIds,
    bytes: slide.bytes,
    position: Math.max(0, order.indexOf(slide.id)),
    deletedAt: serverTimestamp(),
    deletedByName: teacherName.slice(0, 200) || '—',
  })
  const next = order.filter((id) => id !== slide.id)
  batch.update(doc(db, paths.space(boardId, studentId)), {
    slideOrder: next,
    slideCount: next.length,
    studentSlideOrder: studentSlideOrder ?? [...order],
    teacherEditsUnseen: true,
    updatedAt: serverTimestamp(),
  })
  await written(batch.commit())
}

/** "Restaurar": the slide comes back where it was (or at the end, if the list got shorter). */
export async function restoreDeletedSlide(
  boardId: string,
  studentId: string,
  order: readonly string[],
  copy: DeletedSlide,
) {
  if (order.length >= MAX_SLIDES) throw new TooManySlidesError()
  const batch = writeBatch(db)
  batch.set(doc(db, paths.slide(boardId, studentId, copy.id)), {
    ...slideData(copy.content, copy.bytes, copy.files),
    lastEditedBy: 'student',
  })
  batch.delete(doc(db, paths.deletedSlide(boardId, studentId, copy.id)))
  const next = insertAt(order, copy.position, copy.id)
  batch.update(doc(db, paths.space(boardId, studentId)), {
    slideOrder: next,
    slideCount: next.length,
    updatedAt: serverTimestamp(),
  })
  await written(batch.commit())
}

/** The student lets it go for good: the copy and its notes (its images become unused). */
export async function discardDeletedSlide(
  boardId: string,
  studentId: string,
  slideId: string,
  noteIds: readonly string[],
) {
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.deletedSlide(boardId, studentId, slideId)))
  for (const noteId of noteIds)
    batch.delete(doc(db, paths.note(boardId, studentId, noteId)))
  await written(batch.commit())
}

/**
 * The student's order back: their slides as they had them, then any slide added since (pure,
 * unit-tested). Slides deleted meanwhile are skipped.
 */
export function studentOrderBack(
  current: readonly string[],
  studentOrder: readonly string[],
) {
  const here = new Set(current)
  const kept = studentOrder.filter((id) => here.has(id))
  const keptSet = new Set(kept)
  return [...kept, ...current.filter((id) => !keptSet.has(id))]
}

export async function restoreStudentOrder(
  boardId: string,
  studentId: string,
  current: readonly string[],
  studentOrder: readonly string[],
) {
  const next = studentOrderBack(current, studentOrder)
  await written(
    updateDoc(doc(db, paths.space(boardId, studentId)), {
      slideOrder: next,
      slideCount: next.length,
      studentSlideOrder: null,
      updatedAt: serverTimestamp(),
    }),
  )
}
