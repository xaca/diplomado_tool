// M27 (D131): a save is locked from the first click until the server confirms. React state alone
// lets a fast double click (or a held Enter) through before the re-render, so the lock is a plain
// flag checked synchronously. Pure, unit-tested; `useSaveLock` wraps it for components.

/** After this long still saving, the button says "Sigue guardando… revisa tu conexión" */
export const SLOW_SAVE_MS = 8_000

export type LockedRun<T> = { status: 'done'; value: T } | { status: 'busy' }

export function createSaveLock() {
  let locked = false
  return {
    get locked() {
      return locked
    },
    /** Runs `save` unless another one is still running; errors are passed on, and unlock. */
    async run<T>(save: () => Promise<T>): Promise<LockedRun<T>> {
      if (locked) return { status: 'busy' }
      locked = true
      try {
        return { status: 'done', value: await save() }
      } finally {
        locked = false
      }
    },
  }
}

export type SaveLockCore = ReturnType<typeof createSaveLock>
