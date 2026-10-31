import { toDate } from '@/lib/time'
import {
  LOCK_STALE_MS,
  type SlideDoc,
  type SlideLockDoc,
  type SlideVersionDoc,
} from '@/model'

// Teacher edits students' slides (M15, PLAN.md → M15). Pure rules, unit-tested.

/**
 * Keep the student's version before the teacher's first change of this editing session, unless
 * the slide is already the teacher's (the student hasn't saved since): that version is kept.
 */
export function needsStudentSnapshot(
  slide: Pick<SlideDoc, 'lastEditedBy'>,
  snapshottedThisSession: boolean,
) {
  return !snapshottedThisSession && slide.lastEditedBy !== 'teacher'
}

/** The slide shows "Editada por el docente" (and the student may compare / restore). */
export function editedByTeacher(slide: Pick<SlideDoc, 'lastEditedBy'>) {
  return slide.lastEditedBy === 'teacher'
}

/** Images of every kept version, so the storage cleanup never deletes them. */
export function versionAssetIds(
  ...versions: (Pick<SlideVersionDoc, 'assetIds'> | null | undefined)[]
) {
  return [...new Set(versions.flatMap((version) => version?.assetIds ?? []))]
}

export type LockState =
  | { status: 'loading' }
  | { status: 'mine' }
  | { status: 'held'; holder: SlideLockDoc }

/** Who may edit now: free, mine, or held by someone else (a lock without heartbeat expires). */
export function lockState(
  lock: SlideLockDoc | null | undefined,
  myUid: string,
  now = Date.now(),
): 'free' | 'mine' | 'held' {
  if (!lock) return 'free'
  if (lock.uid === myUid) return 'mine'
  return now - toDate(lock.at).getTime() > LOCK_STALE_MS ? 'free' : 'held'
}
