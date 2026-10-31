import {
  collection,
  deleteField,
  doc,
  FieldPath,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COLLECTIONS, normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import { shouldRecordActivity } from '@/features/boards/lifecycle'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import {
  boardInputSchema,
  boardLookSchema,
  newJoinCode,
  paths,
  type BoardDoc,
  type BoardInput,
  type BoardLook,
  type ImageRef,
  type TeacherProfile,
} from '@/model'

export const boardsQueryFor = (email: string) =>
  query(
    collection(db, COLLECTIONS.boards),
    where('teacherEmails', 'array-contains', normalizeEmail(email)),
  )

export const boardRef = (boardId: string) => doc(db, paths.board(boardId))

async function unusedJoinCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newJoinCode()
    if (!(await getDoc(doc(db, paths.joinCode(code)))).exists()) return code
  }
  throw new Error('Could not generate a free invite code')
}

/** Creates the board and its invite code in one batch. Returns the new board id. */
export async function createBoard(teacherEmail: string, input: BoardInput) {
  const { title, description } = boardInputSchema.parse(input)
  const code = await unusedJoinCode()
  const ref = doc(collection(db, COLLECTIONS.boards))

  const batch = writeBatch(db)
  batch.set(ref, {
    title,
    description,
    teacherEmails: [normalizeEmail(teacherEmail)],
    joinCode: code,
    joinCodeEnabled: true,
    status: 'active',
    archiveAfterDays: 90,
    background: 'yellow',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  })
  batch.set(doc(db, paths.joinCode(code)), {
    boardId: ref.id,
    boardTitle: title,
    createdAt: serverTimestamp(),
  })
  await batch.commit()
  return ref.id
}

export async function updateBoardInfo(
  boardId: string,
  joinCode: string,
  input: BoardInput,
) {
  const { title, description } = boardInputSchema.parse(input)
  const batch = writeBatch(db)
  batch.update(boardRef(boardId), {
    title,
    description,
    updatedAt: serverTimestamp(),
  })
  // The invite page shows the title before the student is a member
  batch.update(doc(db, paths.joinCode(joinCode)), { boardTitle: title })
  await batch.commit()
}

/** The board's look (M12): background, pattern, layout, order, sticky header. */
export function saveBoardLook(boardId: string, look: BoardLook) {
  return updateDoc(boardRef(boardId), {
    ...boardLookSchema.parse(look),
    updatedAt: serverTimestamp(),
  })
}

/** Sets (or removes, with null) the board logo; the previous one is marked unused (M7 cleanup). */
export async function setBoardLogo(
  boardId: string,
  next: ImageRef | null,
  previous: ImageRef | null | undefined,
) {
  const batch = writeBatch(db)
  batch.update(boardRef(boardId), { logo: next, updatedAt: serverTimestamp() })
  if (previous && previous.assetId !== next?.assetId)
    batch.update(doc(db, paths.asset(boardId, previous.assetId)), {
      status: 'orphaned',
    })
  await batch.commit()
}

/**
 * Keeps my name and photo on the boards I teach up to date (the header shows them with the
 * #DOCENTE ring). Writes only when something changed. The email has dots: a FieldPath, not a string.
 */
export function syncTeacherProfile(
  board: WithId<BoardDoc>,
  email: string,
  profile: TeacherProfile,
) {
  const current = board.teacherProfiles?.[email]
  if (
    !board.teacherEmails.includes(email) ||
    (current?.name === profile.name && current?.photoURL === profile.photoURL)
  )
    return Promise.resolve()
  return updateDoc(
    boardRef(board.id),
    new FieldPath('teacherProfiles', email),
    profile,
  )
}

export function setInviteEnabled(boardId: string, enabled: boolean) {
  return updateDoc(boardRef(boardId), {
    joinCodeEnabled: enabled,
    updatedAt: serverTimestamp(),
  })
}

export function inviteUrl(code: string) {
  return `${window.location.origin}/join/${code}`
}

/** "Archive now" (e.g. at the end of the semester): read-only, listed under "Proyectos archivados". */
export function archiveBoard(boardId: string) {
  return updateDoc(boardRef(boardId), {
    status: 'archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Back to active; counts as activity, so it isn't auto-archived again right away. */
export function restoreBoard(boardId: string) {
  return updateDoc(boardRef(boardId), {
    status: 'active',
    archivedAt: deleteField(),
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function setArchiveAfterDays(boardId: string, days: number) {
  return updateDoc(boardRef(boardId), {
    archiveAfterDays: days,
    updatedAt: serverTimestamp(),
  })
}

// Checked at most once an hour per board and browser session (no extra reads while editing)
const activityChecked = new Map<string, number>()

/**
 * Records that the board is in use (any edit by a student or the teacher), at most once an hour.
 * Best effort: a failure never blocks the edit that triggered it.
 */
export async function recordBoardActivity(boardId: string, now = Date.now()) {
  if (!shouldRecordActivity(new Date(activityChecked.get(boardId) ?? 0), now))
    return
  activityChecked.set(boardId, now)
  try {
    const board = await getDoc(boardRef(boardId))
    if (!board.exists()) return
    if (shouldRecordActivity(toDate(board.data().lastActivityAt), now))
      await updateDoc(boardRef(boardId), { lastActivityAt: serverTimestamp() })
  } catch (error) {
    console.warn('[boards] activity not recorded', error)
  }
}
