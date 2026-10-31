import { useTranslation } from 'react-i18next'
import { FilterMenu } from '@/features/boards/components/FilterMenu'
import { NO_STAGE, stageCounts, stageLabel } from '@/features/stages/stages'
import type { SpaceDoc, StageDef } from '@/model'

type Props = {
  spaces: Pick<SpaceDoc, 'stage'>[]
  stages: StageDef[]
  filter: string | null
  onFilter: (filter: string | null) => void
}

/**
 * Teacher's view of the class at a glance: how many students are in each stage (from the cards
 * already loaded, no extra reads), as a bar in the "Etapa" filter; its menu lists the counts and
 * filters the board.
 */
export function StageSummary({ spaces, stages, filter, onFilter }: Props) {
  const { t } = useTranslation()
  const counts = stageCounts(spaces, stages)
  const options = [
    ...stages.map((stage) => ({
      id: stage.id,
      label: stageLabel(stage, t),
      count: counts.get(stage.id) ?? 0,
      color: stage.color,
      dashed: stage.kind === 'browsing',
    })),
    {
      id: NO_STAGE,
      label: t('stages.none'),
      count: counts.get(NO_STAGE) ?? 0,
      color: null,
    },
  ]
  const total = options.reduce((sum, option) => sum + option.count, 0)

  return (
    <FilterMenu
      label={t('stages.filter')}
      allLabel={t('stages.all')}
      options={options}
      value={filter}
      onChange={onFilter}
      testId="stage-summary"
      summary={
        total > 0 && (
          <span
            className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 sm:flex"
            aria-hidden
          >
            {options.map(
              (option) =>
                option.count > 0 && (
                  <span
                    key={option.id}
                    style={{
                      width: `${(option.count / total) * 100}%`,
                      backgroundColor: option.color ?? '#d4d4d4',
                    }}
                  />
                ),
            )}
          </span>
        )
      }
    />
  )
}
