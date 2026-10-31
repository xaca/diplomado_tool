import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BellRing, Megaphone, Pencil, Trash2 } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { readCount } from '@/features/announcements/announcements'
import {
  createAnnouncement,
  deleteAnnouncement,
  remindAnnouncement,
  updateAnnouncement,
} from '@/features/announcements/api'
import {
  useAnnouncements,
  useAnnouncementStates,
} from '@/features/announcements/hooks'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { normalizeEmail } from '@/lib/collections'
import type { WithId } from '@/lib/firestore-hooks'
import { formatRelative, toDate } from '@/lib/time'
import {
  announcementInputSchema,
  type AnnouncementDoc,
  type AnnouncementInput,
} from '@/model'
import { useAuth } from '@/providers/auth-context'

const EMPTY: AnnouncementInput = {
  title: '',
  body: '',
  link: '',
  important: true,
}

/**
 * The teacher's "Anuncios" (M19, D59–D60, D80): write an announcement (title, message, optional
 * link, "Importante" = a window for students), see how many students read each one, and remind,
 * edit or delete them. `members` = students who joined (for "12 de 17 leyeron").
 */
export function AnnouncementsPanel({
  boardId,
  members,
  onClose,
}: {
  boardId: string
  members: number
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { user } = useAuth()
  const profile = useProfile()
  const list = useAnnouncements(boardId)
  const states = useAnnouncementStates(boardId, true)
  const [form, setForm] = useState<AnnouncementInput>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<WithId<AnnouncementDoc> | null>(null)
  const valid = announcementInputSchema.safeParse(form).success
  const author = {
    email: normalizeEmail(user?.email ?? ''),
    name: user ? displayNameOf(user, profile.data) : '',
  }
  const sorted = [...list.data].sort(
    (a, b) => toDate(b.remindedAt).getTime() - toDate(a.remindedAt).getTime(),
  )

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      return true
    } catch {
      toast.error(t('errors.generic'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const ok = await run(
      () =>
        editing
          ? updateAnnouncement(boardId, editing, author, form)
          : createAnnouncement(boardId, author, form),
      editing ? t('announcements.saved') : t('announcements.published'),
    )
    if (ok) {
      setForm(EMPTY)
      setEditing(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl"
        data-testid="announcements-panel"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4" />
            {t('announcements.panel')}
          </DialogTitle>
          <DialogDescription>{t('announcements.panelHint')}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3 rounded-xl border p-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void submit()
          }}
        >
          <p className="text-sm font-semibold">
            {editing ? t('announcements.edit') : t('announcements.create')}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-title">
              {t('announcements.titleLabel')}
            </Label>
            <Input
              id="announcement-title"
              value={form.title}
              maxLength={80}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-body">
              {t('announcements.bodyLabel')}
            </Label>
            <Textarea
              id="announcement-body"
              rows={3}
              value={form.body}
              maxLength={500}
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-link">
              {t('announcements.linkLabel')}
            </Label>
            <Input
              id="announcement-link"
              value={form.link}
              maxLength={500}
              placeholder="https://… · /b/…"
              onChange={(event) =>
                setForm({ ...form, link: event.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('announcements.linkHint')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="announcement-important"
              checked={form.important}
              onCheckedChange={(checked) =>
                setForm({ ...form, important: checked === true })
              }
            />
            <Label htmlFor="announcement-important" className="font-normal">
              {t('announcements.important')}
              <span className="ml-1 text-xs text-muted-foreground">
                · {t('announcements.importantHint')}
              </span>
            </Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!valid || busy}>
              <Megaphone />
              {editing ? t('announcements.save') : t('announcements.publish')}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null)
                  setForm(EMPTY)
                }}
              >
                {t('announcements.cancel')}
              </Button>
            )}
          </div>
        </form>

        {sorted.length === 0 ? (
          <p className="rounded-lg bg-muted p-4 text-sm">
            {t('announcements.noneYet')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((item) => {
              const reminded =
                toDate(item.remindedAt).getTime() -
                  toDate(item.createdAt).getTime() >
                1000
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-1.5 rounded-xl border p-3 text-sm"
                  data-testid="announcement-item"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.important && (
                      <Badge className="bg-rose-100 text-rose-800">
                        {t('announcements.importantBadge')}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatRelative(toDate(item.createdAt), locale)}
                      {reminded &&
                        ` · ${t('announcements.remindedOn', {
                          when: formatRelative(toDate(item.remindedAt), locale),
                        })}`}
                    </span>
                  </div>
                  {item.body && (
                    <p className="line-clamp-2 whitespace-pre-line text-muted-foreground">
                      {item.body}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className="mr-auto text-xs font-medium"
                      data-testid="read-count"
                    >
                      {t('announcements.readBy', {
                        read: readCount(item, states.data),
                        total: members,
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => remindAnnouncement(boardId, item.id, author),
                          t('announcements.reminded'),
                        )
                      }
                    >
                      <BellRing />
                      {t('announcements.remind')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(item.id)
                        setForm({
                          title: item.title,
                          body: item.body,
                          link: item.link,
                          important: item.important,
                        })
                      }}
                    >
                      <Pencil />
                      {t('announcements.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setRemoving(item)}
                    >
                      <Trash2 />
                      {t('announcements.delete')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <AlertDialog
          open={!!removing}
          onOpenChange={(open) => !open && setRemoving(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('announcements.deleteTitle', { title: removing?.title })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('announcements.deleteBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const target = removing
                  setRemoving(null)
                  if (target)
                    void run(
                      () => deleteAnnouncement(boardId, target.id),
                      t('announcements.deleted'),
                    )
                }}
              >
                {t('announcements.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
