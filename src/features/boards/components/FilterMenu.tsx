import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type FilterOption = {
  id: string
  label: string
  count: number
  /** A stage color dot (null: an empty dot) */
  color?: string | null
  dashed?: boolean
}

const ALL = '__all__'

function Dot({ option }: { option: FilterOption }) {
  if (option.color === undefined) return null
  return (
    <span
      className={cn(
        'size-2.5 shrink-0 rounded-full border border-black/10',
        option.dashed && 'border-dashed border-neutral-500',
      )}
      style={{ backgroundColor: option.color ?? 'transparent' }}
    />
  )
}

/**
 * One board filter as a compact dropdown (replaces a row of pills): "Etapa: Todas ▾" opens the
 * options with their counts; picking "Todas" clears it. `summary` decorates the trigger.
 */
export function FilterMenu({
  label,
  allLabel,
  options,
  value,
  onChange,
  summary,
  testId,
}: {
  label: string
  allLabel: string
  options: FilterOption[]
  value: string | null
  onChange: (value: string | null) => void
  summary?: ReactNode
  testId?: string
}) {
  const selected = options.find((option) => option.id === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border bg-white/90 px-3 text-sm text-neutral-800 shadow-sm transition-colors hover:bg-white',
          selected && 'ring-2 ring-neutral-900',
        )}
        data-testid={testId}
      >
        <span className="text-neutral-500">{label}:</span>
        {selected ? (
          <span className="flex items-center gap-1.5 font-medium">
            <Dot option={selected} />
            {selected.label}
            <span className="text-neutral-500">{selected.count}</span>
          </span>
        ) : (
          <span className="font-medium">{allLabel}</span>
        )}
        {summary}
        <ChevronDown className="size-4 text-neutral-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuRadioGroup
          value={value ?? ALL}
          onValueChange={(next) => onChange(next === ALL ? null : String(next))}
        >
          <DropdownMenuRadioItem value={ALL}>{allLabel}</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <Dot option={option} />
              <span className="flex-1">{option.label}</span>
              <span className="font-semibold tabular-nums">{option.count}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
