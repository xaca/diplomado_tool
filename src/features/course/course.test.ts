import { describe, expect, it } from 'vitest'
import {
  classDates,
  classesGiven,
  classNumberOn,
  copySetup,
  courseEnd,
  courseState,
  courseWeeks,
  datesSummary,
  formatClock,
  formatHours,
  nextClass,
  totalClasses,
  weekOf,
  weekdayName,
} from '@/features/course/course'
import { courseSetupSchema, type CourseSetup } from '@/model'

const setup = (fields: Partial<CourseSetup>) => courseSetupSchema.parse(fields)

// November 2026: Tue 3, 10, 17, 24 · Sat 7, 14, 21, 28
const semester = setup({
  start: '2026-11-03',
  end: '2026-11-28',
  schedule: [
    { day: 2, start: '18:00', end: '21:00', place: 'Salón 304' },
    { day: 6, start: '08:00', end: '12:00', place: '' },
  ],
})
const dates = (course: CourseSetup) => classDates(course).map((day) => day.date)

describe('class dates: the single source', () => {
  it('lists the schedule’s weekdays from start to end, each with its own time and place', () => {
    expect(dates(semester)).toEqual([
      '2026-11-03',
      '2026-11-07',
      '2026-11-10',
      '2026-11-14',
      '2026-11-17',
      '2026-11-21',
      '2026-11-24',
      '2026-11-28',
    ])
    expect(classDates(semester)[0]).toMatchObject({
      start: '18:00',
      end: '21:00',
      place: 'Salón 304',
      extra: false,
    })
    expect(classDates(semester)[1]).toMatchObject({ start: '08:00', place: '' })
    expect(totalClasses(semester)).toBe(8)
  })

  it('skips holidays and days off, and adds one-off classes (a moved class = a day off + an extra)', () => {
    const course = {
      ...semester,
      holidays: [{ date: '2026-11-17', name: 'Festivo' }],
      daysOff: [{ date: '2026-11-21', reason: 'Movida al 25' }],
      extras: [
        {
          date: '2026-11-25',
          start: '18:00',
          end: '21:00',
          place: '',
          note: 'Movida del 21',
        },
      ],
    }
    expect(dates(course)).toEqual([
      '2026-11-03',
      '2026-11-07',
      '2026-11-10',
      '2026-11-14',
      '2026-11-24',
      '2026-11-25',
      '2026-11-28',
    ])
    expect(classDates(course).at(-2)).toMatchObject({
      extra: true,
      note: 'Movida del 21',
    })
    expect(totalClasses(course)).toBe(7)
    expect(datesSummary(course)).toEqual({
      total: 7,
      first: '2026-11-03',
      last: '2026-11-28',
    })
  })

  it('a number of weeks gives the end: the Sunday of week N', () => {
    const course = setup({ ...semester, end: null, weeks: 4 })
    expect(courseEnd(course)).toBe('2026-11-29')
    expect(totalClasses(course)).toBe(8)
  })

  it('without an end there is no total (unless typed), but classes and the next one still work', () => {
    const open = setup({ ...semester, end: null })
    expect(totalClasses(open)).toBeNull()
    expect(classesGiven(open, '2026-11-10')).toBe(3)
    expect(nextClass(open, { date: '2026-12-30', time: '10:00' })?.date).toBe(
      '2027-01-02',
    )
    expect(totalClasses({ ...open, total: 30 })).toBe(30)
  })

  it('nothing set: no classes, no total, nothing configured', () => {
    const empty = setup({})
    expect(classDates(empty)).toEqual([])
    expect(totalClasses(empty)).toBeNull()
    expect(
      courseState(empty, { date: '2026-11-10', time: '10:00' }),
    ).toMatchObject({
      configured: false,
      phase: 'none',
    })
    expect(courseState(null, { date: '2026-11-10', time: '10:00' }).phase).toBe(
      'none',
    )
  })
})

