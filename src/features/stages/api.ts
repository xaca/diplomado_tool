import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { cleanStages } from '@/features/stages/stages'
import { db } from '@/lib/firebase'
import {
  paths,
  stageListSchema,
  STAGE_ID_PATTERN,
  type StageDef,
} from '@/model'

/**
 * Sets (or clears, with null) a student's stage. The student bumps the card's `updatedAt` like
 * any card edit; the teacher only touches the stage fields (rules: firestore.rules → spaces).
 */
export function setSpaceStage(
  boardId: string,
  studentId: string,
  stage: string | null,
  by: 'student' | 'teacher',
) {
  if (stage !== null && !STAGE_ID_PATTERN.test(stage))
    throw new Error(`invalid stage id: ${stage}`)
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    stage,
    stageUpdatedAt: serverTimestamp(),
    stageSetBy: by,
    ...(by === 'student' && { updatedAt: serverTimestamp() }),
  })
}

/** The teacher's stage list for this board; null brings back the Design Thinking defaults. */
export function saveBoardStages(boardId: string, stages: StageDef[] | null) {
  return updateDoc(doc(db, paths.board(boardId)), {
    stages: stages && stageListSchema.parse(cleanStages(stages)),
    updatedAt: serverTimestamp(),
  })
}
