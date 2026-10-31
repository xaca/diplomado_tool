import { describe, expect, it } from 'vitest'
import {
  boardStages,
  cleanStages,
  findStage,
  matchesStage,
  newStageId,
  nextStageColor,
  NO_STAGE,
  ringText,
  stageCounts,
  stageLabel,
} from '@/features/stages/stages'
import { DEFAULT_STAGES, stageListSchema, type StageDef } from '@/model'

const t = (key: string) => `t:${key}`

const custom: StageDef[] = [
  { id: 'explore', label: 'Explorando', color: '#E11D48', kind: 'stage' },
  { id: 'browsing', color: '#64748B', kind: 'browsing' },
]

describe('stages', () => {
  it('uses the Design Thinking defaults when the board has no list', () => {
    expect(boardStages({})).toBe(DEFAULT_STAGES)
    expect(boardStages({ stages: null })).toBe(DEFAULT_STAGES)
    expect(boardStages({ stages: [] })).toBe(DEFAULT_STAGES)
    expect(boardStages({ stages: custom })).toBe(custom)
    expect(DEFAULT_STAGES.map((stage) => stage.id)).toEqual([
      'empathize',
      'define',
      'ideate',
      'prototype',
      'test',
      'browsing',
    ])
    expect(stageListSchema.safeParse(DEFAULT_STAGES).success).toBe(true)
  })

  it('finds a stage, or null for none and removed ones', () => {
    expect(findStage(custom, 'explore')?.label).toBe('Explorando')
    expect(findStage(custom, 'ideate')).toBeNull()
    expect(findStage(custom, null)).toBeNull()
    expect(findStage(custom, undefined)).toBeNull()
  })

  it('names default stages by translation and custom ones by their label', () => {
    expect(stageLabel(DEFAULT_STAGES[2], t)).toBe('t:stages.ideate')
    expect(stageLabel(custom[0], t)).toBe('Explorando')
    expect(stageLabel({ ...DEFAULT_STAGES[0], label: 'Empatía' }, t)).toBe(
      'Empatía',
    )
  })

  it('writes the ring text like #OPENTOWORK', () => {
    expect(ringText('Ideando')).toBe('#IDEANDO')
    expect(ringText('Just browsing')).toBe('#JUSTBROWSING')
    expect(ringText('Prototipando')).toBe('#PROTOTIPANDO')
  })

  it('counts cards per stage; unknown stages count as none', () => {
    const counts = stageCounts(
      [
        { stage: 'explore' },
        { stage: 'explore' },
        { stage: 'browsing' },
        { stage: 'ideate' },
        {},
        { stage: null },
      ],
      custom,
    )
    expect(Object.fromEntries(counts)).toEqual({
      explore: 2,
      browsing: 1,
      [NO_STAGE]: 3,
    })
  })

  it('filters the dashboard by stage', () => {
    expect(matchesStage({ stage: 'explore' }, custom, null)).toBe(true)
    expect(matchesStage({ stage: 'explore' }, custom, 'explore')).toBe(true)
    expect(matchesStage({ stage: 'explore' }, custom, 'browsing')).toBe(false)
    expect(matchesStage({ stage: 'ideate' }, custom, NO_STAGE)).toBe(true)
    expect(matchesStage({}, custom, NO_STAGE)).toBe(true)
  })

  it('creates unique ids and unused colors for new stages', () => {
    expect(newStageId(custom)).toBe('stage-3')
    expect(newStageId([...custom, { ...custom[0], id: 'stage-3' }])).toBe(
      'stage-4',
    )
    expect(nextStageColor(custom)).toBe('#EA580C')
  })

  it('cleans labels before saving', () => {
    expect(
      cleanStages([
        { id: 'a', label: '  Idear  ', color: '#E11D48', kind: 'stage' },
        { id: 'b', label: '   ', color: '#E11D48', kind: 'stage' },
        { id: 'c', label: 'x'.repeat(40), color: '#E11D48', kind: 'stage' },
      ]),
    ).toEqual([
      { id: 'a', label: 'Idear', color: '#E11D48', kind: 'stage' },
      { id: 'b', color: '#E11D48', kind: 'stage' },
      { id: 'c', label: 'x'.repeat(24), color: '#E11D48', kind: 'stage' },
    ])
  })

  it('rejects invalid stage lists', () => {
    const ok = DEFAULT_STAGES
    expect(stageListSchema.safeParse([]).success).toBe(false)
    expect(stageListSchema.safeParse([...ok, ...ok]).success).toBe(false)
    expect(
      stageListSchema.safeParse([{ ...ok[0], id: 'Bad Id' }]).success,
    ).toBe(false)
    expect(
      stageListSchema.safeParse([{ ...ok[0], color: 'red' }]).success,
    ).toBe(false)
  })
})
