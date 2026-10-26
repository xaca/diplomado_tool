import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Admin SDK wired to the local emulators only (seed script and e2e tests).
// "demo-*" projects can't reach production even if the emulator env vars were missing.

export const EMULATOR_PROJECT_ID = 'demo-pbl'
const FIRESTORE_HOST = '127.0.0.1:8080'
const AUTH_HOST = '127.0.0.1:9099'

process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_HOST
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_HOST

const app = getApps()[0] ?? initializeApp({ projectId: EMULATOR_PROJECT_ID })

export const emulatorDb = getFirestore(app)
export const emulatorAuth = getAuth(app)

/** Wipes all emulator data (Firestore documents + Auth accounts). */
export async function resetEmulators() {
  const firestore = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`
  const auth = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`
  const responses = await Promise.all([
    fetch(firestore, { method: 'DELETE' }),
    fetch(auth, { method: 'DELETE' }),
  ])
  for (const response of responses) {
    if (!response.ok)
      throw new Error(
        `Emulator reset failed: ${response.status} ${response.url}`,
      )
  }
}
