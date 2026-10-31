import { toDate } from '@/lib/time'
import type { AnnouncementDoc, AnnouncementStateDoc } from '@/model'

// Announcements (M19, PLAN.md → M19): pure, unit-tested. An announcement is "new" for a student
// until they open it after its last reminder; removed ones stay hidden until reminded again.

type Announcement = Pick<AnnouncementDoc, 'important' | 'remindedAt'> & {
  id: string
}
type State = Pick<AnnouncementStateDoc, 'read' | 'removed'> | null | undefined

export type InboxStatus = 'new' | 'read'

const time = (value: unknown) => toDate(value).getTime()

/** 'new' · 'read' · 'removed' (removed after its last reminder). */
export function statusOf(announcement: Announcement, state: State) {
  const reminded = time(announcement.remindedAt)
  const removed = state?.removed?.[announcement.id]
  if (removed != null && time(removed) >= reminded) return 'removed' as const
  const read = state?.read?.[announcement.id]
  return read != null && time(read) >= reminded
    ? ('read' as const)
    : ('new' as const)
}

/** What the 🔔 lists: not removed, latest (reminded) first, with each one's status. */
export function inbox<T extends Announcement>(
  announcements: readonly T[],
  state: State,
) {
  return announcements
    .map((announcement) => ({
      announcement,
      status: statusOf(announcement, state),
    }))
    .filter(
      (item): item is { announcement: T; status: InboxStatus } =>
        item.status !== 'removed',
    )
    .sort(
      (a, b) =>
        time(b.announcement.remindedAt) - time(a.announcement.remindedAt),
    )
}

export function unreadCount(items: readonly { status: InboxStatus }[]) {
  return items.filter((item) => item.status === 'new').length
}

/** The window: important and new, oldest first, minus what was closed in this visit. */
export function windowQueue<T extends Announcement>(
  items: readonly { announcement: T; status: InboxStatus }[],
  dismissed: ReadonlySet<string>,
) {
  return items
    .filter(
      ({ announcement, status }) =>
        status === 'new' &&
        announcement.important &&
        !dismissed.has(`${announcement.id}@${time(announcement.remindedAt)}`),
    )
    .map(({ announcement }) => announcement)
    .reverse()
}

/** The key a window dismissal is remembered by (a reminder opens it again). */
export const dismissKey = (announcement: Announcement) =>
  `${announcement.id}@${time(announcement.remindedAt)}`

/** "12 de 17 leyeron": members who opened it after its last reminder. */
export function readCount(
  announcement: Announcement,
  states: readonly State[],
) {
  return states.filter((state) => statusOf(announcement, state) !== 'new')
    .length
}

/** Ids that became new since the previous look (a chime for each arrival, not on first load). */
export function arrivals(
  previous: ReadonlySet<string> | null,
  next: ReadonlySet<string>,
) {
  if (!previous) return []
  return [...next].filter((key) => !previous.has(key))
}

/** At most one chime every `gap` ms. */
export function mayChime(lastAt: number | null, now: number, gap = 4000) {
  return lastAt === null || now - lastAt >= gap
}

/** Drops the entries of deleted announcements (keeps the state doc small). */
export function pruned(
  map: Record<string, unknown> | undefined,
  ids: ReadonlySet<string>,
) {
  return Object.fromEntries(
    Object.entries(map ?? {}).filter(([id]) => ids.has(id)),
  )
}

/** An app path opens in the app; anything else (https) in a new tab. */
export const isAppLink = (link: string) => link.startsWith('/')
