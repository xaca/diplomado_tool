import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addRecording,
  deleteRecording,
  swapRecordings,
  updateRecording,
} from '@/features/recordings/api'
import { useLivePlaylist, useRecordings } from '@/features/recordings/hooks'
import {
  formatTime,
  mergePlaylist,
  parsePlaylistLink,
  thumbnailUrl,
} from '@/features/recordings/recordings'
import {
  PlaylistReadError,
  readPlaylistCached,
} from '@/features/recordings/youtube'
import type { WithId } from '@/lib/firestore-hooks'
import {
  MAX_RECORDING_TITLE,
  MAX_VIDEO_TITLE,
  type RecordingDoc,
  type RecordingVideo,
} from '@/model'

const playlistUrl = (listId: string) =>
  `https://www.youtube.com/playlist?list=${listId}`

/** The videos read from YouTube, with a warning on the ones that can't play inside the app */
function VideoPreview({ videos }: { videos: RecordingVideo[] }) {
  const { t } = useTranslation()
  return (
    <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
      {videos.map((video, index) => (
        <li
          key={video.id}
          className="flex items-center gap-2 p-1 text-sm"
          data-testid="preview-video"
        >
          <img
            src={thumbnailUrl(video.id)}
            alt=""
            loading="lazy"
            className="aspect-video w-20 shrink-0 rounded bg-muted object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="line-clamp-1">
              {index + 1}. {video.title || t('recordings.untitled')}
            </span>
            <span className="text-xs text-muted-foreground">
              {video.seconds > 0 && formatTime(video.seconds)}
              {!video.playable && (
                <span className="text-destructive">
                  {' '}
                  · {t('recordings.notPlayableHint')}
                </span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Paste a playlist link, review what YouTube has, save. */
function AddPlaylist({
  boardId,
  position,
  onDone,
}: {
  boardId: string
  position: number
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [found, setFound] = useState<{
    listId: string
    videos: RecordingVideo[]
  } | null>(null)

  async function review() {
    const parsed = parsePlaylistLink(link)
    setFound(null)
    if (!parsed.ok) {
      setProblem(t(`recordings.linkErrors.${parsed.reason}`))
      return
    }
    setProblem(null)
    setReading(true)
    try {
      const read = await readPlaylistCached(parsed.listId, (ids) => ids, true)
      setFound({
        listId: parsed.listId,
        videos: mergePlaylist([], read.ids, read.read),
      })
    } catch (error) {
      setProblem(
        error instanceof PlaylistReadError && error.reason === 'notFound'
          ? t('recordings.linkErrors.notFound')
          : t('recordings.offline'),
      )
    } finally {
      setReading(false)
    }
  }

  async function save() {
    if (!found || !title.trim()) return
    setSaving(true)
    try {
      await addRecording(
        boardId,
        { title: title.trim(), listId: found.listId },
        found.videos,
        position,
      )
      toast.success(t('recordings.added'))
      onDone()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (found) void save()
        else void review()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recording-link">{t('recordings.link')}</Label>
          <Input
            id="recording-link"
            value={link}
            placeholder="https://www.youtube.com/playlist?list=…"
            onChange={(event) => {
              setLink(event.target.value)
              setFound(null)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recording-title">
            {t('recordings.playlistTitle')}
          </Label>
          <Input
            id="recording-title"
            value={title}
            maxLength={MAX_RECORDING_TITLE}
            placeholder={t('recordings.playlistTitlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      {found && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium" data-testid="found">
            {t('recordings.found', { count: found.videos.length })}
          </p>
          <VideoPreview videos={found.videos} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        {found ? (
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        ) : (
          <Button type="submit" disabled={reading || !link.trim()}>
            {reading ? <RefreshCw className="animate-spin" /> : <Search />}
            {reading ? t('recordings.reading') : t('recordings.review')}
          </Button>
        )}
      </div>
    </form>
  )
}

/** Rename the playlist, give videos your own titles, hide videos. */
function EditPlaylist({
  boardId,
  recording,
  videos,
  onClose,
}: {
  boardId: string
  recording: WithId<RecordingDoc>
  videos: RecordingVideo[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(recording.title)
  const [titles, setTitles] = useState(recording.titles)
  const [hidden, setHidden] = useState(new Set(recording.hidden))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const own = Object.fromEntries(
        Object.entries(titles)
          .map(([id, value]) => [id, value.trim()] as const)
          .filter(
            ([id, value]) =>
              value && value !== videos.find((video) => video.id === id)?.title,
          ),
      )
      await updateRecording(boardId, recording.id, {
        title: title.trim(),
        titles: own,
        // a video no longer in the playlist is forgotten
        hidden: [...hidden].filter((id) =>
          videos.some((video) => video.id === id),
        ),
      })
      toast.success(t('recordings.saved'))
      onClose()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('recordings.edit')}</DialogTitle>
          <DialogDescription>{t('recordings.editHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-recording-title">
            {t('recordings.playlistTitle')}
          </Label>
          <Input
            id="edit-recording-title"
            value={title}
            maxLength={MAX_RECORDING_TITLE}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <ol className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {videos.map((video, index) => {
            const off = hidden.has(video.id)
            return (
              <li
                key={video.id}
                className="flex items-center gap-2"
                data-testid="edit-video"
              >
                <span className="w-6 shrink-0 text-right text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  value={titles[video.id] ?? video.title}
                  maxLength={MAX_VIDEO_TITLE}
                  aria-label={t('recordings.videoTitle', { n: index + 1 })}
                  className={off ? 'opacity-50' : undefined}
                  onChange={(event) =>
                    setTitles((all) => ({
                      ...all,
                      [video.id]: event.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={off ? t('recordings.show') : t('recordings.hide')}
                  title={off ? t('recordings.show') : t('recordings.hide')}
                  onClick={() =>
                    setHidden((all) => {
                      const next = new Set(all)
                      if (off) next.delete(video.id)
                      else next.add(video.id)
                      return next
                    })
                  }
                >
                  {off ? <EyeOff /> : <Eye />}
                </Button>
              </li>
            )
          })}
        </ol>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={saving || !title.trim()}
            onClick={() => void save()}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** One linked playlist in Administrar (re-read from YouTube on opening, like everywhere). */
function PlaylistRow({
  boardId,
  recording,
  above,
  below,
}: {
  boardId: string
  recording: WithId<RecordingDoc>
  above?: WithId<RecordingDoc>
  below?: WithId<RecordingDoc>
}) {
  const { t } = useTranslation()
  const live = useLivePlaylist(boardId, recording, true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const shown = live.videos.filter(
    (video) => !recording.hidden.includes(video.id),
  ).length
  const blocked = live.videos.filter((video) => !video.playable).length

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-3"
      data-testid="recording-row"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{recording.title}</p>
          <p className="text-sm text-muted-foreground">
            {t('recordings.count', { count: shown })}
            {recording.hidden.length > 0 &&
              ` · ${t('recordings.hiddenCount', { count: recording.hidden.length })}`}
            {live.status === 'reading' && ` · ${t('recordings.syncing')}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!above}
          aria-label={t('stages.up')}
          onClick={() =>
            above && void swapRecordings(boardId, recording, above)
          }
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!below}
          aria-label={t('stages.down')}
          onClick={() =>
            below && void swapRecordings(boardId, recording, below)
          }
        >
          <ArrowDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('recordings.refresh')}
          title={t('recordings.refresh')}
          disabled={live.status === 'reading'}
          onClick={live.refresh}
        >
          <RefreshCw
            className={live.status === 'reading' ? 'animate-spin' : ''}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('recordings.openYouTube')}
          title={t('recordings.openYouTube')}
          nativeButton={false}
          render={
            <a
              href={playlistUrl(recording.listId)}
              target="_blank"
              rel="noreferrer"
            />
          }
        >
          <ExternalLink />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('recordings.edit')}
          title={t('recordings.edit')}
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.remove')}
          title={t('common.remove')}
          onClick={() => setDeleting(true)}
        >
          <Trash2 />
        </Button>
      </div>
      {live.status === 'notFound' && (
        <p className="text-sm text-destructive">
          {t('recordings.linkErrors.notFound')}
        </p>
      )}
      {blocked > 0 && (
        <p className="text-sm text-destructive" data-testid="blocked">
          {t('recordings.blocked', { count: blocked })}
        </p>
      )}

      {editing && (
        <EditPlaylist
          boardId={boardId}
          recording={recording}
          videos={live.videos}
          onClose={() => setEditing(false)}
        />
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('recordings.deleteTitle', { title: recording.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('recordings.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void deleteRecording(boardId, recording.id).catch(() =>
                  toast.error(t('errors.generic')),
                )
              }
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

/**
 * Administrar → "Clases grabadas" (M23): the board's YouTube playlists. New uploads appear on
 * their own (the playlist is read again whenever it's opened); the app never changes YouTube.
 */
export function RecordingsPanel({ boardId }: { boardId: string }) {
  const { t } = useTranslation()
  const recordings = useRecordings(boardId)
  const [adding, setAdding] = useState(false)
  const list = recordings.data

  return (
    <section
      id="recordings"
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="recordings-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">🎬 {t('recordings.panelTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('recordings.panelHint')}
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={`/b/${boardId}/videos`} />}
        >
          <ExternalLink />
          {t('recordings.openSection')}
        </Button>
      </div>

      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((recording, index) => (
            <PlaylistRow
              key={recording.id}
              boardId={boardId}
              recording={recording}
              above={list[index - 1]}
              below={list[index + 1]}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <AddPlaylist
          boardId={boardId}
          position={(list.at(-1)?.position ?? -1) + 1}
          onDone={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setAdding(true)}
        >
          <Plus />
          {t('recordings.add')}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        {t('recordings.unlistedWarning')}
      </p>
    </section>
  )
}
