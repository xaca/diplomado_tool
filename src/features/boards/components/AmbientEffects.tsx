import { useEffect, useRef } from 'react'
import type { Ambient } from '@/features/boards/styles'
import { motionAllowed } from '@/lib/gsap'

// Background animation of a board style (M21, D76): one canvas behind the cards, capped
// particles, paused while the tab is hidden, nothing with "reduce motion". Lazy chunk.

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  spin: number
  angle: number
  color: string
  shape: 'dot' | 'heart' | 'bat' | 'ring' | 'petal' | 'paper' | 'cap'
  life: number
}

const COLORS: Record<Ambient, string[]> = {
  snow: ['rgba(255,255,255,0.85)'],
  hearts: ['#f43f5e', '#fb7185', '#ec4899'],
  bats: ['#0f0a1e'],
  bubbles: ['rgba(255,255,255,0.7)'],
  petals: ['#ec4899', '#f59e0b', '#a855f7', '#ef4444', '#facc15'],
  confetti: ['#facc15', '#fde68a', '#f8fafc', '#93c5fd', '#f472b6'],
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)]

function spawn(
  kind: Ambient,
  width: number,
  height: number,
  initial: boolean,
): Particle {
  const color = pick(COLORS[kind])
  const base = {
    spin: rand(-0.02, 0.02),
    angle: rand(0, Math.PI * 2),
    color,
    life: 1,
  }
  switch (kind) {
    case 'snow':
      return {
        ...base,
        shape: 'dot',
        x: rand(0, width),
        y: initial ? rand(0, height) : -10,
        vx: rand(-0.3, 0.3),
        vy: rand(0.4, 1.1),
        size: rand(1.5, 3.5),
      }
    case 'hearts':
      return {
        ...base,
        shape: 'heart',
        x: rand(0, width),
        y: initial ? rand(0, height) : height + 20,
        vx: rand(-0.2, 0.2),
        vy: rand(-0.8, -0.3),
        size: rand(6, 12),
      }
    case 'bats':
      return {
        ...base,
        shape: 'bat',
        x: -30,
        y: rand(height * 0.05, height * 0.6),
        vx: rand(1.2, 2.2),
        vy: rand(-0.3, 0.3),
        size: rand(10, 18),
      }
    case 'bubbles':
      return {
        ...base,
        shape: 'ring',
        x: rand(0, width),
        y: initial ? rand(0, height) : height + 20,
        vx: rand(-0.2, 0.2),
        vy: rand(-0.9, -0.3),
        size: rand(4, 12),
      }
    case 'petals':
      return {
        ...base,
        shape: 'petal',
        x: rand(0, width),
        y: initial ? rand(0, height) : -12,
        vx: rand(-0.5, 0.5),
        vy: rand(0.5, 1.2),
        size: rand(4, 8),
        spin: rand(-0.05, 0.05),
      }
    case 'confetti':
      return {
        ...base,
        shape: Math.random() < 0.12 ? 'cap' : 'paper',
        x: rand(width * 0.2, width * 0.8),
        y: height + 10,
        vx: rand(-3, 3),
        vy: rand(-14, -8),
        size: rand(5, 9),
        spin: rand(-0.2, 0.2),
      }
  }
}

function draw(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.angle)
  ctx.globalAlpha = Math.max(0, Math.min(1, p.life))
  ctx.fillStyle = p.color
  ctx.strokeStyle = p.color
  const s = p.size
  switch (p.shape) {
    case 'dot':
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'ring':
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(0, 0, s, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'heart':
      ctx.beginPath()
      ctx.moveTo(0, s * 0.35)
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.4, -s, 0, -s * 0.4)
      ctx.bezierCurveTo(s * 0.4, -s, s, -s * 0.3, 0, s * 0.35)
      ctx.fill()
      break
    case 'bat': {
      const flap = Math.sin(p.x / 8) * s * 0.35
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.5 - flap, -s * 1.2, -flap)
      ctx.quadraticCurveTo(-s * 0.7, s * 0.1, -s * 0.4, s * 0.25)
      ctx.lineTo(0, s * 0.15)
      ctx.lineTo(s * 0.4, s * 0.25)
      ctx.quadraticCurveTo(s * 0.7, s * 0.1, s * 1.2, -flap)
      ctx.quadraticCurveTo(s * 0.6, -s * 0.5 - flap, 0, 0)
      ctx.fill()
      break
    }
    case 'petal':
      ctx.beginPath()
      ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'paper':
      ctx.fillRect(-s / 2, -s / 4, s, s / 2)
      break
    case 'cap':
      ctx.fillStyle = '#111827'
      ctx.beginPath()
      ctx.moveTo(-s * 1.6, 0)
      ctx.lineTo(0, -s * 0.7)
      ctx.lineTo(s * 1.6, 0)
      ctx.lineTo(0, s * 0.7)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#facc15'
      ctx.fillRect(s * 0.4, 0, 1.5, s * 1.2)
      break
  }
  ctx.restore()
}

export function AmbientEffects({ kind }: { kind: Ambient }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx || !motionAllowed()) return
    let width = 0
    let height = 0
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      width = window.innerWidth
      height = window.innerHeight
      element.width = width * ratio
      element.height = height * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Confetti + caps: one burst when the board opens, then a few gold sparkles
    const burst = kind === 'confetti'
    const max =
      kind === 'bats'
        ? 4
        : burst
          ? 140
          : Math.min(60, Math.round((width * height) / 22000))
    let particles: Particle[] = Array.from({ length: max }, () =>
      spawn(kind, width, height, !burst),
    )
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      const dt = Math.min(3, (now - last) / 16.7)
      last = now
      ctx.clearRect(0, 0, width, height)
      particles = particles.flatMap((p) => {
        p.x +=
          p.vx * dt +
          (p.shape === 'dot' || p.shape === 'petal'
            ? Math.sin(p.y / 40) * 0.3
            : 0)
        p.y += p.vy * dt
        p.angle += p.spin * dt
        if (burst) {
          p.vy += 0.25 * dt // gravity
          p.vx *= 0.99
          if (p.vy > 0) p.life -= 0.006 * dt
        }
        draw(ctx, p)
        const gone =
          p.life <= 0 ||
          p.y > height + 30 ||
          p.y < -40 ||
          p.x > width + 40 ||
          p.x < -60
        if (!gone) return [p]
        // After the burst: soft gold sparkles; other kinds: a new one replaces it
        if (burst) return []
        return Math.random() < (kind === 'bats' ? 0.01 : 1)
          ? [spawn(kind, width, height, false)]
          : []
      })
      if (kind === 'bats' && particles.length < max && Math.random() < 0.004)
        particles.push(spawn(kind, width, height, false))
      if (burst && particles.length < 12 && Math.random() < 0.05)
        particles.push({
          ...spawn('snow', width, height, true),
          color: 'rgba(250,204,21,0.7)',
          size: rand(1, 2.2),
          vy: rand(-0.2, 0.2),
          life: 1.5,
        })
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [kind])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 size-full"
      data-testid="ambient"
      data-ambient={kind}
    />
  )
}
