import type { SpaceDoc, WorkStatus } from '@/model'

// "Listos para presentar" (M16, F21) and "En progreso / Listo" (M27, D132). Pure, unit-tested.

export type ReadyFilter =
  'ready' | 'wip' | 'unmarked' | 'withSlides' | 'noSlides'
export const READY_FILTERS: ReadyFilter[] = [
  'ready',
  'wip',
  'unmarked',
  'withSlides',
  'noSlides',
]

type Card = Pick<SpaceDoc, 'readyToPresent' | 'slideCount' | 'workStatus'>

/** En progreso / Listo / not marked; spaces from before M27 with the M16 flag read as Listo */
export function statusOf(
  space: Pick<SpaceDoc, 'readyToPresent' | 'workStatus'>,
): WorkStatus | null {
  if (space.workStatus === 'ready' || space.workStatus === 'wip')
    return space.workStatus
  return space.readyToPresent ? 'ready' : null
}

export function matchesReady(space: Card, filter: ReadyFilter | null) {
  if (filter === 'ready')
    return statusOf(space) === 'ready' && space.slideCount > 0
  if (filter === 'wip') return statusOf(space) === 'wip'
  if (filter === 'unmarked') return statusOf(space) === null
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

/**
 * D133: a student marked "Listo" changed a slide → ask once per editing session whether they're
 * back to "En progreso". Never for the teacher's changes.
 */
export function shouldAskBackToWip(
  status: WorkStatus | null,
  editor: 'student' | 'teacher',
  alreadyAsked: boolean,
) {
  return status === 'ready' && editor === 'student' && !alreadyAsked
}
