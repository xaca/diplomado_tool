import { describe, expect, it } from 'vitest'
import {
  BoardFileError,
  buildBackup,
  buildTemplate,
  classBackupOf,
  newsBackupOf,
  parseBoardFile,
  recordingBackupOf,
  slideAssetIds,
  type BoardSnapshot,
} from '@/features/data-transfer/backup'
import { courseSetupSchema } from '@/model'

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

describe('attendance in backups (M18)', () => {
  it('keeps the class dates in order, without marks of removed students', () => {
    const backup = buildBackup({
      ...snapshot,
      attendance: [
        {
          date: '2026-11-10',
          topic: '',
          marks: { st_laura: { status: 'absent' } },
        },
        {
          date: '2026-11-03',
          topic: 'Sesión 4',
          marks: {
            st_laura: { status: 'late', note: 'Bus' },
            st_removed: { status: 'present' },
          },
        },
      ],
    })
    expect(backup.attendance).toEqual([
      {
        date: '2026-11-03',
        topic: 'Sesión 4',
        marks: { st_laura: { status: 'late', note: 'Bus' } },
      },
      {
        date: '2026-11-10',
        topic: '',
        marks: { st_laura: { status: 'absent' } },
      },
    ])
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).kind).toBe(
      'backup',
    )
  })

  it('backups from before attendance still restore; bad marks are refused', () => {
    const old = buildBackup(snapshot) as Record<string, unknown>
    delete old.attendance
    expect(parseBoardFile(old).kind).toBe('backup')
    expect(() =>
      parseBoardFile({
        ...old,
        attendance: [
          { date: '2026-11-03', topic: '', marks: { a: { status: 'tarde' } } },
        ],
      }),
    ).toThrow()
  })
})

describe('announcements in backups (M19)', () => {
  it('keeps the announcements (not who read them); bad links are refused', () => {
    const note = {
      title: 'Entrega final',
      body: 'El viernes',
      link: '/b/x',
      important: true,
    }
    const backup = buildBackup({ ...snapshot, announcements: [note] })
    expect(backup.announcements).toEqual([note])
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).kind).toBe(
      'backup',
    )
    expect(() =>
      parseBoardFile({
        ...backup,
        announcements: [{ ...note, link: 'javascript:alert(1)' }],
      }),
    ).toThrow()
  })
})

describe('class walls in backups (M10)', () => {
  const now = { seconds: 1, nanoseconds: 0 }
  const note = (id: string, text: string, overrides = {}) => ({
    id,
    data: {
      text,
      color: 'yellow' as const,
      x: 0.1,
      y: 0.2,
      authorUid: id.split('_')[0],
      authorStudentId: 'st_laura',
      authorName: 'Laura',
      authorRole: 'student' as const,
      reactions: { u2: { name: 'Elma', emojis: ['👍' as const] } },
      editedByTeacher: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
  })
  const klass = classBackupOf(
    {
      title: 'Clase 3',
      date: '2026-11-12',
      status: 'open',
      slideOrder: ['s2', 's1', 'gone'],
    },
    new Map([
      [
        's1',
        {
          title: 'Uno',
          instructions: '',
          layout: 'free' as const,
          zones: [],
          locked: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        's2',
        {
          title: 'Dos',
          instructions: 'Una idea por nota',
          layout: 'columns2' as const,
          zones: ['Sí', 'No'],
          locked: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]),
    new Map([['s2', [note('u1_1', 'Hola'), note('u1_2', 'Chao')]]]),
  )

  it('keeps each class with its slides in order, notes, authors and reactions', () => {
    expect(klass.slides.map((slide) => slide.title)).toEqual(['Dos', 'Uno'])
    expect(klass.slides[0].notes).toHaveLength(2)
    expect(klass.slides[0].notes[0]).toMatchObject({
      id: 'u1_1',
      authorUid: 'u1',
      reactions: { u2: { name: 'Elma', emojis: ['👍'] } },
    })
    expect(klass.slides[1].notes).toEqual([])

    const backup = buildBackup({
      ...snapshot,
      classes: [klass, { ...klass, title: 'Clase 1', date: '2026-10-01' }],
    })
    expect(backup.classes?.map((item) => item.title)).toEqual([
      'Clase 1',
      'Clase 3',
    ])
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).kind).toBe(
      'backup',
    )
    // old files without classes still restore
    expect(buildBackup(snapshot).classes).toEqual([])
  })

  it('M10b: keeps the teacher’s drawing and the slide’s reactions; titles may be empty', () => {
    const drawn = classBackupOf(
      { title: 'C', date: '2026-11-12', status: 'open', slideOrder: ['s1'] },
      new Map([
        [
          's1',
          {
            title: '',
            instructions: '',
            layout: 'free' as const,
            zones: [],
            locked: false,
            content: '{"elements":[]}',
            files: {},
            bytes: 15,
            reactions: { u2: { name: 'Elma', emojis: ['🎉' as const] } },
            createdAt: now,
            updatedAt: now,
          },
        ],
      ]),
      new Map(),
    )
    expect(drawn.slides[0]).toMatchObject({
      title: '',
      drawing: { content: '{"elements":[]}', files: {} },
      reactions: { u2: { name: 'Elma', emojis: ['🎉'] } },
    })
    const backup = buildBackup({ ...snapshot, classes: [drawn] })
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).kind).toBe(
      'backup',
    )
    // no drawing, no reactions: nothing extra in the file
    expect(klass.slides[1]).not.toHaveProperty('drawing')
  })

  it('refuses notes with an id that is not their author’s, or unknown emojis', () => {
    const backup = buildBackup({ ...snapshot, classes: [klass] })
    const broken = (patch: object) => ({
      ...backup,
      classes: [
        {
          ...klass,
          slides: [
            {
              ...klass.slides[0],
              notes: [{ ...klass.slides[0].notes[0], ...patch }],
            },
          ],
        },
      ],
    })
    expect(() => parseBoardFile(broken({ id: 'u1_21' }))).toThrow()
    expect(() => parseBoardFile(broken({ id: 'u9_1' }))).toThrow()
    expect(() =>
      parseBoardFile(
        broken({ reactions: { u2: { name: 'E', emojis: ['🤬'] } } }),
      ),
    ).toThrow()
  })
})

