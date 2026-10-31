import {
  achievementRef,
  achievementsCollection,
  countsRef,
} from '@/features/achievements/api'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import type { AchievementCountsDoc, AchievementsDoc } from '@/model'

/** My achievements on this board (members only). */
export function useMyAchievements(
  boardId: string | undefined,
  uid: string | undefined,
) {
  return useLiveDoc<AchievementsDoc>(
    boardId && uid ? achievementRef(boardId, uid) : null,
    `achievements:${boardId}:${uid}`,
  )
}

/** How many unlocked each one (members and the teacher). */
export function useAchievementCounts(boardId: string | undefined) {
  return useLiveDoc<AchievementCountsDoc>(
    boardId ? countsRef(boardId) : null,
    `achievementCounts:${boardId}`,
  )
}

/** Everybody's achievements (the board's teacher only: who unlocked what). */
export function useAllAchievements(
  boardId: string | undefined,
  enabled: boolean,
) {
  return useLiveQuery<AchievementsDoc>(
    enabled && boardId ? achievementsCollection(boardId) : null,
    `allAchievements:${boardId}:${enabled}`,
  )
}
