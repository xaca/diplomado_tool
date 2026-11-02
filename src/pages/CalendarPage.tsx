import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminTabPath } from '@/features/boards/admin-tabs'
import { BoardSections } from '@/features/classes/components/BoardSections'
import { useClassAccess } from '@/features/classes/use-class-access'
import {
  CourseCalendar,
  ScheduleSummary,
} from '@/features/course/components/CourseCalendar'
import {
  ClassCounter,
  NextClass,
} from '@/features/course/components/CourseStatus'
import {
  useCourseState,
  useHeldDates,
  useNews,
  useNow,
} from '@/features/course/hooks'

/**
 * "Calendario" (M24, D105): where the course stands ("Semana 5 de 16 · Clase 12 de 32"), the next
 * class, the schedule, and the weeks with classes, holidays, days off and news.
 */
export function CalendarPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  const course = access.board.data?.course ?? null
  const held = useHeldDates(boardId, course, access.teacher)
  const state = useCourseState(course, held)
  const now = useNow()
  const news = useNews(boardId, access.allowed)

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const showCounter = access.teacher || course?.showCounter !== false
  const empty = !state.configured && news.data.length === 0

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <BoardSections boardId={boardId} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {access.board.data?.title}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            📅 {t('course.calendar')}
          </h1>
        </div>
        {access.teacher && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={adminTabPath(boardId, 'course')} />}
          >
            <Settings />
            {t('course.manage')}
          </Button>
        )}
      </div>

      {access.loading || news.loading ? (
        <Skeleton className="h-96" />
      ) : empty ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"
          data-testid="no-calendar"
        >
          {access.teacher ? t('course.emptyTeacher') : t('course.empty')}
        </p>
      ) : (
        <>
          {(state.configured || state.next) && (
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              {showCounter && <ClassCounter state={state} />}
              {state.next && <NextClass next={state.next} today={now.date} />}
              {course && <ScheduleSummary course={course} />}
            </div>
          )}
          <CourseCalendar course={course} news={news.data} today={now.date} />
        </>
      )}
    </section>
  )
}
