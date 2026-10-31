import { useEffect, useRef, useState } from 'react'
import { nextAnimation } from '@/features/clock/clock'
import { gsap, motionAllowed } from '@/lib/gsap'

type Manifest = { animations: { file: string; name: string }[] }

const ROTATE_MS = 20_000

/**
 * Break screen animation (M16, D53): self-hosted Lottie files (public/lottie/manifest.json),
 * a random one every 20 s without repeats, crossfaded. The player is its own lazy chunk; with
 * "reduce motion" the first frame stays still.
 */
export function BreakAnimation() {
  const box = useRef<HTMLDivElement>(null)
  const [files, setFiles] = useState<Manifest['animations']>([])
  const [current, setCurrent] = useState(-1)
  const shown = useRef<number[]>([])

  useEffect(() => {
    let alive = true
    fetch('/lottie/manifest.json')
      .then((response) => response.json() as Promise<Manifest>)
      .then((manifest) => alive && setFiles(manifest.animations))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  // Pick one now and every ROTATE_MS
  useEffect(() => {
    if (!files.length) return
    const pick = () => {
      const next = nextAnimation(files.length, shown.current)
      shown.current = next.shown
      setCurrent(next.index)
    }
    pick()
    const timer = setInterval(pick, ROTATE_MS)
    return () => clearInterval(timer)
  }, [files])

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
        if (!still)
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
  }, [files, current])

  return (
    <div
      ref={box}
      className="aspect-square w-[min(60vw,50svh)]"
      aria-hidden
      data-testid="break-animation"
      data-animation={files[current]?.name ?? ''}
    />
  )
}
