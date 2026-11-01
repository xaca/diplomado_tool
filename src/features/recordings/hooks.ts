import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  progressCollection,
  progressRef,
  recordingRef,
  recordingsCollection,
  saveVideos,
} from '@/features/recordings/api'
import {
  mergePlaylist,
  missingInfo,
  sameVideos,
} from '@/features/recordings/recordings'
import {
  readPlaylistCached,
  PlaylistReadError,
  type PlaylistRead,
} from '@/features/recordings/youtube'
import { useLiveDoc, useLiveQuery, type WithId } from '@/lib/firestore-hooks'
import type { RecordingDoc, WatchProgressDoc } from '@/model'

/** The board's playlists, in the teacher's order */
export function useRecordings(boardId: string | undefined, enabled = true) {
  const list = useLiveQuery<RecordingDoc>(
    enabled && boardId ? recordingsCollection(boardId) : null,
    `recordings:${boardId}:${enabled}`,
  )
  const data = useMemo(
    () => [...list.data].sort((a, b) => a.position - b.position),
    [list.data],
  )
  return { ...list, data }
}

export function useRecording(
  boardId: string | undefined,
  recordingId: string | undefined,
  enabled = true,
) {
  return useLiveDoc<RecordingDoc>(
    enabled && boardId && recordingId
      ? recordingRef(boardId, recordingId)
      : null,
    `recording:${boardId}:${recordingId}:${enabled}`,
  )
}

/** My progress on this board (members only) */
export function useMyProgress(
  boardId: string | undefined,
  uid: string | undefined,
) {
  return useLiveDoc<WatchProgressDoc>(
    boardId && uid ? progressRef(boardId, uid) : null,
    `watchProgress:${boardId}:${uid}`,
  )
}

/** Everybody's progress (the board's teacher only: who watched) */
export function useAllProgress(boardId: string | undefined, enabled: boolean) {
  return useLiveQuery<WatchProgressDoc>(
    enabled && boardId ? progressCollection(boardId) : null,
    `allWatchProgress:${boardId}:${enabled}`,
  )
}

export type PlaylistSync = 'reading' | 'done' | 'notFound' | 'unavailable'

/**
 * The playlist as YouTube has it now (D95): read again whenever someone opens it, so new
 * uploads show up on their own. Until the read finishes (or if YouTube can't be reached), the
 * saved list is shown. The teacher's browser saves what changed, so students' pages start from
 * an up-to-date list next time.
 */
export function useLivePlaylist(
  boardId: string,
  recording: WithId<RecordingDoc> | null,
  canSave: boolean,
) {
  const [live, setLive] = useState<{
    key: string
    read: PlaylistRead | null
    status: PlaylistSync
  } | null>(null)
  const listId = recording?.listId
  const key = `${recording?.id}:${listId}`
  const saved = recording?.videos

  // Results arrive asynchronously; a new key shows "reading" until its own result
  const read = useCallback(
    (force: boolean) => {
      if (!listId || !saved) return
      readPlaylistCached(listId, (ids) => missingInfo(saved, ids), force).then(
        (result) => setLive({ key, read: result, status: 'done' }),
        (error: unknown) =>
          setLive((current) => ({
            key,
            read: current?.key === key ? current.read : null,
            status:
              error instanceof PlaylistReadError && error.reason === 'notFound'
                ? 'notFound'
                : 'unavailable',
          })),
      )
    },
    // the saved list only decides which videos need a title; a new snapshot doesn't re-read
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  useEffect(() => read(false), [read])

  const current = live?.key === key ? live : null
  const fresh = current?.read
  const videos = useMemo(
    () =>
      saved && fresh
        ? mergePlaylist(saved, fresh.ids, fresh.read)
        : (saved ?? []),
    [saved, fresh],
  )

  // The teacher keeps the saved list up to date
  useEffect(() => {
    if (!canSave || !recording || !fresh || !saved) return
    if (sameVideos(videos, saved)) return
    void saveVideos(boardId, recording.id, videos).catch(() => {})
  }, [canSave, boardId, recording, fresh, saved, videos])

  return {
    videos,
    status: current?.status ?? 'reading',
    refresh: () => {
      setLive((value) =>
        value?.key === key ? { ...value, status: 'reading' } : value,
      )
      read(true)
    },
  }
}
