import type { AttendanceStatus } from '@/model'

/** One color per state, everywhere (taking attendance, the table, the student's view) */
export const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-600 text-white',
  late: 'bg-amber-400 text-amber-950',
  absent: 'bg-rose-600 text-white',
  excused: 'bg-sky-600 text-white',
}
