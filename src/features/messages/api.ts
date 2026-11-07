import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { previewOf } from '@/features/messages/messages'
import { db } from '@/lib/firebase'
import { paths, type MessageDoc, type MessageFrom } from '@/model'

// Mensajes (M26). Sending writes the message and its conversation together: the rules check that
// each points at the other (the preview always matches a real message) and the 2 s cooldown.

export const conversationRef = (boardId: string, studentId: string) =>
  doc(db, paths.conversation(boardId, studentId))
export const conversationsCollection = (boardId: string) =>
  collection(db, paths.conversations(boardId))
export const messagesCollection = (boardId: string, studentId: string) =>
  collection(db, paths.messages(boardId, studentId))

export async function sendMessage(
  boardId: string,
  studentId: string,
  {
    from,
    uid,
    name,
    text,
    exists,
  }: {
    from: MessageFrom
    uid: string
    name: string
    text: string
    /** Whether the conversation already exists (the page is listening to it) */
    exists: boolean
  },
) {
  const message = doc(messagesCollection(boardId, studentId))
  const readKey = from === 'student' ? 'studentReadAt' : 'teacherReadAt'
  const batch = writeBatch(db)
  batch.set(message, {
    from,
    authorUid: uid,
    authorName: name.slice(0, 200) || '—',
    text,
    createdAt: serverTimestamp(),
  })
  const last = {
    lastMessageAt: serverTimestamp(),
    lastMessageId: message.id,
    lastFrom: from,
    lastText: previewOf(text),
    // writing means I've seen the conversation up to here
    [readKey]: serverTimestamp(),
  }
  if (exists) batch.update(conversationRef(boardId, studentId), last)
  else
    batch.set(conversationRef(boardId, studentId), {
      studentId,
      createdAt: serverTimestamp(),
      ...last,
    })
  await batch.commit()
  return message.id
}

/** I opened the conversation: my read time moves to now */
export function markRead(boardId: string, studentId: string, who: MessageFrom) {
  return updateDoc(conversationRef(boardId, studentId), {
    [who === 'student' ? 'studentReadAt' : 'teacherReadAt']: serverTimestamp(),
  })
}

/** The teacher's "Marcar como no leído": it shows as new again for the teachers */
export function markUnread(boardId: string, studentId: string) {
  return updateDoc(conversationRef(boardId, studentId), {
    teacherReadAt: null,
  })
}

/**
 * The teacher deletes one message (D116): it disappears for both. If it was the newest, the
 * preview moves to the one before; if it was the only one, the conversation goes too. A
 * transaction (never queued offline): the preview only moves back if that message is still the
 * newest, so a late write can't undo a reply that arrived in between.
 */
export async function deleteMessage(
  boardId: string,
  studentId: string,
  messageId: string,
) {
  const newest = await getDocs(
    query(
      messagesCollection(boardId, studentId),
      orderBy('createdAt', 'desc'),
      limit(2),
    ),
  )
  const previous = newest.docs.find((item) => item.id !== messageId)
  const conversation = conversationRef(boardId, studentId)
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(conversation)
    transaction.delete(doc(messagesCollection(boardId, studentId), messageId))
    if (current.data()?.lastMessageId !== messageId) return
    if (!previous) {
      transaction.delete(conversation)
      return
    }
    const data = previous.data() as MessageDoc
    transaction.update(conversation, {
      lastMessageAt: data.createdAt,
      lastMessageId: previous.id,
      lastFrom: data.from,
      lastText: previewOf(data.text),
    })
  })
}

/** The teacher's "Eliminar conversación": every message of that student, for both */
export async function deleteConversation(boardId: string, studentId: string) {
  // at most 500 writes per batch: delete in chunks of messages
  for (;;) {
    const page = await getDocs(
      query(messagesCollection(boardId, studentId), limit(450)),
    )
    const batch = writeBatch(db)
    for (const message of page.docs) batch.delete(message.ref)
    if (page.size < 450) {
      batch.delete(conversationRef(boardId, studentId))
      await batch.commit()
      return
    }
    await batch.commit()
  }
}
