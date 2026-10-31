import { useEffect, useRef, useState } from 'react'
import { nextAnimation } from '@/features/clock/clock'
import { gsap, motionAllowed } from '@/lib/gsap'
import { cn } from '@/lib/utils'

type Kind = 'calm' | 'fun'
type Manifest = { animations: { file: string; name: string; kind?: Kind }[] }

const ROTATE_MS: Record<Kind, number> = { calm: 20_000, fun: 12_000 }

// Both players read the same manifest: fetched once per page load
let manifest: Promise<Manifest> | undefined
function loadManifest() {
  manifest ??= fetch('/lottie/manifest.json')
    .then((response) => response.json() as Promise<Manifest>)
    .catch(() => {
      manifest = undefined
      return { animations: [] }
    })
  return manifest
}

/**
 * Break screen animation (M16, D53): self-hosted Lottie files (public/lottie/manifest.json),
 * a random one of its `kind` every 20 s (calm, ours) or 12 s (fun, from LottieFiles) without
 * repeats, crossfaded; the fun ones bounce in. The player is its own lazy chunk; with "reduce
 * motion" the first frame stays still.
 */
export function BreakAnimation({
  kind = 'calm',
  className,
}: {
  kind?: Kind
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [files, setFiles] = useState<Manifest['animations']>([])
  const [current, setCurrent] = useState(-1)
  const shown = useRef<number[]>([])

  useEffect(() => {
    let alive = true
    void loadManifest().then(
      ({ animations }) =>
        alive &&
        setFiles(
          animations.filter((animation) => (animation.kind ?? 'calm') === kind),
        ),
    )
    return () => {
      alive = false
    }
  }, [kind])

  // Pick one now and every ROTATE_MS
  useEffect(() => {
    if (!files.length) return
    const pick = () => {
      const next = nextAnimation(files.length, shown.current)
      shown.current = next.shown
      setCurrent(next.index)
    }
    pick()
    const timer = setInterval(pick, ROTATE_MS[kind])
    return () => clearInterval(timer)
  }, [files, kind])

  useEffect(() => {
    const file = files[current]
    const container = box.current
    if (!file || !container) return
    let animation: { destroy: () => void } | undefined
    let alive = true
    void import('lottie-web/build/player/lottie_light').then(
      ({ default: lottie }) => {
        if (!alive) return
        const still = !motionAllowed()
        const player = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: true,
          autoplay: !still,
          path: `/lottie/${file.file}`,
        })
        if (still)
          player.addEventListener('DOMLoaded', () =>
            player.goToAndStop(0, true),
          )
        animation = player
        if (still) return
        if (kind === 'fun')
          gsap.fromTo(
            container,
            { opacity: 0, scale: 0.6, y: 40, rotation: -8 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              rotation: 0,
              duration: 0.9,
              ease: 'back.out(2)',
            },
          )
        else
          gsap.fromTo(
            container,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.6 },
          )
      },
    )
    return () => {
      alive = false
      animation?.destroy()
    }
  }, [files, current, kind])

  if (!files.length) return null

  return (
    <div
      ref={box}
      className={cn('aspect-square w-[min(60vw,50svh)]', className)}
      aria-hidden
      data-testid={kind === 'fun' ? 'break-fun' : 'break-animation'}
      data-animation={files[current]?.name ?? ''}
    />
  )
}
