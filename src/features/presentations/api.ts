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
import { paths, type PresentationDoc } from '@/model'

export const presentationsCollection = (boardId: string) =>
  collection(db, paths.presentations(boardId))
export const presentationRef = (boardId: string, presentationId: string) =>
  doc(db, paths.presentation(boardId, presentationId))

export function addPresentation(
  boardId: string,
  title: string,
  presentationId: string,
  published: boolean,
  position: number,
) {
  return addDoc(presentationsCollection(boardId), {
    title,
    presentationId,
    published,
    position,
    enabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies PresentationDoc)
}

export function updatePresentation(
  boardId: string,
  id: string,
  change: Partial<Pick<PresentationDoc, 'title' | 'enabled'>>,
) {
  return updateDoc(presentationRef(boardId, id), {
    ...change,
    updatedAt: serverTimestamp(),
  })
}

export function swapPresentations(
  boardId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  const batch = writeBatch(db)
  batch.update(presentationRef(boardId, a.id), {
    position: b.position,
    updatedAt: serverTimestamp(),
  })
  batch.update(presentationRef(boardId, b.id), {
    position: a.position,
    updatedAt: serverTimestamp(),
  })
  return batch.commit()
}

export function deletePresentation(boardId: string, id: string) {
  return deleteDoc(presentationRef(boardId, id))
}
