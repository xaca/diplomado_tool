import { useEffect, useRef } from 'react'
import { doc } from 'firebase/firestore'
import { derivedAchievements } from '@/features/achievements/achievements'
import { useAchievementUnlock } from '@/features/achievements/use-unlock'
import { useBoard } from '@/features/boards/hooks'
import { useProfile } from '@/features/profile/hooks'
import { useMyStudentId } from '@/features/spaces/hooks'
import { boardStages } from '@/features/stages/stages'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { paths, type SpaceDoc } from '@/model'

/**
 * M22: unlocks what's already true from my card and profile (slides, ready, stage, photo), live.
 * The first pass after opening the board is silent (D86: work done before counts, no toast flood);
 * later ones are announced. Renders nothing; students only.
 */
export function AchievementSync({ boardId }: { boardId: string }) {
  const me = useMyStudentId(boardId)
  const board = useBoard(boardId)
  const profile = useProfile()
  const space = useLiveDoc<SpaceDoc>(
    me.studentId ? doc(db, paths.space(boardId, me.studentId)) : null,
    `space:${boardId}:${me.studentId}`,
  )
  const unlock = useAchievementUnlock(boardId)
  const loaded =
    !!me.studentId && !space.loading && !board.loading && !profile.loading
  const keys = loaded
    ? derivedAchievements({
        space: space.data,
        stages: boardStages(board.data),
        profile: profile.data,
      })
    : []
  const signature = keys.join('|')
  const first = useRef(true)

  useEffect(() => {
    if (!loaded) return
    let active = true
    void unlock(signature ? (signature.split('|') as typeof keys) : [], {
      silent: first.current,
    }).then((done) => {
      if (done && active) first.current = false
    })
    return () => {
      active = false
    }
  }, [loaded, signature, unlock])

  return null
}
