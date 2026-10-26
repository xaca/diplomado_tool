import { useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { ensureUserDoc, fetchRole } from '@/features/auth/api'
import { i18n } from '@/lib/i18n'
import { auth } from '@/lib/firebase'
import { AuthContext, type AuthState } from '@/providers/auth-context'

const SIGNED_OUT: AuthState = {
  user: null,
  role: null,
  loading: false,
  error: null,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...SIGNED_OUT,
    loading: true,
  })

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState(SIGNED_OUT)
          return
        }
        setState({ user, role: null, loading: true, error: null })
        try {
          const [locale, role] = await Promise.all([
            ensureUserDoc(user),
            fetchRole(user),
          ])
          if (locale && locale !== i18n.resolvedLanguage)
            await i18n.changeLanguage(locale)
          setState({ user, role, loading: false, error: null })
        } catch (error) {
          setState({ user, role: null, loading: false, error: error as Error })
        }
      }),
    [],
  )

  return <AuthContext value={state}>{children}</AuthContext>
}
