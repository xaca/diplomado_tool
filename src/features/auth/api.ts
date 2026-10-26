import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { COLLECTIONS, normalizeEmail, type StaffRole } from '@/lib/collections'
import { env } from '@/lib/env'
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

// ---------- emulator-only test sign-in (Playwright) ----------
// The Auth emulator accepts a fake Google ID token, so tests can sign in without the Google popup.
// Never available in production builds: guarded by DEV + emulator mode.

declare global {
  interface Window {
    __pblTestSignIn?: (email: string, name?: string) => Promise<void>
  }
}

if (import.meta.env.DEV && env.VITE_USE_EMULATORS) {
  window.__pblTestSignIn = async (email, name = email.split('@')[0]) => {
    const token = JSON.stringify({
      sub: email,
      email,
      email_verified: true,
      name,
    })
    await signInWithCredential(auth, GoogleAuthProvider.credential(token))
  }
}
