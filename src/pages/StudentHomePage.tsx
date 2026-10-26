import { useTranslation } from 'react-i18next'

export function StudentHomePage() {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-2 p-6">
      <h1 className="font-heading text-2xl font-semibold">
        {t('student.title')}
      </h1>
      <p className="text-muted-foreground">{t('student.empty')}</p>
    </section>
  )
}
