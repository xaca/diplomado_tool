import type { SpaceDoc } from '@/model'

// "Listos para presentar" (M16, F21). Pure, unit-tested.

export type ReadyFilter = 'ready' | 'withSlides' | 'noSlides'
export const READY_FILTERS: ReadyFilter[] = ['ready', 'withSlides', 'noSlides']

type Card = Pick<SpaceDoc, 'readyToPresent' | 'slideCount'>

export function matchesReady(space: Card, filter: ReadyFilter | null) {
  if (filter === 'ready') return !!space.readyToPresent && space.slideCount > 0
  if (filter === 'withSlides') return space.slideCount > 0
  if (filter === 'noSlides') return space.slideCount === 0
  return true
}

export function readyCounts(spaces: readonly Card[]) {
  return Object.fromEntries(
    READY_FILTERS.map((filter) => [
      filter,
      spaces.filter((space) => matchesReady(space, filter)).length,
    ]),
  ) as Record<ReadyFilter, number>
}
