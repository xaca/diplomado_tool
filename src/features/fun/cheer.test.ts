import { describe, expect, it } from 'vitest'
import {
  CHEER_GAP_MS,
  cheerOn,
  decideCheer,
  freshMemory,
  newNotes,
  pickVariant,
  remember,
  slideEvent,
} from '@/features/fun/cheer'

const base = { enabled: true, milestones: {}, memory: freshMemory(), now: 1e6 }

describe('decideCheer', () => {
  it('says nothing when switched off; on by default', () => {
    expect(decideCheer('ready', { ...base, enabled: false })).toBeNull()
    expect(cheerOn(undefined)).toBe(true)
    expect(cheerOn({ cheer: false })).toBe(false)
  })

  it('once-only moments are stored and never repeat', () => {
    expect(decideCheer('firstSlide', base)).toEqual({
      burst: true,
      milestone: 'firstSlide',
    })
    expect(
      decideCheer('firstSlide', { ...base, milestones: { firstSlide: true } }),
    ).toBeNull()
    expect(decideCheer('ready', base)?.milestone).toBeNull()
  })

  it('confetti only for milestones, at most one burst every 30 s', () => {
    expect(decideCheer('photo', base)?.burst).toBe(false)
    const first = decideCheer('ready', base)!
    const memory = remember(base.memory, 'ready', first, base.now)
    expect(
      decideCheer('stage', { ...base, memory, now: base.now + 5_000 }),
    ).toEqual({ burst: false, milestone: null })
    expect(
      decideCheer('stage', { ...base, memory, now: base.now + CHEER_GAP_MS })
        ?.burst,
    ).toBe(true)
  })

  it('the same message is not repeated within 30 s (toggling "Lista")', () => {
    const memory = remember(
      base.memory,
      'ready',
      { burst: true, milestone: null },
      base.now,
    )
    expect(
      decideCheer('ready', { ...base, memory, now: base.now + 1_000 }),
    ).toBeNull()
    expect(
      decideCheer('ready', { ...base, memory, now: base.now + CHEER_GAP_MS }),
    ).not.toBeNull()
  })
})

describe('moments', () => {
  it('the first slide, then every 5', () => {
    expect([1, 2, 4, 5, 6, 10, 15].map(slideEvent)).toEqual([
      'firstSlide',
      null,
      null,
      'slides',
      null,
      'slides',
      'slides',
    ])
    expect(slideEvent(0)).toBeNull()
  })

  it('three phrasings, picked at random', () => {
    expect([0, 0.4, 0.99, 1].map(pickVariant)).toEqual(['a', 'b', 'c', 'c'])
  })

  it("teacher's notes: only the ones after my last visit, none the first time", () => {
    expect(newNotes([10, 20, 30], null)).toBe(0)
    expect(newNotes([10, 20, 30], 15)).toBe(2)
    expect(newNotes([10], 10)).toBe(0)
  })
})
