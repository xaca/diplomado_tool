import { FieldValue } from 'firebase-admin/firestore'
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
