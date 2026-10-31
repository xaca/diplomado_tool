import { collection, doc } from 'firebase/firestore'
import { announcementsCollection } from '@/features/announcements/api'
import { db } from '@/lib/firebase'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import { paths, type AnnouncementDoc, type AnnouncementStateDoc } from '@/model'

/** The board's announcements (members and the teacher), live. */
export function useAnnouncements(boardId: string | undefined, enabled = true) {
  return useLiveQuery<AnnouncementDoc>(
    boardId && enabled ? announcementsCollection(boardId) : null,
    `announcements:${boardId}:${enabled}`,
  )
}

/** My read / removed state on a board. */
export function useAnnouncementState(
  boardId: string | undefined,
  uid: string | undefined,
) {
  return useLiveDoc<AnnouncementStateDoc>(
    boardId && uid ? doc(db, paths.announcementState(boardId, uid)) : null,
    `announcementState:${boardId}:${uid}`,
  )
}

/** Every member's state (teacher): the read counts. */
export function useAnnouncementStates(
  boardId: string | undefined,
  enabled: boolean,
) {
  return useLiveQuery<AnnouncementStateDoc>(
    boardId && enabled
      ? collection(db, paths.announcementStates(boardId))
      : null,
    `announcementStates:${boardId}:${enabled}`,
  )
}
