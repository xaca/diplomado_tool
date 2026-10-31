import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { countsAfterVote } from '@/features/polls/tally'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { paths, pollInputSchema, type PollDoc, type PollInput } from '@/model'

// Polls in a student's space (M16, F20). The counts on the poll move with each vote in the same
// batch, so everyone sees results without reading who voted (D51).

export type Poll = WithId<PollDoc>

export const pollsCollection = (boardId: string, studentId: string) =>
  collection(db, paths.polls(boardId, studentId))

export function createPoll(
  boardId: string,
  studentId: string,
  input: PollInput,
  author: { uid: string; name: string; role: 'student' | 'teacher' },
) {
  const { question, options, anonymous } = pollInputSchema.parse(input)
  const ids = options.map((_, index) => `o${index + 1}`)
  return setDoc(doc(pollsCollection(boardId, studentId)), {
    question,
    options: options.map((label, index) => ({ id: ids[index], label })),
    optionIds: ids,
    counts: {},
    anonymous,
    status: 'open',
    authorUid: author.uid,
    authorName: author.name,
    authorRole: author.role,
    createdAt: serverTimestamp(),
  })
}

/** My vote (doc id = my studentId): the counts follow it (one down, one up when changing). */
export function castVote(
  boardId: string,
  studentId: string,
  poll: Poll,
  myStudentId: string,
  optionId: string,
  previous: string | null,
) {
  if (previous === optionId) return Promise.resolve()
  const batch = writeBatch(db)
  batch.set(doc(db, paths.vote(boardId, studentId, poll.id, myStudentId)), {
    optionId,
    votedAt: serverTimestamp(),
  })
  batch.update(doc(db, paths.poll(boardId, studentId, poll.id)), {
    counts: countsAfterVote(poll.counts ?? {}, previous, optionId),
  })
  return batch.commit()
}

export function setPollStatus(
  boardId: string,
  studentId: string,
  pollId: string,
  status: PollDoc['status'],
) {
  return updateDoc(doc(db, paths.poll(boardId, studentId, pollId)), { status })
}

/** Deletes the poll and the votes we may list (teacher, or the author of a non-anonymous poll). */
export async function deletePoll(
  boardId: string,
  studentId: string,
  poll: Poll,
  canListVotes: boolean,
) {
  const batch = writeBatch(db)
  if (canListVotes) {
    const votes = await getDocs(
      collection(db, paths.poll(boardId, studentId, poll.id), 'votes'),
    )
    for (const vote of votes.docs) batch.delete(vote.ref)
  }
  batch.delete(doc(db, paths.poll(boardId, studentId, poll.id)))
  await batch.commit()
}
