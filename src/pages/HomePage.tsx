import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { gsap, useGSAP } from '@/lib/gsap'
import { useAuth } from '@/providers/auth-context'

export function HomePage() {
  const container = useRef<HTMLElement>(null)
  const { user, loading } = useAuth()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-animate]', {
          y: 24,
          opacity: 0,
          duration: 0.6,
          stagger: 0.12,
          ease: 'power2.out',
        })
      })
    },
    { scope: container },
  )

  return (
    <main
      ref={container}
      className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center"
    >
      <h1
        data-animate
        className="font-heading text-4xl font-bold tracking-tight"
      >
        diplomado_pbl
      </h1>
      <p data-animate className="max-w-md text-muted-foreground">
        React + Firebase template · Tailwind · shadcn/ui · GSAP
      </p>
      <p data-animate className="text-sm">
        Auth: {loading ? 'checking…' : user ? user.email : 'signed out'}
      </p>
      <Button data-animate>Get started</Button>
    </main>
  )
}
