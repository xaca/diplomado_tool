import type { Accessory } from '@/features/boards/styles'

// Seasonal accessories drawn over a student's photo (M21): inline SVG, no files.

/** Where each accessory sits, as a share of the avatar size */
const PLACE: Record<
  Accessory,
  { w: number; top: number; left: number; rotate: number }
> = {
  santa: { w: 0.78, top: -0.42, left: 0.3, rotate: 18 },
  witch: { w: 0.74, top: -0.42, left: 0.24, rotate: 12 },
  grad: { w: 0.9, top: -0.36, left: 0.05, rotate: -8 },
  flowers: { w: 1, top: -0.2, left: 0, rotate: 0 },
  heart: { w: 0.42, top: -0.12, left: 0.66, rotate: 14 },
  sunglasses: { w: 0.74, top: 0.26, left: 0.13, rotate: 0 },
}

function Art({ kind }: { kind: Accessory }) {
  switch (kind) {
    case 'santa':
      return (
        <svg viewBox="0 0 64 56">
          <path d="M6 44C14 18 30 4 50 8c-4 10-2 22 4 32z" fill="#dc2626" />
          <rect x="2" y="40" width="56" height="12" rx="6" fill="#f8fafc" />
          <circle cx="54" cy="10" r="7" fill="#f8fafc" />
        </svg>
      )
    case 'witch':
      return (
        <svg viewBox="0 0 64 64">
          <path d="M14 50L38 4l12 46z" fill="#3b0764" />
          <rect x="22" y="40" width="26" height="6" fill="#fb923c" />
          <ellipse cx="32" cy="52" rx="30" ry="7" fill="#1e1b4b" />
        </svg>
      )
    case 'grad':
      return (
        <svg viewBox="0 0 64 44">
          <path d="M4 16L32 4l28 12-28 12z" fill="#111827" />
          <path d="M16 22v10c8 6 24 6 32 0V22l-16 7z" fill="#1f2937" />
          <path
            d="M32 16l18 6v14"
            stroke="#facc15"
            strokeWidth="2.5"
            fill="none"
          />
          <circle cx="50" cy="38" r="3" fill="#facc15" />
        </svg>
      )
    case 'flowers':
      return (
        <svg viewBox="0 0 80 24">
          {[
            '#db2777',
            '#f59e0b',
            '#7c3aed',
            '#16a34a',
            '#ef4444',
            '#0ea5e9',
          ].map((color, index) => (
            <g
              key={color}
              transform={`translate(${7 + index * 13} ${12 + (index % 2 ? 3 : -2)})`}
            >
              <circle r="5.5" fill={color} />
              <circle r="2" fill="#fef08a" />
            </g>
          ))}
        </svg>
      )
    case 'heart':
      return (
        <svg viewBox="0 0 32 30">
          <path
            d="M16 28C6 20 2 15 2 9a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 6-4 11-14 19z"
            fill="#e11d48"
            stroke="#fff"
            strokeWidth="2"
          />
        </svg>
      )
    case 'sunglasses':
      return (
        <svg viewBox="0 0 64 22">
          <path d="M2 4h60" stroke="#111827" strokeWidth="3" />
          <rect x="4" y="4" width="24" height="15" rx="6" fill="#111827" />
          <rect x="36" y="4" width="24" height="15" rx="6" fill="#111827" />
          <path d="M9 8l6 0" stroke="#fff" strokeOpacity=".5" strokeWidth="2" />
        </svg>
      )
  }
}

/** The accessory over an avatar of `size` px. */
export function AccessoryArt({
  kind,
  size,
}: {
  kind: Accessory
  size: number
}) {
  const place = PLACE[kind]
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-10 [&_svg]:size-full"
      style={{
        width: size * place.w,
        top: size * place.top,
        left: size * place.left,
        transform: `rotate(${place.rotate}deg)`,
      }}
      data-accessory={kind}
    >
      <Art kind={kind} />
    </span>
  )
}
