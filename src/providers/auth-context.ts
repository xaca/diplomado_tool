import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export type AuthState = {
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
