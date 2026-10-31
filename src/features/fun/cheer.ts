import type { Milestone, UserDoc } from '@/model'

// Encouraging messages (M20, D56–D57): what to say, when to throw confetti, and which moments
// only happen once. Pure; the toast and the confetti live in use-cheer.ts.

export type CheerEvent =
  | 'firstSlide'
  | 'slides'
  | 'ready'
  | 'stage'
  | 'photo'
  | 'firstVote'
  | 'firstEmbed'
  | 'teacherNote'
  | 'teacherEdit'

export const CHEER_EMOJI: Record<CheerEvent, string> = {
  firstSlide: '🎉',
  slides: '📚',
  ready: '🙌',
  stage: '🚀',
  photo: '📸',
  firstVote: '🗳️',
  firstEmbed: '✨',
  teacherNote: '💬',
  teacherEdit: '✍️',
}

/** Moments that happen once per person (stored in users/{uid}.milestones) */
const ONCE: Partial<Record<CheerEvent, Milestone>> = {
  firstSlide: 'firstSlide',
  photo: 'photo',
  firstVote: 'firstVote',
  firstEmbed: 'firstEmbed',
}

/** Real milestones get a confetti burst; everything else is a toast */
const CELEBRATED: readonly CheerEvent[] = ['firstSlide', 'ready', 'stage']

/** At most one burst every 30 s, and the same message not twice in 30 s (toggling) */
export const CHEER_GAP_MS = 30_000

/** Each moment has three phrasings (fun.<event>.a|b|c in the locales) */
export const VARIANTS = ['a', 'b', 'c'] as const
export type Variant = (typeof VARIANTS)[number]

export type CheerMemory = {
  lastBurst: number | null
  lastShown: Partial<Record<CheerEvent, number>>
}

export const freshMemory = (): CheerMemory => ({
  lastBurst: null,
  lastShown: {},
})

export type CheerDecision = {
  /** Throw confetti */
  burst: boolean
  /** Store this once-only moment */
  milestone: Milestone | null
}

/** Messages on unless the person turned them off on /me */
export const cheerOn = (profile: Pick<UserDoc, 'cheer'> | null | undefined) =>
  profile?.cheer !== false

/** null = say nothing (switched off, already celebrated, or said a moment ago) */
export function decideCheer(
  event: CheerEvent,
  {
    enabled,
    milestones,
    memory,
    now,
  }: {
    enabled: boolean
    milestones: UserDoc['milestones'] | undefined
    memory: CheerMemory
    now: number
  },
): CheerDecision | null {
  if (!enabled) return null
  const milestone = ONCE[event] ?? null
  if (milestone && milestones?.[milestone]) return null
  const last = memory.lastShown[event]
  if (last != null && now - last < CHEER_GAP_MS) return null
  const burst =
    CELEBRATED.includes(event) &&
    (memory.lastBurst == null || now - memory.lastBurst >= CHEER_GAP_MS)
  return { burst, milestone }
}

export function remember(
  memory: CheerMemory,
  event: CheerEvent,
  decision: CheerDecision,
  now: number,
): CheerMemory {
  return {
    lastBurst: decision.burst ? now : memory.lastBurst,
    lastShown: { ...memory.lastShown, [event]: now },
  }
}

/** A new slide: the first one, then every 5 (5, 10, 15…) */
export function slideEvent(count: number): CheerEvent | null {
  if (count === 1) return 'firstSlide'
  return count > 0 && count % 5 === 0 ? 'slides' : null
}

export const pickVariant = (random = Math.random()): Variant =>
  VARIANTS[Math.min(VARIANTS.length - 1, Math.floor(random * VARIANTS.length))]

/** Teacher's notes newer than what I saw last time; nothing on the very first visit. */
export function newNotes(
  noteTimes: readonly number[],
  seenUntil: number | null,
): number {
  if (seenUntil == null) return 0
  return noteTimes.filter((time) => time > seenUntil).length
}
