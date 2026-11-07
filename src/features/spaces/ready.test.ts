import { describe, expect, it } from 'vitest'
import {
  matchesReady,
  readyCounts,
  shouldAskBackToWip,
  statusOf,
} from '@/features/spaces/ready'

const cards = [
  { readyToPresent: true, slideCount: 3 },
  { readyToPresent: true, slideCount: 0 },
  { readyToPresent: false, slideCount: 2 },
  { slideCount: 0 },
  { workStatus: 'wip' as const, readyToPresent: false, slideCount: 1 },
]

describe('ready to present (M16)', () => {
  it('"Listos" needs the mark and at least one slide', () => {
    expect(cards.map((card) => matchesReady(card, 'ready'))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ])
    expect(cards.every((card) => matchesReady(card, null))).toBe(true)
  })

  it('counts every filter', () => {
    expect(readyCounts(cards)).toEqual({
      ready: 1,
      wip: 1,
      unmarked: 2,
      withSlides: 3,
      noSlides: 2,
    })
  })
})

describe('En progreso / Listo (M27, D132, D133)', () => {
  it('reads the status, spaces from before M27 included', () => {
    expect(statusOf({ workStatus: 'wip', readyToPresent: false })).toBe('wip')
    expect(statusOf({ workStatus: 'ready', readyToPresent: true })).toBe(
      'ready',
    )
    expect(statusOf({ readyToPresent: true })).toBe('ready')
    expect(statusOf({ readyToPresent: false })).toBeNull()
    expect(statusOf({})).toBeNull()
    expect(statusOf({ workStatus: null })).toBeNull()
  })

  it('asks "¿Vuelves a En progreso?" once, only a student who was Listo', () => {
    expect(shouldAskBackToWip('ready', 'student', false)).toBe(true)
    expect(shouldAskBackToWip('ready', 'student', true)).toBe(false)
    expect(shouldAskBackToWip('ready', 'teacher', false)).toBe(false)
    expect(shouldAskBackToWip('wip', 'student', false)).toBe(false)
    expect(shouldAskBackToWip(null, 'student', false)).toBe(false)
  })
})
