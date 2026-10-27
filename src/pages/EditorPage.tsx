import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Eye, Plus } from 'lucide-react'
import { doc } from 'firebase/firestore'
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
import { UploadError } from '@/features/assets/upload'
import { recordBoardActivity } from '@/features/boards/api'
import { useBoard } from '@/features/boards/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import {
  addSlide,
  deleteSlide,
  reorderSlides,
  shouldTouchSpace,
  touchSpace,
  TooManySlidesError,
  type Slide,
} from '@/features/slides/api'
import { SaveIndicator } from '@/features/slides/components/SaveIndicator'
import { SlideSidebar } from '@/features/slides/components/SlideSidebar'
import type { SaveStatus } from '@/features/slides/engine/autosave'
import type { SlideCanvasHandle } from '@/features/slides/engine/SlideCanvas'
import { TooManyImagesError } from '@/features/slides/engine/scene'
import { useSlides } from '@/features/slides/hooks'
import { useMyStudentId } from '@/features/spaces/hooks'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import { MAX_SLIDES, paths, type SpaceDoc } from '@/model'

const SlideCanvas = lazy(() => import('@/features/slides/engine/SlideCanvas'))

/** The student's slide editor: slide list + one Excalidraw canvas (lazy chunk). */
export function EditorPage() {
  const { t, i18n } = useTranslation()
  const { boardId, studentId } = useParams()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const ref =
    boardId && studentId ? doc(db, paths.space(boardId, studentId)) : null
  const space = useLiveDoc<SpaceDoc>(ref, `space:${boardId}:${studentId}`)
  const slides = useSlides(boardId, studentId, space.data?.slideOrder)

  const canvas = useRef<SlideCanvasHandle>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Slide | null>(null)
  const [status, setStatus] = useState<{ value: SaveStatus; error?: unknown }>({
    value: 'idle',
  })
  const [bytes, setBytes] = useState(0)

  // Event handlers run after awaits: read the latest data through refs
  const latest = useRef({ slides: slides.data, space: space.data })
  useLayoutEffect(() => {
    latest.current = { slides: slides.data, space: space.data }
  })

  if (space.loading || board.loading || me.loading) {
    return (
      <section className="flex h-[calc(100svh-3.5rem)] gap-2 p-2">
        <Skeleton className="hidden w-48 md:block" />
        <Skeleton className="flex-1" />
      </section>
    )
  }
  if (!boardId || !studentId || !space.data) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  }
  // Only the owner edits, only while the board is active; everyone else gets the viewer
  if (
    me.studentId !== studentId ||
    !board.data ||
    !isWritable(lifecycleOf(board.data))
  ) {
    return <Navigate to={`/b/${boardId}/s/${studentId}`} replace />
  }

  const order = space.data.slideOrder
  const current =
    slides.data.find((slide) => slide.id === selectedId) ?? slides.data[0]

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await canvas.current?.flush()
      await action()
    } catch (error) {
      toast.error(
        t(
          error instanceof TooManySlidesError ? 'slides.max' : 'errors.generic',
          { count: MAX_SLIDES },
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const add = (source?: Slide) =>
    run(async () => {
      const index = source
        ? order.indexOf(source.id) + 1
        : current
          ? order.indexOf(current.id) + 1
          : order.length
      // After the flush, the latest saved version of the slide being copied
      const copy = source
        ? latest.current.slides.find((slide) => slide.id === source.id)
        : undefined
      setSelectedId(
        await addSlide(boardId, studentId, order, index, copy ?? source),
      )
    })

  const select = (id: string) =>
    id !== current?.id && run(async () => setSelectedId(id))

  const confirmDelete = async () => {
    const slide = deleting
    setDeleting(null)
    if (!slide) return
    await run(async () => {
      const index = order.indexOf(slide.id)
      const rest = order.filter((id) => id !== slide.id)
      if (slide.id === current?.id)
        setSelectedId(rest[Math.min(index, rest.length - 1)] ?? null)
      await deleteSlide(boardId, studentId, order, slide.id)
    })
  }

  const onStatus = (value: SaveStatus, error?: unknown) => {
    setStatus({ value, error })
    if (value === 'saved') void recordBoardActivity(boardId)
    const saved = latest.current.space
    if (
      value === 'saved' &&
      saved &&
      shouldTouchSpace(toDate(saved.updatedAt))
    ) {
      void touchSpace(boardId, studentId).catch(() => undefined)
    }
  }

  function onImageError(error: unknown) {
    toast.error(
      error instanceof TooManyImagesError
        ? t('slides.tooManyImages')
        : t(
            `cover.errors.${error instanceof UploadError ? error.reason : 'network'}`,
          ),
    )
  }

  return (
    <section className="flex h-[calc(100svh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Link
          to={`/b/${boardId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {board.data?.title}
        </Link>
        <h1 className="flex-1 truncate font-semibold">
          {space.data.title || t('slides.editorTitle')}
        </h1>
        <SaveIndicator
          status={status.value}
          error={status.error}
          bytes={bytes}
        />
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to={`/b/${boardId}/s/${studentId}`} />}
        >
          <Eye />
          {t('slides.view')}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SlideSidebar
          slides={slides.data}
          currentId={current?.id}
          busy={busy}
          onSelect={select}
          onAdd={() => void add()}
          onDuplicate={(slide) => void add(slide)}
          onDelete={setDeleting}
          onReorder={(next) =>
            void reorderSlides(boardId, studentId, next).catch(() =>
              toast.error(t('errors.generic')),
            )
          }
        />
        <div className="relative min-h-0 flex-1">
          {current ? (
            <Suspense fallback={<Skeleton className="h-full rounded-none" />}>
              <SlideCanvas
                key={current.id}
                ref={canvas}
                boardId={boardId}
                studentId={studentId}
                slide={current}
                language={i18n.resolvedLanguage ?? 'es'}
                onStatus={onStatus}
                onSize={setBytes}
                onImageError={onImageError}
              />
            </Suspense>
          ) : slides.loading ? (
            <Skeleton className="h-full rounded-none" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="max-w-sm text-muted-foreground">
                {t('slides.empty')}
              </p>
              <Button disabled={busy} onClick={() => void add()}>
                <Plus />
                {t('slides.addFirst')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('slides.deleteTitle', {
                number: deleting ? order.indexOf(deleting.id) + 1 : 0,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('slides.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              {t('slides.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
