import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { doc, getDoc } from 'firebase/firestore'
import { Columns2, PencilLine, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  restoreStudentVersion,
  swapToTeacher,
  type Slide,
} from '@/features/slides/api'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { editedByTeacher } from '@/features/slides/teacher-edits'
import { db } from '@/lib/firebase'
import { formatRelative, toDate } from '@/lib/time'
import { paths, type SlideVersionDoc } from '@/model'

type Props = {
  boardId: string
  studentId: string
  slide: Slide
  /** The space's owner may compare and restore their version */
  canRestore: boolean
}

/**
 * "Editada por el docente · hace 2 h" under a slide the teacher changed (M15, D44). The student
 * compares both versions and brings theirs back with one click (undoable).
 */
export function TeacherEditBadge({
  boardId,
  studentId,
  slide,
  canRestore,
}: Props) {
  const { t, i18n } = useTranslation()
  const [comparing, setComparing] = useState<SlideVersionDoc | null>(null)
  const [busy, setBusy] = useState(false)
  if (!editedByTeacher(slide)) return null

  const versionRef = (kind: 'student' | 'teacher') =>
    doc(db, paths.version(boardId, studentId, slide.id, kind))

  async function compare() {
    const version = await getDoc(versionRef('student'))
    if (version.exists()) setComparing(version.data() as SlideVersionDoc)
    else toast.error(t('errors.generic'))
  }

  async function restore() {
    if (!comparing) return
    setBusy(true)
    try {
      await restoreStudentVersion(boardId, studentId, slide, comparing)
      setComparing(null)
      toast.success(t('teacherEdits.restored'), {
        action: {
          label: t('teacherEdits.undo'),
          onClick: () =>
            void getDoc(versionRef('teacher'))
              .then((teacher) =>
                teacher.exists()
                  ? swapToTeacher(
                      boardId,
                      studentId,
                      slide.id,
                      teacher.data() as SlideVersionDoc,
                    )
                  : undefined,
              )
              .then(() => toast.success(t('teacherEdits.undone')))
              .catch(() => toast.error(t('errors.generic'))),
        },
      })
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p
        className="flex flex-wrap items-center gap-2 text-xs text-amber-800"
        data-testid="teacher-edited"
      >
        <PencilLine className="size-3.5" />
        {t('teacherEdits.editedAgo', {
          when: formatRelative(
            toDate(slide.teacherEditedAt),
            i18n.resolvedLanguage ?? 'es',
          ),
        })}
        {canRestore && (
          <Button variant="outline" size="xs" onClick={() => void compare()}>
            <Columns2 />
            {t('teacherEdits.compare')}
          </Button>
        )}
      </p>
      {comparing && (
        <Dialog open onOpenChange={(open) => !open && setComparing(null)}>
          <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t('teacherEdits.compareTitle')}</DialogTitle>
              <DialogDescription>
                {t('teacherEdits.badgeHint')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <figure className="flex flex-col gap-1">
                <figcaption className="text-sm font-medium">
                  {t('teacherEdits.yours')}
                </figcaption>
                <SlidePreview
                  slide={comparing}
                  large
                  className="rounded-lg border"
                />
              </figure>
              <figure className="flex flex-col gap-1">
                <figcaption className="text-sm font-medium">
                  {t('teacherEdits.teachers')}
                </figcaption>
                <SlidePreview
                  slide={slide}
                  large
                  className="rounded-lg border"
                />
              </figure>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComparing(null)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={busy} onClick={() => void restore()}>
                <RotateCcw />
                {t('teacherEdits.restore')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
