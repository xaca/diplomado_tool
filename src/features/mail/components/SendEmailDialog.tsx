import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Mail, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSaveLock } from '@/components/save/use-save-lock'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { saveEmailSender } from '@/features/course/api'
import { GmailError, type GmailProblem } from '@/features/mail/gmail'
import {
  renderEmail,
  type EmailDraft,
  type EmailFrame,
} from '@/features/mail/message'
import {
  sendToStudents,
  type Recipient,
  type SendResult,
} from '@/features/mail/send'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import type { Student } from '@/features/students/api'
import { preferredEmail } from '@/features/students/emails'
import { useMembers } from '@/features/students/hooks'
import type { WithId } from '@/lib/firestore-hooks'
import {
  emailSenderSchema,
  MAX_EMAIL_RECIPIENTS,
  type BoardDoc,
  type EmailKind,
} from '@/model'
import { useAuth } from '@/providers/auth-context'

export type EmailStart = {
  kind: EmailKind
  subject: string
  title?: string
  body: string
  /** Where the button goes (an app path or https link); default: the board */
  link?: string
  linkLabel?: string
}

/**
 * "Enviar correo" (M24, F34): one email per student from the teacher's Gmail (D100, D101), with
 * the board's sender name and Reply-To (D107). Recipients come ticked (e.g. from Correos' filters);
 * the preview shows the first one's email; then progress, and a retry for the ones that failed.
 */
