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
