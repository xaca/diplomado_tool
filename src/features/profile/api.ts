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
import { imageUrl } from '@/lib/cloudinary'
import { COLLECTIONS, normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import {
  paths,
  userProfileSchema,
  type AvatarRef,
  type BoardDoc,
  type MemberDoc,
  type PhotoSource,
  type StudentDoc,
  type UserDoc,
  type UserProfile,
} from '@/model'

// Profile page (/me): the name and photo shown to others. The Google fields of users/{uid} are
// refreshed on every login (features/auth/api.ts), so the chosen name lives in its own field.

type ProfileFields = Pick<
  UserDoc,
  'profileName' | 'showPhoto' | 'photoSource' | 'avatar'
>

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

/** Which photo I chose (M11). Profiles saved before M11 only have `showPhoto`. */
export function photoSourceOf(
  profile: ProfileFields | null | undefined,
): PhotoSource {
  if (profile?.photoSource) return profile.photoSource
  return profile?.showPhoto === false ? 'initials' : 'google'
}

/** Uploaded photos are square already; every avatar uses this one size (≈ 15 KB). */
export function avatarUrl(avatar: AvatarRef) {
  return imageUrl(avatar, { w: 256, h: 256, crop: 'fill' })
}

/** The photo on a card: Google's, my uploaded one, or none (initials). */
export function cardPhoto(
  user: Pick<User, 'photoURL'>,
  profile: ProfileFields | null | undefined,
) {
  switch (photoSourceOf(profile)) {
    case 'initials':
      return null
    case 'upload':
      return profile?.avatar
        ? avatarUrl(profile.avatar)
        : (user.photoURL ?? null)
    default:
      return user.photoURL ?? null
  }
}

/** Saves the name and photo choice, then updates my cards (see updateMyCards). */
export async function saveProfile(user: User, input: UserProfile) {
  const { name, photoSource } = userProfileSchema.parse(input)
  const current = await fetchProfile(user.uid)
  // An upload choice without a photo falls back to Google's (nothing to show otherwise)
  const source =
    photoSource === 'upload' && !current?.avatar ? 'google' : photoSource
  const profile = {
    profileName: name || null,
    photoSource: source,
    showPhoto: source !== 'initials',
  }
  await setDoc(userRef(user.uid), profile, { merge: true })
  return updateMyCards(user, { ...current, ...profile })
}

/** Stores my new uploaded photo and shows it on my cards. */
export async function saveAvatar(user: User, avatar: AvatarRef) {
  const current = await fetchProfile(user.uid)
  const profile = { avatar, photoSource: 'upload' as const, showPhoto: true }
  await setDoc(userRef(user.uid), profile, { merge: true })
  return updateMyCards(user, { ...current, ...profile })
}

/** Forgets my uploaded photo (already deleted from Cloudinary): back to the Google one. */
export async function clearAvatar(user: User) {
  const current = await fetchProfile(user.uid)
  const profile = {
    avatar: null,
    photoSource:
      photoSourceOf(current) === 'upload'
        ? ('google' as const)
        : photoSourceOf(current),
  }
  await setDoc(userRef(user.uid), profile, { merge: true })
  return updateMyCards(user, { ...current, ...profile })
}

/** Boards I belong to (one membership per board), e.g. to prove I may upload a photo. */
export async function myMemberships(uid: string) {
  return getDocs(query(collectionGroup(db, 'members'), where('uid', '==', uid)))
}

/**
 * Updates my name and photo on every card on a board I can still edit (archived or locked boards
 * keep the old ones). Returns how many cards were skipped.
 */
async function updateMyCards(user: User, profile: ProfileFields) {
  const memberships = await myMemberships(user.uid)
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
