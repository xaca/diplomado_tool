import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { env } from '@/lib/env'

type Section = { title: string; body: string[] }

/** Privacy notice (Colombia, Ley 1581 de 2012). Public: linked from the login page. */
export function PrivacyPage() {
  const { t } = useTranslation()
  const sections = t('privacy.sections', { returnObjects: true }) as Section[]

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link
        to="/login"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('appName')}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          {t('privacy.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('privacy.updated')}</p>
        <p>{t('privacy.intro', { app: t('appName') })}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t('privacy.contactTitle')}</h2>
        <p className="text-sm">
          {env.VITE_PRIVACY_CONTACT
            ? t('privacy.contact', { contact: env.VITE_PRIVACY_CONTACT })
            : t('privacy.contactTeacher')}
        </p>
      </section>
      <p className="text-xs text-muted-foreground">
        {t('privacy.recaptcha')}{' '}
        <a
          className="underline"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('privacy.googlePrivacy')}
        </a>{' '}
        ·{' '}
        <a
          className="underline"
          href="https://policies.google.com/terms"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('privacy.googleTerms')}
        </a>
      </p>
    </main>
  )
}
