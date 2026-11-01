import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  paths,
  type RecordingDoc,
  type RecordingInput,
  type RecordingVideo,
  type VideoProgress,
} from '@/model'

// Recorded classes (M23): the board's teacher writes the playlists; each member their own progress.

export const recordingsCollection = (boardId: string) =>
  collection(db, paths.recordings(boardId))
export const recordingRef = (boardId: string, recordingId: string) =>
  doc(db, paths.recording(boardId, recordingId))
export const progressCollection = (boardId: string) =>
  collection(db, paths.watchProgresses(boardId))
export const progressRef = (boardId: string, uid: string) =>
  doc(db, paths.watchProgress(boardId, uid))

export function addRecording(
  boardId: string,
  input: RecordingInput,
  videos: RecordingVideo[],
  position: number,
) {
  return addDoc(recordingsCollection(boardId), {
    ...input,
    position,
    videos,
    titles: {},
    hidden: [],
    syncedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies RecordingDoc)
}

/** The teacher's changes: the playlist's title, their own video titles, hidden videos. */
export function updateRecording(
  boardId: string,
  recordingId: string,
  change: Partial<Pick<RecordingDoc, 'title' | 'titles' | 'hidden'>>,
) {
  return updateDoc(recordingRef(boardId, recordingId), {
    ...change,
    updatedAt: serverTimestamp(),
  })
}

/** The playlist as just read from YouTube (new uploads, removed videos). */
export function saveVideos(
  boardId: string,
  recordingId: string,
  videos: RecordingVideo[],
) {
  return updateDoc(recordingRef(boardId, recordingId), {
    videos,
    syncedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Swaps two playlists' places */
export function swapRecordings(
  boardId: string,
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  const batch = writeBatch(db)
  batch.update(recordingRef(boardId, a.id), {
    position: b.position,
    updatedAt: serverTimestamp(),
  })
  batch.update(recordingRef(boardId, b.id), {
    position: a.position,
    updatedAt: serverTimestamp(),
  })
  return batch.commit()
}

/** Removes the playlist from the app (YouTube is never touched) */
export function deleteRecording(boardId: string, recordingId: string) {
  return deleteDoc(recordingRef(boardId, recordingId))
}

/** Where I am in one video (merged into my progress document) */
export function saveProgress(
  boardId: string,
  me: { uid: string; studentId: string },
  videoId: string,
  progress: VideoProgress,
) {
  return setDoc(
    progressRef(boardId, me.uid),
    {
      studentId: me.studentId,
      videos: { [videoId]: progress },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
