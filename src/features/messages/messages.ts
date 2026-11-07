import {
  MAX_MESSAGE_PREVIEW,
  MAX_MESSAGE_TEXT,
  MESSAGE_COOLDOWN_MS,
  type ConversationDoc,
  type MessageFrom,
} from '@/model'

/** The Mensajes page, optionally on one student's conversation (teacher) */
export const messagesPath = (boardId: string, studentId?: string) =>
  `/b/${boardId}/mensajes${studentId ? `?s=${studentId}` : ''}`

// Mensajes (M26): pure logic, shared by the student's and the teacher's views. Times are
// Firestore timestamps (or a pending server time, which counts as "now").

type Stamp = unknown

/** A stored time in ms; null when there is none (never read). A pending server time is "now". */
export function millis(value: Stamp, now = Date.now()): number | null {
  if (value === undefined || value === null) return null
  if (
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  )
    return value.toMillis() as number
  if (value instanceof Date) return value.getTime()
  return now
}

export const otherSide = (who: MessageFrom): MessageFrom =>
  who === 'student' ? 'teacher' : 'student'

const readAtOf = (conversation: ConversationDoc, who: MessageFrom) =>
  who === 'student' ? conversation.studentReadAt : conversation.teacherReadAt

/** Something from the other side that `who` hasn't opened yet */
export function isUnread(
  conversation: ConversationDoc | null | undefined,
  who: MessageFrom,
) {
  if (!conversation || conversation.lastFrom === who) return false
  const read = millis(readAtOf(conversation, who))
  const last = millis(conversation.lastMessageAt) ?? 0
  return read === null || last > read
}

/** The student wrote last: a teacher should answer (read or not) */
export const isWaiting = (conversation: ConversationDoc) =>
  conversation.lastFrom === 'student'

/** The teacher's list: unread first, then waiting for a reply, then the newest */
export function sortConversations<T extends ConversationDoc>(list: T[]): T[] {
  const rank = (item: T) =>
    isUnread(item, 'teacher') ? 0 : isWaiting(item) ? 1 : 2
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (millis(b.lastMessageAt) ?? 0) - (millis(a.lastMessageAt) ?? 0),
  )
}

/** How many conversations have something new for the teacher */
export const unreadForTeacher = (list: ConversationDoc[]) =>
  list.filter((item) => isUnread(item, 'teacher')).length

/** The text that goes into the conversation's preview: one line, cut at 120 */
export function previewOf(text: string) {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > MAX_MESSAGE_PREVIEW
    ? `${line.slice(0, MAX_MESSAGE_PREVIEW - 1)}…`
    : line
}

/** What can be sent: trimmed, 1–1000 characters */
export function cleanText(text: string) {
  const trimmed = text.trim()
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_TEXT
    ? trimmed
    : null
}

/** Milliseconds left before this conversation accepts another message (the rules check it too) */
export function cooldownLeft(
  conversation: ConversationDoc | null | undefined,
  now = Date.now(),
) {
  const last = conversation ? millis(conversation.lastMessageAt, now) : null
  return last === null ? 0 : Math.max(0, last + MESSAGE_COOLDOWN_MS - now)
}

export type Segment = { text: string } | { text: string; href: string }

// Only https:// becomes a link (no javascript:, data:, http:); trailing punctuation stays text
const URL_RE = /https:\/\/[^\s<>"]+/g
const TRAILING = /[.,;:!?)\]}'»”]+$/

function isHttps(url: string) {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

/** A message as text and safe links, for rendering without HTML */
export function segments(text: string): Segment[] {
  const out: Segment[] = []
  let at = 0
  for (const match of text.matchAll(URL_RE)) {
    let url = match[0]
    const tail = TRAILING.exec(url)?.[0] ?? ''
    url = url.slice(0, url.length - tail.length)
    const start = match.index
    if (start > at) out.push({ text: text.slice(at, start) })
    out.push(isHttps(url) ? { text: url, href: url } : { text: url })
    at = start + url.length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

/** The local day of a time, for grouping ("hoy", "ayer", "12 oct.") */
export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "hoy" / "ayer" / a short date */
export function dayLabel(date: Date, locale: string, now = new Date()) {
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 24 * 3600 * 1000))
  const key = dayKey(date)
  const es = locale.startsWith('es')
  if (key === today) return es ? 'Hoy' : 'Today'
  if (key === yesterday) return es ? 'Ayer' : 'Yesterday'
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}

/** "Visto": the other side opened the conversation after my message was sent */
export function seenByOther(
  conversation: ConversationDoc | null | undefined,
  me: MessageFrom,
  sentAt: Stamp,
) {
  if (!conversation) return false
  const read = millis(readAtOf(conversation, otherSide(me)))
  const sent = millis(sentAt)
  return read !== null && sent !== null && read >= sent
}
