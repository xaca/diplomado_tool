import { useMemo } from 'react'
import { limit, orderBy, query, where } from 'firebase/firestore'
import {
  conversationRef,
  conversationsCollection,
  messagesCollection,
} from '@/features/messages/api'
import { unreadForTeacher } from '@/features/messages/messages'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import type { ConversationDoc, MessageDoc } from '@/model'

/** One student's conversation (the student: their own; the teacher: the one open) */
export function useConversation(
  boardId: string | undefined,
  studentId: string | null | undefined,
) {
  return useLiveDoc<ConversationDoc>(
    boardId && studentId ? conversationRef(boardId, studentId) : null,
    `conversation:${boardId}:${studentId}`,
  )
}

/** Every conversation of the board (teachers only: the rules refuse the list to students) */
export function useConversations(
  boardId: string | undefined,
  enabled: boolean,
) {
  return useLiveQuery<ConversationDoc>(
    boardId && enabled ? conversationsCollection(boardId) : null,
    `conversations:${boardId}:${enabled}`,
  )
}

/**
 * The teacher's counts (home badges, Comunicación): only conversations whose last message is
 * from a student are read. `unread` = not opened yet; `waiting` = no reply yet.
 */
export function useTeacherInbox(boardId: string | undefined, enabled = true) {
  const list = useLiveQuery<ConversationDoc>(
    boardId && enabled
      ? query(
          conversationsCollection(boardId),
          where('lastFrom', '==', 'student'),
        )
      : null,
    `conversations-waiting:${boardId}:${enabled}`,
  )
  return useMemo(
    () => ({
      unread: unreadForTeacher(list.data),
      waiting: list.data.length,
      loading: list.loading,
    }),
    [list.data, list.loading],
  )
}

export const useTeacherUnread = (boardId: string | undefined, enabled = true) =>
  useTeacherInbox(boardId, enabled).unread

/** The latest `count` messages, oldest first */
export function useMessages(
  boardId: string | undefined,
  studentId: string | null | undefined,
  count: number,
  enabled = true,
) {
  const list = useLiveQuery<MessageDoc>(
    boardId && studentId && enabled
      ? query(
          messagesCollection(boardId, studentId),
          orderBy('createdAt', 'desc'),
          limit(count),
        )
      : null,
    `messages:${boardId}:${studentId}:${count}:${enabled}`,
  )
  const data = useMemo(() => [...list.data].reverse(), [list.data])
  return { ...list, data, more: list.data.length >= count }
}
