import { useEffect, useState } from 'react'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import type { SlideDoc } from '@/model'

// Slide → SVG, rendered in the browser (zero Firestore/Cloudinary cost) and cached in memory.
// The Excalidraw runtime is loaded on first use, so pages without slides stay light.

type Options = { embeds?: boolean; inlineFonts?: boolean; present?: boolean }

const MAX_CACHED = 150
const cache = new Map<string, Promise<string>>()

function hash(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function slideSvgKey(
  slide: Pick<SlideDoc, 'content' | 'files'>,
  { embeds = false, inlineFonts = false, present = false }: Options,
) {
  return `${embeds ? 'e' : ''}${inlineFonts ? 'f' : ''}${present ? 'p' : ''}:${slide.content.length}:${hash(slide.content + JSON.stringify(slide.files ?? {}))}`
}

export function loadSlideSvg(
  slide: Pick<SlideDoc, 'content' | 'files'>,
  options: Options = {},
) {
  const key = slideSvgKey(slide, options)
  let svg = cache.get(key)
  if (!svg) {
    svg = import('@/features/slides/engine/runtime').then(
      ({ renderSlideSvg }) => renderSlideSvg(slide, options),
    )
    svg.catch(() => cache.delete(key))
    cache.set(key, svg)
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!)
  }
  return svg
}

/** Renders a slide ahead of time and warms the browser cache for its images (presenter). */
export function preloadSlide(
  slide: Pick<SlideDoc, 'content' | 'files'>,
  options: Options = {},
) {
  void loadSlideSvg(slide, options).catch(() => undefined)
  const size = options.present ? IMAGE_SIZES.present : IMAGE_SIZES.slide
  for (const ref of Object.values(slide.files ?? {})) {
    new Image().src = imageUrl(ref, size)
  }
}

export function useSlideSvg(
  slide: Pick<SlideDoc, 'content' | 'files'> | undefined,
  options: Options = {},
) {
  const key = slide ? slideSvgKey(slide, options) : ''
  const [state, setState] = useState<{
    key: string
    svg: string | null
    error: boolean
  }>({ key: '', svg: null, error: false })

  useEffect(() => {
    if (!slide) return
    let active = true
    loadSlideSvg(slide, options).then(
      (svg) => active && setState({ key, svg, error: false }),
      (error: unknown) => {
        console.error('[slides] render failed', error)
        if (active) setState({ key, svg: null, error: true })
      },
    )
    return () => {
      active = false
    }
    // `key` covers the slide content and the options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Keep showing the previous render while the new one is computed (no flicker)
  return {
    svg: state.svg,
    loading: state.key !== key,
    error: state.key === key && state.error,
  }
}
