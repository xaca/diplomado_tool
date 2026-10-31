import {
  arrayUnion,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { cardName, cardPhoto, fetchProfile } from '@/features/profile/api'
import { normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import {
  defaultSpace,
  paths,
  type BoardDoc,
  type JoinCodeDoc,
  type MemberDoc,
  type StudentDoc,
  type StudentEmailDoc,
} from '@/model'

// How a student gets into a board (PLAN.md → "Joining a board"):
// A) their email is on the list → auto-join on login · B) invite link with the board's code.

function emailOf(user: User) {
  return normalizeEmail(user.email ?? '')
}

/** A new, empty card with my profile's name and photo (features/profile/api.ts) */
async function newSpace(
  studentId: string,
  user: User,
  student: StudentDoc | undefined,
) {
  const profile = await fetchProfile(user.uid)
  return {
    ...defaultSpace(
      studentId,
      cardName(user, profile, student),
      cardPhoto(user, profile),
    ),
    // M12: the roster's group, for the "Por grupo" layout
    ...(student?.group ? { group: student.group } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

/**
 * Creates the student's empty card if it's missing (e.g. a join interrupted before the link and
 * the card were written together). Readable only once we're a member.
 */
async function ensureSpace(user: User, boardId: string, studentId: string) {
  const spaceRef = doc(db, paths.space(boardId, studentId))
  if ((await getDoc(spaceRef)).exists()) return
  const student = await getDoc(doc(db, paths.student(boardId, studentId)))
  try {
    await writeBatch(db)
      .set(
        spaceRef,
        await newSpace(studentId, user, student.data() as StudentDoc),
      )
      .commit()
  } catch (error) {
    // Both accounts of the same student may create it at the same time
    if (!(await getDoc(spaceRef)).exists()) throw error
  }
}

/**
 * Links this account to the student. The student's first account writes the link and the card in
 * ONE batch, so a join can never stop halfway ("Ingresó" without a card).
 */
async function linkAccount(user: User, boardId: string, studentId: string) {
  const studentRef = doc(db, paths.student(boardId, studentId))
  const memberRef = doc(db, paths.member(boardId, user.uid))
  const student = (await getDoc(studentRef)).data() as StudentDoc | undefined
  // A second account of the same student finds the card already there
  const firstAccount = (student?.linkedUids ?? []).length === 0

  const card = firstAccount ? await newSpace(studentId, user, student) : null

  const writeLink = (withCard: boolean) => {
    const batch = writeBatch(db)
    batch.set(memberRef, {
      uid: user.uid,
      studentId,
      email: emailOf(user),
      joinedAt: serverTimestamp(),
    })
    batch.update(studentRef, {
      linkedUids: arrayUnion(user.uid),
      status: 'joined',
      joinedAt: serverTimestamp(),
    })
    if (withCard && card)
      batch.set(doc(db, paths.space(boardId, studentId)), card)
    return batch.commit()
  }

  try {
    await writeLink(firstAccount)
    if (firstAccount) return
  } catch (error) {
    // Lost a race with another tab/effect that linked this account first: that's success too
    if (!(await getDoc(memberRef)).exists()) {
      // The card may exist already (e.g. a board restored from a backup): link without it
      if (!firstAccount) throw error
      await writeLink(false)
    }
  }
  await ensureSpace(user, boardId, studentId)
}

// One auto-join at a time per account: React StrictMode runs effects twice in dev, and a
// student may open two tabs. Concurrent runs would collide on members/{uid} (create vs update).
const autoJoinInFlight = new Map<string, Promise<number>>()

/** A) Joins every board whose student list contains this account's email. Returns how many it joined. */
export function autoJoinFromEmail(user: User): Promise<number> {
  const running = autoJoinInFlight.get(user.uid)
  if (running) return running
  const run = autoJoinOnce(user).finally(() =>
    autoJoinInFlight.delete(user.uid),
  )
  autoJoinInFlight.set(user.uid, run)
  return run
}

async function autoJoinOnce(user: User) {
  if (!user.email || !user.emailVerified) return 0
  const entries = await getDocs(
    query(
      collectionGroup(db, 'studentEmails'),
      where('email', '==', emailOf(user)),
    ),
  )

  let joined = 0
  for (const entry of entries.docs) {
    const boardId = entry.ref.parent.parent!.id
    const { studentId } = entry.data() as StudentEmailDoc
    const member = await getDoc(doc(db, paths.member(boardId, user.uid)))
    if (member.exists()) {
      // Joined before, but the card may be missing: repair it (never blocks the other boards)
      await ensureSpace(
        user,
        boardId,
        (member.data() as MemberDoc).studentId,
      ).catch((error: unknown) =>
        console.error('[membership] card not created', boardId, error),
      )
      continue
    }
    await linkAccount(user, boardId, studentId)
    joined += 1
  }
  return joined
}

/** Boards this account is a member of. */
export async function fetchMyBoards(user: User): Promise<WithId<BoardDoc>[]> {
  const memberships = await getDocs(
    query(collectionGroup(db, 'members'), where('uid', '==', user.uid)),
  )
  const boards = await Promise.all(
    memberships.docs.map(async (membership) => {
      const boardId = membership.ref.parent.parent!.id
      const snapshot = await getDoc(doc(db, paths.board(boardId)))
      return snapshot.exists()
        ? { ...(snapshot.data() as BoardDoc), id: snapshot.id }
        : null
    }),
  )
  return boards.filter((board) => board !== null)
}

export async function lookupJoinCode(code: string) {
  const snapshot = await getDoc(
    doc(db, paths.joinCode(code.trim().toUpperCase())),
  )
  return snapshot.exists() ? (snapshot.data() as JoinCodeDoc) : null
}

export class InviteRejectedError extends Error {}

/** B) Joins with the invite link. Returns the board id. */
export async function joinWithCode(user: User, rawCode: string) {
  const code = rawCode.trim().toUpperCase()
  const invite = await lookupJoinCode(code)
  if (!invite) throw new InviteRejectedError('unknown code')
  const { boardId } = invite

  // Already in (any of my accounts)?
  if ((await getDoc(doc(db, paths.member(boardId, user.uid)))).exists())
    return boardId

  // On the list already (e.g. imported with this email): link instead of creating a duplicate
  const listed = await getDoc(
    doc(db, paths.studentEmail(boardId, emailOf(user))),
  )
  if (listed.exists()) {
    await linkAccount(
      user,
      boardId,
      (listed.data() as StudentEmailDoc).studentId,
    )
    return boardId
  }

  const studentRef = doc(collection(db, paths.students(boardId)))
  const card = await newSpace(studentRef.id, user, undefined)
  const batch = writeBatch(db)
  batch.set(studentRef, {
    displayName: card.ownerName,
    emails: [emailOf(user)],
    group: '',
    status: 'joined',
    linkedUids: [user.uid],
    source: 'invite',
    inviteCode: code,
    createdAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, paths.studentEmail(boardId, emailOf(user))), {
    email: emailOf(user),
    studentId: studentRef.id,
  })
  batch.set(doc(db, paths.member(boardId, user.uid)), {
    uid: user.uid,
    studentId: studentRef.id,
    email: emailOf(user),
    joinedAt: serverTimestamp(),
  })
  batch.set(doc(db, paths.space(boardId, studentRef.id)), card)
  try {
    await batch.commit()
  } catch {
    // Disabled invite, archived board or a changed code: the rules reject the batch
    throw new InviteRejectedError('rejected')
  }
  return boardId
}
