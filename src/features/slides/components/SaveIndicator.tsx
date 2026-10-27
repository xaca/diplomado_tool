import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react'
import type { SaveStatus } from '@/features/slides/engine/autosave'
import { SlideTooLargeError } from '@/features/slides/engine/scene'
import { SLIDE_WARN_BYTES } from '@/model'

/** "Guardando… / Guardado" next to the editor title, plus the slide size warning. */
export function SaveIndicator({
  status,
  error,
  bytes,
}: {
  status: SaveStatus
  error?: unknown
  bytes: number
}) {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-3 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
      data-testid="save-status"
    >
      {bytes > SLIDE_WARN_BYTES && status !== 'error' && (
        <span className="flex items-center gap-1 text-amber-700">
          <AlertTriangle className="size-3.5" />
          {t('slides.nearLimit')}
        </span>
      )}
      {status === 'dirty' && <span>{t('slides.status.dirty')}</span>}
      {status === 'saving' && (
        <span className="flex items-center gap-1">
          <Loader2 className="size-3.5 animate-spin" />
          {t('slides.status.saving')}
        </span>
      )}
      {status === 'saved' && (
        <span className="flex items-center gap-1">
          <Check className="size-3.5" />
          {t('slides.status.saved')}
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-destructive">
          <CloudOff className="size-3.5" />
          {error instanceof SlideTooLargeError
            ? t('slides.status.tooLarge')
            : t('slides.status.error')}
        </span>
      )}
    </div>
  )
}
