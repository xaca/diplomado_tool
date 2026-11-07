import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { paths, type EvaluationDoc } from '@/model'

export const evaluationsCollection = (boardId: string) =>
  collection(db, paths.evaluations(boardId))
export const evaluationRef = (boardId: string, evaluationId: string) =>
  doc(db, paths.evaluation(boardId, evaluationId))

export function addEvaluation(
  boardId: string,
  title: string,
  formId: string,
  published: boolean,
  position: number,
) {
  return addDoc(evaluationsCollection(boardId), {
    title,
    formId,
    published,
    position,
    enabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies EvaluationDoc)
}

export function updateEvaluation(
  boardId: string,
  id: string,
  change: Partial<Pick<EvaluationDoc, 'title' | 'enabled'>>,
) {
  return updateDoc(evaluationRef(boardId, id), {
    ...change,
    updatedAt: serverTimestamp(),
  })
}

export function swapEvaluations(
  boardId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  const batch = writeBatch(db)
  batch.update(evaluationRef(boardId, a.id), {
    position: b.position,
    updatedAt: serverTimestamp(),
  })
  batch.update(evaluationRef(boardId, b.id), {
    position: a.position,
    updatedAt: serverTimestamp(),
  })
  return batch.commit()
}

export function deleteEvaluation(boardId: string, id: string) {
  return deleteDoc(evaluationRef(boardId, id))
}
