import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Clapperboard, LayoutGrid, StickyNote, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Tarjetas | Clases | Grabaciones | Logros" (M10, M23, M22): the board's cards (unchanged), class
 * walls, recorded classes, achievements.
 */
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
      className="inline-flex max-w-full gap-1 self-start overflow-x-auto rounded-lg bg-muted p-1"
    >
      <NavLink to={`/b/${boardId}`} end className={tab}>
        <LayoutGrid className="size-4" />
        {t('classes.cards')}
      </NavLink>
      <NavLink to={`/b/${boardId}/class`} className={tab}>
        <StickyNote className="size-4" />
        {t('classes.tab')}
      </NavLink>
      <NavLink to={`/b/${boardId}/videos`} className={tab}>
        <Clapperboard className="size-4" />
        {t('recordings.tab')}
      </NavLink>
      <NavLink to={`/b/${boardId}/logros`} className={tab}>
        <Trophy className="size-4" />
        {t('achievements.title')}
      </NavLink>
    </nav>
  )
}