describe('recorded classes in backups (M23)', () => {
  it("keeps the playlists with the teacher's titles and hidden videos (not students' progress); bad ids are refused", () => {
    const recording = recordingBackupOf({
      title: 'Diplomado UX/UI',
      listId: 'PLO2HxDUbp3FU',
      videos: [
        {
          id: 'VB-lKjtbZk8',
          title: '23 Octubre',
          seconds: 10335,
          playable: true,
        },
      ],
      titles: { 'VB-lKjtbZk8': 'Clase 7: herramientas' },
      hidden: [],
    })
    const backup = buildBackup({ ...snapshot, recordings: [recording] })
    expect(backup.recordings).toEqual([recording])
    expect(parseBoardFile(JSON.parse(JSON.stringify(backup))).kind).toBe(
      'backup',
    )
    expect(() =>
      parseBoardFile({
        ...backup,
        recordings: [{ ...recording, listId: '<script>' }],
      }),
    ).toThrow()
  })
})

describe('course setup and news in backups (M24)', () => {
  it('keeps the course setup, the sender and the news (also the setup in a template); bad values are refused', () => {
    const course = courseSetupSchema.parse({
      start: '2026-11-03',
      end: '2026-11-28',
      schedule: [{ day: 2, start: '18:00', end: '21:00', place: 'Salón 304' }],
      holidayCountry: 'CO',
      holidays: [{ date: '2026-11-16', name: 'Independencia de Cartagena' }],
      topics: { '1': 'Empatía' },
    })
    const news = newsBackupOf({
      date: '2026-11-10',
      wholeWeek: false,
      kind: 'deliverable',
      title: 'Entrega del prototipo',
      text: '',
      link: 'https://example.com',
    })
    const board = {
      ...snapshot.board,
      course,
      emailSender: { name: 'Diplomado UX/UI', replyTo: 'docente@uni.edu.co' },
    }
    const backup = buildBackup({ ...snapshot, board, news: [news] })
    expect(backup.board.course).toEqual(course)
    expect(backup.board.emailSender?.replyTo).toBe('docente@uni.edu.co')
    expect(backup.news).toEqual([news])
    expect(buildTemplate(board).board.course).toEqual(course)
    const parsed = parseBoardFile(JSON.parse(JSON.stringify(backup)))
    expect(parsed.kind === 'backup' && parsed.file.news).toEqual([news])
    expect(() =>
      parseBoardFile({
        ...backup,
        board: { ...backup.board, course: { ...course, start: 'mañana' } },
      }),
    ).toThrow()
    expect(() =>
      parseBoardFile({ ...backup, news: [{ ...news, link: 'javascript:x' }] }),
    ).toThrow()
  })
})
