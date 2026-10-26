import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// M2 rules: boards, students, email index, members, spaces, invite codes.

const TEACHER = { uid: 'teacher', email: 'paradisserossa@gmail.com' }
const OTHER_TEACHER = { uid: 'teacher2', email: 'other.teacher@gmail.com' }
const LAURA = { uid: 'laura-gmail', email: 'laura@gmail.com' }
const LAURA_UNI = { uid: 'laura-uni', email: 'lnataly@uni.edu.co' }
const STRANGER = { uid: 'stranger', email: 'stranger@gmail.com' }

const BOARD = 'board1'
const CODE = 'K7M2QX'

let env: RulesTestEnvironment

function as(user: { uid: string; email: string }) {
  return env
    .authenticatedContext(user.uid, { email: user.email, email_verified: true })
    .firestore() as unknown as Firestore // compat type → modular API (same object at runtime)
}

const board = (overrides: Record<string, unknown> = {}) => ({
  title: 'Diplomado PBL 2026-2',
  description: '',
  teacherEmails: [TEACHER.email],
  joinCode: CODE,
  joinCodeEnabled: true,
  status: 'active',
  archiveAfterDays: 90,
  background: 'yellow',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastActivityAt: serverTimestamp(),
  ...overrides,
})

const student = (
  emails: string[],
  overrides: Record<string, unknown> = {},
) => ({
  displayName: 'Laura Nataly',
  emails,
  group: '',
  status: 'invited',
  linkedUids: [],
  source: 'import',
  createdAt: serverTimestamp(),
  ...overrides,
})

const space = (studentId: string) => ({
  studentId,
  ownerName: 'Laura Nataly',
  ownerPhotoURL: null,
  title: '',
  summary: '',
  color: '#FFFFFF',
  slideOrder: [],
  slideCount: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})

/** Seeds: teacher list, one board with code, and Laura imported with 2 emails */
async function seed(
  options: {
    importLaura?: boolean
    boardOverrides?: Record<string, unknown>
  } = {},
) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'staffEmails', TEACHER.email), {
      email: TEACHER.email,
      role: 'admin',
    })
    await setDoc(doc(db, 'staffEmails', OTHER_TEACHER.email), {
      email: OTHER_TEACHER.email,
      role: 'teacher',
    })
    await setDoc(doc(db, 'boards', BOARD), board(options.boardOverrides))
    await setDoc(doc(db, 'joinCodes', CODE), {
      boardId: BOARD,
      boardTitle: 'Diplomado PBL 2026-2',
    })
    if (options.importLaura ?? true) {
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_laura'),
        student([LAURA.email, LAURA_UNI.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', LAURA.email), {
        email: LAURA.email,
        studentId: 'st_laura',
      })
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', LAURA_UNI.email), {
        email: LAURA_UNI.email,
        studentId: 'st_laura',
      })
    }
  })
}

/** What the app does on auto-join */
function autoJoin(
  db: Firestore,
  user: { uid: string; email: string },
  studentId: string,
  withSpace = true,
) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'boards', BOARD, 'members', user.uid), {
    uid: user.uid,
    studentId,
    email: user.email,
    joinedAt: serverTimestamp(),
  })
  batch.update(doc(db, 'boards', BOARD, 'students', studentId), {
    linkedUids: arrayUnion(user.uid),
    status: 'joined',
    joinedAt: serverTimestamp(),
  })
  if (withSpace)
    batch.set(doc(db, 'boards', BOARD, 'spaces', studentId), space(studentId))
  return batch.commit()
}

/** What the app does on the invite link */
function joinWithInvite(
  db: Firestore,
  user: { uid: string; email: string },
  code: string,
) {
  const studentId = `st_${user.uid}`
  const batch = writeBatch(db)
  batch.set(
    doc(db, 'boards', BOARD, 'students', studentId),
    student([user.email], {
      source: 'invite',
      inviteCode: code,
      status: 'joined',
      linkedUids: [user.uid],
    }),
  )
  batch.set(doc(db, 'boards', BOARD, 'studentEmails', user.email), {
    email: user.email,
    studentId,
  })
  batch.set(doc(db, 'boards', BOARD, 'members', user.uid), {
    uid: user.uid,
    studentId,
    email: user.email,
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'boards', BOARD, 'spaces', studentId), space(studentId))
  return batch.commit()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pbl-rules',
    firestore: {
      rules: readFileSync(
        path.resolve(import.meta.dirname, '../../firestore.rules'),
        'utf8',
      ),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
})

