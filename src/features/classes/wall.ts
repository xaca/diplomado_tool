import {
  MAX_NOTES_PER_PERSON,
  REACTIONS,
  type ClassLayout,
  type NoteReactions,
  type Reaction,
} from '@/model'

// The sticky-note wall (M10): geometry, tidying, reactions and note ids. Pure; positions are
// shares of the 16:9 wall (0–1), so a note sits in the same place on every screen.

/** A note's size as a share of the wall */
export const NOTE_W = 0.13
export const NOTE_H = 0.2
/** Room for the column / quadrant titles at the top of each zone */
export const TITLE_BAND = 0.08
const GAP = 0.012

export type Rect = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }
type Placed = Point & { id: string }

/** The wall's zones: one (Libre), 2 or 3 columns, or a 2×2 matrix */
export function zonesOf(layout: ClassLayout): Rect[] {
  switch (layout) {
    case 'free':
      return [{ x: 0, y: 0, w: 1, h: 1 }]
    case 'columns2':
      return [0, 1].map((i) => ({ x: i / 2, y: 0, w: 1 / 2, h: 1 }))
    case 'columns3':
      return [0, 1, 2].map((i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 1 }))
    case 'matrix':
      return [0, 1, 2, 3].map((i) => ({
        x: (i % 2) / 2,
        y: Math.floor(i / 2) / 2,
        w: 1 / 2,
        h: 1 / 2,
      }))
  }
}

const round = (value: number) => Math.round(value * 10_000) / 10_000

/** Keeps a note inside the wall */
export function clampPosition({ x, y }: Point): Point {
  return {
    x: round(Math.min(1 - NOTE_W, Math.max(0, x))),
    y: round(Math.min(1 - NOTE_H, Math.max(0, y))),
  }
}

/** Which zone a note belongs to (by its center) */
export function zoneAt(layout: ClassLayout, { x, y }: Point) {
  const cx = x + NOTE_W / 2
  const cy = y + NOTE_H / 2
  const zones = zonesOf(layout)
  const index = zones.findIndex(
    (zone) =>
      cx >= zone.x &&
      cx < zone.x + zone.w + 1e-9 &&
      cy >= zone.y &&
      cy < zone.y + zone.h + 1e-9,
  )
  return Math.max(0, index)
}

const overlaps = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < NOTE_W * 0.6 && Math.abs(a.y - b.y) < NOTE_H * 0.6

