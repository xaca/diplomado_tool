import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthContext, type AuthState } from '@/providers/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => setState({ user, loading: false })),
    [],
  )

  return <AuthContext value={state}>{children}</AuthContext>
}
