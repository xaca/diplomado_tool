import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCheer } from '@/features/fun/use-cheer'
import { setReadyToPresent } from '@/features/spaces/api'

/** "Mis diapositivas están listas" (M16, D52): the student's own switch; the teacher filters by it. */
export function ReadyToggle({
  boardId,
  studentId,
  ready,
  size = 'sm',
}: {
  boardId: string
  studentId: string
  ready: boolean
  size?: 'sm' | 'default'
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const cheer = useCheer()
  // The check draws itself when I mark them, not when the page opens already "Lista"
  const wasReady = useRef(ready)
  const [drawn, setDrawn] = useState(false)
  return (
    <Button
      size={size}
      variant={ready ? 'default' : 'outline'}
      aria-pressed={ready}
      disabled={busy}
      className={
        ready ? 'bg-green-600 text-white hover:bg-green-700' : undefined
      }
      data-testid="ready-toggle"
      onClick={() => {
        setBusy(true)
        setReadyToPresent(boardId, studentId, !ready)
          .then(() => {
            setDrawn(!ready && !wasReady.current)
            // M20: marking them ready is a milestone (confetti), unmarking just says so
            if (ready || !cheer('ready'))
              toast.success(ready ? t('ready.unmarked') : t('ready.marked'))
          })
          .catch(() => toast.error(t('errors.generic')))
          .finally(() => setBusy(false))
      }}
    >
      {ready ? (
        <CircleCheck className={drawn ? 'check-draw' : undefined} />
      ) : (
        <Circle />
      )}
      {ready ? t('ready.badge') : t('ready.mark')}
    </Button>
  )
}
