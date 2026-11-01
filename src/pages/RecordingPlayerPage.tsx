import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  CircleCheck,
  ExternalLink,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useClassAccess } from '@/features/classes/use-class-access'
import { saveProgress } from '@/features/recordings/api'
import {
  useLivePlaylist,
  useMyProgress,
  useRecording,
} from '@/features/recordings/hooks'
import {
  formatTime,
  isWatched,
  nextProgress,
  nextUnwatched,
  progressPercent,
  resumeAt,
  shouldSave,
  shownVideos,
  thumbnailUrl,
  type ShownVideo,
} from '@/features/recordings/recordings'
import {
  isEmbedError,
  loadYouTube,
  PLAYER_HOST,
  PlayerState,
  playerVars,
  type YouTubePlayer,
} from '@/features/recordings/youtube'
import { cn } from '@/lib/utils'
import type { VideoProgress } from '@/model'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]
const SKIP_SECONDS = 10

type SaveReason = 'tick' | 'pause' | 'end' | 'leave'

/**
 * YouTube's player (privacy-enhanced) with study controls under it: ±10 s, play / pause,
 * previous / next class, speed, full screen and the keyboard (D97). Reports where the viewer is
 * on pause, at the end, on leaving and once a minute while playing.
 */
function StudyPlayer({
  videoId,
  startAt,
  prev,
  next,
  onPick,
  onSave,
}: {
  videoId: string
  startAt: number
  prev: ShownVideo | null
  next: ShownVideo | null
  onPick: (videoId: string) => void
  onSave: (videoId: string, at: number, seconds: number) => void
}) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const player = useRef<YouTubePlayer | null>(null)
  const position = useRef({ id: videoId, at: startAt, seconds: 0 })
  const lastSaved = useRef(0)
  const onSaveRef = useRef(onSave)
  const [state, setState] = useState<number>(PlayerState.unstarted)
  const [time, setTime] = useState({ at: startAt, seconds: 0 })
  const [rate, setRate] = useState(1)
  const [error, setError] = useState<number | null>(null)

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const save = useCallback((reason: SaveReason) => {
    const { id, at, seconds } = position.current
    if (!at && !seconds) return
    const now = Date.now()
    if (!shouldSave(reason, lastSaved.current, now)) return
    lastSaved.current = now
    onSaveRef.current(id, at, seconds)
  }, [])

  // One player for the page; changing videos reuses it
  useEffect(() => {
    let cancelled = false
    let created: YouTubePlayer | null = null
    const initial = position.current
    loadYouTube().then(
      (YT) => {
        if (cancelled || !mount.current) return
        created = new YT.Player(mount.current, {
          host: PLAYER_HOST,
          width: '100%',
          height: '100%',
          videoId: initial.id,
          playerVars: playerVars({ start: initial.at }),
          events: {
            onReady: (event) => {
              player.current = event.target
              // the video changed while the player was loading
              const wanted = position.current
              if (wanted.id !== initial.id)
                event.target.cueVideoById({
                  videoId: wanted.id,
                  startSeconds: wanted.at,
                })
            },
            onStateChange: (event) => {
              setState(event.data)
              if (event.data === PlayerState.paused) save('pause')
              if (event.data === PlayerState.ended) {
                position.current.at = position.current.seconds
                save('end')
              }
            },
            onError: (event) => setError(event.data),
            onPlaybackRateChange: (event) => setRate(event.data),
          },
        })
      },
      () => setError(-1),
    )
    const leave = () => save('leave')
    const hidden = () => document.visibilityState === 'hidden' && leave()
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      cancelled = true
      window.removeEventListener('pagehide', leave)
      document.removeEventListener('visibilitychange', hidden)
      leave()
      created?.destroy()
      player.current = null
    }
  }, [save])

  // Another class: save where I was in this one, then load it
  useEffect(() => {
    if (videoId === position.current.id) return
    save('leave')
    position.current = { id: videoId, at: startAt, seconds: 0 }
    lastSaved.current = 0
    setError(null)
    setTime({ at: startAt, seconds: 0 })
    player.current?.loadVideoById({ videoId, startSeconds: startAt })
  }, [videoId, startAt, save])

  // Where am I (twice a second); saved once a minute while playing
  useEffect(() => {
    const timer = setInterval(() => {
      const current = player.current
      if (!current) return
      const data = current.getVideoData()
      if (data?.video_id && data.video_id !== position.current.id) return
      const at = current.getCurrentTime() || 0
      const seconds = current.getDuration() || position.current.seconds
      position.current = { ...position.current, at, seconds }
      setTime({ at, seconds })
      if (current.getPlayerState() === PlayerState.playing) save('tick')
    }, 500)
    return () => clearInterval(timer)
  }, [save])

  const playing = state === PlayerState.playing
  const toggle = useCallback(() => {
    const current = player.current
    if (!current) return
    if (current.getPlayerState() === PlayerState.playing) current.pauseVideo()
    else current.playVideo()
  }, [])
  const skip = useCallback((by: number) => {
    const current = player.current
    if (!current) return
    const seconds = current.getDuration() || Infinity
    const to = Math.min(
      Math.max(0, (current.getCurrentTime() || 0) + by),
      seconds,
    )
    current.seekTo(to, true)
    position.current.at = to
    setTime((value) => ({ ...value, at: to }))
  }, [])
  const changeRate = useCallback((value: number) => {
    player.current?.setPlaybackRate(value)
    setRate(value)
  }, [])
  const stepRate = useCallback(
    (by: number) => {
      const index = SPEEDS.indexOf(player.current?.getPlaybackRate() ?? rate)
      const nextIndex = Math.min(
        SPEEDS.length - 1,
        Math.max(0, (index < 0 ? 1 : index) + by),
      )
      changeRate(SPEEDS[nextIndex])
    },
    [rate, changeRate],
  )
  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void box.current?.requestFullscreen?.()
  }, [])

  // Keyboard (while the page has focus; inside YouTube's frame its own keys apply)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]')
      )
        return
      const key = event.key
      if (key === ' ' || key === 'k' || key === 'K') {
        // a focused button would also "click" on space
        event.preventDefault()
        toggle()
      } else if (key === 'ArrowLeft' || key === 'j' || key === 'J') {
        event.preventDefault()
        skip(-SKIP_SECONDS)
      } else if (key === 'ArrowRight' || key === 'l' || key === 'L') {
        event.preventDefault()
        skip(SKIP_SECONDS)
      } else if (key === '<' || key === ',') stepRate(-1)
      else if (key === '>' || key === '.') stepRate(1)
      else if (key === 'f' || key === 'F') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, skip, stepRate, fullscreen])

  const done = isWatched(time.at, time.seconds)

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={box}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-black"
      >
        <div ref={mount} className="size-full" data-testid="player" />
        {error !== null && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center text-white"
            data-testid="player-error"
          >
            <p>
              {error === -1
                ? t('recordings.offline')
                : isEmbedError(error)
                  ? t('recordings.cantEmbed')
                  : t('recordings.playerError')}
            </p>
            <Button
              variant="secondary"
              nativeButton={false}
              render={
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink />
              {t('recordings.openYouTube')}
            </Button>
          </div>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1.5"
        role="toolbar"
        aria-label={t('recordings.controls')}
      >
        <Button
          variant="ghost"
          size="icon"
          disabled={!prev}
          aria-label={t('recordings.prev')}
          title={t('recordings.prev')}
          onClick={() => prev && onPick(prev.id)}
        >
          <SkipBack />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('recordings.back10')}
          title={`${t('recordings.back10')} (←)`}
          onClick={() => skip(-SKIP_SECONDS)}
        >
          <RotateCcw />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? t('recordings.pause') : t('recordings.play')}
          title={`${playing ? t('recordings.pause') : t('recordings.play')} (k)`}
          onClick={toggle}
          data-testid="play-pause"
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('recordings.forward10')}
          title={`${t('recordings.forward10')} (→)`}
          onClick={() => skip(SKIP_SECONDS)}
        >
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!next}
          aria-label={t('recordings.next')}
          title={t('recordings.next')}
          onClick={() => next && onPick(next.id)}
        >
          <SkipForward />
        </Button>
        <span
          className="px-2 text-sm text-muted-foreground tabular-nums"
          data-testid="time"
        >
          {formatTime(time.at)}
          {time.seconds > 0 && ` / ${formatTime(time.seconds)}`}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <label className="sr-only" htmlFor="speed">
            {t('recordings.speed')}
          </label>
          <select
            id="speed"
            value={rate}
            onChange={(event) => changeRate(Number(event.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-sm"
            title={`${t('recordings.speed')} (< >)`}
            data-testid="speed"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('recordings.fullscreen')}
            title={`${t('recordings.fullscreen')} (f)`}
            onClick={fullscreen}
          >
            <Maximize />
          </Button>
        </span>
      </div>

      {done && next && (
        <button
          type="button"
          onClick={() => onPick(next.id)}
          className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-900 hover:bg-emerald-100"
          data-testid="up-next"
        >
          <CircleCheck className="size-4 shrink-0" />
          <span>
            {t('recordings.upNext', {
              title: next.title || t('recordings.untitled'),
            })}
          </span>
        </button>
      )}
      <p className="hidden text-xs text-muted-foreground sm:block">
        {t('recordings.keys')}
      </p>
    </div>
  )
}

