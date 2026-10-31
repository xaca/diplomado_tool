import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Eye, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveBoardStages } from '@/features/stages/api'
import {
  boardStages,
  newStageId,
  nextStageColor,
  stageLabel,
} from '@/features/stages/stages'
import type { WithId } from '@/lib/firestore-hooks'
import {
  DEFAULT_STAGE_IDS,
  MAX_STAGE_LABEL,
  MAX_STAGES,
  STAGE_COLORS,
  type BoardDoc,
  type StageDef,
} from '@/model'

/**
 * Teacher board page (M11): the board's stages. Rename, recolor, reorder, add or remove; a new
 * board uses the Design Thinking stages. Cards on a removed stage show no ring (their value stays).
 */
export function StagesPanel({ board }: { board: WithId<BoardDoc> }) {
  const { t } = useTranslation()
  const [stages, setStages] = useState<StageDef[]>(() => boardStages(board))
  const [saving, setSaving] = useState(false)
  const custom = !!board.stages?.length

  const update = (index: number, change: Partial<StageDef>) =>
    setStages((list) =>
      list.map((stage, i) => (i === index ? { ...stage, ...change } : stage)),
    )
  const move = (index: number, by: number) =>
    setStages((list) => {
      const next = [...list]
      const [stage] = next.splice(index, 1)
      next.splice(index + by, 0, stage)
      return next
    })
  const cycleColor = (index: number) => {
    const current = STAGE_COLORS.indexOf(
      stages[index].color as (typeof STAGE_COLORS)[number],
    )
    update(index, {
      color: STAGE_COLORS[(current + 1) % STAGE_COLORS.length],
    })
  }

  async function save(next: StageDef[] | null) {
    setSaving(true)
    try {
      await saveBoardStages(board.id, next)
      if (next === null) setStages(boardStages(null))
      toast.success(t('stages.saved'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="stages-panel"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{t('stages.panelTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('stages.panelHint')}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex items-center gap-2">
            <button
              type="button"
              className="size-7 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-black/10"
              style={{ backgroundColor: stage.color }}
              aria-label={t('stages.changeColor')}
              onClick={() => cycleColor(index)}
            />
            {stage.kind === 'browsing' && (
              <Eye
                className="size-4 shrink-0 text-muted-foreground"
                aria-label={t('stages.browsingKind')}
              />
            )}
            <Input
              value={stage.label ?? ''}
              maxLength={MAX_STAGE_LABEL}
              placeholder={
                DEFAULT_STAGE_IDS.includes(stage.id)
                  ? stageLabel({ ...stage, label: undefined }, t)
                  : t('stages.newName')
              }
              aria-label={t('stages.name', { n: index + 1 })}
              onChange={(event) =>
                update(index, { label: event.target.value || undefined })
              }
              className="h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              aria-label={t('stages.up')}
              onClick={() => move(index, -1)}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === stages.length - 1}
              aria-label={t('stages.down')}
              onClick={() => move(index, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={stages.length === 1}
              aria-label={t('stages.remove')}
              onClick={() =>
                setStages((list) => list.filter((_, i) => i !== index))
              }
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={stages.length >= MAX_STAGES}
            onClick={() =>
              setStages((list) => [
                ...list,
                {
                  id: newStageId(list),
                  label: '',
                  color: nextStageColor(list),
                  kind: 'stage',
                },
              ])
            }
          >
            <Plus />
            {t('stages.add')}
          </Button>
          {custom && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => void save(null)}
            >
              <RotateCcw />
              {t('stages.reset')}
            </Button>
          )}
        </div>
        <Button
          type="button"
          disabled={
            saving ||
            stages.some(
              (stage) =>
                !DEFAULT_STAGE_IDS.includes(stage.id) && !stage.label?.trim(),
            )
          }
          onClick={() => void save(stages)}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </section>
  )
}
