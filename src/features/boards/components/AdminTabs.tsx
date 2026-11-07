import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays,
  Clapperboard,
  ClipboardCheck,
  LayoutDashboard,
  Mail,
  Presentation,
  Settings,
  Users,
} from 'lucide-react'
import {
  ADMIN_TABS,
  adminTabPath,
  type AdminTab,
} from '@/features/boards/admin-tabs'
import { cn } from '@/lib/utils'

const ICONS = {
  overview: LayoutDashboard,
  students: Users,
  course: CalendarDays,
  recordings: Clapperboard,
  presentations: Presentation,
  evaluations: ClipboardCheck,
  communication: Mail,
  settings: Settings,
} satisfies Record<AdminTab, unknown>

export function AdminTabs({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  return (
    <nav
      aria-label={t('admin.sections')}
      className="flex max-w-full gap-1 self-start overflow-x-auto rounded-lg bg-muted p-1"
      data-testid="admin-tabs"
    >
      {ADMIN_TABS.map((tab) => {
        const Icon = ICONS[tab]
        return (
          <NavLink
            key={tab}
            to={adminTabPath(boardId, tab)}
            end
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" />
            {t(`admin.tabs.${tab}`)}
          </NavLink>
        )
      })}
    </nav>
  )
}
