import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Bell, ExternalLink, Megaphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  arrivals,
  dismissKey,
  inbox,
  isAppLink,
  mayChime,
  unreadCount,
  windowQueue,
} from '@/features/announcements/announcements'
import { markAnnouncements } from '@/features/announcements/api'
import { isMuted, playChime, setMuted } from '@/features/announcements/chime'
import {
  useAnnouncements,
  useAnnouncementState,
} from '@/features/announcements/hooks'
import { useMyStudentId } from '@/features/spaces/hooks'
import type { WithId } from '@/lib/firestore-hooks'
import { formatRelative, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { AnnouncementDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

function AnnouncementLink({ link }: { link: string }) {
  const { t } = useTranslation()
  if (!link) return null
  return isAppLink(link) ? (
    <Button size="sm" nativeButton={false} render={<Link to={link} />}>
      {t('announcements.open')}
    </Button>
  ) : (
    <Button
      size="sm"
      nativeButton={false}
      render={<a href={link} target="_blank" rel="noopener noreferrer" />}
    >
      <ExternalLink />
      {t('announcements.open')}
    </Button>
  )
}

/**
 * Students' 🔔 (M19, D61–D62, D79): the board's announcements, "Nuevo" until opened, then
 * "Leído", kept until the student removes them (or the teacher deletes them). A new one plays a
 * chime; an important one also opens a window. Nothing for people who aren't members.
 */
export function NotificationBell({ boardId }: { boardId: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { user } = useAuth()
  const me = useMyStudentId(boardId)
  const member = !!me.studentId
  const list = useAnnouncements(boardId, member)
  const state = useAnnouncementState(boardId, member ? user?.uid : undefined)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const [muted, setMutedState] = useState(isMuted)

  const items = useMemo(
    () => inbox(list.data, state.data),
    [list.data, state.data],
  )
  const unread = unreadCount(items)
  const queue = windowQueue(items, dismissed)
  const ids = useMemo(
    () => new Set(list.data.map((item) => item.id)),
    [list.data],
  )

  // A chime when something new arrives while I'm here (not for what was there on arrival)
  const newKeys = items
    .filter((item) => item.status === 'new')
    .map((item) => dismissKey(item.announcement))
    .join('|')
  const previous = useRef<Set<string> | null>(null)
  const lastChime = useRef<number | null>(null)
  const ready = member && !list.loading && !state.loading
  useEffect(() => {
    if (!ready) return
    const next = new Set(newKeys ? newKeys.split('|') : [])
    const arrived = arrivals(previous.current, next)
    previous.current = next
    if (arrived.length && mayChime(lastChime.current, Date.now())) {
      lastChime.current = Date.now()
      playChime()
    }
  }, [ready, newKeys])

  if (!member || !user) return null

  function mark(kind: 'read' | 'removed', targets: string[]) {
    if (!targets.length || !user) return
    markAnnouncements(boardId, user.uid, kind, targets, state.data, ids).catch(
      (error) => console.error('[announcements] not marked', error),
    )
  }

  function expand(item: WithId<AnnouncementDoc>, status: 'new' | 'read') {
    setExpanded((current) => (current === item.id ? null : item.id))
    if (status === 'new') mark('read', [item.id])
  }

  const current = queue[0]
  const windowOpen = !open && !!current

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={
          unread
            ? t('announcements.bellCount', { count: unread })
            : t('announcements.bell')
        }
        title={t('announcements.bell')}
        onClick={() => setOpen(true)}
        data-testid="notification-bell"
      >
        <Bell
          className={cn(unread > 0 && 'animate-[wiggle_1s_ease-in-out_2]')}
        />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] leading-4 font-bold text-white"
            data-testid="bell-badge"
          >
            {unread}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
          data-testid="notifications"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4" />
              {t('announcements.title')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('announcements.bell')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 text-sm">
            <Label className="flex items-center gap-2 font-normal">
              <Switch
                checked={muted}
                onCheckedChange={(next) => {
                  setMuted(next)
                  setMutedState(next)
                }}
              />
              {t('announcements.mute')}
            </Label>
            {items.some((item) => item.status === 'read') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  mark(
                    'removed',
                    items
                      .filter((item) => item.status === 'read')
                      .map((item) => item.announcement.id),
                  )
                }
              >
                {t('announcements.removeRead')}
              </Button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm">
              {t('announcements.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map(({ announcement, status }) => {
                const isOpen = expanded === announcement.id
                return (
                  <li
                    key={announcement.id}
                    className={cn(
                      'rounded-xl border p-3 text-sm',
                      status === 'new' && 'border-rose-200 bg-rose-50/60',
                    )}
                    data-testid="notification"
                    data-status={status}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                        aria-expanded={isOpen}
                        onClick={() => expand(announcement, status)}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full px-1.5 text-[10px] font-semibold uppercase',
                              status === 'new'
                                ? 'bg-rose-600 text-white'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {status === 'new'
                              ? t('announcements.new')
                              : t('announcements.read')}
                          </span>
                          <span className="font-medium">
                            {announcement.title}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('announcements.from', {
                            name: announcement.authorName,
                            when: formatRelative(
                              toDate(announcement.remindedAt),
                              locale,
                            ),
                          })}
                        </span>
                        {!isOpen && announcement.body && (
                          <span className="line-clamp-1 text-muted-foreground">
                            {announcement.body}
                          </span>
                        )}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${t('announcements.remove')}: ${announcement.title}`}
                        title={t('announcements.remove')}
                        onClick={() => mark('removed', [announcement.id])}
                      >
                        <X />
                      </Button>
                    </div>
                    {isOpen && (
                      <div className="mt-2 flex flex-col items-start gap-2">
                        {announcement.body && (
                          <p className="whitespace-pre-line">
                            {announcement.body}
                          </p>
                        )}
                        <AnnouncementLink link={announcement.link} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Important ones open a window (D61); several = pages, oldest first */}
      <Dialog
        open={windowOpen}
        onOpenChange={(next) => {
          if (next || !current) return
          setDismissed((closed) => new Set([...closed, dismissKey(current)]))
        }}
      >
        {current && (
          <DialogContent data-testid="announcement-window">
            <DialogHeader>
              <p className="flex items-center gap-2 text-xs font-medium text-rose-700">
                <Megaphone className="size-3.5" />
                {t('announcements.importantBadge')}
                {queue.length > 1 &&
                  ` · ${t('announcements.page', { page: 1, total: queue.length })}`}
              </p>
              <DialogTitle className="text-xl">{current.title}</DialogTitle>
              <DialogDescription>
                {t('announcements.from', {
                  name: current.authorName,
                  when: formatRelative(toDate(current.remindedAt), locale),
                })}
              </DialogDescription>
            </DialogHeader>
            {current.body && (
              <p className="whitespace-pre-line">{current.body}</p>
            )}
            <DialogFooter className="gap-2">
              <AnnouncementLink link={current.link} />
              <Button
                variant={current.link ? 'outline' : 'default'}
                onClick={() => {
                  mark('read', [current.id])
                  setDismissed(
                    (closed) => new Set([...closed, dismissKey(current)]),
                  )
                }}
              >
                {t('announcements.gotIt')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
