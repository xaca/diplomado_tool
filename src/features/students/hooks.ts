import { useMemo } from 'react'
import { useLiveQuery } from '@/lib/firestore-hooks'
import { studentsCollection } from '@/features/students/api'
import type { StudentDoc } from '@/model'

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
