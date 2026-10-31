import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  Maximize,
  Minimize,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { SlideOverview } from '@/features/presenter/components/SlideOverview'
import {
  clampSlide,
  keyToMove,
  move,
  type Move,
} from '@/features/presenter/navigation'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { preloadSlide } from '@/features/slides/engine/use-slide-svg'
import { useSlides } from '@/features/slides/hooks'
import { useMyStudentId, useSpaces } from '@/features/spaces/hooks'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { boardStages, findStage } from '@/features/stages/stages'
import { gsap, useGSAP } from '@/lib/gsap'
import { cn } from '@/lib/utils'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

const IDLE_MS = 2_500
const SWIPE_PX = 60

/**
 * Presentation mode (PLAN.md → F5, M6): one slide filling the screen, ←/→ slides, ↑/↓ students.
 * The teacher presents every student with slides; a student presents only their own space.
 */
export function PresenterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { boardId, studentId: param } = useParams()
  const { role } = useAuth()
  const teacher = isTeacherRole(role)
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  // Board order (join order), not "my card first"
  const spaces = useSpaces(boardId, null)

  const students = useMemo(
    () =>
      teacher
        ? spaces.data.filter(
            (space) => space.slideCount > 0 || space.id === param,
          )
        : spaces.data.filter((space) => space.id === me.studentId),
    [teacher, spaces.data, param, me.studentId],
  )
  const currentId = param ?? students[0]?.id
  const studentIndex = students.findIndex((space) => space.id === currentId)
  const space = students[studentIndex]
  const nextSpace = students[studentIndex + 1]

  const slides = useSlides(boardId, space?.id, space?.slideOrder)
  // The next student's slides are read ahead, so ↓ / → at the end shows at once
  const nextSlides = useSlides(boardId, nextSpace?.id, nextSpace?.slideOrder)

  const [position, setPosition] = useState({
    studentId: currentId,
    slide: 0,
  })
  const rawSlide = position.studentId === currentId ? position.slide : 0
  const slideIndex = clampSlide(rawSlide, slides.data.length)
  const slide = slides.data[slideIndex]

  const [overview, setOverview] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [idle, setIdle] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const direction = useRef<{ axis: 'x' | 'y'; sign: number }>({
    axis: 'x',
    sign: 1,
  })
  const swipeStart = useRef<number | null>(null)

  function exit() {
    if (document.fullscreenElement) void document.exitFullscreen()
    // Back to where the presentation was started (board, card or space page)
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) void navigate(-1)
    else void navigate(`/b/${boardId}`)
  }

  function go(action: Move) {
    if (studentIndex < 0) return
    const next = move({ student: studentIndex, slide: rawSlide }, action, {
      students: students.length,
      slides: slides.data.length,
    })
    if (next.student === studentIndex && next.slide === rawSlide) return
    const target = students[next.student]
    direction.current =
      next.student !== studentIndex
        ? { axis: 'y', sign: next.student > studentIndex ? 1 : -1 }
        : { axis: 'x', sign: next.slide > slideIndex ? 1 : -1 }
    setPosition({ studentId: target.id, slide: next.slide })
    if (target.id !== currentId)
      void navigate(`/b/${boardId}/present/${target.id}`, { replace: true })
  }

  function pick(index: number) {
    direction.current = { axis: 'x', sign: index >= slideIndex ? 1 : -1 }
    setPosition({ studentId: currentId, slide: index })
    setOverview(false)
  }

  function pickStudent(id: string) {
    if (id === currentId) return
    direction.current = { axis: 'y', sign: 1 }
    setPosition({ studentId: id, slide: 0 })
    void navigate(`/b/${boardId}/present/${id}`, { replace: true })
  }

  function toggleFullscreen() {
    // The whole document, so menus (portals) stay visible in full screen
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  // Keyboard: read the latest handlers without re-subscribing on every render
  const keys = useRef({ go, exit, toggleFullscreen, overview })
  useLayoutEffect(() => {
    keys.current = { go, exit, toggleFullscreen, overview }
  })
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      // Leave keys alone inside menus and buttons that use them (Space/Enter activate buttons)
      if (target?.closest('[role="menu"], input, textarea')) return
      const handlers = keys.current
      if (event.key === 'Escape') {
        if (handlers.overview) setOverview(false)
        // In full screen the browser uses Esc to leave it; otherwise Esc leaves the presentation
        else if (!document.fullscreenElement) handlers.exit()
        return
      }
      if (event.key === 'f' || event.key === 'F')
        return handlers.toggleFullscreen()
      if (event.key === 'o' || event.key === 'O')
        return setOverview(!handlers.overview)
      if (handlers.overview) return
      if (event.key === ' ' && target?.closest('button')) return
      const action = keyToMove(event.key)
      if (!action) return
      event.preventDefault()
      handlers.go(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Controls fade out while nobody moves the mouse
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), IDLE_MS)
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), IDLE_MS)
    }
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])

  // Render the neighbours ahead of time (SVG cache + images)
  useEffect(() => {
    for (const neighbour of [
      slides.data[slideIndex + 1],
      slides.data[slideIndex - 1],
      nextSlides.data[0],
    ]) {
      if (neighbour)
        preloadSlide(neighbour, {
          present: true,
          embeds: true,
          inlineFonts: true,
        })
    }
  }, [slides.data, nextSlides.data, slideIndex])

  // Slide transition: sideways for slides, vertical for students; none with reduced motion
  const slideKey = `${currentId}:${slide?.id ?? 'none'}`
  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        const { axis, sign } = direction.current
        gsap.fromTo(
          stage.current,
          { opacity: 0, [axis]: 48 * sign },
          { opacity: 1, [axis]: 0, duration: 0.35, ease: 'power2.out' },
        )
      })
    },
    { dependencies: [slideKey], scope: stage },
  )

  if (board.loading || spaces.loading || me.loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-neutral-950">
        <Skeleton className="aspect-video w-[min(90vw,160svh)] bg-white/10" />
      </div>
    )
  }
  if (!boardId || !board.data) return <Navigate to="/" replace />
  // Students present only their own space; anything else opens the read-only viewer
  if (!teacher && param && param !== me.studentId)
    return <Navigate to={`/b/${boardId}/s/${param}`} replace />
  if (!teacher && !me.studentId)
    return <Navigate to={`/b/${boardId}`} replace />

  const showStudents = teacher && students.length > 1
  const controlButton =
    'text-white hover:bg-white/15 hover:text-white disabled:opacity-30'

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col overflow-hidden bg-neutral-950 text-white',
        idle && !overview && 'cursor-none',
      )}
      data-testid="presenter"
    >
      <header
        className={cn(
          'flex items-center gap-3 px-4 py-2 text-sm transition-opacity duration-500',
          idle && 'opacity-0',
        )}
      >
        {space && (
          <StageAvatar
            name={space.ownerName}
            photoURL={space.ownerPhotoURL}
            stage={findStage(boardStages(board.data), space.stage)}
            size={36}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" data-testid="presenter-student">
            {space?.ownerName}
          </p>
          {space?.title && (
            <p className="truncate text-xs text-white/60">{space.title}</p>
          )}
        </div>
        {showStudents && (
          <span className="text-xs text-white/60">
            {t('presenter.studentOf', {
              current: studentIndex + 1,
              total: students.length,
            })}
          </span>
        )}
      </header>

      <main
        className="flex min-h-0 flex-1 items-center justify-center px-2"
        onPointerDown={(event) => {
          swipeStart.current =
            event.pointerType === 'mouse' ? null : event.clientX
        }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return
          const dx = event.clientX - swipeStart.current
          swipeStart.current = null
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 'nextSlide' : 'prevSlide')
        }}
      >
        <div
          ref={stage}
          className="w-[min(100%,calc((100svh-7rem)*16/9))]"
          data-testid="presenter-stage"
          data-slide={slideIndex + 1}
        >
          {slides.loading ? (
            <Skeleton className="aspect-video w-full bg-white/10" />
          ) : slide ? (
            <SlidePreview slide={slide} present className="rounded-md" />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md bg-white/5 p-6 text-center text-white/70">
              {students.length === 0
                ? t('presenter.nobody')
                : t('presenter.noSlides')}
            </div>
          )}
        </div>
      </main>

      <footer
        className={cn(
          'flex flex-wrap items-center justify-center gap-1 px-2 py-2 transition-opacity duration-500',
          idle && !overview && 'opacity-0',
        )}
        aria-label={t('presenter.controls')}
      >
        <Button
          variant="ghost"
          size="icon"
          className={controlButton}
          aria-label={t('presenter.exit')}
          onClick={exit}
        >
          <X />
        </Button>
        {showStudents && (
          <Button
            variant="ghost"
            size="icon"
            className={controlButton}
            aria-label={t('presenter.prevStudent')}
            disabled={studentIndex <= 0}
            onClick={() => go('prevStudent')}
          >
            <ChevronUp />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={controlButton}
          aria-label={t('presenter.prevSlide')}
          disabled={studentIndex <= 0 && slideIndex <= 0}
          onClick={() => go('prevSlide')}
        >
          <ChevronLeft />
        </Button>
        <span
          className="min-w-16 text-center text-sm tabular-nums"
          data-testid="presenter-counter"
          aria-live="polite"
        >
          {slides.data.length
            ? `${slideIndex + 1} / ${slides.data.length}`
            : '–'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={controlButton}
          aria-label={t('presenter.nextSlide')}
          disabled={
            studentIndex >= students.length - 1 &&
            slideIndex >= slides.data.length - 1
          }
          onClick={() => go('nextSlide')}
        >
          <ChevronRight />
        </Button>
        {showStudents && (
          <Button
            variant="ghost"
            size="icon"
            className={controlButton}
            aria-label={t('presenter.nextStudent')}
            disabled={studentIndex >= students.length - 1}
            onClick={() => go('nextStudent')}
          >
            <ChevronDown />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={controlButton}
          aria-label={t('presenter.overview')}
          disabled={slides.data.length === 0}
          onClick={() => setOverview(true)}
        >
          <LayoutGrid />
        </Button>
        {showStudents && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className={controlButton}
                  aria-label={t('presenter.pickStudent')}
                />
              }
            >
              <Users />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className="max-h-[60svh] w-64"
            >
              <DropdownMenuRadioGroup
                value={currentId}
                onValueChange={(id) => pickStudent(String(id))}
              >
                {students.map((student) => (
                  <DropdownMenuRadioItem key={student.id} value={student.id}>
                    <span className="flex-1 truncate">{student.ownerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {student.slideCount}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {document.fullscreenEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className={controlButton}
            aria-label={
              fullscreen
                ? t('presenter.exitFullscreen')
                : t('presenter.fullscreen')
            }
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </Button>
        )}
      </footer>

      {overview && (
        <SlideOverview
          slides={slides.data}
          current={slideIndex}
          onPick={pick}
          onClose={() => setOverview(false)}
        />
      )}
    </div>
  )
}
