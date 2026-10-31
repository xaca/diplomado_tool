import { Link, Outlet, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HomeLink } from '@/components/layout/HomeLink'
import { UserMenu } from '@/components/layout/UserMenu'

/** Routes with `handle: { ownHeader: true }` render the app name and menu in their own header. */
export type ShellHandle = { ownHeader?: boolean }

export function AppShell() {
  const { t } = useTranslation()
  const ownHeader = useMatches().some(
    (match) => (match.handle as ShellHandle | undefined)?.ownHeader,
  )

  return (
    <div className="flex min-h-svh flex-col">
      {!ownHeader && (
        <header className="flex h-14 items-center justify-between border-b px-4">
          <HomeLink />
          <UserMenu />
        </header>
      )}
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
