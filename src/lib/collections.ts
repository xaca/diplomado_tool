// Firestore collection names, shared by the app and the admin CLI (scripts/admin).
// Keep this file free of SDK imports so both runtimes can use it.

export const COLLECTIONS = {
  users: 'users',
  staffEmails: 'staffEmails',
  boards: 'boards',
  joinCodes: 'joinCodes',
} as const

export type StaffRole = 'admin' | 'teacher'

/** Emails are stored lowercased and trimmed everywhere (doc ids and fields). */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
