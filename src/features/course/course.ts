import {
  addDays,
  differenceInCalendarDays,
  format,
  getISODay,
  parseISO,
  startOfISOWeek,
} from 'date-fns'
import {
  MAX_COURSE_DAYS,
  MAX_COURSE_WEEKS,
  type CourseHoliday,
  type CourseSetup,
  type DayOff,
  type Weekday,
} from '@/model'

// The course's dates (M24, F33, D109–D112): pure, unit-tested, reused by every page. The single
// source is classDates(): every class of the course with its time and place; the total, classes
// given, next class, class number and weeks are all read from it. "Today" is always passed in.

/** A day as stored: YYYY-MM-DD (local, no time zone) */
export const toKey = (date: Date) => format(date, 'yyyy-MM-dd')
export const fromKey = (key: string) => parseISO(key)
export const addDaysKey = (key: string, days: number) =>
  toKey(addDays(fromKey(key), days))
export const daysBetween = (from: string, to: string) =>
  differenceInCalendarDays(fromKey(to), fromKey(from))
export const weekdayOf = (key: string) => getISODay(fromKey(key)) as Weekday

/** Now, as the course module reads it: the local day and time (HH:MM) */
export type Moment = { date: string; time: string }
export function momentOf(now = new Date()): Moment {
  return { date: toKey(now), time: format(now, 'HH:mm') }
}

export type ClassDate = {
  date: string
  start: string
  end: string
  place: string
  /** Added on that date (an extra class, or where a class was moved to) */
  extra: boolean
  note: string
}

/** How far "next class" looks when the course has no end */
const OPEN_HORIZON = 366

/** The last day of the course: the end date, or the Sunday of week N */
export function courseEnd(setup: CourseSetup): string | null {
  if (setup.end) return setup.end
  if (setup.start && setup.weeks)
    return toKey(
      addDays(startOfISOWeek(fromKey(setup.start)), setup.weeks * 7 - 1),
    )
  return null
}

/** A start date and at least one weekday: the class dates can be worked out */
export const hasDates = (setup: CourseSetup) =>
  !!setup.start && setup.schedule.length > 0

/** Days without class: holidays and the teacher's days off */
export function daysWithoutClass(setup: CourseSetup) {
  return new Map<string, string>([
    ...setup.holidays.map((day): [string, string] => [day.date, day.name]),
    ...setup.daysOff.map((day): [string, string] => [day.date, day.reason]),
  ])
}

/**
 * Every class of the course, in order: the schedule's weekdays from the start to the end (or a
 * year ahead without an end), minus holidays and days off, plus the one-off classes. `until`
 * stops early (e.g. "classes up to today").
 */
