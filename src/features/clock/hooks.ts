import { useEffect, useRef, useState } from 'react'
import { stopClassClock } from '@/features/clock/api'
import { clockClosed, clockStatus, remainingMs } from '@/features/clock/clock'
import type { ClassClock } from '@/model'

/** The clock as seen now, re-evaluated 4 times a second while it runs (until it closes). */
export function useClockNow(clock: ClassClock | null | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!clock || clock.paused) return
    const timer = setInterval(() => {
      const at = Date.now()
      setNow(at)
      if (clockClosed(clock, at)) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  }, [clock])
  if (!clock) return null
  // A paused clock doesn't depend on the time; a running one ticks `now` (≤ 250 ms stale)
  return {
    remaining: remainingMs(clock, now),
    status: clockStatus(clock, now),
    closed: clockClosed(clock, now),
    progress: clock.durationMs
      ? 1 - remainingMs(clock, now) / clock.durationMs
      : 1,
  }
}

/** The board's teacher clears a closed clock (once per device; repeats are harmless). */
export function useCloseEndedClock(
  boardId: string | undefined,
  closed: boolean,
  teacher: boolean,
) {
  const sent = useRef(false)
  useEffect(() => {
    if (!closed) {
      sent.current = false
      return
    }
    if (!teacher || !boardId || sent.current) return
    sent.current = true
    stopClassClock(boardId).catch(() => {
      sent.current = false
    })
  }, [boardId, closed, teacher])
}
