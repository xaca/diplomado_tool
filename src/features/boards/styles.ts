import type { CSSProperties } from 'react'
import { backgroundOf, boardStyle } from '@/features/boards/look'
import type { BoardLook, BoardStyleId } from '@/model'

// Board styles (M21, PLAN.md → M21): a whole look in one click, chosen by the teacher (D74).
// Pure data + helpers, unit-tested (every style keeps its text readable). Patterns are tiny
// inline SVGs: no image files, nothing downloaded.

export type Ambient =
  'snow' | 'hearts' | 'bats' | 'bubbles' | 'petals' | 'confetti'
export type Accessory =
  'santa' | 'heart' | 'witch' | 'sunglasses' | 'flowers' | 'grad'
export type Garland = 'lights' | 'hearts' | 'flowers' | 'laurel'

export type BoardStyle = {
  id: BoardStyleId
  kind: 'everyday' | 'seasonal'
  /** Background color(s); several = a gradient */
  stops: readonly string[]
  /** The text that stays readable on every stop (checked in tests) */
  text: 'dark' | 'light'
  pattern: { image: string; size: string } | null
  /** A thin line on top of each card */
  accent: string
  /** Picker icon */
  emoji: string
  garland?: Garland
  ambient?: Ambient
  accessory?: Accessory
}

