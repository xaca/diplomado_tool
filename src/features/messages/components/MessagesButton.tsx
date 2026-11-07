import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { playChime } from '@/features/announcements/chime'
import { useClassAccess } from '@/features/classes/use-class-access'
import { useConversation, useTeacherUnread } from '@/features/messages/hooks'
import { isUnread, messagesPath } from '@/features/messages/messages'
import { cn } from '@/lib/utils'

/**
 * 💬 next to the 🔔 (M26, D118): a badge with what's new — for the teacher, the conversations
 * with an unread student message; for a student, an unread reply. Something arriving while I'm
 * elsewhere in the app plays the M19 chime and shows a toast. Nothing for people outside the board.
 */
export function MessagesButton({
  boardId,
  tone,
}: {
  boardId: string
  tone?: 'dark' | 'light'
}) {
  const { t } = useTranslation()
  const access = useClassAccess(boardId)
  const location = useLocation()
  const navigate = useNavigate()
  const teacherUnread = useTeacherUnread(boardId, access.teacher)
  const mine = useConversation(
    boardId,
    access.teacher ? null : access.studentId,
  )
  const unread = access.teacher
    ? teacherUnread
    : isUnread(mine.data, 'student')
      ? 1
      : 0

  // A toast + chime when the count goes up while I'm here (not for what was there on arrival)
  const ready = !access.loading && (access.teacher || !mine.loading)
  const previous = useRef<number | null>(null)
  const onMessages = location.pathname.endsWith('/mensajes')
  useEffect(() => {
    if (!ready) return
    const before = previous.current
    previous.current = unread
    if (before === null || unread <= before || onMessages) return
    playChime()
    toast(
      access.teacher
        ? t('messages.newForTeacher')
        : t('messages.newForStudent'),
      {
        icon: '💬',
        action: {
          label: t('messages.open'),
          onClick: () => void navigate(messagesPath(boardId)),
        },
      },
    )
  }, [ready, unread, onMessages, access.teacher, boardId, navigate, t])

  if (!access.allowed) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'relative',
        tone === 'light' && 'text-white hover:bg-white/15 hover:text-white',
      )}
      aria-label={
        unread
          ? t('messages.buttonCount', { count: unread })
          : t('messages.button')
      }
      title={t('messages.button')}
      nativeButton={false}
      render={<Link to={messagesPath(boardId)} />}
      data-testid="messages-button"
    >
      <MessageCircle />
      {unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold text-white"
          data-testid="messages-badge"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Button>
  )
}
