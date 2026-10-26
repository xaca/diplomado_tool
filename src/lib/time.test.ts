import { describe, expect, it } from 'vitest'
import { formatRelative, toDate } from '@/lib/time'

const now = new Date('2026-10-26T12:00:00Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

describe('formatRelative', () => {
  it('Spanish', () => {
    expect(formatRelative(ago(30), 'es', now)).toBe('hace un momento')
    expect(formatRelative(ago(5 * 60), 'es', now)).toBe('hace 5 minutos')
    expect(formatRelative(ago(3 * 24 * 3600), 'es', now)).toBe('hace 3 días')
    expect(formatRelative(ago(24 * 3600), 'es', now)).toBe('ayer')
    expect(formatRelative(ago(40 * 24 * 3600), 'es', now)).toBe('el mes pasado')
  })

  it('English', () => {
    expect(formatRelative(ago(10), 'en', now)).toBe('just now')
    expect(formatRelative(ago(2 * 3600), 'en', now)).toBe('2 hours ago')
    expect(formatRelative(ago(9 * 24 * 3600), 'en', now)).toBe('last week')
  })
})

describe('toDate', () => {
  it('reads Firestore timestamps and treats pending ones as now', () => {
    const date = new Date('2026-01-01T00:00:00Z')
    expect(toDate({ toDate: () => date })).toBe(date)
    expect(toDate(null)).toBeInstanceOf(Date)
  })
})
