import { describe, expect, it } from 'vitest'
import { sortSpaces, versionToKeep } from '@/features/spaces/api'

const at = (iso: string) => ({ toDate: () => new Date(iso) })

const spaces = [
  { id: 'c', ownerName: 'Carolina', createdAt: at('2026-10-03') },
  { id: 'a', ownerName: 'Ana', createdAt: at('2026-10-01') },
  { id: 'b', ownerName: 'Bruno', createdAt: at('2026-10-02') },
]

describe('sortSpaces', () => {
  it('orders by join date', () => {
    expect(sortSpaces(spaces, null).map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts my own card first', () => {
    expect(sortSpaces(spaces, 'c').map((s) => s.id)).toEqual(['c', 'a', 'b'])
  })

  it('ties break by name', () => {
    const same = [
      { id: 'z', ownerName: 'Zoe', createdAt: at('2026-10-01') },
      { id: 'm', ownerName: 'Mario', createdAt: at('2026-10-01') },
    ]
    expect(sortSpaces(same, null).map((s) => s.id)).toEqual(['m', 'z'])
  })

  it('does not mutate the input', () => {
    const copy = [...spaces]
    sortSpaces(spaces, 'b')
    expect(spaces).toEqual(copy)
  })
})

describe('versionToKeep (M27, D129)', () => {
  const space = {
    studentId: 'st1',
    ownerName: 'Laura',
    ownerPhotoURL: null,
    title: 'Huerta',
    summary: 'Mi idea',
    color: '#FFFFFF',
    cover: null,
    slideOrder: [],
    slideCount: 0,
    createdAt: null,
    updatedAt: null,
  }

  it("the first change by the teacher keeps the student's details", () => {
    expect(versionToKeep(space)).toEqual({
      title: 'Huerta',
      summary: 'Mi idea',
      color: '#FFFFFF',
      cover: null,
      by: 'student',
    })
  })

  it("later changes keep the student's original, not the teacher's earlier one", () => {
    const original = { ...versionToKeep(space) }
    const edited = {
      ...space,
      title: 'Huerta del profe',
      previousVersion: original,
    }
    expect(versionToKeep(edited)).toBe(original)
  })

  it('after the student restored theirs, the current details are the student’s again', () => {
    const restored = {
      ...space,
      previousVersion: {
        ...versionToKeep(space),
        title: 'Del profe',
        by: 'teacher' as const,
      },
    }
    expect(versionToKeep(restored).title).toBe('Huerta')
  })
})
