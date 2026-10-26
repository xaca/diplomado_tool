import { describe, expect, it } from 'vitest'
import { sortSpaces } from '@/features/spaces/api'

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
