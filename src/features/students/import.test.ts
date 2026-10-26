import { describe, expect, it } from 'vitest'
import {
  buildPreview,
  parseQuickAdd,
  parseStudentsJson,
  STUDENTS_TEMPLATE,
  summarize,
  toStudentsFile,
  type ExistingStudent,
} from '@/features/students/import'

const existing: ExistingStudent[] = [
  {
    id: 'st_laura',
    displayName: 'Laura Nataly',
    emails: ['laura@gmail.com'],
    group: '',
  },
  {
    id: 'st_seb',
    displayName: 'Sebastian',
    emails: ['seb@uni.edu.co'],
    group: 'Equipo 2',
  },
]

describe('parseStudentsJson', () => {
  it('reads the template', () => {
    const result = parseStudentsJson(JSON.stringify(STUDENTS_TEMPLATE))
    expect(result.error).toBeNull()
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      name: 'Laura Nataly',
      emails: ['laura@gmail.com', 'lnataly@universidad.edu.co'],
    })
  })

  it('rejects broken JSON and unknown files', () => {
    expect(parseStudentsJson('{nope').error).toBe('invalidJson')
    expect(
      parseStudentsJson('{"type":"other","version":1,"students":[]}').error,
    ).toBe('invalidFormat')
  })
})

describe('parseQuickAdd', () => {
  it('accepts ; , and tabs, ignores blank lines', () => {
    const rows = parseQuickAdd(
      'Laura Nataly; laura@gmail.com; l@uni.edu.co\n\nAna\tana@gmail.com\nPedro, pedro@gmail.com',
    )
    expect(rows.map((row) => [row.name, row.emails])).toEqual([
      ['Laura Nataly', ['laura@gmail.com', 'l@uni.edu.co']],
      ['Ana', ['ana@gmail.com']],
      ['Pedro', ['pedro@gmail.com']],
    ])
  })

  it('uses the email user name when no name is given', () => {
    expect(parseQuickAdd('solo@gmail.com')[0]).toMatchObject({
      name: 'solo',
      emails: ['solo@gmail.com'],
    })
  })
})

describe('buildPreview', () => {
  const rows = (lines: string) => parseQuickAdd(lines)

  it('new student', () => {
    const [item] = buildPreview(rows('Ana; ana@gmail.com'), existing)
    expect(item.status).toBe('new')
  })

  it('matches an existing student by ANY email (case-insensitive) and adds the second email', () => {
    const [item] = buildPreview(
      rows('Laura Nataly; LAURA@gmail.com; lnataly@uni.edu.co'),
      existing,
    )
    expect(item).toMatchObject({
      status: 'update',
      studentId: 'st_laura',
      addedEmails: ['lnataly@uni.edu.co'],
    })
  })

  it('re-importing the same data changes nothing', () => {
    const [item] = buildPreview(rows('Laura Nataly; laura@gmail.com'), existing)
    expect(item.status).toBe('unchanged')
  })

  it('flags invalid rows', () => {
    const preview = buildPreview(
      rows('Bad; not-an-email\nNo Email Person'),
      existing,
    )
    expect(preview.map((item) => item.status)).toEqual(['invalid', 'invalid'])
  })

  it('flags an email repeated in the file', () => {
    const preview = buildPreview(
      rows('A; x@gmail.com\nB; x@gmail.com'),
      existing,
    )
    expect(preview.map((item) => item.status)).toEqual(['conflict', 'conflict'])
  })

  it('flags a row whose emails belong to two different students', () => {
    const [item] = buildPreview(
      rows('Mix; laura@gmail.com; seb@uni.edu.co'),
      existing,
    )
    expect(item).toMatchObject({ status: 'conflict', reason: 'otherStudents' })
  })

  it('counts the Firestore writes', () => {
    const preview = buildPreview(
      rows(
        'Ana; ana@gmail.com; ana@uni.edu.co\nLaura Nataly; laura@gmail.com; l2@uni.edu.co',
      ),
      existing,
    )
    // new: 1 student + 2 emails · update: 1 student + 1 new email
    expect(summarize(preview)).toMatchObject({ new: 1, update: 1, writes: 5 })
  })
})

describe('toStudentsFile', () => {
  it('round-trips through the importer', () => {
    const file = toStudentsFile(existing)
    const parsed = parseStudentsJson(JSON.stringify(file))
    const preview = buildPreview(parsed.rows, existing)
    expect(preview.every((item) => item.status === 'unchanged')).toBe(true)
  })
})

describe('email limit', () => {
  it('an update cannot push a student past 5 emails', () => {
    const full: ExistingStudent[] = [
      {
        id: 'st_full',
        displayName: 'Full',
        emails: ['a@x.co', 'b@x.co', 'c@x.co', 'd@x.co', 'e@x.co'],
        group: '',
      },
    ]
    const [item] = buildPreview(parseQuickAdd('Full; a@x.co; f@x.co'), full)
    expect(item).toMatchObject({ status: 'invalid', reason: 'tooManyEmails' })
  })
})
