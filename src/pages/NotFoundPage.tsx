import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <Button nativeButton={false} render={<Link to="/" />}>
        {t('notFound.back')}
      </Button>
    </main>
  )
}
