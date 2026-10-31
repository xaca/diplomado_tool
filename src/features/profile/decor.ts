import type { CardBanner } from '@/model'

// Card banners (M21, F29): a strip at the top of a student's card and space page. Pure CSS.

export const BANNER_CSS: Record<CardBanner, string> = {
  sunrise: 'linear-gradient(90deg, #fde68a, #fca5a5)',
  lagoon: 'linear-gradient(90deg, #a5f3fc, #818cf8)',
  mint: 'linear-gradient(90deg, #bbf7d0, #5eead4)',
  grape: 'linear-gradient(90deg, #c4b5fd, #f0abfc)',
  coral: '#fb7185',
  gold: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
  sky: '#7dd3fc',
  rose: '#f9a8d4',
  forest: 'linear-gradient(90deg, #22c55e, #15803d)',
  night: 'linear-gradient(90deg, #1e293b, #6d28d9)',
  confetti:
    'radial-gradient(circle at 20% 40%, #f472b6 2px, transparent 3px) 0 0 / 18px 18px, radial-gradient(circle at 70% 60%, #60a5fa 2px, transparent 3px) 0 0 / 22px 22px, #fef3c7',
  waves: 'repeating-linear-gradient(135deg, #bae6fd 0 8px, #e0f2fe 8px 16px)',
}

/** Fun suggestions for the profile message (D70); anyone can write their own. */
export const STATUS_SUGGESTIONS = [
  { emoji: '🎃', key: 'halloween' },
  { emoji: '💪', key: 'neverQuit' },
  { emoji: '🛠', key: 'prototyping' },
  { emoji: '☕', key: 'coffee' },
  { emoji: '🎧', key: 'focus' },
  { emoji: '🚀', key: 'launch' },
  { emoji: '🎄', key: 'christmas' },
  { emoji: '🎓', key: 'graduating' },
] as const

/** Emojis to start a message with (any emoji typed in the text works too). */
export const STATUS_EMOJIS = [
  '😀',
  '😎',
  '🤓',
  '🥳',
  '😴',
  '🤯',
  '💪',
  '🔥',
  '✨',
  '🎃',
  '🎄',
  '🎓',
  '☕',
  '🎧',
  '🛠',
  '🚀',
] as const
