// Emulator-only helper exposed by src/features/auth/api.ts (see signIn in helpers.ts)
interface Window {
  __pblTestSignIn?: (email: string, name?: string) => Promise<void>
}
