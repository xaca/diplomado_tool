import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Paintbrush, Presentation, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BoardCustomizePanel,
  type BoardDraft,
} from '@/features/boards/components/BoardCustomizePanel'
import { BoardCards } from '@/features/boards/components/BoardCards'
import { BoardHeader } from '@/features/boards/components/BoardHeader'
import { useBoard } from '@/features/boards/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import {
  backgroundOf,
  boardStyle,
  resolveLook,
  sortSpacesBy,
} from '@/features/boards/look'
import { useTeacherBoardSync } from '@/features/boards/sync'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import { useMyStudentId, useSpaces } from '@/features/spaces/hooks'
import { StageSummary } from '@/features/stages/components/StageSummary'
import { boardStages, matchesStage } from '@/features/stages/stages'
import { useStudents } from '@/features/students/hooks'
import { normalizeEmail } from '@/lib/collections'
import { Flip, gsap, motionAllowed, useGSAP } from '@/lib/gsap'
import { toDate } from '@/lib/time'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

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

  const look = draft ?? resolveLook(board.data)
  const stages = boardStages(board.data)
  const shown = useMemo(
    () =>
      sortSpacesBy(
        spaces.data.filter((space) => matchesStage(space, stages, stageFilter)),
        look.sortBy,
        me.studentId,
      ),
    [spaces.data, stages, stageFilter, look.sortBy, me.studentId],
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
  const arrangement = `${look.layout}|${look.sortBy}|${stageFilter}`
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
    const onScroll = () => setCompact(window.scrollY > 120)
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
    { dependencies: [look.background, look.pattern] },
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
      <section className="mx-auto max-w-5xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const boardData = board.data
  const teacher = isTeacherRole(role)
  const writable = isWritable(lifecycleOf(boardData))
  const mySpace = spaces.data.find((space) => space.id === me.studentId)
  const editing = spaces.data.find((space) => space.id === editingId)
  const tone = backgroundOf(look).text

  return (
    <div
      ref={page}
      className="min-h-[calc(100svh-3.5rem)] transition-colors duration-500"
      style={boardStyle(look)}
      data-testid="board-page"
      data-background={look.background}
    >
      <section className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <BoardHeader
          ref={header}
          board={boardData}
          title={draft?.title ?? boardData.title}
          description={draft?.description ?? boardData.description}
          studentCount={spaces.data.length}
          tone={tone}
          backdrop={backgroundOf(look).stops[0]}
          sticky={look.stickyHeader}
          compact={compact}
          actions={
            <>
              {mySpace && writable && (
                <Button onClick={() => setEditingId(mySpace.id)}>
                  {t('dashboard.editMine')}
                </Button>
              )}
              {teacher && spaces.data.some((space) => space.slideCount > 0) && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link to={`/b/${boardId}/present`} />}
                >
                  <Presentation />
                  {t('presenter.presentAll')}
                </Button>
              )}
              {isBoardTeacher && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setDraft({
                      ...resolveLook(boardData),
                      title: boardData.title,
                      description: boardData.description,
                    })
                  }
                >
                  <Paintbrush />
                  {t('look.customize')}
                </Button>
              )}
              {teacher && (
                <Button
                  variant="secondary"
                  nativeButton={false}
                  render={<Link to={`/teacher/boards/${boardId}`} />}
                >
                  <Settings />
                  {t('boards.manage')}
                </Button>
              )}
            </>
          }
        >
          {teacher && spaces.data.length > 0 && (
            <StageSummary
              spaces={spaces.data}
              stages={stages}
              filter={stageFilter}
              onFilter={(filter) => withFlip(() => setStageFilter(filter))}
            />
          )}
        </BoardHeader>

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
  )
}
