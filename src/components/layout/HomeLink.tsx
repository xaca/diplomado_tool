import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { House } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The app name, home. `compact`: just a house icon (the board's shrunk sticky header). */
export function HomeLink({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  return (
    // Home: "/" sends teachers to their dashboard and students to their boards
    <Link
      to="/"
      className={cn(
        'flex items-center gap-1.5 rounded-md font-heading font-semibold hover:opacity-80',
        className,
      )}
      aria-label={`${t('appName')} · ${t('common.home')}`}
      title={t('common.home')}
      data-testid="home-link"
    >
      {compact ? <House className="size-5" /> : t('appName')}
    </Link>
  )
}
