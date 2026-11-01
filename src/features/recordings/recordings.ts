import {
  MAX_RECORDING_VIDEOS,
  MAX_VIDEO_TITLE,
  YOUTUBE_LIST_ID,
  type RecordingDoc,
  type RecordingVideo,
  type VideoProgress,
} from '@/model'

// Recorded classes (M23): pure logic, unit-tested. No YouTube or Firebase here.

export type PlaylistLinkResult =
  | { ok: true; listId: string }
  | { ok: false; reason: 'empty' | 'noList' | 'notPlaylist' }

/**
 * The playlist id from whatever the teacher pastes: a playlist link, a video link with
 * `&list=…`, a youtu.be link, or the id itself. "Watch later", likes and mixes are personal or
 * generated lists that can't be embedded for others.
 */
export function parsePlaylistLink(input: string): PlaylistLinkResult {
  const text = input.trim()
  if (!text) return { ok: false, reason: 'empty' }
  let listId: string | null
  if (YOUTUBE_LIST_ID.test(text) && !text.includes('.')) listId = text
  else {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
      const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
      if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host))
        return { ok: false, reason: 'noList' }
      listId = url.searchParams.get('list')
    } catch {
      return { ok: false, reason: 'noList' }
    }
  }
  if (!listId || !YOUTUBE_LIST_ID.test(listId))
    return { ok: false, reason: 'noList' }
  // WL = watch later, LL = liked videos, RD… = mixes made by YouTube
  if (/^(WL|LL|LM)$/.test(listId) || listId.startsWith('RD'))
    return { ok: false, reason: 'notPlaylist' }
  return { ok: true, listId }
}

/**
 * The playlist as YouTube has it now (`ids`, in its order), with what we already knew about each
 * video, plus anything just read (`read`). Videos removed from the playlist go away.
 */
export function mergePlaylist(
  saved: readonly RecordingVideo[],
  ids: readonly string[],
  read: ReadonlyMap<string, RecordingVideo> = new Map(),
): RecordingVideo[] {
  const known = new Map(saved.map((video) => [video.id, video]))
  return [...new Set(ids)].slice(0, MAX_RECORDING_VIDEOS).map((id) => {
    const fresh = read.get(id)
    const old = known.get(id)
    return {
      id,
      title: (fresh?.title || old?.title || '').slice(0, MAX_VIDEO_TITLE),
      seconds: fresh?.seconds || old?.seconds || 0,
      playable: fresh?.playable ?? old?.playable ?? true,
    }
  })
}

/** The ids we still need to read (new ones, or ones we never got a title or length for). */
export function missingInfo(
  saved: readonly RecordingVideo[],
  ids: readonly string[],
) {
  const known = new Map(saved.map((video) => [video.id, video]))
  return ids.filter((id) => {
    const video = known.get(id)
    return !video || !video.title || !video.seconds
  })
}

export function sameVideos(
  a: readonly RecordingVideo[],
  b: readonly RecordingVideo[],
) {
  return (
    a.length === b.length &&
    a.every(
      (video, index) =>
        video.id === b[index].id &&
        video.title === b[index].title &&
        video.seconds === b[index].seconds &&
        video.playable === b[index].playable,
    )
  )
}

export type ShownVideo = RecordingVideo & {
  /** 1-based number in the playlist ("Clase 3") */
  number: number
  hidden: boolean
}

/** The videos as shown: the teacher's titles, and hidden ones left out (except for the teacher). */
export function shownVideos(
  recording: Pick<RecordingDoc, 'titles' | 'hidden'>,
  videos: readonly RecordingVideo[],
  withHidden = false,
): ShownVideo[] {
  const hidden = new Set(recording.hidden)
  return videos
    .map((video, index) => ({
      ...video,
      title: recording.titles[video.id] || video.title,
      number: index + 1,
      hidden: hidden.has(video.id),
    }))
    .filter((video) => withHidden || !video.hidden)
}

/** "3:48:13", "23:10", "0:42" */
export function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** A video counts as watched at 90 % (D97) */
export const WATCHED_SHARE = 0.9
/** Opening a video resumes where I left off, unless I was in its last 30 s */
export const RESUME_END_MARGIN = 30
/** While playing, progress is saved at most once a minute (and on pause / leave) */
export const SAVE_EVERY_MS = 60_000

export function isWatched(at: number, seconds: number) {
  return seconds > 0 && at >= seconds * WATCHED_SHARE
}

/** Where to start a video: the last position, unless near the start or the end. */
export function resumeAt(progress: VideoProgress | undefined) {
  if (!progress) return 0
  if (progress.at < 5) return 0
  if (progress.seconds && progress.at > progress.seconds - RESUME_END_MARGIN)
    return 0
  return Math.floor(progress.at)
}

/** My new progress in a video; "watched" never goes back once reached. */
export function nextProgress(
  old: VideoProgress | undefined,
  at: number,
  seconds: number,
): VideoProgress {
  const length = seconds || old?.seconds || 0
  return {
    at: Math.max(0, Math.floor(at)),
    seconds: Math.floor(length),
    watched: !!old?.watched || isWatched(at, length),
  }
}

/** 0–100, for the bar under a video ("vas en 23:10") */
export function progressPercent(progress: VideoProgress | undefined) {
  if (!progress) return 0
  if (progress.watched) return 100
  if (!progress.seconds) return 0
  return Math.min(100, Math.round((progress.at / progress.seconds) * 100))
}

/** Save now? On pause / end / leave always; while playing, once a minute. */
export function shouldSave(
  reason: 'tick' | 'pause' | 'end' | 'leave',
  lastSavedAt: number,
  now: number,
) {
  return reason !== 'tick' || now - lastSavedAt >= SAVE_EVERY_MS
}

/** The first video I haven't watched (after `afterId`, if given), else null. */
export function nextUnwatched<T extends { id: string; playable: boolean }>(
  videos: readonly T[],
  progress: Record<string, VideoProgress> | undefined,
  afterId?: string,
) {
  const start = afterId
    ? videos.findIndex((video) => video.id === afterId) + 1
    : 0
  return (
    videos
      .slice(start)
      .find((video) => video.playable && !progress?.[video.id]?.watched) ?? null
  )
}

/** How many students watched each video (the teacher's view, D96). */
export function watchedCounts(
  everyone: readonly { videos?: Record<string, VideoProgress> }[],
) {
  const counts = new Map<string, number>()
  for (const person of everyone)
    for (const [id, progress] of Object.entries(person.videos ?? {}))
      if (progress.watched) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

/** YouTube's public thumbnail for a video (no API key) */
export const thumbnailUrl = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
