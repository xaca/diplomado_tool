import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { weekdayName } from '@/features/course/course'
import { cn } from '@/lib/utils'
import { WEEKDAYS, type ScheduleSlot, type Weekday } from '@/model'

/**
 * The course's weekly schedule (D111): toggle the class days (L M X J V S D); each one gets its
 * own start / end time and an optional place or meeting link.
 */
export function ScheduleEditor({
  value,
  onChange,
}: {
  value: ScheduleSlot[]
  onChange: (next: ScheduleSlot[]) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const byDay = new Map(value.map((slot) => [slot.day, slot]))
  const sorted = (slots: ScheduleSlot[]) =>
    [...slots].sort((a, b) => a.day - b.day)

  function toggle(day: Weekday) {
    if (byDay.has(day)) onChange(value.filter((slot) => slot.day !== day))
    else {
      // a new day starts with the time of the last one picked (most courses keep one time)
      const like = value.at(-1)
      onChange(
        sorted([
          ...value,
          {
            day,
            start: like?.start ?? '',
            end: like?.end ?? '',
            place: like?.place ?? '',
          },
        ]),
      )
    }
  }

  function edit(day: Weekday, field: 'start' | 'end' | 'place', text: string) {
    onChange(
      value.map((slot) =>
        slot.day === day ? { ...slot, [field]: text } : slot,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="schedule-editor">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={t('course.classDays')}
      >
        {WEEKDAYS.map((day) => (
          <button
            key={day}
            type="button"
            aria-pressed={byDay.has(day)}
            title={weekdayName(day, locale)}
            onClick={() => toggle(day)}
            className={cn(
              'flex size-10 items-center justify-center rounded-full border text-sm font-medium capitalize transition-colors',
              byDay.has(day)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            <span aria-hidden>{weekdayName(day, locale, 'narrow')}</span>
            <span className="sr-only">{weekdayName(day, locale)}</span>
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((slot) => {
            const name = weekdayName(slot.day, locale)
            return (
              <li
                key={slot.day}
                className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2 sm:grid-cols-[6rem_8rem_8rem_1fr]"
                data-testid="schedule-day"
                data-day={slot.day}
              >
                <span className="text-sm font-medium capitalize">{name}</span>
                <Input
                  type="time"
                  aria-label={t('course.startTime', { day: name })}
                  value={slot.start}
                  onChange={(event) =>
                    edit(slot.day, 'start', event.target.value)
                  }
                />
                <Input
                  type="time"
                  aria-label={t('course.endTime', { day: name })}
                  value={slot.end}
                  onChange={(event) =>
                    edit(slot.day, 'end', event.target.value)
                  }
                />
                <Input
                  className="col-span-3 sm:col-span-1"
                  aria-label={t('course.place', { day: name })}
                  placeholder={t('course.placePlaceholder')}
                  maxLength={200}
                  value={slot.place}
                  onChange={(event) =>
                    edit(slot.day, 'place', event.target.value)
                  }
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
