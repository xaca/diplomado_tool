import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  COLLECTIONS,
  normalizeEmail,
  type StaffRole,
} from '../../src/lib/collections.ts'
import { db } from './firebase.ts'

const emailSchema = z.email()

function staffDoc(email: string) {
  return db.collection(COLLECTIONS.staffEmails).doc(email)
}

function parseEmail(raw: string) {
  const email = normalizeEmail(raw)
  const result = emailSchema.safeParse(email)
  if (!result.success) throw new Error(`Invalid email: "${raw}"`)
  return email
}

export async function listStaff() {
  const snapshot = await db
    .collection(COLLECTIONS.staffEmails)
    .orderBy('email')
    .get()
  return snapshot.docs.map(
    (doc) =>
      doc.data() as { email: string; role: StaffRole; displayName: string },
  )
}

/** First-run setup: makes `email` the admin. Refuses if a different admin already exists. */
export async function setupAdmin(rawEmail: string, displayName: string) {
  const email = parseEmail(rawEmail)
  const admins = await db
    .collection(COLLECTIONS.staffEmails)
    .where('role', '==', 'admin')
    .get()
  const otherAdmins = admins.docs.filter((doc) => doc.id !== email)

  if (otherAdmins.length > 0) {
    throw new Error(
      `Setup was already done (admin: ${otherAdmins.map((d) => d.id).join(', ')}). ` +
        'Use "staff add" to add more teachers.',
    )
  }

  await addStaff(email, 'admin', displayName, 'setup')
  return email
}

export async function addStaff(
  rawEmail: string,
  role: StaffRole,
  displayName: string,
  addedBy: string,
) {
  const email = parseEmail(rawEmail)
  await staffDoc(email).set(
    {
      email,
      role,
      displayName,
      addedBy,
      addedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  return email
}

export async function removeStaff(rawEmail: string) {
  const email = parseEmail(rawEmail)
  const doc = await staffDoc(email).get()
  if (!doc.exists) throw new Error(`${email} is not in the teacher list`)

  if (doc.data()?.role === 'admin') {
    const admins = await db
      .collection(COLLECTIONS.staffEmails)
      .where('role', '==', 'admin')
      .count()
      .get()
    if (admins.data().count <= 1)
      throw new Error(`${email} is the last admin and can't be removed`)
  }

  await staffDoc(email).delete()
  return email
}