/**
 * A recorded class (M23): the player made for studying, with the playlist beside it (below on
 * phones). Opening a class resumes where I left off; at 90 % it counts as watched.
 */
export function RecordingPlayerPage() {
  const { t } = useTranslation()
  const { boardId = '', recordingId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const access = useClassAccess(boardId)
  const recording = useRecording(boardId, recordingId, access.allowed)
  const live = useLivePlaylist(boardId, recording.data ?? null, access.teacher)
  const mine = useMyProgress(access.member ? boardId : undefined, access.uid)
  const progress = mine.data?.videos
  const progressRef = useRef<Record<string, VideoProgress> | undefined>(
    progress,
  )
  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  const { uid, studentId, member } = access
  const onSave = useCallback(
    (videoId: string, at: number, seconds: number) => {
      if (!member || !uid || !studentId) return
      void saveProgress(
        boardId,
        { uid, studentId },
        videoId,
        nextProgress(progressRef.current?.[videoId], at, seconds),
      ).catch(() => {})
    },
    [boardId, member, uid, studentId],
  )

  const videos = recording.data
    ? shownVideos(recording.data, live.videos, access.teacher)
    : []
  const requested = params.get('v')
  const found = videos.find((video) => video.id === requested)
  // A class just uploaded may not be in the saved list yet: wait for YouTube's
  const waiting = !!requested && !found && live.status === 'reading'
  const current =
    found ??
    (waiting ? null : (nextUnwatched(videos, progress) ?? videos[0] ?? null))
  const index = current ? videos.indexOf(current) : -1
  const prev = index > 0 ? videos[index - 1] : null
  const next = index >= 0 ? (videos[index + 1] ?? null) : null
  // Where to start: decided once per class (not on every progress save)
  const [start, setStart] = useState<{ id: string; at: number } | null>(null)
  const progressReady = !access.member || !mine.loading
  if (current && progressReady && start?.id !== current.id)
    setStart({ id: current.id, at: resumeAt(progress?.[current.id]) })

  const pick = useCallback(
    (videoId: string) => setParams({ v: videoId }),
    [setParams],
  )
  // The class on screen stays visible in the list beside the player
  const list = useRef<HTMLOListElement>(null)
  const currentId = current?.id
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  if (!recording.loading && !access.loading && !recording.data)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('recordings.gone')}</p>
      </section>
    )

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
      <Link
        to={`/b/${boardId}/videos`}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('recordings.title')}
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          {current && start?.id === current.id ? (
            <>
              <StudyPlayer
                videoId={current.id}
                startAt={start.at}
                prev={prev}
                next={next}
                onPick={pick}
                onSave={onSave}
              />
              <div>
                <p className="text-sm text-muted-foreground">
                  {recording.data?.title} ·{' '}
                  {t('recordings.number', { n: current.number })}
                </p>
                <h1
                  className="font-heading text-xl font-semibold"
                  data-testid="playing-title"
                >
                  {current.title || t('recordings.untitled')}
                </h1>
              </div>
            </>
          ) : recording.loading || waiting || !progressReady ? (
            <Skeleton className="aspect-video w-full rounded-xl" />
          ) : (
            <p className="text-muted-foreground">{t('recordings.empty')}</p>
          )}
        </div>

        <aside className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">
            {recording.data?.title}{' '}
            <span className="font-normal text-muted-foreground">
              · {t('recordings.count', { count: videos.length })}
            </span>
          </h2>
          <ol
            ref={list}
            className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto"
          >
            {videos.map((video) => {
              const mineHere = progress?.[video.id]
              const percent = progressPercent(mineHere)
              return (
                <li key={video.id}>
                  <button
                    type="button"
                    onClick={() => pick(video.id)}
                    aria-current={video.id === current?.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-muted',
                      video.id === current?.id && 'bg-muted',
                      video.hidden && 'opacity-60',
                    )}
                    data-testid="playlist-item"
                  >
                    <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-muted">
                      <img
                        src={thumbnailUrl(video.id)}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      {percent > 0 && (
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
                          <span
                            className="block h-full bg-red-600"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="line-clamp-2 text-sm font-medium">
                        {video.title || t('recordings.untitled')}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {mineHere?.watched && (
                          <CircleCheck className="size-3 text-emerald-600" />
                        )}
                        {t('recordings.number', { n: video.number })}
                        {video.seconds > 0 && ` · ${formatTime(video.seconds)}`}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>
      </div>
    </section>
  )
}
