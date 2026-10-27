import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Presentation, Settings, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import { SpaceCard } from '@/features/spaces/components/SpaceCard'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import { useMyStudentId, useSpaces } from '@/features/spaces/hooks'
import { gsap, useGSAP } from '@/lib/gsap'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** The Padlet-like board: one live card per student. */
export function BoardPage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const { role } = useAuth()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const spaces = useSpaces(boardId, me.studentId)
  // Keep the id, not a copy: the dialog must see live changes (e.g. a new cover)
  const [editingId, setEditingId] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const ready = !spaces.loading && !me.loading

  // Cards fade in once on first load (live updates later don't re-animate)
  useGSAP(
    () => {
      if (!ready) return
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-card]', {
          y: 16,
          opacity: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: 'power2.out',
        })
      })
    },
    { scope: grid, dependencies: [ready] },
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

  const teacher = isTeacherRole(role)
  const writable = isWritable(lifecycleOf(board.data))
  const mySpace = spaces.data.find((space) => space.id === me.studentId)
  const editing = spaces.data.find((space) => space.id === editingId)

  return (
    <div className="board-background min-h-[calc(100svh-3.5rem)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1 text-sm text-neutral-700">
              <Users className="size-4" />
              {t('dashboard.students', { count: spaces.data.length })}
            </p>
            <h1
              className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl"
              data-testid="board-title"
            >
              {board.data.title}
            </h1>
            {board.data.description && (
              <p className="max-w-3xl text-neutral-800">
                {board.data.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
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
          </div>
        </header>

        {!writable && (
          <p className="rounded-lg bg-white/80 p-3 text-sm">
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
          <div className="rounded-xl bg-white/80 p-8 text-center">
            <p className="font-medium">{t('dashboard.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {teacher
                ? t('dashboard.emptyTeacher')
                : t('dashboard.emptyStudent')}
            </p>
          </div>
        ) : (
          <div
            ref={grid}
            className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4"
            data-testid="board-grid"
          >
            {spaces.data.map((space) => (
              <SpaceCard
                key={space.id}
                boardId={boardId}
                space={space}
                isMine={space.id === me.studentId}
                canPresent={teacher}
                onEdit={writable ? () => setEditingId(space.id) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <SpaceProfileDialog
          key={editing.id}
          boardId={boardId}
          space={editing}
          open
          onOpenChange={(open) => !open && setEditingId(null)}
        />
      )}
    </div>
  )
}
