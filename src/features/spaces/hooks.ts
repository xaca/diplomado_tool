import { useMemo } from 'react'
import { doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import { sortSpaces, spacesCollection } from '@/features/spaces/api'
import { paths, type MemberDoc, type SpaceDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

/** Which student am I in this board? null for teachers and visitors. */
export function useMyStudentId(boardId: string | undefined) {
  const { user } = useAuth()
  const ref = boardId && user ? doc(db, paths.member(boardId, user.uid)) : null
  const member = useLiveDoc<MemberDoc>(ref, `member:${boardId}:${user?.uid}`)
  return { studentId: member.data?.studentId ?? null, loading: member.loading }
}

/** Live cards of the board, my card first. */
export function useSpaces(
  boardId: string | undefined,
  myStudentId: string | null,
) {
  const result = useLiveQuery<SpaceDoc>(
    boardId ? spacesCollection(boardId) : null,
    `spaces:${boardId}`,
  )
  const spaces = useMemo(
    () => sortSpaces(result.data, myStudentId),
    [result.data, myStudentId],
  )
  return { ...result, data: spaces }
}
