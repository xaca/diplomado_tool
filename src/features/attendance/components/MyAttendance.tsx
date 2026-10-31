import { useTranslation } from 'react-i18next'
import { ClipboardCheck } from 'lucide-react'
import {
  byDateDesc,
  formatClassDate,
  formatRate,
  studentStats,
} from '@/features/attendance/attendance'
import { STATUS_STYLE } from '@/features/attendance/components/status'
import { useAttendanceSummary } from '@/features/attendance/hooks'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/model'

/**
 * A student's attendance on their space page (M18, D67): only their own (the student and the
 * teacher see it; classmates never), dates and states, no teacher notes. Hidden until a class
 * is recorded.
 */
export function MyAttendance({
  boardId,
  studentId,
  mine,
}: {
  boardId: string
  studentId: string
  mine: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const summary = useAttendanceSummary(boardId, studentId)
  const days = byDateDesc(
    Object.entries(summary.data?.dates ?? {}).map(([date, status]) => ({
      date,
      status: status as AttendanceStatus,
    })),
  )
  if (!days.length) return null
  const { rate } = studentStats(
    days.map(({ date, status }) => ({
      date,
      topic: '',
      marks: { [studentId]: { status } },
    })),
    studentId,
  )

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="my-attendance"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <ClipboardCheck className="size-4" />
        {mine ? t('attendance.mine') : t('attendance.theirs')}
        {rate !== null && (
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {t('attendance.mineRate', { rate: formatRate(rate, locale) })}
          </span>
        )}
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {days.map(({ date, status }) => (
          <li
            key={date}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_STYLE[status],
            )}
          >
            <span className="capitalize">{formatClassDate(date, locale)}</span>
            <span>· {t(`attendance.status.${status}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
