import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  CHEER_EMOJI,
  cheerOn,
  decideCheer,
  freshMemory,
  pickVariant,
  remember,
  type CheerEvent,
} from '@/features/fun/cheer'
import { saveMilestone } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { motionAllowed } from '@/lib/gsap'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

// One memory for the whole tab: the 30 s cooldowns hold across screens
let memory = freshMemory()

/** The last cheer toast, so an achievement it unlocked joins it (one toast, M22) */
let lastCheer: {
  id: string | number
  message: string
  icon: string
  at: number
} | null = null

/**
 * M22: "🏆 Logro desbloqueado: …" — added to the cheer shown a moment ago, or its own toast.
 */
export function announceAchievement(line: string, standalone: string) {
  const now = Date.now()
  if (lastCheer && now - lastCheer.at < 4000) {
    toast(lastCheer.message, {
      id: lastCheer.id,
      icon: lastCheer.icon,
      className: 'cheer-toast',
      description: `🏆 ${line}`,
    })
    lastCheer.at = now
    return
  }
  toast(standalone, { icon: '🏆', className: 'cheer-toast' })
}

/**
 * `cheer(event)`: an encouraging toast (M20), confetti for real milestones (not with "reduce
 * motion"), and the once-only moments stored on my profile. Students only; nothing when switched
 * off. Returns whether a message showed (then the caller skips its plain "saved" toast), or
 * null while my profile is still loading (try again when `cheer` changes).
 */
export function useCheer() {
  const { t } = useTranslation()
  const { user, role } = useAuth()
  const profile = useProfile()
  const ready = !!user && !profile.loading
  const teacher = isTeacherRole(role)
  const enabled = cheerOn(profile.data)
  const milestones = profile.data?.milestones

  return useCallback(
    (
      event: CheerEvent,
      values: { count?: number; stage?: string } = {},
    ): boolean | null => {
      if (!ready || !user) return null
      if (teacher) return false
      const now = Date.now()
      const decision = decideCheer(event, { enabled, milestones, memory, now })
      if (!decision) return false
      memory = remember(memory, event, decision, now)
      const message = t(`fun.${event}.${pickVariant()}`, values)
      const id = toast(message, {
        icon: CHEER_EMOJI[event],
        className: 'cheer-toast',
      })
      lastCheer = { id, message, icon: CHEER_EMOJI[event], at: now }
      if (decision.burst && motionAllowed())
        void import('@/features/fun/confetti').then(({ burst }) => burst())
      if (decision.milestone)
        saveMilestone(user.uid, decision.milestone).catch((error) =>
          console.error('[cheer] milestone not saved', error),
        )
      return true
    },
    [ready, user, teacher, enabled, milestones, t],
  )
}
