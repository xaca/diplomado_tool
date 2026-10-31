import { useMemo } from 'react'
import { collection } from 'firebase/firestore'
import { useLiveQuery } from '@/lib/firestore-hooks'
import { studentsCollection } from '@/features/students/api'
import { db } from '@/lib/firebase'
import { paths, type MemberDoc, type StudentDoc } from '@/model'

export function useStudents(boardId: string | undefined) {
  const result = useLiveQuery<StudentDoc>(
    boardId ? studentsCollection(boardId) : null,
    `students:${boardId}`,
  )
  const students = useMemo(
    () =>
      [...result.data].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'es'),
      ),
    [result.data],
  )
  return { ...result, data: students }
}

/** The board's linked accounts (teacher): which address each student actually uses (M18). */
export function useMembers(boardId: string | undefined) {
  return useLiveQuery<MemberDoc>(
    boardId ? collection(db, paths.members(boardId)) : null,
    `members:${boardId}`,
  )
}
