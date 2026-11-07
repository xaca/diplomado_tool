import { createContext, useContext, useEffect } from 'react'
import { useBlocker } from 'react-router'

/** A comment box with text that may be unsaved */
export type GuardEntry = {
  dirty: () => boolean
  /** Saves it; resolves true once the server confirmed */
  save: () => Promise<boolean>
  /** Throws the text away (and its draft) */
  discard: () => void
  /** "en la diapositiva 3 de Laura Nataly" */
  where: () => string
}

export type Guard = {
  register: (id: string, entry: GuardEntry) => () => void
  hasDirty: () => boolean
  /** Resolves true when it's fine to move on (nothing unsaved, saved, or discarded) */
  confirm: () => Promise<boolean>
  /** Runs `move` right away when nothing is unsaved; otherwise asks first */
  run: (move: () => void) => void
}

const noGuard: Guard = {
  register: () => () => undefined,
  hasDirty: () => false,
  confirm: () => Promise.resolve(true),
  run: (move) => move(),
}

export const GuardContext = createContext<Guard>(noGuard)

export function useUnsavedGuard() {
  return useContext(GuardContext)
}

/**
 * Asks before leaving the page (a link, the back button) with an unsaved comment. Moves inside the
 * same page (the presenter changing student) are asked by the page itself before they navigate.
 */
export function useGuardLeavingPage() {
  const guard = useUnsavedGuard()
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && guard.hasDirty(),
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    let live = true
    void guard.confirm().then((ok) => {
      if (!live) return
      if (ok) blocker.proceed()
      else blocker.reset()
    })
    return () => {
      live = false
    }
  }, [blocker, guard])
}
