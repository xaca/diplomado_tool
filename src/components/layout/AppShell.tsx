import { Link, Outlet, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HomeLink } from '@/components/layout/HomeLink'
import { UserMenu } from '@/components/layout/UserMenu'
import { AchievementSync } from '@/features/achievements/components/AchievementSync'
import { NotificationBell } from '@/features/announcements/components/NotificationBell'

/** Routes with `handle: { ownHeader: true }` render the app name and menu in their own header. */
export type ShellHandle = { ownHeader?: boolean }

export function AppShell() {
  const { t } = useTranslation()
  const matches = useMatches()
  const ownHeader = matches.some(
    (match) => (match.handle as ShellHandle | undefined)?.ownHeader,
  )
  // Inside a board (space page, editor): the students' 🔔 (M19)
  const boardId = matches.find((match) => match.params.boardId)?.params.boardId

  return (
    <div className="flex min-h-svh flex-col">
      {!ownHeader && (
        <header className="flex h-14 items-center justify-between border-b px-4">
          <HomeLink />
          <div className="flex items-center gap-1">
            {boardId && <NotificationBell boardId={boardId} />}
            <UserMenu />
          </div>
        </header>
      )}
      <main className="flex-1">
        <Outlet />
        {/* M22: unlocks achievements that are already true (students; renders nothing) */}
        {boardId && <AchievementSync boardId={boardId} />}
      </main>
      <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
        <Link to="/privacidad" className="hover:underline">
          {t('footer.privacy')}
        </Link>
      </footer>
    </div>
  )
}