export function classDates(
  setup: CourseSetup,
  { until }: { until?: string } = {},
): ClassDate[] {
  const end = courseEnd(setup)
  const last =
    end ?? (setup.start ? addDaysKey(setup.start, OPEN_HORIZON) : null)
  const limit = until && last ? (until < last ? until : last) : (until ?? last)
  const off = daysWithoutClass(setup)
  const slots = new Map(setup.schedule.map((slot) => [slot.day, slot]))
  const found = new Map<string, ClassDate>()

  if (setup.start && last && slots.size) {
    const span = Math.min(daysBetween(setup.start, last), MAX_COURSE_DAYS)
    const first = fromKey(setup.start)
    for (let offset = 0; offset <= span; offset++) {
      const day = addDays(first, offset)
      const date = toKey(day)
      if (limit && date > limit) break
      const slot = slots.get(getISODay(day) as Weekday)
      if (!slot || off.has(date)) continue
      found.set(date, {
        date,
        start: slot.start,
        end: slot.end,
        place: slot.place,
        extra: false,
        note: '',
      })
    }
  }
  // One-off classes win over the schedule on their date (and over a holiday: the teacher added it)
  for (const extra of setup.extras)
    if (!limit || extra.date <= limit)
      found.set(extra.date, { ...extra, extra: true })

  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** The class on a date, if there is one */
export function classOn(setup: CourseSetup, date: string) {
  return classDates(setup, { until: date }).find((day) => day.date === date)
}

/** "Clase 13" on a date (attendance), or null when it isn't a class day */
export function classNumberOn(setup: CourseSetup, date: string) {
  const dates = classDates(setup, { until: date })
  return dates.at(-1)?.date === date ? dates.length : null
}

/**
 * How many classes the course has: from the dates when they give one (start, end and schedule),
 * else the total the teacher typed; null = no counter.
 */
export function totalClasses(setup: CourseSetup): number | null {
  if (hasDates(setup) && courseEnd(setup)) return classDates(setup).length
  return setup.total
}

/** "32 clases · la primera …, la última …" while the teacher fills in the form */
export function datesSummary(setup: CourseSetup) {
  if (!hasDates(setup) || !courseEnd(setup)) return null
  const dates = classDates(setup)
  return {
    total: dates.length,
    first: dates[0]?.date ?? null,
    last: dates.at(-1)?.date ?? null,
  }
}

/** The distinct days a class was given (attendance taken or a Clase), up to today */
export function heldDates(dates: readonly string[], today: string): string[] {
  return [...new Set(dates.filter((date) => date <= today))].sort()
}

/**
 * Classes given so far (D109), today's class included: with dates, the class days up to today;
 * without them, the days a class was given (`held`, or the count the teacher's browser saved).
 * Plus the teacher's correction, kept between 0 and the total.
 */
export function classesGiven(
  setup: CourseSetup,
  today: string,
  held?: readonly string[],
): number {
  const base = hasDates(setup)
    ? classDates(setup, { until: today }).length
    : held
      ? heldDates(held, today).length
      : (setup.held ?? 0)
  const given = Math.max(0, base + setup.correction)
  const total = totalClasses(setup)
  return total === null ? given : Math.min(given, total)
}

/** The next class from now: today's while it hasn't ended, else the next class day */
export function nextClass(setup: CourseSetup, now: Moment): ClassDate | null {
  if (!hasDates(setup) && setup.extras.length === 0) return null
  return (
    classDates(setup).find(
      (day) =>
        day.date > now.date ||
        (day.date === now.date && (day.end || day.start || '23:59') > now.time),
    ) ?? null
  )
}

export type CourseWeek = {
  number: number
  /** Monday … Sunday */
  start: string
  end: string
  classes: ClassDate[]
  holidays: CourseHoliday[]
  daysOff: DayOff[]
  topic: string
}

/** Semana 1 … N (D103): weeks start on Monday; week 1 is the week of the start date */
export function courseWeeks(setup: CourseSetup): CourseWeek[] {
  const end = courseEnd(setup)
  if (!setup.start || !end || end < setup.start) return []
  const first = startOfISOWeek(fromKey(setup.start))
  const count = Math.min(
    Math.floor(
      differenceInCalendarDays(startOfISOWeek(fromKey(end)), first) / 7,
    ) + 1,
    MAX_COURSE_WEEKS,
  )
  const dates = classDates(setup)
  const inside = (date: string, from: string, to: string) =>
    date >= from && date <= to
  return Array.from({ length: count }, (_, index) => {
    const start = toKey(addDays(first, index * 7))
    const last = toKey(addDays(first, index * 7 + 6))
    return {
      number: index + 1,
      start,
      end: last,
      classes: dates.filter((day) => inside(day.date, start, last)),
      holidays: setup.holidays.filter((day) => inside(day.date, start, last)),
      daysOff: setup.daysOff.filter((day) => inside(day.date, start, last)),
      topic: setup.topics[String(index + 1)] ?? '',
    }
  })
}

/** The week a date falls in (1 … N), or null outside the course */
export function weekOf(setup: CourseSetup, date: string): number | null {
  const end = courseEnd(setup)
  if (!setup.start || !end) return null
  const first = startOfISOWeek(fromKey(setup.start))
  const lastDay = addDays(startOfISOWeek(fromKey(end)), 6)
  const day = fromKey(date)
  if (day < first || day > lastDay) return null
  const week = Math.floor(differenceInCalendarDays(day, first) / 7) + 1
  return week <= MAX_COURSE_WEEKS ? week : null
}

/**
 * The week a summary covers: the course week of `today` (Monday … Sunday), or the next one once
 * this week has no classes left (a summary sent on the weekend is about the coming week); week 1
 * before the course starts; the next 7 days for a course without weeks
 */
export function summaryWindow(setup: CourseSetup | null, today: string) {
  const weeks = setup ? courseWeeks(setup) : []
  const index = weeks.findIndex(
    (item) => today >= item.start && today <= item.end,
  )
  const current = weeks[index]
  const week =
    current &&
    !current.classes.some((day) => day.date >= today) &&
    weeks[index + 1]
      ? weeks[index + 1]
      : (current ?? (weeks[0] && today < weeks[0].start ? weeks[0] : undefined))
  return week
    ? { from: week.start, to: week.end, week: week.number, topic: week.topic }
    : { from: today, to: addDaysKey(today, 6), week: null, topic: '' }
}

/** "Resumen de la semana": its classes, days without class and news (any item with a date) */
export function weekSummary<News extends { date: string }>(
  setup: CourseSetup | null,
  news: readonly News[],
  today: string,
) {
  const window = summaryWindow(setup, today)
  const inside = (date: string) => date >= window.from && date <= window.to
  const all = setup ? classDates(setup, { until: window.to }) : []
  return {
    ...window,
    classes: all
      .map((day, index) => ({ ...day, number: index + 1 }))
      .filter((day) => inside(day.date)),
    off: setup
      ? [...daysWithoutClass(setup)]
          .filter(([date]) => inside(date))
          .map(([date, label]) => ({ date, label }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [],
    news: news.filter((item) => inside(item.date)),
  }
}

export type CoursePhase = 'none' | 'before' | 'running' | 'last' | 'finished'

/** Everything a page shows about the course right now ("Clase 12 de 32 · quedan 20") */
export type CourseState = {
  /** Anything to show: a total, a schedule or one-off classes */
  configured: boolean
  total: number | null
  given: number
  remaining: number | null
  /** Today's class, if today is a class day */
  today: ClassDate | null
  next: ClassDate | null
  week: number | null
  weeks: number | null
  phase: CoursePhase
}

export function courseState(
  setup: CourseSetup | null | undefined,
  now: Moment,
  held?: readonly string[],
): CourseState {
  if (!setup)
    return {
      configured: false,
      total: null,
      given: 0,
      remaining: null,
      today: null,
      next: null,
      week: null,
      weeks: null,
      phase: 'none',
    }
  const total = totalClasses(setup)
  const given = classesGiven(setup, now.date, held)
  const today = classOn(setup, now.date) ?? null
  const next = nextClass(setup, now)
  const weeks = courseWeeks(setup).length || null
  const configured =
    total !== null || hasDates(setup) || setup.extras.length > 0
  const done = total !== null && given >= total
  const phase: CoursePhase = !configured
    ? 'none'
    : given === 0
      ? 'before'
      : done
        ? today
          ? 'last'
          : 'finished'
        : 'running'
  return {
    configured,
    total,
    given,
    remaining: total === null ? null : Math.max(0, total - given),
    today,
    next,
    week: weekOf(setup, now.date),
    weeks,
    phase,
  }
}

/**
 * "Copiar configuración de otro curso" (D112): the schedule, places, length, topics and the
 * holiday country carry over; dates move with the new start; holidays are loaded again for the
 * new dates; what belongs to the old course (counter correction, classes held) doesn't.
 */
export function copySetup(
  setup: CourseSetup,
  start: string | null,
): CourseSetup {
  const shift = (date: string) =>
    setup.start && start
      ? addDaysKey(date, daysBetween(setup.start, start))
      : date
  const moved = !!(setup.start && start)
  return {
    ...setup,
    start,
    end: setup.end && moved ? shift(setup.end) : setup.weeks ? null : setup.end,
    holidays: [],
    daysOff: moved
      ? setup.daysOff.map((day) => ({ ...day, date: shift(day.date) }))
      : [],
    extras: moved
      ? setup.extras.map((extra) => ({ ...extra, date: shift(extra.date) }))
      : [],
    correction: 0,
    held: null,
  }
}

/** The range holidays are loaded for: the course's dates (a year ahead without an end) */
export function holidayRange(setup: CourseSetup) {
  if (!setup.start) return null
  return {
    from: setup.start,
    to: courseEnd(setup) ?? addDaysKey(setup.start, OPEN_HORIZON),
  }
}

// ---------- formatting (Intl, the reader's language) ----------

/** "18:00" → "6:00 p. m." (es) / "6:00 PM" (en) */
export function formatClock(time: string, locale: string) {
  if (!time) return ''
  const [hours, minutes] = time.split(':').map(Number)
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, hours, minutes))
}

/** "6:00 p. m. – 9:00 p. m.", or one end, or "" */
export function formatHours(start: string, end: string, locale: string) {
  return [formatClock(start, locale), formatClock(end, locale)]
    .filter(Boolean)
    .join(' – ')
}

/** "martes 4 de noviembre" (long) or "mar, 4 nov" (short) */
export function formatDay(
  date: string,
  locale: string,
  style: 'long' | 'short' = 'long',
) {
  return new Intl.DateTimeFormat(
    locale,
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  ).format(fromKey(date))
}

/** "martes" / "Tuesday" for an ISO weekday */
export function weekdayName(
  day: Weekday,
  locale: string,
  style: 'long' | 'short' | 'narrow' = 'long',
) {
  // 2024-01-01 was a Monday
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(
    new Date(2024, 0, day),
  )
}
