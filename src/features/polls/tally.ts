import type { PollDoc } from '@/model'

// Poll results (M16). Pure, unit-tested.

/** The new counts after a student votes `next` (and had voted `previous`, if any). */
export function countsAfterVote(
  counts: Record<string, number>,
  previous: string | null,
  next: string,
) {
  if (previous === next) return counts
  const updated = { ...counts, [next]: (counts[next] ?? 0) + 1 }
  if (previous) updated[previous] = Math.max(0, (counts[previous] ?? 0) - 1)
  return updated
}

export function results(poll: Pick<PollDoc, 'options' | 'counts'>) {
  const total = poll.options.reduce(
    (sum, option) => sum + (poll.counts[option.id] ?? 0),
    0,
  )
  return {
    total,
    options: poll.options.map((option) => {
      const votes = poll.counts[option.id] ?? 0
      return {
        ...option,
        votes,
        percent: total ? Math.round((votes / total) * 100) : 0,
      }
    }),
  }
}
