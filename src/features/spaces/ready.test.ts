import { describe, expect, it } from 'vitest'
import { matchesReady, readyCounts } from '@/features/spaces/ready'

const cards = [
  { readyToPresent: true, slideCount: 3 },
  { readyToPresent: true, slideCount: 0 },
  { readyToPresent: false, slideCount: 2 },
  { slideCount: 0 },
]

describe('ready to present (M16)', () => {
  it('"Listos" needs the mark and at least one slide', () => {
    expect(cards.map((card) => matchesReady(card, 'ready'))).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(cards.every((card) => matchesReady(card, null))).toBe(true)
  })

  it('counts every filter', () => {
    expect(readyCounts(cards)).toEqual({ ready: 1, withSlides: 2, noSlides: 2 })
  })
})
