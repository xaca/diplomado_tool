import { z } from 'zod'
import { normalizeEmail } from '@/lib/collections'
import {
  MAX_EMAILS_PER_STUDENT,
  studentInputSchema,
  type StudentInput,
} from '@/model'

// Pure import logic (no Firebase): parse a students JSON file or quick-add lines,
// then compare against the current roster to build a preview (PLAN.md → "Import / export").

export const STUDENTS_FILE_TYPE = 'pbl.students'

const studentsFileSchema = z.object({
  type: z.literal(STUDENTS_FILE_TYPE),
  version: z.literal(1),
  students: z.array(z.unknown()),
})

export type RawRow = {
  line: number
  name: string
  emails: string[]
  group: string
}

export type ParseResult =
  | { rows: RawRow[]; error: null }
  | { rows: []; error: 'invalidJson' | 'invalidFormat' }

export function parseStudentsJson(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { rows: [], error: 'invalidJson' }
  }
  const file = studentsFileSchema.safeParse(data)
  if (!file.success) return { rows: [], error: 'invalidFormat' }

  const rows = file.data.students.map((item, index) => {
    const record = (
      typeof item === 'object' && item !== null ? item : {}
    ) as Record<string, unknown>
    const emails = Array.isArray(record.emails) ? record.emails.map(String) : []
    return {
      line: index + 1,
      name: String(record.name ?? ''),
      emails,
      group: String(record.group ?? ''),
    }
  })
  return { rows, error: null }
}

/** One student per line: `Name; email; email; …` (commas or tabs also work, e.g. pasted from a spreadsheet) */
export function parseQuickAdd(text: string): RawRow[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ raw: line.trim(), line: index + 1 }))
    .filter(({ raw }) => raw.length > 0)
    .map(({ raw, line }) => {
      const parts = raw
        .split(/[;\t,]/)
        .map((part) => part.trim())
        .filter(Boolean)
      const emails = parts.filter((part) => part.includes('@'))
      const name = parts.filter((part) => !part.includes('@')).join(' ')
      return {
        line,
        name: name || (emails[0]?.split('@')[0] ?? ''),
        emails,
        group: '',
      }
    })
}

// ---------- preview ----------

export type ExistingStudent = {
  id: string
  displayName: string
  emails: string[]
  group: string
}

export type PreviewItem =
  | { line: number; status: 'new'; input: StudentInput }
  | {
      line: number
      status: 'update'
      input: StudentInput
      studentId: string
      addedEmails: string[]
    }
  | {
      line: number
      status: 'unchanged'
      input: StudentInput
      studentId: string
    }
  | {
      line: number
      status: 'invalid'
      name: string
      reason: 'name' | 'email' | 'noEmail' | 'tooManyEmails'
    }
  | {
      line: number
      status: 'conflict'
      input: StudentInput
      reason: 'duplicateInFile' | 'otherStudents'
    }

export function buildPreview(
  rows: RawRow[],
  existing: ExistingStudent[],
): PreviewItem[] {
  const owner = new Map<string, ExistingStudent>()
  for (const student of existing)
    for (const email of student.emails) owner.set(email, student)

  const seen = new Map<string, number>()
  for (const row of rows) {
    for (const email of new Set(row.emails.map(normalizeEmail)))
      seen.set(email, (seen.get(email) ?? 0) + 1)
  }

  return rows.map((row): PreviewItem => {
    const parsed = studentInputSchema.safeParse({
      name: row.name,
      emails: [...new Set(row.emails.map(normalizeEmail))],
      group: row.group,
    })
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path[0])
      const reason =
        row.emails.length === 0
          ? 'noEmail'
          : paths.includes('name')
            ? 'name'
            : row.emails.length > MAX_EMAILS_PER_STUDENT
              ? 'tooManyEmails'
              : 'email'
      return { line: row.line, status: 'invalid', name: row.name, reason }
    }
    const input = parsed.data

    if (input.emails.some((email) => (seen.get(email) ?? 0) > 1)) {
      return {
        line: row.line,
        status: 'conflict',
        input,
        reason: 'duplicateInFile',
      }
    }

    const matches = new Set(
      input.emails
        .map((email) => owner.get(email))
        .filter((student) => student !== undefined),
    )
    if (matches.size > 1)
      return {
        line: row.line,
        status: 'conflict',
        input,
        reason: 'otherStudents',
      }

    const [match] = [...matches]
    if (!match) return { line: row.line, status: 'new', input }

    const addedEmails = input.emails.filter(
      (email) => !match.emails.includes(email),
    )
    if (match.emails.length + addedEmails.length > MAX_EMAILS_PER_STUDENT) {
      return {
        line: row.line,
        status: 'invalid',
        name: row.name,
        reason: 'tooManyEmails',
      }
    }
    const changed =
      addedEmails.length > 0 ||
      match.displayName !== input.name ||
      (input.group !== '' && match.group !== input.group)
    return changed
      ? {
          line: row.line,
          status: 'update',
          input,
          studentId: match.id,
          addedEmails,
        }
      : { line: row.line, status: 'unchanged', input, studentId: match.id }
  })
}

export function summarize(preview: PreviewItem[]) {
  const count = (status: PreviewItem['status']) =>
    preview.filter((item) => item.status === status).length
  return {
    new: count('new'),
    update: count('update'),
    unchanged: count('unchanged'),
    invalid: count('invalid'),
    conflict: count('conflict'),
    /** Firestore writes the import will use (student doc + one index doc per new email) */
    writes: preview.reduce((total, item) => {
      if (item.status === 'new') return total + 1 + item.input.emails.length
      if (item.status === 'update') return total + 1 + item.addedEmails.length
      return total
    }, 0),
  }
}

// ---------- export ----------

export function toStudentsFile(
  students: (ExistingStudent & { status?: string })[],
) {
  return {
    type: STUDENTS_FILE_TYPE,
    version: 1 as const,
    students: students.map(({ displayName, emails, group, status }) => ({
      name: displayName,
      emails,
      ...(group ? { group } : {}),
      ...(status ? { status } : {}),
    })),
  }
}

export const STUDENTS_TEMPLATE = toStudentsFile([
  {
    id: '',
    displayName: 'Laura Nataly',
    emails: ['laura@gmail.com', 'lnataly@universidad.edu.co'],
    group: 'Equipo 1',
  },
  {
    id: '',
    displayName: 'Sebastian Cetina',
    emails: ['scetina@universidad.edu.co'],
    group: '',
  },
])
