import {
  collection,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import {
  cleanMarks,
  summaryChanges,
  type AttendanceRecord,
} from '@/features/attendance/attendance'
import { auth, db } from '@/lib/firebase'
import { normalizeEmail } from '@/lib/collections'
import {
  attendanceInputSchema,
  paths,
  type AttendanceDoc,
  type AttendanceMark,
  type AttendanceStatus,
} from '@/model'

// Attendance (M18): the day's record and every changed student's own summary are written in one
// batch, so what a student sees always matches the teacher's record.

export const attendanceCollection = (boardId: string) =>
  collection(db, paths.attendances(boardId))

const teacherEmail = () => normalizeEmail(auth.currentUser?.email ?? '')

function writeSummaries(
  batch: WriteBatch,
  boardId: string,
  date: string,
  changes: Record<string, AttendanceStatus | null>,
) {
  for (const [studentId, status] of Object.entries(changes))
    batch.set(
      doc(db, paths.attendanceSummary(boardId, studentId)),
      {
        dates: { [date]: status ?? deleteField() },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
}

/** Saves a day (`before`: the marks currently stored, to update only what changed). */
export async function saveAttendance(
  boardId: string,
  input: AttendanceRecord,
  before: Record<string, AttendanceMark>,
) {
  const day = attendanceInputSchema.parse({
    ...input,
    marks: cleanMarks(input.marks),
  })
  const batch = writeBatch(db)
  batch.set(doc(db, paths.attendance(boardId, day.date)), {
    date: day.date,
    topic: day.topic,
    marks: day.marks,
    takenBy: teacherEmail(),
    updatedAt: serverTimestamp(),
  })
  writeSummaries(batch, boardId, day.date, summaryChanges(before, day.marks))
  await batch.commit()
}

/** Deletes a day (a class recorded by mistake) and removes it from the students' summaries. */
export async function deleteAttendanceDay(
  boardId: string,
  record: Pick<AttendanceDoc, 'date' | 'marks'>,
) {
  const batch = writeBatch(db)
  batch.delete(doc(db, paths.attendance(boardId, record.date)))
  writeSummaries(batch, boardId, record.date, summaryChanges(record.marks, {}))
  await batch.commit()
}

/**
 * Removing or merging a student (M18): their marks go with them (`into`: moved to the kept
 * student on the days that student has no mark). Adds the writes to the caller's batch.
 */
export async function moveAttendance(
  batch: WriteBatch,
  boardId: string,
  studentId: string,
  into?: string,
) {
  const days = await getDocs(attendanceCollection(boardId))
  const intoDates: Record<string, AttendanceStatus> = {}
  for (const day of days.docs) {
    const record = day.data() as AttendanceDoc
    const mark = record.marks[studentId]
    if (!mark) continue
    const marks = { ...record.marks }
    delete marks[studentId]
    if (into && !marks[into]) {
      marks[into] = mark
      intoDates[record.date] = mark.status
    }
    batch.update(day.ref, {
      marks,
      takenBy: teacherEmail(),
      updatedAt: serverTimestamp(),
    })
  }
  batch.delete(doc(db, paths.attendanceSummary(boardId, studentId)))
  if (into && Object.keys(intoDates).length)
    batch.set(
      doc(db, paths.attendanceSummary(boardId, into)),
      { dates: intoDates, updatedAt: serverTimestamp() },
      { merge: true },
    )
}
