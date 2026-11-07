import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CircleCheck,
  ClipboardCheck,
  Megaphone,
  Paintbrush,
  Pencil,
  Presentation,
  Settings,
  Timer,
} from 'lucide-react'
import { HomeLink } from '@/components/layout/HomeLink'
import { BoardSections } from '@/features/classes/components/BoardSections'
import { AnnouncementsPanel } from '@/features/announcements/components/AnnouncementsPanel'
import { NotificationBell } from '@/features/announcements/components/NotificationBell'
import { UserMenu } from '@/components/layout/UserMenu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BoardCustomizePanel,
  type BoardDraft,
} from '@/features/boards/components/BoardCustomizePanel'
import { BoardCards } from '@/features/boards/components/BoardCards'
import { FilterMenu } from '@/features/boards/components/FilterMenu'
import {
  BoardHeader,
  HeaderActionLabel,
} from '@/features/boards/components/BoardHeader'
import { useBoard } from '@/features/boards/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import { resolveLook, sortSpacesBy } from '@/features/boards/look'
import { useTeacherBoardSync } from '@/features/boards/sync'
import { AccessoryContext } from '@/features/boards/accessory-context'
import { boardTheme, hasTagline } from '@/features/boards/styles'
import { localDate } from '@/features/attendance/attendance'
import { ClockBanner } from '@/features/clock/components/ClockBanner'
import { CourseHeaderLine } from '@/features/course/components/CourseStatus'
import { useCourseState, useHeldDates, useNow } from '@/features/course/hooks'
import { ClockControls } from '@/features/clock/components/ClockControls'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import {
  matchesReady,
  READY_FILTERS,
  readyCounts,
  type ReadyFilter,
} from '@/features/spaces/ready'
import { useMyStudentId, useSpaces } from '@/features/spaces/hooks'
import { StageSummary } from '@/features/stages/components/StageSummary'
import { boardStages, matchesStage } from '@/features/stages/stages'
import { useStudents } from '@/features/students/hooks'
import { normalizeEmail } from '@/lib/collections'
import { Flip, gsap, motionAllowed, useGSAP } from '@/lib/gsap'
import { toDate } from '@/lib/time'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

// M21: the style's background animation is its own chunk (only boards with one load it)
const AmbientEffects = lazy(() =>
  import('@/features/boards/components/AmbientEffects').then((m) => ({
    default: m.AmbientEffects,
  })),
)

