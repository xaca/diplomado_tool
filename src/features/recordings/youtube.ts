import { MAX_VIDEO_TITLE, type RecordingVideo } from '@/model'

// YouTube IFrame Player API (free, no key), loaded once and only on the recordings pages (M23).
// The e2e tests serve a fake of iframe_api at the network level; nothing here knows about it.

export const PlayerState = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const

export type YouTubePlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  cueVideoById(options: { videoId: string; startSeconds?: number }): void
  loadVideoById(options: { videoId: string; startSeconds?: number }): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  getPlaylist(): string[] | null
  getVideoData(): {
    video_id?: string
    title?: string
    isPlayable?: boolean
  } | null
  getIframe(): HTMLIFrameElement
  destroy(): void
}

type PlayerOptions = {
  host?: string
  width?: number | string
  height?: number | string
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void
    onError?: (event: { data: number; target: YouTubePlayer }) => void
    onPlaybackRateChange?: (event: { data: number }) => void
  }
}

type YouTubeApi = {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeApi & { loaded?: number }
    onYouTubeIframeAPIReady?: () => void
  }
}

/** Privacy-enhanced mode (D98) */
export const PLAYER_HOST = 'https://www.youtube-nocookie.com'
const API_URL = 'https://www.youtube.com/iframe_api'

let api: Promise<YouTubeApi> | null = null

export function loadYouTube(): Promise<YouTubeApi> {
  if (api) return api
  api = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player && window.YT.loaded) return resolve(window.YT)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT!)
    }
    const script = document.createElement('script')
    script.src = API_URL
    script.async = true
    script.onerror = () => {
      api = null
      reject(new Error('youtube api failed to load'))
    }
    document.head.appendChild(script)
  })
  return api
}

/** Player options shared by the hidden reader and the visible player */
export function playerVars(extra: Record<string, string | number> = {}) {
  return {
    origin: window.location.origin,
    rel: 0,
    playsinline: 1,
    ...extra,
  }
}

/** 100 = removed / private, 101 and 150 = the owner turned embedding off */
export const isEmbedError = (code: number) =>
  code === 100 || code === 101 || code === 150 || code === 153

export class PlaylistReadError extends Error {
  reason: 'notFound' | 'unavailable'
  constructor(reason: 'notFound' | 'unavailable') {
    super(`playlist ${reason}`)
    this.reason = reason
  }
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

export type PlaylistRead = {
  ids: string[]
  /** What was read about the videos asked for (`needInfo`) */
  read: Map<string, RecordingVideo>
}

/**
 * Reads a playlist with a hidden player: every video id in YouTube's order, and the title and
 * length of each id in `needInfo(ids)` (cued one by one, ~0.2 s each). Unlisted videos are
 * included; YouTube's feeds leave them out, which is why this goes through the player.
 */
export async function readPlaylist(
  listId: string,
  needInfo: (ids: string[]) => string[],
): Promise<PlaylistRead> {
  const YT = await loadYouTube().catch(() => {
    throw new PlaylistReadError('unavailable')
  })
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:320px;height:180px;pointer-events:none'
  const mount = document.createElement('div')
  host.appendChild(mount)
  document.body.appendChild(host)
  // the latest player error (set by onError, cleared before each video is read)
  const failure: { code: number | null } = { code: null }
  try {
    const player = await new Promise<YouTubePlayer>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new PlaylistReadError('unavailable')),
        20_000,
      )
      new YT.Player(mount, {
        host: PLAYER_HOST,
        width: 320,
        height: 180,
        playerVars: playerVars({ listType: 'playlist', list: listId }),
        events: {
          onReady: (event) => {
            clearTimeout(timer)
            resolve(event.target)
          },
          onError: (event) => {
            failure.code = event.data
          },
        },
      })
    })
    let ids: string[] = []
    for (let i = 0; i < 60 && !ids.length; i++) {
      ids = player.getPlaylist() ?? []
      if (!ids.length) await wait(250)
    }
    if (!ids.length) throw new PlaylistReadError('notFound')

    const read = new Map<string, RecordingVideo>()
    for (const id of needInfo(ids)) {
      failure.code = null
      player.cueVideoById({ videoId: id })
      let data = player.getVideoData()
      let seconds = 0
      for (let i = 0; i < 50; i++) {
        await wait(100)
        data = player.getVideoData()
        seconds = player.getDuration()
        if (failure.code !== null || (data?.video_id === id && seconds > 0))
          break
      }
      const known = data?.video_id === id
      read.set(id, {
        id,
        title: known ? (data?.title ?? '').slice(0, MAX_VIDEO_TITLE) : '',
        seconds: known ? Math.round(seconds) : 0,
        playable:
          !(failure.code !== null && isEmbedError(failure.code)) &&
          !(known && data?.isPlayable === false),
      })
    }
    player.destroy()
    return { ids, read }
  } finally {
    host.remove()
  }
}

const CACHE_MS = 5 * 60_000
const cache = new Map<string, { at: number; read: Promise<PlaylistRead> }>()

/** readPlaylist, at most once every 5 minutes per playlist (moving between pages reuses it). */
export function readPlaylistCached(
  listId: string,
  needInfo: (ids: string[]) => string[],
  force = false,
) {
  const hit = cache.get(listId)
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.read
  const read = readPlaylist(listId, needInfo)
  cache.set(listId, { at: Date.now(), read })
  read.catch(() => cache.delete(listId))
  return read
}
