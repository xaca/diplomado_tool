import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { pruned } from '@/features/announcements/announcements'
import { db } from '@/lib/firebase'
import {
  announcementInputSchema,
  paths,
  type AnnouncementInput,
  type AnnouncementStateDoc,
} from '@/model'

// The teacher's announcements (M19) and each member's read / removed state.

type Author = { email: string; name: string }

export const announcementsCollection = (boardId: string) =>
  collection(db, paths.announcements(boardId))

export function createAnnouncement(
  boardId: string,
  author: Author,
  input: AnnouncementInput,
) {
  return addDoc(announcementsCollection(boardId), {
    ...announcementInputSchema.parse(input),
    authorEmail: author.email,
    authorName: author.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    remindedAt: serverTimestamp(),
  })
}

export function updateAnnouncement(
  boardId: string,
  id: string,
  author: Author,
  input: AnnouncementInput,
) {
  return updateDoc(doc(db, paths.announcement(boardId, id)), {
    ...announcementInputSchema.parse(input),
    authorEmail: author.email,
    authorName: author.name,
    updatedAt: serverTimestamp(),
  })
}

/** "Recordar" (D80): new again for everyone, also for those who removed it. */
export function remindAnnouncement(
  boardId: string,
  id: string,
  author: Author,
) {
  return updateDoc(doc(db, paths.announcement(boardId, id)), {
    authorEmail: author.email,
    authorName: author.name,
    remindedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteAnnouncement(boardId: string, id: string) {
  return deleteDoc(doc(db, paths.announcement(boardId, id)))
}

/**
 * Marks announcements read or removed for me (merge: one small write). When the maps grow, the
 * entries of deleted announcements are dropped (`current` = the ids that still exist).
 */
export function markAnnouncements(
  boardId: string,
  uid: string,
  kind: 'read' | 'removed',
  ids: readonly string[],
  state: Pick<AnnouncementStateDoc, 'read' | 'removed'> | null,
  current: ReadonlySet<string>,
) {
  const ref = doc(db, paths.announcementState(boardId, uid))
  const stamp = Object.fromEntries(ids.map((id) => [id, serverTimestamp()]))
  const size =
    Object.keys(state?.read ?? {}).length +
    Object.keys(state?.removed ?? {}).length
  if (size > 150) {
    const read = pruned(state?.read, current)
    const removed = pruned(state?.removed, current)
    return setDoc(ref, {
      read: kind === 'read' ? { ...read, ...stamp } : read,
      removed: kind === 'removed' ? { ...removed, ...stamp } : removed,
      updatedAt: serverTimestamp(),
    })
  }
  return setDoc(
    ref,
    {
      read: kind === 'read' ? stamp : {},
      removed: kind === 'removed' ? stamp : {},
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
