import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createPoll } from '@/features/polls/api'
import { PollCard } from '@/features/polls/components/PollCard'
import { usePolls } from '@/features/polls/hooks'
import { MAX_OPEN_POLLS, pollInputSchema } from '@/model'

type Props = {
  boardId: string
  studentId: string
  myStudentId: string | null
  myUid: string
  myName: string
  /** Board teacher: creates on any space, moderates, sees voters */
  teacher: boolean
  /** Owner of this space: creates polls here */
  owner: boolean
  writable: boolean
  names?: Map<string, string>
}

/** The polls of a student's space (M16, D50): list, vote, and "Crear encuesta". */
export function PollsSection({
  boardId,
  studentId,
  myStudentId,
  myUid,
  myName,
  teacher,
  owner,
  writable,
  names,
}: Props) {
  const { t } = useTranslation()
  const polls = usePolls(boardId, studentId)
  const [creating, setCreating] = useState(false)
  const openCount = polls.data.filter((poll) => poll.status === 'open').length
  const canCreate = writable && (owner || teacher)
  if (!canCreate && polls.data.length === 0) return null

  return (
    <section className="flex flex-col gap-3" data-testid="polls">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('polls.title')}</h2>
        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            disabled={openCount >= MAX_OPEN_POLLS}
            title={
              openCount >= MAX_OPEN_POLLS
                ? t('polls.max', { count: MAX_OPEN_POLLS })
                : undefined
            }
            onClick={() => setCreating(true)}
          >
            <Plus />
            {t('polls.create')}
          </Button>
        )}
      </div>
      {[...polls.data]
        .sort((a, b) =>
          a.status === b.status ? 0 : a.status === 'open' ? -1 : 1,
        )
        .map((poll) => (
          <PollCard
            key={poll.id}
            boardId={boardId}
            studentId={studentId}
            poll={poll}
            myStudentId={myStudentId}
            teacher={teacher}
            myUid={myUid}
            writable={writable}
            names={names}
          />
        ))}
      {creating && (
        <CreatePollDialog
          onClose={() => setCreating(false)}
          onCreate={(input) =>
            createPoll(boardId, studentId, input, {
              uid: myUid,
              name: myName,
              role: teacher && !owner ? 'teacher' : 'student',
            }).then(() => toast.success(t('polls.created')))
          }
        />
      )}
    </section>
  )
}

function CreatePollDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: {
    question: string
    options: string[]
    anonymous: boolean
  }) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [anonymous, setAnonymous] = useState(false)
  const lock = useSaveLock()
  const input = {
    question,
    options: options.filter((option) => option.trim()),
    anonymous,
  }
  const valid = pollInputSchema.safeParse(input).success

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            void lock.run(() =>
              onCreate(input)
                .then(onClose)
                .catch(() => toast.error(t('errors.generic'))),
            )
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('polls.create')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="poll-question">{t('polls.question')}</Label>
            <Input
              id="poll-question"
              value={question}
              maxLength={200}
              placeholder={t('polls.questionPlaceholder')}
              onChange={(event) => setQuestion(event.target.value)}
              autoFocus
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {t('polls.options')}
            </legend>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={t('polls.option', { n: index + 1 })}
                  value={option}
                  maxLength={80}
                  onChange={(event) =>
                    setOptions((list) =>
                      list.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('polls.delete')}
                    onClick={() =>
                      setOptions((list) => list.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setOptions((list) => [...list, ''])}
              >
                <Plus />
                {t('polls.addOption')}
              </Button>
            )}
          </fieldset>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={anonymous}
              onCheckedChange={(value) => setAnonymous(value === true)}
            />
            {t('polls.anonymous')}
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <SaveButton type="submit" lock={lock} disabled={!valid}>
              {t('polls.create')}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