export function SendEmailDialog({
  boardId,
  board,
  students,
  start,
  only,
  onClose,
}: {
  boardId: string
  board: WithId<BoardDoc>
  students: Student[]
  start: EmailStart
  /** Student ids to send to (default: everyone on the list) */
  only?: readonly string[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const profile = useProfile()
  const members = useMembers(boardId)
  const teacherName = user ? displayNameOf(user, profile.data) : ''
  const [subject, setSubject] = useState(start.subject)
  const [title, setTitle] = useState(start.title ?? '')
  const [body, setBody] = useState(start.body)
  const [sender, setSender] = useState(
    () =>
      board.emailSender ?? {
        name: teacherName ? `${board.title} – ${teacherName}` : board.title,
        replyTo: '',
      },
  )
  const [editingSender, setEditingSender] = useState(!board.emailSender)
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [problem, setProblem] = useState<GmailProblem | null>(null)
  // M27 (D131): a double click must never send the emails twice
  const lock = useSaveLock()

  const pool = useMemo(
    () =>
      (only
        ? students.filter((student) => only.includes(student.id))
        : students
      )
        .map((student) => ({
          studentId: student.id,
          name: student.displayName,
          email: preferredEmail(student, members.data),
        }))
        .filter((recipient) => recipient.email),
    [only, students, members.data],
  )
  const chosen = pool.filter((recipient) => !unticked.has(recipient.studentId))
  const senderValid =
    emailSenderSchema.safeParse(sender).success && !!sender.name.trim()

  const link = start.link ?? `/b/${boardId}`
  const draft: EmailDraft = {
    subject: subject.trim(),
    title: title.trim(),
    body,
    button: {
      url: link.startsWith('/') ? `${window.location.origin}${link}` : link,
      label: start.linkLabel ?? t('mail.openApp'),
    },
  }
  const frame: EmailFrame = {
    greeting: (name) => t('mail.greeting', { name }),
    boardTitle: board.title,
    footer: t('mail.footer', { teacher: teacherName }),
  }
  const preview = chosen[0] ? renderEmail(draft, frame, chosen[0].name) : null
  const ready =
    !!user &&
    senderValid &&
    !!draft.subject &&
    !!body.trim() &&
    chosen.length > 0

  async function send(to: Recipient[]) {
    if (!user) return
    await lock.run(async () => {
      setProblem(null)
      try {
        if (
          JSON.stringify(sender) !== JSON.stringify(board.emailSender ?? null)
        )
          await saveEmailSender(boardId, sender)
        setProgress({ done: 0, total: to.length })
        const outcome = await sendToStudents({
          boardId,
          user,
          sender,
          kind: start.kind,
          draft,
          frame,
          recipients: to,
          onProgress: (done, total) => setProgress({ done, total }),
        })
        setResult((previous) =>
          previous
            ? {
                sent: [...previous.sent, ...outcome.sent],
                failed: outcome.failed,
                problem: outcome.problem,
              }
            : outcome,
        )
        setProblem(outcome.problem)
        if (outcome.sent.length)
          toast.success(t('mail.sentToast', { count: outcome.sent.length }))
      } catch (error) {
        console.error('[mail]', error)
        setProblem(error instanceof GmailError ? error.problem : 'failed')
      } finally {
        setProgress(null)
      }
    })
  }

  const busy = progress !== null

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && !lock.saving && onClose()}
    >
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl"
        data-testid="send-email-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('mail.title')}</DialogTitle>
          <DialogDescription>{t('mail.hint')}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-3" data-testid="send-result">
            <p className="flex items-center gap-2 font-medium">
              <CircleCheck className="size-5 text-emerald-600" />
              {t('mail.sentCount', { count: result.sent.length })}
            </p>
            {result.failed.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
                <p className="font-medium" data-testid="send-failed">
                  {t('mail.failedCount', { count: result.failed.length })}
                </p>
                <ul className="text-xs">
                  {result.failed.map((recipient) => (
                    <li key={recipient.studentId}>
                      {recipient.name} · {recipient.email}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-fit"
                  disabled={busy || lock.saving}
                  onClick={() => void send(result.failed)}
                >
                  <RotateCcw />
                  {t('mail.retry')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <section
              className="flex flex-col gap-2 rounded-lg border p-3 text-sm"
              data-testid="sender"
            >
              {editingSender ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sender-name">{t('mail.senderName')}</Label>
                    <Input
                      id="sender-name"
                      maxLength={80}
                      value={sender.name}
                      onChange={(event) =>
                        setSender({ ...sender, name: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="sender-reply">{t('mail.replyTo')}</Label>
                    <Input
                      id="sender-reply"
                      type="email"
                      placeholder={t('mail.replyToPlaceholder')}
                      value={sender.replyTo}
                      onChange={(event) =>
                        setSender({
                          ...sender,
                          replyTo: event.target.value.trim(),
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    {t('mail.senderHint', { email: user?.email ?? '' })}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {t('mail.from')}: <b>{sender.name}</b> &lt;{user?.email}&gt;
                  </span>
                  {sender.replyTo && (
                    <span>
                      {t('mail.repliesTo')}: <b>{sender.replyTo}</b>
                    </span>
                  )}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setEditingSender(true)}
                  >
                    {t('mail.changeSender')}
                  </button>
                </div>
              )}
            </section>

            <fieldset className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <legend className="font-medium" data-testid="send-count">
                  {t('mail.to', { count: chosen.length })}
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
                      setUnticked(
                        new Set(pool.map((recipient) => recipient.studentId)),
                      )
                    }
                  >
                    {t('emails.selectNone')}
                  </button>
                </span>
              </div>
              <ul className="max-h-36 overflow-y-auto rounded-lg border">
                {pool.map((recipient) => (
                  <li
                    key={recipient.studentId}
                    className="flex items-center gap-2 border-b px-3 py-1 text-sm last:border-b-0"
                  >
                    <Checkbox
                      id={`send-${recipient.studentId}`}
                      checked={!unticked.has(recipient.studentId)}
                      onCheckedChange={(checked) =>
                        setUnticked((current) => {
                          const next = new Set(current)
                          if (checked) next.delete(recipient.studentId)
                          else next.add(recipient.studentId)
                          return next
                        })
                      }
                    />
                    <label
                      htmlFor={`send-${recipient.studentId}`}
                      className="flex min-w-0 flex-1 gap-2"
                    >
                      <span className="truncate">{recipient.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {recipient.email}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {pool.length > MAX_EMAIL_RECIPIENTS && (
                <p className="text-xs text-muted-foreground">
                  {t('mail.tooMany', { max: MAX_EMAIL_RECIPIENTS })}
                </p>
              )}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-subject">{t('mail.subject')}</Label>
              <Input
                id="mail-subject"
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-title">{t('mail.heading')}</Label>
              <Input
                id="mail-title"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-body">{t('mail.body')}</Label>
              <Textarea
                id="mail-body"
                rows={7}
                maxLength={5000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            {preview && (
              <details className="rounded-lg border" data-testid="mail-preview">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                  {t('mail.preview', { name: chosen[0].name })}
                </summary>
                <iframe
                  title={t('mail.previewTitle')}
                  sandbox=""
                  srcDoc={preview.html}
                  className="h-96 w-full rounded-b-lg border-t bg-white"
                />
              </details>
            )}
          </>
        )}

        {problem && (
          <p
            className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
            data-testid="send-problem"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t(`mail.problems.${problem}`)}
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          {busy ? (
            <p
              className="flex items-center gap-2 text-sm"
              data-testid="send-progress"
            >
              <Mail className="size-4 animate-pulse" />
              {t('mail.sending', {
                done: progress.done,
                total: progress.total,
              })}
            </p>
          ) : result ? (
            <Button onClick={onClose}>{t('mail.done')}</Button>
          ) : (
            <>
              <Button
                disabled={!ready || lock.saving}
                onClick={() => void send(chosen)}
              >
                <Send />
                {t('mail.send', { count: chosen.length })}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t('common.cancel')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
