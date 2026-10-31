import { collection, doc } from 'firebase/firestore'
import { pollsCollection } from '@/features/polls/api'
import { db } from '@/lib/firebase'
import { useLiveDoc, useLiveQuery } from '@/lib/firestore-hooks'
import { paths, type PollDoc, type VoteDoc } from '@/model'

export function usePolls(
  boardId: string | undefined,
  studentId: string | undefined,
) {
  return useLiveQuery<PollDoc>(
    boardId && studentId ? pollsCollection(boardId, studentId) : null,
    `polls:${boardId}:${studentId}`,
  )
}

/** My own vote on a poll (null before voting). */
export function useMyVote(
  boardId: string,
  studentId: string,
  pollId: string,
  myStudentId: string | null,
) {
  return useLiveDoc<VoteDoc>(
    myStudentId
      ? doc(db, paths.vote(boardId, studentId, pollId, myStudentId))
      : null,
    `vote:${boardId}:${studentId}:${pollId}:${myStudentId}`,
  )
}

/** Who voted (teacher, or the author of a non-anonymous poll). */
export function useVoters(
  boardId: string,
  studentId: string,
  pollId: string,
  enabled: boolean,
) {
  return useLiveQuery<VoteDoc>(
    enabled
      ? collection(db, paths.poll(boardId, studentId, pollId), 'votes')
      : null,
    `votes:${boardId}:${studentId}:${pollId}:${enabled}`,
  )
}
