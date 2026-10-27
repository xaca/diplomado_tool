// Autosave scheduler (PLAN.md → Slides → Autosave; review finding R1).
// Saves after `idleMs` without changes, at most once every `minIntervalMs`,
// and immediately on flush() (slide switch, tab hidden, leaving the editor).
// Pure: timers and clock are injected, so it is unit-tested with fake timers.

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

type Options = {
  save: () => Promise<void>
  onStatus?: (status: SaveStatus, error?: unknown) => void
  idleMs?: number
  minIntervalMs?: number
  now?: () => number
}

export function createAutosave({
  save,
  onStatus,
  idleMs = 3_000,
  minIntervalMs = 15_000,
  now = Date.now,
}: Options) {
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | undefined
  let lastSavedAt = -Infinity
  let disposed = false

  const setStatus = (status: SaveStatus, error?: unknown) => {
    if (!disposed) onStatus?.(status, error)
  }

  function schedule() {
    clearTimeout(timer)
    const wait = Math.max(idleMs, lastSavedAt + minIntervalMs - now())
    timer = setTimeout(() => void run(), wait)
  }

  async function run(): Promise<void> {
    clearTimeout(timer)
    if (running) {
      // a save is in flight: run again right after it, if still dirty
      await running
      if (dirty) return run()
      return
    }
    if (!dirty) return
    dirty = false
    setStatus('saving')
    running = save()
    try {
      await running
      lastSavedAt = now()
      setStatus(dirty ? 'dirty' : 'saved')
    } catch (error) {
      dirty = true
      setStatus('error', error)
    } finally {
      running = undefined
    }
    if (dirty && !disposed) schedule()
  }

  return {
    /** Call on every real scene change. */
    change() {
      dirty = true
      setStatus('dirty')
      schedule()
    },
    /** Save now if there are pending changes (and wait for any save in flight). */
    flush() {
      return run()
    },
    get dirty() {
      return dirty || running !== undefined
    },
    dispose() {
      disposed = true
      clearTimeout(timer)
    },
  }
}
