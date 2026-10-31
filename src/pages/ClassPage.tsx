import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eraser,
  LayoutGrid,
  List,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Presentation,
  Radio,
  StickyNote,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatClassDate } from '@/features/attendance/attendance'
import {
  addClassSlide,
  addStickyNote,
  clearClassSlide,
  deleteClassSlide,
  deleteStickyNote,
  editStickyNote,
  moveClassSlide,
  moveStickyNote,
  reactToNote,
  tidyStickyNotes,
  TooManyNotesError,
  updateClass,
  updateClassSlide,
} from '@/features/classes/api'
import { BoardSections } from '@/features/classes/components/BoardSections'
import {
  NoteDialog,
  type NoteDraft,
} from '@/features/classes/components/NoteDialog'
import { NoteList } from '@/features/classes/components/NoteList'
import { PromptDialog } from '@/features/classes/components/PromptDialog'
import { Wall, type WallPermissions } from '@/features/classes/components/Wall'
import {
  useClass,
  useClassSlides,
  useStickyNotes,
} from '@/features/classes/hooks'
import { useClassAccess } from '@/features/classes/use-class-access'
import {
  freeSpot,
  tidy,
  visibleSlide,
  type Point,
} from '@/features/classes/wall'
import { useCheer } from '@/features/fun/use-cheer'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import {
  MAX_CLASS_SLIDES,
  MAX_NOTES_PER_PERSON,
  type ClassSlideDoc,
  type StickyNoteDoc,
} from '@/model'

type Editing =
  { kind: 'new'; at: Point } | { kind: 'edit'; note: WithId<StickyNoteDoc> }

/** Phones start on the list; the wall's notes are too small there */
const narrow = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 639px)').matches

/**
 * A class (M10): slide tabs, the prompt, and the live sticky-note wall. Students add, move and
 * edit their own notes and react to anyone's; the teacher controls the class (open / close,
 * lock, follow, tidy, clear, present) and can change any note.
 */
