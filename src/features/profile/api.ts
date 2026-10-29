import type { User } from 'firebase/auth'
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { isWritable, lifecycleOf } from '@/features/boards/lifecycle'
import { COLLECTIONS, normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import {
  paths,
  userProfileSchema,
  type BoardDoc,
  type MemberDoc,
  type StudentDoc,
  type UserDoc,
  type UserProfile,
} from '@/model'

// Profile page (/me): the name and photo shown to others. The Google fields of users/{uid} are
// refreshed on every login (features/auth/api.ts), so the chosen name lives in its own field.

type ProfileFields = Pick<UserDoc, 'profileName' | 'showPhoto'>

export const userRef = (uid: string) => doc(db, COLLECTIONS.users, uid)

export async function fetchProfile(uid: string) {
  return (await getDoc(userRef(uid))).data() as UserDoc | undefined
}

function googleName(user: User) {
  return user.displayName || normalizeEmail(user.email ?? '').split('@')[0]
}

/** The name I see in the menu: my chosen one, else the Google account's. */
export function displayNameOf(
  user: User,
  profile: ProfileFields | null | undefined,
) {
  return profile?.profileName || googleName(user)
}

/** The name on a card: my chosen one, else the teacher's spelling, else the Google account's. */
export function cardName(
  user: User,
  profile: ProfileFields | null | undefined,
  student: StudentDoc | undefined,
) {
  return profile?.profileName || student?.displayName || googleName(user)
}

/** The photo on a card: the Google one, unless I chose to hide it. */
export function cardPhoto(
  user: User,
  profile: ProfileFields | null | undefined,
) {
  return profile?.showPhoto === false ? null : (user.photoURL ?? null)
}

/**
 * Saves the profile, then updates my cards on every board I can still edit (archived or locked
 * boards keep the old name). Returns how many cards were skipped.
 */
export async function saveProfile(user: User, input: UserProfile) {
  const { name, showPhoto } = userProfileSchema.parse(input)
  const profile = { profileName: name || null, showPhoto }
  await setDoc(userRef(user.uid), profile, { merge: true })

  const memberships = await getDocs(
    query(collectionGroup(db, 'members'), where('uid', '==', user.uid)),
  )
  const results = await Promise.all(
    memberships.docs.map(async (membership) => {
      const boardId = membership.ref.parent.parent!.id
      const { studentId } = membership.data() as MemberDoc
      try {
        const board = await getDoc(doc(db, paths.board(boardId)))
        if (
          !board.exists() ||
          !isWritable(lifecycleOf(board.data() as BoardDoc))
        )
          return false
        const student = await getDoc(doc(db, paths.student(boardId, studentId)))
        await updateDoc(doc(db, paths.space(boardId, studentId)), {
          ownerName: cardName(user, profile, student.data() as StudentDoc),
          ownerPhotoURL: cardPhoto(user, profile),
          updatedAt: serverTimestamp(),
        })
        return true
      } catch (error) {
        console.error('[profile] card not updated', boardId, error)
        return false
      }
    }),
  )
  return { skipped: results.filter((updated) => !updated).length }
}