afterAll(async () => {
  await env.cleanup()
})

describe('boards', () => {
  it('a teacher creates a board and its invite code in one batch', async () => {
    await seed({ importLaura: false })
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(doc(db, 'boards', 'new'), board({ joinCode: 'ABCDEF' }))
    batch.set(doc(db, 'joinCodes', 'ABCDEF'), {
      boardId: 'new',
      boardTitle: 'x',
      createdAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
  })

  it('a student cannot create boards', async () => {
    await seed()
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', 'new'),
        board({ teacherEmails: [LAURA.email] }),
      ),
    )
  })

  it('a teacher lists only their boards; other teachers cannot read them', async () => {
    await seed()
    await assertSucceeds(
      getDocs(
        query(
          collection(as(TEACHER), 'boards'),
          where('teacherEmails', 'array-contains', TEACHER.email),
        ),
      ),
    )
    await assertFails(getDoc(doc(as(OTHER_TEACHER), 'boards', BOARD)))
  })

  it('the invite code cannot be changed and codes cannot be listed', async () => {
    await seed()
    await assertFails(
      updateDoc(doc(as(TEACHER), 'boards', BOARD), { joinCode: 'ZZZZZZ' }),
    )
    await assertSucceeds(
      updateDoc(doc(as(TEACHER), 'boards', BOARD), { joinCodeEnabled: false }),
    )
    await assertFails(getDocs(collection(as(TEACHER), 'joinCodes')))
    await assertSucceeds(getDoc(doc(as(STRANGER), 'joinCodes', CODE)))
  })
})

describe('teacher manages students', () => {
  it('adds a student with two emails; a student cannot', async () => {
    await seed({ importLaura: false })
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(
      doc(db, 'boards', BOARD, 'students', 'st_ana'),
      student(['ana@gmail.com', 'ana@uni.edu.co']),
    )
    batch.set(doc(db, 'boards', BOARD, 'studentEmails', 'ana@gmail.com'), {
      email: 'ana@gmail.com',
      studentId: 'st_ana',
    })
    await assertSucceeds(batch.commit())
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'students', 'st_x'),
        student([LAURA.email]),
      ),
    )
  })

  it('rejects students with no email or more than 5', async () => {
    await seed({ importLaura: false })
    const db = as(TEACHER)
    await assertFails(
      setDoc(doc(db, 'boards', BOARD, 'students', 'a'), student([])),
    )
    await assertFails(
      setDoc(
        doc(db, 'boards', BOARD, 'students', 'b'),
        student(['1@a.co', '2@a.co', '3@a.co', '4@a.co', '5@a.co', '6@a.co']),
      ),
    )
  })

  it('merge: re-points emails and accounts, deletes the duplicate', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    const db = as(TEACHER)
    await assertSucceeds(
      updateDoc(doc(db, 'boards', BOARD, 'members', LAURA.uid), {
        studentId: 'st_other',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'boards', BOARD, 'studentEmails', LAURA.email), {
        studentId: 'st_other',
      }),
    )
    await assertSucceeds(
      deleteDoc(doc(db, 'boards', BOARD, 'students', 'st_laura')),
    )
    await assertSucceeds(
      deleteDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura')),
    )
  })
})

describe('auto-join (imported students)', () => {
  it('Laura signs in with Gmail → member + linked + her space', async () => {
    await seed()
    await assertSucceeds(autoJoin(as(LAURA), LAURA, 'st_laura'))
  })

  it('her second (university) account joins the SAME student; no second space needed', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertSucceeds(autoJoin(as(LAURA_UNI), LAURA_UNI, 'st_laura', false))
    await assertSucceeds(
      getDoc(doc(as(LAURA_UNI), 'boards', BOARD, 'spaces', 'st_laura')),
    )
  })

  it('cannot claim another student', async () => {
    await seed()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'boards', BOARD, 'students', 'st_seb'),
        student(['seb@gmail.com']),
      )
    })
    await assertFails(autoJoin(as(LAURA), LAURA, 'st_seb'))
  })

  it('someone not on the list cannot join without the invite code', async () => {
    await seed()
    await assertFails(autoJoin(as(STRANGER), STRANGER, 'st_laura'))
  })

  it('finds their boards through collection-group queries (own email / uid only)', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    const db = as(LAURA)
    await assertSucceeds(
      getDocs(
        query(
          collectionGroup(db, 'studentEmails'),
          where('email', '==', LAURA.email),
        ),
      ),
    )
    await assertSucceeds(
      getDocs(
        query(collectionGroup(db, 'members'), where('uid', '==', LAURA.uid)),
      ),
    )
    await assertFails(
      getDocs(
        query(
          collectionGroup(db, 'studentEmails'),
          where('email', '==', LAURA_UNI.email),
        ),
      ),
    )
  })
})

