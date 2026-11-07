import { useCallback, useEffect, useRef, useState } from 'react'
import { createSaveLock, SLOW_SAVE_MS } from '@/lib/save-lock'

/** How long "Guardado ✓" stays on the button after a save */
const SAVED_FLASH_MS = 1_500

/**
 * M27 (D131): one lock per form or button. `run(save)` ignores clicks while a save is running
 * (synchronous guard), shows "Guardando…", "Sigue guardando…" after 8 s and "Guardado ✓" after.
 * Resolves to the save's value, or undefined when it was ignored; errors are passed on.
 */
export function useSaveLock(slowMs = SLOW_SAVE_MS) {
  const core = useRef<ReturnType<typeof createSaveLock> | null>(null)
  core.current ??= createSaveLock()
  const mounted = useRef(true)
  const [saving, setSaving] = useState(false)
  const [slow, setSlow] = useState(false)
  const [saved, setSaved] = useState(false)
  const flash = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(flash.current)
    }
  }, [])

  const run = useCallback(
    async <T>(save: () => Promise<T>): Promise<T | undefined> => {
      const lock = core.current
      if (!lock || lock.locked) return undefined
      setSaving(true)
      setSaved(false)
      const timer = setTimeout(() => mounted.current && setSlow(true), slowMs)
      let ok = false
      try {
        const result = await lock.run(save)
        ok = result.status === 'done'
        return result.status === 'done' ? result.value : undefined
      } finally {
        clearTimeout(timer)
        if (mounted.current) {
          setSaving(false)
          setSlow(false)
          if (ok) {
            setSaved(true)
            clearTimeout(flash.current)
            flash.current = setTimeout(
              () => mounted.current && setSaved(false),
              SAVED_FLASH_MS,
            )
          }
        }
      }
    },
    [slowMs],
  )

  /** True right now (not after the next render): use it to ignore a second click or Enter */
  const isLocked = useCallback(() => !!core.current?.locked, [])

  return { saving, slow, saved, run, isLocked }
}

export type SaveLock = ReturnType<typeof useSaveLock>
