import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays,
  Clapperboard,
  LayoutGrid,
  Presentation,
  StickyNote,
  Trophy,
} from 'lucide-react'
import { useBoard } from '@/features/boards/hooks'
import { useHasCalendar } from '@/features/course/hooks'
import { cn } from '@/lib/utils'

/**
 * "Tarjetas | Clases | Grabaciones | Presentaciones | Calendario | Logros" (M10, M23, M25, M24,
 * M22): the board's cards (unchanged), class walls, recorded classes, the students' own slides
 * (D126), the course calendar (only when it has dates or news, D105), achievements.
 */
export function BoardSections({
  boardId,
  tone,
}: {
  boardId: string
  tone?: 'dark' | 'light'
}) {
  const { t } = useTranslation()
  const board = useBoard(boardId)
  const calendar = useHasCalendar(boardId, board.data?.course)
  const glass = tone === 'light'
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? glass
          ? 'bg-white/25 text-white shadow-sm'
          : 'bg-background text-foreground shadow-sm'
        : glass
          ? 'text-white/70 hover:text-white'
          : 'text-muted-foreground hover:text-foreground',
    )
  return (
    <nav
      aria-label={t('classes.sections')}
      className={cn(
        'inline-flex max-w-full gap-1 self-start overflow-x-auto rounded-lg p-1',
        glass ? 'bg-white/15 backdrop-blur-sm' : 'bg-muted',
      )}
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
      <NavLink to={`/b/${boardId}/presentaciones`} className={tab}>
        <Presentation className="size-4" />
        {t('presentations.tab')}
      </NavLink>
      {calendar && (
        <NavLink to={`/b/${boardId}/calendario`} className={tab}>
          <CalendarDays className="size-4" />
          {t('course.calendar')}
        </NavLink>
      )}
      <NavLink to={`/b/${boardId}/logros`} className={tab}>
        <Trophy className="size-4" />
        {t('achievements.title')}
      </NavLink>
    </nav>
  )
}
