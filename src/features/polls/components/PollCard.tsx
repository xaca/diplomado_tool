import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Check, Lock, LockOpen, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  castVote,
  deletePoll,
  setPollStatus,
  type Poll,
} from '@/features/polls/api'
import { useMyVote, useVoters } from '@/features/polls/hooks'
import { results } from '@/features/polls/tally'
import { cn } from '@/lib/utils'

type Props = {
  boardId: string
  studentId: string
  poll: Poll
  /** My studentId in this board (students vote; teachers don't) */
  myStudentId: string | null
  /** The board's teacher (moderates, sees voters) */
  teacher: boolean
  myUid: string
  writable: boolean
  /** Names by studentId, to show who voted */
  names?: Map<string, string>
}

/** One poll: vote (one per student, changeable while open) and live results (M16, F20). */
export function PollCard({
  boardId,
  studentId,
  poll,
  myStudentId,
  teacher,
  myUid,
  writable,
  names,
}: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [showVoters, setShowVoters] = useState(false)
  const mine = useMyVote(boardId, studentId, poll.id, myStudentId)
  const author = poll.authorUid === myUid
  const moderator = teacher || author
  const canSeeVoters = teacher || (author && !poll.anonymous)
  const voters = useVoters(
    boardId,
    studentId,
    poll.id,
    canSeeVoters && showVoters,
  )
  const myOption = mine.data?.optionId ?? null
  const open = poll.status === 'open' && writable
  const canVote = open && !!myStudentId
  const showResults = !canVote || !!myOption || moderator
  const { total, options } = results(poll)

  async function act(action: () => Promise<unknown>, done?: string) {
    setBusy(true)
    try {
      await action()
      if (done) toast.success(done)
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border bg-background p-4 text-foreground"
      data-testid="poll"
    >
      <header className="flex flex-wrap items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{poll.question}</h3>
          <p className="text-xs text-muted-foreground">
            {t('polls.by', { name: poll.authorName })} ·{' '}
            {t('polls.votes', { count: total })}
          </p>
        </div>
        {poll.anonymous && (
          <Badge variant="secondary">{t('polls.anonymousTag')}</Badge>
        )}
        <Badge variant={poll.status === 'open' ? 'default' : 'outline'}>
          {poll.status === 'open' ? t('polls.open') : t('polls.closed')}
        </Badge>
      </header>

      <ul className="flex flex-col gap-2">
        {options.map((option) => {
          const chosen = myOption === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={!canVote || busy}
                aria-pressed={chosen}
                onClick={() =>
                  void act(
                    () =>
                      castVote(
                        boardId,
                        studentId,
                        poll,
                        myStudentId!,
                        option.id,
                        myOption,
                      ),
                    t('polls.voted'),
                  )
                }
                className={cn(
                  'relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  canVote && 'hover:bg-muted',
                  chosen && 'border-primary',
                )}
              >
                {showResults && (
                  <span
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-[width] duration-500"
                    style={{ width: `${option.percent}%` }}
                    aria-hidden
                  />
                )}
                <span className="relative flex-1">{option.label}</span>
                {chosen && <Check className="relative size-4" />}
                {showResults && (
                  <span
                    className="relative text-xs text-muted-foreground tabular-nums"
                    data-testid="poll-count"
                  >
                    {option.votes} · {option.percent}%
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {canVote && myOption && (
        <p className="text-xs text-muted-foreground">{t('polls.changeVote')}</p>
      )}

      {(moderator || canSeeVoters) && (
        <footer className="flex flex-wrap items-center gap-2">
          {canSeeVoters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVoters((value) => !value)}
            >
              <Users />
              {t('polls.voters')}
            </Button>
          )}
          {moderator && writable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  setPollStatus(
                    boardId,
                    studentId,
                    poll.id,
                    poll.status === 'open' ? 'closed' : 'open',
                  ),
                )
              }
            >
              {poll.status === 'open' ? <Lock /> : <LockOpen />}
              {poll.status === 'open' ? t('polls.close') : t('polls.reopen')}
            </Button>
          )}
          {moderator && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  deletePoll(boardId, studentId, poll, canSeeVoters),
                )
              }
            >
              <Trash2 />
              {t('polls.delete')}
            </Button>
          )}
        </footer>
      )}
      {showVoters && canSeeVoters && (
        <ul className="flex flex-col gap-1 text-xs" data-testid="poll-voters">
          {voters.data.map((vote) => (
            <li key={vote.id}>
              {names?.get(vote.id) ?? vote.id} →{' '}
              {
                poll.options.find((option) => option.id === vote.optionId)
                  ?.label
              }
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
