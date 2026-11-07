import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SaveLock } from '@/components/save/use-save-lock'

type Props = ComponentProps<typeof Button> & {
  lock: Pick<SaveLock, 'saving' | 'slow' | 'saved'>
  /** Text while saving (default "Guardando…") */
  savingLabel?: string
  /** Show "Guardado ✓" for a moment after a save (off for buttons that close their form) */
  showSaved?: boolean
}

/**
 * M27 (D131): a button that stays locked while its save runs: spinner + "Guardando…", and
 * "Sigue guardando… revisa tu conexión" next to it after 8 s. The click handler should go
 * through the same lock (`lock.run`), so a double click never saves twice.
 */
export function SaveButton({
  lock,
  savingLabel,
  showSaved = false,
  disabled,
  children,
  ...props
}: Props) {
  const { t } = useTranslation()
  return (
    <>
      <Button
        {...props}
        disabled={disabled || lock.saving}
        aria-busy={lock.saving || undefined}
        data-saving={lock.saving || undefined}
      >
        {lock.saving ? (
          <>
            <Loader2 className="animate-spin" />
            {savingLabel ?? t('common.saving')}
          </>
        ) : showSaved && lock.saved ? (
          <>
            <Check />
            {t('save.saved')}
          </>
        ) : (
          children
        )}
      </Button>
      {lock.slow && (
        <span
          role="status"
          className="text-xs text-amber-700"
          data-testid="save-slow"
        >
          {t('save.slow')}
        </span>
      )}
    </>
  )
}
