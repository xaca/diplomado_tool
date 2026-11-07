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
  deleteField,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
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
      // the port `emulators:exec` started on (8080 unless another emulator already has it)
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? 8080),
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

  it('the join batch may only create an EMPTY card', async () => {
    await seed()
    const db = as(LAURA)
    const batch = writeBatch(db)
    batch.set(doc(db, 'boards', BOARD, 'members', LAURA.uid), {
      uid: LAURA.uid,
      studentId: 'st_laura',
      email: LAURA.email,
      joinedAt: serverTimestamp(),
    })
    batch.update(doc(db, 'boards', BOARD, 'students', 'st_laura'), {
      linkedUids: arrayUnion(LAURA.uid),
      status: 'joined',
      joinedAt: serverTimestamp(),
    })
    batch.set(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
      ...space('st_laura'),
      title: 'Ya con contenido',
    })
    await assertFails(batch.commit())
  })

  it('a board restored from a backup already has the card: the join batch with a card fails, linking alone works', async () => {
    await seed()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'boards', BOARD, 'spaces', 'st_laura'),
        { ...space('st_laura'), title: 'Restaurada' },
      )
    })
    await assertFails(autoJoin(as(LAURA), LAURA, 'st_laura'))
    await assertSucceeds(autoJoin(as(LAURA), LAURA, 'st_laura', false))
  })

  it('joined without a card: the student or the teacher can create the empty card, nobody else', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura', false)
    const card = (db: Firestore) =>
      setDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), space('st_laura'))
    await assertFails(card(as(STRANGER)))
    await assertFails(card(as(OTHER_TEACHER)))
    await assertSucceeds(card(as(TEACHER)))
    await env.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(
        doc(context.firestore(), 'boards', BOARD, 'spaces', 'st_laura'),
      )
    })
    await assertSucceeds(card(as(LAURA)))
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
    await assertFails(updateDoc(ref, edit({ ownerName: '' })))
    await assertFails(updateDoc(ref, edit({ ownerName: 'x'.repeat(121) })))
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

  it('the teacher can only sync the name; the student renames their card from their profile', async () => {
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
    // /me: name + photo, with the server time like any card edit
    await assertSucceeds(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), {
        ownerName: 'Lau',
        ownerPhotoURL: null,
        updatedAt: serverTimestamp(),
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

describe('assets + card cover (M4)', () => {
  const asset = (
    studentId: string,
    assetId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    publicId: `pbl/dev/${BOARD}/${studentId}/${assetId}`,
    studentId,
    kind: 'cover',
    width: 1600,
    height: 900,
    format: 'webp',
    bytes: 250_000,
    status: 'active',
    createdAt: serverTimestamp(),
    ...overrides,
  })

  const cover = (studentId: string, assetId: string) => ({
    assetId,
    publicId: `pbl/dev/${BOARD}/${studentId}/${assetId}`,
    version: 1730000000,
    width: 1600,
    height: 900,
    format: 'webp',
  })

  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  it('the student registers an upload and sets it as their cover', async () => {
    await joined()
    const db = as(LAURA)
    await assertSucceeds(
      setDoc(doc(db, 'boards', BOARD, 'assets', 'a1'), asset('st_laura', 'a1')),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        cover: cover('st_laura', 'a1'),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        cover: null,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('a cover must be a registered upload in my own folder', async () => {
    await joined()
    const ref = doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura')
    // not registered
    await assertFails(
      updateDoc(ref, {
        cover: cover('st_laura', 'ghost'),
        updatedAt: serverTimestamp(),
      }),
    )
    // someone else's folder
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'boards', BOARD, 'assets', 'x1'),
        asset('st_other', 'x1'),
      )
    })
    await assertFails(
      updateDoc(ref, {
        cover: cover('st_other', 'x1'),
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it("cannot register uploads for someone else's space or with a foreign path", async () => {
    await joined()
    const db = as(LAURA)
    await assertFails(
      setDoc(doc(db, 'boards', BOARD, 'assets', 'a2'), asset('st_other', 'a2')),
    )
    await assertFails(
      setDoc(
        doc(db, 'boards', BOARD, 'assets', 'a3'),
        asset('st_laura', 'a3', { publicId: 'somewhere/else/a3' }),
      ),
    )
    await assertFails(
      setDoc(
        doc(db, 'boards', BOARD, 'assets', 'a4'),
        asset('st_laura', 'a4', { bytes: 11 * 1024 * 1024 }),
      ),
    )
  })

  it('reads: the owner and the teacher; not classmates', async () => {
    await joined()
    await setDoc(
      doc(as(LAURA), 'boards', BOARD, 'assets', 'a1'),
      asset('st_laura', 'a1'),
    )
    await assertSucceeds(
      getDoc(doc(as(LAURA), 'boards', BOARD, 'assets', 'a1')),
    )
    await assertSucceeds(
      getDoc(doc(as(TEACHER), 'boards', BOARD, 'assets', 'a1')),
    )
    await assertFails(
      getDoc(doc(as(STRANGER), 'boards', BOARD, 'assets', 'a1')),
    )
  })

  it('status: the owner marks it orphaned; only the teacher marks it deleted', async () => {
    await joined()
    await setDoc(
      doc(as(LAURA), 'boards', BOARD, 'assets', 'a1'),
      asset('st_laura', 'a1'),
    )
    await assertSucceeds(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'assets', 'a1'), {
        status: 'orphaned',
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'assets', 'a1'), {
        status: 'deleted',
      }),
    )
    await assertSucceeds(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'assets', 'a1'), {
        status: 'deleted',
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'assets', 'a1'), { bytes: 1 }),
    )
  })
})

describe('slides (M5)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const spaceRef = (db: Firestore) =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura')
  const slideRef = (db: Firestore, slideId: string, studentId = 'st_laura') =>
    doc(db, 'boards', BOARD, 'spaces', studentId, 'slides', slideId)

  const slide = (overrides: Record<string, unknown> = {}) => ({
    engine: 'excalidraw',
    content: '{"elements":[]}',
    files: {},
    assetIds: [],
    bytes: 15,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
    ...overrides,
  })

  /** What the editor does: create the slide and list it in the space, in one batch */
  function addSlide(db: Firestore, slideId: string, order: string[]) {
    const batch = writeBatch(db)
    batch.set(slideRef(db, slideId), slide())
    batch.update(spaceRef(db), {
      slideOrder: order,
      slideCount: order.length,
      updatedAt: serverTimestamp(),
    })
    return batch.commit()
  }

  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  async function withClassmate() {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the student adds a slide (listed in the slide order) and saves it', async () => {
    await joined()
    await assertSucceeds(addSlide(as(LAURA), 's1', ['s1']))
    await assertSucceeds(
      setDoc(
        slideRef(as(LAURA), 's1'),
        slide({ content: '{"elements":[1]}', bytes: 16 }),
      ),
    )
  })

  it('a slide that is not in the slide order cannot be created', async () => {
    await joined()
    await assertFails(setDoc(slideRef(as(LAURA), 's1'), slide()))
  })

  it('slideCount must match the slide order, max 50 slides', async () => {
    await joined()
    const db = as(LAURA)
    const batch = writeBatch(db)
    batch.set(slideRef(db, 's1'), slide())
    batch.update(spaceRef(db), {
      slideOrder: ['s1'],
      slideCount: 3,
      updatedAt: serverTimestamp(),
    })
    await assertFails(batch.commit())
    const many = Array.from({ length: 51 }, (_, i) => `s${i}`)
    await assertFails(addSlide(db, 's0', many))
  })

  it('reordering and deleting own slides', async () => {
    await joined()
    const db = as(LAURA)
    await addSlide(db, 's1', ['s1'])
    await addSlide(db, 's2', ['s1', 's2'])
    await assertSucceeds(
      updateDoc(spaceRef(db), {
        slideOrder: ['s2', 's1'],
        slideCount: 2,
        updatedAt: serverTimestamp(),
      }),
    )
    const batch = writeBatch(db)
    batch.delete(slideRef(db, 's1'))
    batch.update(spaceRef(db), {
      slideOrder: ['s2'],
      slideCount: 1,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
  })

  it('rejects wrong shape, other engines, oversized scenes and client timestamps', async () => {
    await joined()
    const db = as(LAURA)
    await addSlide(db, 's1', ['s1'])
    const ref = slideRef(db, 's1')
    await assertFails(setDoc(ref, slide({ engine: 'tldraw' })))
    await assertFails(setDoc(ref, slide({ extra: true })))
    await assertFails(setDoc(ref, slide({ content: 'x'.repeat(900_001) })))
    await assertFails(setDoc(ref, slide({ schemaVersion: 2 })))
    // more asset ids than images on the slide
    await assertFails(setDoc(ref, slide({ assetIds: ['a1'] })))
    await assertFails(setDoc(ref, slide({ updatedAt: new Date(2030, 0, 1) })))
  })

  it('classmates and the teacher read slides; nobody else writes them', async () => {
    await joined()
    await addSlide(as(LAURA), 's1', ['s1'])
    await withClassmate()
    await assertSucceeds(getDoc(slideRef(as(SEB), 's1')))
    await assertSucceeds(getDoc(slideRef(as(TEACHER), 's1')))
    await assertFails(getDoc(slideRef(as(STRANGER), 's1')))
    await assertFails(setDoc(slideRef(as(SEB), 's1'), slide()))
    await assertFails(setDoc(slideRef(as(TEACHER), 's1'), slide()))
    await assertFails(deleteDoc(slideRef(as(SEB), 's1')))
    await assertSucceeds(deleteDoc(slideRef(as(TEACHER), 's1')))
  })

  it('no slide edits when the board is locked', async () => {
    await joined()
    await addSlide(as(LAURA), 's1', ['s1'])
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), 'boards', BOARD), {
        status: 'locked',
      }),
    )
    await assertFails(setDoc(slideRef(as(LAURA), 's1'), slide()))
    await assertFails(deleteDoc(slideRef(as(LAURA), 's1')))
    await assertSucceeds(getDoc(slideRef(as(LAURA), 's1')))
  })
})

