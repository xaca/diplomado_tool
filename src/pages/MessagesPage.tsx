import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, MailOpen, MessageCircle, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useClassAccess } from '@/features/classes/use-class-access'
import { deleteConversation, markUnread } from '@/features/messages/api'
import { MessageThread } from '@/features/messages/components/MessageThread'
import { useConversations } from '@/features/messages/hooks'
import {
  isUnread,
  isWaiting,
  sortConversations,
} from '@/features/messages/messages'
import { useSpaces } from '@/features/spaces/hooks'
import { formatRelative, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'

/**
 * Mensajes (M26): a student's private conversation with the course's teachers. The student sees
 * theirs; the teacher sees every conversation (unread first, then waiting for a reply) and can
 * start one with any student (D115).
 */
export function MessagesPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  if (access.loading || !access.uid)
    return (
      <section className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <Skeleton className="h-96" />
      </section>
    )

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {access.board.data?.title}
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          <MessageCircle className="mr-1 inline size-6" />
          {access.teacher ? t('messages.title') : t('messages.titleStudent')}
        </h1>
      </div>
      {access.teacher ? (
        <TeacherInbox
          boardId={boardId}
          uid={access.uid}
          name={access.name}
          writable={access.writableBoard}
        />
      ) : (
        access.studentId && (
          <div className="flex h-[70vh] min-h-96 flex-col rounded-xl border">
            <MessageThread
              boardId={boardId}
              studentId={access.studentId}
              me="student"
              uid={access.uid}
              myName={access.name}
              writable={access.writableBoard}
            />
          </div>
        )
      )}
    </section>
  )
}

function TeacherInbox({
  boardId,
  uid,
  name,
  writable,
}: {
  boardId: string
  uid: string
  name: string
  writable: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const [params, setParams] = useSearchParams()
  const selected = params.get('s')
  const conversations = useConversations(boardId, true)
  const spaces = useSpaces(boardId, null)
  const [search, setSearch] = useState('')
  // the conversation being deleted (kept so the dialog's title has the name while it closes)
  const [removing, setRemoving] = useState<string | null>(null)

  const names = useMemo(
    () => new Map(spaces.data.map((space) => [space.id, space.ownerName])),
    [spaces.data],
  )
  const nameOf = (studentId: string) =>
    names.get(studentId) ?? t('messages.formerStudent')
  const query = search.trim().toLocaleLowerCase()
  const list = sortConversations(conversations.data).filter(
    (item) => !query || nameOf(item.id).toLocaleLowerCase().includes(query),
  )
  // Students without a conversation yet, to start one ("Escribir a…")
  const others = spaces.data.filter(
    (space) => !conversations.data.some((item) => item.id === space.id),
  )
  const current = conversations.data.find((item) => item.id === selected)
  const open = (studentId: string | null) =>
    setParams(studentId ? { s: studentId } : {}, { replace: true })

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-xl border md:grid-cols-[18rem_1fr]">
      <aside
        className={cn(
          'flex min-h-0 flex-col border-r',
          selected && 'hidden md:flex',
        )}
        data-testid="conversation-list"
      >
        <div className="flex flex-col gap-2 border-b p-3">
          <Input
            value={search}
            placeholder={t('messages.search')}
            aria-label={t('messages.search')}
            onChange={(event) => setSearch(event.target.value)}
          />
          {others.length > 0 && writable && (
            <select
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              aria-label={t('messages.writeTo')}
              value=""
              onChange={(event) =>
                event.target.value && open(event.target.value)
              }
              data-testid="write-to"
            >
              <option value="">{t('messages.writeTo')}</option>
              {others.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.ownerName}
                </option>
              ))}
            </select>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto">
          {conversations.loading ? (
            <li className="p-3">
              <Skeleton className="h-16" />
            </li>
          ) : list.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">
              {t('messages.noConversations')}
            </li>
          ) : (
            list.map((item) => {
              const unread = isUnread(item, 'teacher')
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left hover:bg-muted/60',
                      item.id === selected && 'bg-muted',
                    )}
                    onClick={() => open(item.id)}
                    data-testid="conversation"
                    data-student={item.id}
                    data-unread={unread}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex-1 truncate',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {nameOf(item.id)}
                      </span>
                      {unread && (
                        <span
                          className="size-2 rounded-full bg-destructive"
                          aria-label={t('messages.unread')}
                        />
                      )}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {item.lastFrom === 'teacher' && `${t('messages.you')}: `}
                      {item.lastText}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatRelative(toDate(item.lastMessageAt), locale)}
                      {isWaiting(item) && (
                        <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                          {t('messages.waiting')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      <div
        className={cn('flex min-h-0 flex-col', !selected && 'hidden md:flex')}
      >
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b p-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label={t('messages.back')}
                onClick={() => open(null)}
              >
                <ArrowLeft />
              </Button>
              <p
                className="flex-1 truncate font-semibold"
                data-testid="thread-name"
              >
                {nameOf(selected)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link to={`/b/${boardId}/s/${selected}`} />}
              >
                <Eye />
                {t('messages.viewSpace')}
              </Button>
              {current && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      open(null)
                      markUnread(boardId, selected).catch(() =>
                        toast.error(t('errors.generic')),
                      )
                    }}
                  >
                    <MailOpen />
                    {t('messages.markUnread')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selected && setRemoving(selected)}
                  >
                    <Trash2 />
                    {t('messages.deleteConversation')}
                  </Button>
                </>
              )}
            </div>
            <MessageThread
              key={selected}
              boardId={boardId}
              studentId={selected}
              me="teacher"
              uid={uid}
              myName={name}
              writable={writable}
            />
          </>
        ) : (
          <p className="m-auto p-6 text-sm text-muted-foreground">
            {t('messages.pick')}
          </p>
        )}
      </div>

      <AlertDialog
        open={!!removing}
        onOpenChange={(isOpen) => !isOpen && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('messages.deleteConversationTitle', {
                name: removing ? nameOf(removing) : '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.deleteConversationHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const studentId = removing
                setRemoving(null)
                if (!studentId) return
                if (studentId === selected) open(null)
                deleteConversation(boardId, studentId).catch((error) => {
                  console.error('[messages] conversation not deleted', error)
                  toast.error(t('errors.generic'))
                })
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
