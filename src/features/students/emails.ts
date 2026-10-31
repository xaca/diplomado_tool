import { toDate } from '@/lib/time'
import { normalizeEmail } from '@/lib/collections'
import type { MemberDoc, StudentDoc } from '@/model'

// Students' emails for the teacher (M18, F24): which address to write to, the list, and mail-app
// links. Pure, unit-tested. The app never sends email: the teacher writes from their own account.

type Student = Pick<StudentDoc, 'emails'> & { id: string }
type Member = Pick<MemberDoc, 'studentId' | 'email' | 'joinedAt'>

/**
 * The address a student actually uses (D63): the email of the account they joined with most
 * recently, else the first one on the roster.
 */
export function preferredEmail(student: Student, members: readonly Member[]) {
  const listed = new Set(student.emails.map(normalizeEmail))
  const used = members
    .filter(
      (member) =>
        member.studentId === student.id &&
        listed.has(normalizeEmail(member.email)),
    )
    .sort((a, b) => toDate(b.joinedAt).getTime() - toDate(a.joinedAt).getTime())
  return normalizeEmail(used[0]?.email ?? student.emails[0] ?? '')
}

/** The recipients: one address per student, or every address with `all`; no repeats. */
export function emailList(
  students: readonly Student[],
  members: readonly Member[],
  { all = false } = {},
) {
  const emails = students.flatMap((student) =>
    all
      ? student.emails.map(normalizeEmail)
      : [preferredEmail(student, members)],
  )
  return [...new Set(emails.filter(Boolean))]
}

/** Mail apps cut long mailto: links; split the BCC list so each link stays short. */
export const MAILTO_MAX = 1800

export function mailtoLinks(emails: readonly string[], max = MAILTO_MAX) {
  const links: string[] = []
  let batch: string[] = []
  const link = (list: string[]) =>
    `mailto:?bcc=${list.map(encodeURIComponent).join(',')}`
  for (const email of emails) {
    if (batch.length && link([...batch, email]).length > max) {
      links.push(link(batch))
      batch = []
    }
    batch.push(email)
  }
  if (batch.length) links.push(link(batch))
  return links
}
