import { Fragment, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Send, Trash2 } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { deleteMessage, markRead, sendMessage } from '@/features/messages/api'
import { useConversation, useMessages } from '@/features/messages/hooks'
import {
  cleanText,
  cooldownLeft,
  dayKey,
  dayLabel,
  isUnread,
  seenByOther,
  segments,
} from '@/features/messages/messages'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  MAX_MESSAGE_TEXT,
  MESSAGES_PAGE,
  type MessageDoc,
  type MessageFrom,
} from '@/model'

function MessageText({ text }: { text: string }) {
  return (
    <p className="text-sm break-words whitespace-pre-wrap">
      {segments(text).map((part, index) =>
        'href' in part ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </p>
  )
}

const draftKey = (boardId: string, studentId: string) =>
  `pbl.messages.draft.${boardId}.${studentId}`

function readDraft(key: string) {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function saveDraft(key: string, text: string) {
  try {
    if (text) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    // private window / blocked storage: the draft only lives while the page is open
  }
}

/**
 * One conversation (M26): the student's with the course's teachers. `me` is who is looking. The
 * teacher deletes messages; nobody edits them (D116). Opening it marks it read (D117).
 */
export function MessageThread({
  boardId,
  studentId,
  me,
  uid,
  myName,
  writable,
}: {
  boardId: string
  studentId: string
  me: MessageFrom
  uid: string
  myName: string
  /** The board is active (an archived course is read-only) */
  writable: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const [count, setCount] = useState(MESSAGES_PAGE)
  const conversation = useConversation(boardId, studentId)
  const messages = useMessages(boardId, studentId, count)
  const [deleting, setDeleting] = useState<WithId<MessageDoc> | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // Opening it marks it read; after that only a new message does, and never while it's
  // explicitly marked unread — so the teacher's "Marcar como no leído" isn't undone on screen
  const unread = isUnread(conversation.data, me)
  const lastId = conversation.data?.lastMessageId
  const readAt =
    me === 'student'
      ? conversation.data?.studentReadAt
      : conversation.data?.teacherReadAt
  const markedFor = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!lastId) return
    const first = markedFor.current === undefined
    if (!first && (markedFor.current === lastId || readAt === null)) return
    markedFor.current = lastId
    if (!unread) return
    markRead(boardId, studentId, me).catch((error) =>
      console.error('[messages] not marked read', error),
    )
  }, [unread, lastId, readAt, boardId, studentId, me])

  // Keep the newest message in view
  const newest = messages.data.at(-1)?.id
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' })
  }, [newest])

  const lastMine = [...messages.data].reverse().find((m) => m.from === me)

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="message-thread">
      <div className="flex min-h-64 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {messages.more && (
          <Button
            variant="ghost"
            size="sm"
            className="self-center"
            onClick={() => setCount((current) => current + MESSAGES_PAGE)}
          >
            {t('messages.older')}
          </Button>
        )}
        {messages.loading ? (
          <Skeleton className="h-24" />
        ) : messages.data.length === 0 ? (
          <p
            className="m-auto max-w-sm text-center text-sm text-muted-foreground"
            data-testid="no-messages"
          >
            {me === 'student'
              ? t('messages.emptyStudent')
              : t('messages.emptyTeacher')}
          </p>
        ) : (
          messages.data.map((message, index) => {
            const date = toDate(message.createdAt)
            const previous = messages.data[index - 1]
            const newDay =
              !previous || dayKey(toDate(previous.createdAt)) !== dayKey(date)
            const mine = message.from === me
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <p className="my-1 self-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {dayLabel(date, locale)}
                  </p>
                )}
                <div
                  className={cn(
                    'group flex max-w-[85%] flex-col gap-0.5',
                    mine ? 'items-end self-end' : 'items-start self-start',
                  )}
                  data-testid="message"
                  data-from={message.from}
                >
                  <span className="px-1 text-xs text-muted-foreground">
                    {message.authorName}
                    {message.from === 'teacher' && (
                      <span className="ml-1 rounded bg-foreground px-1 text-[10px] font-semibold text-background">
                        {t('messages.teacherBadge')}
                      </span>
                    )}
                    {' · '}
                    {date.toLocaleTimeString(locale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <div
                    className={cn(
                      'flex items-center gap-1',
                      mine && 'flex-row-reverse',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2',
                        mine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted',
                      )}
                    >
                      <MessageText text={message.text} />
                    </div>
                    {me === 'teacher' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-60 group-hover:opacity-100"
                        aria-label={t('messages.delete')}
                        title={t('messages.delete')}
                        onClick={() => setDeleting(message)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {lastMine?.id === message.id &&
                    seenByOther(conversation.data, me, message.createdAt) && (
                      <span
                        className="flex items-center gap-0.5 px-1 text-xs text-muted-foreground"
                        data-testid="seen"
                      >
                        <Check className="size-3" />
                        {t('messages.seen')}
                      </span>
                    )}
                </div>
              </Fragment>
            )
          })
        )}
        <div ref={bottom} />
      </div>

      <Composer
        boardId={boardId}
        studentId={studentId}
        me={me}
        uid={uid}
        myName={myName}
        exists={!!conversation.data}
        ready={!conversation.loading}
        cooldown={() => cooldownLeft(conversation.data)}
        writable={writable}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleting) return
                deleteMessage(boardId, studentId, deleting.id).catch(
                  (error) => {
                    console.error('[messages] not deleted', error)
                    toast.error(t('errors.generic'))
                  },
                )
              }}
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Composer({
  boardId,
  studentId,
  me,
  uid,
  myName,
  exists,
  ready,
  cooldown,
  writable,
}: {
  boardId: string
  studentId: string
  me: MessageFrom
  uid: string
  myName: string
  exists: boolean
  /** The conversation has loaded: until then we can't tell a new one from an existing one */
  ready: boolean
  cooldown: () => number
  writable: boolean
}) {
  const { t } = useTranslation()
  const key = draftKey(boardId, studentId)
  const [text, setText] = useState(() => readDraft(key))
  const [sending, setSending] = useState(false)
  // Enter pressed before the conversation loaded: send as soon as it has
  const [queued, setQueued] = useState(false)
  // the latest render's send (it knows whether the conversation exists)
  const latestSend = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    latestSend.current = send
  })
  useEffect(() => {
    if (ready && queued) void latestSend.current()
  }, [ready, queued])

  // Another conversation opened: its own draft
  const [forKey, setForKey] = useState(key)
  if (forKey !== key) {
    setForKey(key)
    setText(readDraft(key))
  }

  if (!writable)
    return (
      <p className="border-t p-3 text-sm text-muted-foreground">
        {t('messages.readOnly')}
      </p>
    )

  async function send() {
    const clean = cleanText(text)
    if (!clean || sending) return
    if (!ready) {
      setQueued(true)
      return
    }
    setQueued(false)
    const wait = cooldown()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    setSending(true)
    try {
      await sendMessage(boardId, studentId, {
        from: me,
        uid,
        name: myName,
        text: clean,
        exists,
      })
      setText('')
      saveDraft(key, '')
    } catch (error) {
      console.error('[messages] not sent', error)
      toast.error(t('messages.notSent'))
    } finally {
      setSending(false)
    }
  }

  const tooLong = text.trim().length > MAX_MESSAGE_TEXT
  return (
    <form
      className="flex flex-col gap-1 border-t p-3"
      onSubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      {me === 'student' && (
        <p className="text-xs text-muted-foreground">
          {t('messages.privacyHint')}
        </p>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          rows={2}
          maxLength={MAX_MESSAGE_TEXT + 100}
          placeholder={t('messages.placeholder')}
          aria-label={t('messages.placeholder')}
          className="max-h-40 min-h-10 flex-1 resize-none"
          onChange={(event) => {
            setText(event.target.value)
            saveDraft(key, event.target.value)
          }}
          onKeyDown={(event) => {
            // Enter sends; Shift + Enter is a new line
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || queued || !cleanText(text)}
          aria-label={t('messages.send')}
          title={t('messages.send')}
        >
          <Send />
        </Button>
      </div>
      {text.length > 900 && (
        <p
          className={cn(
            'self-end text-xs',
            tooLong ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {text.trim().length} / {MAX_MESSAGE_TEXT}
        </p>
      )}
    </form>
  )
}
