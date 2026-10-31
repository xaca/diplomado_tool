import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { saveAttendance } from '@/features/attendance/api'
import {
  countMarks,
  formatClassDate,
  formatRate,
  studentStats,
} from '@/features/attendance/attendance'
import { STATUS_STYLE } from '@/features/attendance/components/status'
import type { Student } from '@/features/students/api'
import { toCsv } from '@/lib/csv'
import { downloadText, slugify } from '@/lib/download'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import {
  ATTENDANCE_STATUSES,
  type AttendanceDoc,
  type AttendanceStatus,
} from '@/model'

const NONE = 'none'

/**
 * Attendance arranged by date (M18, F25, D68): the class dates (newest first) with their counts,
 * and a students × dates table (oldest → newest) with each student's rate; any cell can be fixed
 * from the table; CSV for the university's records.
 */
export function AttendanceHistory({
  boardId,
  boardTitle,
  records,
  students,
  groups,
  onOpen,
}: {
  boardId: string
  boardTitle: string
  /** newest first */
  records: WithId<AttendanceDoc>[]
  students: Student[]
  groups: string[]
  onOpen: (date: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const [group, setGroup] = useState('')
  const roster = students.map((student) => student.id)
  const shown = students.filter((student) => !group || student.group === group)
  const columns = [...records].reverse()

  async function setMark(
    record: WithId<AttendanceDoc>,
    studentId: string,
    status: AttendanceStatus | null,
  ) {
    const marks = { ...record.marks }
    if (status) marks[studentId] = { ...marks[studentId], status }
    else delete marks[studentId]
    try {
      await saveAttendance(
        boardId,
        { date: record.date, topic: record.topic, marks },
        record.marks,
      )
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  function exportCsv() {
    downloadText(
      `asistencia-${slugify(boardTitle)}.csv`,
      toCsv([
        [
          t('csv.name'),
          t('csv.group'),
          t('csv.email'),
          ...columns.map((record) => record.date),
          t('attendance.rate'),
        ],
        [t('csv.topic'), '', '', ...columns.map((record) => record.topic), ''],
        ...shown.map((student) => {
          const { rate } = studentStats(records, student.id)
          return [
            student.displayName,
            student.group,
            student.emails[0] ?? '',
            ...columns.map((record) => {
              const status = record.marks[student.id]?.status
              return status ? t(`attendance.status.${status}`) : ''
            }),
            rate === null ? '' : Math.round(rate * 100),
          ]
        }),
      ]),
      'text/csv;charset=utf-8',
    )
  }

  if (!records.length)
    return (
      <p className="rounded-lg bg-muted p-4 text-sm">
        {t('attendance.noDays')}
      </p>
    )

  return (
    <div className="flex flex-col gap-6" data-testid="attendance-history">
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">
          {t('attendance.classes', { count: records.length })}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record) => {
            const counts = countMarks(record.marks, roster)
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => onOpen(record.date)}
                  className="flex w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  data-testid="attendance-day"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">
                      {formatClassDate(record.date, locale)}
                    </span>
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </span>
                  {record.topic && (
                    <span className="truncate text-sm text-muted-foreground">
                      {record.topic}
                    </span>
                  )}
                  <span className="flex flex-wrap gap-1">
                    {ATTENDANCE_STATUSES.filter((status) => counts[status]).map(
                      (status) => (
                        <span
                          key={status}
                          className={cn(
                            'rounded-full px-2 text-xs font-medium',
                            STATUS_STYLE[status],
                          )}
                        >
                          {t(`attendance.short.${status}`)} {counts[status]}
                        </span>
                      ),
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {ATTENDANCE_STATUSES.map((status) => (
              <span key={status} className="flex items-center gap-1">
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded font-semibold',
                    STATUS_STYLE[status],
                  )}
                >
                  {t(`attendance.short.${status}`)}
                </span>
                {t(`attendance.status.${status}`)}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {groups.length > 0 && (
              <select
                aria-label={t('attendance.group')}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
              >
                <option value="">{t('attendance.allGroups')}</option>
                {groups.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download />
              {t('attendance.exportCsv')}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table
            className="w-full border-collapse text-sm"
            data-testid="attendance-table"
          >
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                  {t('attendance.student')}
                </th>
                {columns.map((record) => (
                  <th
                    key={record.id}
                    scope="col"
                    title={record.topic || undefined}
                    className="px-1 py-2 text-center text-xs font-medium whitespace-nowrap capitalize"
                  >
                    {formatClassDate(record.date, locale)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {t('attendance.rate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((student) => {
                const { rate } = studentStats(records, student.id)
                return (
                  <tr key={student.id} className="border-b last:border-b-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-48 truncate bg-background px-3 py-1.5 text-left font-normal"
                    >
                      {student.displayName}
                    </th>
                    {columns.map((record) => {
                      const status = record.marks[student.id]?.status
                      return (
                        <td key={record.id} className="px-1 py-1 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`${student.displayName} · ${formatClassDate(record.date, locale)}: ${status ? t(`attendance.status.${status}`) : t('attendance.clear')}`}
                              className={cn(
                                'mx-auto flex size-7 items-center justify-center rounded text-xs font-semibold transition hover:ring-2 hover:ring-ring/40',
                                status
                                  ? STATUS_STYLE[status]
                                  : 'border border-dashed text-muted-foreground',
                              )}
                              data-testid="attendance-cell"
                            >
                              {status ? t(`attendance.short.${status}`) : '·'}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="center"
                              className="w-40"
                            >
                              <DropdownMenuRadioGroup
                                value={status ?? NONE}
                                onValueChange={(next) =>
                                  void setMark(
                                    record,
                                    student.id,
                                    next === NONE
                                      ? null
                                      : (next as AttendanceStatus),
                                  )
                                }
                              >
                                {ATTENDANCE_STATUSES.map((option) => (
                                  <DropdownMenuRadioItem
                                    key={option}
                                    value={option}
                                  >
                                    {t(`attendance.status.${option}`)}
                                  </DropdownMenuRadioItem>
                                ))}
                                <DropdownMenuRadioItem value={NONE}>
                                  {t('attendance.clear')}
                                </DropdownMenuRadioItem>
                              </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )
                    })}
                    <td
                      className="px-3 py-1.5 text-right font-medium tabular-nums"
                      data-testid="attendance-rate"
                    >
                      {rate === null ? '—' : formatRate(rate, locale)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
