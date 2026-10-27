import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { useSlideSvg } from '@/features/slides/engine/use-slide-svg'
import { cn } from '@/lib/utils'
import type { SlideDoc } from '@/model'

/**
 * A slide rendered as SVG (viewer, thumbnails). Thumbnails skip live embeds and font inlining;
 * the large viewer turns both on so it looks exactly like the editor.
 */
export function SlidePreview({
  slide,
  large = false,
  present = false,
  className,
}: {
  slide: Pick<SlideDoc, 'content' | 'files'>
  large?: boolean
  /** Full-screen presentation (implies large, with bigger images) */
  present?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const { svg, error } = useSlideSvg(slide, {
    embeds: large || present,
    inlineFonts: large || present,
    present,
  })

  if (error) {
    return (
      <div
        className={cn(
          'flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground',
          className,
        )}
      >
        {t('slides.renderError')}
      </div>
    )
  }
  if (!svg) return <Skeleton className={cn('aspect-video', className)} />
  return (
    <div
      className={cn('aspect-video overflow-hidden bg-white', className)}
      data-testid="slide-preview"
      // Exported by Excalidraw from the stored scene; links and embeds are sanitized in renderSlideSvg
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
