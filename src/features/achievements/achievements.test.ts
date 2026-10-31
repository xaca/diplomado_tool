import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENT_INFO,
  byGroup,
  derivedAchievements,
  GROUPS,
  missing,
  share,
  unlockedCount,
  withClass,
} from '@/features/achievements/achievements'
import { ACHIEVEMENTS, DEFAULT_STAGES } from '@/model'

const space = (overrides = {}) => ({
  slideCount: 0,
  readyToPresent: false,
  stage: null as string | null,
  ...overrides,
})

describe('achievements', () => {
  it('every achievement has a group, and the groups cover them all (14)', () => {
    expect(ACHIEVEMENTS).toHaveLength(14)
    expect(GROUPS.flatMap(byGroup).sort()).toEqual([...ACHIEVEMENTS].sort())
    for (const key of ACHIEVEMENTS)
      expect(ACHIEVEMENT_INFO[key].emoji).toBeTruthy()
  })

  it('what is already true from my card and profile', () => {
    expect(
      derivedAchievements({
        space: space(),
        stages: DEFAULT_STAGES,
        profile: null,
      }),
    ).toEqual([])
    expect(
      derivedAchievements({
        space: space({ slideCount: 10, readyToPresent: true, stage: 'test' }),
        stages: DEFAULT_STAGES,
        profile: {
          photoSource: 'upload',
          avatar: { publicId: 'x', version: 1 },
        },
      }),
    ).toEqual([
      'firstSlide',
      'slides5',
      'slides10',
      'ready',
      'firstStage',
      'prototype',
      'test',
      'photo',
    ])
    // Vitrineando is not a stage; ideate is before prototype
    expect(
      derivedAchievements({
        space: space({ stage: 'browsing' }),
        stages: DEFAULT_STAGES,
        profile: { photoSource: 'google' },
      }),
    ).toEqual([])
    expect(
      derivedAchievements({
        space: space({ stage: 'ideate' }),
        stages: DEFAULT_STAGES,
        profile: null,
      }),
    ).toEqual(['firstStage'])
  })

  it('a teacher’s own stage list without "prototype" never unlocks it', () => {
    const stages = [
      { id: 'research', color: '#000', kind: 'stage' as const },
      { id: 'build', color: '#000', kind: 'stage' as const },
    ]
    expect(
      derivedAchievements({
        space: space({ stage: 'build' }),
        stages,
        profile: null,
      }),
    ).toEqual(['firstStage'])
  })

  it('missing ones, counts and shares', () => {
    const unlocked = { firstSlide: 1, ready: 1 }
    expect(missing(unlocked, ['ready', 'photo', 'firstSlide'])).toEqual([
      'photo',
    ])
    expect(unlockedCount(unlocked)).toBe(2)
    expect(share(12, 18)).toEqual({ count: 12, total: 18, percent: 67 })
    expect(share(20, 18).count).toBe(18)
    expect(share(-1, 18).count).toBe(0)
    expect(share(undefined, 0)).toEqual({ count: 0, total: 0, percent: 0 })
  })

  it('"Constante": the classes I wrote notes in', () => {
    expect(withClass(undefined, 'c1')).toEqual(['c1'])
    expect(withClass(['c1'], 'c1')).toBeNull()
    expect(withClass(['c1', 'c2'], 'c3')).toEqual(['c1', 'c2', 'c3'])
  })
})
