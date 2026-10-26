import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
import type { StaffRole } from '@/lib/collections'

export type Role = StaffRole | 'student'

export type AuthState = {
  user: User | null
  /** null while signed out or while the role is being resolved */
  role: Role | null
  loading: boolean
  error: Error | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

export function isTeacherRole(role: Role | null) {
  return role === 'admin' || role === 'teacher'
}
