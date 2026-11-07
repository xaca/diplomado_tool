import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
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
  addEvaluation,
  deleteEvaluation,
  swapEvaluations,
  updateEvaluation,
} from '@/features/evaluations/api'
import { useEvaluations } from '@/features/evaluations/hooks'
import {
  editFormUrl,
  parseFormsUrl,
  viewFormUrl,
} from '@/features/evaluations/evaluations'
import { expandShortLink } from '@/features/slides/short-links'
import type { WithId } from '@/lib/firestore-hooks'
import {
  MAX_EVALUATION_TITLE,
  MAX_EVALUATIONS,
  type EvaluationDoc,
} from '@/model'

function AddEvaluation({
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
      // a forms.gle short link is expanded first (D123)
      const parsed = parseFormsUrl(await expandShortLink(link))
      if (!parsed) {
        setProblem(t('evaluations.linkError'))
        return
      }
      await addEvaluation(
        boardId,
        title.trim(),
        parsed.formId,
        parsed.published,
        position,
      )
      toast.success(t('evaluations.added'))
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
          <Label htmlFor="evaluation-link">{t('evaluations.link')}</Label>
          <Input
            id="evaluation-link"
            value={link}
            placeholder={t('evaluations.linkPlaceholder')}
            onChange={(event) => {
              setLink(event.target.value)
              setProblem(null)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="evaluation-title">{t('evaluations.formTitle')}</Label>
          <Input
            id="evaluation-title"
            value={title}
            maxLength={MAX_EVALUATION_TITLE}
            placeholder={t('evaluations.formTitlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('evaluations.shareHint')}
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

function EditEvaluation({
  boardId,
  evaluation,
  onClose,
}: {
  boardId: string
  evaluation: WithId<EvaluationDoc>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(evaluation.title)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await updateEvaluation(boardId, evaluation.id, {
        title: title.trim(),
      })
      toast.success(t('evaluations.saved'))
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
          <DialogTitle>{t('evaluations.edit')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-evaluation-title">
            {t('evaluations.formTitle')}
          </Label>
          <Input
            id="edit-evaluation-title"
            value={title}
            maxLength={MAX_EVALUATION_TITLE}
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

function EvaluationRow({
  boardId,
  evaluation,
  above,
  below,
}: {
  boardId: string
  evaluation: WithId<EvaluationDoc>
  above?: WithId<EvaluationDoc>
  below?: WithId<EvaluationDoc>
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-3"
      data-testid="evaluation-row"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{evaluation.title}</p>
          <p className="text-sm text-muted-foreground">
            {evaluation.enabled
              ? t('evaluations.enabled')
              : t('evaluations.disabled')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!above}
          aria-label={t('stages.up')}
          onClick={() =>
            above && void swapEvaluations(boardId, evaluation, above)
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
            below && void swapEvaluations(boardId, evaluation, below)
          }
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            evaluation.enabled
              ? t('evaluations.disable')
              : t('evaluations.enable')
          }
          title={
            evaluation.enabled
              ? t('evaluations.disable')
              : t('evaluations.enable')
          }
          onClick={() =>
            void updateEvaluation(boardId, evaluation.id, {
              enabled: !evaluation.enabled,
            }).catch(() => toast.error(t('errors.generic')))
          }
        >
          {evaluation.enabled ? <Eye /> : <EyeOff />}
        </Button>
        {!evaluation.published && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('evaluations.open')}
            title={t('evaluations.open')}
            nativeButton={false}
            render={
              <a
                href={editFormUrl(evaluation.formId)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <ExternalLink />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('evaluations.open')}
          title={t('evaluations.open')}
          nativeButton={false}
          render={
            <a
              href={viewFormUrl(evaluation.formId, evaluation.published)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <Eye />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('evaluations.edit')}
          title={t('evaluations.edit')}
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
        <EditEvaluation
          boardId={boardId}
          evaluation={evaluation}
          onClose={() => setEditing(false)}
        />
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('evaluations.deleteTitle', { title: evaluation.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('evaluations.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void deleteEvaluation(boardId, evaluation.id).catch(() =>
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

export function EvaluationsPanel({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const evaluations = useEvaluations(boardId)
  const [adding, setAdding] = useState(false)
  const list = evaluations.data
  const full = list.length >= MAX_EVALUATIONS

  return (
    <section
      id="evaluations"
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="evaluations-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">
            <ClipboardCheck className="mr-1 inline size-5" />
            {t('evaluations.panelTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('evaluations.panelHint')}
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={`/b/${boardId}/evaluaciones`} />}
        >
          <ExternalLink />
          {t('evaluations.openSection')}
        </Button>
      </div>

      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((e, index) => (
            <EvaluationRow
              key={e.id}
              boardId={boardId}
              evaluation={e}
              above={list[index - 1]}
              below={list[index + 1]}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <AddEvaluation
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
            {t('evaluations.add')}
          </Button>
          {full && (
            <p className="text-sm text-muted-foreground" data-testid="limit">
              {t('evaluations.limit', { count: MAX_EVALUATIONS })}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
