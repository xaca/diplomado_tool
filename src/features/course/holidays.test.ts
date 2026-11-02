import { describe, expect, it } from 'vitest'
import { colombia, normalizeHolidays } from '@/features/course/holidays'

describe('holidays', () => {
  it('keeps public holidays in range, one per date, with the corrections applied', () => {
    expect(
      normalizeHolidays(
        [
          {
            date: '2026-05-18 00:00:00',
            name: 'La Asunción',
            type: 'public',
            rule: 'easter 43',
          },
          {
            date: '2026-04-05 00:00:00',
            name: 'Pascua',
            type: 'public',
            rule: 'easter',
          },
          {
            date: '2026-05-01 00:00:00',
            name: 'Día del Trabajador',
            type: 'public',
            rule: '05-01',
          },
          {
            date: '2026-05-10 00:00:00',
            name: 'Día de la Madre',
            type: 'observance',
            rule: '2nd sunday in May',
          },
          {
            date: '2026-07-20 00:00:00',
            name: 'Independencia',
            type: 'public',
            rule: '07-20',
          },
        ],
        '2026-04-01',
        '2026-06-30',
        { easter: null, 'easter 43': 'Ascensión del Señor' },
      ),
    ).toEqual([
      { date: '2026-05-01', name: 'Día del Trabajador' },
      { date: '2026-05-18', name: 'Ascensión del Señor' },
    ])
  })

  it('Colombia: Ley Emiliani and the Chiquinquirá holiday (Ley 2578 de 2026), across years', async () => {
    const july = await colombia.load('2026-07-01', '2026-07-31')
    expect(july.map((day) => day.date)).toEqual(['2026-07-13', '2026-07-20'])
    const span = await colombia.load('2026-12-01', '2027-01-31')
    expect(span.map((day) => day.date)).toEqual([
      '2026-12-08',
      '2026-12-25',
      '2027-01-01',
      '2027-01-11',
    ])
    const easter = await colombia.load('2026-03-30', '2026-05-31')
    expect(easter.map((day) => day.name)).not.toContain('Pascua')
    expect(easter.find((day) => day.date === '2026-05-18')?.name).toBe(
      'Ascensión del Señor',
    )
  })
})