const svg = (body: string, size: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`,
  )}")`

const pattern = (body: string, size: number) => ({
  image: svg(body, size),
  size: `${size}px ${size}px`,
})

export const BOARD_STYLE_LIST: readonly BoardStyle[] = [
  // ---------- everyday ----------
  {
    id: 'pizarra',
    kind: 'everyday',
    stops: ['#1f3b2d'],
    text: 'light',
    accent: '#d9f99d',
    emoji: '🧑‍🏫',
    pattern: pattern(
      "<g fill='none' stroke='#ffffff' stroke-opacity='.06' stroke-width='2' stroke-linecap='round'><path d='M8 20q12-6 24 0'/><path d='M50 64q10 5 22-2'/><path d='M14 88h10'/></g>",
      96,
    ),
  },
  {
    id: 'cuaderno',
    kind: 'everyday',
    stops: ['#fbfbf6'],
    text: 'dark',
    accent: '#93c5fd',
    emoji: '📓',
    pattern: pattern(
      "<path d='M0 27.5h28' stroke='#93c5fd' stroke-opacity='.55'/>",
      28,
    ),
  },
  {
    id: 'kraft',
    kind: 'everyday',
    stops: ['#d6b98c'],
    text: 'dark',
    accent: '#7c4a1e',
    emoji: '📦',
    pattern: pattern(
      "<g stroke='#7c4a1e' stroke-opacity='.12' stroke-linecap='round'><path d='M6 10l9 3'/><path d='M40 30l-7 5'/><path d='M22 48l10-2'/><path d='M50 8l4 7'/></g>",
      60,
    ),
  },
  {
    id: 'neon',
    kind: 'everyday',
    stops: ['#0b0b1a'],
    text: 'light',
    accent: '#f0abfc',
    emoji: '💜',
    pattern: pattern(
      "<path d='M0 .5h32M.5 0v32' stroke='#22d3ee' stroke-opacity='.18'/><circle cx='16' cy='16' r='1' fill='#f0abfc' fill-opacity='.35'/>",
      32,
    ),
  },
  {
    id: 'minimal',
    kind: 'everyday',
    stops: ['#fafafa'],
    text: 'dark',
    accent: '#d4d4d4',
    emoji: '⚪',
    pattern: null,
  },
  {
    id: 'retro',
    kind: 'everyday',
    stops: ['#f6e7c8'],
    text: 'dark',
    accent: '#ea580c',
    emoji: '📻',
    pattern: pattern(
      "<path d='M-8 40L40-8M8 56L56 8' stroke='#ea580c' stroke-opacity='.1' stroke-width='6'/>",
      48,
    ),
  },
  {
    id: 'acuarela',
    kind: 'everyday',
    stops: ['#fbe4ec', '#e0f2fe', '#ecfccb'],
    text: 'dark',
    accent: '#f9a8d4',
    emoji: '🎨',
    pattern: pattern(
      "<g fill-opacity='.18'><circle cx='30' cy='34' r='22' fill='#f9a8d4'/><circle cx='110' cy='96' r='28' fill='#7dd3fc'/><circle cx='70' cy='130' r='16' fill='#bef264'/></g>",
      160,
    ),
  },
  {
    id: 'blueprint',
    kind: 'everyday',
    stops: ['#1d4e89'],
    text: 'light',
    accent: '#bfdbfe',
    emoji: '📐',
    pattern: pattern(
      "<path d='M0 .5h40M.5 0v40' stroke='#ffffff' stroke-opacity='.16'/><path d='M0 20.5h40M20.5 0v40' stroke='#ffffff' stroke-opacity='.07'/>",
      40,
    ),
  },
  // ---------- seasonal (Colombia) ----------
  {
    id: 'navidad',
    kind: 'seasonal',
    stops: ['#14532d', '#7f1d1d'],
    text: 'light',
    accent: '#fbbf24',
    emoji: '🎄',
    garland: 'lights',
    ambient: 'snow',
    accessory: 'santa',
    pattern: pattern(
      "<g fill-opacity='.14'><path d='M20 8l9 14h-5l7 11H9l7-11h-5z' fill='#bbf7d0'/><circle cx='62' cy='52' r='4' fill='#fde68a'/><circle cx='44' cy='70' r='3' fill='#fecaca'/><path d='M70 14l2 5 5 .5-4 3.5 1 5-4-3-4 3 1-5-4-3.5 5-.5z' fill='#fde68a'/></g>",
      84,
    ),
  },
  {
    id: 'amigo-secreto',
    kind: 'seasonal',
    stops: ['#fce7f3', '#fecdd3'],
    text: 'dark',
    accent: '#e11d48',
    emoji: '🎁',
    garland: 'hearts',
    ambient: 'hearts',
    accessory: 'heart',
    pattern: pattern(
      "<g fill-opacity='.16'><path d='M18 30c-8-6-12-10-12-15a6 6 0 0 1 12-1 6 6 0 0 1 12 1c0 5-4 9-12 15z' fill='#e11d48'/><rect x='46' y='46' width='18' height='14' rx='2' fill='#be185d'/><path d='M55 46v14M46 52h18' stroke='#fff' stroke-width='2'/></g>",
      80,
    ),
  },
  {
    id: 'halloween',
    kind: 'seasonal',
    stops: ['#1e1b4b', '#3b0764'],
    text: 'light',
    accent: '#fb923c',
    emoji: '🎃',
    ambient: 'bats',
    accessory: 'witch',
    pattern: pattern(
      "<g fill-opacity='.16'><ellipse cx='22' cy='26' rx='12' ry='10' fill='#fb923c'/><path d='M22 14v-4' stroke='#86efac' stroke-width='2'/><circle cx='70' cy='64' r='9' fill='#fef9c3'/><circle cx='74' cy='60' r='8' fill='#1e1b4b'/></g>",
      90,
    ),
  },
  {
    id: 'verano',
    kind: 'seasonal',
    stops: ['#fef3c7', '#a5f3fc'],
    text: 'dark',
    accent: '#0891b2',
    emoji: '🏖️',
    ambient: 'bubbles',
    accessory: 'sunglasses',
    pattern: pattern(
      "<g fill-opacity='.2'><circle cx='20' cy='20' r='8' fill='#f59e0b'/><path d='M66 70q-2-14 4-24M70 46q-10-4-16 2M70 46q10-6 16 0M70 46q-4 8-12 10' stroke='#15803d' stroke-width='3' fill='none' stroke-opacity='.4'/></g>",
      96,
    ),
  },
  {
    id: 'flores',
    kind: 'seasonal',
    stops: ['#fef08a', '#fbcfe8', '#bbf7d0'],
    text: 'dark',
    accent: '#db2777',
    emoji: '🌺',
    garland: 'flowers',
    ambient: 'petals',
    accessory: 'flowers',
    pattern: pattern(
      "<g fill-opacity='.22'><g fill='#db2777'><circle cx='20' cy='14' r='5'/><circle cx='26' cy='20' r='5'/><circle cx='20' cy='26' r='5'/><circle cx='14' cy='20' r='5'/></g><circle cx='20' cy='20' r='3' fill='#f59e0b'/><g fill='#7c3aed'><circle cx='62' cy='56' r='4'/><circle cx='67' cy='61' r='4'/><circle cx='62' cy='66' r='4'/><circle cx='57' cy='61' r='4'/></g></g>",
      84,
    ),
  },
  {
    id: 'graduacion',
    kind: 'seasonal',
    stops: ['#0f1e3d', '#1e3a8a'],
    text: 'light',
    accent: '#facc15',
    emoji: '🎓',
    garland: 'laurel',
    ambient: 'confetti',
    accessory: 'grad',
    pattern: pattern(
      "<g fill='#facc15' fill-opacity='.14'><path d='M20 10l2.5 6 6.5.5-5 4 1.5 6.5L20 23l-5.5 4 1.5-6.5-5-4 6.5-.5z'/><path d='M60 58l18 6-18 6-18-6z'/></g>",
      90,
    ),
  },
]

export function findBoardStyle(id: BoardStyleId | null | undefined) {
  return BOARD_STYLE_LIST.find((style) => style.id === id) ?? null
}

/** The style shown on `today` (YYYY-MM-DD): the dated one inside its dates, else the chosen one. */
export function activeStyleId(
  look: Pick<BoardLook, 'style' | 'schedule'>,
  today: string,
): BoardStyleId | null {
  const { schedule } = look
  if (schedule && schedule.from <= today && today <= schedule.to)
    return schedule.style
  return look.style
}

/**
 * Everything the board page needs from its look: the style (if any), the text tone, the sticky
 * header's backdrop and the page CSS (the style's, else the background + pattern as chosen).
 */
export function boardTheme(look: BoardLook, today: string) {
  const style = findBoardStyle(activeStyleId(look, today))
  if (!style) {
    const preset = backgroundOf(look)
    return {
      style: null,
      tone: preset.text,
      backdrop: preset.stops[0] as string,
      css: boardStyle(look),
    }
  }
  const gradient =
    style.stops.length > 1
      ? `linear-gradient(160deg, ${style.stops.join(', ')})`
      : null
  const images = [
    ...(style.pattern ? [style.pattern.image] : []),
    ...(gradient ? [gradient] : []),
  ]
  const css: CSSProperties = {
    backgroundColor: style.stops[0],
    backgroundImage: images.length ? images.join(', ') : undefined,
    backgroundSize: [
      ...(style.pattern ? [style.pattern.size] : []),
      ...(gradient ? ['100% 100%'] : []),
    ].join(', '),
    backgroundAttachment: gradient ? 'fixed' : undefined,
    ['--card-accent' as string]: style.accent,
  }
  return { style, tone: style.text, backdrop: style.stops[0], css }
}

/** Styles with their own line next to the title (es / en: styles.taglines.<id>) */
export const TAGLINE_STYLES = [
  'navidad',
  'amigo-secreto',
  'halloween',
  'verano',
  'flores',
  'graduacion',
] as const satisfies readonly BoardStyleId[]
export type TaglineStyle = (typeof TAGLINE_STYLES)[number]

export function hasTagline(
  id: BoardStyleId | null | undefined,
): id is TaglineStyle {
  return TAGLINE_STYLES.includes(id as TaglineStyle)
}
