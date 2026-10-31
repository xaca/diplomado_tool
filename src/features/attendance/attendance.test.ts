import { describe, expect, it } from 'vitest'
import {
  byDateDesc,
  cleanMarks,
  countMarks,
  localDate,
  markEveryone,
  studentStats,
  summaryChanges,
} from '@/features/attendance/attendance'
import {
  emailList,
  mailtoLinks,
  preferredEmail,
} from '@/features/students/emails'
import { toCsv } from '@/lib/csv'
import { attendanceInputSchema } from '@/model'

const at = (ms: number) => ({ toDate: () => new Date(ms) })

describe('attendance (M18)', () => {
  it("today is the teacher's local day", () => {
    expect(localDate(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(localDate(new Date(2026, 0, 9, 0, 1))).toBe('2026-01-09')
  })

  it('"Todos presentes" fills only the students without a mark', () => {
    expect(markEveryone({ b: { status: 'late' } }, ['a', 'b', 'c'])).toEqual({
      a: { status: 'present' },
      b: { status: 'late' },
      c: { status: 'present' },
    })
  })

  it('counts a day, optionally only for the current roster', () => {
    const marks = {
      a: { status: 'present' },
      b: { status: 'absent' },
      gone: { status: 'present' },
    } as const
    expect(countMarks(marks)).toEqual({
      present: 2,
      late: 0,
      absent: 1,
      excused: 0,
    })
    expect(countMarks(marks, ['a', 'b']).present).toBe(1)
  })

  it('rate = (present + late) / (marked days − excused); unmarked days do not count', () => {
    const records = [
      { date: '2026-11-03', topic: '', marks: { a: { status: 'present' } } },
      { date: '2026-11-04', topic: '', marks: { a: { status: 'late' } } },
      { date: '2026-11-05', topic: '', marks: { a: { status: 'absent' } } },
      { date: '2026-11-06', topic: '', marks: { a: { status: 'excused' } } },
      { date: '2026-11-07', topic: '', marks: {} },
    ] as const
    const stats = studentStats(records, 'a')
    expect(stats.counts).toEqual({ present: 1, late: 1, absent: 1, excused: 1 })
    expect(stats.rate).toBeCloseTo(2 / 3)
    expect(studentStats(records, 'nobody').rate).toBeNull()
    expect(
      studentStats(
        [{ date: 'x', topic: '', marks: { a: { status: 'excused' } } }],
        'a',
      ).rate,
    ).toBeNull()
  })

  it('summary changes: only students whose state changed; null removes the day', () => {
    expect(
      summaryChanges(
        {
          a: { status: 'present' },
          b: { status: 'late', note: 'x' },
          c: { status: 'absent' },
        },
        {
          a: { status: 'present', note: 'nueva nota' },
          b: { status: 'present' },
          d: { status: 'excused' },
        },
      ),
    ).toEqual({ b: 'present', c: null, d: 'excused' })
  })

  it('notes are trimmed and empty ones dropped; dates sort newest first', () => {
    expect(
      cleanMarks({
        a: { status: 'late', note: '  bus  ' },
        b: { status: 'absent', note: '   ' },
      }),
    ).toEqual({ a: { status: 'late', note: 'bus' }, b: { status: 'absent' } })
    expect(
      byDateDesc([
        { date: '2026-11-03' },
        { date: '2026-12-01' },
        { date: '2026-11-10' },
      ]).map((r) => r.date),
    ).toEqual(['2026-12-01', '2026-11-10', '2026-11-03'])
  })

  it('validates what the app saves', () => {
    expect(
      attendanceInputSchema.safeParse({
        date: '2026-11-03',
        topic: 'Sesión 4',
        marks: { a: { status: 'present' } },
      }).success,
    ).toBe(true)
    for (const bad of [
      { date: '2026-02-30x', topic: '', marks: {} },
      { date: '2026-11-03', topic: '', marks: { a: { status: 'tarde' } } },
      { date: '2026-11-03', topic: 'x'.repeat(121), marks: {} },
    ])
      expect(attendanceInputSchema.safeParse(bad).success).toBe(false)
  })
})

describe("students' emails (M18)", () => {
  const laura = {
    id: 'st_laura',
    emails: ['Laura@gmail.com', 'lnataly@uni.edu.co'],
  }
  const seb = { id: 'st_seb', emails: ['seb@gmail.com'] }

  it('the email of the account the student joined with most recently, else the first', () => {
    expect(preferredEmail(laura, [])).toBe('laura@gmail.com')
    expect(
      preferredEmail(laura, [
        { studentId: 'st_laura', email: 'laura@gmail.com', joinedAt: at(1) },
        { studentId: 'st_laura', email: 'LNataly@uni.edu.co', joinedAt: at(5) },
        // another student's account, or an email no longer on the roster, never counts
        { studentId: 'st_seb', email: 'seb@gmail.com', joinedAt: at(9) },
        { studentId: 'st_laura', email: 'old@gmail.com', joinedAt: at(9) },
      ]),
    ).toBe('lnataly@uni.edu.co')
  })

  it('one per student, or all of them; never repeated', () => {
    expect(emailList([laura, seb, seb], [])).toEqual([
      'laura@gmail.com',
      'seb@gmail.com',
    ])
    expect(emailList([laura, seb], [], { all: true })).toEqual([
      'laura@gmail.com',
      'lnataly@uni.edu.co',
      'seb@gmail.com',
    ])
  })

  it('splits long BCC lists into several mail links', () => {
    const emails = Array.from(
      { length: 120 },
      (_, i) => `estudiante${i}@uni.edu.co`,
    )
    const links = mailtoLinks(emails)
    expect(links.length).toBeGreaterThan(1)
    for (const link of links) {
      expect(link.startsWith('mailto:?bcc=')).toBe(true)
      expect(link.length).toBeLessThanOrEqual(1800)
    }
    expect(
      links
        .flatMap((link) => link.slice(12).split(','))
        .map(decodeURIComponent),
    ).toEqual(emails)
    expect(mailtoLinks(['a+b@x.co'])).toEqual(['mailto:?bcc=a%2Bb%40x.co'])
    expect(mailtoLinks([])).toEqual([])
  })
})

describe('CSV (M18)', () => {
  it('semicolons, BOM, quotes, and no formulas from cell text', () => {
    expect(
      toCsv([
        ['Nombre', 'Nota'],
        ['Ana; María', 'dijo "hola"'],
        ['=HYPERLINK("x")', 95.5],
        ['-1', null],
      ]),
    ).toBe(
      '﻿Nombre;Nota\r\n"Ana; María";"dijo ""hola"""\r\n"\'=HYPERLINK(""x"")";95.5\r\n\'-1;\r\n',
    )
  })
})
