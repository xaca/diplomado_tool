import {
  DEFAULT_STAGE_IDS,
  DEFAULT_STAGES,
  MAX_STAGE_LABEL,
  STAGE_COLORS,
  type BoardDoc,
  type SpaceDoc,
  type StageDef,
} from '@/model'

// Design Thinking stages (M11, PLAN.md → M11). Pure helpers, unit-tested; the components and
// the API build on them.

type DefaultStageId =
  'empathize' | 'define' | 'ideate' | 'prototype' | 'test' | 'browsing'
/** i18next's `t`, narrowed to the default stage names */
type Translate = (key: `stages.${DefaultStageId}`) => string

/** The board's stage list: its own, else the Design Thinking defaults. */
export function boardStages(
  board: Pick<BoardDoc, 'stages'> | null | undefined,
) {
  return board?.stages?.length ? board.stages : DEFAULT_STAGES
}

/** The stage a card points to, or null (no stage, or one the teacher removed from the list). */
export function findStage(stages: StageDef[], id: string | null | undefined) {
  return (id && stages.find((stage) => stage.id === id)) || null
}

/** Its name: the teacher's label, else the translated default ("Ideando"). */
export function stageLabel(stage: StageDef, t: Translate) {
  if (stage.label) return stage.label
  return DEFAULT_STAGE_IDS.includes(stage.id)
    ? t(`stages.${stage.id as DefaultStageId}`)
    : stage.id
}

/** The text written on the ring, like #OPENTOWORK: "#IDEANDO", "#JUSTBROWSING". */
export function ringText(label: string) {
  return `#${label.replace(/\s+/g, '').toLocaleUpperCase()}`
}

export const NO_STAGE = 'none'

/** Cards per stage id (plus NO_STAGE), for the dashboard summary. Unknown ids count as no stage. */
export function stageCounts(
  spaces: Pick<SpaceDoc, 'stage'>[],
  stages: StageDef[],
) {
  const counts = new Map<string, number>(
    [...stages.map((stage) => stage.id), NO_STAGE].map((id) => [id, 0]),
  )
  for (const space of spaces) {
    const id = findStage(stages, space.stage)?.id ?? NO_STAGE
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** Dashboard filter: a stage id, NO_STAGE, or null for everyone. */
export function matchesStage(
  space: Pick<SpaceDoc, 'stage'>,
  stages: StageDef[],
  filter: string | null,
) {
  if (filter === null) return true
  return (findStage(stages, space.stage)?.id ?? NO_STAGE) === filter
}

/** A new custom stage's id, unique in the list ("stage-2", "stage-3"…). */
export function newStageId(stages: StageDef[]) {
  const taken = new Set(stages.map((stage) => stage.id))
  let n = stages.length + 1
  while (taken.has(`stage-${n}`)) n += 1
  return `stage-${n}`
}

/** A color not used yet by the list (the first one when all are taken). */
export function nextStageColor(stages: StageDef[]) {
  const used = new Set(stages.map((stage) => stage.color))
  return STAGE_COLORS.find((color) => !used.has(color)) ?? STAGE_COLORS[0]
}

/** Cleans the editor's labels: trimmed, cut to the limit, empty → no label (default name). */
export function cleanStages(stages: StageDef[]): StageDef[] {
  return stages.map(({ label, ...stage }) => {
    const clean = label?.trim().slice(0, MAX_STAGE_LABEL)
    return clean ? { ...stage, label: clean } : stage
  })
}
