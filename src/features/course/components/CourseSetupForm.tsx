import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRightLeft,
  CalendarPlus,
  CalendarX,
  Copy,
  Flag,
  Minus,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTeacherBoards } from '@/features/boards/hooks'
import { loadHolidays, saveCourse } from '@/features/course/api'
import { ClassCounter } from '@/features/course/components/CourseStatus'
import { ScheduleEditor } from '@/features/course/components/ScheduleEditor'
import {
  classDates,
  copySetup,
  courseState,
  courseWeeks,
  datesSummary,
  formatDay,
  formatHours,
  hasDates,
  holidayRange,
  weekdayOf,
} from '@/features/course/course'
import { useNow } from '@/features/course/hooks'
import type { WithId } from '@/lib/firestore-hooks'
import {
  courseSetupSchema,
  emptyCourse,
  MAX_COURSE_TOTAL,
  MAX_COURSE_WEEKS,
  type BoardDoc,
  type CourseSetup,
} from '@/model'

const selectClass =
  'h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function Section({
  title,
  hint,
  children,
  testId,
}: {
  title: string
  hint?: string
  children: ReactNode
  testId?: string
}) {
  return (
    <section
      className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0"
      data-testid={testId}
    >
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

const intOrNull = (text: string) => {
  const value = Number.parseInt(text, 10)
  return Number.isFinite(value) ? value : null
}

/**
 * "Configuración del curso" (M24, D110–D112): one form, every field optional. Start + end (or
 * weeks) + the schedule's days give the class dates and the total; holidays and days off are
 * taken out, one-off classes added; without dates, a typed total. Remount it (key) after saving.
 */
export function CourseSetupForm({
  boardId,
  board,
  held,
}: {
  boardId: string
  board: WithId<BoardDoc>
  held?: readonly string[]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const now = useNow()
  const [draft, setDraft] = useState<CourseSetup>(
    () => board.course ?? emptyCourse(),
  )
  const [endMode, setEndMode] = useState<'date' | 'weeks'>(
    board.course?.weeks ? 'weeks' : 'date',
  )
  const lock = useSaveLock()
  const [loadingHolidays, setLoadingHolidays] = useState(false)
  const [dayOff, setDayOff] = useState({ date: '', reason: '' })
  const [move, setMove] = useState({ from: '', to: '', start: '', end: '' })
  const [extra, setExtra] = useState({ date: '', start: '', end: '', note: '' })
  const teacherBoards = useTeacherBoards()

  const set = (fields: Partial<CourseSetup>) =>
    setDraft((current) => ({ ...current, ...fields }))
  const parsed = courseSetupSchema.safeParse(draft)
  const summary = datesSummary(draft)
  const dated = hasDates(draft)
  const state = useMemo(() => courseState(draft, now, held), [draft, now, held])
  const dates = useMemo(() => classDates(draft), [draft])
  const weeks = useMemo(() => courseWeeks(draft), [draft])
  const others = teacherBoards.data.filter(
    (other) => other.id !== boardId && other.course,
  )
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(board.course ?? emptyCourse())

  function save(next: CourseSetup | null, done: string) {
    return lock.run(async () => {
      try {
        await saveCourse(boardId, next)
        toast.success(done)
      } catch {
        toast.error(t('errors.generic'))
      }
    })
  }

  async function fillHolidays(setup: CourseSetup) {
    const range = holidayRange(setup)
    if (!range) return
    setLoadingHolidays(true)
    try {
      const holidays = await loadHolidays('CO', range.from, range.to)
      setDraft((current) => ({ ...current, holidayCountry: 'CO', holidays }))
      toast.success(t('course.holidaysLoaded', { count: holidays.length }))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setLoadingHolidays(false)
    }
  }

  function copyFrom(id: string) {
    const source = others.find((other) => other.id === id)?.course
    if (!source) return
    const copy = copySetup(source, draft.start)
    setDraft(copy)
    setEndMode(copy.weeks ? 'weeks' : 'date')
    toast.success(t('course.copied'))
    if (copy.holidayCountry && copy.start) void fillHolidays(copy)
  }

  function addDayOff() {
    if (!dayOff.date) return
    set({
      daysOff: [
        ...draft.daysOff.filter((day) => day.date !== dayOff.date),
        dayOff,
      ].sort((a, b) => a.date.localeCompare(b.date)),
    })
    setDayOff({ date: '', reason: '' })
  }

  function moveClass() {
    const from = dates.find((day) => day.date === move.from)
    if (!from || !move.to) return
    set({
      daysOff: [
        ...draft.daysOff.filter((day) => day.date !== from.date),
        {
          date: from.date,
          reason: t('course.movedTo', {
            date: formatDay(move.to, locale, 'short'),
          }),
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
      extras: [
        ...draft.extras.filter(
          (day) => day.date !== move.to && day.date !== from.date,
        ),
        {
          date: move.to,
          start: move.start || from.start,
          end: move.end || from.end,
          place: from.place,
          note: t('course.movedFrom', {
            date: formatDay(from.date, locale, 'short'),
          }),
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    })
    setMove({ from: '', to: '', start: '', end: '' })
  }

  function addExtra() {
    if (!extra.date) return
    set({
      extras: [
        ...draft.extras.filter((day) => day.date !== extra.date),
        { ...extra, place: '' },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    })
    setExtra({ date: '', start: '', end: '', note: '' })
  }

  return (
    <div className="flex flex-col gap-4" data-testid="course-setup">
      <p className="text-sm text-muted-foreground">{t('course.setupHint')}</p>

      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Copy className="size-4 text-muted-foreground" />
          <Label htmlFor="course-copy" className="font-normal">
            {t('course.copyFrom')}
          </Label>
          <select
            id="course-copy"
            className={selectClass}
            value=""
            onChange={(event) => copyFrom(event.target.value)}
          >
            <option value="">{t('course.copyPick')}</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {other.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <Section title={t('course.datesTitle')} hint={t('course.datesHint')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-start">{t('course.start')}</Label>
            <Input
              id="course-start"
              type="date"
              value={draft.start ?? ''}
              onChange={(event) => set({ start: event.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-end-mode">{t('course.endMode')}</Label>
            <select
              id="course-end-mode"
              className={selectClass}
              value={endMode}
              onChange={(event) => {
                const mode = event.target.value as 'date' | 'weeks'
                setEndMode(mode)
                set(mode === 'date' ? { weeks: null } : { end: null })
              }}
            >
              <option value="date">{t('course.endByDate')}</option>
              <option value="weeks">{t('course.endByWeeks')}</option>
            </select>
          </div>
          {endMode === 'date' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-end">{t('course.end')}</Label>
              <Input
                id="course-end"
                type="date"
                min={draft.start ?? undefined}
                value={draft.end ?? ''}
                onChange={(event) => set({ end: event.target.value || null })}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="course-weeks">{t('course.weeks')}</Label>
              <Input
                id="course-weeks"
                type="number"
                min={1}
                max={MAX_COURSE_WEEKS}
                value={draft.weeks ?? ''}
                onChange={(event) =>
                  set({ weeks: intOrNull(event.target.value) })
                }
              />
            </div>
          )}
        </div>
        {draft.start && draft.end && draft.end < draft.start && (
          <p className="text-sm text-destructive" role="alert">
            {t('course.endBeforeStart')}
          </p>
        )}
      </Section>

      <Section
        title={t('course.scheduleTitle')}
        hint={t('course.scheduleHint')}
      >
        <ScheduleEditor
          value={draft.schedule}
          onChange={(schedule) => set({ schedule })}
        />
      </Section>

      <Section title={t('course.totalTitle')} testId="course-total">
        {summary ? (
          <p
            className="rounded-lg bg-muted px-3 py-2 text-sm"
            data-testid="dates-summary"
          >
            {summary.first && summary.last
              ? t('course.summary', {
                  count: summary.total,
                  first: formatDay(summary.first, locale),
                  last: formatDay(summary.last, locale),
                })
              : t('course.summaryNone')}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="course-total-input">{t('course.total')}</Label>
            <Input
              id="course-total-input"
              type="number"
              className="w-32"
              min={1}
              max={MAX_COURSE_TOTAL}
              value={draft.total ?? ''}
              onChange={(event) =>
                set({ total: intOrNull(event.target.value) })
              }
            />
            <p className="text-sm text-muted-foreground">
              {dated ? t('course.totalHintOpen') : t('course.totalHint')}
            </p>
          </div>
        )}
      </Section>

      <Section
        title={t('course.holidaysTitle')}
        hint={t('course.holidaysHint')}
        testId="course-holidays"
      >
        <div>
          <Button
            variant="outline"
            disabled={!draft.start || loadingHolidays}
            onClick={() => void fillHolidays(draft)}
          >
            <Flag />
            {draft.holidays.length
              ? t('course.reloadHolidays')
              : t('course.loadHolidays')}
          </Button>
          {!draft.start && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('course.holidaysNeedStart')}
            </p>
          )}
        </div>
        {draft.holidays.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {draft.holidays.map((holiday) => (
              <li key={holiday.date} data-testid="holiday">
                <Badge
                  variant={
                    dated &&
                    draft.schedule.some(
                      (slot) => slot.day === weekdayOf(holiday.date),
                    )
                      ? 'default'
                      : 'outline'
                  }
                  className="gap-1 pr-0.5"
                >
                  {formatDay(holiday.date, locale, 'short')} · {holiday.name}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-black/10"
                    aria-label={t('course.removeHoliday', {
                      name: holiday.name,
                    })}
                    onClick={() =>
                      set({
                        holidays: draft.holidays.filter(
                          (day) => day.date !== holiday.date,
                        ),
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t('course.daysOffTitle')}
        hint={t('course.daysOffHint')}
        testId="course-days-off"
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-off-date">{t('course.date')}</Label>
            <Input
              id="day-off-date"
              type="date"
              value={dayOff.date}
              onChange={(event) =>
                setDayOff({ ...dayOff, date: event.target.value })
              }
            />
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="day-off-reason">{t('course.reason')}</Label>
            <Input
              id="day-off-reason"
              maxLength={120}
              placeholder={t('course.reasonPlaceholder')}
              value={dayOff.reason}
              onChange={(event) =>
                setDayOff({ ...dayOff, reason: event.target.value })
              }
            />
          </div>
          <Button variant="outline" disabled={!dayOff.date} onClick={addDayOff}>
            <CalendarX />
            {t('course.addDayOff')}
          </Button>
        </div>
        {draft.daysOff.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {draft.daysOff.map((day) => (
              <li
                key={day.date}
                className="flex items-center gap-2"
                data-testid="day-off"
              >
                <span className="font-medium">
                  {formatDay(day.date, locale, 'short')}
                </span>
                <span className="text-muted-foreground">{day.reason}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t('course.remove')}
                  onClick={() =>
                    set({
                      daysOff: draft.daysOff.filter(
                        (item) => item.date !== day.date,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t('course.changesTitle')}
        hint={t('course.changesHint')}
        testId="course-changes"
      >
        {dated && (
          <div
            className="flex flex-wrap items-end gap-2"
            data-testid="move-class"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="move-from">{t('course.moveFrom')}</Label>
              <select
                id="move-from"
                className={selectClass}
                value={move.from}
                onChange={(event) =>
                  setMove({ ...move, from: event.target.value })
                }
              >
                <option value="">{t('course.pickClass')}</option>
                {dates
                  .filter((day) => !day.extra && day.date >= now.date)
                  .slice(0, 60)
                  .map((day) => (
                    <option key={day.date} value={day.date}>
                      {formatDay(day.date, locale, 'short')}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="move-to">{t('course.moveTo')}</Label>
              <Input
                id="move-to"
                type="date"
                value={move.to}
                onChange={(event) =>
                  setMove({ ...move, to: event.target.value })
                }
              />
            </div>
            <Input
              type="time"
              className="w-28"
              aria-label={t('course.startTimePlain')}
              value={move.start}
              onChange={(event) =>
                setMove({ ...move, start: event.target.value })
              }
            />
            <Input
              type="time"
              className="w-28"
              aria-label={t('course.endTimePlain')}
              value={move.end}
              onChange={(event) =>
                setMove({ ...move, end: event.target.value })
              }
            />
            <Button
              variant="outline"
              disabled={!move.from || !move.to}
              onClick={moveClass}
            >
              <ArrowRightLeft />
              {t('course.moveClass')}
            </Button>
          </div>
        )}
        <div
          className="flex flex-wrap items-end gap-2"
          data-testid="extra-class"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra-date">{t('course.extraDate')}</Label>
            <Input
              id="extra-date"
              type="date"
              value={extra.date}
              onChange={(event) =>
                setExtra({ ...extra, date: event.target.value })
              }
            />
          </div>
          <Input
            type="time"
            className="w-28"
            aria-label={t('course.startTimePlain')}
            value={extra.start}
            onChange={(event) =>
              setExtra({ ...extra, start: event.target.value })
            }
          />
          <Input
            type="time"
            className="w-28"
            aria-label={t('course.endTimePlain')}
            value={extra.end}
            onChange={(event) =>
              setExtra({ ...extra, end: event.target.value })
            }
          />
          <Input
            className="min-w-40 flex-1"
            aria-label={t('course.note')}
            placeholder={t('course.notePlaceholder')}
            maxLength={120}
            value={extra.note}
            onChange={(event) =>
              setExtra({ ...extra, note: event.target.value })
            }
          />
          <Button variant="outline" disabled={!extra.date} onClick={addExtra}>
            <CalendarPlus />
            {t('course.addExtra')}
          </Button>
        </div>
        {draft.extras.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {draft.extras.map((day) => (
              <li
                key={day.date}
                className="flex flex-wrap items-center gap-2"
                data-testid="extra"
              >
                <span className="font-medium">
                  {formatDay(day.date, locale, 'short')}
                </span>
                <span>{formatHours(day.start, day.end, locale)}</span>
                <span className="text-muted-foreground">{day.note}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t('course.remove')}
                  onClick={() =>
                    set({
                      extras: draft.extras.filter(
                        (item) => item.date !== day.date,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {weeks.length > 0 && (
        <Section title={t('course.topicsTitle')} hint={t('course.topicsHint')}>
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              {t('course.weeksCount', { count: weeks.length })}
            </summary>
            <ol className="mt-2 flex flex-col gap-1.5">
              {weeks.map((week) => (
                <li
                  key={week.number}
                  className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm"
                >
                  <span>
                    {t('course.weekN', { week: week.number })}{' '}
                    <span className="text-xs text-muted-foreground">
                      {formatDay(week.start, locale, 'short')}
                    </span>
                  </span>
                  <Input
                    aria-label={t('course.topicOf', { week: week.number })}
                    maxLength={80}
                    value={draft.topics[String(week.number)] ?? ''}
                    onChange={(event) => {
                      const topics = { ...draft.topics }
                      if (event.target.value)
                        topics[String(week.number)] = event.target.value
                      else delete topics[String(week.number)]
                      set({ topics })
                    }}
                  />
                </li>
              ))}
            </ol>
          </details>
        </Section>
      )}

      <Section title={t('course.counterTitle')} testId="course-counter">
        {state.configured ? (
          <ClassCounter state={state} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('course.counterNone')}
          </p>
        )}
        {state.configured && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t('course.correction')}</span>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={t('course.correctionMinus')}
              onClick={() => set({ correction: draft.correction - 1 })}
            >
              <Minus />
            </Button>
            <span
              className="w-8 text-center tabular-nums"
              data-testid="correction"
            >
              {draft.correction > 0 ? `+${draft.correction}` : draft.correction}
            </span>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={t('course.correctionPlus')}
              onClick={() => set({ correction: draft.correction + 1 })}
            >
              <Plus />
            </Button>
            <span className="text-xs text-muted-foreground">
              {dated ? t('course.givenFromDates') : t('course.givenFromHeld')}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="course-show-counter"
            checked={draft.showCounter}
            onCheckedChange={(showCounter) => set({ showCounter })}
          />
          <Label htmlFor="course-show-counter" className="font-normal">
            {t('course.showCounter')}
          </Label>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t bg-card px-1 py-3">
        <SaveButton
          lock={lock}
          disabled={!parsed.success || !dirty}
          onClick={() =>
            parsed.success && void save(parsed.data, t('course.saved'))
          }
        >
          <Save />
          {t('course.save')}
        </SaveButton>
        {dirty && (
          <span className="text-sm text-muted-foreground">
            {t('course.unsaved')}
          </span>
        )}
        {board.course && (
          <Button
            variant="ghost"
            className="ml-auto text-destructive"
            disabled={lock.saving}
            onClick={() => {
              if (lock.isLocked()) return
              if (window.confirm(t('course.clearConfirm')))
                void save(null, t('course.cleared'))
            }}
          >
            <Trash2 />
            {t('course.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
