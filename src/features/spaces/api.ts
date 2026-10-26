import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import {
  paths,
  spaceProfileSchema,
  type ImageRef,
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

/**
 * Sets (or removes, with null) the card cover. The previous image is marked "orphaned"
 * in the registry so the M7 cleanup can delete it from Cloudinary.
 */
export async function setSpaceCover(
  boardId: string,
  studentId: string,
  next: ImageRef | null,
  previous: ImageRef | null | undefined,
) {
  const batch = writeBatch(db)
  batch.update(doc(db, paths.space(boardId, studentId)), {
    cover: next,
    updatedAt: serverTimestamp(),
  })
  if (previous && previous.assetId !== next?.assetId) {
    batch.update(doc(db, paths.asset(boardId, previous.assetId)), {
      status: 'orphaned',
    })
  }
  await batch.commit()
}
