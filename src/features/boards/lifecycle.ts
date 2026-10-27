import { toDate } from '@/lib/time'
import type { BoardDoc } from '@/model'

// Board lifecycle (PLAN.md → Data lifecycle). Pure: no Firebase imports, shared with the admin CLI.
// A board is archived when the teacher archives it, or automatically after `archiveAfterDays`
// without activity. Nothing runs on a schedule: the date is compared whenever boards are listed,
// and the Security Rules make the same comparison before any write.

export const DAY_MS = 24 * 60 * 60 * 1000
/** Activity is recorded at most once an hour per board (saves writes). */
export const ACTIVITY_INTERVAL_MS = 60 * 60 * 1000
/** Archived for longer than this → "consider purging" hint. Nothing is ever deleted automatically. */
export const PURGE_HINT_DAYS = 365
export const ARCHIVE_AFTER_CHOICES = [30, 60, 90, 180, 365] as const

type LifecycleFields = Pick<BoardDoc, 'status' | 'archiveAfterDays'> & {
  lastActivityAt: Date
  archivedAt?: Date | null
}

/** Stored board → the fields the lifecycle needs (Firestore timestamps → dates). */
export function lifecycleOf(
  board: Pick<
    BoardDoc,
    'status' | 'archiveAfterDays' | 'lastActivityAt' | 'archivedAt'
  >,
): LifecycleFields {
  return {
    status: board.status,
    archiveAfterDays: board.archiveAfterDays,
    lastActivityAt: toDate(board.lastActivityAt),
    archivedAt: board.archivedAt ? toDate(board.archivedAt) : null,
  }
}

/** When an active board moves to "Proyectos archivados" on its own. */
export function autoArchiveDate(board: LifecycleFields) {
  return new Date(
    board.lastActivityAt.getTime() + board.archiveAfterDays * DAY_MS,
  )
}

export function isArchived(board: LifecycleFields, now = Date.now()) {
  if (board.status === 'archived') return true
  return board.status === 'active' && autoArchiveDate(board).getTime() <= now
}

/** Students can edit (cards, slides, uploads) only on active, not-yet-archived boards. */
export function isWritable(board: LifecycleFields, now = Date.now()) {
  return board.status === 'active' && !isArchived(board, now)
}

/** Since when the board counts as archived (explicit date, or the automatic one). */
export function archivedSince(board: LifecycleFields) {
  return board.status === 'archived'
    ? (board.archivedAt ?? board.lastActivityAt)
    : autoArchiveDate(board)
}

export function suggestPurge(board: LifecycleFields, now = Date.now()) {
  return (
    isArchived(board, now) &&
    now - archivedSince(board).getTime() > PURGE_HINT_DAYS * DAY_MS
  )
}

export function shouldRecordActivity(lastActivityAt: Date, now = Date.now()) {
  return now - lastActivityAt.getTime() >= ACTIVITY_INTERVAL_MS
}

/** Splits boards into the two sections of the home pages, keeping their order. */
export function splitByLifecycle<T>(
  boards: readonly T[],
  fields: (board: T) => LifecycleFields,
  now = Date.now(),
) {
  const active: T[] = []
  const archived: T[] = []
  for (const board of boards)
    (isArchived(fields(board), now) ? archived : active).push(board)
  return { active, archived }
}
