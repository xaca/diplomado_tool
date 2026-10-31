// A short confetti burst for real milestones (M20, D58): one temporary canvas over the page,
// ~2.5 s, then removed. Own code (no package); lazy chunk; the caller checks "reduce motion".

const COLORS = [
  '#f43f5e',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#facc15',
]
const DURATION_MS = 2600

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  angle: number
  spin: number
  color: string
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

export function burst() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const ratio = Math.min(2, window.devicePixelRatio || 1)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.testid = 'confetti'
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '100',
  })
  document.body.append(canvas)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  // Two cannons in the lower corners, aimed at the middle
  const pieces: Piece[] = Array.from({ length: 120 }, (_, index) => {
    const left = index % 2 === 0
    return {
      x: left ? 0 : width,
      y: height * 0.85,
      vx: (left ? 1 : -1) * rand(4, 11),
      vy: rand(-17, -9),
      size: rand(5, 9),
      angle: rand(0, Math.PI * 2),
      spin: rand(-0.25, 0.25),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }
  })

  const start = performance.now()
  let last = start
  const tick = (now: number) => {
    const dt = Math.min(3, (now - last) / 16.7)
    last = now
    const fade = Math.max(
      0,
      1 - (now - start - DURATION_MS * 0.6) / (DURATION_MS * 0.4),
    )
    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = Math.min(1, fade)
    for (const piece of pieces) {
      piece.vy += 0.35 * dt
      piece.vx *= 0.985
      piece.x += piece.vx * dt
      piece.y += piece.vy * dt
      piece.angle += piece.spin * dt
      ctx.save()
      ctx.translate(piece.x, piece.y)
      ctx.rotate(piece.angle)
      ctx.fillStyle = piece.color
      ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2)
      ctx.restore()
    }
    if (now - start < DURATION_MS) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
