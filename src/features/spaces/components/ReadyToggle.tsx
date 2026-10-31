import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
          .then(() =>
            toast.success(ready ? t('ready.unmarked') : t('ready.marked')),
          )
          .catch(() => toast.error(t('errors.generic')))
          .finally(() => setBusy(false))
      }}
    >
      {ready ? <CircleCheck /> : <Circle />}
      {ready ? t('ready.badge') : t('ready.mark')}
    </Button>
  )
}
