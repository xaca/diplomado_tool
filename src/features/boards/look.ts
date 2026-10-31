import type { CSSProperties } from 'react'
import { findStage, NO_STAGE } from '@/features/stages/stages'
import { toDate } from '@/lib/time'
import {
  BOARD_BACKGROUNDS,
  boardLookSchema,
  DEFAULT_LOOK,
  type BoardDoc,
  type BoardLook,
  type SpaceDoc,
  type StageDef,
} from '@/model'

// Board look (M12, PLAN.md → M12): background, pattern, layout, order, sticky header.
// Pure helpers, unit-tested; BoardPage and the customize panel build on them.

/** The board's look with today's defaults for anything not set (or not valid any more). */
export function resolveLook(
  board: Partial<BoardDoc> | null | undefined,
): BoardLook {
  const merged = { ...DEFAULT_LOOK }
  for (const key of Object.keys(DEFAULT_LOOK) as (keyof BoardLook)[]) {
    const candidate = { ...merged, [key]: board?.[key] }
    if (boardLookSchema.safeParse(candidate).success)
      Object.assign(merged, candidate)
  }
  return merged
}

export function backgroundOf(look: Pick<BoardLook, 'background'>) {
  return (
    BOARD_BACKGROUNDS.find((preset) => preset.id === look.background) ??
    BOARD_BACKGROUNDS[0]
  )
}

/** CSS of the background preset; gradients as one 135° gradient. */
export function backgroundCss(stops: readonly string[]) {
  return stops.length === 1
    ? stops[0]
    : `linear-gradient(135deg, ${stops.join(', ')})`
}

/** Inline style of the board: color / gradient plus the pattern drawn on top. */
export function boardStyle(look: BoardLook): CSSProperties {
  const preset = backgroundOf(look)
  const ink = preset.text === 'light' ? '255 255 255 / 0.08' : '0 0 0 / 0.06'
  const layers: string[] = []
  if (look.pattern === 'dots')
    layers.push(`radial-gradient(rgb(${ink}) 1.5px, transparent 1.5px)`)
  if (look.pattern === 'grid')
    layers.push(
      `linear-gradient(rgb(${ink}) 1px, transparent 1px)`,
      `linear-gradient(90deg, rgb(${ink}) 1px, transparent 1px)`,
    )
  const gradient = preset.stops.length > 1 ? backgroundCss(preset.stops) : null
  const images = [...layers, ...(gradient ? [gradient] : [])]
  const sizes = [
    ...layers.map(() => (look.pattern === 'dots' ? '22px 22px' : '28px 28px')),
    ...(gradient ? ['100% 100%'] : []),
  ]
  return {
    backgroundColor: preset.stops[0],
    backgroundImage: images.length ? images.join(', ') : undefined,
    backgroundSize: sizes.length ? sizes.join(', ') : undefined,
    backgroundAttachment: gradient ? 'fixed' : undefined,
  }
}

// ---------- contrast (WCAG) ----------

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** The text colors used on the board header (neutral-900 / white). */
export const TEXT_ON = { dark: '#171717', light: '#ffffff' } as const

// ---------- order and columns ----------

type Sortable = Pick<SpaceDoc, 'createdAt' | 'updatedAt' | 'ownerName'> & {
  id: string
}

/** Card order: my card first, then by the board's order (pure). */
export function sortSpacesBy<T extends Sortable>(
  spaces: readonly T[],
  sortBy: BoardLook['sortBy'],
  myStudentId: string | null,
): T[] {
  const time = (value: unknown) => toDate(value).getTime()
  return [...spaces].sort((a, b) => {
    if (a.id === myStudentId) return -1
    if (b.id === myStudentId) return 1
    const byName = a.ownerName.localeCompare(b.ownerName, 'es')
    if (sortBy === 'name') return byName
    if (sortBy === 'updated')
      return time(b.updatedAt) - time(a.updatedAt) || byName
    return time(a.createdAt) - time(b.createdAt) || byName
  })
}

export type BoardColumn<T> = {
  id: string
  /** Group name; null for stage columns (named by the stage) and "Sin etapa" / "Sin grupo" */
  label: string | null
  stage: StageDef | null
  spaces: T[]
}

export const NO_GROUP = '__none'

/**
 * Columns for the "Por etapa" / "Por grupo" layouts, keeping the card order inside each column.
 * Stages follow the board's list (empty ones too); groups are sorted by name; the column of cards
 * without a stage / group goes last, only when it has cards.
 */
export function boardColumns<T extends Pick<SpaceDoc, 'stage' | 'group'>>(
  spaces: readonly T[],
  by: 'stages' | 'groups',
  stages: StageDef[],
): BoardColumn<T>[] {
  if (by === 'stages') {
    const columns: BoardColumn<T>[] = stages.map((stage) => ({
      id: stage.id,
      label: null,
      stage,
      spaces: [],
    }))
    const none: BoardColumn<T> = {
      id: NO_STAGE,
      label: null,
      stage: null,
      spaces: [],
    }
    for (const space of spaces) {
      const stage = findStage(stages, space.stage)
      const column = columns.find((c) => c.id === stage?.id) ?? none
      column.spaces.push(space)
    }
    return none.spaces.length ? [...columns, none] : columns
  }
  const byGroup = new Map<string, T[]>()
  for (const space of spaces) {
    const group = space.group?.trim() || NO_GROUP
    byGroup.set(group, [...(byGroup.get(group) ?? []), space])
  }
  const named = [...byGroup.keys()]
    .filter((group) => group !== NO_GROUP)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const columns: BoardColumn<T>[] = named.map((group) => ({
    id: group,
    label: group,
    stage: null,
    spaces: byGroup.get(group)!,
  }))
  const none = byGroup.get(NO_GROUP)
  return none
    ? [...columns, { id: NO_GROUP, label: null, stage: null, spaces: none }]
    : columns
}
