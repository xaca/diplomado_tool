import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAutosave,
  type SaveStatus,
} from '@/features/slides/engine/autosave'

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const save = vi.fn(async () => {})
    const statuses: SaveStatus[] = []
    const autosave = createAutosave({
      save,
      onStatus: (status) => statuses.push(status),
      now: () => Date.now(),
    })
    return { save, statuses, autosave }
  }

  it('saves once after 3 s without changes', async () => {
    const { save, autosave } = setup()
    autosave.change()
    await vi.advanceTimersByTimeAsync(2_000)
    autosave.change()
    await vi.advanceTimersByTimeAsync(2_999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves at most once every 15 s while the student keeps drawing', async () => {
    const { save, autosave } = setup()
    autosave.change()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(save).toHaveBeenCalledTimes(1)
    autosave.change()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(save).toHaveBeenCalledTimes(1) // only 3 s since the last save
    await vi.advanceTimersByTimeAsync(11_999)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(2) // 15 s after the first save
  })

  it('flush saves immediately, and does nothing when there are no changes', async () => {
    const { save, autosave, statuses } = setup()
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
    autosave.change()
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
    expect(statuses).toEqual(['dirty', 'saving', 'saved'])
    await vi.advanceTimersByTimeAsync(20_000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('changes made during a save are saved afterwards', async () => {
    let finish!: () => void
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const autosave = createAutosave({ save })
    autosave.change()
    const first = autosave.flush()
    autosave.change() // while saving
    const second = autosave.flush() // waits for the first, then saves again
    finish()
    await first
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    finish()
    await second
    expect(autosave.dirty).toBe(false)
  })

  it('a failed save keeps the changes and retries', async () => {
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const statuses: SaveStatus[] = []
    const autosave = createAutosave({ save, onStatus: (s) => statuses.push(s) })
    autosave.change()
    await autosave.flush()
    expect(statuses.at(-1)).toBe('error')
    expect(autosave.dirty).toBe(true)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(statuses.at(-1)).toBe('saved')
  })
})
