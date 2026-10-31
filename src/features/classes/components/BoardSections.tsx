import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, StickyNote, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

/** "Tarjetas | Clases | Logros" (M10, M22): the board's cards (unchanged), class walls, achievements. */
export function BoardSections({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <nav
      aria-label={t('classes.sections')}
      className="inline-flex gap-1 self-start rounded-lg bg-muted p-1"
    >
      <NavLink to={`/b/${boardId}`} end className={tab}>
        <LayoutGrid className="size-4" />
        {t('classes.cards')}
      </NavLink>
      <NavLink to={`/b/${boardId}/class`} className={tab}>
        <StickyNote className="size-4" />
        {t('classes.tab')}
      </NavLink>
      <NavLink to={`/b/${boardId}/logros`} className={tab}>
        <Trophy className="size-4" />
        {t('achievements.title')}
      </NavLink>
    </nav>
  )
}
