import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { COLLECTIONS, normalizeEmail, type StaffRole } from '@/lib/collections'
import { auth, db } from '@/lib/firebase'

const provider = new GoogleAuthProvider()
// Always show the account chooser: students may switch between personal and university accounts
provider.setCustomParameters({ prompt: 'select_account' })

const POPUP_FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
]

export async function signInWithGoogle() {
  try {
    await signInWithPopup(auth, provider)
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      POPUP_FALLBACK_CODES.includes(error.code)
    ) {
      await signInWithRedirect(auth, provider)
      return
    }
    throw error
  }
}

export function signOut() {
  return firebaseSignOut(auth)
}

/** Creates or refreshes users/{uid} on every login. */
export async function ensureUserDoc(user: User) {
  const ref = doc(db, COLLECTIONS.users, user.uid)
  const snapshot = await getDoc(ref)
  await setDoc(
    ref,
    {
      displayName: user.displayName ?? '',
      email: normalizeEmail(user.email ?? ''),
      photoURL: user.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
  return snapshot.data()?.locale as 'es' | 'en' | undefined
}

/** A teacher is anyone whose email is in staffEmails (PLAN.md → "Roles"). */
export async function fetchRole(user: User): Promise<StaffRole | 'student'> {
  if (!user.email || !user.emailVerified) return 'student'
  const snapshot = await getDoc(
    doc(db, COLLECTIONS.staffEmails, normalizeEmail(user.email)),
  )
  return snapshot.exists() ? (snapshot.data().role as StaffRole) : 'student'
}

export async function saveLocale(uid: string, locale: 'es' | 'en') {
  await setDoc(doc(db, COLLECTIONS.users, uid), { locale }, { merge: true })
}
