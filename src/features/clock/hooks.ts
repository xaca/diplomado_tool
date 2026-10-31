import { useEffect, useState } from 'react'
import { clockStatus, remainingMs } from '@/features/clock/clock'
import type { ClassClock } from '@/model'

/** The clock as seen now, re-evaluated 4 times a second while it runs. */
export function useClockNow(clock: ClassClock | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  const running = !!clock && !clock.paused
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [running])
  if (!clock) return null
  // A paused clock doesn't depend on the time; a running one ticks `now` (≤ 250 ms stale)
  return {
    remaining: remainingMs(clock, now),
    status: clockStatus(clock, now),
    progress: clock.durationMs
      ? 1 - remainingMs(clock, now) / clock.durationMs
      : 1,
  }
}
