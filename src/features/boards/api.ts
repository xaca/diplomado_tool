import {
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { COLLECTIONS, normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import { boardInputSchema, newJoinCode, paths, type BoardInput } from '@/model'

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

export function setInviteEnabled(boardId: string, enabled: boolean) {
  return updateDoc(boardRef(boardId), {
    joinCodeEnabled: enabled,
    updatedAt: serverTimestamp(),
  })
}

export function inviteUrl(code: string) {
  return `${window.location.origin}/join/${code}`
}
