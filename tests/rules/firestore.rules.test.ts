import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

// Runs against the Firestore emulator: `npm run test:rules`

const TEACHER = { uid: 'teacher', email: 'paradisserossa@gmail.com' }
const STUDENT = { uid: 'student', email: 'laura@gmail.com' }

let env: RulesTestEnvironment

function as(user: { uid: string; email: string }, emailVerified = true) {
  return env
    .authenticatedContext(user.uid, {
      email: user.email,
      email_verified: emailVerified,
    })
    .firestore()
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
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'staffEmails', TEACHER.email), {
      email: TEACHER.email,
      role: 'admin',
      displayName: 'Teacher',
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('users/{uid}', () => {
  const profile = (email: string) => ({
    displayName: 'Laura',
    email,
    photoURL: null,
    locale: 'es',
  })

  it('a user can create and read their own profile', async () => {
    const db = as(STUDENT)
    await assertSucceeds(
      setDoc(doc(db, 'users', STUDENT.uid), profile(STUDENT.email)),
    )
    await assertSucceeds(getDoc(doc(db, 'users', STUDENT.uid)))
  })

  it("can't write someone else's profile", async () => {
    await assertFails(
      setDoc(doc(as(STUDENT), 'users', TEACHER.uid), profile(STUDENT.email)),
    )
  })

  it("can't store a different email or unknown fields", async () => {
    const db = as(STUDENT)
    await assertFails(
      setDoc(doc(db, 'users', STUDENT.uid), profile('other@gmail.com')),
    )
    await assertFails(
      setDoc(doc(db, 'users', STUDENT.uid), {
        ...profile(STUDENT.email),
        role: 'admin',
      }),
    )
  })

  it('only es / en are valid languages', async () => {
    await assertFails(
      setDoc(doc(as(STUDENT), 'users', STUDENT.uid), {
        ...profile(STUDENT.email),
        locale: 'fr',
      }),
    )
  })

  it('profile name and photo are bounded; the photo must be https (M8 review)', async () => {
    const ref = doc(as(STUDENT), 'users', STUDENT.uid)
    await assertFails(
      setDoc(ref, { ...profile(STUDENT.email), displayName: 'x'.repeat(201) }),
    )
    await assertFails(
      setDoc(ref, { ...profile(STUDENT.email), photoURL: 'data:image/png,xx' }),
    )
    await assertSucceeds(
      setDoc(ref, {
        ...profile(STUDENT.email),
        photoURL: 'https://lh3.googleusercontent.com/a/x',
      }),
    )
  })

  it('the profile page sets a bounded name (or null → Google name) and the photo switch', async () => {
    const ref = doc(as(STUDENT), 'users', STUDENT.uid)
    await assertSucceeds(setDoc(ref, profile(STUDENT.email)))
    await assertSucceeds(
      setDoc(ref, { profileName: 'Lau', showPhoto: false }, { merge: true }),
    )
    await assertSucceeds(setDoc(ref, { profileName: null }, { merge: true }))
    await assertFails(setDoc(ref, { profileName: '' }, { merge: true }))
    await assertFails(
      setDoc(ref, { profileName: 'x'.repeat(121) }, { merge: true }),
    )
    await assertFails(setDoc(ref, { showPhoto: 'no' }, { merge: true }))
  })

  it('signed-out visitors read nothing', async () => {
    await assertFails(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), 'users', STUDENT.uid),
      ),
    )
  })
})

describe('staffEmails/{email} — teacher detection', () => {
  it('the teacher reads their own entry (→ teacher role)', async () => {
    await assertSucceeds(getDoc(doc(as(TEACHER), 'staffEmails', TEACHER.email)))
  })

  it('a student reading their own (nonexistent) entry is allowed (→ "not a teacher", no error)', async () => {
    await assertSucceeds(getDoc(doc(as(STUDENT), 'staffEmails', STUDENT.email)))
  })

  it("a student can't read the teacher's entry", async () => {
    await assertFails(getDoc(doc(as(STUDENT), 'staffEmails', TEACHER.email)))
  })

  it('nobody can make themselves a teacher from the browser (not even an admin)', async () => {
    await assertFails(
      setDoc(doc(as(STUDENT), 'staffEmails', STUDENT.email), { role: 'admin' }),
    )
    await assertFails(
      setDoc(doc(as(TEACHER), 'staffEmails', 'new@gmail.com'), {
        role: 'teacher',
      }),
    )
  })

  it('unverified emails are not trusted', async () => {
    await assertFails(
      getDoc(doc(as(TEACHER, false), 'staffEmails', TEACHER.email)),
    )
  })
})

describe('everything else is denied by default', () => {
  it('unknown collections', async () => {
    await assertFails(setDoc(doc(as(TEACHER), 'boards', 'b1'), { title: 'x' }))
    await assertFails(getDoc(doc(as(STUDENT), 'anything', 'x')))
  })
})
