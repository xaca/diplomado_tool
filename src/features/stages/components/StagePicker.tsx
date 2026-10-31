import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import { stageLabel } from '@/features/stages/stages'
import { cn } from '@/lib/utils'
import type { StageDef } from '@/model'

type Props = {
  stages: StageDef[]
  value: string | null
  onChange: (stage: string | null) => void
  disabled?: boolean
  /** Shown above the chips (the fieldset legend) */
  legend: string
  hint?: string
}

/** One chip per stage plus "Sin etapa". The browsing stage comes last, set apart. */
export function StagePicker({
  stages,
  value,
  onChange,
  disabled,
  legend,
  hint,
}: Props) {
  const { t } = useTranslation()
  const steps = stages.filter((stage) => stage.kind === 'stage')
  const others = stages.filter((stage) => stage.kind === 'browsing')

  const chip = (stage: StageDef | null, index?: number) => {
    const selected = (stage?.id ?? null) === value
    return (
      <button
        key={stage?.id ?? 'none'}
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        onClick={() => onChange(stage?.id ?? null)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors disabled:opacity-50',
          selected
            ? 'border-transparent text-white'
            : 'bg-background hover:bg-muted',
          stage?.kind === 'browsing' && !selected && 'border-dashed',
        )}
        style={
          selected
            ? { backgroundColor: stage?.color ?? 'var(--color-neutral-500)' }
            : undefined
        }
      >
        {stage ? (
          stage.kind === 'browsing' ? (
            <Eye className="size-3.5" />
          ) : (
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: selected ? '#fff' : stage.color }}
            />
          )
        ) : null}
        {index !== undefined && (
          <span className="text-xs opacity-70">{index + 1}.</span>
        )}
        {stage ? stageLabel(stage, t) : t('stages.none')}
      </button>
    )
  }

  return (
    <fieldset className="flex flex-col gap-2" data-testid="stage-picker">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {steps.map((stage, index) => chip(stage, index))}
      </div>
      <div className="flex flex-wrap gap-2">
        {others.map((stage) => chip(stage))}
        {chip(null)}
      </div>
    </fieldset>
  )
}
