import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownUp, PencilLine, RotateCcw, Trash2 } from 'lucide-react'
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
import { useSaveLock } from '@/components/save/use-save-lock'
import type { Note } from '@/features/notes/api'
import {
  discardDeletedSlide,
  restoreDeletedSlide,
  restoreStudentOrder,
  studentOrderBack,
  TooManySlidesError,
  type DeletedSlide,
} from '@/features/slides/api'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { swapProjectVersion, type Space } from '@/features/spaces/api'
import { formatRelative, toDate } from '@/lib/time'
import { MAX_SLIDES } from '@/model'

/**
 * "Cambios de tu docente" (M27, D129): what the teacher changed in the project, each with its way
 * back: the details ("Restaurar mi versión", undoable), the slide order, and deleted slides. The
 * owner acts; the teacher sees the same list read-only. Nothing to show → nothing rendered.
 */
export function TeacherChanges({
  boardId,
  space,
  deleted,
  notesBySlide,
  canRestore,
}: {
  boardId: string
  space: Space
  deleted: DeletedSlide[]
  notesBySlide: ReadonlyMap<string, Note[]>
  canRestore: boolean
}) {
  const { t, i18n } = useTranslation()
  const lock = useSaveLock()
  const [discarding, setDiscarding] = useState<DeletedSlide | null>(null)
  const language = i18n.resolvedLanguage ?? 'es'

  const version = space.previousVersion
  const studentOrder = space.studentSlideOrder
  const orderChanged =
    !!studentOrder &&
    studentOrderBack(space.slideOrder, studentOrder).join() !==
      space.slideOrder.join()

  if (!version && !orderChanged && deleted.length === 0) return null

  function act(action: () => Promise<void>, done: string) {
    void lock
      .run(action)
      .then(() => toast.success(done))
      .catch((error: unknown) =>
        toast.error(
          t(
            error instanceof TooManySlidesError
              ? 'slides.max'
              : 'errors.generic',
            {
              count: MAX_SLIDES,
            },
          ),
        ),
      )
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-neutral-900"
      aria-label={t('projectEdits.changesTitle')}
      data-testid="teacher-changes"
    >
      <h2 className="flex items-center gap-1.5 font-semibold">
        <PencilLine className="size-4" />
        {t('projectEdits.changesTitle')}
      </h2>

      {version && (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="project-version"
        >
          <span className="flex-1">
            {version.by === 'student'
              ? `${t('projectEdits.edited')}${space.teacherEditedAt ? ` · ${formatRelative(toDate(space.teacherEditedAt), language)}` : ''}. ${t('projectEdits.editedHint')}`
              : t('projectEdits.youRestored')}
          </span>
          {canRestore && (
            <Button
              size="sm"
              variant="outline"
              disabled={lock.saving}
              onClick={() =>
                act(
                  () => swapProjectVersion(boardId, space),
                  version.by === 'student'
                    ? t('projectEdits.restored')
                    : t('projectEdits.backToTeacher'),
                )
              }
            >
              <RotateCcw />
              {version.by === 'student'
                ? t('projectEdits.restore')
                : t('projectEdits.backToTeacher')}
            </Button>
          )}
        </div>
      )}

      {orderChanged && studentOrder && (
        <div
          className="flex flex-wrap items-center gap-2"
          data-testid="order-changed"
        >
          <span className="flex-1">{t('projectEdits.orderChanged')}</span>
          {canRestore && (
            <Button
              size="sm"
              variant="outline"
              disabled={lock.saving}
              onClick={() =>
                act(
                  () =>
                    restoreStudentOrder(
                      boardId,
                      space.id,
                      space.slideOrder,
                      studentOrder,
                    ),
                  t('projectEdits.orderRestored'),
                )
              }
            >
              <ArrowDownUp />
              {t('projectEdits.restoreOrder')}
            </Button>
          )}
        </div>
      )}

      {deleted.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="deleted-slides">
          <h3 className="font-medium">{t('projectEdits.deleted')}</h3>
          {canRestore && (
            <p className="text-xs text-neutral-600">
              {t('projectEdits.deletedHint')}
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {deleted.map((copy) => (
              <li
                key={copy.id}
                className="flex flex-col gap-1"
                data-testid="deleted-slide"
              >
                <SlidePreview
                  slide={copy}
                  className="rounded-lg border bg-white"
                />
                <span className="text-xs text-neutral-600">
                  {t('projectEdits.deletedBy', {
                    name: copy.deletedByName,
                    when: formatRelative(toDate(copy.deletedAt), language),
                  })}
                </span>
                {canRestore && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={lock.saving}
                      onClick={() =>
                        act(
                          () =>
                            restoreDeletedSlide(
                              boardId,
                              space.id,
                              space.slideOrder,
                              copy,
                            ),
                          t('projectEdits.slideRestored'),
                        )
                      }
                    >
                      <RotateCcw />
                      {t('projectEdits.restoreSlide')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={lock.saving}
                      onClick={() => setDiscarding(copy)}
                    >
                      <Trash2 />
                      {t('projectEdits.discardSlide')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog
        open={discarding !== null}
        onOpenChange={(open) => !open && setDiscarding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('projectEdits.discardTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('projectEdits.discardHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={lock.saving}
              onClick={() => {
                const copy = discarding
                setDiscarding(null)
                if (!copy) return
                act(
                  () =>
                    discardDeletedSlide(
                      boardId,
                      space.id,
                      copy.id,
                      (notesBySlide.get(copy.id) ?? []).map((note) => note.id),
                    ),
                  t('projectEdits.discardSlide'),
                )
              }}
            >
              {t('projectEdits.discardSlide')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