/** The Padlet-like board: one live card per student, in the teacher's look (M12). */
export function BoardPage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const { role, user } = useAuth()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const spaces = useSpaces(boardId, me.studentId)
  // Keep the id, not a copy: the dialog must see live changes (e.g. a new cover)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Teacher's stage filter (M11): a stage id, NO_STAGE, or null for everyone
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  // M16: "Listos / Con diapositivas / Sin diapositivas"
  const [readyFilter, setReadyFilter] = useState<ReadyFilter | null>(null)
  const [clockOpen, setClockOpen] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  // "Personalizar tablero" (M12): the draft is shown live until saved or cancelled
  const [draft, setDraft] = useState<BoardDraft | null>(null)
  const [compact, setCompact] = useState(false)
  const page = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  const ready = !spaces.loading && !me.loading

  const isBoardTeacher =
    isTeacherRole(role) &&
    !!board.data?.teacherEmails.includes(normalizeEmail(user?.email ?? ''))
  // The roster (teacher only) keeps each card's group in sync for "Por grupo"
  const students = useStudents(isBoardTeacher ? boardId : undefined)
  useTeacherBoardSync(
    isBoardTeacher ? board.data : null,
    spaces.loading ? null : spaces.data,
    students.loading ? null : students.data,
  )
  // M24: "Clase 12 de 32 · Próxima clase…" under the title, and the Calendario button
  const course = board.data?.course ?? null
  const held = useHeldDates(boardId, course, isBoardTeacher)
  const courseNow = useCourseState(course, held)
  const now = useNow()
  const look = draft ?? resolveLook(board.data)
  const stages = boardStages(board.data)
  const shown = useMemo(
    () =>
      sortSpacesBy(
        spaces.data.filter(
          (space) =>
            matchesStage(space, stages, stageFilter) &&
            matchesReady(space, readyFilter),
        ),
        look.sortBy,
        me.studentId,
      ),
    [spaces.data, stages, stageFilter, readyFilter, look.sortBy, me.studentId],
  )

  // ---------- animations (GSAP, D31: none with reduced motion) ----------

  // Layout, order or filter changes: cards glide to their new place (Flip)
  const flipState = useRef<Flip.FlipState | null>(null)
  function withFlip(update: () => void) {
    if (grid.current && motionAllowed())
      flipState.current = Flip.getState(
        grid.current.querySelectorAll('[data-flip-id]'),
      )
    update()
  }
  const arrangement = `${look.layout}|${look.sortBy}|${stageFilter}|${readyFilter}`
  useLayoutEffect(() => {
    const state = flipState.current
    flipState.current = null
    if (!state || !grid.current) return
    Flip.from(state, {
      targets: grid.current.querySelectorAll('[data-flip-id]'),
      duration: 0.55,
      ease: 'power2.inOut',
      absolute: true,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.35 },
        ),
    })
  }, [arrangement])

  // Live: a new classmate's card pops in; a card updated by someone glows for a moment
  const seen = useRef<Map<string, number> | null>(null)
  useLayoutEffect(() => {
    if (!ready) return
    const now = new Map(
      spaces.data.map((space) => [space.id, toDate(space.updatedAt).getTime()]),
    )
    const before = seen.current
    seen.current = now
    if (!before || !grid.current || !motionAllowed()) return
    for (const [id, updated] of now) {
      const element = grid.current.querySelector(`[data-flip-id="${id}"]`)
      if (!element) continue
      if (!before.has(id))
        gsap.from(element, {
          scale: 0.85,
          opacity: 0,
          duration: 0.5,
          ease: 'back.out(1.7)',
        })
      else if (before.get(id) !== updated)
        gsap.fromTo(
          element,
          { boxShadow: '0 0 0 4px rgb(250 204 21 / 0.9)' },
          {
            boxShadow: '0 0 0 0px rgb(250 204 21 / 0)',
            duration: 1.2,
            clearProps: 'boxShadow',
          },
        )
    }
  }, [ready, spaces.data])

  // First load: header items, then the cards, enter in a short stagger
  useGSAP(
    () => {
      if (!ready) return
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline()
          .from('[data-intro]', {
            y: -10,
            opacity: 0,
            duration: 0.35,
            stagger: 0.06,
            ease: 'power2.out',
          })
          .from(
            '[data-card]',
            {
              y: 16,
              opacity: 0,
              duration: 0.4,
              stagger: 0.05,
              ease: 'power2.out',
            },
            '-=0.15',
          )
      })
    },
    { scope: page, dependencies: [ready] },
  )

  // Sticky header (D29): shrinks after scrolling a bit (a plain scroll check: the board grows
  // while it loads and live, so precomputed scroll ranges would go stale)
  useEffect(() => {
    // The header only shrinks when sticky (BoardHeader: sticky && compact)
    if (!look.stickyHeader) return
    // Hysteresis: folding the header shortens the page, so it must not unfold right away
    const onScroll = () =>
      setCompact((compact) => window.scrollY > (compact ? 40 : 120))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [look.stickyHeader])

  // Background change: a soft fade (gradients can't be transitioned by CSS)
  useGSAP(
    () => {
      if (motionAllowed() && page.current)
        gsap.fromTo(
          page.current,
          { opacity: 0.75 },
          { opacity: 1, duration: 0.5 },
        )
    },
    { dependencies: [look.background, look.pattern, look.style] },
  )

  if (board.loading) {
    return (
      <section className="mx-auto max-w-7xl p-6">
        <Skeleton className="h-8 w-64" />
      </section>
    )
  }

  if (!board.data || !boardId) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
        {/* This route has no app header (the board's is the one): keep the way home */}
        <div className="flex items-center justify-between" role="banner">
          <HomeLink />
          <UserMenu />
        </div>
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const boardData = board.data
  const teacher = isTeacherRole(role)
  const writable = isWritable(lifecycleOf(boardData))
  const mySpace = spaces.data.find((space) => space.id === me.studentId)
  const editing = spaces.data.find((space) => space.id === editingId)
  // M21: the teacher's style (or the background as chosen), with its decorations
  const theme = boardTheme(look, localDate())
  const tone = theme.tone
  const accessory = (look.accessories && theme.style?.accessory) || null
  const tagline =
    look.tagline ||
    (hasTagline(theme.style?.id)
      ? t(`styles.taglines.${theme.style.id}`, {
          year: new Date().getFullYear(),
        })
      : '')

  return (
    <AccessoryContext.Provider value={accessory}>
      <div
        ref={page}
        className="min-h-svh transition-colors duration-500"
        style={theme.css}
        data-testid="board-page"
        data-background={look.background}
        data-board-style={theme.style?.id}
      >
        {look.ambient && theme.style?.ambient && motionAllowed() && (
          <Suspense>
            <AmbientEffects kind={theme.style.ambient} />
          </Suspense>
        )}
        <ClockBanner
          boardId={boardId}
          clock={boardData.clock}
          teacher={isBoardTeacher}
        />
        <BoardHeader
          ref={header}
          board={boardData}
          title={draft?.title ?? boardData.title}
          description={draft?.description ?? boardData.description}
          studentCount={spaces.data.length}
          tone={tone}
          backdrop={theme.backdrop}
          notifications={<NotificationBell boardId={boardId} />}
          garland={theme.style?.garland}
          tagline={tagline}
          sticky={look.stickyHeader}
          compact={compact}
          actions={
            <>
              {mySpace && writable && (
                <Button
                  title={t('dashboard.editMine')}
                  onClick={() => setEditingId(mySpace.id)}
                >
                  <Pencil />
                  <HeaderActionLabel>
                    {t('dashboard.editMine')}
                  </HeaderActionLabel>
                </Button>
              )}
              {teacher && spaces.data.some((space) => space.slideCount > 0) && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  title={t('presenter.presentAll')}
                  render={<Link to={`/b/${boardId}/present`} />}
                >
                  <Presentation />
                  <HeaderActionLabel>
                    {t('presenter.presentAll')}
                  </HeaderActionLabel>
                </Button>
              )}
              {teacher && readyCounts(spaces.data).ready > 0 && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  title={t('ready.presentReady')}
                  render={<Link to={`/b/${boardId}/present?ready=1`} />}
                >
                  <CircleCheck />
                  <HeaderActionLabel>
                    {t('ready.presentReady')}
                  </HeaderActionLabel>
                </Button>
              )}
              {isBoardTeacher && (
                <Button
                  variant="secondary"
                  title={t('clock.button')}
                  onClick={() => setClockOpen(true)}
                >
                  <Timer />
                  <HeaderActionLabel>{t('clock.button')}</HeaderActionLabel>
                </Button>
              )}
              {isBoardTeacher && (
                <Button
                  variant="secondary"
                  title={t('announcements.panel')}
                  onClick={() => setAnnouncing(true)}
                >
                  <Megaphone />
                  <HeaderActionLabel>
                    {t('announcements.panel')}
                  </HeaderActionLabel>
                </Button>
              )}
              {isBoardTeacher && (
                <Button
                  variant="secondary"
                  title={t('attendance.button')}
                  nativeButton={false}
                  render={<Link to={`/teacher/boards/${boardId}/attendance`} />}
                >
                  <ClipboardCheck />
                  <HeaderActionLabel>
                    {t('attendance.button')}
                  </HeaderActionLabel>
                </Button>
              )}
              {isBoardTeacher && (
                <Button
                  variant="secondary"
                  title={t('look.customize')}
                  onClick={() =>
                    setDraft({
                      ...resolveLook(boardData),
                      title: boardData.title,
                      description: boardData.description,
                    })
                  }
                >
                  <Paintbrush />
                  <HeaderActionLabel>{t('look.customize')}</HeaderActionLabel>
                </Button>
              )}
              {teacher && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  title={t('boards.manage')}
                  render={<Link to={`/teacher/boards/${boardId}`} />}
                >
                  <Settings />
                  <HeaderActionLabel>{t('boards.manage')}</HeaderActionLabel>
                </Button>
              )}
            </>
          }
        >
          <CourseHeaderLine
            state={courseNow}
            today={now.date}
            showCounter={isBoardTeacher || course?.showCounter !== false}
          />
          {teacher && spaces.data.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <StageSummary
                spaces={spaces.data}
                stages={stages}
                filter={stageFilter}
                onFilter={(filter) => withFlip(() => setStageFilter(filter))}
              />
              <ReadyFilters
                counts={readyCounts(spaces.data)}
                filter={readyFilter}
                onFilter={(filter) => withFlip(() => setReadyFilter(filter))}
              />
              {(stageFilter !== null || readyFilter !== null) && (
                <button
                  type="button"
                  className="px-1 text-sm underline underline-offset-2"
                  onClick={() =>
                    withFlip(() => {
                      setStageFilter(null)
                      setReadyFilter(null)
                    })
                  }
                >
                  {t('stages.showAll')}
                </button>
              )}
            </div>
          )}
        </BoardHeader>
        <section className="relative z-[1] mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
          {(teacher || mySpace) && (
            <BoardSections boardId={boardId} tone={tone} />
          )}
          {isBoardTeacher && announcing && (
            <AnnouncementsPanel
              boardId={boardId}
              members={spaces.data.length}
              onClose={() => setAnnouncing(false)}
            />
          )}
          {isBoardTeacher && (
            <ClockControls
              boardId={boardId}
              clock={boardData.clock}
              open={clockOpen}
              onOpenChange={setClockOpen}
            />
          )}

          {!writable && (
            <p className="rounded-lg bg-white/80 p-3 text-sm text-neutral-900">
              {t('dashboard.readOnly')}
            </p>
          )}

          {!ready ? (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {[40, 56, 32, 48].map((height, index) => (
                <Skeleton
                  key={index}
                  className="mb-4 break-inside-avoid bg-white/60"
                  style={{ height: height * 4 }}
                />
              ))}
            </div>
          ) : spaces.data.length === 0 ? (
            <div className="rounded-xl bg-white/80 p-8 text-center text-neutral-900">
              <p className="font-medium">{t('dashboard.emptyTitle')}</p>
              <p className="text-sm text-neutral-600">
                {teacher
                  ? t('dashboard.emptyTeacher')
                  : t('dashboard.emptyStudent')}
              </p>
            </div>
          ) : (
            <BoardCards
              ref={grid}
              boardId={boardId}
              spaces={shown}
              layout={look.layout}
              stages={stages}
              myStudentId={me.studentId}
              teacher={teacher}
              tone={tone}
              onEdit={writable ? setEditingId : undefined}
            />
          )}
        </section>

        {editing && (
          <SpaceProfileDialog
            key={editing.id}
            boardId={boardId}
            space={editing}
            stages={stages}
            open
            onOpenChange={(open) => !open && setEditingId(null)}
          />
        )}

        {draft && (
          <BoardCustomizePanel
            board={boardData}
            draft={draft}
            onChange={(next) =>
              next.layout !== draft.layout || next.sortBy !== draft.sortBy
                ? withFlip(() => setDraft(next))
                : setDraft(next)
            }
            onClose={() => withFlip(() => setDraft(null))}
          />
        )}
      </div>
    </AccessoryContext.Provider>
  )
}

/** "Avance: Listos · Con diapositivas · Sin diapositivas" (M16, D52); "Todos" shows everyone. */
function ReadyFilters({
  counts,
  filter,
  onFilter,
}: {
  counts: Record<ReadyFilter, number>
  filter: ReadyFilter | null
  onFilter: (filter: ReadyFilter | null) => void
}) {
  const { t } = useTranslation()
  const labels = {
    ready: 'ready.ready',
    withSlides: 'ready.withSlides',
    noSlides: 'ready.noSlides',
  } as const
  return (
    <FilterMenu
      label={t('ready.label')}
      allLabel={t('ready.all')}
      options={READY_FILTERS.map((id) => ({
        id,
        label: t(labels[id]),
        count: counts[id],
      }))}
      value={filter}
      onChange={(value) => onFilter(value as ReadyFilter | null)}
      testId="ready-filters"
    />
  )
}
