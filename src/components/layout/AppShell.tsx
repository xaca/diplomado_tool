import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { UserMenu } from '@/components/layout/UserMenu'

export function AppShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-heading font-semibold">{t('appName')}</span>
        <UserMenu />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
