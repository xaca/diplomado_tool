import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { emulatorDb, resetEmulators } from './emulator.ts'

// Demo data for the LOCAL emulators only (`npm run emulators` in one terminal, `npm run seed` in another).
// Sign in from `npm run dev:emulators` with any of these emails in the emulator's Google screen.

export const DEMO = {
  teacher: 'docente@demo.edu',
  boardId: 'demo-board',
  boardTitle: 'Diplomado PBL (demo)',
  joinCode: 'ABC234',
  students: [
    {
      id: 'st_laura',
      name: 'Laura Nataly',
      emails: ['laura@gmail.com', 'lnataly@uni.edu.co'],
      group: 'Equipo 1',
    },
    {
      id: 'st_sebastian',
      name: 'Sebastian Cetina',
      emails: ['scetina@uni.edu.co'],
      group: 'Equipo 1',
    },
    {
      id: 'st_elma',
      name: 'Elma',
      emails: ['elma@gmail.com'],
      group: 'Equipo 2',
    },
    {
      id: 'st_hanna',
      name: 'Hanna Buelvas',
      emails: ['hanna@gmail.com', 'hbuelvas@uni.edu.co'],
      group: 'Equipo 2',
    },
    {
      id: 'st_carolina',
      name: 'Carolina',
      emails: ['carolina@gmail.com'],
      group: '',
    },
  ],
} as const

/** Spaces that already have a title/summary (students who "joined" before) */
export const DEMO_CARDS = [
  {
    studentId: 'st_sebastian',
    title: 'Plataforma para agencias',
    summary:
      'Una plataforma donde los clientes conozcan los servicios de la agencia, soliciten cotizaciones y hagan seguimiento a sus proyectos.',
    color: '#FFFFFF',
    stage: 'prototype',
    joinedDaysAgo: 30,
    updatedDaysAgo: 30,
  },
  {
    studentId: 'st_elma',
    title: 'App de rastreo 🐶',
    summary:
      'Una aplicación enfocada en la seguridad y bienestar de las mascotas, con una experiencia UI/UX intuitiva y con personalidad propia.',
    color: '#EDE9FE',
    stage: 'ideate',
    joinedDaysAgo: 29,
    updatedDaysAgo: 3,
  },
  {
    studentId: 'st_carolina',
    title: 'Procesos más divertidos',
    summary:
      'Quiero optimizar procesos y hacer que el análisis de datos sea más sencillo, dinámico y gráfico.',
    color: '#FCE7F3',
    stage: 'browsing',
    joinedDaysAgo: 28,
    updatedDaysAgo: 9,
  },
] as const

export async function seedDemo() {
  await resetEmulators()
  const batch = emulatorDb.batch()
  const now = FieldValue.serverTimestamp()

  batch.set(emulatorDb.doc(`staffEmails/${DEMO.teacher}`), {
    email: DEMO.teacher,
    role: 'admin',
    displayName: 'Docente Demo',
    addedBy: 'seed',
    addedAt: now,
  })

  batch.set(emulatorDb.doc(`boards/${DEMO.boardId}`), {
    title: DEMO.boardTitle,
    description: '¿Cuáles son tus tres posibles proyectos para el curso?',
    teacherEmails: [DEMO.teacher],
    joinCode: DEMO.joinCode,
    joinCodeEnabled: true,
    status: 'active',
    archiveAfterDays: 90,
    background: 'yellow',
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
  })
  batch.set(emulatorDb.doc(`joinCodes/${DEMO.joinCode}`), {
    boardId: DEMO.boardId,
    boardTitle: DEMO.boardTitle,
    createdAt: now,
  })

  for (const student of DEMO.students) {
    batch.set(emulatorDb.doc(`boards/${DEMO.boardId}/students/${student.id}`), {
      displayName: student.name,
      emails: [...student.emails],
      group: student.group,
      status: 'invited',
      linkedUids: [],
      source: 'import',
      createdAt: now,
    })
    for (const email of student.emails) {
      batch.set(
        emulatorDb.doc(`boards/${DEMO.boardId}/studentEmails/${email}`),
        { email, studentId: student.id },
      )
    }
  }

  // Cards with content (as if these students already joined), like the Padlet reference
  const daysAgo = (days: number) =>
    Timestamp.fromMillis(Date.now() - days * 24 * 3600 * 1000)
  for (const card of DEMO_CARDS) {
    batch.set(
      emulatorDb.doc(`boards/${DEMO.boardId}/spaces/${card.studentId}`),
      {
        studentId: card.studentId,
        ownerName: DEMO.students.find((s) => s.id === card.studentId)!.name,
        ownerPhotoURL: null,
        title: card.title,
        summary: card.summary,
        color: card.color,
        // M11: a demo class in several Design Thinking stages
        stage: card.stage,
        stageSetBy: 'student',
        stageUpdatedAt: daysAgo(card.updatedDaysAgo),
        slideOrder: [],
        slideCount: 0,
        createdAt: daysAgo(card.joinedDaysAgo),
        updatedAt: daysAgo(card.updatedDaysAgo),
      },
    )
  }

  await batch.commit()
}

// Run directly: `npm run seed`
if (
  import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}` ||
  process.argv[1]?.endsWith('seed.ts')
) {
  seedDemo()
    .then(() => {
      console.log(
        `✔ Emulators seeded: teacher ${DEMO.teacher}, board "${DEMO.boardTitle}" (code ${DEMO.joinCode}),`,
      )
      console.log(
        `  ${DEMO.students.length} students: ${DEMO.students.map((s) => s.emails[0]).join(', ')}`,
      )
    })
    .catch((error: unknown) => {
      console.error(
        '✖ Seed failed (are the emulators running? `npm run emulators`)',
        error,
      )
      process.exit(1)
    })
}
