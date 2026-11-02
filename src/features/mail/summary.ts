import type { TFunction } from 'i18next'
import {
  classesGiven,
  formatDay,
  formatHours,
  totalClasses,
  weekSummary,
} from '@/features/course/course'
import type { EmailStart } from '@/features/mail/components/SendEmailDialog'
import type { WithId } from '@/lib/firestore-hooks'
import type { BoardDoc, NewsDoc } from '@/model'

/** "Resumen de la semana" (D102): this week's classes, days without class, news and the counter */
export function weeklySummaryEmail(
  t: TFunction,
  locale: string,
  boardId: string,
  board: BoardDoc,
  news: WithId<NewsDoc>[],
  today: string,
): EmailStart {
  const course = board.course ?? null
  const summary = weekSummary(course, news, today)
  const total = course ? totalClasses(course) : null
  const range = `${formatDay(summary.from, locale, 'short')} – ${formatDay(summary.to, locale, 'short')}`
  const lines: string[] = []
  if (summary.week !== null)
    lines.push(
      [t('course.weekN', { week: summary.week }), summary.topic]
        .filter(Boolean)
        .join(' · ') + ` (${range})`,
    )
  if (summary.classes.length) {
    lines.push(
      [
        t('mail.summaryClasses'),
        ...summary.classes.map((day) =>
          [
            `• ${t('course.classN', { n: day.number })}: ${formatDay(day.date, locale)}`,
            formatHours(day.start, day.end, locale),
            day.place,
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      ].join('\n'),
    )
  } else lines.push(t('mail.summaryNoClasses'))
  if (summary.off.length)
    lines.push(
      [
        t('mail.summaryOff'),
        ...summary.off.map(
          (day) => `• ${formatDay(day.date, locale)}: ${day.label}`,
        ),
      ].join('\n'),
    )
  if (summary.news.length)
    lines.push(
      [
        t('mail.summaryNews'),
        ...summary.news.map(
          (item) =>
            `• ${t(`course.kinds.${item.kind}`)} · ${item.title} (${formatDay(item.date, locale, 'short')})` +
            (item.link ? `\n  ${item.link}` : ''),
        ),
      ].join('\n'),
    )
  if (course && total !== null) {
    const given = classesGiven(course, summary.to)
    lines.push(
      t('mail.summaryCounter', {
        given,
        total,
        left: Math.max(0, total - given),
      }),
    )
  }
  return {
    kind: 'summary',
    subject: t('mail.summarySubject', { board: board.title, range }),
    title: t('mail.summaryTitle'),
    body: lines.join('\n\n'),
    link: `/b/${boardId}/calendario`,
    linkLabel: t('mail.openCalendar'),
  }
}
