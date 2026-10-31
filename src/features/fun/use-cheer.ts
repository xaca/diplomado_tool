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
import { useAuth } from '@/providers/auth-context'

// One memory for the whole tab: the 30 s cooldowns hold across screens
let memory = freshMemory()

/**
 * `cheer(event)`: an encouraging toast (M20), confetti for real milestones (not with "reduce
 * motion"), and the once-only moments stored on my profile. Does nothing when switched off.
 */
export function useCheer() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const profile = useProfile()
  const ready = !!user && !profile.loading
  const enabled = cheerOn(profile.data)
  const milestones = profile.data?.milestones

  return useCallback(
    (event: CheerEvent, values: { count?: number; stage?: string } = {}) => {
      if (!ready || !user) return
      const now = Date.now()
      const decision = decideCheer(event, { enabled, milestones, memory, now })
      if (!decision) return
      memory = remember(memory, event, decision, now)
      toast(t(`fun.${event}.${pickVariant()}`, values), {
        icon: CHEER_EMOJI[event],
        className: 'cheer-toast',
      })
      if (decision.burst && motionAllowed())
        void import('@/features/fun/confetti').then(({ burst }) => burst())
      if (decision.milestone)
        saveMilestone(user.uid, decision.milestone).catch((error) =>
          console.error('[cheer] milestone not saved', error),
        )
    },
    [ready, user, enabled, milestones, t],
  )
}
