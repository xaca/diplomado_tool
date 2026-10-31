import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Register plugins once; import gsap from '@/lib/gsap' everywhere else
gsap.registerPlugin(useGSAP, ScrollTrigger, Flip)

export { Flip, gsap, ScrollTrigger, useGSAP }

/** Animations run only when the system doesn't ask for reduced motion (D31). */
export function motionAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** M20: an item leaves by shrinking away; resolves at once with reduced motion. */
export function shrinkAway(element: Element | null) {
  if (!element || !motionAllowed()) return Promise.resolve()
  return new Promise<void>((resolve) => {
    gsap.to(element, {
      scale: 0.6,
      opacity: 0,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: resolve,
    })
  })
}

/** Undo shrinkAway (the delete failed). */
export function unshrink(element: Element | null) {
  if (element) gsap.set(element, { clearProps: 'scale,opacity' })
}
