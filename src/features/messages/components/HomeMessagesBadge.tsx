import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTeacherUnread } from '@/features/messages/hooks'

/** "3 mensajes nuevos" on a course card of the teacher's home (M26, D118) */
export function HomeMessagesBadge({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const unread = useTeacherUnread(boardId)
  if (!unread) return null
  return (
    <Badge variant="destructive" data-testid="home-messages">
      <MessageCircle className="mr-1 size-3" />
      {t('messages.homeBadge', { count: unread })}
    </Badge>
  )
}
