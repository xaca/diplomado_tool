import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import {
  paths,
  spaceProfileSchema,
  type SpaceDoc,
  type SpaceProfile,
} from '@/model'

export type Space = WithId<SpaceDoc>

export const spacesCollection = (boardId: string) =>
  collection(db, paths.spaces(boardId))

/** The student edits their card. Only touches the space doc (PLAN.md review R2: no fan-out on slide saves). */
export function updateSpaceProfile(
  boardId: string,
  studentId: string,
  profile: SpaceProfile,
) {
  const { title, summary, color } = spaceProfileSchema.parse(profile)
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    title,
    summary,
    color,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Dashboard order, Padlet-like: my own card first, then by the order students joined.
 * Pure function (unit-tested).
 */
export function sortSpaces<
  T extends Pick<SpaceDoc, 'createdAt' | 'ownerName'> & { id: string },
>(spaces: T[], myStudentId: string | null): T[] {
  return [...spaces].sort((a, b) => {
    if (a.id === myStudentId) return -1
    if (b.id === myStudentId) return 1
    const byJoin = toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
    return byJoin !== 0 ? byJoin : a.ownerName.localeCompare(b.ownerName, 'es')
  })
}
