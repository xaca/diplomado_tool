import { describe, expect, it } from 'vitest'
import { insertAt, orderSlides } from '@/features/slides/api'

describe('slide order', () => {
  it('follows the space order and skips slides not loaded yet', () => {
    const slides = [{ id: 'b' }, { id: 'a' }, { id: 'x' }]
    expect(orderSlides(['a', 'b', 'c'], slides).map((s) => s.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('inserts a new slide at a position (clamped)', () => {
    expect(insertAt(['a', 'b'], 1, 'n')).toEqual(['a', 'n', 'b'])
    expect(insertAt(['a', 'b'], 99, 'n')).toEqual(['a', 'b', 'n'])
    expect(insertAt([], 0, 'n')).toEqual(['n'])
  })
})
