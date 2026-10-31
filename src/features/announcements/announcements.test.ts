import { describe, expect, it } from 'vitest'
import {
  arrivals,
  dismissKey,
  inbox,
  isAppLink,
  mayChime,
  pruned,
  readCount,
  statusOf,
  unreadCount,
  windowQueue,
} from '@/features/announcements/announcements'
import { announcementInputSchema } from '@/model'

const at = (ms: number) => ({ toDate: () => new Date(ms) })
const a = (id: string, reminded: number, important = false) => ({
  id,
  important,
  remindedAt: at(reminded),
})

describe('announcements (M19)', () => {
  it('new until opened after its last reminder; removed until reminded again', () => {
    expect(statusOf(a('x', 10), null)).toBe('new')
    expect(statusOf(a('x', 10), { read: { x: at(12) }, removed: {} })).toBe(
      'read',
    )
    // reminded after I read it → new again
    expect(statusOf(a('x', 20), { read: { x: at(12) }, removed: {} })).toBe(
      'new',
    )
    expect(statusOf(a('x', 10), { read: {}, removed: { x: at(15) } })).toBe(
      'removed',
    )
    // a reminder brings back what I removed
    expect(
      statusOf(a('x', 20), { read: { x: at(15) }, removed: { x: at(15) } }),
    ).toBe('new')
  })

  it('the 🔔: visible ones, latest first, and the badge', () => {
    const state = { read: { b: at(30) }, removed: { c: at(30) } }
    const items = inbox([a('a', 10), a('b', 20), a('c', 25), a('d', 40)], state)
    expect(items.map((item) => [item.announcement.id, item.status])).toEqual([
      ['d', 'new'],
      ['b', 'read'],
      ['a', 'new'],
    ])
    expect(unreadCount(items)).toBe(2)
  })

  it('the window: important and new, oldest first, minus closed in this visit (a reminder reopens)', () => {
    const items = inbox([a('a', 10, true), a('b', 20), a('c', 30, true)], null)
    expect(windowQueue(items, new Set()).map((x) => x.id)).toEqual(['a', 'c'])
    const closed = new Set([dismissKey(a('a', 10))])
    expect(windowQueue(items, closed).map((x) => x.id)).toEqual(['c'])
    const reminded = inbox([a('a', 50, true)], null)
    expect(windowQueue(reminded, closed).map((x) => x.id)).toEqual(['a'])
  })

  it('read count: members who opened it after the last reminder (removing counts as seen)', () => {
    const states = [
      { read: { x: at(12) }, removed: {} },
      { read: {}, removed: { x: at(13) } },
      { read: { x: at(5) }, removed: {} },
      null,
    ]
    expect(readCount(a('x', 10), states)).toBe(2)
  })

  it('a chime per arrival, not on first load, at most one every 4 s', () => {
    expect(arrivals(null, new Set(['a']))).toEqual([])
    expect(arrivals(new Set(['a']), new Set(['a', 'b']))).toEqual(['b'])
    expect(mayChime(null, 1000)).toBe(true)
    expect(mayChime(1000, 3000)).toBe(false)
    expect(mayChime(1000, 5000)).toBe(true)
  })

  it('state of deleted announcements is dropped; links: app paths or https only', () => {
    expect(pruned({ a: 1, gone: 2 }, new Set(['a']))).toEqual({ a: 1 })
    expect(isAppLink('/b/board1')).toBe(true)
    expect(isAppLink('https://canva.com')).toBe(false)
    const valid = (link: string) =>
      announcementInputSchema.safeParse({
        title: 'x',
        body: '',
        link,
        important: false,
      }).success
    expect(valid('')).toBe(true)
    expect(valid('/b/board1/s/st_laura')).toBe(true)
    expect(valid('https://www.canva.com/design/x/view')).toBe(true)
    expect(valid('http://insecure.example')).toBe(false)
    expect(valid('javascript:alert(1)')).toBe(false)
  })
})
