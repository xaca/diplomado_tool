import { describe, expect, it } from 'vitest'
import {
  boardColumns,
  boardStyle,
  contrastRatio,
  NO_GROUP,
  resolveLook,
  sortSpacesBy,
  TEXT_ON,
} from '@/features/boards/look'
import { NO_STAGE } from '@/features/stages/stages'
import { BOARD_BACKGROUNDS, DEFAULT_LOOK, DEFAULT_STAGES } from '@/model'

const at = (ms: number) => ({ toDate: () => new Date(ms) })

describe('board look (M12)', () => {
  it('boards without settings keep today’s look', () => {
    expect(resolveLook({})).toEqual(DEFAULT_LOOK)
    expect(resolveLook(null)).toEqual(DEFAULT_LOOK)
    expect(resolveLook({ background: 'yellow' })).toEqual(DEFAULT_LOOK)
  })

  it('takes valid settings and ignores unknown ones', () => {
    expect(
      resolveLook({
        background: 'night',
        layout: 'stages',
        stickyHeader: false,
      }),
    ).toEqual({
      ...DEFAULT_LOOK,
      background: 'night',
      layout: 'stages',
      stickyHeader: false,
    })
    expect(
      resolveLook({
        background: 'neon',
        layout: 'kanban' as never,
        sortBy: 'name',
      }),
    ).toEqual({ ...DEFAULT_LOOK, sortBy: 'name' })
  })

  it('every background keeps its text readable (WCAG AA, 4.5:1)', () => {
    for (const preset of BOARD_BACKGROUNDS)
      for (const stop of preset.stops)
        expect(
          contrastRatio(stop, TEXT_ON[preset.text]),
          `${preset.id} ${stop}`,
        ).toBeGreaterThanOrEqual(4.5)
  })

  it('draws the pattern over the color or gradient', () => {
    expect(boardStyle(DEFAULT_LOOK)).toMatchObject({
      backgroundColor: '#fcd34d',
      backgroundSize: '22px 22px',
    })
    expect(
      boardStyle({ ...DEFAULT_LOOK, pattern: 'none' }).backgroundImage,
    ).toBeUndefined()
    const gradient = boardStyle({
      ...DEFAULT_LOOK,
      background: 'ocean',
      pattern: 'grid',
    })
    expect(gradient.backgroundImage).toContain(
      'linear-gradient(135deg, #a5f3fc, #a5b4fc)',
    )
    expect(gradient.backgroundSize).toBe('28px 28px, 28px 28px, 100% 100%')
  })

  const spaces = [
    {
      id: 'a',
      ownerName: 'Zoe',
      createdAt: at(1),
      updatedAt: at(5),
      stage: 'ideate',
      group: 'Equipo 2',
    },
    {
      id: 'b',
      ownerName: 'Ana',
      createdAt: at(2),
      updatedAt: at(9),
      stage: 'gone',
      group: 'Equipo 10',
    },
    {
      id: 'c',
      ownerName: 'Luis',
      createdAt: at(3),
      updatedAt: at(1),
      group: '',
    },
    {
      id: 'd',
      ownerName: 'Bea',
      createdAt: at(4),
      updatedAt: at(7),
      stage: 'ideate',
      group: 'Equipo 2',
    },
  ]

  it('sorts by joining, name or last update, my card first', () => {
    const ids = (list: { id: string }[]) => list.map((s) => s.id)
    expect(ids(sortSpacesBy(spaces, 'joined', null))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    expect(ids(sortSpacesBy(spaces, 'name', null))).toEqual([
      'b',
      'd',
      'c',
      'a',
    ])
    expect(ids(sortSpacesBy(spaces, 'updated', null))).toEqual([
      'b',
      'd',
      'a',
      'c',
    ])
    expect(ids(sortSpacesBy(spaces, 'name', 'c'))).toEqual(['c', 'b', 'd', 'a'])
  })

  it('columns per stage: the board’s stages in order, then the cards without one', () => {
    const columns = boardColumns(spaces, 'stages', DEFAULT_STAGES)
    expect(columns.map((c) => c.id)).toEqual([
      ...DEFAULT_STAGES.map((s) => s.id),
      NO_STAGE,
    ])
    expect(
      columns.find((c) => c.id === 'ideate')!.spaces.map((s) => s.id),
    ).toEqual(['a', 'd'])
    expect(columns.at(-1)!.spaces.map((s) => s.id)).toEqual(['b', 'c'])
    // no "Sin etapa" column when everyone has a stage
    expect(boardColumns([spaces[0]], 'stages', DEFAULT_STAGES).at(-1)!.id).toBe(
      'browsing',
    )
  })

  it('columns per group: natural name order, then the cards without a group', () => {
    const columns = boardColumns(spaces, 'groups', DEFAULT_STAGES)
    expect(columns.map((c) => c.label)).toEqual(['Equipo 2', 'Equipo 10', null])
    expect(columns.at(-1)!.id).toBe(NO_GROUP)
    expect(columns[0].spaces.map((s) => s.id)).toEqual(['a', 'd'])
  })
})
