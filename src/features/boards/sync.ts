import { useEffect } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { syncTeacherProfile } from '@/features/boards/api'
import { cardPhoto, displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { paths, type BoardDoc, type SpaceDoc, type StudentDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

/** Cards whose group differs from the roster's (pure, unit-tested). */
export function groupChanges(
  spaces: readonly WithId<Pick<SpaceDoc, 'group'>>[],
  students: readonly WithId<Pick<StudentDoc, 'group'>>[],
) {
  const groups = new Map(students.map((s) => [s.id, s.group?.trim() ?? '']))
  return spaces.flatMap((space) => {
    const group = groups.get(space.id)
    return group !== undefined && group !== (space.group ?? '')
      ? [{ id: space.id, group }]
      : []
  })
}

/**
 * While a teacher looks at their board (M12): keeps their name / photo on the board (header with
 * the #DOCENTE ring) and copies each student's group onto their card ("Por grupo" layout).
 * Self-healing and idempotent: writes only what differs; failures are only logged.
 */
export function useTeacherBoardSync(
  board: WithId<BoardDoc> | null | undefined,
  spaces: readonly WithId<SpaceDoc>[] | null,
  students: readonly WithId<StudentDoc>[] | null,
) {
  const { user } = useAuth()
  const profile = useProfile()
  const email = normalizeEmail(user?.email ?? '')
  const name = user ? displayNameOf(user, profile.data) : ''
  const photoURL = user ? cardPhoto(user, profile.data) : null

  useEffect(() => {
    if (!board || !user || profile.loading) return
    syncTeacherProfile(board, email, { name, photoURL }).catch((error) =>
      console.error('[board] teacher profile not synced', error),
    )
  }, [board, user, email, name, photoURL, profile.loading])

  useEffect(() => {
    if (!board || !spaces || !students || students.length === 0) return
    const changes = groupChanges(spaces, students)
    if (changes.length === 0) return
    const batch = writeBatch(db)
    for (const { id, group } of changes)
      batch.update(doc(db, paths.space(board.id, id)), { group })
    batch
      .commit()
      .catch((error) => console.error('[board] groups not synced', error))
  }, [board, spaces, students])
}