describe('invite link', () => {
  it('a student not on the list joins with the right code', async () => {
    await seed()
    await assertSucceeds(joinWithInvite(as(STRANGER), STRANGER, CODE))
    await assertSucceeds(getDoc(doc(as(STRANGER), 'boards', BOARD)))
  })

  it('wrong code → denied', async () => {
    await seed()
    await assertFails(joinWithInvite(as(STRANGER), STRANGER, 'WRONG1'))
  })

  it('invite disabled → denied', async () => {
    await seed({ boardOverrides: { joinCodeEnabled: false } })
    await assertFails(joinWithInvite(as(STRANGER), STRANGER, CODE))
  })

  it('an imported student cannot create a duplicate through the invite', async () => {
    await seed()
    await assertFails(joinWithInvite(as(LAURA), LAURA, CODE))
  })
})

describe('spaces', () => {
  it('members read spaces; outsiders cannot', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertSucceeds(
      getDocs(collection(as(LAURA), 'boards', BOARD, 'spaces')),
    )
    await assertFails(
      getDocs(collection(as(STRANGER), 'boards', BOARD, 'spaces')),
    )
  })

  it("a student cannot create someone else's space", async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura', false)
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_seb'),
        space('st_seb'),
      ),
    )
  })
})

describe('spaces — editing the card (M3)', () => {
  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  const edit = (overrides: Record<string, unknown> = {}) => ({
    title: 'App de rastreo',
    summary: 'Una app para el bienestar de las mascotas',
    color: '#FCE7F3',
    updatedAt: serverTimestamp(),
    ...overrides,
  })

  it('the student edits title, summary and color of their own card', async () => {
    await joined()
    await assertSucceeds(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), edit()),
    )
  })

  it('their second account can edit the same card', async () => {
    await joined()
    await autoJoin(as(LAURA_UNI), LAURA_UNI, 'st_laura', false)
    await assertSucceeds(
      updateDoc(
        doc(as(LAURA_UNI), 'boards', BOARD, 'spaces', 'st_laura'),
        edit(),
      ),
    )
  })

  it("a classmate can read but not edit someone else's card", async () => {
    await joined()
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student(['seb@gmail.com']),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', 'seb@gmail.com'), {
        email: 'seb@gmail.com',
        studentId: 'st_seb',
      })
    })
    const SEB = { uid: 'seb', email: 'seb@gmail.com' }
    await autoJoin(as(SEB), SEB, 'st_seb')
    await assertSucceeds(
      getDoc(doc(as(SEB), 'boards', BOARD, 'spaces', 'st_laura')),
    )
    await assertFails(
      updateDoc(doc(as(SEB), 'boards', BOARD, 'spaces', 'st_laura'), edit()),
    )
  })

  it('rejects colors outside the palette, too-long texts and other fields', async () => {
    await joined()
    const ref = doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura')
    await assertFails(updateDoc(ref, edit({ color: '#000000' })))
    await assertFails(updateDoc(ref, edit({ title: 'x'.repeat(121) })))
    await assertFails(updateDoc(ref, edit({ summary: 'x'.repeat(1001) })))
    await assertFails(updateDoc(ref, edit({ ownerName: 'Otra persona' })))
    await assertFails(updateDoc(ref, edit({ slideCount: 99 })))
  })

  it('updatedAt must be the server time (no faking "updated just now")', async () => {
    await joined()
    await assertFails(
      updateDoc(
        doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'),
        edit({ updatedAt: new Date(2030, 0, 1) }),
      ),
    )
  })

  it('no edits when the board is not active', async () => {
    await joined()
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'boards', BOARD), {
        status: 'locked',
      })
    })
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), edit()),
    )
  })

  it('the teacher can only sync the name; a student cannot rename themselves', async () => {
    await joined()
    await assertSucceeds(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), {
        ownerName: 'Laura N. Gómez',
      }),
    )
    await assertFails(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), {
        title: 'x',
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), {
        ownerName: 'Otra',
      }),
    )
  })

  it('merging: the teacher may create a space that already has content', async () => {
    await seed()
    await assertSucceeds(
      setDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), {
        ...space('st_laura'),
        title: 'Con contenido',
      }),
    )
  })
})
