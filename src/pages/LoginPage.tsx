import { useRef } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthActions, useLanguage } from '@/features/auth/hooks'
import { gsap, useGSAP } from '@/lib/gsap'
import { SUPPORTED_LANGUAGES } from '@/lib/i18n'
import { useAuth } from '@/providers/auth-context'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const { signIn, signingIn } = useAuthActions()
  const { language, setLanguage } = useLanguage()
  const location = useLocation()
  const container = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-animate]', {
          y: 16,
          opacity: 0,
          duration: 0.5,
          stagger: 0.08,
          ease: 'power2.out',
        })
      })
    },
    { scope: container },
  )

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  return (
    <main
      ref={container}
      className="flex min-h-svh items-center justify-center bg-muted/40 p-4"
    >
      <Card className="w-full max-w-sm" data-animate>
        <CardHeader className="text-center">
          <p className="text-sm text-muted-foreground">{t('appName')}</p>
          <CardTitle className="text-2xl">{t('auth.title')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button size="lg" onClick={signIn} disabled={signingIn || loading}>
            {signingIn ? t('auth.signingIn') : t('auth.signIn')}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hint')}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {t('auth.privacy')}
          </p>
          <div className="flex justify-center gap-2 text-sm">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <Button
                key={lng}
                variant={lng === language ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => void setLanguage(lng)}
              >
                {t(`language.${lng}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
