import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { localDate } from '@/features/attendance/attendance'
import { AttendanceHistory } from '@/features/attendance/components/AttendanceHistory'
import { TakeAttendance } from '@/features/attendance/components/TakeAttendance'
import { useAttendance } from '@/features/attendance/hooks'
import { useBoard } from '@/features/boards/hooks'
import { AttendanceCourseHint } from '@/features/course/components/CourseStatus'
import { useStudents } from '@/features/students/hooks'
import { cn } from '@/lib/utils'

/** Attendance by date (M18, F25): take it for a class date, or see the history. Teacher only. */
export function AttendancePage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const board = useBoard(boardId)
  const students = useStudents(boardId)
  const records = useAttendance(boardId)
  const [search, setSearch] = useSearchParams()
  const tab = search.get('tab') === 'history' ? 'history' : 'take'
  const [date, setDate] = useState(() => localDate())
  const groups = useMemo(
    () =>
      [
        ...new Set(
          students.data.map((student) => student.group).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'es')),
    [students.data],
  )

  if (board.loading) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </section>
    )
  }
  if (!board.data || !boardId) {
    return (
      <section className="mx-auto max-w-5xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const openTab = (next: 'take' | 'history') =>
    setSearch(next === 'history' ? { tab: 'history' } : {}, { replace: true })

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <Link
          to={`/teacher/boards/${boardId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {board.data.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold">
            {t('attendance.title')}
          </h1>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/b/${boardId}`} />}
          >
            <ExternalLink />
            {t('boards.open')}
          </Button>
        </div>
        <div
          role="tablist"
          className="flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm"
        >
          {(['take', 'history'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => openTab(id)}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium transition-colors',
                tab === id
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`attendance.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {students.loading || records.loading ? (
        <Skeleton className="h-60" />
      ) : tab === 'take' ? (
        <>
          {board.data.course && (
            <AttendanceCourseHint course={board.data.course} date={date} />
          )}
          <TakeAttendance
            key={date}
            boardId={boardId}
            date={date}
            onDate={setDate}
            record={records.data.find((record) => record.date === date)}
            students={students.data}
            groups={groups}
          />
        </>
      ) : (
        <AttendanceHistory
          boardId={boardId}
          boardTitle={board.data.title}
          records={records.data}
          students={students.data}
          groups={groups}
          onOpen={(day) => {
            setDate(day)
            openTab('take')
          }}
        />
      )}
    </section>
  )
}