/** Grid slots inside a zone, left to right, top to bottom */
function slotsIn(zone: Rect, titled: boolean): Point[] {
  const top = zone.y + (titled ? TITLE_BAND : GAP)
  const cols = Math.max(1, Math.floor((zone.w - GAP) / (NOTE_W + GAP)))
  const rows = Math.max(1, Math.floor((zone.y + zone.h - top) / (NOTE_H + GAP)))
  const slots: Point[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      slots.push(
        clampPosition({
          x: zone.x + GAP + col * (NOTE_W + GAP),
          y: top + row * (NOTE_H + GAP),
        }),
      )
  return slots
}

/** Where "+ Nota" puts a new note: the first free slot of the zone, else a nudge off its corner */
export function freeSpot(
  layout: ClassLayout,
  notes: readonly Point[],
  zone = 0,
): Point {
  const rect = zonesOf(layout)[zone] ?? zonesOf(layout)[0]
  const slots = slotsIn(rect, layout !== 'free')
  const free = slots.find((slot) => !notes.some((note) => overlaps(slot, note)))
  return free ?? nudge(slots[0], notes)
}

/** Moves a point a little until it doesn't sit exactly on another note */
export function nudge(point: Point, notes: readonly Point[]): Point {
  let next = clampPosition(point)
  for (let step = 0; step < 12; step++) {
    const taken = notes.some(
      (note) =>
        Math.abs(note.x - next.x) < 0.015 && Math.abs(note.y - next.y) < 0.02,
    )
    if (!taken) return next
    next = clampPosition({ x: next.x + 0.02, y: next.y + 0.03 })
  }
  return next
}

/**
 * "Ordenar": every note into a neat grid in its own zone, oldest first. When a zone is full the
 * rest stack slightly offset over the last slots. Returns only the notes that move.
 */
export function tidy(
  layout: ClassLayout,
  notes: readonly Placed[],
): Map<string, Point> {
  const zones = zonesOf(layout)
  const byZone = zones.map(() => [] as Placed[])
  for (const note of notes) byZone[zoneAt(layout, note)].push(note)
  const moves = new Map<string, Point>()
  byZone.forEach((group, index) => {
    const slots = slotsIn(zones[index], layout !== 'free')
    group.forEach((note, order) => {
      const lap = Math.floor(order / slots.length)
      const slot = slots[order % slots.length]
      const target = clampPosition({
        x: slot.x + lap * 0.012,
        y: slot.y + lap * 0.02,
      })
      if (target.x !== note.x || target.y !== note.y) moves.set(note.id, target)
    })
  })
  return moves
}

/** The order of the "Lista" view: by zone, then top to bottom, left to right */
export function listOrder<T extends Point>(layout: ClassLayout, notes: T[]) {
  return [...notes].sort(
    (a, b) => zoneAt(layout, a) - zoneAt(layout, b) || a.y - b.y || a.x - b.x,
  )
}

// ---------- reactions (D81) ----------

/** My entry after tapping an emoji: added or removed; null = I have none left */
export function toggleReaction(
  reactions: NoteReactions | undefined,
  uid: string,
  name: string,
  emoji: Reaction,
): { name: string; emojis: Reaction[] } | null {
  const mine = reactions?.[uid]?.emojis ?? []
  const emojis = mine.includes(emoji)
    ? mine.filter((item) => item !== emoji)
    : REACTIONS.filter((item) => item === emoji || mine.includes(item))
  return emojis.length ? { name, emojis } : null
}

export type ReactionCount = {
  emoji: Reaction
  count: number
  names: string[]
  mine: boolean
}

/** Counts per emoji (in the fixed order), with who reacted */
export function reactionCounts(
  reactions: NoteReactions | undefined,
  uid: string | undefined,
): ReactionCount[] {
  const entries = Object.entries(reactions ?? {})
  return REACTIONS.map((emoji) => {
    const who = entries.filter(([, entry]) => entry.emojis.includes(emoji))
    return {
      emoji,
      count: who.length,
      names: who.map(([, entry]) => entry.name).sort(),
      mine: who.some(([id]) => id === uid),
    }
  }).filter((item) => item.count > 0)
}

export const totalReactions = (reactions: NoteReactions | undefined) =>
  Object.values(reactions ?? {}).reduce(
    (sum, entry) => sum + entry.emojis.length,
    0,
  )

// ---------- ids and following the teacher ----------

/** My next note id on a slide (`{uid}_{1..20}`, matching the rules); null = I have 20 */
export function nextNoteId(uid: string, existingIds: Iterable<string>) {
  const taken = new Set(existingIds)
  for (let n = 1; n <= MAX_NOTES_PER_PERSON; n++)
    if (!taken.has(`${uid}_${n}`)) return `${uid}_${n}`
  return null
}

/**
 * The slide a student sees. With "Seguir al docente" on, the teacher's slide, unless the student
 * stepped away from that very slide (they follow again when the teacher moves on).
 */
export function visibleSlide({
  order,
  chosen,
  follow,
  liveSlideId,
  leftLive,
}: {
  order: readonly string[]
  chosen: string | null
  follow: boolean
  liveSlideId: string | null
  /** The live slide the student stepped away from */
  leftLive: string | null
}): string | null {
  const live = follow && liveSlideId && order.includes(liveSlideId)
  if (live && leftLive !== liveSlideId) return liveSlideId
  if (chosen && order.includes(chosen)) return chosen
  return order[0] ?? null
}