export function ClassPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { boardId = '', classId = '' } = useParams()
  const access = useClassAccess(boardId)
  const klass = useClass(access.allowed ? boardId : undefined, classId)
  const slides = useClassSlides(
    access.allowed ? boardId : undefined,
    classId,
    klass.data?.slideOrder,
  )
  const cheer = useCheer()
  const [chosen, setChosen] = useState<string | null>(null)
  const [leftLive, setLeftLive] = useState<string | null>(null)
  const [view, setView] = useState<'wall' | 'list'>(() =>
    narrow() ? 'list' : 'wall',
  )
  const [editing, setEditing] = useState<Editing | null>(null)
  const [prompt, setPrompt] = useState<'new' | 'edit' | null>(null)
  const [confirm, setConfirm] = useState<'clear' | 'deleteSlide' | null>(null)

  const order = klass.data?.slideOrder ?? []
  const following =
    !access.teacher && !!klass.data?.follow && !!klass.data.liveSlideId
  const currentId = access.teacher
    ? chosen && order.includes(chosen)
      ? chosen
      : (order[0] ?? null)
    : visibleSlide({
        order,
        chosen,
        follow: !!klass.data?.follow,
        liveSlideId: klass.data?.liveSlideId ?? null,
        leftLive,
      })
  const slide = slides.data.find((item) => item.id === currentId) ?? null
  const notes = useStickyNotes(
    access.allowed ? boardId : undefined,
    classId,
    currentId,
  )

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  if (access.loading || klass.loading)
    return (
      <section className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="aspect-video w-full" />
      </section>
    )
  if (!klass.data)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('classes.notFound')}</p>
      </section>
    )

  const data = klass.data
  const index = currentId ? order.indexOf(currentId) : -1
  const open = data.status === 'open'
  const studentWrites =
    access.member && open && !!slide && !slide.locked && access.writableBoard
  const mine = (note: StickyNoteDoc) => note.authorUid === access.uid
  const can: WallPermissions = {
    add: !!slide && (access.teacher || studentWrites),
    move: (note) => access.teacher || (studentWrites && mine(note)),
    edit: (note) => access.teacher || (studentWrites && mine(note)),
    react: (note) => !mine(note) && (access.teacher || studentWrites),
  }
  const myIds = notes.data
    .map((note) => note.id)
    .filter((id) => id.startsWith(`${access.uid}_`))

  const fail = (error: unknown) =>
    toast.error(
      error instanceof TooManyNotesError
        ? t('classes.maxNotes', { count: MAX_NOTES_PER_PERSON })
        : t('errors.generic'),
    )

  function selectSlide(id: string) {
    setChosen(id)
    if (access.teacher) {
      // "Seguir al docente": the students' screens follow my slide
      if (data.follow && data.liveSlideId !== id)
        updateClass(boardId, classId, { liveSlideId: id }).catch(fail)
      return
    }
    const live = data.follow ? data.liveSlideId : null
    setLeftLive(live && id !== live ? live : null)
  }

  async function saveNote(draft: NoteDraft) {
    if (!currentId || !access.uid || !editing) return
    try {
      if (editing.kind === 'new') {
        await addStickyNote(
          boardId,
          classId,
          currentId,
          {
            uid: access.uid,
            studentId: access.teacher ? null : access.studentId,
            name: access.name,
            role: access.teacher ? 'teacher' : 'student',
          },
          myIds,
          { ...draft, ...editing.at },
        )
        cheer('firstNote')
      } else
        await editStickyNote(
          boardId,
          classId,
          currentId,
          editing.note.id,
          draft,
          access.teacher && !mine(editing.note),
        )
    } catch (error) {
      fail(error)
      throw error
    }
  }

  const slideTitle = (number: number) => t('classes.slideN', { number })

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <BoardSections boardId={boardId} />

      {/* Class header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to={`/b/${boardId}/class`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('classes.title')}
        </Link>
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          {data.title}
        </h1>
        <Badge
          className={cn(
            open
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-muted-foreground',
          )}
          data-testid="class-status"
        >
          {open ? t('classes.open') : t('classes.closed')}
        </Badge>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {formatClassDate(data.date, locale)}
        </span>
        {access.teacher && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant={open ? 'outline' : 'default'}
              onClick={() =>
                updateClass(boardId, classId, {
                  status: open ? 'closed' : 'open',
                })
                  .then(() =>
                    toast.success(
                      open ? t('classes.closedDone') : t('classes.opened'),
                    ),
                  )
                  .catch(fail)
              }
            >
              {open ? <Lock /> : <LockOpen />}
              {open ? t('classes.closeClass') : t('classes.openClass')}
            </Button>
            <Button
              variant="secondary"
              nativeButton={false}
              render={
                <Link
                  to={`/b/${boardId}/class/${classId}/present${index > 0 ? `?slide=${index + 1}` : ''}`}
                />
              }
            >
              <Presentation />
              {t('classes.present')}
            </Button>
          </div>
        )}
      </div>

      {/* Slide tabs */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist">
        {order.map((id, number) => (
          <Button
            key={id}
            role="tab"
            size="sm"
            variant={id === currentId ? 'default' : 'outline'}
            aria-selected={id === currentId}
            aria-label={slideTitle(number + 1)}
            onClick={() => selectSlide(id)}
            className="min-w-9"
          >
            {number + 1}
            {data.follow && data.liveSlideId === id && (
              <Radio className="text-red-500" aria-hidden />
            )}
          </Button>
        ))}
        {access.teacher && (
          <Button
            size="sm"
            variant="ghost"
            disabled={order.length >= MAX_CLASS_SLIDES}
            title={
              order.length >= MAX_CLASS_SLIDES
                ? t('classes.maxSlides', { count: MAX_CLASS_SLIDES })
                : undefined
            }
            onClick={() => setPrompt('new')}
          >
            <Plus />
            {t('classes.addSlide')}
          </Button>
        )}
        {following && (
          <span
            className="ml-auto flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs text-red-800"
            data-testid="following"
          >
            <Radio className="size-3.5" />
            {currentId === data.liveSlideId ? (
              t('classes.following')
            ) : (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setLeftLive(null)
                  setChosen(data.liveSlideId)
                }}
              >
                {t('classes.rejoin')}
              </button>
            )}
          </span>
        )}
      </div>

      {slide && (
        <>
          {/* Prompt */}
          <div className="flex flex-col gap-1">
            <h2
              className="font-heading text-2xl font-semibold sm:text-3xl"
              data-testid="prompt"
            >
              {slide.title}
            </h2>
            {slide.instructions && (
              <p className="whitespace-pre-line text-muted-foreground">
                {slide.instructions}
              </p>
            )}
          </div>

          {/* Teacher controls */}
          {access.teacher && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2"
              data-testid="teacher-bar"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrompt('edit')}
              >
                <Pencil />
                {t('classes.editPrompt')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={slide.locked}
                title={t('classes.lockHint')}
                onClick={() =>
                  updateClassSlide(boardId, classId, slide.id, {
                    locked: !slide.locked,
                  }).catch(fail)
                }
              >
                {slide.locked ? <LockOpen /> : <Lock />}
                {slide.locked ? t('classes.unlock') : t('classes.lock')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={notes.data.length === 0}
                onClick={() => {
                  const moves = tidy(slide.layout, notes.data)
                  tidyStickyNotes(boardId, classId, slide.id, moves)
                    .then(() => toast.success(t('classes.tidied')))
                    .catch(fail)
                }}
              >
                <LayoutGrid />
                {t('classes.tidy')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={notes.data.length === 0}
                onClick={() => setConfirm('clear')}
              >
                <Eraser />
                {t('classes.clear')}
              </Button>
              {order.length > 1 && (
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('classes.moveLeft')}
                    title={t('classes.moveLeft')}
                    disabled={index <= 0}
                    onClick={() =>
                      moveClassSlide(
                        boardId,
                        classId,
                        order,
                        slide.id,
                        -1,
                      ).catch(fail)
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('classes.moveRight')}
                    title={t('classes.moveRight')}
                    disabled={index >= order.length - 1}
                    onClick={() =>
                      moveClassSlide(
                        boardId,
                        classId,
                        order,
                        slide.id,
                        1,
                      ).catch(fail)
                    }
                  >
                    <ChevronRight />
                  </Button>
                </span>
              )}
              <Label
                className="ml-auto flex items-center gap-2 font-normal"
                title={t('classes.followHint')}
              >
                <Switch
                  checked={data.follow}
                  data-testid="follow-switch"
                  onCheckedChange={(follow) =>
                    updateClass(boardId, classId, {
                      follow,
                      liveSlideId: follow ? slide.id : null,
                    }).catch(fail)
                  }
                />
                {t('classes.follow')}
              </Label>
            </div>
          )}

          {/* Why I can't write */}
          {!access.teacher &&
            (!access.writableBoard ? (
              <Notice>{t('classes.readOnlyNotice')}</Notice>
            ) : !open ? (
              <Notice>{t('classes.closedNotice')}</Notice>
            ) : slide.locked ? (
              <Notice>{t('classes.lockedNotice')}</Notice>
            ) : null)}

          {/* View + add */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex gap-1 rounded-lg bg-muted p-1"
              role="radiogroup"
              aria-label={t('classes.view')}
            >
              {(['wall', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={view === mode}
                  onClick={() => setView(mode)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm',
                    view === mode
                      ? 'bg-background shadow-sm'
                      : 'text-muted-foreground',
                  )}
                >
                  {mode === 'wall' ? (
                    <StickyNote className="size-4" />
                  ) : (
                    <List className="size-4" />
                  )}
                  {t(`classes.${mode}`)}
                </button>
              ))}
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">
              {can.add &&
                view === 'wall' &&
                (access.teacher
                  ? t('classes.hintTeacher')
                  : t('classes.hintAdd'))}
            </p>
            {can.add && (
              <Button
                className="ml-auto"
                onClick={() =>
                  setEditing({
                    kind: 'new',
                    at: freeSpot(slide.layout, notes.data),
                  })
                }
              >
                <Plus />
                {t('classes.addNoteLong')}
              </Button>
            )}
          </div>

          {view === 'wall' ? (
            <Wall
              slide={slide}
              notes={notes.data}
              uid={access.uid}
              can={can}
              onAddAt={(at) => setEditing({ kind: 'new', at })}
              onMove={(note, point) =>
                moveStickyNote(
                  boardId,
                  classId,
                  slide.id,
                  note.id,
                  point,
                ).catch((error) => {
                  fail(error)
                  throw error
                })
              }
              onOpen={(note) => setEditing({ kind: 'edit', note })}
              onReact={(note, emoji) =>
                access.uid &&
                reactToNote(
                  boardId,
                  classId,
                  slide.id,
                  note.id,
                  note.reactions,
                  { uid: access.uid, name: access.name },
                  emoji,
                ).catch(fail)
              }
            />
          ) : (
            <NoteList
              slide={slide}
              notes={notes.data}
              uid={access.uid}
              can={can}
              onOpen={(note) => setEditing({ kind: 'edit', note })}
              onReact={(note, emoji) =>
                access.uid &&
                reactToNote(
                  boardId,
                  classId,
                  slide.id,
                  note.id,
                  note.reactions,
                  { uid: access.uid, name: access.name },
                  emoji,
                ).catch(fail)
              }
            />
          )}
        </>
      )}

      {editing && (
        <NoteDialog
          editing={editing.kind === 'edit'}
          initial={
            editing.kind === 'edit'
              ? { text: editing.note.text, color: editing.note.color }
              : { text: '', color: 'yellow' }
          }
          onSave={saveNote}
          onDelete={
            editing.kind === 'edit' && currentId
              ? () =>
                  deleteStickyNote(boardId, classId, currentId, editing.note.id)
                    .then(() => toast.success(t('classes.noteDeleted')))
                    .catch((error) => {
                      fail(error)
                      throw error
                    })
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}

      {prompt && (
        <PromptDialog
          title={
            prompt === 'new'
              ? t('classes.addSlideLong')
              : t('classes.editPromptTitle', { number: index + 1 })
          }
          initial={
            prompt === 'edit' && slide
              ? promptOf(slide)
              : { title: '', instructions: '', layout: 'free', zones: [] }
          }
          onSave={async (input) => {
            try {
              if (prompt === 'new') {
                const id = await addClassSlide(boardId, classId, order, input)
                selectSlide(id)
              } else if (slide) {
                await updateClassSlide(boardId, classId, slide.id, input)
                toast.success(t('classes.promptSaved'))
              }
            } catch (error) {
              fail(error)
              throw error
            }
          }}
          onDelete={
            prompt === 'edit' && order.length > 1
              ? () => {
                  setPrompt(null)
                  setConfirm('deleteSlide')
                }
              : undefined
          }
          onClose={() => setPrompt(null)}
        />
      )}

      <AlertDialog
        open={!!confirm}
        onOpenChange={(value) => !value && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'clear'
                ? t('classes.clearTitle', { number: index + 1 })
                : t('classes.deleteSlideTitle', { number: index + 1 })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'clear'
                ? t('classes.clearBody', { count: notes.data.length })
                : t('classes.deleteSlideBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const action = confirm
                setConfirm(null)
                if (!slide) return
                if (action === 'clear')
                  clearClassSlide(boardId, classId, slide.id)
                    .then(() => toast.success(t('classes.cleared')))
                    .catch(fail)
                else
                  deleteClassSlide(boardId, classId, data, slide.id)
                    .then(() => {
                      setChosen(null)
                      toast.success(t('classes.slideDeleted'))
                    })
                    .catch(fail)
              }}
            >
              {confirm === 'clear'
                ? t('classes.clear')
                : t('classes.deleteSlide')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function promptOf(slide: ClassSlideDoc) {
  return {
    title: slide.title,
    instructions: slide.instructions,
    layout: slide.layout,
    zones: slide.zones,
  }
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
      data-testid="class-notice"
    >
      {children}
    </p>
  )
}
