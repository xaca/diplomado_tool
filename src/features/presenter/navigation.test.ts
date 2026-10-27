import { describe, expect, it } from 'vitest'
import {
  clampSlide,
  keyToMove,
  LAST,
  move,
} from '@/features/presenter/navigation'

const counts = { students: 3, slides: 4 }

describe('presenter navigation', () => {
  it('moves through the slides of a student', () => {
    expect(move({ student: 1, slide: 0 }, 'nextSlide', counts)).toEqual({
      student: 1,
      slide: 1,
    })
    expect(move({ student: 1, slide: 2 }, 'prevSlide', counts)).toEqual({
      student: 1,
      slide: 1,
    })
    expect(move({ student: 1, slide: 2 }, 'firstSlide', counts).slide).toBe(0)
    expect(move({ student: 1, slide: 0 }, 'lastSlide', counts).slide).toBe(LAST)
  })

  it('continues with the next / previous student at the edges', () => {
    expect(move({ student: 1, slide: 3 }, 'nextSlide', counts)).toEqual({
      student: 2,
      slide: 0,
    })
    // back from the first slide → last slide of the previous student
    expect(move({ student: 1, slide: 0 }, 'prevSlide', counts)).toEqual({
      student: 0,
      slide: LAST,
    })
    // LAST counts as the last slide when moving on
    expect(move({ student: 1, slide: LAST }, 'prevSlide', counts)).toEqual({
      student: 1,
      slide: 2,
    })
  })

  it('stays put at the very beginning and end', () => {
    expect(move({ student: 2, slide: 3 }, 'nextSlide', counts)).toEqual({
      student: 2,
      slide: 3,
    })
    expect(move({ student: 0, slide: 0 }, 'prevSlide', counts)).toEqual({
      student: 0,
      slide: 0,
    })
    expect(move({ student: 2, slide: 1 }, 'nextStudent', counts)).toEqual({
      student: 2,
      slide: 1,
    })
    expect(move({ student: 0, slide: 1 }, 'prevStudent', counts)).toEqual({
      student: 0,
      slide: 1,
    })
  })

  it('↑/↓ jump to the first slide of the other student', () => {
    expect(move({ student: 0, slide: 2 }, 'nextStudent', counts)).toEqual({
      student: 1,
      slide: 0,
    })
    expect(move({ student: 2, slide: 2 }, 'prevStudent', counts)).toEqual({
      student: 1,
      slide: 0,
    })
  })

  it('a student without slides can still be skipped', () => {
    const empty = { students: 2, slides: 0 }
    expect(move({ student: 0, slide: 0 }, 'nextSlide', empty)).toEqual({
      student: 1,
      slide: 0,
    })
    expect(clampSlide(LAST, 0)).toBe(0)
    expect(clampSlide(LAST, 5)).toBe(4)
  })

  it('maps keys and clickers', () => {
    expect(keyToMove('ArrowRight')).toBe('nextSlide')
    expect(keyToMove('PageDown')).toBe('nextSlide')
    expect(keyToMove(' ')).toBe('nextSlide')
    expect(keyToMove('PageUp')).toBe('prevSlide')
    expect(keyToMove('ArrowDown')).toBe('nextStudent')
    expect(keyToMove('ArrowUp')).toBe('prevStudent')
    expect(keyToMove('x')).toBeNull()
  })
})
