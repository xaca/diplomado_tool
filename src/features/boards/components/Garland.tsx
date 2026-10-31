import type { Garland as GarlandKind } from '@/features/boards/styles'

const BULBS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#f472b6']
const FLOWERS = [
  '#db2777',
  '#f59e0b',
  '#7c3aed',
  '#16a34a',
  '#ef4444',
  '#0ea5e9',
]

/**
 * A decoration along the top of the board header (M21): Christmas lights that twinkle, hearts,
 * flowers or laurel. Purely decorative; the twinkle stops with "reduce motion" (index.css).
 */
export function Garland({ kind }: { kind: GarlandKind }) {
  const count = 28
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${count * 40} 26`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0 h-5 w-full"
      data-testid="garland"
      data-garland={kind}
    >
      {kind === 'lights' && (
        <path
          d={`M0 4 ${Array.from({ length: count }, (_, i) => `Q${i * 40 + 20} 16 ${i * 40 + 40} 4`).join(' ')}`}
          stroke="#14532d"
          strokeWidth="2"
          fill="none"
        />
      )}
      {kind === 'laurel' && (
        <path
          d={`M0 6H${count * 40}`}
          stroke="#facc15"
          strokeOpacity=".6"
          strokeWidth="1.5"
        />
      )}
      {Array.from({ length: count }, (_, i) => {
        const x = i * 40 + 20
        switch (kind) {
          case 'lights':
            return (
              <ellipse
                key={i}
                cx={x}
                cy={15}
                rx={4.5}
                ry={6.5}
                fill={BULBS[i % BULBS.length]}
                className="garland-twinkle"
                style={{ animationDelay: `${(i % 5) * 0.35}s` }}
              />
            )
          case 'hearts':
            return (
              <path
                key={i}
                transform={`translate(${x} 13) scale(.55)`}
                d="M0 10C-10 2-12-4-8-8a6 6 0 0 1 8 0 6 6 0 0 1 8 0c4 4 2 10-8 18z"
                fill={i % 2 ? '#f43f5e' : '#ec4899'}
              />
            )
          case 'flowers':
            return (
              <g key={i} transform={`translate(${x} 12)`}>
                <circle r="7" fill={FLOWERS[i % FLOWERS.length]} />
                <circle r="2.5" fill="#fef08a" />
              </g>
            )
          case 'laurel':
            return (
              <g
                key={i}
                transform={`translate(${x} 7)`}
                fill="#facc15"
                fillOpacity=".75"
              >
                <ellipse
                  cx={-6}
                  cy={5}
                  rx={5}
                  ry={2.2}
                  transform="rotate(30 -6 5)"
                />
                <ellipse
                  cx={6}
                  cy={5}
                  rx={5}
                  ry={2.2}
                  transform="rotate(-30 6 5)"
                />
              </g>
            )
        }
      })}
    </svg>
  )
}
