import { describe, expect, it } from 'vitest'
import {
  clampPosition,
  freeSpot,
  listOrder,
  NOTE_H,
  NOTE_W,
  nextNoteId,
  nudge,
  reactionCounts,
  tidy,
  TITLE_BAND,
  toggleReaction,
  totalReactions,
  visibleSlide,
  zoneAt,
  zonesOf,
} from '@/features/classes/wall'

describe('geometry', () => {
  it('zones per layout', () => {
    expect(zonesOf('free')).toHaveLength(1)
    expect(zonesOf('columns2')).toHaveLength(2)
    expect(zonesOf('columns3')).toHaveLength(3)
    expect(zonesOf('matrix')).toEqual([
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ])
  })

  it('notes stay inside the wall', () => {
    expect(clampPosition({ x: -1, y: 2 })).toEqual({ x: 0, y: 1 - NOTE_H })
    expect(clampPosition({ x: 0.99, y: 0 }).x).toBeCloseTo(1 - NOTE_W)
  })

  it('a note belongs to the zone under its center', () => {
    expect(zoneAt('columns2', { x: 0.1, y: 0.1 })).toBe(0)
    expect(zoneAt('columns2', { x: 0.6, y: 0.1 })).toBe(1)
    expect(zoneAt('matrix', { x: 0.6, y: 0.6 })).toBe(3)
    expect(zoneAt('free', { x: 0.8, y: 0.7 })).toBe(0)
  })
})

describe('placing notes', () => {
  it('"+ Nota" takes the first free slot of the zone, below the titles', () => {
    const first = freeSpot('columns2', [], 1)
    expect(first.x).toBeGreaterThanOrEqual(0.5)
    expect(first.y).toBeCloseTo(TITLE_BAND)
    const second = freeSpot('columns2', [first], 1)
    expect(second).not.toEqual(first)
    expect(zoneAt('columns2', second)).toBe(1)
  })

  it('a full wall still finds a spot, nudged off the others', () => {
    const crowded = Array.from({ length: 80 }, (_, i) => ({
      x: (i % 10) * 0.09,
      y: Math.floor(i / 10) * 0.1,
    }))
    const spot = freeSpot('free', crowded)
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.y).toBeLessThanOrEqual(1 - NOTE_H)
    expect(nudge({ x: 0, y: 0 }, [{ x: 0, y: 0 }])).toEqual({
      x: 0.02,
      y: 0.03,
    })
  })

  it('"Ordenar" lines up each zone, oldest first, and returns only what moves', () => {
    const notes = [
      { id: 'a', x: 0.3, y: 0.6 },
      { id: 'b', x: 0.05, y: 0.7 },
      { id: 'c', x: 0.8, y: 0.5 },
    ]
    const moves = tidy('columns2', notes)
    const a = moves.get('a')!
    const b = moves.get('b')!
    expect(a.y).toBeCloseTo(TITLE_BAND)
    expect(b.x).toBeGreaterThan(a.x)
    expect(zoneAt('columns2', moves.get('c')!)).toBe(1)
    // already tidy: nothing moves
    const tidied = notes.map((note) => ({ ...note, ...moves.get(note.id)! }))
    expect(tidy('columns2', tidied).size).toBe(0)
  })

  it('the list view goes zone by zone, top to bottom', () => {
    const notes = [
      { id: 'right', x: 0.6, y: 0.1 },
      { id: 'low', x: 0.1, y: 0.6 },
      { id: 'top', x: 0.1, y: 0.1 },
    ]
    expect(listOrder('columns2', notes).map((n) => n.id)).toEqual([
      'top',
      'low',
      'right',
    ])
  })
})

describe('reactions', () => {
  const reactions = {
    u1: { name: 'Laura', emojis: ['👍' as const, '💡' as const] },
    u2: { name: 'Elma', emojis: ['👍' as const] },
  }

  it('tapping adds or removes my emoji, in the fixed order', () => {
    expect(toggleReaction(reactions, 'u2', 'Elma', '❤️')).toEqual({
      name: 'Elma',
      emojis: ['👍', '❤️'],
    })
    expect(toggleReaction(reactions, 'u2', 'Elma', '👍')).toBeNull()
    expect(toggleReaction(undefined, 'u3', 'Seb', '🎉')).toEqual({
      name: 'Seb',
      emojis: ['🎉'],
    })
  })

  it('counts per emoji with names, and whether I reacted', () => {
    expect(reactionCounts(reactions, 'u2')).toEqual([
      { emoji: '👍', count: 2, names: ['Elma', 'Laura'], mine: true },
      { emoji: '💡', count: 1, names: ['Laura'], mine: false },
    ])
    expect(totalReactions(reactions)).toBe(3)
    expect(reactionCounts(undefined, 'u1')).toEqual([])
  })
})

describe('ids and following the teacher', () => {
  it('my next note id, up to 20', () => {
    expect(nextNoteId('u1', [])).toBe('u1_1')
    expect(nextNoteId('u1', ['u1_1', 'u1_3', 'u2_2'])).toBe('u1_2')
    expect(
      nextNoteId(
        'u1',
        Array.from({ length: 20 }, (_, i) => `u1_${i + 1}`),
      ),
    ).toBeNull()
  })

  it('students see the teacher’s slide while following, unless they stepped away from it', () => {
    const base = {
      order: ['s1', 's2', 's3'],
      chosen: 's1',
      follow: true,
      liveSlideId: 's2',
      leftLive: null,
    }
    expect(visibleSlide(base)).toBe('s2')
    expect(visibleSlide({ ...base, leftLive: 's2', chosen: 's3' })).toBe('s3')
    // the teacher moves on: following again
    expect(
      visibleSlide({
        ...base,
        leftLive: 's2',
        chosen: 's3',
        liveSlideId: 's1',
      }),
    ).toBe('s1')
    expect(visibleSlide({ ...base, follow: false })).toBe('s1')
    expect(visibleSlide({ ...base, chosen: 'gone', follow: false })).toBe('s1')
    expect(visibleSlide({ ...base, order: [] })).toBeNull()
  })
})
