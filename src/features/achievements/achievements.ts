import type {
  AchievementKey,
  AchievementsDoc,
  SpaceDoc,
  StageDef,
  UserDoc,
} from '@/model'
import { ACHIEVEMENTS } from '@/model'

// Achievements (M22, D84–D86): what each one is, which are already true from a student's work,
// and the counters. Pure. Not a competition (D56): no points, no totals per student, no ranking.

export type AchievementGroup = 'project' | 'dt' | 'participation'

export const ACHIEVEMENT_INFO: Record<
  AchievementKey,
  { group: AchievementGroup; emoji: string; color: string; big?: boolean }
> = {
  firstSlide: { group: 'project', emoji: '🖼️', color: '#f59e0b', big: true },
  slides5: { group: 'project', emoji: '📚', color: '#f97316' },
  slides10: { group: 'project', emoji: '🏗️', color: '#ea580c' },
  firstEmbed: { group: 'project', emoji: '✨', color: '#a855f7' },
  ready: { group: 'project', emoji: '🙌', color: '#16a34a', big: true },
  photo: { group: 'project', emoji: '📸', color: '#0ea5e9' },
  firstStage: { group: 'dt', emoji: '🧭', color: '#e11d48' },
  prototype: { group: 'dt', emoji: '🛠️', color: '#16a34a', big: true },
  test: { group: 'dt', emoji: '🧪', color: '#2563eb', big: true },
  firstVote: { group: 'participation', emoji: '🗳️', color: '#64748b' },
  firstNote: { group: 'participation', emoji: '📝', color: '#ca8a04' },
  firstReaction: { group: 'participation', emoji: '💬', color: '#db2777' },
  popularNote: {
    group: 'participation',
    emoji: '🌟',
    color: '#eab308',
    big: true,
  },
  classes3: { group: 'participation', emoji: '🔁', color: '#0d9488' },
}

export const GROUPS: AchievementGroup[] = ['project', 'dt', 'participation']

export const byGroup = (group: AchievementGroup) =>
  ACHIEVEMENTS.filter((key) => ACHIEVEMENT_INFO[key].group === group)

/** Reactions a note needs for "Nota destacada", and classes for "Constante" */
export const POPULAR_REACTIONS = 5
export const STEADY_CLASSES = 3

/** Has this stage (or a later one in the board's order) been reached? */
function reached(
  stages: StageDef[],
  current: string | null | undefined,
  id: string,
) {
  const target = stages.findIndex((stage) => stage.id === id)
  const now = stages.findIndex((stage) => stage.id === current)
  // "Vitrineando" sits at the end of the list but is not a stage reached
  return target >= 0 && now >= target && stages[now].kind === 'stage'
}

/**
 * What's already true from my card and profile (D86: work done before this feature counts).
 * Votes, embeds, notes and reactions only unlock when they happen.
 */
export function derivedAchievements({
  space,
  stages,
  profile,
}: {
  space: Pick<SpaceDoc, 'slideCount' | 'readyToPresent' | 'stage'> | null
  stages: StageDef[]
  profile: Pick<UserDoc, 'photoSource' | 'avatar'> | null
}): AchievementKey[] {
  const keys: AchievementKey[] = []
  if (space) {
    if (space.slideCount >= 1) keys.push('firstSlide')
    if (space.slideCount >= 5) keys.push('slides5')
    if (space.slideCount >= 10) keys.push('slides10')
    if (space.readyToPresent) keys.push('ready')
    const stage = stages.find((item) => item.id === space.stage)
    if (stage?.kind === 'stage') keys.push('firstStage')
    if (reached(stages, space.stage, 'prototype')) keys.push('prototype')
    if (reached(stages, space.stage, 'test')) keys.push('test')
  }
  if (profile?.photoSource === 'upload' && profile.avatar) keys.push('photo')
  return keys
}

/** The ones I don't have yet, in the list's order */
export function missing(
  unlocked: AchievementsDoc['unlocked'] | undefined,
  keys: readonly AchievementKey[],
) {
  return ACHIEVEMENTS.filter((key) => keys.includes(key) && !unlocked?.[key])
}

export function unlockedCount(
  unlocked: AchievementsDoc['unlocked'] | undefined,
) {
  return ACHIEVEMENTS.filter((key) => unlocked?.[key]).length
}

/** "12 de 18": never more than the students on the board, never negative */
export function share(count: number | undefined, total: number) {
  const value = Math.max(0, Math.min(count ?? 0, total))
  return {
    count: value,
    total,
    percent: total ? Math.round((value / total) * 100) : 0,
  }
}

/** "Constante": the classes I wrote notes in, with this one */
export function withClass(
  classes: readonly string[] | undefined,
  classId: string,
) {
  const list = classes ?? []
  return list.includes(classId) ? null : [...list, classId].slice(-20)
}
