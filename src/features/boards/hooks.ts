import { useMemo } from 'react'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import { boardRef, boardsQueryFor } from '@/features/boards/api'
import type { BoardDoc } from '@/model'
import { useAuth } from '@/providers/auth-context'

export function useTeacherBoards() {
  const { user } = useAuth()
  const email = user?.email ?? null
  const result = useLiveQuery<BoardDoc>(
    email ? boardsQueryFor(email) : null,
    `boards:${email}`,
  )
  // Newest first, sorted locally (avoids a composite index)
  const boards = useMemo(
    () =>
      [...result.data].sort(
        (a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt),
      ),
    [result.data],
  )
  return { ...result, data: boards }
}

export function useBoard(boardId: string | undefined) {
  return useLiveDoc<BoardDoc>(
    boardId ? boardRef(boardId) : null,
    `board:${boardId}`,
  )
}

export function timestampMillis(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis() as number
  }
  // Pending server timestamps (just written) sort as "now"
  return Date.now()
}
