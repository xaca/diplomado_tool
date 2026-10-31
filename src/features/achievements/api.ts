import {
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { paths, type AchievementKey } from '@/model'

// Achievements (M22): one key per write, paired with +1 on its counter (the rules check both).

export const achievementsCollection = (boardId: string) =>
  collection(db, paths.achievements(boardId))
export const achievementRef = (boardId: string, uid: string) =>
  doc(db, paths.achievement(boardId, uid))
export const countsRef = (boardId: string) =>
  doc(db, paths.achievementCounts(boardId))

/** Unlocks `key` for me. `exists`: my record is already there (else it's created). */
export function unlockAchievement(
  boardId: string,
  me: { uid: string; studentId: string },
  key: AchievementKey,
  exists: boolean,
) {
  const batch = writeBatch(db)
  batch.set(
    achievementRef(boardId, me.uid),
    {
      studentId: me.studentId,
      unlocked: { [key]: serverTimestamp() },
      ...(!exists && { classes: [] }),
      lastKey: key,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(
    countsRef(boardId),
    { [key]: increment(1), lastKey: key },
    { merge: true },
  )
  return batch.commit()
}

/** "Constante": remembers a class I wrote a note in. */
export function rememberClass(
  boardId: string,
  me: { uid: string; studentId: string },
  classId: string,
  exists: boolean,
) {
  return exists
    ? updateDoc(achievementRef(boardId, me.uid), {
        classes: arrayUnion(classId),
        updatedAt: serverTimestamp(),
      })
    : setDoc(achievementRef(boardId, me.uid), {
        studentId: me.studentId,
        unlocked: {},
        classes: [classId],
        lastKey: null,
        updatedAt: serverTimestamp(),
      })
}
