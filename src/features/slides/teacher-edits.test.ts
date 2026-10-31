import { describe, expect, it } from 'vitest'
import {
  editedByTeacher,
  lockState,
  needsStudentSnapshot,
  versionAssetIds,
} from '@/features/slides/teacher-edits'
import { LOCK_STALE_MS } from '@/model'

const at = (ms: number) => ({ toDate: () => new Date(ms) })
const lock = (uid: string, ms: number) => ({
  uid,
  name: 'x',
  role: 'teacher' as const,
  at: at(ms),
})

describe('teacher edits (M15)', () => {
  it("keeps the student's version once per session, never over a teacher version", () => {
    expect(needsStudentSnapshot({}, false)).toBe(true)
    expect(needsStudentSnapshot({ lastEditedBy: 'student' }, false)).toBe(true)
    expect(needsStudentSnapshot({ lastEditedBy: 'student' }, true)).toBe(false)
    // the student hasn't saved since the teacher's last edit: their kept version stays
    expect(needsStudentSnapshot({ lastEditedBy: 'teacher' }, false)).toBe(false)
  })

  it('marks slides last saved by the teacher', () => {
    expect(editedByTeacher({ lastEditedBy: 'teacher' })).toBe(true)
    expect(editedByTeacher({ lastEditedBy: 'student' })).toBe(false)
    expect(editedByTeacher({})).toBe(false)
  })

  it("keeps every version's images", () => {
    expect(
      versionAssetIds({ assetIds: ['a', 'b'] }, { assetIds: ['b', 'c'] }, null),
    ).toEqual(['a', 'b', 'c'])
  })

  it('one editor at a time; a lock without heartbeat expires', () => {
    const now = 1_000_000
    expect(lockState(null, 'me', now)).toBe('free')
    expect(lockState(lock('me', now - 5), 'me', now)).toBe('mine')
    expect(lockState(lock('laura', now - 5_000), 'me', now)).toBe('held')
    expect(lockState(lock('laura', now - LOCK_STALE_MS - 1), 'me', now)).toBe(
      'free',
    )
  })
})
