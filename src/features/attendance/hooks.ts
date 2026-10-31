import { useMemo } from 'react'
import { doc } from 'firebase/firestore'
import { attendanceCollection } from '@/features/attendance/api'
import { byDateDesc } from '@/features/attendance/attendance'
import { db } from '@/lib/firebase'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import { paths, type AttendanceDoc, type AttendanceSummaryDoc } from '@/model'

/** Every class date of the board, newest first (teacher). */
export function useAttendance(boardId: string | undefined) {
  const result = useLiveQuery<AttendanceDoc>(
    boardId ? attendanceCollection(boardId) : null,
    `attendance:${boardId}`,
  )
  const records = useMemo(() => byDateDesc(result.data), [result.data])
  return { ...result, data: records }
}

/** A student's own attendance (dates and states). */
export function useAttendanceSummary(
  boardId: string | undefined,
  studentId: string | null | undefined,
) {
  return useLiveDoc<AttendanceSummaryDoc>(
    boardId && studentId
      ? doc(db, paths.attendanceSummary(boardId, studentId))
      : null,
    `attendanceSummary:${boardId}:${studentId}`,
  )
}
