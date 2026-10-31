import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { UserMenu } from '@/components/layout/UserMenu'

export function AppShell() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        {/* Home: "/" sends teachers to their dashboard and students to their boards */}
        <Link
          to="/"
          className="rounded-md font-heading font-semibold hover:opacity-80"
          aria-label={`${t('appName')} · ${t('common.home')}`}
          title={t('common.home')}
          data-testid="home-link"
        >
          {t('appName')}
        </Link>
        <UserMenu />
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
        <Link to="/privacidad" className="hover:underline">
          {t('footer.privacy')}
        </Link>
      </footer>
    </div>
  )
}
