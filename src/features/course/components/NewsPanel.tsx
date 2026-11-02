import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAnnouncement } from '@/features/announcements/api'
import { addNews, deleteNews, updateNews } from '@/features/course/api'
import { formatDay } from '@/features/course/course'
import { useNews } from '@/features/course/hooks'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { normalizeEmail } from '@/lib/collections'
import type { WithId } from '@/lib/firestore-hooks'
import {
  NEWS_KINDS,
  newsInputSchema,
  type NewsDoc,
  type NewsInput,
} from '@/model'
import { useAuth } from '@/providers/auth-context'

const selectClass =
  'h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const empty = (date: string): NewsInput => ({
  date,
  wholeWeek: false,
  kind: 'deliverable',
  title: '',
  text: '',
  link: '',
})

/**
 * "Novedades del curso" (M24, D106): Entrega · Evento · Aviso on a date (or its whole week), with
 * text and a link; optionally also an announcement (🔔), and emailed from Comunicación.
 */
export function NewsPanel({
  boardId,
  today,
  onEmail,
}: {
  boardId: string
  today: string
  onEmail?: (item: WithId<NewsDoc>) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { user } = useAuth()
  const profile = useProfile()
  const news = useNews(boardId)
  const [form, setForm] = useState<NewsInput>(() => empty(today))
  const [editing, setEditing] = useState<string | null>(null)
  const [announce, setAnnounce] = useState(false)
  const [busy, setBusy] = useState(false)
  const parsed = newsInputSchema.safeParse(form)

  async function submit() {
    if (!parsed.success) return
    setBusy(true)
    try {
      if (editing) await updateNews(boardId, editing, parsed.data)
      else await addNews(boardId, parsed.data)
      if (announce && !editing && user)
        await createAnnouncement(
          boardId,
          {
            email: normalizeEmail(user.email ?? ''),
            name: displayNameOf(user, profile.data),
          },
          {
            title: parsed.data.title.slice(0, 80),
            body: [
              `${t(`course.kinds.${parsed.data.kind}`)} · ${formatDay(parsed.data.date, locale)}`,
              parsed.data.text,
            ]
              .filter(Boolean)
              .join('\n')
              .slice(0, 500),
            link: parsed.data.link || `/b/${boardId}/calendario`,
            important: parsed.data.kind === 'deliverable',
          },
        )
      toast.success(editing ? t('course.newsSaved') : t('course.newsAdded'))
      setForm(empty(today))
      setEditing(null)
      setAnnounce(false)
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: WithId<NewsDoc>) {
    if (!window.confirm(t('course.newsDeleteConfirm', { title: item.title })))
      return
    try {
      await deleteNews(boardId, item.id)
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="news-panel">
      <div className="grid gap-3 sm:grid-cols-[10rem_10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="news-kind">{t('course.newsKind')}</Label>
          <select
            id="news-kind"
            className={selectClass}
            value={form.kind}
            onChange={(event) =>
              setForm({
                ...form,
                kind: event.target.value as NewsInput['kind'],
              })
            }
          >
            {NEWS_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`course.kinds.${kind}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="news-date">{t('course.date')}</Label>
          <Input
            id="news-date"
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="news-title">{t('course.newsTitle')}</Label>
          <Input
            id="news-title"
            maxLength={120}
            placeholder={t('course.newsTitlePlaceholder')}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="news-text">{t('course.newsText')}</Label>
        <Textarea
          id="news-text"
          rows={2}
          maxLength={1000}
          value={form.text}
          onChange={(event) => setForm({ ...form, text: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="news-link">{t('course.newsLink')}</Label>
        <Input
          id="news-link"
          type="url"
          placeholder="https://"
          maxLength={500}
          value={form.link}
          onChange={(event) => setForm({ ...form, link: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={form.wholeWeek}
            onCheckedChange={(checked) =>
              setForm({ ...form, wholeWeek: !!checked })
            }
          />
          {t('course.wholeWeek')}
        </label>
        {!editing && (
          <label className="flex items-center gap-2">
            <Checkbox
              checked={announce}
              onCheckedChange={(checked) => setAnnounce(!!checked)}
            />
            {t('course.alsoAnnounce')}
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={busy || !parsed.success}
          onClick={() => void submit()}
        >
          <Plus />
          {editing ? t('course.newsSave') : t('course.newsAdd')}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(null)
              setForm(empty(today))
            }}
          >
            {t('common.cancel')}
          </Button>
        )}
      </div>

      {news.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {news.data.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              data-testid="news-row"
            >
              <span className="w-24 text-xs text-muted-foreground">
                {formatDay(item.date, locale, 'short')}
              </span>
              <span className="text-xs font-medium">
                {t(`course.kinds.${item.kind}`)}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {onEmail && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('course.newsEmail', { title: item.title })}
                  title={t('course.newsEmailShort')}
                  onClick={() => onEmail(item)}
                >
                  <Mail />
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('course.newsEdit', { title: item.title })}
                onClick={() => {
                  setEditing(item.id)
                  setForm({
                    date: item.date,
                    wholeWeek: item.wholeWeek,
                    kind: item.kind,
                    title: item.title,
                    text: item.text,
                    link: item.link,
                  })
                }}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('course.newsDelete', { title: item.title })}
                onClick={() => void remove(item)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
