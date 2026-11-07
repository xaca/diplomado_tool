import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Circle, Construction } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSaveLock } from '@/components/save/use-save-lock'
import { useCheer } from '@/features/fun/use-cheer'
import { setWorkStatus } from '@/features/spaces/api'
import { cn } from '@/lib/utils'
import type { WorkStatus } from '@/model'

/**
 * "🚧 En progreso · ✓ Listo" (M27, D132): the student says whether they're still editing or ready
 * to present. The board's teacher can set it too (D129), signed "marcado por el docente".
 * Replaces M16's single "Mis diapositivas están listas" switch (same flag underneath).
 */
export function WorkStatusControl({
  boardId,
  studentId,
  status,
  by,
  size = 'sm',
}: {
  boardId: string
  studentId: string
  status: WorkStatus | null
  by: 'student' | 'teacher'
  size?: 'sm' | 'default'
}) {
  const { t } = useTranslation()
  const lock = useSaveLock()
  const cheer = useCheer()
  // The check draws itself when I mark it, not when the page opens already "Listo"
  const wasReady = useRef(status === 'ready')
  const [drawn, setDrawn] = useState(false)

  function choose(next: WorkStatus) {
    if (next === status) return
    void lock
      .run(() => setWorkStatus(boardId, studentId, next, by))
      .then(() => {
        if (next === 'ready') setDrawn(!wasReady.current)
        // M20: the student's own "Listo" is a milestone (confetti)
        if (next === 'ready' && by === 'student' && cheer('ready')) return
        toast.success(
          next === 'ready' ? t('ready.marked') : t('ready.wipMarked'),
        )
      })
      .catch(() => toast.error(t('errors.generic')))
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('ready.label')}
      className="flex items-center gap-1"
      data-testid="work-status"
    >
      <Button
        size={size}
        role="radio"
        aria-checked={status === 'wip'}
        variant={status === 'wip' ? 'default' : 'outline'}
        disabled={lock.saving}
        className={cn(
          status === 'wip' && 'bg-amber-500 text-white hover:bg-amber-600',
        )}
        title={t('ready.wipHint')}
        data-testid="wip-toggle"
        onClick={() => choose('wip')}
      >
        <Construction />
        {t('ready.wip')}
      </Button>
      <Button
        size={size}
        role="radio"
        aria-checked={status === 'ready'}
        aria-pressed={status === 'ready'}
        variant={status === 'ready' ? 'default' : 'outline'}
        disabled={lock.saving}
        className={cn(
          status === 'ready' && 'bg-green-600 text-white hover:bg-green-700',
        )}
        title={t('ready.mark')}
        data-testid="ready-toggle"
        onClick={() => choose('ready')}
      >
        {status === 'ready' ? (
          <CircleCheck className={drawn ? 'check-draw' : undefined} />
        ) : (
          <Circle />
        )}
        {t('ready.badge')}
      </Button>
    </div>
  )
}

/** The status on a card, in Presentaciones and in the presenter (nothing when not marked) */
export function WorkStatusBadge({
  status,
  byTeacher = false,
  className,
}: {
  status: WorkStatus | null
  byTeacher?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  if (!status) return null
  return (
    <Badge
      className={cn(
        status === 'ready'
          ? 'bg-green-100 text-green-900'
          : 'bg-amber-100 text-amber-900',
        className,
      )}
      title={byTeacher ? t('ready.byTeacher') : undefined}
      data-testid={status === 'ready' ? 'ready-badge' : 'wip-badge'}
    >
      {status === 'ready' ? `✓ ${t('ready.badge')}` : `🚧 ${t('ready.wip')}`}
    </Badge>
  )
}
