import {
  ATTENDANCE_STATUSES,
  type AttendanceMark,
  type AttendanceStatus,
} from '@/model'

// Attendance by date (M18, F25): pure, unit-tested. A record per class date holds the marks;
// students without a mark that day simply don't count for it.

export type AttendanceRecord = {
  date: string
  topic: string
  marks: Record<string, AttendanceMark>
}

/** Today in the teacher's time zone: YYYY-MM-DD */
export function localDate(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "Todos presentes": everyone without a mark becomes present; existing marks stay. */
export function markEveryone(
  marks: Record<string, AttendanceMark>,
  studentIds: readonly string[],
): Record<string, AttendanceMark> {
  const next = { ...marks }
  for (const id of studentIds) next[id] ??= { status: 'present' }
  return next
}

export function countMarks(
  marks: Record<string, AttendanceMark>,
  studentIds?: readonly string[],
) {
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((status) => [status, 0]),
  ) as Record<AttendanceStatus, number>
  for (const [id, mark] of Object.entries(marks))
    if (!studentIds || studentIds.includes(id)) counts[mark.status] += 1
  return counts
}

/**
 * A student's attendance over the records: counts per state and the rate
 * (present + late) / (marked days − excused); null when there's nothing to count.
 */
export function studentStats(
  records: readonly AttendanceRecord[],
  studentId: string,
) {
  const counts = countMarks(
    Object.fromEntries(
      records.flatMap((record) =>
        record.marks[studentId] ? [[record.date, record.marks[studentId]]] : [],
      ),
    ),
  )
  const counted = counts.present + counts.late + counts.absent
  return {
    counts,
    rate: counted ? (counts.present + counts.late) / counted : null,
  }
}

/** What changes in each student's own summary when a day's marks change (null = remove). */
export function summaryChanges(
  before: Record<string, AttendanceMark>,
  after: Record<string, AttendanceMark>,
) {
  const changes: Record<string, AttendanceStatus | null> = {}
  for (const id of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (before[id]?.status !== after[id]?.status)
      changes[id] = after[id]?.status ?? null
  return changes
}

/** The marks as stored: trimmed notes, empty notes dropped. */
export function cleanMarks(marks: Record<string, AttendanceMark>) {
  return Object.fromEntries(
    Object.entries(marks).map(([id, { status, note }]) => [
      id,
      note?.trim() ? { status, note: note.trim().slice(0, 200) } : { status },
    ]),
  )
}

/** Records newest first. */
export function byDateDesc<T extends { date: string }>(records: readonly T[]) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))
}