describe('the counter: "Clase 12 de 32"', () => {
  it('with dates, counts the class days up to today (today’s class included)', () => {
    expect(classesGiven(semester, '2026-11-02')).toBe(0)
    expect(classesGiven(semester, '2026-11-13')).toBe(3)
    expect(classesGiven(semester, '2026-11-14')).toBe(4)
    expect(classesGiven(semester, '2027-01-01')).toBe(8)
    expect(classNumberOn(semester, '2026-11-10')).toBe(3)
    expect(classNumberOn(semester, '2026-11-11')).toBeNull()
  })

  it('without a schedule, counts the days a class was given (attendance or a Clase) and the correction', () => {
    const workshop = setup({ total: 4 })
    const held = ['2026-11-01', '2026-11-01', '2026-11-05', '2026-12-01']
    expect(classesGiven(workshop, '2026-11-10', held)).toBe(2)
    expect(
      classesGiven({ ...workshop, correction: 1 }, '2026-11-10', held),
    ).toBe(3)
    // students read the count the teacher's browser saved
    expect(classesGiven({ ...workshop, held: 2 }, '2026-11-10')).toBe(2)
    // never above the total nor below 0
    expect(
      classesGiven({ ...workshop, correction: 9 }, '2026-11-10', held),
    ).toBe(4)
    expect(
      classesGiven({ ...workshop, correction: -9 }, '2026-11-10', held),
    ).toBe(0)
  })

  it('the next class: today’s until it ends, then the next class day', () => {
    expect(
      nextClass(semester, { date: '2026-11-14', time: '09:00' })?.date,
    ).toBe('2026-11-14')
    expect(
      nextClass(semester, { date: '2026-11-14', time: '12:30' })?.date,
    ).toBe('2026-11-17')
    expect(
      nextClass(semester, { date: '2026-11-28', time: '13:00' }),
    ).toBeNull()
  })

  it('the state through the course: before, running, the last class, finished', () => {
    const at = (date: string, time = '10:00') =>
      courseState(semester, { date, time })
    expect(at('2026-11-01')).toMatchObject({
      phase: 'before',
      given: 0,
      total: 8,
    })
    expect(at('2026-11-10')).toMatchObject({
      phase: 'running',
      given: 3,
      remaining: 5,
      week: 2,
      weeks: 4,
    })
    expect(at('2026-11-10').today?.date).toBe('2026-11-10')
    expect(at('2026-11-11').today).toBeNull()
    expect(at('2026-11-28')).toMatchObject({
      phase: 'last',
      given: 8,
      remaining: 0,
    })
    expect(at('2026-12-01')).toMatchObject({ phase: 'finished', week: null })
    // a workshop with only a total
    const workshop = setup({ total: 4, held: 4 })
    expect(
      courseState(workshop, { date: '2026-11-10', time: '10:00' }).phase,
    ).toBe('finished')
  })
})

describe('weeks', () => {
  it('start on Monday; week 1 is the week of the start date; topics, holidays and days off per week', () => {
    const course = {
      ...semester,
      holidays: [{ date: '2026-11-17', name: 'Festivo' }],
      daysOff: [{ date: '2026-11-21', reason: 'Receso' }],
      topics: { '2': 'Prototipos' },
    }
    const weeks = courseWeeks(course)
    expect(weeks.map((week) => [week.number, week.start, week.end])).toEqual([
      [1, '2026-11-02', '2026-11-08'],
      [2, '2026-11-09', '2026-11-15'],
      [3, '2026-11-16', '2026-11-22'],
      [4, '2026-11-23', '2026-11-29'],
    ])
    expect(weeks[1].topic).toBe('Prototipos')
    expect(weeks[2].classes).toEqual([])
    expect(weeks[2].holidays).toHaveLength(1)
    expect(weeks[2].daysOff).toHaveLength(1)
    expect(weekOf(course, '2026-11-02')).toBe(1)
    expect(weekOf(course, '2026-11-29')).toBe(4)
    expect(weekOf(course, '2026-11-30')).toBeNull()
    expect(courseWeeks(setup({ start: '2026-11-03' }))).toEqual([])
  })
})

describe('copying the setup to another course', () => {
  it('keeps the schedule and length, moves the dates with the new start, drops what was the old course’s', () => {
    const old = {
      ...semester,
      holidayCountry: 'CO' as const,
      holidays: [{ date: '2026-11-17', name: 'Festivo' }],
      daysOff: [{ date: '2026-11-21', reason: 'Receso' }],
      correction: 2,
      held: 5,
    }
    const copy = copySetup(old, '2027-02-02')
    expect(copy.start).toBe('2027-02-02')
    expect(copy.end).toBe('2027-02-27')
    expect(copy.schedule).toEqual(semester.schedule)
    expect(copy.daysOff).toEqual([{ date: '2027-02-20', reason: 'Receso' }])
    expect(copy.holidays).toEqual([])
    expect(copy.holidayCountry).toBe('CO')
    expect(copy).toMatchObject({ correction: 0, held: null })
    expect(totalClasses(copy)).toBe(7)
  })
})

describe('formatting', () => {
  it('times and weekdays in the reader’s language', () => {
    expect(formatClock('18:00', 'en')).toBe('6:00 PM')
    expect(formatClock('', 'en')).toBe('')
    expect(formatHours('18:00', '21:00', 'en')).toBe('6:00 PM – 9:00 PM')
    expect(weekdayName(2, 'es')).toBe('martes')
    expect(weekdayName(7, 'en')).toBe('Sunday')
  })
})
