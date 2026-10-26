import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import {
  MAX_EMAILS_PER_STUDENT,
  paths,
  studentInputSchema,
  type StudentDoc,
  type StudentInput,
} from '@/model'
import type { PreviewItem } from '@/features/students/import'

export const studentsCollection = (boardId: string) =>
  collection(db, paths.students(boardId))

export type Student = WithId<StudentDoc>

export class EmailTakenError extends Error {
  readonly email: string

  constructor(email: string) {
    super(`Email already belongs to another student: ${email}`)
    this.email = email
  }
}

/** Emails must be unique across the board (each one points to exactly one student). */
function assertEmailsFree(
  emails: string[],
  roster: Student[],
  exceptStudentId?: string,
) {
  for (const email of emails) {
    if (
      roster.some(
        (student) =>
          student.id !== exceptStudentId && student.emails.includes(email),
      )
    ) {
      throw new EmailTakenError(email)
    }
  }
}

function setNewStudent(
  batch: WriteBatch,
  boardId: string,
  input: StudentInput,
  source: 'import' | 'manual',
) {
  const ref = doc(studentsCollection(boardId))
  batch.set(ref, {
    displayName: input.name,
    emails: input.emails,
    group: input.group,
    status: 'invited',
    linkedUids: [],
    source,
    createdAt: serverTimestamp(),
  })
  for (const email of input.emails) {
    batch.set(doc(db, paths.studentEmail(boardId, email)), {
      email,
      studentId: ref.id,
    })
  }
  return ref.id
}

export async function addStudent(
  boardId: string,
  rawInput: StudentInput,
  roster: Student[],
) {
  const input = studentInputSchema.parse(rawInput)
  assertEmailsFree(input.emails, roster)
  const batch = writeBatch(db)
  const id = setNewStudent(batch, boardId, input, 'manual')
  await batch.commit()
  return id
}

export async function updateStudent(
  boardId: string,
  student: Student,
  rawInput: StudentInput,
  roster: Student[],
) {
  const input = studentInputSchema.parse(rawInput)
  const added = input.emails.filter((email) => !student.emails.includes(email))
  const removed = student.emails.filter(
    (email) => !input.emails.includes(email),
  )
  assertEmailsFree(added, roster, student.id)

  const batch = writeBatch(db)
  batch.update(doc(db, paths.student(boardId, student.id)), {
    displayName: input.name,
    emails: input.emails,
    group: input.group,
  })
  for (const email of added)
    batch.set(doc(db, paths.studentEmail(boardId, email)), {
      email,
      studentId: student.id,
    })
  for (const email of removed)
    batch.delete(doc(db, paths.studentEmail(boardId, email)))
  await batch.commit()
}

/** Deletes the student, their email index, linked accounts and their space. */
export async function removeStudent(boardId: string, student: Student) {
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.student(boardId, student.id)))
  for (const email of student.emails)
    batch.delete(doc(db, paths.studentEmail(boardId, email)))
  for (const uid of student.linkedUids)
    batch.delete(doc(db, paths.member(boardId, uid)))
  batch.delete(doc(db, paths.space(boardId, student.id)))
  await batch.commit()
}

/**
 * Merges `remove` into `keep` (e.g. a student who joined with the invite link and was also imported).
 * Emails and accounts move to `keep`; `remove` and its space are deleted.
 */
export async function mergeStudents(
  boardId: string,
  keep: Student,
  remove: Student,
) {
  const emails = [...new Set([...keep.emails, ...remove.emails])]
  if (emails.length > MAX_EMAILS_PER_STUDENT) throw new Error('tooManyEmails')
  const linkedUids = [...new Set([...keep.linkedUids, ...remove.linkedUids])]

  const [keepSpace, removeSpace] = await Promise.all([
    getDoc(doc(db, paths.space(boardId, keep.id))),
    getDoc(doc(db, paths.space(boardId, remove.id))),
  ])

  const batch = writeBatch(db)
  batch.update(doc(db, paths.student(boardId, keep.id)), {
    emails,
    linkedUids,
    status: linkedUids.length > 0 ? 'joined' : keep.status,
  })
  for (const email of remove.emails) {
    batch.set(doc(db, paths.studentEmail(boardId, email)), {
      email,
      studentId: keep.id,
    })
  }
  for (const uid of remove.linkedUids)
    batch.update(doc(db, paths.member(boardId, uid)), { studentId: keep.id })

  if (removeSpace.exists() && !keepSpace.exists()) {
    const space = removeSpace.data()
    batch.set(doc(db, paths.space(boardId, keep.id)), {
      ...space,
      studentId: keep.id,
      ownerName: keep.displayName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  batch.delete(doc(db, paths.space(boardId, remove.id)))
  batch.delete(doc(db, paths.student(boardId, remove.id)))
  await batch.commit()
}

/** Applies an import preview in batches of ≤ 450 writes (Firestore limit is 500). */
export async function importStudents(
  boardId: string,
  preview: PreviewItem[],
  onProgress?: (done: number) => void,
) {
  const items = preview.filter(
    (item) => item.status === 'new' || item.status === 'update',
  )
  let batch = writeBatch(db)
  let ops = 0
  let done = 0

  const flush = async () => {
    if (ops === 0) return
    await batch.commit()
    batch = writeBatch(db)
    ops = 0
  }

  for (const item of items) {
    const size =
      item.status === 'new'
        ? 1 + item.input.emails.length
        : 1 + item.addedEmails.length
    if (ops + size > 450) await flush()

    if (item.status === 'new') {
      setNewStudent(batch, boardId, item.input, 'import')
    } else if (item.status === 'update') {
      batch.update(doc(db, paths.student(boardId, item.studentId)), {
        displayName: item.input.name,
        ...(item.input.group ? { group: item.input.group } : {}),
        ...(item.addedEmails.length > 0
          ? { emails: arrayUnion(...item.addedEmails) }
          : {}),
      })
      for (const email of item.addedEmails) {
        batch.set(doc(db, paths.studentEmail(boardId, email)), {
          email,
          studentId: item.studentId,
        })
      }
    }
    ops += size
    done += 1
    onProgress?.(done)
  }
  await flush()
  return done
}
