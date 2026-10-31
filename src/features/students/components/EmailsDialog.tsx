import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatClassDate } from '@/features/attendance/attendance'
import { useAttendance } from '@/features/attendance/hooks'
import { useSpaces } from '@/features/spaces/hooks'
import {
  boardStages,
  matchesStage,
  NO_STAGE,
  stageLabel,
} from '@/features/stages/stages'
import type { Student } from '@/features/students/api'
import { emailList, mailtoLinks } from '@/features/students/emails'
import { useMembers } from '@/features/students/hooks'
import { toCsv } from '@/lib/csv'
import { downloadText, slugify } from '@/lib/download'
import type { BoardDoc } from '@/model'

/** "kind:value": all · group:<name> · stage:<id> · ready:yes|no · absent:<date> */
type Filter = string

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * "Correos" (M18, F24, D63–D64): the emails of everyone or a filtered group (group, stage, ready,
 * absent on a date), each student can be unticked; copy, open the teacher's mail app (BCC, split
 * into batches) or CSV. The app never sends email.
 */
export function EmailsDialog({
  boardId,
  board,
  students,
  onClose,
}: {
  boardId: string
  board: BoardDoc
  students: Student[]
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const members = useMembers(boardId)
  const spaces = useSpaces(boardId, null)
  const attendance = useAttendance(boardId)
  const [filter, setFilter] = useState<Filter>('all')
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [all, setAll] = useState(false)

  const stages = boardStages(board)
  const groups = useMemo(
    () =>
      [
        ...new Set(students.map((student) => student.group).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, 'es')),
    [students],
  )
  const absentDays = attendance.data.filter((day) =>
    Object.values(day.marks).some((mark) => mark.status === 'absent'),
  )

  const matching = useMemo(() => {
    const [kind, value] = filter.split(/:(.*)/s)
    const space = new Map(spaces.data.map((card) => [card.id, card]))
    return students.filter((student) => {
      const card = space.get(student.id)
      switch (kind) {
        case 'group':
          return student.group === value
        case 'stage':
          return !!card && matchesStage(card, stages, value)
        case 'ready':
          return (value === 'yes') === !!card?.readyToPresent
        case 'absent':
          return (
            attendance.data.find((day) => day.date === value)?.marks[student.id]
              ?.status === 'absent'
          )
        default:
          return true
      }
    })
  }, [filter, students, spaces.data, stages, attendance.data])

  const chosen = matching.filter((student) => !unticked.has(student.id))
  const emails = emailList(chosen, members.data, { all })
  const links = mailtoLinks(emails)

  function pick(next: Filter) {
    setFilter(next)
    setUnticked(new Set())
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.success(t('emails.copied'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  function csv() {
    downloadText(
      `correos-${slugify(board.title)}.csv`,
      toCsv([
        [t('csv.name'), t('csv.group'), all ? t('csv.emails') : t('csv.email')],
        ...chosen.map((student) => [
          student.displayName,
          student.group,
          emailList([student], members.data, { all }).join(', '),
        ]),
      ]),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
        data-testid="emails-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('emails.title')}</DialogTitle>
          <DialogDescription>{t('emails.hint')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emails-to">{t('emails.to')}</Label>
          <select
            id="emails-to"
            className={selectClass}
            value={filter}
            onChange={(event) => pick(event.target.value)}
          >
            <option value="all">{t('emails.everyone')}</option>
            {groups.length > 0 && (
              <optgroup label={t('emails.byGroup')}>
                {groups.map((group) => (
                  <option key={group} value={`group:${group}`}>
                    {group}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t('emails.byStage')}>
              {stages.map((stage) => (
                <option key={stage.id} value={`stage:${stage.id}`}>
                  {stageLabel(stage, t)}
                </option>
              ))}
              <option value={`stage:${NO_STAGE}`}>{t('stages.none')}</option>
            </optgroup>
            <optgroup label={t('emails.progress')}>
              <option value="ready:yes">{t('emails.ready')}</option>
              <option value="ready:no">{t('emails.notReady')}</option>
            </optgroup>
            {absentDays.length > 0 && (
              <optgroup label={t('emails.absences')}>
                {absentDays.slice(0, 20).map((day) => (
                  <option key={day.date} value={`absent:${day.date}`}>
                    {t('emails.absentOn', {
                      date: formatClassDate(day.date, locale),
                    })}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {matching.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm">{t('emails.none')}</p>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <legend className="font-medium" data-testid="emails-count">
                {t('emails.count', {
                  students: chosen.length,
                  emails: emails.length,
                })}
              </legend>
              <span className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="underline"
                  onClick={() => setUnticked(new Set())}
                >
                  {t('emails.selectAll')}
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() =>
                    setUnticked(new Set(matching.map((student) => student.id)))
                  }
                >
                  {t('emails.selectNone')}
                </button>
              </span>
            </div>
            <ul className="max-h-60 overflow-y-auto rounded-lg border">
              {matching.map((student) => (
                <li
                  key={student.id}
                  className="flex items-center gap-2 border-b px-3 py-1.5 text-sm last:border-b-0"
                >
                  <Checkbox
                    id={`email-${student.id}`}
                    checked={!unticked.has(student.id)}
                    onCheckedChange={(checked) =>
                      setUnticked((current) => {
                        const next = new Set(current)
                        if (checked) next.delete(student.id)
                        else next.add(student.id)
                        return next
                      })
                    }
                  />
                  <label
                    htmlFor={`email-${student.id}`}
                    className="flex min-w-0 flex-1 flex-col"
                  >
                    <span className="truncate">{student.displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {emailList([student], members.data, { all }).join(', ')}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <div className="flex items-center gap-2">
          <Switch id="emails-all" checked={all} onCheckedChange={setAll} />
          <Label htmlFor="emails-all" className="font-normal">
            {t('emails.allAddresses')}
          </Label>
        </div>

        {links.length > 1 && (
          <p className="text-xs text-muted-foreground">
            {t('emails.manyLinks', { total: links.length })}
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button disabled={!emails.length} onClick={() => void copy()}>
            <Copy />
            {t('emails.copy')}
          </Button>
          {links.map((href, index) => (
            <Button
              key={href}
              variant="outline"
              nativeButton={false}
              render={<a href={href} />}
              data-testid="emails-write"
            >
              <Mail />
              {links.length > 1
                ? t('emails.writePart', {
                    part: index + 1,
                    total: links.length,
                  })
                : t('emails.write')}
            </Button>
          ))}
          <Button variant="outline" disabled={!chosen.length} onClick={csv}>
            <Download />
            {t('emails.csv')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
