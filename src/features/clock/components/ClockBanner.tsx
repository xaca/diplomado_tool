import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Coffee, Expand, Pause, Timer } from 'lucide-react'
import { formatClock } from '@/features/clock/clock'
import { useClockNow, useCloseEndedClock } from '@/features/clock/hooks'
import { cn } from '@/lib/utils'
import type { ClassClock } from '@/model'

/**
 * The class clock for everyone (M16, D49): a slim sticky bar on the board, the space page and the
 * slide editor. Amber in the last minute, "¡Tiempo!" at zero, then it closes (CLOSE_AFTER_MS). The
 * teacher gets "Vista enfocada". Its height is published as --clock-banner-h for sticky headers.
 */
export function ClockBanner({
  boardId,
  clock,
  teacher = false,
}: {
  boardId: string
  clock: ClassClock | null | undefined
  teacher?: boolean
}) {
  const { t } = useTranslation()
  const now = useClockNow(clock)
  const bar = useRef<HTMLDivElement>(null)
  const visible = !!clock && !!now && !now.closed
  useCloseEndedClock(boardId, !!now?.closed, teacher)
  useLayoutEffect(() => {
    const root = document.documentElement.style
    root.setProperty(
      '--clock-banner-h',
      `${visible ? (bar.current?.offsetHeight ?? 0) : 0}px`,
    )
    return () => {
      root.removeProperty('--clock-banner-h')
    }
  }, [visible])
  if (!clock || !now || !visible) return null
  const isBreak = clock.mode === 'break'
  const Icon = clock.paused ? Pause : isBreak ? Coffee : Timer
  const ended = now.status === 'ended'

  return (
    <div
      ref={bar}
      role="timer"
      aria-live={ended ? 'assertive' : 'off'}
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 px-4 py-1.5 text-sm font-medium shadow-sm transition-colors',
        ended
          ? 'animate-pulse bg-rose-600 text-white motion-reduce:animate-none'
          : now.status === 'ending'
            ? 'bg-amber-400 text-amber-950'
            : isBreak
              ? 'bg-sky-600 text-white'
              : 'bg-neutral-900 text-white',
      )}
      data-testid="clock-banner"
      data-status={now.status}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {clock.label || (isBreak ? t('clock.breakLabel') : t('clock.activity'))}
        {clock.paused && ` · ${t('clock.paused')}`}
      </span>
      <span
        className="font-mono text-base tabular-nums"
        data-testid="clock-time"
      >
        {ended
          ? isBreak
            ? t('clock.breakOver')
            : t('clock.time')
          : formatClock(now.remaining)}
      </span>
      <span
        className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/25 sm:block"
        aria-hidden
      >
        <span
          className="block h-full bg-current transition-[width] duration-300"
          style={{ width: `${Math.round(now.progress * 100)}%` }}
        />
      </span>
      {teacher && (
        <Link
          to={`/b/${boardId}/focus`}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs hover:bg-white/15"
        >
          <Expand className="size-3.5" />
          {t('clock.focus')}
        </Link>
      )}
    </div>
  )
}
