import { describe, expect, it } from 'vitest'
import { createSaveLock } from '@/lib/save-lock'

describe('createSaveLock (M27, D131)', () => {
  it('runs one save at a time: a second click while saving is ignored', async () => {
    const lock = createSaveLock()
    let calls = 0
    let finish = () => {}
    const slow = () =>
      new Promise<number>((resolve) => {
        calls++
        finish = () => resolve(calls)
      })
    const first = lock.run(slow)
    const second = await lock.run(slow)
    expect(second).toEqual({ status: 'busy' })
    expect(lock.locked).toBe(true)
    finish()
    expect(await first).toEqual({ status: 'done', value: 1 })
    expect(calls).toBe(1)
    expect(lock.locked).toBe(false)
  })

  it('unlocks after an error and passes it on', async () => {
    const lock = createSaveLock()
    await expect(
      lock.run(() => Promise.reject(new Error('offline'))),
    ).rejects.toThrow('offline')
    expect(lock.locked).toBe(false)
    expect(await lock.run(() => Promise.resolve('ok'))).toEqual({
      status: 'done',
      value: 'ok',
    })
  })
})
