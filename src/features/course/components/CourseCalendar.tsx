import { useTranslation } from 'react-i18next'
import { CalendarX, ExternalLink, Flag, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  classDates,
  courseWeeks,
  formatDay,
  formatHours,
  weekOf,
  weekdayName,
  type ClassDate,
} from '@/features/course/course'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import type { CourseSetup, NewsDoc, NewsKind } from '@/model'

const KIND_STYLE: Record<NewsKind, string> = {
  deliverable: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100',
  event: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100',
  notice: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
}

/** "Martes 6:00 p. m. – 9:00 p. m. · Salón 304" for each day of the schedule */
export function ScheduleSummary({ course }: { course: CourseSetup }) {
  const { i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  if (!course.schedule.length) return null
  return (
    <ul
      className="flex flex-col gap-0.5 text-sm"
      data-testid="schedule-summary"
    >
      {course.schedule.map((slot) => (
        <li key={slot.day} className="flex flex-wrap gap-x-1.5">
          <span className="font-medium capitalize">
            {weekdayName(slot.day, locale)}
          </span>
          <span>{formatHours(slot.start, slot.end, locale)}</span>
          {slot.place && <PlaceText place={slot.place} />}
        </li>
      ))}
    </ul>
  )
}

function PlaceText({ place }: { place: string }) {
  const { t } = useTranslation()
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      · <MapPin className="size-3.5" />
      {/^https:\/\//.test(place) ? (
        <a href={place} target="_blank" rel="noreferrer" className="underline">
          {t('course.joinLink')}
        </a>
      ) : (
        place
      )}
    </span>
  )
}

export function NewsItem({ item }: { item: WithId<NewsDoc> }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  return (
    <li
      className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2"
      data-testid="news-item"
    >
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium',
            KIND_STYLE[item.kind],
          )}
        >
          {t(`course.kinds.${item.kind}`)}
        </span>
        <span className="font-medium">{item.title}</span>
        <span className="text-xs text-muted-foreground">
          {item.wholeWeek
            ? t('course.thisWeek')
            : formatDay(item.date, locale, 'short')}
        </span>
      </span>
      {item.text && (
        <span className="text-sm whitespace-pre-line">{item.text}</span>
      )}
      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit items-center gap-1 text-sm underline"
        >
          <ExternalLink className="size-3.5" />
          {t('course.openLink')}
        </a>
      )}
    </li>
  )
}

function ClassRow({
  day,
  number,
  today,
}: {
  day: ClassDate
  number: number
  today: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-2 text-sm',
        day.date < today && 'text-muted-foreground',
      )}
      data-testid="calendar-class"
      data-date={day.date}
    >
      <span className="w-16 text-xs tabular-nums">
        {t('course.classN', { n: number })}
      </span>
      <span className={cn('capitalize', day.date === today && 'font-semibold')}>
        {formatDay(day.date, locale, 'short')}
      </span>
      <span>{formatHours(day.start, day.end, locale)}</span>
      {day.date === today && <Badge>{t('course.today')}</Badge>}
      {day.extra && day.note && <Badge variant="outline">{day.note}</Badge>}
      {day.place && <PlaceText place={day.place} />}
    </li>
  )
}