describe('lifecycle: archive, activity, purge, restore (M7)', () => {
  const boardRef = (db: Firestore) => doc(db, 'boards', BOARD)
  const slideRef = (db: Firestore, slideId: string) =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', slideId)
  const slide = () => ({
    engine: 'excalidraw',
    content: '{"elements":[]}',
    files: {},
    assetIds: [],
    bytes: 15,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
  })
  const daysAgo = (days: number) =>
    Timestamp.fromMillis(Date.now() - days * 24 * 3600 * 1000)

  async function joined(boardOverrides: Record<string, unknown> = {}) {
    await seed({ boardOverrides })
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  async function setBoard(fields: Record<string, unknown>) {
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(doc(context.firestore(), 'boards', BOARD), fields),
    )
  }

  it('members record activity, and nothing else on the board', async () => {
    await joined()
    await assertSucceeds(
      updateDoc(boardRef(as(LAURA)), { lastActivityAt: serverTimestamp() }),
    )
    await assertFails(
      updateDoc(boardRef(as(LAURA)), {
        lastActivityAt: serverTimestamp(),
        title: 'Hacked',
      }),
    )
    await assertFails(
      updateDoc(boardRef(as(LAURA)), { lastActivityAt: daysAgo(-30) }),
    )
    await assertFails(
      updateDoc(boardRef(as(STRANGER)), { lastActivityAt: serverTimestamp() }),
    )
  })

  it('a board unused for longer than archiveAfterDays is read-only (auto-archived)', async () => {
    await joined()
    await setBoard({ lastActivityAt: daysAgo(91) })
    const db = as(LAURA)
    await assertFails(
      updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        title: 'Nuevo',
        updatedAt: serverTimestamp(),
      }),
    )
    // activity can't revive it either: the teacher restores it
    await assertFails(
      updateDoc(boardRef(db), { lastActivityAt: serverTimestamp() }),
    )
    await assertSucceeds(getDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura')))
    // a shorter delay is respected too
    await setBoard({ lastActivityAt: daysAgo(10), archiveAfterDays: 7 })
    await assertFails(
      updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        title: 'Nuevo',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('the teacher archives and restores a board', async () => {
    await joined()
    await assertSucceeds(
      updateDoc(boardRef(as(TEACHER)), {
        status: 'archived',
        archivedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), {
        title: 'Nuevo',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(updateDoc(boardRef(as(LAURA)), { status: 'active' }))
    await assertSucceeds(
      updateDoc(boardRef(as(TEACHER)), {
        status: 'active',
        lastActivityAt: serverTimestamp(),
      }),
    )
  })

  it('purge: only an archived board, only by its teacher', async () => {
    await joined()
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'boards', BOARD, 'assets', 'a1'), {
        publicId: `pbl/dev/${BOARD}/st_laura/a1`,
        studentId: 'st_laura',
        status: 'active',
      }),
    )
    const asset = (db: Firestore) => doc(db, 'boards', BOARD, 'assets', 'a1')
    await assertFails(deleteDoc(boardRef(as(TEACHER))))
    await assertFails(deleteDoc(asset(as(TEACHER))))
    await setBoard({ status: 'archived' })
    await assertFails(deleteDoc(asset(as(LAURA))))
    await assertFails(deleteDoc(boardRef(as(LAURA))))
    await assertFails(deleteDoc(boardRef(as(OTHER_TEACHER))))
    await assertSucceeds(deleteDoc(asset(as(TEACHER))))
    await assertSucceeds(deleteDoc(boardRef(as(TEACHER))))
  })

  it('restoring a backup: the teacher creates slides listed in the space, but never edits them', async () => {
    await joined()
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(slideRef(db, 's1'), slide())
    batch.update(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
      ownerName: 'Laura Nataly',
    })
    // not listed in slideOrder → refused
    await assertFails(batch.commit())
    await env.withSecurityRulesDisabled((context) =>
      updateDoc(
        doc(context.firestore(), 'boards', BOARD, 'spaces', 'st_laura'),
        {
          slideOrder: ['s1'],
          slideCount: 1,
        },
      ),
    )
    await assertSucceeds(setDoc(slideRef(db, 's1'), slide()))
    await assertFails(setDoc(slideRef(db, 's1'), slide()))
  })
})

describe('rules review (M8)', () => {
  const MALLORY = { uid: 'mallory', email: 'mallory@gmail.com' }

  it('nobody can attach their account to a student who joined with the invite link', async () => {
    await seed()
    // The victim joins with the invite link (student st_stranger, source "invite")
    await assertSucceeds(joinWithInvite(as(STRANGER), STRANGER, CODE))
    const db = as(MALLORY)
    const batch = writeBatch(db)
    batch.set(doc(db, 'boards', BOARD, 'studentEmails', MALLORY.email), {
      email: MALLORY.email,
      studentId: `st_${STRANGER.uid}`,
    })
    batch.set(doc(db, 'boards', BOARD, 'members', MALLORY.uid), {
      uid: MALLORY.uid,
      studentId: `st_${STRANGER.uid}`,
      email: MALLORY.email,
      joinedAt: serverTimestamp(),
    })
    await assertFails(batch.commit())
    // …and so can't edit the victim's card
    await assertFails(
      updateDoc(doc(db, 'boards', BOARD, 'spaces', `st_${STRANGER.uid}`), {
        title: 'Hijacked',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('the invite link stops working once the board is auto-archived', async () => {
    await seed({
      boardOverrides: {
        lastActivityAt: Timestamp.fromMillis(
          Date.now() - 100 * 24 * 3600 * 1000,
        ),
      },
    })
    await assertFails(joinWithInvite(as(STRANGER), STRANGER, CODE))
  })

  it('the card photo must be an https URL', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    const card = doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura')
    await assertFails(
      updateDoc(card, {
        ownerPhotoURL: 'javascript:alert(1)',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(card, {
        ownerPhotoURL: 'https://lh3.googleusercontent.com/a/photo',
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe("teacher's notes on slides", () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const notesOf = (db: Firestore) =>
    collection(db, 'boards', BOARD, 'spaces', 'st_laura', 'notes')
  const noteRef = (db: Firestore, noteId = 'n1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'notes', noteId)
  const slidePath = (db: Firestore, slideId = 's1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', slideId)

  const note = (overrides: Record<string, unknown> = {}) => ({
    slideId: 's1',
    visibility: 'private',
    text: 'Buen avance; agrega la fuente del dato.',
    authorEmail: TEACHER.email,
    authorName: 'Profe',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })

  /** Laura joined, has slide s1, a classmate (Seb) joined too, and one note exists */
  async function withSlide(withNote = true) {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', 's1'),
        {
          engine: 'excalidraw',
          content: '{}',
          files: {},
          assetIds: [],
          bytes: 2,
          schemaVersion: 1,
          updatedAt: serverTimestamp(),
        },
      )
      await updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        slideOrder: ['s1'],
        slideCount: 1,
      })
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      if (withNote)
        await setDoc(
          doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'notes', 'n1'),
          note(),
        )
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the board teacher annotates a slide, edits the text and deletes it', async () => {
    await withSlide(false)
    await assertSucceeds(setDoc(noteRef(as(TEACHER)), note()))
    await assertSucceeds(
      updateDoc(noteRef(as(TEACHER)), {
        text: 'Corregido',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(deleteDoc(noteRef(as(TEACHER))))
  })

  it('a note must point to an existing slide, be signed by me, bounded and server-timed', async () => {
    await withSlide(false)
    const db = as(TEACHER)
    await assertFails(setDoc(noteRef(db), note({ slideId: 'nope' })))
    await assertFails(
      setDoc(noteRef(db), note({ authorEmail: OTHER_TEACHER.email })),
    )
    await assertFails(setDoc(noteRef(db), note({ text: '' })))
    await assertFails(setDoc(noteRef(db), note({ text: 'x'.repeat(2001) })))
    await assertFails(
      setDoc(noteRef(db), note({ createdAt: new Date(2030, 0, 1) })),
    )
    await assertFails(setDoc(noteRef(db), note({ resolved: true })))
  })

  it('editing keeps the author and the slide', async () => {
    await withSlide()
    await assertFails(
      updateDoc(noteRef(as(TEACHER)), {
        authorName: 'Otra',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(noteRef(as(TEACHER)), {
        slideId: 's2',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('the owner reads their notes; classmates, other teachers and strangers do not', async () => {
    await withSlide()
    await assertSucceeds(getDocs(notesOf(as(LAURA))))
    await assertSucceeds(getDoc(noteRef(as(TEACHER))))
    await assertFails(getDocs(notesOf(as(SEB))))
    await assertFails(getDoc(noteRef(as(SEB))))
    await assertFails(getDocs(notesOf(as(OTHER_TEACHER))))
    await assertFails(getDoc(noteRef(as(STRANGER))))
  })

  it('students never write notes', async () => {
    await withSlide()
    await assertFails(
      setDoc(noteRef(as(LAURA), 'n2'), note({ authorEmail: LAURA.email })),
    )
    await assertFails(
      updateDoc(noteRef(as(LAURA)), {
        text: 'Todo perfecto',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(deleteDoc(noteRef(as(LAURA))))
    await assertFails(deleteDoc(noteRef(as(SEB))))
  })

  it('the owner deletes them only together with their slide', async () => {
    await withSlide()
    const db = as(LAURA)
    const batch = writeBatch(db)
    batch.delete(slidePath(db))
    batch.delete(noteRef(db))
    batch.update(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
      slideOrder: [],
      slideCount: 0,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(batch.commit())
  })
})

describe('Design Thinking stage (M11)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const cardOf = (db: Firestore, studentId = 'st_laura') =>
    doc(db, 'boards', BOARD, 'spaces', studentId)
  const byStudent = (stage: string | null) => ({
    stage,
    stageUpdatedAt: serverTimestamp(),
    stageSetBy: 'student',
    updatedAt: serverTimestamp(),
  })
  const byTeacher = (stage: string | null) => ({
    stage,
    stageUpdatedAt: serverTimestamp(),
    stageSetBy: 'teacher',
  })

  async function joined(boardOverrides: Record<string, unknown> = {}) {
    await seed({ boardOverrides })
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  it('the student sets and clears their own stage, signed as the student', async () => {
    await joined()
    await assertSucceeds(updateDoc(cardOf(as(LAURA)), byStudent('ideate')))
    await assertSucceeds(updateDoc(cardOf(as(LAURA)), byStudent('browsing')))
    await assertSucceeds(updateDoc(cardOf(as(LAURA)), byStudent(null)))
    // can't pretend the teacher set it, or skip the server time
    await assertFails(
      updateDoc(cardOf(as(LAURA)), {
        ...byStudent('ideate'),
        stageSetBy: 'teacher',
      }),
    )
    await assertFails(
      updateDoc(cardOf(as(LAURA)), {
        ...byStudent('define'),
        stageUpdatedAt: Timestamp.fromMillis(0),
      }),
    )
  })

  it('stage ids follow the pattern', async () => {
    await joined()
    await assertFails(updateDoc(cardOf(as(LAURA)), byStudent('Ideate')))
    await assertFails(updateDoc(cardOf(as(LAURA)), byStudent('x'.repeat(41))))
    await assertFails(
      updateDoc(cardOf(as(LAURA)), {
        ...byStudent('ideate'),
        stageSetBy: 'admin',
      }),
    )
  })

  it("a classmate can't change my stage", async () => {
    await joined()
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
    await assertFails(updateDoc(cardOf(as(SEB)), byStudent('ideate')))
    await assertFails(updateDoc(cardOf(as(SEB)), byTeacher('ideate')))
  })

  it('the board teacher sets any stage, signed as the teacher, and nothing else', async () => {
    await joined()
    await assertSucceeds(updateDoc(cardOf(as(TEACHER)), byTeacher('prototype')))
    await assertFails(
      updateDoc(cardOf(as(TEACHER)), {
        ...byTeacher('test'),
        stageSetBy: 'student',
      }),
    )
    await assertFails(
      updateDoc(cardOf(as(TEACHER)), { ...byTeacher('test'), title: 'x' }),
    )
    // another teacher (not of this board)
    await assertFails(
      updateDoc(cardOf(as(OTHER_TEACHER)), byTeacher('prototype')),
    )
  })

  it('nobody changes stages on a locked board', async () => {
    await joined({ status: 'locked' })
    await assertFails(updateDoc(cardOf(as(LAURA)), byStudent('ideate')))
    await assertFails(updateDoc(cardOf(as(TEACHER)), byTeacher('ideate')))
  })

  it('the teacher edits the board stage list (1 to 9) or resets it', async () => {
    await seed()
    const ref = doc(as(TEACHER), 'boards', BOARD)
    const stage = (id: string) => ({ id, color: '#E11D48', kind: 'stage' })
    await assertSucceeds(
      updateDoc(ref, { stages: [stage('explore'), stage('build')] }),
    )
    await assertSucceeds(updateDoc(ref, { stages: null }))
    await assertFails(updateDoc(ref, { stages: [] }))
    await assertFails(
      updateDoc(ref, {
        stages: Array.from({ length: 10 }, (_, i) => stage(`s${i}`)),
      }),
    )
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD), { stages: [stage('x')] }),
    )
  })

  it('profile photos: the owner may put a Cloudinary URL on their card', async () => {
    await joined()
    await assertSucceeds(
      updateDoc(cardOf(as(LAURA)), {
        ownerPhotoURL:
          'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_256,h_256/v1/pbl/prod/users/laura-gmail/avatar',
        updatedAt: serverTimestamp(),
      }),
    )
  })
})

describe('board customization (M12)', () => {
  const boardOf = (db: Firestore) => doc(db, 'boards', BOARD)
  const look = {
    background: 'night',
    pattern: 'grid',
    layout: 'stages',
    sortBy: 'name',
    stickyHeader: false,
  }
  const logoRef = (folder = 'board', assetId = 'logo1') => ({
    assetId,
    publicId: `pbl/prod/${BOARD}/${folder}/${assetId}`,
    version: 1,
    width: 512,
    height: 256,
    format: 'png',
  })
  const logoAsset = (overrides: Record<string, unknown> = {}) => ({
    publicId: `pbl/prod/${BOARD}/board/logo1`,
    studentId: 'board',
    kind: 'logo',
    width: 512,
    height: 256,
    format: 'png',
    bytes: 2000,
    status: 'active',
    createdAt: serverTimestamp(),
    ...overrides,
  })

  it('the board teacher sets the look; values must be known', async () => {
    await seed()
    await assertSucceeds(updateDoc(boardOf(as(TEACHER)), look))
    await assertFails(updateDoc(boardOf(as(TEACHER)), { background: 'neon' }))
    await assertFails(updateDoc(boardOf(as(TEACHER)), { layout: 'kanban' }))
    await assertFails(updateDoc(boardOf(as(TEACHER)), { pattern: 'stripes' }))
    await assertFails(updateDoc(boardOf(as(TEACHER)), { sortBy: 'random' }))
    await assertFails(updateDoc(boardOf(as(TEACHER)), { stickyHeader: 'yes' }))
  })

  it('students and other teachers cannot change the look', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(updateDoc(boardOf(as(LAURA)), look))
    await assertFails(updateDoc(boardOf(as(OTHER_TEACHER)), look))
  })

  it('the teacher uploads a logo into the board folder (registry + board, one batch)', async () => {
    await seed()
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(doc(db, 'boards', BOARD, 'assets', 'logo1'), logoAsset())
    batch.update(boardOf(db), { logo: logoRef() })
    await assertSucceeds(batch.commit())
    await assertSucceeds(updateDoc(boardOf(db), { logo: null }))
  })

  it("a logo must be a registered image in the board's own folder", async () => {
    await seed()
    const db = as(TEACHER)
    // not registered
    await assertFails(updateDoc(boardOf(db), { logo: logoRef() }))
    // a student's image used as the logo
    await assertFails(
      updateDoc(boardOf(db), { logo: logoRef('st_laura', 'a1') }),
    )
  })

  it('students cannot register a logo', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(
      setDoc(doc(as(LAURA), 'boards', BOARD, 'assets', 'logo1'), logoAsset()),
    )
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'assets', 'logo2'),
        logoAsset({
          studentId: 'st_laura',
          publicId: `pbl/prod/${BOARD}/st_laura/logo2`,
        }),
      ),
    )
  })

  it("the teacher keeps their name and photo on the board (#DOCENTE); students can't", async () => {
    await seed()
    const profile = {
      name: 'Profe',
      photoURL: 'https://lh3.googleusercontent.com/a/x',
    }
    await assertSucceeds(
      updateDoc(
        boardOf(as(TEACHER)),
        new FieldPath('teacherProfiles', TEACHER.email),
        profile,
      ),
    )
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(
      updateDoc(
        boardOf(as(LAURA)),
        new FieldPath('teacherProfiles', LAURA.email),
        profile,
      ),
    )
  })

  it("the teacher copies the roster's group to the card; the student can't change it", async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertSucceeds(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), {
        group: 'Equipo 1',
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), {
        group: 'Equipo 9',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), {
        group: 'x'.repeat(61),
      }),
    )
  })
})

describe("teacher edits students' slides (M15)", () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const spaceRef = (db: Firestore) =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura')
  const slideRef = (db: Firestore, slideId = 's1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', slideId)
  const versionRef = (db: Firestore, kind: string, slideId = 's1') =>
    doc(slideRef(db, slideId), 'versions', kind)
  const lockRef = (db: Firestore, slideId = 's1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'locks', slideId)
  const slide = (overrides: Record<string, unknown> = {}) => ({
    engine: 'excalidraw',
    content: '{"elements":[]}',
    files: {},
    assetIds: [],
    bytes: 15,
    schemaVersion: 1,
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const asTeacher = (overrides: Record<string, unknown> = {}) =>
    slide({
      content: '{"elements":[2]}',
      lastEditedBy: 'teacher',
      teacherEditedAt: serverTimestamp(),
      ...overrides,
    })
  const version = (kind: string) => ({
    content: '{"elements":[]}',
    files: {},
    assetIds: [],
    bytes: 15,
    kind,
    createdAt: serverTimestamp(),
  })
  const lock = (uid: string, role: string) => ({
    uid,
    name: 'x',
    role,
    at: serverTimestamp(),
  })

  /** Laura joined with one slide s1 */
  async function withSlide(boardOverrides: Record<string, unknown> = {}) {
    await seed({ boardOverrides })
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        slideOrder: ['s1'],
        slideCount: 1,
      })
      await setDoc(
        doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', 's1'),
        slide(),
      )
    })
  }

  it("the board teacher saves a student's slide, keeping the student's version", async () => {
    await withSlide()
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(slideRef(db), asTeacher())
    batch.set(versionRef(db, 'student'), version('student'))
    batch.update(spaceRef(db), { teacherEditsUnseen: true })
    await assertSucceeds(batch.commit())
  })

  it("the teacher's save must be signed as the teacher; the student's can't claim it", async () => {
    await withSlide()
    await assertFails(
      setDoc(slideRef(as(TEACHER)), asTeacher({ lastEditedBy: 'student' })),
    )
    await assertFails(
      setDoc(
        slideRef(as(LAURA)),
        asTeacher({ teacherEditedAt: serverTimestamp() }),
      ),
    )
    await assertSucceeds(
      setDoc(slideRef(as(LAURA)), slide({ lastEditedBy: 'student' })),
    )
  })

  it('classmates and teachers of other boards cannot edit', async () => {
    await withSlide()
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
    await assertFails(setDoc(slideRef(as(SEB)), slide()))
    await assertFails(setDoc(slideRef(as(OTHER_TEACHER)), asTeacher()))
    await assertFails(
      setDoc(versionRef(as(SEB), 'student'), version('student')),
    )
  })

  it('nobody edits on a locked board', async () => {
    await withSlide({ status: 'locked' })
    await assertFails(setDoc(slideRef(as(TEACHER)), asTeacher()))
  })

  it('the teacher appends a slide and (M27, D129) reorders, never duplicating one', async () => {
    await withSlide()
    const db = as(TEACHER)
    const add = writeBatch(db)
    add.set(slideRef(db, 's2'), asTeacher())
    add.update(spaceRef(db), {
      slideOrder: ['s1', 's2'],
      slideCount: 2,
      teacherEditsUnseen: true,
    })
    await assertSucceeds(add.commit())
    await assertSucceeds(
      updateDoc(spaceRef(db), {
        slideOrder: ['s2', 's1'],
        slideCount: 2,
        teacherEditsUnseen: true,
      }),
    )
    await assertFails(
      updateDoc(spaceRef(db), {
        slideOrder: ['s1', 's1'],
        slideCount: 2,
        teacherEditsUnseen: true,
      }),
    )
  })

  it('versions: the teacher keeps only the student one; the student swaps both; only they read them', async () => {
    await withSlide()
    await assertFails(
      setDoc(versionRef(as(TEACHER), 'teacher'), version('teacher')),
    )
    await assertFails(
      setDoc(versionRef(as(TEACHER), 'other'), version('other')),
    )
    await assertSucceeds(
      setDoc(versionRef(as(TEACHER), 'student'), version('student')),
    )
    await assertSucceeds(
      setDoc(versionRef(as(LAURA), 'teacher'), version('teacher')),
    )
    await assertSucceeds(getDoc(versionRef(as(LAURA), 'student')))
    await assertFails(getDoc(versionRef(as(OTHER_TEACHER), 'student')))
  })

  it('the student clears the "✎ Docente" badge without bumping the card', async () => {
    await withSlide()
    await assertSucceeds(
      updateDoc(spaceRef(as(TEACHER)), { teacherEditsUnseen: true }),
    )
    // only the student clears it
    await assertFails(
      updateDoc(spaceRef(as(TEACHER)), { teacherEditsUnseen: false }),
    )
    await assertSucceeds(
      updateDoc(spaceRef(as(LAURA)), { teacherEditsUnseen: false }),
    )
  })

  it('one editor at a time: a fresh lock blocks the other, a stale one is free', async () => {
    await withSlide()
    await assertSucceeds(setDoc(lockRef(as(LAURA)), lock(LAURA.uid, 'student')))
    // the holder renews it
    await assertSucceeds(setDoc(lockRef(as(LAURA)), lock(LAURA.uid, 'student')))
    await assertFails(
      setDoc(lockRef(as(TEACHER)), lock(TEACHER.uid, 'teacher')),
    )
    // can't pretend to be someone else or the teacher
    await assertFails(setDoc(lockRef(as(LAURA)), lock(TEACHER.uid, 'student')))
    await assertFails(setDoc(lockRef(as(LAURA)), lock(LAURA.uid, 'teacher')))
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(
          context.firestore(),
          'boards',
          BOARD,
          'spaces',
          'st_laura',
          'locks',
          's1',
        ),
        {
          uid: LAURA.uid,
          name: 'x',
          role: 'student',
          at: Timestamp.fromMillis(Date.now() - 120_000),
        },
      )
    })
    await assertSucceeds(
      setDoc(lockRef(as(TEACHER)), lock(TEACHER.uid, 'teacher')),
    )
    await assertSucceeds(deleteDoc(lockRef(as(TEACHER))))
  })

  it('the teacher adds an image to the student slide (registry in the student folder)', async () => {
    await withSlide()
    await assertSucceeds(
      setDoc(doc(as(TEACHER), 'boards', BOARD, 'assets', 'img1'), {
        publicId: `pbl/prod/${BOARD}/st_laura/img1`,
        studentId: 'st_laura',
        kind: 'slide',
        width: 10,
        height: 10,
        format: 'png',
        bytes: 100,
        status: 'active',
        createdAt: serverTimestamp(),
      }),
    )
  })
})

describe("teacher's class tools (M16)", () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const boardOf = (db: Firestore) => doc(db, 'boards', BOARD)
  const pollRef = (db: Firestore, pollId = 'p1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'polls', pollId)
  const voteRef = (db: Firestore, voterId: string, pollId = 'p1') =>
    doc(pollRef(db, pollId), 'votes', voterId)
  const clock = (overrides: Record<string, unknown> = {}) => ({
    mode: 'activity',
    label: 'Lluvia de ideas',
    instructions: '',
    durationMs: 600_000,
    startedAt: serverTimestamp(),
    elapsedBeforeMs: 0,
    paused: false,
    ...overrides,
  })
  const poll = (overrides: Record<string, unknown> = {}) => ({
    question: '¿Qué idea desarrollo?',
    options: [
      { id: 'a', label: 'Idea 1' },
      { id: 'b', label: 'Idea 2' },
    ],
    optionIds: ['a', 'b'],
    counts: {},
    anonymous: false,
    status: 'open',
    authorUid: LAURA.uid,
    authorName: 'Laura',
    authorRole: 'student',
    createdAt: serverTimestamp(),
    ...overrides,
  })

  /** Laura and Seb joined; Laura has poll p1 (optionally anonymous / closed) */
  async function withPoll(overrides: Record<string, unknown> = {}) {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      await setDoc(
        doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'polls', 'p1'),
        poll({ createdAt: Timestamp.now(), ...overrides }),
      )
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  function vote(
    db: Firestore,
    voterId: string,
    optionId: string,
    counts: Record<string, number>,
  ) {
    const batch = writeBatch(db)
    batch.set(voteRef(db, voterId), { optionId, votedAt: serverTimestamp() })
    batch.update(pollRef(db), { counts })
    return batch.commit()
  }

  it('only the board teacher runs the class clock, with valid values', async () => {
    await seed()
    await assertSucceeds(updateDoc(boardOf(as(TEACHER)), { clock: clock() }))
    await assertSucceeds(updateDoc(boardOf(as(TEACHER)), { clock: null }))
    await assertFails(
      updateDoc(boardOf(as(TEACHER)), { clock: clock({ mode: 'party' }) }),
    )
    await assertFails(
      updateDoc(boardOf(as(TEACHER)), {
        clock: clock({ durationMs: 4 * 3600_000 }),
      }),
    )
    await assertFails(
      updateDoc(boardOf(as(TEACHER)), {
        clock: clock({ elapsedBeforeMs: 700_000 }),
      }),
    )
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(updateDoc(boardOf(as(LAURA)), { clock: clock() }))
  })

  it('the student marks their slides ready; classmates cannot, the teacher only with a signed status (M27)', async () => {
    await withPoll()
    const ready = {
      readyToPresent: true,
      readyAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await assertSucceeds(
      updateDoc(doc(as(LAURA), 'boards', BOARD, 'spaces', 'st_laura'), ready),
    )
    await assertFails(
      updateDoc(doc(as(SEB), 'boards', BOARD, 'spaces', 'st_laura'), ready),
    )
    await assertFails(
      updateDoc(doc(as(TEACHER), 'boards', BOARD, 'spaces', 'st_laura'), ready),
    )
  })

  it('polls: the owner and the teacher create them; classmates cannot; counts start empty', async () => {
    await withPoll()
    await assertSucceeds(setDoc(pollRef(as(LAURA), 'p2'), poll()))
    await assertSucceeds(
      setDoc(
        pollRef(as(TEACHER), 'p3'),
        poll({ authorUid: TEACHER.uid, authorRole: 'teacher' }),
      ),
    )
    await assertFails(
      setDoc(pollRef(as(SEB), 'p4'), poll({ authorUid: SEB.uid })),
    )
    await assertFails(
      setDoc(pollRef(as(LAURA), 'p5'), poll({ counts: { a: 10 } })),
    )
    await assertFails(
      setDoc(pollRef(as(LAURA), 'p6'), poll({ authorRole: 'teacher' })),
    )
  })

  it('a classmate votes once (counts follow), can change it, cannot inflate or vote for others', async () => {
    await withPoll()
    await assertFails(vote(as(SEB), 'st_laura', 'a', { a: 1 }))
    await assertFails(vote(as(SEB), 'st_seb', 'a', { a: 2 }))
    await assertFails(vote(as(SEB), 'st_seb', 'zzz', { zzz: 1 }))
    await assertFails(updateDoc(pollRef(as(SEB)), { counts: { a: 1 } }))
    await assertSucceeds(vote(as(SEB), 'st_seb', 'a', { a: 1 }))
    // change: one down, one up
    await assertSucceeds(vote(as(SEB), 'st_seb', 'b', { a: 0, b: 1 }))
    // voting again for the same option changes nothing (refused)
    await assertFails(vote(as(SEB), 'st_seb', 'b', { a: 0, b: 2 }))
  })

  it('no votes on a closed poll; the author closes and reopens', async () => {
    await withPoll()
    await assertSucceeds(updateDoc(pollRef(as(LAURA)), { status: 'closed' }))
    await assertFails(vote(as(SEB), 'st_seb', 'a', { a: 1 }))
    await assertFails(updateDoc(pollRef(as(SEB)), { status: 'open' }))
    await assertSucceeds(updateDoc(pollRef(as(TEACHER)), { status: 'open' }))
  })

  it('who voted: the teacher, the author unless anonymous, each student their own', async () => {
    await withPoll()
    await assertSucceeds(vote(as(SEB), 'st_seb', 'a', { a: 1 }))
    await assertSucceeds(getDoc(voteRef(as(SEB), 'st_seb')))
    await assertFails(getDocs(collection(pollRef(as(SEB)), 'votes')))
    await assertSucceeds(getDocs(collection(pollRef(as(LAURA)), 'votes')))
    await assertSucceeds(getDocs(collection(pollRef(as(TEACHER)), 'votes')))
  })

  it('anonymous polls hide the votes from the author', async () => {
    await withPoll({ anonymous: true })
    await assertSucceeds(vote(as(SEB), 'st_seb', 'a', { a: 1 }))
    await assertFails(getDocs(collection(pollRef(as(LAURA)), 'votes')))
    await assertFails(getDoc(voteRef(as(LAURA), 'st_seb')))
  })
})

describe('attendance (M18)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const day = (db: Firestore, date = '2026-11-03') =>
    doc(db, 'boards', BOARD, 'attendance', date)
  const summary = (db: Firestore, studentId: string) =>
    doc(db, 'boards', BOARD, 'attendanceByStudent', studentId)
  const record = (overrides: Record<string, unknown> = {}) => ({
    date: '2026-11-03',
    topic: 'Sesión 4 · Prototipos',
    marks: {
      st_laura: { status: 'late', note: 'Bus' },
      st_seb: { status: 'present' },
    },
    takenBy: TEACHER.email,
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const own = (dates: Record<string, string>) => ({
    dates,
    updatedAt: serverTimestamp(),
  })

  /** Laura and Seb joined; the teacher took attendance on Nov 3 */
  async function withAttendance() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      await setDoc(day(db), record({ updatedAt: Timestamp.now() }))
      await setDoc(summary(db, 'st_laura'), {
        dates: { '2026-11-03': 'late' },
        updatedAt: Timestamp.now(),
      })
      await setDoc(summary(db, 'st_seb'), {
        dates: { '2026-11-03': 'present' },
        updatedAt: Timestamp.now(),
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the board teacher takes attendance: the record and the summaries in one batch', async () => {
    await seed()
    const db = as(TEACHER)
    const batch = writeBatch(db)
    batch.set(day(db, '2026-11-10'), record({ date: '2026-11-10' }))
    batch.set(summary(db, 'st_laura'), own({ '2026-11-10': 'late' }))
    await assertSucceeds(batch.commit())
    await assertSucceeds(getDoc(day(db, '2026-11-10')))
    await assertSucceeds(getDocs(collection(db, 'boards', BOARD, 'attendance')))
    await assertSucceeds(
      updateDoc(day(db, '2026-11-10'), {
        marks: { st_laura: { status: 'present' } },
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(deleteDoc(day(db, '2026-11-10')))
  })

  it('the record is checked: date id, topic, signed by me, server time', async () => {
    await seed()
    const db = as(TEACHER)
    await assertFails(
      setDoc(day(db, '2026-13-01'), record({ date: '2026-13-01' })),
    )
    await assertFails(setDoc(day(db, 'hoy'), record({ date: 'hoy' })))
    await assertFails(setDoc(day(db), record({ date: '2026-11-04' })))
    await assertFails(setDoc(day(db), record({ topic: 'x'.repeat(121) })))
    await assertFails(setDoc(day(db), record({ takenBy: OTHER_TEACHER.email })))
    await assertFails(setDoc(day(db), record({ updatedAt: Timestamp.now() })))
    await assertFails(setDoc(day(db), record({ marks: 'todos' })))
    await assertFails(setDoc(day(db), { ...record(), extra: true }))
    await assertFails(
      setDoc(summary(db, 'st_laura'), {
        dates: 'x',
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it("students and other teachers can't read or write the records", async () => {
    await withAttendance()
    for (const user of [LAURA, OTHER_TEACHER, STRANGER]) {
      const db = as(user)
      await assertFails(getDoc(day(db)))
      await assertFails(getDocs(collection(db, 'boards', BOARD, 'attendance')))
      await assertFails(
        setDoc(
          day(db, '2026-11-10'),
          record({ date: '2026-11-10', takenBy: user.email }),
        ),
      )
      await assertFails(deleteDoc(day(db)))
      await assertFails(
        setDoc(summary(db, 'st_laura'), own({ '2026-11-03': 'present' })),
      )
    }
  })

  it("a student reads only their own summary (both accounts), never a classmate's", async () => {
    await withAttendance()
    await autoJoin(as(LAURA_UNI), LAURA_UNI, 'st_laura', false)
    await assertSucceeds(getDoc(summary(as(LAURA), 'st_laura')))
    await assertSucceeds(getDoc(summary(as(LAURA_UNI), 'st_laura')))
    await assertFails(getDoc(summary(as(LAURA), 'st_seb')))
    await assertFails(
      getDocs(collection(as(LAURA), 'boards', BOARD, 'attendanceByStudent')),
    )
    await assertSucceeds(getDoc(summary(as(SEB), 'st_seb')))
    await assertFails(getDoc(summary(as(STRANGER), 'st_laura')))
    await assertFails(getDoc(summary(as(OTHER_TEACHER), 'st_laura')))
  })
})

describe('status message, decorations and board styles (M21)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const lauraCard = (db: Firestore) =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura')
  const hello = { emoji: '🎃', text: '¡Feliz Halloween!' }
  const decor = { banner: 'sunrise', sticker: '🚀' }

  async function withLaura() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
  }

  it('a person saves a short message and decorations on their profile; links and long texts are refused', async () => {
    await seed()
    const ref = doc(as(LAURA), 'users', LAURA.uid)
    const profile = { displayName: 'Laura', email: LAURA.email, photoURL: null }
    await assertSucceeds(setDoc(ref, { ...profile, status: hello, decor }))
    await assertSucceeds(setDoc(ref, { ...profile, status: null, decor: null }))
    for (const status of [
      { emoji: '', text: 'mira https://spam.example' },
      { emoji: '', text: 'www.spam.co' },
      { emoji: '', text: 'x'.repeat(61) },
      { emoji: '', text: '' },
      { emoji: '🎃', text: 'hola', extra: 1 },
    ])
      await assertFails(setDoc(ref, { ...profile, status }))
    await assertFails(
      setDoc(ref, {
        ...profile,
        decor: { banner: 'Not valid!', sticker: null },
      }),
    )
  })

  it('the owner copies them to their card; a classmate cannot', async () => {
    await withLaura()
    await assertSucceeds(
      updateDoc(lauraCard(as(LAURA)), {
        ownerStatus: hello,
        ownerDecor: decor,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(lauraCard(as(LAURA)), {
        ownerStatus: { emoji: '', text: 'http://x.co' },
        updatedAt: serverTimestamp(),
      }),
    )
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
    await assertFails(
      updateDoc(lauraCard(as(SEB)), {
        ownerStatus: { emoji: '', text: 'jaja' },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it("the board's teacher may clear a message, never write one; other teachers can't", async () => {
    await withLaura()
    await updateDoc(lauraCard(as(LAURA)), {
      ownerStatus: hello,
      updatedAt: serverTimestamp(),
    })
    await assertFails(
      updateDoc(lauraCard(as(TEACHER)), {
        ownerStatus: { emoji: '', text: 'otro' },
      }),
    )
    await assertFails(
      updateDoc(lauraCard(as(OTHER_TEACHER)), { ownerStatus: null }),
    )
    await assertSucceeds(
      updateDoc(lauraCard(as(TEACHER)), { ownerStatus: null }),
    )
  })

  it('board styles: the teacher picks one, with optional dates and a title line; bad values are refused', async () => {
    await seed()
    const ref = doc(as(TEACHER), 'boards', BOARD)
    await assertSucceeds(
      updateDoc(ref, {
        style: 'navidad',
        ambient: true,
        accessories: false,
        tagline: '¡Lo lograron! · Clase de 2026',
        schedule: { style: 'navidad', from: '2026-12-01', to: '2027-01-06' },
      }),
    )
    await assertSucceeds(updateDoc(ref, { style: null, schedule: null }))
    await assertFails(updateDoc(ref, { style: 'disco' }))
    await assertFails(updateDoc(ref, { tagline: 'x'.repeat(61) }))
    await assertFails(updateDoc(ref, { ambient: 'yes' }))
    await assertFails(
      updateDoc(ref, {
        schedule: { style: 'navidad', from: '2027-01-06', to: '2026-12-01' },
      }),
    )
    await assertFails(
      updateDoc(ref, {
        schedule: { style: 'navidad', from: 'diciembre', to: '2027-01-06' },
      }),
    )
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD), { style: 'halloween' }),
    )
  })
})

describe('announcements (M19)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const news = (db: Firestore, id = 'a1') =>
    doc(db, 'boards', BOARD, 'announcements', id)
  const state = (db: Firestore, uid: string) =>
    doc(db, 'boards', BOARD, 'announcementState', uid)
  const announcement = (overrides: Record<string, unknown> = {}) => ({
    title: 'Mañana traigan su prototipo',
    body: 'En papel o digital.',
    link: '',
    important: true,
    authorEmail: TEACHER.email,
    authorName: 'Docente',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    remindedAt: serverTimestamp(),
    ...overrides,
  })
  const mine = (read: Record<string, unknown> = {}) => ({
    read,
    removed: {},
    updatedAt: serverTimestamp(),
  })

  /** Laura and Seb joined; the teacher announced a1 */
  async function withNews() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      const now = Timestamp.now()
      await setDoc(
        news(db),
        announcement({ createdAt: now, updatedAt: now, remindedAt: now }),
      )
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the board teacher announces, edits, reminds and deletes; the content is checked', async () => {
    await seed()
    const db = as(TEACHER)
    await assertSucceeds(
      setDoc(news(db, 'a2'), announcement({ link: '/b/board1' })),
    )
    await assertSucceeds(
      updateDoc(news(db, 'a2'), {
        body: 'Corregido',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(news(db, 'a2'), {
        remindedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(news(db, 'a2'), {
        createdAt: Timestamp.now(),
        updatedAt: serverTimestamp(),
      }),
    )
    for (const bad of [
      { title: '' },
      { title: 'x'.repeat(81) },
      { body: 'x'.repeat(501) },
      { link: 'javascript:alert(1)' },
      { link: 'http://insecure.example' },
      { important: 'yes' },
      { authorEmail: OTHER_TEACHER.email },
      { remindedAt: Timestamp.fromMillis(0) },
    ])
      await assertFails(setDoc(news(db, 'bad'), announcement(bad)))
    await assertSucceeds(deleteDoc(news(db, 'a2')))
  })

  it('members read announcements but never write them; outsiders and other teachers see nothing', async () => {
    await withNews()
    await assertSucceeds(getDoc(news(as(LAURA))))
    await assertSucceeds(
      getDocs(collection(as(SEB), 'boards', BOARD, 'announcements')),
    )
    await assertFails(
      setDoc(news(as(LAURA), 'x'), announcement({ authorEmail: LAURA.email })),
    )
    await assertFails(
      updateDoc(news(as(LAURA)), {
        title: 'hack',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(deleteDoc(news(as(LAURA))))
    await assertFails(getDoc(news(as(STRANGER))))
    await assertFails(
      setDoc(
        news(as(OTHER_TEACHER), 'x'),
        announcement({ authorEmail: OTHER_TEACHER.email }),
      ),
    )
  })

  it('each member keeps only their own read / removed state; the teacher reads them all', async () => {
    await withNews()
    await assertSucceeds(
      setDoc(state(as(LAURA), LAURA.uid), mine({ a1: serverTimestamp() })),
    )
    await assertSucceeds(getDoc(state(as(LAURA), LAURA.uid)))
    await assertFails(getDoc(state(as(SEB), LAURA.uid)))
    await assertFails(setDoc(state(as(SEB), LAURA.uid), mine()))
    await assertFails(
      setDoc(state(as(LAURA), LAURA.uid), { ...mine(), extra: 1 }),
    )
    await assertFails(setDoc(state(as(STRANGER), STRANGER.uid), mine()))
    await assertSucceeds(
      getDocs(collection(as(TEACHER), 'boards', BOARD, 'announcementState')),
    )
    await assertFails(
      getDocs(collection(as(LAURA), 'boards', BOARD, 'announcementState')),
    )
  })
})

describe('class participation (M10)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const klass = (db: Firestore, id = 'c1') =>
    doc(db, 'boards', BOARD, 'classes', id)
  const slide = (db: Firestore, id = 's1', classId = 'c1') =>
    doc(db, 'boards', BOARD, 'classes', classId, 'slides', id)
  const note = (db: Firestore, id: string) =>
    doc(db, 'boards', BOARD, 'classes', 'c1', 'slides', 's1', 'notes', id)
  const classData = (overrides: Record<string, unknown> = {}) => ({
    title: 'Clase 3: entrevistas',
    date: '2026-11-12',
    status: 'open',
    slideOrder: ['s1'],
    follow: false,
    liveSlideId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const slideData = (overrides: Record<string, unknown> = {}) => ({
    title: '¿Qué aprendiste?',
    instructions: 'Una idea por nota',
    layout: 'columns2',
    zones: ['Funcionó', 'Mejorar'],
    locked: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const noteData = (
    user: { uid: string },
    overrides: Record<string, unknown> = {},
  ) => ({
    text: 'Entendían el menú',
    color: 'yellow',
    x: 0.1,
    y: 0.2,
    authorUid: user.uid,
    authorStudentId: user.uid === TEACHER.uid ? null : 'st_laura',
    authorName: 'Laura Nataly',
    authorRole: user.uid === TEACHER.uid ? 'teacher' : 'student',
    reactions: {},
    editedByTeacher: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })

  /** Laura and Seb joined; the teacher has class c1 (open) with slide s1 */
  async function withClass(
    classOverrides: Record<string, unknown> = {},
    slideOverrides: Record<string, unknown> = {},
  ) {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      const now = Timestamp.now()
      await setDoc(
        klass(db),
        classData({ createdAt: now, updatedAt: now, ...classOverrides }),
      )
      await setDoc(
        slide(db),
        slideData({ createdAt: now, updatedAt: now, ...slideOverrides }),
      )
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  async function lauraNote(overrides: Record<string, unknown> = {}) {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      const now = Timestamp.now()
      await setDoc(
        note(db, `${LAURA.uid}_1`),
        noteData(LAURA, { createdAt: now, updatedAt: now, ...overrides }),
      )
    })
  }

  it('the board teacher creates classes and wall slides; the content is checked; students only read', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    const db = as(TEACHER)
    await assertSucceeds(setDoc(klass(db), classData()))
    await assertSucceeds(setDoc(slide(db), slideData()))
    await assertSucceeds(
      updateDoc(klass(db), {
        status: 'closed',
        follow: true,
        liveSlideId: 's1',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(slide(db), { locked: true, updatedAt: serverTimestamp() }),
    )
    for (const bad of [
      { title: '' },
      { date: '12/11/2026' },
      { status: 'draft' },
      { slideOrder: ['a', 'b', 'c', 'd', 'e', 'f'] },
    ])
      await assertFails(setDoc(klass(db, 'c2'), classData(bad)))
    for (const bad of [
      { layout: 'circle' },
      { zones: ['1', '2', '3', '4', '5'] },
    ])
      await assertFails(setDoc(slide(db, 's2'), slideData(bad)))

    await assertSucceeds(getDoc(klass(as(LAURA))))
    await assertSucceeds(getDocs(collection(klass(as(LAURA)), 'slides')))
    await assertFails(setDoc(klass(as(LAURA), 'c3'), classData()))
    await assertFails(
      updateDoc(slide(as(LAURA)), {
        locked: false,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(getDoc(klass(as(STRANGER))))
    await assertFails(getDoc(klass(as(OTHER_TEACHER))))
  })

  it('a student adds notes with their own id, name and student id, up to 20 per slide', async () => {
    await withClass()
    const db = as(LAURA)
    await assertSucceeds(setDoc(note(db, `${LAURA.uid}_1`), noteData(LAURA)))
    await assertSucceeds(setDoc(note(db, `${LAURA.uid}_20`), noteData(LAURA)))
    // the 21st, someone else's id, a fake student id, a teacher badge, pre-filled reactions
    await assertFails(setDoc(note(db, `${LAURA.uid}_21`), noteData(LAURA)))
    await assertFails(setDoc(note(db, `${SEB.uid}_1`), noteData(LAURA)))
    await assertFails(
      setDoc(
        note(db, `${LAURA.uid}_2`),
        noteData(LAURA, { authorStudentId: 'st_seb' }),
      ),
    )
    await assertFails(
      setDoc(
        note(db, `${LAURA.uid}_3`),
        noteData(LAURA, { authorRole: 'teacher', authorStudentId: null }),
      ),
    )
    await assertFails(
      setDoc(
        note(db, `${LAURA.uid}_4`),
        noteData(LAURA, {
          reactions: { [LAURA.uid]: { name: 'L', emojis: ['👍'] } },
        }),
      ),
    )
    for (const bad of [
      { text: '' },
      { text: 'x'.repeat(201) },
      { color: 'black' },
      { x: 1.5 },
      { y: -0.1 },
    ])
      await assertFails(
        setDoc(note(db, `${LAURA.uid}_5`), noteData(LAURA, bad)),
      )
    // Not a member: nothing
    await assertFails(
      setDoc(note(as(STRANGER), `${STRANGER.uid}_1`), noteData(STRANGER)),
    )
  })

  it('the author edits, moves and deletes their own note; a classmate can only react to it', async () => {
    await withClass()
    await lauraNote()
    const mineRef = note(as(LAURA), `${LAURA.uid}_1`)
    await assertSucceeds(
      updateDoc(mineRef, {
        text: 'Editada',
        x: 0.5,
        y: 0.5,
        color: 'pink',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(mineRef, { authorName: 'Otra', updatedAt: serverTimestamp() }),
    )
    await assertFails(
      updateDoc(mineRef, {
        editedByTeacher: true,
        updatedAt: serverTimestamp(),
      }),
    )
    // No reactions on my own note (D81)
    await assertFails(
      updateDoc(mineRef, new FieldPath('reactions', LAURA.uid), {
        name: 'Laura',
        emojis: ['👍'],
      }),
    )

    const sebRef = note(as(SEB), `${LAURA.uid}_1`)
    await assertFails(
      updateDoc(sebRef, { text: 'Hackeada', updatedAt: serverTimestamp() }),
    )
    await assertFails(
      updateDoc(sebRef, { x: 0.9, updatedAt: serverTimestamp() }),
    )
    await assertFails(deleteDoc(sebRef))
    await assertSucceeds(
      updateDoc(sebRef, new FieldPath('reactions', SEB.uid), {
        name: 'Seb',
        emojis: ['👍', '💡'],
      }),
    )
    // only my key, known emojis
    await assertFails(
      updateDoc(sebRef, new FieldPath('reactions', LAURA.uid), {
        name: 'Laura',
        emojis: ['👍'],
      }),
    )
    await assertFails(
      updateDoc(sebRef, new FieldPath('reactions', SEB.uid), {
        name: 'Seb',
        emojis: ['🤬'],
      }),
    )
    // remove my reaction (my key only; wiping the whole map is refused)
    await assertSucceeds(
      updateDoc(sebRef, new FieldPath('reactions', SEB.uid), deleteField()),
    )
    await assertSucceeds(
      updateDoc(sebRef, new FieldPath('reactions', SEB.uid), {
        name: 'Seb',
        emojis: ['❤️'],
      }),
    )
    // someone else reacted too: wiping the whole map would remove theirs
    await updateDoc(
      note(as(TEACHER), `${LAURA.uid}_1`),
      new FieldPath('reactions', TEACHER.uid),
      {
        name: 'Docente',
        emojis: ['🎉'],
      },
    )
    await assertFails(updateDoc(sebRef, { reactions: {} }))

    await assertSucceeds(deleteDoc(mineRef))
  })

  it('the teacher adds their own notes and edits, moves or deletes anyone’s', async () => {
    await withClass({ status: 'closed' }, { locked: true })
    await lauraNote()
    const db = as(TEACHER)
    await assertSucceeds(
      setDoc(
        note(db, `${TEACHER.uid}_1`),
        noteData(TEACHER, { authorName: 'Docente' }),
      ),
    )
    const lauras = note(db, `${LAURA.uid}_1`)
    await assertSucceeds(
      updateDoc(lauras, {
        text: 'Corregida',
        editedByTeacher: true,
        x: 0.7,
        updatedAt: serverTimestamp(),
      }),
    )
    // but never under someone else's name
    await assertFails(
      updateDoc(lauras, { authorName: 'Otro', updatedAt: serverTimestamp() }),
    )
    // restoring a board backup: the teacher writes a student's note with its reactions
    await assertSucceeds(
      setDoc(
        note(db, `${SEB.uid}_2`),
        noteData(SEB, {
          authorStudentId: 'st_seb',
          authorRole: 'student',
          reactions: { [LAURA.uid]: { name: 'Laura', emojis: ['👍'] } },
        }),
      ),
    )
    // …but the id must still be the author's
    await assertFails(
      setDoc(
        note(db, `${LAURA.uid}_9`),
        noteData(SEB, { authorRole: 'student' }),
      ),
    )
    await assertSucceeds(deleteDoc(lauras))
  })

  it('M10b: only the teacher draws the slide; members react to it with their own key while the class is open', async () => {
    await withClass()
    const drawing = {
      content: '{"elements":[]}',
      files: {},
      bytes: 15,
      title: '',
      updatedAt: serverTimestamp(),
    }
    await assertSucceeds(updateDoc(slide(as(TEACHER)), drawing))
    await assertFails(
      updateDoc(slide(as(TEACHER)), {
        content: 'x'.repeat(900_001),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(updateDoc(slide(as(LAURA)), drawing))

    const react = (user: { uid: string; email: string }, value: unknown) =>
      updateDoc(slide(as(user)), new FieldPath('reactions', user.uid), value)
    await assertSucceeds(react(LAURA, { name: 'Laura', emojis: ['🎉'] }))
    await assertSucceeds(react(SEB, { name: 'Seb', emojis: ['👍', '💡'] }))
    await assertFails(
      updateDoc(slide(as(SEB)), new FieldPath('reactions', LAURA.uid), {
        name: 'Laura',
        emojis: ['❓'],
      }),
    )
    await assertFails(react(SEB, { name: 'Seb', emojis: ['🤬'] }))
    await assertFails(
      updateDoc(slide(as(SEB)), { locked: true, updatedAt: serverTimestamp() }),
    )
    await assertFails(react(STRANGER, { name: 'X', emojis: ['👍'] }))

    // closed class: no more reactions
    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(klass(context.firestore() as unknown as Firestore), {
        status: 'closed',
      })
    })
    await assertFails(react(LAURA, { name: 'Laura', emojis: ['👍'] }))
  })

  it('M10b: the teacher registers images of class drawings in the board folder; students can not', async () => {
    await withClass()
    const asset = (overrides: Record<string, unknown> = {}) => ({
      publicId: 'pbl/dev/board1/board/a1',
      studentId: 'board',
      kind: 'class',
      width: 100,
      height: 100,
      format: 'png',
      bytes: 1000,
      status: 'active',
      createdAt: serverTimestamp(),
      ...overrides,
    })
    await assertSucceeds(
      setDoc(doc(as(TEACHER), 'boards', BOARD, 'assets', 'a1'), asset()),
    )
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'assets', 'a2'),
        asset({ publicId: 'pbl/dev/board1/board/a2' }),
      ),
    )
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'assets', 'a3'),
        asset({
          publicId: 'pbl/dev/board1/st_laura/a3',
          studentId: 'st_laura',
        }),
      ),
    )
  })

  it('closed class, locked slide or archived board: students only read', async () => {
    for (const [classOverrides, slideOverrides, boardOverrides] of [
      [{ status: 'closed' }, {}, {}],
      [{}, { locked: true }, {}],
      [{}, {}, { status: 'archived' }],
    ] as Record<string, unknown>[][]) {
      await env.clearFirestore()
      await withClass(classOverrides, slideOverrides)
      if (Object.keys(boardOverrides).length)
        await env.withSecurityRulesDisabled(async (context) => {
          await updateDoc(
            doc(context.firestore() as unknown as Firestore, 'boards', BOARD),
            boardOverrides,
          )
        })
      await lauraNote()
      await assertSucceeds(getDoc(note(as(LAURA), `${LAURA.uid}_1`)))
      await assertFails(
        setDoc(note(as(LAURA), `${LAURA.uid}_2`), noteData(LAURA)),
      )
      await assertFails(
        updateDoc(note(as(LAURA), `${LAURA.uid}_1`), {
          text: 'Tarde',
          updatedAt: serverTimestamp(),
        }),
      )
      await assertFails(deleteDoc(note(as(LAURA), `${LAURA.uid}_1`)))
      await assertFails(
        updateDoc(
          note(as(SEB), `${LAURA.uid}_1`),
          new FieldPath('reactions', SEB.uid),
          { name: 'Seb', emojis: ['👍'] },
        ),
      )
    }
  })
})

describe('achievements (M22)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const mine = (db: Firestore, uid: string) =>
    doc(db, 'boards', BOARD, 'achievements', uid)
  const counts = (db: Firestore) =>
    doc(db, 'boards', BOARD, 'achievementStats', 'counts')

  /** What the app writes: my key (server time) + 1 on its counter, in one batch */
  function unlock(
    user: { uid: string; email: string },
    studentId: string,
    key: string,
    options: { first?: boolean; skipCount?: boolean; countBy?: number } = {},
  ) {
    const db = as(user)
    const batch = writeBatch(db)
    batch.set(
      mine(db, user.uid),
      {
        studentId,
        unlocked: { [key]: serverTimestamp() },
        ...(options.first && { classes: [] }),
        lastKey: key,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    if (!options.skipCount)
      batch.set(
        counts(db),
        { [key]: increment(options.countBy ?? 1), lastKey: key },
        { merge: true },
      )
    return batch.commit()
  }

  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('a student unlocks one achievement at a time, always counted once', async () => {
    await joined()
    await assertSucceeds(
      unlock(LAURA, 'st_laura', 'firstSlide', { first: true }),
    )
    await assertSucceeds(unlock(LAURA, 'st_laura', 'ready'))
    await assertSucceeds(unlock(SEB, 'st_seb', 'firstSlide', { first: true }))
    const after = (await getDoc(counts(as(LAURA)))).data()
    if (after?.firstSlide !== 2 || after?.ready !== 1)
      throw new Error(`counts: ${JSON.stringify(after)}`)

    // twice, without counting, counting twice, an unknown key, someone else's doc
    await assertFails(unlock(LAURA, 'st_laura', 'firstSlide'))
    await assertFails(unlock(LAURA, 'st_laura', 'photo', { skipCount: true }))
    await assertFails(unlock(LAURA, 'st_laura', 'photo', { countBy: 2 }))
    await assertFails(unlock(LAURA, 'st_laura', 'points'))
    await assertFails(unlock(LAURA, 'st_seb', 'photo'))
    // a counter can't go up without unlocking
    await assertFails(
      setDoc(
        counts(as(LAURA)),
        { photo: increment(1), lastKey: 'photo' },
        { merge: true },
      ),
    )
    // the classes list may change alone
    await assertSucceeds(
      updateDoc(mine(as(LAURA), LAURA.uid), {
        classes: ['c1'],
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('a student reads only their own; everyone reads the counts; the teacher reads all and fixes counts', async () => {
    await joined()
    await unlock(LAURA, 'st_laura', 'firstSlide', { first: true })
    await assertSucceeds(getDoc(mine(as(LAURA), LAURA.uid)))
    await assertFails(getDoc(mine(as(SEB), LAURA.uid)))
    await assertFails(
      getDocs(collection(as(SEB), 'boards', BOARD, 'achievements')),
    )
    await assertSucceeds(getDoc(counts(as(SEB))))
    await assertFails(getDoc(counts(as(STRANGER))))

    const teacher = as(TEACHER)
    await assertSucceeds(
      getDocs(collection(teacher, 'boards', BOARD, 'achievements')),
    )
    await assertSucceeds(
      updateDoc(counts(teacher), { firstSlide: increment(-1) }),
    )
    await assertSucceeds(deleteDoc(mine(teacher, LAURA.uid)))
    await assertFails(deleteDoc(mine(as(SEB), SEB.uid)))
  })
})

describe('recorded classes (M23)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const playlist = (db: Firestore, id = 'r1') =>
    doc(db, 'boards', BOARD, 'recordings', id)
  const progress = (db: Firestore, uid: string) =>
    doc(db, 'boards', BOARD, 'watchProgress', uid)
  const recording = (overrides: Record<string, unknown> = {}) => ({
    title: 'Grabaciones',
    listId: 'PLO2HxDUbp3FU',
    position: 0,
    videos: [
      {
        id: 'VB-lKjtbZk8',
        title: '23 Octubre',
        seconds: 13693,
        playable: true,
      },
    ],
    titles: {},
    hidden: [],
    syncedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const watched = (studentId: string, at = 120) => ({
    studentId,
    videos: { 'VB-lKjtbZk8': { at, seconds: 13693, watched: false } },
    updatedAt: serverTimestamp(),
  })

  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the board teacher links, re-reads, edits and deletes playlists; members only read them', async () => {
    await joined()
    const teacher = as(TEACHER)
    await assertSucceeds(setDoc(playlist(teacher), recording()))
    await assertSucceeds(
      updateDoc(playlist(teacher), {
        titles: { 'VB-lKjtbZk8': 'Clase 7' },
        hidden: ['VB-lKjtbZk8'],
        syncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    // a bad link, unknown fields, another teacher
    await assertFails(
      setDoc(playlist(teacher, 'r2'), recording({ listId: 'a b' })),
    )
    await assertFails(
      setDoc(playlist(teacher, 'r2'), recording({ secret: true })),
    )
    await assertFails(setDoc(playlist(as(OTHER_TEACHER), 'r2'), recording()))

    await assertSucceeds(getDoc(playlist(as(LAURA))))
    await assertSucceeds(
      getDocs(collection(as(SEB), 'boards', BOARD, 'recordings')),
    )
    await assertFails(getDoc(playlist(as(STRANGER))))
    await assertFails(
      updateDoc(playlist(as(LAURA)), {
        videos: [],
        syncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(deleteDoc(playlist(as(LAURA))))
    await assertSucceeds(deleteDoc(playlist(teacher)))
  })

  it("each student saves only their own progress; the teacher reads everybody's and removes it", async () => {
    await joined()
    await assertSucceeds(
      setDoc(progress(as(LAURA), LAURA.uid), watched('st_laura')),
    )
    await assertSucceeds(
      setDoc(progress(as(LAURA), LAURA.uid), watched('st_laura', 600), {
        merge: true,
      }),
    )
    // someone else's progress, a different card, extra fields
    await assertFails(setDoc(progress(as(SEB), LAURA.uid), watched('st_seb')))
    await assertFails(setDoc(progress(as(SEB), SEB.uid), watched('st_laura')))
    await assertFails(
      setDoc(progress(as(SEB), SEB.uid), { ...watched('st_seb'), points: 1 }),
    )
    await assertFails(
      setDoc(progress(as(STRANGER), STRANGER.uid), watched('st_laura')),
    )

    await assertSucceeds(getDoc(progress(as(LAURA), LAURA.uid)))
    await assertFails(getDoc(progress(as(SEB), LAURA.uid)))
    await assertFails(
      getDocs(collection(as(SEB), 'boards', BOARD, 'watchProgress')),
    )
    const teacher = as(TEACHER)
    await assertSucceeds(
      getDocs(collection(teacher, 'boards', BOARD, 'watchProgress')),
    )
    await assertSucceeds(deleteDoc(progress(teacher, LAURA.uid)))
  })
})

describe('course setup, news and emails (M24)', () => {
  const course = (overrides: Record<string, unknown> = {}) => ({
    v: 1,
    start: '2026-11-03',
    end: '2026-11-28',
    weeks: null,
    schedule: [{ day: 2, start: '18:00', end: '21:00', place: 'Salón 304' }],
    holidayCountry: 'CO',
    holidays: [{ date: '2026-11-16', name: 'Independencia de Cartagena' }],
    daysOff: [],
    extras: [],
    total: null,
    correction: 0,
    topics: { '1': 'Empatía' },
    showCounter: true,
    held: null,
    ...overrides,
  })
  const newsItem = (db: Firestore, id = 'n1') =>
    doc(db, 'boards', BOARD, 'news', id)
  const news = (overrides: Record<string, unknown> = {}) => ({
    date: '2026-11-10',
    wholeWeek: false,
    kind: 'deliverable',
    title: 'Entrega del prototipo',
    text: '',
    link: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })
  const log = (overrides: Record<string, unknown> = {}) => ({
    kind: 'message',
    subject: 'Recordatorio',
    sentBy: TEACHER.email,
    sent: [LAURA.email],
    failed: [],
    createdAt: serverTimestamp(),
    ...overrides,
  })

  it('the teacher saves the course setup and the email sender on the board; bad shapes fail', async () => {
    await seed()
    const teacher = as(TEACHER)
    const ref = doc(teacher, 'boards', BOARD)
    await assertSucceeds(
      updateDoc(ref, {
        course: course(),
        emailSender: { name: 'Diplomado UX/UI', replyTo: 'docente@uni.edu.co' },
        updatedAt: serverTimestamp(),
      }),
    )
    // only a total, nothing else
    await assertSucceeds(
      updateDoc(ref, {
        course: course({ start: null, end: null, schedule: [], total: 4 }),
      }),
    )
    await assertSucceeds(updateDoc(ref, { course: null }))
    for (const bad of [
      course({ v: 2 }),
      course({ start: '2026-11-30', end: '2026-11-01' }),
      course({ start: '3 nov' }),
      course({ total: 0 }),
      course({ weeks: 500 }),
      course({
        schedule: Array(8).fill({ day: 1, start: '', end: '', place: '' }),
      }),
      course({ holidayCountry: 'XX' }),
      course({ secret: true }),
    ])
      await assertFails(updateDoc(ref, { course: bad }))
    await assertFails(
      updateDoc(ref, { emailSender: { name: 'x', replyTo: 'y', bcc: 'z' } }),
    )
    // a member can't change it
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await assertFails(
      updateDoc(doc(as(LAURA), 'boards', BOARD), { course: course() }),
    )
  })

  it('news: the teacher writes, members read; the email log is the teacher’s only and never edited', async () => {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    const teacher = as(TEACHER)
    await assertSucceeds(setDoc(newsItem(teacher), news()))
    await assertSucceeds(
      updateDoc(newsItem(teacher), {
        title: 'Entrega final',
        link: 'https://example.com/brief',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(setDoc(newsItem(teacher, 'n2'), news({ kind: 'party' })))
    await assertFails(
      setDoc(newsItem(teacher, 'n2'), news({ link: 'javascript:alert(1)' })),
    )
    await assertFails(setDoc(newsItem(as(OTHER_TEACHER), 'n2'), news()))
    await assertSucceeds(getDoc(newsItem(as(LAURA))))
    await assertFails(getDoc(newsItem(as(STRANGER))))
    await assertFails(setDoc(newsItem(as(LAURA), 'n3'), news()))
    await assertFails(deleteDoc(newsItem(as(LAURA))))
    await assertSucceeds(deleteDoc(newsItem(teacher)))

    const sent = doc(teacher, 'boards', BOARD, 'emails', 'e1')
    await assertSucceeds(setDoc(sent, log()))
    await assertFails(
      setDoc(
        doc(teacher, 'boards', BOARD, 'emails', 'e2'),
        log({ sentBy: 'someone@else.com' }),
      ),
    )
    await assertFails(updateDoc(sent, { subject: 'Otro' }))
    await assertSucceeds(
      getDocs(collection(teacher, 'boards', BOARD, 'emails')),
    )
    await assertFails(getDoc(doc(as(LAURA), 'boards', BOARD, 'emails', 'e1')))
    await assertFails(
      setDoc(
        doc(as(LAURA), 'boards', BOARD, 'emails', 'e3'),
        log({ sentBy: LAURA.email }),
      ),
    )
  })
})

describe('Mensajes (M26)', () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const conversation = (db: Firestore, studentId = 'st_laura') =>
    doc(db, 'boards', BOARD, 'conversations', studentId)
  const message = (db: Firestore, id: string, studentId = 'st_laura') =>
    doc(db, 'boards', BOARD, 'conversations', studentId, 'messages', id)

  /** Sends like the app: the message and its conversation in one batch */
  function send(
    db: Firestore,
    {
      id,
      from,
      uid,
      text = 'Hola profe, ¿la entrega es el viernes?',
      exists,
      studentId = 'st_laura',
      overrides = {},
      conversationOverrides = {},
    }: {
      id: string
      from: 'student' | 'teacher'
      uid: string
      text?: string
      exists: boolean
      studentId?: string
      overrides?: Record<string, unknown>
      conversationOverrides?: Record<string, unknown>
    },
  ) {
    const batch = writeBatch(db)
    batch.set(message(db, id, studentId), {
      from,
      authorUid: uid,
      authorName: from === 'teacher' ? 'Profe' : 'Laura',
      text,
      createdAt: serverTimestamp(),
      ...overrides,
    })
    const last = {
      lastMessageAt: serverTimestamp(),
      lastMessageId: id,
      lastFrom: from,
      lastText: text.slice(0, 120),
      [from === 'student' ? 'studentReadAt' : 'teacherReadAt']:
        serverTimestamp(),
      ...conversationOverrides,
    }
    if (exists) batch.update(conversation(db, studentId), last)
    else
      batch.set(conversation(db, studentId), {
        studentId,
        createdAt: serverTimestamp(),
        ...last,
      })
    return batch.commit()
  }

  const pause = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

  async function joined() {
    await seed()
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  /** Laura's conversation with one message, written straight to the database */
  async function seeded() {
    await joined()
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      const old = Timestamp.fromDate(new Date(Date.now() - 60_000))
      await setDoc(message(db, 'm1'), {
        from: 'student',
        authorUid: LAURA.uid,
        authorName: 'Laura',
        text: 'Primera',
        createdAt: old,
      })
      await setDoc(conversation(db), {
        studentId: 'st_laura',
        createdAt: old,
        lastMessageAt: old,
        lastMessageId: 'm1',
        lastFrom: 'student',
        lastText: 'Primera',
        studentReadAt: old,
      })
    })
  }

  it('a student starts a conversation and the teacher answers; each marks it read', async () => {
    await joined()
    const laura = as(LAURA)
    const teacher = as(TEACHER)
    await assertSucceeds(
      send(laura, { id: 'm1', from: 'student', uid: LAURA.uid, exists: false }),
    )
    await assertSucceeds(getDoc(conversation(laura)))
    await assertSucceeds(
      getDocs(
        collection(
          laura,
          'boards',
          BOARD,
          'conversations',
          'st_laura',
          'messages',
        ),
      ),
    )
    await assertSucceeds(
      getDocs(collection(teacher, 'boards', BOARD, 'conversations')),
    )
    await assertSucceeds(
      updateDoc(conversation(teacher), { teacherReadAt: serverTimestamp() }),
    )
    await pause(2100)
    await assertSucceeds(
      send(teacher, {
        id: 'm2',
        from: 'teacher',
        uid: TEACHER.uid,
        text: 'Sí, el viernes: https://forms.gle/abc',
        exists: true,
      }),
    )
    await assertSucceeds(
      updateDoc(conversation(laura), { studentReadAt: serverTimestamp() }),
    )
    // the teacher can also start one with another student
    await assertSucceeds(
      send(teacher, {
        id: 'm3',
        from: 'teacher',
        uid: TEACHER.uid,
        studentId: 'st_seb',
        exists: false,
      }),
    )
  })

  it('classmates and strangers never read or write someone else’s conversation', async () => {
    await seeded()
    const seb = as(SEB)
    await assertFails(getDoc(conversation(seb)))
    await assertFails(getDoc(message(seb, 'm1')))
    await assertFails(
      getDocs(
        collection(
          seb,
          'boards',
          BOARD,
          'conversations',
          'st_laura',
          'messages',
        ),
      ),
    )
    await assertFails(
      getDocs(collection(seb, 'boards', BOARD, 'conversations')),
    )
    // students can't list the board's conversations, not even to find their own
    await assertFails(
      getDocs(collection(as(LAURA), 'boards', BOARD, 'conversations')),
    )
    await assertFails(getDoc(conversation(as(STRANGER))))
    await assertFails(getDoc(conversation(as(OTHER_TEACHER))))
    // Seb writing into Laura's conversation, as himself or as her
    await assertFails(
      send(seb, { id: 'x1', from: 'student', uid: SEB.uid, exists: true }),
    )
    await assertFails(
      send(seb, { id: 'x2', from: 'student', uid: LAURA.uid, exists: true }),
    )
  })

  it('a student writes only as themselves, with a real message, and not faster than every 2 s', async () => {
    await seeded()
    const laura = as(LAURA)
    // posing as the teacher, someone else's uid, too long, an extra field
    await assertFails(
      send(laura, { id: 'x1', from: 'teacher', uid: LAURA.uid, exists: true }),
    )
    await assertFails(
      send(laura, { id: 'x2', from: 'student', uid: SEB.uid, exists: true }),
    )
    await assertFails(
      send(laura, {
        id: 'x3',
        from: 'student',
        uid: LAURA.uid,
        text: 'x'.repeat(1001),
        exists: true,
      }),
    )
    await assertFails(
      send(laura, {
        id: 'x4',
        from: 'student',
        uid: LAURA.uid,
        exists: true,
        overrides: { restored: true },
      }),
    )
    // the preview changed without a new message
    await assertFails(
      updateDoc(conversation(laura), {
        lastText: 'Otra cosa',
        lastMessageAt: serverTimestamp(),
        studentReadAt: serverTimestamp(),
      }),
    )
    // a message without moving the conversation to it
    await assertFails(
      setDoc(message(laura, 'x5'), {
        from: 'student',
        authorUid: LAURA.uid,
        authorName: 'Laura',
        text: 'Sola',
        createdAt: serverTimestamp(),
      }),
    )
    // touching the teacher's read time
    await assertFails(
      updateDoc(conversation(laura), { teacherReadAt: serverTimestamp() }),
    )

    await assertSucceeds(
      send(laura, { id: 'm2', from: 'student', uid: LAURA.uid, exists: true }),
    )
    // right away again: too soon
    await assertFails(
      send(laura, { id: 'm3', from: 'student', uid: LAURA.uid, exists: true }),
    )
    await pause(2100)
    await assertSucceeds(
      send(laura, { id: 'm3', from: 'student', uid: LAURA.uid, exists: true }),
    )
  })

  it('nobody edits a message; only the teacher deletes messages and conversations (D116)', async () => {
    await seeded()
    const laura = as(LAURA)
    const teacher = as(TEACHER)
    await assertFails(updateDoc(message(laura, 'm1'), { text: 'Editado' }))
    await assertFails(updateDoc(message(teacher, 'm1'), { text: 'Editado' }))
    await assertFails(deleteDoc(message(laura, 'm1')))
    await assertFails(deleteDoc(conversation(laura)))

    // The teacher deletes the newest message and moves the preview back to the previous one
    await pause(2100)
    await assertSucceeds(
      send(laura, {
        id: 'm2',
        from: 'student',
        uid: LAURA.uid,
        text: 'Algo grosero',
        exists: true,
      }),
    )
    let previous: { createdAt: unknown } | undefined
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore
      previous = (await getDoc(message(db, 'm1'))).data() as {
        createdAt: unknown
      }
    })
    const batch = writeBatch(teacher)
    batch.delete(message(teacher, 'm2'))
    batch.update(conversation(teacher), {
      lastMessageAt: previous!.createdAt,
      lastMessageId: 'm1',
      lastFrom: 'student',
      lastText: 'Primera',
    })
    await assertSucceeds(batch.commit())
    // the preview can't point at a message that doesn't exist
    await assertFails(updateDoc(conversation(teacher), { lastMessageId: 'm2' }))
    // "Marcar como no leído"
    await assertSucceeds(
      updateDoc(conversation(teacher), { teacherReadAt: null }),
    )
    // a teacher of another course can't delete
    await assertFails(deleteDoc(message(as(OTHER_TEACHER), 'm1')))
    await assertSucceeds(deleteDoc(message(teacher, 'm1')))
    await assertSucceeds(deleteDoc(conversation(teacher)))
  })

  it('a restored backup: the teacher writes old messages back, marked restored; students can’t', async () => {
    await joined()
    const old = Timestamp.fromDate(new Date(2026, 9, 1))
    const restored = {
      from: 'student',
      authorUid: 'old-uid',
      authorName: 'Laura',
      text: 'Del curso anterior',
      createdAt: old,
      restored: true,
    }
    await assertFails(setDoc(message(as(LAURA), 'r1'), restored))
    const teacher = as(TEACHER)
    const batch = writeBatch(teacher)
    batch.set(message(teacher, 'r1'), restored)
    batch.set(conversation(teacher), {
      studentId: 'st_laura',
      createdAt: serverTimestamp(),
      lastMessageAt: old,
      lastMessageId: 'r1',
      lastFrom: 'student',
      lastText: 'Del curso anterior',
    })
    await assertSucceeds(batch.commit())
    // a restored message can't claim to be new
    await assertFails(
      setDoc(message(teacher, 'r2'), { ...restored, restored: false }),
    )
  })

  it('an archived course is read-only: messages can be read, not sent', async () => {
    await seeded()
    await updateDoc(doc(as(TEACHER), 'boards', BOARD), {
      status: 'archived',
      archivedAt: serverTimestamp(),
    })
    const laura = as(LAURA)
    await assertSucceeds(getDoc(message(laura, 'm1')))
    await assertFails(
      send(laura, { id: 'm2', from: 'student', uid: LAURA.uid, exists: true }),
    )
    await assertFails(
      send(as(TEACHER), {
        id: 'm3',
        from: 'teacher',
        uid: TEACHER.uid,
        exists: true,
      }),
    )
  })
})

describe("the teacher's feedback on a project (M27)", () => {
  const SEB = { uid: 'seb', email: 'seb@gmail.com' }
  const spaceRef = (db: Firestore) =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura')
  const notesOf = (db: Firestore) =>
    collection(db, 'boards', BOARD, 'spaces', 'st_laura', 'notes')
  const noteRef = (db: Firestore, noteId: string) => doc(notesOf(db), noteId)
  const slideRef = (db: Firestore, slideId = 's1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', slideId)
  const deletedRef = (db: Firestore, slideId = 's1') =>
    doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'deletedSlides', slideId)
  const slide = {
    engine: 'excalidraw',
    content: '{"elements":[]}',
    files: {},
    assetIds: [],
    bytes: 15,
    schemaVersion: 1,
  }
  const comment = (overrides: Record<string, unknown> = {}) => ({
    slideId: null,
    text: 'Tu proyecto va bien; falta el prototipo.',
    visibility: 'private',
    authorEmail: TEACHER.email,
    authorName: 'Profe',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  })

  /** Laura joined with slides s1, s2; Seb (a classmate) joined; notes: private, public, old (no visibility) */
  async function seeded(boardOverrides: Record<string, unknown> = {}) {
    await seed({ boardOverrides })
    await autoJoin(as(LAURA), LAURA, 'st_laura')
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      for (const id of ['s1', 's2'])
        await setDoc(
          doc(db, 'boards', BOARD, 'spaces', 'st_laura', 'slides', id),
          { ...slide, updatedAt: serverTimestamp() },
        )
      await updateDoc(doc(db, 'boards', BOARD, 'spaces', 'st_laura'), {
        title: 'Huerta urbana',
        slideOrder: ['s1', 's2'],
        slideCount: 2,
      })
      await setDoc(
        doc(db, 'boards', BOARD, 'students', 'st_seb'),
        student([SEB.email]),
      )
      await setDoc(doc(db, 'boards', BOARD, 'studentEmails', SEB.email), {
        email: SEB.email,
        studentId: 'st_seb',
      })
      const notes = collection(
        db,
        'boards',
        BOARD,
        'spaces',
        'st_laura',
        'notes',
      )
      await setDoc(doc(notes, 'private'), comment())
      await setDoc(doc(notes, 'public'), comment({ visibility: 'public' }))
      const { visibility: _old, ...old } = comment({ slideId: 's1' })
      void _old
      await setDoc(doc(notes, 'old'), old)
    })
    await autoJoin(as(SEB), SEB, 'st_seb')
  }

  it('the teacher comments on the whole project, private or public, and switches it later', async () => {
    await seeded()
    const db = as(TEACHER)
    await assertSucceeds(setDoc(noteRef(db, 'c1'), comment()))
    await assertSucceeds(
      setDoc(noteRef(db, 'c2'), comment({ visibility: 'public' })),
    )
    await assertSucceeds(
      setDoc(
        noteRef(db, 'c3'),
        comment({ slideId: 's2', visibility: 'public' }),
      ),
    )
    // a visibility is required and must be one of the two
    const { visibility: _v, ...noVisibility } = comment()
    void _v
    await assertFails(setDoc(noteRef(db, 'c4'), noVisibility))
    await assertFails(
      setDoc(noteRef(db, 'c4'), comment({ visibility: 'everyone' })),
    )
    await assertSucceeds(
      updateDoc(noteRef(db, 'c1'), {
        visibility: 'public',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(noteRef(db, 'c1'), {
        visibility: 'world',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      setDoc(
        noteRef(as(OTHER_TEACHER), 'c5'),
        comment({ authorEmail: OTHER_TEACHER.email }),
      ),
    )
  })

  it('classmates read public comments only; private and older notes never reach them', async () => {
    await seeded()
    const seb = as(SEB)
    await assertSucceeds(
      getDocs(query(notesOf(seb), where('visibility', '==', 'public'))),
    )
    await assertSucceeds(getDoc(noteRef(seb, 'public')))
    await assertFails(getDocs(notesOf(seb)))
    await assertFails(getDoc(noteRef(seb, 'private')))
    await assertFails(getDoc(noteRef(seb, 'old')))
    await assertFails(
      getDocs(
        query(notesOf(as(STRANGER)), where('visibility', '==', 'public')),
      ),
    )
    // the owner reads everything
    await assertSucceeds(getDocs(notesOf(as(LAURA))))
  })

  it('students never write or re-label comments; the owner never deletes a project comment', async () => {
    await seeded()
    const laura = as(LAURA)
    await assertFails(
      setDoc(noteRef(laura, 'c9'), comment({ authorEmail: LAURA.email })),
    )
    await assertFails(
      updateDoc(noteRef(laura, 'private'), {
        visibility: 'public',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(deleteDoc(noteRef(laura, 'private')))
    await assertFails(deleteDoc(noteRef(as(SEB), 'public')))
  })

  it('the teacher edits the project details, signed, keeping the student version', async () => {
    await seeded()
    const db = as(TEACHER)
    const previousVersion = {
      title: 'Huerta urbana',
      summary: '',
      color: '#FFFFFF',
      cover: null,
      by: 'student',
    }
    await assertFails(
      updateDoc(spaceRef(db), {
        title: 'Huerta urbana comunitaria',
        updatedAt: serverTimestamp(),
      }),
    )
    await assertSucceeds(
      updateDoc(spaceRef(db), {
        title: 'Huerta urbana comunitaria',
        summary: 'Un huerto en la azotea del colegio.',
        previousVersion,
        teacherEditedAt: serverTimestamp(),
        teacherEditsUnseen: true,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(spaceRef(db), {
        previousVersion: { ...previousVersion, by: 'someone' },
        teacherEditedAt: serverTimestamp(),
      }),
    )
    // not the student's own profile extras
    await assertFails(
      updateDoc(spaceRef(db), {
        ownerDecor: { banner: 'stars' },
        teacherEditedAt: serverTimestamp(),
      }),
    )
    // only the board's teacher, only on a writable board
    await assertFails(
      updateDoc(spaceRef(as(OTHER_TEACHER)), {
        title: 'X',
        teacherEditedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(spaceRef(as(SEB)), {
        title: 'X',
        updatedAt: serverTimestamp(),
      }),
    )
    // the student restores theirs (the teacher's goes into previousVersion)
    await assertSucceeds(
      updateDoc(spaceRef(as(LAURA)), {
        title: 'Huerta urbana',
        summary: '',
        previousVersion: {
          ...previousVersion,
          title: 'Huerta urbana comunitaria',
          summary: 'Un huerto en la azotea del colegio.',
          by: 'teacher',
        },
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('nobody but the student edits on a locked board', async () => {
    await seeded({ status: 'locked' })
    await assertFails(
      updateDoc(spaceRef(as(TEACHER)), {
        title: 'X',
        teacherEditedAt: serverTimestamp(),
      }),
    )
  })

  it('the teacher deletes a slide only keeping a copy; the student restores it', async () => {
    await seeded()
    const db = as(TEACHER)
    const copy = {
      content: '{"elements":[]}',
      files: {},
      assetIds: [],
      bytes: 15,
      position: 0,
      deletedAt: serverTimestamp(),
      deletedByName: 'Profe',
    }
    // without the copy: refused
    const bare = writeBatch(db)
    bare.delete(slideRef(db))
    bare.update(spaceRef(db), {
      slideOrder: ['s2'],
      slideCount: 1,
      teacherEditsUnseen: true,
    })
    await assertFails(bare.commit())
    // the copy can't be written while the slide is still there
    await assertFails(setDoc(deletedRef(db), copy))
    const batch = writeBatch(db)
    batch.delete(slideRef(db))
    batch.set(deletedRef(db), copy)
    batch.update(spaceRef(db), {
      slideOrder: ['s2'],
      slideCount: 1,
      studentSlideOrder: ['s1', 's2'],
      teacherEditsUnseen: true,
    })
    await assertSucceeds(batch.commit())
    // classmates don't see it; the student does
    await assertFails(getDoc(deletedRef(as(SEB))))
    await assertSucceeds(getDoc(deletedRef(as(LAURA))))
    await assertFails(setDoc(deletedRef(as(LAURA), 's2'), copy))
    // the student restores it where it was
    const laura = as(LAURA)
    const restore = writeBatch(laura)
    restore.set(slideRef(laura), { ...slide, updatedAt: serverTimestamp() })
    restore.delete(deletedRef(laura))
    restore.update(spaceRef(laura), {
      slideOrder: ['s1', 's2'],
      slideCount: 2,
      studentSlideOrder: null,
      updatedAt: serverTimestamp(),
    })
    await assertSucceeds(restore.commit())
  })

  it('En progreso / Listo: signed by whoever sets it, consistent with the ready flag', async () => {
    await seeded()
    const laura = as(LAURA)
    await assertSucceeds(
      updateDoc(spaceRef(laura), {
        workStatus: 'wip',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'student',
        readyToPresent: false,
        updatedAt: serverTimestamp(),
      }),
    )
    // "Listo" must also set the M16 flag every list reads
    await assertFails(
      updateDoc(spaceRef(laura), {
        workStatus: 'ready',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'student',
        readyToPresent: false,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(spaceRef(laura), {
        workStatus: 'ready',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'teacher',
        readyToPresent: true,
        updatedAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(spaceRef(laura), {
        workStatus: 'done',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'student',
        updatedAt: serverTimestamp(),
      }),
    )
    // the teacher sets it too, signed as the teacher
    await assertSucceeds(
      updateDoc(spaceRef(as(TEACHER)), {
        workStatus: 'ready',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'teacher',
        readyToPresent: true,
        readyAt: serverTimestamp(),
      }),
    )
    await assertFails(
      updateDoc(spaceRef(as(SEB)), {
        workStatus: 'wip',
        workStatusAt: serverTimestamp(),
        workStatusBy: 'student',
        readyToPresent: false,
        updatedAt: serverTimestamp(),
      }),
    )
  })

  it('the teacher registers a new cover image in the student folder; a classmate cannot', async () => {
    await seeded()
    const asset = (overrides: Record<string, unknown> = {}) => ({
      publicId: `pbl/dev/${BOARD}/st_laura/cov1`,
      studentId: 'st_laura',
      kind: 'cover',
      width: 800,
      height: 450,
      format: 'webp',
      bytes: 1000,
      status: 'active',
      createdAt: serverTimestamp(),
      ...overrides,
    })
    await assertSucceeds(
      setDoc(doc(as(TEACHER), 'boards', BOARD, 'assets', 'cov1'), asset()),
    )
    await assertFails(
      setDoc(
        doc(as(SEB), 'boards', BOARD, 'assets', 'cov2'),
        asset({
          publicId: `pbl/dev/${BOARD}/st_laura/cov2`,
        }),
      ),
    )
  })

  it('"Comentario nuevo": the teacher lights it, only the student clears it', async () => {
    await seeded()
    await assertSucceeds(
      updateDoc(spaceRef(as(TEACHER)), { teacherCommentsUnseen: true }),
    )
    await assertFails(
      updateDoc(spaceRef(as(TEACHER)), { teacherCommentsUnseen: false }),
    )
    await assertSucceeds(
      updateDoc(spaceRef(as(LAURA)), {
        teacherCommentsUnseen: false,
        teacherEditsUnseen: false,
      }),
    )
  })
})
