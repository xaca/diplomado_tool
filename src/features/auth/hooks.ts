import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saveLocale, signInWithGoogle, signOut } from '@/features/auth/api'
import type { Language } from '@/lib/i18n'
import { useAuth } from '@/providers/auth-context'

export function useAuthActions() {
  const { t } = useTranslation()
  const [signingIn, setSigningIn] = useState(false)

  const signIn = useCallback(async () => {
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      // Closing the popup is not an error worth reporting
      if (!(
        error instanceof Error && error.message.includes('popup-closed-by-user')
      )) {
        toast.error(t('auth.error'))
      }
    } finally {
      setSigningIn(false)
    }
  }, [t])

  const switchAccount = useCallback(async () => {
    await signOut()
    await signIn()
  }, [signIn])

  return { signIn, signOut, switchAccount, signingIn }
}

export function useLanguage() {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const language = (i18n.resolvedLanguage ?? 'es') as Language

  const setLanguage = useCallback(
    async (next: Language) => {
      await i18n.changeLanguage(next)
      // Saved in the profile so it follows the user to other devices
      if (user) await saveLocale(user.uid, next)
    },
    [i18n, user],
  )

  return { language, setLanguage }
}
