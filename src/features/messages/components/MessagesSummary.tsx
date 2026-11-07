import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { messagesPath } from '@/features/messages/messages'
import { useTeacherInbox } from '@/features/messages/hooks'

/** Administrar → Comunicación: "Mensajes: 2 nuevos · 3 sin responder · Abrir" (M26) */
export function MessagesSummary({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const inbox = useTeacherInbox(boardId)
  return (
    <section
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4"
      data-testid="messages-summary"
    >
      <div>
        <h2 className="flex items-center gap-1 font-semibold">
          <MessageCircle className="size-5" />
          {t('messages.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {inbox.loading
            ? '…'
            : inbox.waiting === 0
              ? t('messages.summaryNone')
              : t('messages.summary', {
                  unread: inbox.unread,
                  count: inbox.waiting,
                })}
        </p>
      </div>
      <Button nativeButton={false} render={<Link to={messagesPath(boardId)} />}>
        {t('messages.open')}
      </Button>
    </section>
  )
}
