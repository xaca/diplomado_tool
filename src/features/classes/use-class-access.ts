import { doc } from 'firebase/firestore'
import { useBoard } from '@/features/boards/hooks'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import { displayNameOf } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { useMyStudentId } from '@/features/spaces/hooks'
import { normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { paths, type SpaceDoc } from '@/model'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** Who I am on a board's classes (M10): its teacher, a member, or neither. */
export function useClassAccess(boardId: string | undefined) {
  const { user, role } = useAuth()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const profile = useProfile()
  // A student's notes carry the name on their card (the one the class knows)
  const space = useLiveDoc<SpaceDoc>(
    boardId && me.studentId
      ? doc(db, paths.space(boardId, me.studentId))
      : null,
    `space:${boardId}:${me.studentId}`,
  )
  const teacher =
    isTeacherRole(role) &&
    !!board.data?.teacherEmails.includes(normalizeEmail(user?.email ?? ''))
  return {
    board,
    uid: user?.uid,
    teacher,
    studentId: me.studentId,
    member: !!me.studentId,
    allowed: teacher || !!me.studentId,
    writableBoard: !!board.data && isWritable(lifecycleOf(board.data)),
    name:
      space.data?.ownerName || (user ? displayNameOf(user, profile.data) : ''),
    loading: board.loading || me.loading || profile.loading,
  }
}
