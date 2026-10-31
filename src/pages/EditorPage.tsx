import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Eye,
  Lock,
  MessageSquareText,
  PencilLine,
  Plus,
} from 'lucide-react'
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
import { SlideNotes } from '@/features/notes/components/SlideNotes'
import { useNotes } from '@/features/notes/hooks'
import {
  addSlide,
  addSlideAsTeacher,
  deleteSlide,
  markTeacherEditsSeen,
  reorderSlides,
  shouldTouchSpace,
  touchSpace,
  TooManySlidesError,
  type Slide,
} from '@/features/slides/api'
import { SaveIndicator } from '@/features/slides/components/SaveIndicator'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { SlideSidebar } from '@/features/slides/components/SlideSidebar'
import type { SaveStatus } from '@/features/slides/engine/autosave'
import type { SlideCanvasHandle } from '@/features/slides/engine/SlideCanvas'
import { TooManyImagesError } from '@/features/slides/engine/scene'
import { useSlides } from '@/features/slides/hooks'
import { useSlideLock } from '@/features/slides/use-slide-lock'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { normalizeEmail } from '@/lib/collections'
import { useMyStudentId } from '@/features/spaces/hooks'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import { MAX_SLIDES, paths, type SpaceDoc } from '@/model'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

const SlideCanvas = lazy(() => import('@/features/slides/engine/SlideCanvas'))

/**
 * The slide editor: slide list + one Excalidraw canvas (lazy chunk). The student edits their own
 * space; the board's teacher may edit it too (M15), one editor per slide.
 */
