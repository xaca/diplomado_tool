import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { attachEmbedOverlays } from '@/features/slides/embed-overlay'
import { useSlideSvg } from '@/features/slides/engine/use-slide-svg'
import { useEmbedTexts } from '@/features/slides/use-embed-texts'
import { gsap, motionAllowed } from '@/lib/gsap'
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
  const live = large || present
  const { svg, error } = useSlideSvg(slide, {
    embeds: live,
    inlineFonts: live,
    present,
  })
  const box = useRef<HTMLDivElement>(null)
  const embedTexts = useEmbedTexts()

  // Live slides (M14): fade in when ready; each embed shows its loading state until it loads
  useLayoutEffect(() => {
    if (!svg || !live || !box.current) return
    if (motionAllowed())
      gsap.fromTo(box.current, { opacity: 0 }, { opacity: 1, duration: 0.35 })
    return attachEmbedOverlays(box.current, embedTexts)
  }, [svg, live, embedTexts])

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
  if (!svg) {
    if (!live) return <Skeleton className={cn('aspect-video', className)} />
    return (
      <div
        className={cn(
          'embed-overlay relative aspect-video w-full overflow-hidden',
          className,
        )}
        role="status"
        data-testid="slide-loading"
      >
        <span className="embed-spinner" aria-hidden />
        <span>{t('embeds.slideLoading')}</span>
      </div>
    )
  }
  return (
    <div
      ref={box}
      className={cn('aspect-video overflow-hidden bg-white', className)}
      data-testid="slide-preview"
      // Exported by Excalidraw from the stored scene; links and embeds are sanitized in renderSlideSvg
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
