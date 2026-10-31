import { toDate } from '@/lib/time'
import { MAX_CLOCK_MS, type ClassClock } from '@/model'

// The class clock (M16, PLAN.md → M16). Pure, unit-tested: the remaining time is computed on each
// device from the shared state, so nobody writes every second.

export const ENDING_MS = 60_000
/** "¡Tiempo!" stays this long, then the clock closes (the teacher's device clears it) */
export const CLOSE_AFTER_MS = 15_000

export function remainingMs(
  clock: Pick<
    ClassClock,
    'durationMs' | 'elapsedBeforeMs' | 'paused' | 'startedAt'
  >,
  now = Date.now(),
) {
  const running = clock.paused
    ? 0
    : Math.max(0, now - toDate(clock.startedAt).getTime())
  return Math.max(0, clock.durationMs - clock.elapsedBeforeMs - running)
}

export type ClockStatus = 'running' | 'paused' | 'ending' | 'ended'

export function clockStatus(clock: ClassClock, now = Date.now()): ClockStatus {
  const left = remainingMs(clock, now)
  if (left === 0) return 'ended'
  if (clock.paused) return 'paused'
  return left <= ENDING_MS ? 'ending' : 'running'
}

/** Ended long enough ago to close: everyone hides it, the teacher's device clears it. */
export function clockClosed(clock: ClassClock, now = Date.now()) {
  if (clock.paused || remainingMs(clock, now) > 0) return false
  const endsAt =
    toDate(clock.startedAt).getTime() + clock.durationMs - clock.elapsedBeforeMs
  return now - endsAt >= CLOSE_AFTER_MS
}

/** 0 → 1 as time passes (progress ring). */
export function clockProgress(clock: ClassClock, now = Date.now()) {
  return clock.durationMs ? 1 - remainingMs(clock, now) / clock.durationMs : 1
}

/** "7:05", "1:02:00" */
export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

// ---------- changes (the API adds the server time where `startedAt` is null) ----------

export function startClock(input: {
  mode: ClassClock['mode']
  label: string
  instructions: string
  minutes: number
}) {
  return {
    mode: input.mode,
    label: input.label.trim(),
    instructions: input.instructions.trim(),
    durationMs: Math.min(MAX_CLOCK_MS, Math.round(input.minutes * 60_000)),
    elapsedBeforeMs: 0,
    paused: false,
  }
}

/** Pausing keeps what already ran; resuming starts a new run from now. */
export function pauseClock(clock: ClassClock, now = Date.now()) {
  return {
    elapsedBeforeMs: Math.min(
      clock.durationMs,
      clock.durationMs - remainingMs(clock, now),
    ),
    paused: true,
  }
}

export function addMinute(clock: ClassClock, now = Date.now()) {
  // An ended clock restarts with one minute left
  const ended = remainingMs(clock, now) === 0
  return ended
    ? {
        durationMs: Math.min(MAX_CLOCK_MS, clock.elapsedBeforeMs + 60_000),
        elapsedBeforeMs: clock.elapsedBeforeMs,
        paused: false,
        restart: true,
      }
    : { durationMs: Math.min(MAX_CLOCK_MS, clock.durationMs + 60_000) }
}

// ---------- break animations ----------

/** The next animation: random, without repeating until every one was shown (pure). */
export function nextAnimation(
  count: number,
  shown: readonly number[],
  random = Math.random,
) {
  if (count <= 0) return { index: -1, shown: [] as number[] }
  const left = [...Array(count).keys()].filter((i) => !shown.includes(i))
  const pool = left.length
    ? left
    : [...Array(count).keys()].filter((i) => i !== shown.at(-1))
  const index = pool[Math.floor(random() * pool.length)] ?? 0
  return { index, shown: left.length ? [...shown, index] : [index] }
}
