// Emulator-only helpers exposed by src/features/auth/api.ts (see signIn in helpers.ts) and
// src/features/mail/gmail.ts (a fake Gmail token, M24)
interface Window {
  __pblTestSignIn?: (email: string, name?: string) => Promise<void>
  __pblGmailToken?: string
}
