import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveEmailSender } from '@/features/course/api'
import { emailsCollection } from '@/features/mail/send'
import { useLiveQuery } from '@/lib/firestore-hooks'
import { formatRelative, toDate } from '@/lib/time'
import {
  emailSenderSchema,
  type BoardDoc,
  type EmailLogDoc,
  type EmailSender,
} from '@/model'

/** "Configuración de envío" (D107): the name the emails come from, and where replies go */
export function EmailSenderForm({
  boardId,
  board,
  defaultName,
  gmail,
}: {
  boardId: string
  board: BoardDoc
  defaultName: string
  gmail: string
}) {
  const { t } = useTranslation()
  const [sender, setSender] = useState<EmailSender>(
    () => board.emailSender ?? { name: defaultName, replyTo: '' },
  )
  const lock = useSaveLock()
  const valid =
    emailSenderSchema.safeParse(sender).success && !!sender.name.trim()

  function save() {
    return lock.run(async () => {
      try {
        await saveEmailSender(boardId, sender)
        toast.success(t('mail.senderSaved'))
      } catch {
        toast.error(t('errors.generic'))
      }
    })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="sender-form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-sender-name">{t('mail.senderName')}</Label>
          <Input
            id="settings-sender-name"
            maxLength={80}
            value={sender.name}
            onChange={(event) =>
              setSender({ ...sender, name: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settings-sender-reply">{t('mail.replyTo')}</Label>
          <Input
            id="settings-sender-reply"
            type="email"
            placeholder={t('mail.replyToPlaceholder')}
            value={sender.replyTo}
            onChange={(event) =>
              setSender({ ...sender, replyTo: event.target.value.trim() })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('mail.senderHint', { email: gmail })}
      </p>
      <SaveButton
        lock={lock}
        className="w-fit"
        disabled={!valid}
        onClick={() => void save()}
      >
        <Save />
        {t('mail.saveSender')}
      </SaveButton>
    </div>
  )
}

/** What went out from the app, newest first (teacher only) */
export function EmailHistory({ boardId }: { boardId: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const log = useLiveQuery<EmailLogDoc>(
    emailsCollection(boardId),
    `emails:${boardId}`,
  )
  const sorted = useMemo(
    () =>
      [...log.data].sort(
        (a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime(),
      ),
    [log.data],
  )
  if (!sorted.length)
    return (
      <p className="text-sm text-muted-foreground">{t('mail.historyEmpty')}</p>
    )
  return (
    <ul className="flex flex-col gap-2" data-testid="email-history">
      {sorted.slice(0, 30).map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          data-testid="email-log"
        >
          <Badge variant="outline">{t(`mail.kinds.${item.kind}`)}</Badge>
          <span className="min-w-0 flex-1 truncate font-medium">
            {item.subject}
          </span>
          <span className="text-muted-foreground">
            {t('mail.sentCount', { count: item.sent.length })}
          </span>
          {item.failed.length > 0 && (
            <span className="text-destructive" title={item.failed.join(', ')}>
              {t('mail.failedCount', { count: item.failed.length })}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatRelative(toDate(item.createdAt), locale)}
          </span>
        </li>
      ))}
    </ul>
  )
}
