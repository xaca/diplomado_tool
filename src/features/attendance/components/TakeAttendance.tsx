import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCheck, MessageSquare, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteAttendanceDay, saveAttendance } from '@/features/attendance/api'
import {
  countMarks,
  formatClassDate,
  markEveryone,
  sameMarks,
} from '@/features/attendance/attendance'
import { STATUS_STYLE } from '@/features/attendance/components/status'
import type { Student } from '@/features/students/api'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import {
  ATTENDANCE_STATUSES,
  type AttendanceDoc,
  type AttendanceMark,
} from '@/model'

/**
 * Taking attendance for one class date (M18, F25): one tap per student (Presente · Tarde ·
 * Ausente · Excusa, tap again to clear), "Todos presentes" to start from, an optional note per
 * student and topic. Nothing is written until "Guardar" (the page warns before leaving).
 * Mount it with `key={date}`: the draft starts from that day's record.
 */
export function TakeAttendance({
  boardId,
  date,
  onDate,
  record,
  students,
  groups,
}: {
  boardId: string
  date: string
  onDate: (date: string) => void
  record: WithId<AttendanceDoc> | undefined
  students: Student[]
  groups: string[]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const saved = record?.marks ?? {}
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(saved)
  const [topic, setTopic] = useState(record?.topic ?? '')
  const [group, setGroup] = useState('')
  const [notesOpen, setNotesOpen] = useState<ReadonlySet<string>>(
    () => new Set(Object.keys(saved).filter((id) => saved[id].note)),
  )
  const lock = useSaveLock()
  const removeLock = useSaveLock()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty =
    !sameMarks(marks, saved) || topic.trim() !== (record?.topic ?? '')
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const shown = students.filter((student) => !group || student.group === group)
  const roster = students.map((student) => student.id)
  const counts = countMarks(marks, roster)
  const unmarked = roster.filter((id) => !marks[id]).length

  function mark(id: string, status: AttendanceMark['status']) {
    setMarks((current) => {
      const next = { ...current }
      if (next[id]?.status === status) delete next[id]
      else next[id] = { ...next[id], status }
      return next
    })
  }

  function save() {
    return lock.run(async () => {
      try {
        // Marks of students no longer on the roster are left as they were
        await saveAttendance(boardId, { date, topic, marks }, saved)
        toast.success(t('attendance.saved'))
      } catch {
        toast.error(t('errors.generic'))
      }
    })
  }

  function remove() {
    return removeLock.run(async () => {
      setConfirmDelete(false)
      if (!record) return
      try {
        await deleteAttendanceDay(boardId, record)
        setMarks({})
        setTopic('')
        toast.success(t('attendance.deleted'))
      } catch {
        toast.error(t('errors.generic'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4" data-testid="take-attendance">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-date">{t('attendance.date')}</Label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            className="w-auto"
            onChange={(event) => {
              const next = event.target.value
              if (!next || next === date) return
              if (dirty && !window.confirm(t('attendance.unsaved'))) return
              onDate(next)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-topic">{t('attendance.topic')}</Label>
          <Input
            id="attendance-topic"
            value={topic}
            maxLength={120}
            placeholder={t('attendance.topicPlaceholder')}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ATTENDANCE_STATUSES.map((status) => (
          <span
            key={status}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              STATUS_STYLE[status],
            )}
            data-testid={`count-${status}`}
          >
            {t(`attendance.status.${status}`)} {counts[status]}
          </span>
        ))}
        <span className="text-xs text-muted-foreground">
          {t('attendance.unmarked', { count: unmarked })}
        </span>
        <div className="ml-auto flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            disabled={unmarked === 0}
            onClick={() =>
              setMarks((current) =>
                markEveryone(
                  current,
                  shown.map((student) => student.id),
                ),
              )
            }
          >
            <CheckCheck />
            {t('attendance.everyonePresent')}
          </Button>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg bg-muted p-4 text-sm">
          {t('attendance.noStudents')}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {shown.map((student) => {
            const current = marks[student.id]
            const noteOpen = notesOpen.has(student.id)
            return (
              <li
                key={student.id}
                className="flex flex-col gap-2 px-3 py-2"
                data-testid="attendance-row"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {student.displayName}
                    </p>
                    {student.group && (
                      <p className="truncate text-xs text-muted-foreground">
                        {student.group}
                      </p>
                    )}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={t('attendance.markFor', {
                      name: student.displayName,
                    })}
                    className="flex gap-1"
                  >
                    {ATTENDANCE_STATUSES.map((status) => {
                      const on = current?.status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={t(`attendance.status.${status}`)}
                          title={t(`attendance.status.${status}`)}
                          onClick={() => mark(student.id, status)}
                          className={cn(
                            'flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold transition-[transform,colors] active:scale-95 motion-reduce:transition-none',
                            on
                              ? cn('border-transparent', STATUS_STYLE[status])
                              : 'bg-background text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <span className="md:hidden">
                            {t(`attendance.short.${status}`)}
                          </span>
                          <span className="hidden md:inline">
                            {t(`attendance.status.${status}`)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('attendance.note', {
                      name: student.displayName,
                    })}
                    aria-expanded={noteOpen}
                    disabled={!current}
                    className={cn(current?.note && 'text-foreground')}
                    onClick={() =>
                      setNotesOpen((open) => {
                        const next = new Set(open)
                        if (next.has(student.id)) next.delete(student.id)
                        else next.add(student.id)
                        return next
                      })
                    }
                  >
                    <MessageSquare />
                  </Button>
                </div>
                {noteOpen && current && (
                  <Input
                    aria-label={t('attendance.note', {
                      name: student.displayName,
                    })}
                    value={current.note ?? ''}
                    maxLength={200}
                    placeholder={t('attendance.notePlaceholder')}
                    onChange={(event) =>
                      setMarks((all) => ({
                        ...all,
                        [student.id]: { ...current, note: event.target.value },
                      }))
                    }
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <span
          className={cn(
            'text-sm',
            dirty ? 'font-medium text-amber-700' : 'text-muted-foreground',
          )}
          data-testid="attendance-state"
        >
          {dirty ? t('attendance.unsaved') : t('attendance.upToDate')}
        </span>
        {record && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
            {t('attendance.deleteDay')}
          </Button>
        )}
        <SaveButton
          lock={lock}
          className="ml-auto"
          disabled={!dirty}
          onClick={() => void save()}
        >
          <Save />
          {t('attendance.save')}
        </SaveButton>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('attendance.deleteDayTitle', {
                date: formatClassDate(date, locale),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('attendance.deleteDayBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeLock.saving}
              onClick={() => void remove()}
            >
              {t('attendance.deleteDay')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