function DayWithout({
  date,
  label,
  holiday,
}: {
  date: string
  label: string
  holiday: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  return (
    <li
      className="flex flex-wrap items-center gap-x-2 text-sm text-amber-800 dark:text-amber-300"
      data-testid="no-class"
    >
      {holiday ? (
        <Flag className="size-3.5" />
      ) : (
        <CalendarX className="size-3.5" />
      )}
      <span className="capitalize">{formatDay(date, locale, 'short')}</span>
      <span>
        {holiday
          ? t('course.noClassHoliday', { name: label })
          : t('course.noClass', { reason: label })}
      </span>
    </li>
  )
}

/**
 * The course's calendar (M24, D105): with weeks, Semana 1 … N (the current one open, past ones
 * folded) with their classes, holidays, days off and news; without weeks, classes and news by date.
 */
export function CourseCalendar({
  course,
  news,
  today,
}: {
  course: CourseSetup | null
  news: WithId<NewsDoc>[]
  today: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const weeks = course ? courseWeeks(course) : []
  const all = course ? classDates(course) : []
  const numberOf = new Map(all.map((day, index) => [day.date, index + 1]))
  const current = course ? weekOf(course, today) : null

  if (!weeks.length) {
    const upcoming = news.filter((item) => item.date >= today)
    const past = news.filter((item) => item.date < today)
    return (
      <div className="flex flex-col gap-4" data-testid="course-calendar">
        {all.length > 0 && (
          <ol className="flex flex-col gap-1">
            {all.slice(0, 60).map((day) => (
              <ClassRow
                key={day.date}
                day={day}
                number={numberOf.get(day.date) ?? 0}
                today={today}
              />
            ))}
          </ol>
        )}
        {upcoming.length > 0 && (
          <ul className="flex flex-col gap-2">
            {upcoming.map((item) => (
              <NewsItem key={item.id} item={item} />
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              {t('course.pastNews', { count: past.length })}
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {past.map((item) => (
                <NewsItem key={item.id} item={item} />
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  const outside = news.filter(
    (item) =>
      item.date < weeks[0].start || item.date > (weeks.at(-1)?.end ?? ''),
  )
  return (
    <div className="flex flex-col gap-3" data-testid="course-calendar">
      <ol className="flex flex-col gap-3">
        {weeks.map((week) => {
          const items = news.filter(
            (item) => item.date >= week.start && item.date <= week.end,
          )
          const past = week.end < today
          const body = (
            <div className="flex flex-col gap-2 pt-2">
              {week.classes.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {week.classes.map((day) => (
                    <ClassRow
                      key={day.date}
                      day={day}
                      number={numberOf.get(day.date) ?? 0}
                      today={today}
                    />
                  ))}
                </ol>
              )}
              {(week.holidays.length > 0 || week.daysOff.length > 0) && (
                <ul className="flex flex-col gap-1">
                  {week.holidays.map((day) => (
                    <DayWithout
                      key={day.date}
                      date={day.date}
                      label={day.name}
                      holiday
                    />
                  ))}
                  {week.daysOff.map((day) => (
                    <DayWithout
                      key={day.date}
                      date={day.date}
                      label={day.reason}
                      holiday={false}
                    />
                  ))}
                </ul>
              )}
              {items.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {items.map((item) => (
                    <NewsItem key={item.id} item={item} />
                  ))}
                </ul>
              )}
              {!week.classes.length &&
                !items.length &&
                !week.holidays.length &&
                !week.daysOff.length && (
                  <p className="text-sm text-muted-foreground">
                    {t('course.noClassesThisWeek')}
                  </p>
                )}
            </div>
          )
          const title = (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">
                {t('course.weekN', { week: week.number })}
              </span>
              {week.topic && <span>· {week.topic}</span>}
              <span className="text-xs text-muted-foreground">
                {formatDay(week.start, locale, 'short')} –{' '}
                {formatDay(week.end, locale, 'short')}
              </span>
              {week.number === current && (
                <Badge>{t('course.currentWeek')}</Badge>
              )}
            </span>
          )
          return (
            <li
              key={week.number}
              className={cn(
                'rounded-xl border bg-card p-3',
                week.number === current && 'border-primary ring-1 ring-primary',
              )}
              data-testid="calendar-week"
              data-week={week.number}
            >
              {past ? (
                <details>
                  <summary className="cursor-pointer">{title}</summary>
                  {body}
                </details>
              ) : (
                <>
                  {title}
                  {body}
                </>
              )}
            </li>
          )
        })}
      </ol>
      {outside.length > 0 && (
        <ul className="flex flex-col gap-2">
          {outside.map((item) => (
            <NewsItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}
