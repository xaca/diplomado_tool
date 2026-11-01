import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CircleCheck, EyeOff, Play, RefreshCw, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BoardSections } from '@/features/classes/components/BoardSections'
import { useClassAccess } from '@/features/classes/use-class-access'
import {
  formatTime,
  nextUnwatched,
  progressPercent,
  shownVideos,
  thumbnailUrl,
  watchedCounts,
  type ShownVideo,
} from '@/features/recordings/recordings'
import {
  useAllProgress,
  useLivePlaylist,
  useMyProgress,
  useRecordings,
} from '@/features/recordings/hooks'
import { useSpaces } from '@/features/spaces/hooks'
import type { WithId } from '@/lib/firestore-hooks'
import type { RecordingDoc, VideoProgress, WatchProgressDoc } from '@/model'

/** A video's row: thumbnail, number, title, length and my progress (or, for the teacher, who watched). */
function VideoRow({
  video,
  href,
  progress,
  latest,
  watchers,
}: {
  video: ShownVideo
  href: string
  progress?: VideoProgress
  latest: boolean
  watchers?: { count: number; total: number; names: string[] }
}) {
  const { t } = useTranslation()
  const percent = progressPercent(progress)
  return (
    <li data-testid="video" data-video={video.id}>
      <Link
        to={href}
        className="flex items-center gap-3 rounded-xl border bg-card p-2 transition-colors hover:bg-muted/50"
      >
        <span className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-44">
          <img
            src={thumbnailUrl(video.id)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
          {video.seconds > 0 && (
            <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 text-xs text-white tabular-nums">
              {formatTime(video.seconds)}
            </span>
          )}
          {percent > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
              <span
                className="block h-full bg-red-600"
                style={{ width: `${percent}%` }}
              />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t('recordings.number', { n: video.number })}
            </span>
            {latest && <Badge>{t('recordings.latest')}</Badge>}
            {video.hidden && (
              <Badge variant="outline">
                <EyeOff />
                {t('recordings.hidden')}
              </Badge>
            )}
            {!video.playable && (
              <Badge variant="destructive">{t('recordings.notPlayable')}</Badge>
            )}
          </span>
          <span className="line-clamp-2 font-medium" data-testid="video-title">
            {video.title || t('recordings.untitled')}
          </span>
          {watchers ? (
            <span
              className="text-sm text-muted-foreground"
              data-testid="watchers"
              title={watchers.names.join(', ')}
            >
              {t('recordings.watchers', {
                count: watchers.count,
                total: watchers.total,
              })}
            </span>
          ) : progress?.watched ? (
            <span
              className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400"
              data-testid="watched"
            >
              <CircleCheck className="size-4" />
              {t('recordings.watched')}
            </span>
          ) : progress && progress.at > 0 ? (
            <span className="text-sm text-muted-foreground" data-testid="at">
              {t('recordings.at', { time: formatTime(progress.at) })}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}

/** One playlist: its videos as YouTube has them now, newest last (the playlist's order). */
function PlaylistSection({
  boardId,
  recording,
  teacher,
  progress,
  everyone,
  names,
  students,
}: {
  boardId: string
  recording: WithId<RecordingDoc>
  teacher: boolean
  progress?: Record<string, VideoProgress>
  everyone: WithId<WatchProgressDoc>[]
  names: Map<string, string>
  students: number
}) {
  const { t } = useTranslation()
  const live = useLivePlaylist(boardId, recording, teacher)
  const videos = shownVideos(recording, live.videos, teacher)
  const visible = videos.filter((video) => !video.hidden)
  const latest = visible.at(-1)
  const next = nextUnwatched(visible, progress)
  const counts = useMemo(() => watchedCounts(everyone), [everyone])
  const href = (videoId: string) =>
    `/b/${boardId}/videos/${recording.id}?v=${videoId}`

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="playlist"
      data-recording={recording.id}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{recording.title}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {t('recordings.count', { count: visible.length })}
            {live.status === 'reading' && (
              <span className="flex items-center gap-1" data-testid="syncing">
                · <RefreshCw className="size-3 animate-spin" />
                {t('recordings.syncing')}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && !teacher && next.id !== latest?.id && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={href(next.id)} />}
            >
              <Play />
              {t('recordings.continue')}
            </Button>
          )}
          {latest && (
            <Button nativeButton={false} render={<Link to={href(latest.id)} />}>
              <Play />
              {t('recordings.watchLatest')}
            </Button>
          )}
        </div>
      </div>
      {live.status === 'notFound' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('recordings.notFound')}
        </p>
      )}
      {videos.length === 0 && live.status !== 'reading' ? (
        <p className="text-sm text-muted-foreground">{t('recordings.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {videos.map((video) => {
            const who = everyone
              .filter((person) => person.videos?.[video.id]?.watched)
              .map((person) => names.get(person.studentId) ?? '')
            return (
              <VideoRow
                key={video.id}
                video={video}
                href={href(video.id)}
                progress={progress?.[video.id]}
                latest={video.id === latest?.id}
                watchers={
                  teacher
                    ? {
                        count: counts.get(video.id) ?? 0,
                        total: students,
                        names: who,
                      }
                    : undefined
                }
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * "Grabaciones" (M23): the board's recorded classes, from the YouTube playlists the teacher
 * linked in Administrar. Each playlist is read again on opening, so new classes appear on their
 * own; students see their progress, the teacher how many watched each class (D96).
 */
export function RecordingsPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  const recordings = useRecordings(boardId, access.allowed)
  const mine = useMyProgress(access.member ? boardId : undefined, access.uid)
  const everyone = useAllProgress(boardId, access.teacher)
  const spaces = useSpaces(access.teacher ? boardId : undefined, null)
  const names = useMemo(
    () => new Map(spaces.data.map((space) => [space.id, space.ownerName])),
    [spaces.data],
  )

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const loading = access.loading || recordings.loading

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-6">
      <BoardSections boardId={boardId} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {access.board.data?.title}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            🎬 {t('recordings.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {access.teacher
              ? t('recordings.teacherHint')
              : t('recordings.hint')}
          </p>
        </div>
        {access.teacher && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/teacher/boards/${boardId}#recordings`} />}
          >
            <Settings />
            {t('recordings.manage')}
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : recordings.data.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"
          data-testid="no-recordings"
        >
          {access.teacher ? t('recordings.noneTeacher') : t('recordings.none')}
        </p>
      ) : (
        recordings.data.map((recording) => (
          <PlaylistSection
            key={recording.id}
            boardId={boardId}
            recording={recording}
            teacher={access.teacher}
            progress={mine.data?.videos}
            everyone={everyone.data}
            names={names}
            students={spaces.data.length}
          />
        ))
      )}
    </section>
  )
}
