import { useTranslation } from 'react-i18next'
import { NO_STAGE, stageCounts, stageLabel } from '@/features/stages/stages'
import { cn } from '@/lib/utils'
import type { SpaceDoc, StageDef } from '@/model'

type Props = {
  spaces: Pick<SpaceDoc, 'stage'>[]
  stages: StageDef[]
  filter: string | null
  onFilter: (filter: string | null) => void
}

/**
 * Teacher's view of the class at a glance: how many students are in each stage (from the cards
 * already loaded, no extra reads). Clicking a stage filters the board; clicking it again clears.
 */
export function StageSummary({ spaces, stages, filter, onFilter }: Props) {
  const { t } = useTranslation()
  const counts = stageCounts(spaces, stages)
  const items = [
    ...stages.map((stage) => ({
      id: stage.id,
      label: stageLabel(stage, t),
      color: stage.color,
      dashed: stage.kind === 'browsing',
    })),
    { id: NO_STAGE, label: t('stages.none'), color: null, dashed: false },
  ]

  return (
    <nav
      aria-label={t('stages.summary')}
      className="flex flex-wrap items-center gap-2"
      data-testid="stage-summary"
    >
      {items.map((item) => {
        const active = filter === item.id
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onFilter(active ? null : item.id)}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-full border bg-white/85 px-2.5 text-xs text-neutral-800 shadow-sm transition-colors hover:bg-white',
              item.dashed && 'border-dashed border-neutral-400',
              active && 'ring-2 ring-neutral-900',
            )}
          >
            <span
              className="size-2.5 rounded-full border border-black/10"
              style={{ backgroundColor: item.color ?? 'transparent' }}
            />
            {item.label}
            <span className="font-semibold">{counts.get(item.id) ?? 0}</span>
          </button>
        )
      })}
      {filter !== null && (
        <button
          type="button"
          className="text-xs text-neutral-800 underline"
          onClick={() => onFilter(null)}
        >
          {t('stages.showAll')}
        </button>
      )}
    </nav>
  )
}
