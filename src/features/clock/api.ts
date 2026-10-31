import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { addMinute, pauseClock, startClock } from '@/features/clock/clock'
import { db } from '@/lib/firebase'
import { clockInputSchema, paths, type ClassClock } from '@/model'

// The class clock lives on the board document (M16, D48): every page already listens to it.

const boardRef = (boardId: string) => doc(db, paths.board(boardId))

export function startClassClock(
  boardId: string,
  input: {
    mode: ClassClock['mode']
    label: string
    instructions: string
    minutes: number
  },
) {
  return updateDoc(boardRef(boardId), {
    clock: {
      ...startClock(clockInputSchema.parse(input)),
      startedAt: serverTimestamp(),
    },
  })
}

export function pauseClassClock(boardId: string, clock: ClassClock) {
  const { elapsedBeforeMs, paused } = pauseClock(clock)
  return updateDoc(boardRef(boardId), {
    'clock.elapsedBeforeMs': Math.round(elapsedBeforeMs),
    'clock.paused': paused,
  })
}

export function resumeClassClock(boardId: string) {
  return updateDoc(boardRef(boardId), {
    'clock.paused': false,
    'clock.startedAt': serverTimestamp(),
  })
}

export function addClassMinute(boardId: string, clock: ClassClock) {
  const change = addMinute(clock)
  return updateDoc(
    boardRef(boardId),
    'restart' in change
      ? {
          'clock.durationMs': change.durationMs,
          'clock.paused': false,
          'clock.startedAt': serverTimestamp(),
        }
      : { 'clock.durationMs': change.durationMs },
  )
}

export function stopClassClock(boardId: string) {
  return updateDoc(boardRef(boardId), { clock: null })
}
