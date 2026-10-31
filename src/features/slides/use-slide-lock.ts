import { useEffect, useState } from 'react'
import { holdLock, lockRef, releaseLock } from '@/features/slides/api'
import { lockState } from '@/features/slides/teacher-edits'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { LOCK_HEARTBEAT_MS, type SlideLockDoc } from '@/model'

type Me = Pick<SlideLockDoc, 'uid' | 'name' | 'role'>

/**
 * One editor per slide (M15, D46): takes the slide's lock when it's free, renews it while
 * editing, releases it on leaving. Returns who holds it, so the other person gets a read-only view.
 */
export function useSlideLock(
  boardId: string,
  studentId: string,
  slideId: string | undefined,
  me: Me | null,
) {
  const lock = useLiveDoc<SlideLockDoc>(
    slideId ? lockRef(boardId, studentId, slideId) : null,
    `lock:${boardId}:${studentId}:${slideId}`,
  )
  // Re-evaluate every few seconds: a lock without heartbeat expires
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(timer)
  }, [])

  const state =
    !me || lock.loading ? 'loading' : lockState(lock.data, me.uid, now)

  // Free → take it (the rules refuse it if someone else got there first)
  useEffect(() => {
    if (state !== 'free' || !slideId || !me) return
    holdLock(boardId, studentId, slideId, me).catch(() => undefined)
  }, [state, boardId, studentId, slideId, me])

  // Mine → heartbeat while editing, release when leaving the slide
  const mine = state === 'mine'
  useEffect(() => {
    if (!mine || !slideId || !me) return
    const timer = setInterval(
      () =>
        void holdLock(boardId, studentId, slideId, me).catch(() => undefined),
      LOCK_HEARTBEAT_MS,
    )
    return () => {
      clearInterval(timer)
      void releaseLock(boardId, studentId, slideId).catch(() => undefined)
    }
  }, [mine, boardId, studentId, slideId, me])

  return {
    state,
    holder: state === 'held' ? (lock.data ?? null) : null,
  }
}
