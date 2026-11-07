import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Play,
  Plus,
  Presentation,
  Trash2,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addPresentation,
  deletePresentation,
  swapPresentations,
  updatePresentation,
} from '@/features/presentations/api'
import { usePresentations } from '@/features/presentations/hooks'
import {
  openUrl,
  parseSlidesUrl,
  presentUrl,
} from '@/features/presentations/presentations'
import { expandShortLink } from '@/features/slides/short-links'
import type { WithId } from '@/lib/firestore-hooks'
import {
  MAX_PRESENTATION_TITLE,
  MAX_PRESENTATIONS,
  type PresentationDoc,
} from '@/model'

function AddPresentation({
  boardId,
  position,
  onDone,
}: {
  boardId: string
  position: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setProblem(null)
    setSaving(true)
    try {
      // a short link (goo.gl…) is expanded first (D123)
      const parsed = parseSlidesUrl(await expandShortLink(link))
      if (!parsed) {
        setProblem(t('presentations.linkError'))
        return
      }
      await addPresentation(
        boardId,
        title.trim(),
        parsed.presentationId,
        parsed.published,
        position,
      )
      toast.success(t('presentations.added'))
      onDone()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentation-link">{t('presentations.link')}</Label>
          <Input
            id="presentation-link"
            value={link}
            placeholder={t('presentations.linkPlaceholder')}
            onChange={(event) => {
              setLink(event.target.value)
              setProblem(null)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentation-title">
            {t('presentations.slideTitle')}
          </Label>
          <Input
            id="presentation-title"
            value={title}
            maxLength={MAX_PRESENTATION_TITLE}
            placeholder={t('presentations.slideTitlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('presentations.shareHint')}
      </p>
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={saving || !link.trim() || !title.trim()}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  )
}

function EditPresentation({
  boardId,
  presentation,
  onClose,
}: {
  boardId: string
  presentation: WithId<PresentationDoc>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(presentation.title)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updatePresentation(boardId, presentation.id, {
        title: title.trim(),
      })
      toast.success(t('presentations.saved'))
      onClose()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('presentations.edit')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-presentation-title">
            {t('presentations.slideTitle')}
          </Label>
          <Input
            id="edit-presentation-title"
            value={title}
            maxLength={MAX_PRESENTATION_TITLE}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={saving || !title.trim()}
            onClick={() => void save()}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PresentationRow({
  boardId,
  presentation,
  above,
  below,
}: {
  boardId: string
  presentation: WithId<PresentationDoc>
  above?: WithId<PresentationDoc>
  below?: WithId<PresentationDoc>
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-3"
      data-testid="presentation-row"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{presentation.title}</p>
          <p className="text-sm text-muted-foreground">
            {presentation.enabled
              ? t('presentations.enabled')
              : t('presentations.disabled')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!above}
          aria-label={t('stages.up')}
          onClick={() =>
            above && void swapPresentations(boardId, presentation, above)
          }
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!below}
          aria-label={t('stages.down')}
          onClick={() =>
            below && void swapPresentations(boardId, presentation, below)
          }
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            presentation.enabled
              ? t('presentations.disable')
              : t('presentations.enable')
          }
          title={
            presentation.enabled
              ? t('presentations.disable')
              : t('presentations.enable')
          }
          onClick={() =>
            void updatePresentation(boardId, presentation.id, {
              enabled: !presentation.enabled,
            }).catch(() => toast.error(t('errors.generic')))
          }
        >
          {presentation.enabled ? <Eye /> : <EyeOff />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('presentations.present')}
          title={t('presentations.present')}
          nativeButton={false}
          render={
            <a
              href={presentUrl(
                presentation.presentationId,
                presentation.published,
              )}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <Play />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('presentations.open')}
          title={t('presentations.open')}
          nativeButton={false}
          render={
            <a
              href={openUrl(
                presentation.presentationId,
                presentation.published,
              )}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <ExternalLink />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('presentations.edit')}
          title={t('presentations.edit')}
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.remove')}
          title={t('common.remove')}
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
        </Button>
      </div>

      {editing && (
        <EditPresentation
          boardId={boardId}
          presentation={presentation}
          onClose={() => setEditing(false)}
        />
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('presentations.deleteTitle', { title: presentation.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('presentations.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void deletePresentation(boardId, presentation.id).catch(() =>
                  toast.error(t('errors.generic')),
                )
              }
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export function PresentationsPanel({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const presentations = usePresentations(boardId)
  const [adding, setAdding] = useState(false)
  const list = presentations.data
  const full = list.length >= MAX_PRESENTATIONS

  return (
    <section
      id="presentations"
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="presentations-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">
            <Presentation className="mr-1 inline size-5" />
            {t('presentations.panelTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('presentations.panelHint')}
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={`/b/${boardId}/presentaciones`} />}
        >
          <ExternalLink />
          {t('presentations.openSection')}
        </Button>
      </div>

      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((p, index) => (
            <PresentationRow
              key={p.id}
              boardId={boardId}
              presentation={p}
              above={list[index - 1]}
              below={list[index + 1]}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <AddPresentation
          boardId={boardId}
          position={(list.at(-1)?.position ?? -1) + 1}
          onDone={() => setAdding(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={full}
            onClick={() => setAdding(true)}
          >
            <Plus />
            {t('presentations.add')}
          </Button>
          {full && (
            <p className="text-sm text-muted-foreground" data-testid="limit">
              {t('presentations.limit', { count: MAX_PRESENTATIONS })}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
