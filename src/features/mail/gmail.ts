import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { env } from '@/lib/env'
import { toBase64Url } from '@/features/mail/message'

// Sending from the teacher's own Gmail (M24, D100): Google is asked, when the teacher sends, for
// permission to send only (gmail.send: it can't read the mailbox). The short-lived token (1 h)
// stays in memory and is never stored. No server in between.

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
/** Tokens last an hour; ask again a bit before */
const TOKEN_MS = 50 * 60_000

export type GmailProblem =
  | 'cancelled'
  | 'popup'
  | 'mismatch'
  | 'noToken'
  | 'expired'
  | 'scope'
  | 'rate'
  | 'failed'

export class GmailError extends Error {
  problem: GmailProblem
  constructor(problem: GmailProblem, message: string = problem) {
    super(message)
    this.name = 'GmailError'
    this.problem = problem
  }
}

declare global {
  interface Window {
    /** e2e only (emulators): a token, so the Google popup is skipped; Gmail itself is faked */
    __pblGmailToken?: string
  }
}

let cached: { uid: string; token: string; until: number } | null = null

export function forgetGmailToken() {
  cached = null
}

/** The token to send with; opens Google's popup when there's none (call it from a click) */
export async function gmailToken(user: User) {
  if (import.meta.env.DEV && env.VITE_USE_EMULATORS && window.__pblGmailToken)
    return window.__pblGmailToken
  if (cached && cached.uid === user.uid && cached.until > Date.now())
    return cached.token
  const provider = new GoogleAuthProvider()
  provider.addScope(GMAIL_SEND_SCOPE)
  if (user.email) provider.setCustomParameters({ login_hint: user.email })
  try {
    const result = await reauthenticateWithPopup(user, provider)
    const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
    if (!token) throw new GmailError('noToken')
    cached = { uid: user.uid, token, until: Date.now() + TOKEN_MS }
    return token
  } catch (error) {
    if (error instanceof GmailError) throw error
    if (error instanceof FirebaseError) {
      if (
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      )
        throw new GmailError('cancelled')
      if (error.code === 'auth/popup-blocked') throw new GmailError('popup')
      if (error.code === 'auth/user-mismatch') throw new GmailError('mismatch')
    }
    throw new GmailError('failed', String(error))
  }
}

/** Sends one message (the raw MIME text); throws GmailError */
export async function sendRaw(token: string, raw: string) {
  const response = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  })
  if (response.ok) return
  if (response.status === 401) {
    forgetGmailToken()
    throw new GmailError('expired')
  }
  if (response.status === 403) {
    forgetGmailToken()
    throw new GmailError('scope')
  }
  if (response.status === 429) throw new GmailError('rate')
  throw new GmailError('failed', `Gmail ${response.status}`)
}