export function EditorPage() {
  const { t, i18n } = useTranslation()
  const { boardId, studentId } = useParams()
  const [searchParams] = useSearchParams()
  const { user, role } = useAuth()
  const profile = useProfile()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const isMine = !!me.studentId && me.studentId === studentId
  const isBoardTeacher =
    isTeacherRole(role) &&
    !!board.data?.teacherEmails.includes(normalizeEmail(user?.email ?? ''))
  const asTeacher = isBoardTeacher && !isMine
  const ref =
    boardId && studentId ? doc(db, paths.space(boardId, studentId)) : null
  const space = useLiveDoc<SpaceDoc>(ref, `space:${boardId}:${studentId}`)
  const slides = useSlides(boardId, studentId, space.data?.slideOrder)
  const notes = useNotes(boardId, studentId, isMine || isBoardTeacher)
  const [showNotes, setShowNotes] = useState(true)
  // M15: slides the teacher changed in this session, and the note they're writing
  const [editedIds, setEditedIds] = useState<ReadonlySet<string>>(new Set())
  const [noteDraft, setNoteDraft] = useState<string | null>(null)

  const canvas = useRef<SlideCanvasHandle>(null)
  // Opened from the space page or the presenter on a given slide (?slide=)
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    searchParams.get('slide'),
  )
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

  // One editor per slide (D46): the other person sees it read-only
  const lockOwner = useMemo(
    () =>
      user
        ? {
            uid: user.uid,
            name: displayNameOf(user, profile.data),
            role: asTeacher ? ('teacher' as const) : ('student' as const),
          }
        : null,
    [user, profile.data, asTeacher],
  )
  const currentId = (
    slides.data.find((slide) => slide.id === selectedId) ?? slides.data[0]
  )?.id
  const lock = useSlideLock(
    boardId ?? '',
    studentId ?? '',
    (isMine || isBoardTeacher) &&
      board.data &&
      isWritable(lifecycleOf(board.data))
      ? currentId
      : undefined,
    lockOwner,
  )

  // The student opened their slides: the card's "✎ Docente" badge goes away
  const unseen = isMine && !!space.data?.teacherEditsUnseen
  useEffect(() => {
    if (unseen && boardId && studentId)
      void markTeacherEditsSeen(boardId, studentId).catch(() => undefined)
  }, [unseen, boardId, studentId])

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
  // The owner (or the board's teacher, M15) edits, only while the board is active; others: viewer
  if (
    (!isMine && !isBoardTeacher) ||
    !board.data ||
    !isWritable(lifecycleOf(board.data))
  ) {
    return <Navigate to={`/b/${boardId}/s/${studentId}`} replace />
  }

  const order = space.data.slideOrder
  const current =
    slides.data.find((slide) => slide.id === selectedId) ?? slides.data[0]
  const currentNotes = current ? (notes.bySlide.get(current.id) ?? []) : []

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
      // The teacher appends at the end and never duplicates (D43)
      if (asTeacher) {
        setSelectedId(await addSlideAsTeacher(boardId, studentId, order))
        return
      }
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
      await deleteSlide(
        boardId,
        studentId,
        order,
        slide.id,
        (notes.bySlide.get(slide.id) ?? []).map((note) => note.id),
      )
    })
  }

  const onStatus = (value: SaveStatus, error?: unknown) => {
    setStatus({ value, error })
    if (value === 'saved') void recordBoardActivity(boardId)
    const savedId = current?.id
    if (value === 'saved' && asTeacher && savedId)
      setEditedIds((ids) =>
        ids.has(savedId) ? ids : new Set([...ids, savedId]),
      )
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
        {(currentNotes.length > 0 || asTeacher) && (
          <Button
            variant={showNotes ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={showNotes}
            onClick={() => setShowNotes((value) => !value)}
          >
            <MessageSquareText />
            {t('notes.count', { count: currentNotes.length })}
          </Button>
        )}
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

      {asTeacher && (
        <div
          className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-3 py-1.5 text-sm text-amber-950"
          data-testid="teacher-editing"
        >
          <PencilLine className="size-4" />
          <span className="flex-1">
            {t('teacherEdits.editing', { name: space.data.ownerName })}
          </span>
          {current && editedIds.has(current.id) && noteDraft === null && (
            <>
              <span className="text-xs">
                {t('teacherEdits.noteHint', { name: space.data.ownerName })}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNotes(true)
                  setNoteDraft(t('teacherEdits.notePrefill'))
                }}
              >
                <MessageSquareText />
                {t('teacherEdits.leaveNote')}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <SlideSidebar
          manage={!asTeacher}
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
          {current && lock.state === 'held' && lock.holder ? (
            // Someone else is editing this slide: read-only until it's free (D46)
            <div
              className="flex h-full flex-col items-center justify-center gap-3 overflow-auto bg-muted/40 p-4"
              data-testid="slide-locked"
            >
              <p className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm shadow-sm">
                <Lock className="size-4" />
                {t('teacherEdits.held', {
                  name:
                    lock.holder.role === 'teacher'
                      ? t('teacherEdits.heldTeacher', {
                          name: lock.holder.name,
                        })
                      : // the student: their name as on their card
                        space.data.ownerName,
                })}
              </p>
              <SlidePreview
                slide={current}
                large
                className="w-full max-w-4xl rounded-lg border shadow-sm"
              />
            </div>
          ) : current && lock.state === 'mine' ? (
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
                editor={asTeacher ? 'teacher' : 'student'}
              />
            </Suspense>
          ) : current ? (
            <Skeleton className="h-full rounded-none" />
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
        {current && showNotes && (currentNotes.length > 0 || asTeacher) && (
          <aside className="max-h-48 shrink-0 overflow-y-auto border-t p-2 md:max-h-none md:w-72 md:border-t-0 md:border-l">
            <SlideNotes
              key={`${current.id}:${noteDraft !== null}`}
              boardId={boardId}
              studentId={studentId}
              slideId={current.id}
              notes={currentNotes}
              canWrite={isBoardTeacher}
              teacherProfiles={board.data?.teacherProfiles}
              draft={noteDraft ?? undefined}
              onAdded={() => setNoteDraft(null)}
            />
          </aside>
        )}
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
              {deleting && notes.bySlide.has(deleting.id)
                ? t('slides.deleteHintNotes')
                : t('slides.deleteHint')}
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
