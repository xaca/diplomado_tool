import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Slide } from '@/features/slides/api'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { cn } from '@/lib/utils'

/** All slides of the current student as a grid; picking one jumps to it. */
export function SlideOverview({
  slides,
  current,
  onPick,
  onClose,
}: {
  slides: Slide[]
  current: number
  onPick: (index: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="absolute inset-0 z-20 overflow-auto bg-neutral-950/95 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={t('presenter.overview')}
      data-testid="slide-overview"
    >
      <div className="mb-4 flex items-center justify-between text-white">
        <h2 className="font-semibold">{t('presenter.overview')}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label={t('presenter.closeOverview')}
          onClick={onClose}
          autoFocus
        >
          <X />
        </Button>
      </div>
      <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {slides.map((slide, index) => (
          <li key={slide.id}>
            <button
              type="button"
              className={cn(
                'block w-full overflow-hidden rounded-lg border-2 text-left',
                index === current
                  ? 'border-white'
                  : 'border-transparent hover:border-white/40',
              )}
              aria-label={t('presenter.goTo', { number: index + 1 })}
              aria-current={index === current ? 'true' : undefined}
              onClick={() => onPick(index)}
            >
              <SlidePreview slide={slide} />
            </button>
            <span className="mt-1 block text-xs text-white/70">
              {index + 1}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
