import { describe, expect, it } from 'vitest'
import {
  canReloadForNewVersion,
  isChunkLoadError,
  reloadForNewVersion,
} from '@/lib/stale-build'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

describe('isChunkLoadError', () => {
  it('recognizes a missing code file in every browser', () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://x/assets/EditorPage-BtqGOzsS.js',
      'error loading dynamically imported module: https://x/assets/a.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/a.css',
    ])
      expect(isChunkLoadError(new TypeError(message))).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isChunkLoadError(new Error('permission-denied'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('reloadForNewVersion', () => {
  it('reloads once, not again within 10 s, and again later', () => {
    const storage = memoryStorage()
    let reloads = 0
    let time = 1_000_000
    const deps = { storage, reload: () => reloads++, now: () => time }

    expect(reloadForNewVersion(deps)).toBe(true)
    time += 5_000
    expect(canReloadForNewVersion(deps)).toBe(false)
    expect(reloadForNewVersion(deps)).toBe(false)
    time += 10_000
    expect(reloadForNewVersion(deps)).toBe(true)
    expect(reloads).toBe(2)
  })

  it('never reloads when the tab cannot remember it (no reload loop)', () => {
    let reloads = 0
    const reload = () => reloads++
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(reloadForNewVersion({ storage: broken, reload })).toBe(false)
    expect(reloadForNewVersion({ storage: null, reload })).toBe(false)
    expect(reloads).toBe(0)
  })
})
