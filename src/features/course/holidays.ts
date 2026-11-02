import type { CourseHoliday, HolidayCountry } from '@/model'

// Public holidays for a course's dates (M24, D104), behind a small interface so another country
// is one entry. Colombia comes from date-holidays (Ley Emiliani, Ley 2578 de 2026), a large
// library (every country), so it's loaded only when the teacher presses "Cargar festivos".

export type HolidayProvider = {
  country: HolidayCountry
  load: (from: string, to: string) => Promise<CourseHoliday[]>
}

/** A holiday as date-holidays gives it */
export type RawHoliday = {
  date: string
  name: string
  type: string
  rule: string
}

/**
 * Corrections to the library's Colombian data: Easter Sunday isn't a day off, and the May Monday
 * holiday is the Ascensión (it's labelled "La Asunción", the August one).
 */
const COLOMBIA_FIXES: Record<string, string | null> = {
  easter: null,
  'easter 43': 'Ascensión del Señor',
}

/** Public holidays inside [from, to], corrected, one per date, in order */
export function normalizeHolidays(
  raw: readonly RawHoliday[],
  from: string,
  to: string,
  fixes: Record<string, string | null> = {},
): CourseHoliday[] {
  const found = new Map<string, string>()
  for (const holiday of raw) {
    if (holiday.type !== 'public') continue
    const fixed = holiday.rule in fixes ? fixes[holiday.rule] : holiday.name
    const date = holiday.date.slice(0, 10)
    if (fixed === null || date < from || date > to || found.has(date)) continue
    found.set(date, fixed.slice(0, 80))
  }
  return [...found]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function years(from: string, to: string) {
  const first = Number(from.slice(0, 4))
  const last = Number(to.slice(0, 4))
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

export const colombia: HolidayProvider = {
  country: 'CO',
  async load(from, to) {
    const { default: Holidays } = await import('date-holidays')
    const calendar = new Holidays('CO', { languages: ['es'] })
    const raw = years(from, to).flatMap(
      (year) => calendar.getHolidays(year, 'es') as RawHoliday[],
    )
    return normalizeHolidays(raw, from, to, COLOMBIA_FIXES)
  },
}

export const HOLIDAY_PROVIDERS: Record<HolidayCountry, HolidayProvider> = {
  CO: colombia,
}
