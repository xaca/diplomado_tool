import { initializeApp } from 'firebase/app'
import {
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
} from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { env } from '@/lib/env'

// Single Firebase entry point: import `auth` / `db` from here, never initialize elsewhere.
// Components should not call the SDK directly — go through feature api/hooks modules.

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

/**
 * App Check (PLAN.md → M8): proves requests come from this app, not a script reusing the
 * public config. reCAPTCHA v3 (free, no billing). Off until VITE_RECAPTCHA_SITE_KEY is set,
 * and always off on the emulators. On localhost it uses a debug token instead of reCAPTCHA.
 */
export const appCheck =
  env.VITE_RECAPTCHA_SITE_KEY && !env.VITE_USE_EMULATORS
    ? (() => {
        if (import.meta.env.DEV)
          globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN =
            env.VITE_APPCHECK_DEBUG_TOKEN || true
        return initializeAppCheck(app, {
          provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        })
      })()
    : null

/** Current App Check token for the media-api Worker (null when App Check is off). */
export async function appCheckToken() {
  if (!appCheck) return null
  try {
    return (await getToken(appCheck)).token
  } catch (error) {
    console.warn('[app-check] no token', error)
    return null
  }
}

export const auth = getAuth(app)
// Offline cache shared across tabs: fewer repeated reads (free-tier budget) and resilient editing
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})

if (import.meta.env.DEV && env.VITE_USE_EMULATORS) {
  // Ports must match the "emulators" section in firebase.json
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
