import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { missing } from '@/features/achievements/achievements'
import { unlockAchievement } from '@/features/achievements/api'
import { useMyAchievements } from '@/features/achievements/hooks'
import { cheerOn } from '@/features/fun/cheer'
import { announceAchievement } from '@/features/fun/use-cheer'
import { useProfile } from '@/features/profile/hooks'
import { useMyStudentId } from '@/features/spaces/hooks'
import type { AchievementKey } from '@/model'
import { useAuth } from '@/providers/auth-context'

// Unlocks already on their way, for the whole tab (the sync and an event may ask at once)
const inFlight = new Set<string>()

/**
 * `unlock(keys)` (M22): unlocks the ones I don't have yet on this board, one write each, and
 * announces them (joined to the cheer toast) unless `silent` or "Mensajes de ánimo" is off.
 * Students only; returns false while my data is still loading.
 */
export function useAchievementUnlock(boardId: string | undefined) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const me = useMyStudentId(boardId)
  const mine = useMyAchievements(boardId, me.studentId ? user?.uid : undefined)
  const profile = useProfile()
  const studentId = me.studentId
  const ready = !!boardId && !!user && !!studentId && !mine.loading
  const unlocked = mine.data?.unlocked
  const exists = !!mine.data
  const announce = cheerOn(profile.data)

  return useCallback(
    async (
      keys: readonly AchievementKey[],
      { silent = false }: { silent?: boolean } = {},
    ) => {
      if (!ready || !boardId || !user || !studentId) return false
      let created = exists
      for (const key of missing(unlocked, keys)) {
        const flight = `${boardId}:${user.uid}:${key}`
        if (inFlight.has(flight)) continue
        inFlight.add(flight)
        try {
          await unlockAchievement(
            boardId,
            { uid: user.uid, studentId },
            key,
            created,
          )
          created = true
          if (!silent && announce) {
            const name = t(`achievements.items.${key}.name`)
            announceAchievement(
              t('achievements.unlockedLine', { name }),
              t('achievements.unlockedToast', { name }),
            )
          }
        } catch (error) {
          // e.g. unlocked a moment ago on another screen: the rules refuse a second time
          console.warn('[achievements] not unlocked', key, error)
        } finally {
          inFlight.delete(flight)
        }
      }
      return true
    },
    [ready, boardId, user, studentId, exists, unlocked, announce, t],
  )
}
