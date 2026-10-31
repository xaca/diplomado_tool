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

  it('the teacher appends a slide but cannot reorder or delete', async () => {
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
    await assertFails(
      updateDoc(spaceRef(db), {
        slideOrder: ['s2', 's1'],
        slideCount: 2,
        teacherEditsUnseen: true,
      }),
    )
    // (deleting stays possible for the teacher: removing a student deletes their slides; the editor never offers it)
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

  it('the student marks their slides ready; classmates and the teacher cannot', async () => {
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
