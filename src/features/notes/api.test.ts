import { describe, expect, it } from 'vitest'
import { groupNotes } from '@/features/notes/api'

const at = (iso: string) => ({ toDate: () => new Date(iso) })

describe('groupNotes', () => {
  it('groups by slide, oldest first', () => {
    const grouped = groupNotes([
      { id: 'b', slideId: 's1', createdAt: at('2026-10-02') },
      { id: 'c', slideId: 's2', createdAt: at('2026-10-03') },
      { id: 'a', slideId: 's1', createdAt: at('2026-10-01') },
    ])
    expect(grouped.get('s1')?.map((n) => n.id)).toEqual(['a', 'b'])
    expect(grouped.get('s2')?.map((n) => n.id)).toEqual(['c'])
    expect(grouped.has('s3')).toBe(false)
  })

  it('a note still being written (pending server time) goes last', () => {
    const grouped = groupNotes([
      { id: 'new', slideId: 's1', createdAt: null },
      { id: 'old', slideId: 's1', createdAt: at('2026-10-01') },
    ])
    expect(grouped.get('s1')?.map((n) => n.id)).toEqual(['old', 'new'])
  })
})
