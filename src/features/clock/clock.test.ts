import { describe, expect, it } from 'vitest'
import {
  addMinute,
  clockProgress,
  clockStatus,
  formatClock,
  nextAnimation,
  pauseClock,
  remainingMs,
  startClock,
} from '@/features/clock/clock'
import { countsAfterVote, results } from '@/features/polls/tally'
import type { ClassClock } from '@/model'

const at = (ms: number) => ({ toDate: () => new Date(ms) })
const clock = (overrides: Partial<ClassClock> = {}): ClassClock => ({
  mode: 'activity',
  label: 'Lluvia de ideas',
  instructions: '',
  durationMs: 10 * 60_000,
  startedAt: at(0),
  elapsedBeforeMs: 0,
  paused: false,
  ...overrides,
})

describe('class clock (M16)', () => {
  it('counts down from the shared start', () => {
    expect(remainingMs(clock(), 60_000)).toBe(9 * 60_000)
    expect(remainingMs(clock(), 11 * 60_000)).toBe(0)
    expect(clockProgress(clock(), 5 * 60_000)).toBe(0.5)
  })

  it('pauses keeping what ran, and resumes from there', () => {
    const paused = { ...clock(), ...pauseClock(clock(), 4 * 60_000) }
    expect(paused.elapsedBeforeMs).toBe(4 * 60_000)
    // time passes while paused: nothing changes
    expect(remainingMs(paused, 30 * 60_000)).toBe(6 * 60_000)
    expect(clockStatus(paused, 30 * 60_000)).toBe('paused')
    // resumed at 40 min (a new run from then)
    const resumed = { ...paused, paused: false, startedAt: at(40 * 60_000) }
    expect(remainingMs(resumed, 41 * 60_000)).toBe(5 * 60_000)
  })

  it('goes amber in the last minute and ends at zero', () => {
    expect(clockStatus(clock(), 8 * 60_000)).toBe('running')
    expect(clockStatus(clock(), 9.5 * 60_000)).toBe('ending')
    expect(clockStatus(clock(), 10 * 60_000)).toBe('ended')
  })

  it('+1 min extends a running clock, and restarts an ended one with one minute', () => {
    expect(addMinute(clock(), 60_000)).toEqual({ durationMs: 11 * 60_000 })
    const ended = addMinute(clock(), 12 * 60_000)
    expect(ended).toMatchObject({ restart: true, paused: false })
  })

  it('starts with whole minutes, capped at 3 h', () => {
    expect(
      startClock({
        mode: 'break',
        label: ' Descanso ',
        instructions: '',
        minutes: 5,
      }),
    ).toEqual({
      mode: 'break',
      label: 'Descanso',
      instructions: '',
      durationMs: 300_000,
      elapsedBeforeMs: 0,
      paused: false,
    })
    expect(
      startClock({
        mode: 'activity',
        label: '',
        instructions: '',
        minutes: 999,
      }).durationMs,
    ).toBe(3 * 3600_000)
  })

  it('formats minutes and hours', () => {
    expect(formatClock(425_000)).toBe('7:05')
    expect(formatClock(59_001)).toBe('1:00')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(3_720_000)).toBe('1:02:00')
  })

  it('shows every break animation once before repeating, never twice in a row', () => {
    let shown: number[] = []
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      const next = nextAnimation(4, shown)
      seen.push(next.index)
      shown = next.shown
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
    const again = nextAnimation(4, shown)
    expect(again.index).not.toBe(seen.at(-1))
    expect(nextAnimation(0, [])).toEqual({ index: -1, shown: [] })
  })
})

describe('poll tally (M16)', () => {
  it('a vote adds one; changing it moves one; the same vote changes nothing', () => {
    expect(countsAfterVote({}, null, 'a')).toEqual({ a: 1 })
    expect(countsAfterVote({ a: 2, b: 1 }, 'a', 'b')).toEqual({ a: 1, b: 2 })
    const same = { a: 1 }
    expect(countsAfterVote(same, 'a', 'a')).toBe(same)
  })

  it('results with percentages', () => {
    expect(
      results({
        options: [
          { id: 'a', label: 'Idea 1' },
          { id: 'b', label: 'Idea 2' },
          { id: 'c', label: 'Idea 3' },
        ],
        counts: { a: 3, b: 1 },
      }),
    ).toEqual({
      total: 4,
      options: [
        { id: 'a', label: 'Idea 1', votes: 3, percent: 75 },
        { id: 'b', label: 'Idea 2', votes: 1, percent: 25 },
        { id: 'c', label: 'Idea 3', votes: 0, percent: 0 },
      ],
    })
  })
})
