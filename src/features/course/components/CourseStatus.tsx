import { useTranslation } from 'react-i18next'
import { CalendarClock, MapPin } from 'lucide-react'
import {
  classNumberOn,
  daysWithoutClass,
  formatDay,
  formatHours,
  hasDates,
  totalClasses,
  type ClassDate,
  type CourseState,
} from '@/features/course/course'
import { cn } from '@/lib/utils'
import type { CourseSetup } from '@/model'

/** The short counter: "Clase 12 de 32", "Última clase", "Curso terminado"… (null = nothing to show) */
function useCounterText(state: CourseState) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { total, given, phase, next } = state
  switch (phase) {
    case 'none':
      return null
    case 'before':
      return next
        ? t('course.startsOn', { date: formatDay(next.date, locale, 'short') })
        : total !== null
          ? t('course.classes', { count: total })
          : null
    case 'last':
      return t('course.lastClass', { given, total })
    case 'finished':
      return t('course.finished')
    default:
      return total !== null
        ? t('course.counter', { given, total })
        : t('course.counterOpen', { given })
  }
}

/** "Clase 12 de 32 · quedan 20" with a progress bar (Administrar, the teacher's home) */
export function ClassCounter({
  state,
  compact = false,
  className,
}: {
  state: CourseState
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const text = useCounterText(state)
  if (!text) return null
  const percent = state.total
    ? Math.min(100, Math.round((state.given / state.total) * 100))
    : null
  if (compact)
    return (
      <span
        className={cn('text-sm tabular-nums', className)}
        data-testid="class-counter"
        title={text}
      >
        {state.total !== null && state.phase !== 'before'
          ? `${state.given} / ${state.total}`
          : text}
      </span>
    )
  return (
    <div
      className={cn('flex flex-col gap-1.5', className)}
      data-testid="class-counter"
    >
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg font-semibold" data-testid="counter-text">
          {text}
        </span>
        {state.phase === 'running' && state.remaining !== null && (
          <span
            className="text-sm text-muted-foreground"
            data-testid="counter-remaining"
          >
            {t('course.remaining', { count: state.remaining })}
          </span>
        )}
        {state.week !== null && state.weeks !== null && (
          <span
            className="text-sm text-muted-foreground"
            data-testid="counter-week"
          >
            · {t('course.week', { week: state.week, weeks: state.weeks })}
          </span>
        )}
      </p>
      {percent !== null && (
        <span
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={state.total ?? 0}
          aria-valuenow={state.given}
          aria-label={text}
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </div>
  )
}

/** "hoy, 6:00 p. m. – 9:00 p. m." or "martes 4 de noviembre, 6:00 p. m. – 9:00 p. m." */
function useClassWhen(day: ClassDate, today: string) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const date =
    day.date === today ? t('course.today') : formatDay(day.date, locale)
  const hours = formatHours(day.start, day.end, locale)
  return hours ? `${date}, ${hours}` : date
}

/** "Próxima clase: martes 4 de noviembre, 6:00 p. m. · Salón 304" */
export function NextClass({
  next,
  today,
  className,
}: {
  next: ClassDate
  today: string
  className?: string
}) {
  const { t } = useTranslation()
  const when = useClassWhen(next, today)
  const link = /^https:\/\//.test(next.place)
  return (
    <p
      className={cn('flex items-start gap-1.5 text-sm', className)}
      data-testid="next-class"
    >
      <CalendarClock className="mt-0.5 size-4 shrink-0" />
      <span>
        {next.date === today ? t('course.todayClass') : t('course.next')}:{' '}
        <span className="font-medium">{when}</span>
        {next.place && (
          <span className="text-muted-foreground">
            {' · '}
            <MapPin className="inline size-3.5 align-[-2px]" />{' '}
            {link ? (
              <a
                href={next.place}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {t('course.joinLink')}
              </a>
            ) : (
              next.place
            )}
          </span>
        )}
      </span>
    </p>
  )
}

/** Under the board's title: "Clase 12 de 32 · Próxima clase: martes 4 nov, 6:00 p. m." */
export function CourseHeaderLine({
  state,
  today,
  showCounter,
}: {
  state: CourseState
  today: string
  showCounter: boolean
}) {
  const { t } = useTranslation()
  const counter = useCounterText(state)
  const next = state.next
  const when = useNextWhen(next, today)
  if (!state.configured || (!showCounter && !next)) return null
  return (
    <p
      className="flex flex-wrap items-center gap-x-2 text-sm opacity-90"
      data-testid="course-line"
    >
      {showCounter && counter && (
        <span className="font-medium" data-testid="course-line-counter">
          {counter}
        </span>
      )}
      {next && (
        <span className="flex items-center gap-1">
          {showCounter && counter && '·'}
          <CalendarClock className="size-4" />
          {next.date === today
            ? t('course.todayClass')
            : t('course.next')}: {when}
        </span>
      )}
    </p>
  )
}

function useNextWhen(next: ClassDate | null, today: string) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  if (!next) return ''
  const date =
    next.date === today
      ? t('course.today')
      : formatDay(next.date, locale, 'short')
  const start = next.start ? formatHours(next.start, '', locale) : ''
  return start ? `${date}, ${start}` : date
}

/** Attendance (M18 + M24): "Clase 13 de 32" on a class day, a warning on a holiday or day off */
export function AttendanceCourseHint({
  course,
  date,
}: {
  course: CourseSetup
  date: string
}) {
  const { t } = useTranslation()
  if (!hasDates(course)) return null
  const off = daysWithoutClass(course).get(date)
  const number = classNumberOn(course, date)
  const total = totalClasses(course)
  if (off !== undefined)
    return (
      <p
        className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
        data-testid="attendance-course"
      >
        {t('course.noClass', { reason: off })}
      </p>
    )
  return (
    <p
      className="text-sm text-muted-foreground"
      data-testid="attendance-course"
    >
      {number === null
        ? t('course.notClassDay')
        : total !== null
          ? t('course.counter', { given: number, total })
          : t('course.counterOpen', { given: number })}
    </p>
  )
}
