import { forwardRef } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Presentation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { boardColumns } from '@/features/boards/look'
import type { Space } from '@/features/spaces/api'
import { SpaceCard } from '@/features/spaces/components/SpaceCard'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { findStage, stageLabel } from '@/features/stages/stages'
import { formatRelative, toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { BoardLayout, StageDef } from '@/model'

type Props = {
  boardId: string
  spaces: Space[]
  layout: BoardLayout
  stages: StageDef[]
  myStudentId: string | null
  teacher: boolean
  /** Text color on the board background (for column titles) */
  tone: 'dark' | 'light'
  onEdit?: (spaceId: string) => void
}

/**
 * The board's cards in the teacher's layout (M12, D27): Muro (masonry), Cuadrícula, Lista,
 * Por etapa and Por grupo (columns). Every card carries `data-flip-id` so BoardPage can animate
 * layout / filter / order changes with GSAP Flip.
 */
export const BoardCards = forwardRef<HTMLDivElement, Props>(function BoardCards(
  { boardId, spaces, layout, stages, myStudentId, teacher, tone, onEdit },
  ref,
) {
  const { t } = useTranslation()
  const card = (space: Space, fit: 'flow' | 'cell' = 'flow') => (
    <SpaceCard
      key={space.id}
      boardId={boardId}
      space={space}
      fit={fit}
      stage={findStage(stages, space.stage)}
      isMine={space.id === myStudentId}
      canPresent={teacher}
      onEdit={onEdit ? () => onEdit(space.id) : undefined}
    />
  )

  if (layout === 'stages' || layout === 'groups') {
    return (
      <div
        ref={ref}
        className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
        data-testid="board-grid"
        data-layout={layout}
      >
        {boardColumns(spaces, layout, stages).map((column) => (
          <section
            key={column.id}
            className="flex w-72 shrink-0 snap-start flex-col gap-3"
            data-testid="board-column"
            data-column={column.id}
          >
            <header
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm',
                tone === 'light'
                  ? 'bg-white/15 text-white'
                  : 'bg-white/80 text-neutral-900',
              )}
            >
              <span
                className={cn(
                  'size-3 rounded-full border border-black/10',
                  column.stage?.kind === 'browsing' && 'border-dashed',
                )}
                style={{
                  backgroundColor: column.stage?.color ?? 'transparent',
                }}
              />
              <span className="flex-1 truncate">
                {column.stage
                  ? stageLabel(column.stage, t)
                  : (column.label ??
                    (layout === 'stages'
                      ? t('stages.none')
                      : t('look.noGroup')))}
              </span>
              <span className="text-xs font-normal opacity-70">
                {t('look.columnCount', { count: column.spaces.length })}
              </span>
            </header>
            {column.spaces.length === 0 ? (
              <p
                className={cn(
                  'rounded-lg border border-dashed p-4 text-center text-xs',
                  tone === 'light'
                    ? 'border-white/30 text-white/70'
                    : 'border-black/15 text-neutral-600',
                )}
              >
                {t('look.emptyColumn')}
              </p>
            ) : (
              <div>{column.spaces.map((space) => card(space))}</div>
            )}
          </section>
        ))}
      </div>
    )
  }

  if (layout === 'list') {
    return (
      <div
        ref={ref}
        className="flex flex-col gap-2"
        data-testid="board-grid"
        data-layout={layout}
      >
        {spaces.map((space) => (
          <SpaceRow
            key={space.id}
            boardId={boardId}
            space={space}
            stage={findStage(stages, space.stage)}
            canPresent={teacher}
            isMine={space.id === myStudentId}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={
        layout === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4'
      }
      data-testid="board-grid"
      data-layout={layout}
    >
      {spaces.map((space) => card(space, layout === 'grid' ? 'cell' : 'flow'))}
    </div>
  )
})

/** "Lista": one compact row per student. */
function SpaceRow({
  boardId,
  space,
  stage,
  canPresent,
  isMine,
}: {
  boardId: string
  space: Space
  stage: StageDef | null
  canPresent: boolean
  isMine: boolean
}) {
  const { t, i18n } = useTranslation()
  return (
    <article
      data-card
      data-flip-id={space.id}
      data-testid="space-card"
      className="flex items-center gap-3 rounded-xl border border-black/5 px-3 py-2 shadow-sm"
      style={{ backgroundColor: space.color }}
    >
      <StageAvatar
        name={space.ownerName}
        photoURL={space.ownerPhotoURL}
        stage={stage}
        size={36}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {space.ownerName}
          {isMine && (
            <span className="ml-2 text-xs font-normal text-neutral-500">
              · {t('space.mine')}
            </span>
          )}
        </p>
        <p className="truncate text-sm text-neutral-700">
          {space.title || (
            <span className="text-neutral-500 italic">{t('space.empty')}</span>
          )}
        </p>
      </div>
      <span className="hidden text-xs text-neutral-500 sm:inline">
        {t('space.slides', { count: space.slideCount })} ·{' '}
        {formatRelative(toDate(space.updatedAt), i18n.resolvedLanguage ?? 'es')}
      </span>
      {canPresent && space.slideCount > 0 && (
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          className="text-neutral-700"
          aria-label={t('presenter.present')}
          render={<Link to={`/b/${boardId}/present/${space.id}`} />}
        >
          <Presentation />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        className="text-neutral-700"
        render={<Link to={`/b/${boardId}/s/${space.id}`} />}
      >
        {t('space.open')}
        <ArrowUpRight />
      </Button>
    </article>
  )
}
