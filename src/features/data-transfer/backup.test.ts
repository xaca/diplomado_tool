import { describe, expect, it } from 'vitest'
import {
  BoardFileError,
  buildBackup,
  buildTemplate,
  parseBoardFile,
  slideAssetIds,
  type BoardSnapshot,
} from '@/features/data-transfer/backup'

const ref = (assetId: string) => ({
  assetId,
  publicId: `pbl/prod/b1/st_laura/${assetId}`,
  version: 1,
  width: 10,
  height: 10,
  format: 'webp',
})

const snapshot: BoardSnapshot = {
  board: {
    title: 'Diplomado 2026-2',
    description: 'PBL',
    archiveAfterDays: 90,
  },
  students: [
    {
      id: 'st_laura',
      displayName: 'Laura Nataly',
      emails: ['laura@gmail.com', 'lnataly@uni.edu.co'],
      group: 'Equipo 1',
    },
    {
      id: 'st_seb',
      displayName: 'Sebastian',
      emails: ['seb@gmail.com'],
      group: '',
    },
  ],
  spaces: [
    {
      studentId: 'st_laura',
      title: 'App de mascotas',
      summary: 'Resumen',
      color: '#FEF3C7',
      cover: ref('c1'),
      slideOrder: ['s2', 's1', 'missing'],
    },
  ],
  slides: {
    st_laura: [
      { id: 's1', content: '{"elements":[]}', files: {} },
      { id: 's2', content: '{"elements":[1]}', files: { f1: ref('a1') } },
    ],
  },
}

describe('board backup', () => {
  it('keeps students, cards and slides (in order), never image data', () => {
    const backup = buildBackup(snapshot, new Date('2026-10-27T12:00:00Z'))
    expect(backup).toMatchObject({
      type: 'pbl.boardBackup',
      version: 1,
      exportedAt: '2026-10-27T12:00:00.000Z',
      board: { title: 'Diplomado 2026-2', archiveAfterDays: 90 },
    })
    expect(backup.students[0]).toEqual({
      id: 'st_laura',
      name: 'Laura Nataly',
      emails: ['laura@gmail.com', 'lnataly@uni.edu.co'],
      group: 'Equipo 1',
    })
    expect(backup.spaces[0].slides.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(backup.spaces[0].cover?.assetId).toBe('c1')
  })

  it('reads back what it writes (JSON round trip)', () => {
    const backup = buildBackup(snapshot)
    const parsed = parseBoardFile(JSON.parse(JSON.stringify(backup)))
    expect(parsed.kind).toBe('backup')
    expect(parsed.file).toEqual(backup)
  })

  it('templates carry only the board settings', () => {
    const template = buildTemplate(snapshot.board)
    expect(template).toEqual({
      type: 'pbl.boardTemplate',
      version: 1,
      board: {
        title: 'Diplomado 2026-2',
        description: 'PBL',
        archiveAfterDays: 90,
      },
    })
    expect(parseBoardFile(template).kind).toBe('template')
  })

  it('keeps the board stage list and each student stage (M11)', () => {
    const stages = [
      { id: 'explore', label: 'Explorando', color: '#E11D48', kind: 'stage' },
      { id: 'browsing', color: '#64748B', kind: 'browsing' },
    ] as const
    const withStages: BoardSnapshot = {
      ...snapshot,
      board: { ...snapshot.board, stages: [...stages] },
      spaces: [{ ...snapshot.spaces[0], stage: 'explore' }],
    }
    const backup = buildBackup(withStages)
    expect(backup.board.stages).toEqual(stages)
    expect(backup.spaces[0].stage).toBe('explore')
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).file).toEqual(
      backup,
    )
    // a template of a Design Thinking course keeps its stages
    expect(buildTemplate(withStages.board).board.stages).toEqual(stages)
    // files from before M11 (no stage fields) still restore
    const old = JSON.parse(JSON.stringify(buildBackup(snapshot)))
    delete old.spaces[0].stage
    delete old.board.stages
    expect(parseBoardFile(old).kind).toBe('backup')
  })

  it('refuses other files, newer versions and broken data', () => {
    const backup = buildBackup(snapshot)
    expect(() => parseBoardFile({ type: 'pbl.students', version: 1 })).toThrow(
      BoardFileError,
    )
    expect(() => parseBoardFile({ ...backup, version: 2 })).toThrow(
      BoardFileError,
    )
    expect(() =>
      parseBoardFile({
        ...backup,
        students: [{ id: '../x', name: 'X', emails: ['x@gmail.com'] }],
      }),
    ).toThrow(BoardFileError)
    expect(() => parseBoardFile(null)).toThrow(BoardFileError)
  })

  it('rebuilds asset ids from image references', () => {
    expect(
      slideAssetIds({ f1: ref('a1'), f2: ref('a1'), f3: ref('a2') }),
    ).toEqual(['a1', 'a2'])
  })
})
