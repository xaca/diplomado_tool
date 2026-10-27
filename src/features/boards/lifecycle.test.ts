import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  isArchived,
  isWritable,
  shouldRecordActivity,
  splitByLifecycle,
  suggestPurge,
} from '@/features/boards/lifecycle'

const NOW = Date.UTC(2026, 9, 27, 12)
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS)
const board = (
  overrides: Partial<Parameters<typeof isArchived>[0]> = {},
): Parameters<typeof isArchived>[0] => ({
  status: 'active',
  archiveAfterDays: 90,
  lastActivityAt: daysAgo(1),
  ...overrides,
})

describe('board lifecycle', () => {
  it('archives a board automatically after N days without activity', () => {
    expect(isArchived(board({ lastActivityAt: daysAgo(89) }), NOW)).toBe(false)
    expect(isArchived(board({ lastActivityAt: daysAgo(90) }), NOW)).toBe(true)
    expect(
      isArchived(
        board({ lastActivityAt: daysAgo(31), archiveAfterDays: 30 }),
        NOW,
      ),
    ).toBe(true)
  })

  it('"archive now" archives at once; locked boards never auto-archive', () => {
    expect(isArchived(board({ status: 'archived' }), NOW)).toBe(true)
    expect(
      isArchived(
        board({ status: 'locked', lastActivityAt: daysAgo(400) }),
        NOW,
      ),
    ).toBe(false)
  })

  it('only active, not archived boards can be edited', () => {
    expect(isWritable(board(), NOW)).toBe(true)
    expect(isWritable(board({ status: 'locked' }), NOW)).toBe(false)
    expect(isWritable(board({ status: 'archived' }), NOW)).toBe(false)
    expect(isWritable(board({ lastActivityAt: daysAgo(120) }), NOW)).toBe(false)
  })

  it('suggests purging boards archived for more than a year', () => {
    expect(
      suggestPurge(
        board({ status: 'archived', archivedAt: daysAgo(400) }),
        NOW,
      ),
    ).toBe(true)
    expect(
      suggestPurge(board({ status: 'archived', archivedAt: daysAgo(30) }), NOW),
    ).toBe(false)
    // auto-archived: counted from the automatic archive date
    expect(suggestPurge(board({ lastActivityAt: daysAgo(500) }), NOW)).toBe(
      true,
    )
    expect(suggestPurge(board({ lastActivityAt: daysAgo(200) }), NOW)).toBe(
      false,
    )
  })

  it('records activity at most once an hour', () => {
    expect(shouldRecordActivity(new Date(NOW - 59 * 60_000), NOW)).toBe(false)
    expect(shouldRecordActivity(new Date(NOW - 60 * 60_000), NOW)).toBe(true)
  })

  it('splits boards into active and archived, keeping the order', () => {
    const boards = [
      { id: 'a', ...board() },
      { id: 'b', ...board({ status: 'archived' }) },
      { id: 'c', ...board({ lastActivityAt: daysAgo(100) }) },
      { id: 'd', ...board({ status: 'locked' }) },
    ]
    const { active, archived } = splitByLifecycle(boards, (b) => b, NOW)
    expect(active.map((b) => b.id)).toEqual(['a', 'd'])
    expect(archived.map((b) => b.id)).toEqual(['b', 'c'])
  })
})
