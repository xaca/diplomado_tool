import { describe, expect, it } from 'vitest'
import {
  formatElapsed,
  parsePresenterMessage,
  presenterChannelName,
} from '@/features/presenter/sync'

describe('presenter sync (M13)', () => {
  it('accepts only well-formed messages', () => {
    expect(parsePresenterMessage({ type: 'hello' })).toEqual({ type: 'hello' })
    expect(
      parsePresenterMessage({ type: 'goto', studentId: 'st_laura', slide: 2 }),
    ).toEqual({ type: 'goto', studentId: 'st_laura', slide: 2 })
    for (const bad of [
      null,
      'goto',
      { type: 'goto', studentId: '../x', slide: 1 },
      { type: 'goto', studentId: 'st', slide: -1 },
      { type: 'goto', studentId: 'st', slide: 1.5 },
      { type: 'goto', slide: 1 },
      { type: 'reload' },
    ])
      expect(parsePresenterMessage(bad)).toBeNull()
  })

  it('one channel per board', () => {
    expect(presenterChannelName('b1')).toBe('pbl-presenter-b1')
  })

  it('formats the console timer', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(65_400)).toBe('1:05')
    expect(formatElapsed(-5)).toBe('0:00')
  })
})
