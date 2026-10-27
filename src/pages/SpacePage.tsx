import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Play, Presentation } from 'lucide-react'
import { doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import { useSlides } from '@/features/slides/hooks'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import { useMyStudentId } from '@/features/spaces/hooks'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import { initials } from '@/lib/initials'
import { formatRelative, toDate } from '@/lib/time'
import { paths, type SpaceDoc } from '@/model'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** One student's space: the card and its slides (read-only for classmates and the teacher). */
export function SpacePage() {
  const { t, i18n } = useTranslation()
  const { boardId, studentId } = useParams()
  const { role } = useAuth()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const ref =
    boardId && studentId ? doc(db, paths.space(boardId, studentId)) : null
  const space = useLiveDoc<SpaceDoc>(ref, `space:${boardId}:${studentId}`)
  const slides = useSlides(boardId, studentId, space.data?.slideOrder)
  const [editing, setEditing] = useState(false)

  if (space.loading || board.loading) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <Skeleton className="h-64" />
      </section>
    )
  }

  if (!space.data || !boardId) {
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )
  }

  const isMine = me.studentId === space.data.id
  const teacher = isTeacherRole(role)
  const canEdit = isMine && board.data?.status === 'active'

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Link
        to={`/b/${boardId}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        {board.data?.title}
      </Link>

      <article
        className="rounded-2xl border border-black/5 p-6 shadow-sm"
        style={{ backgroundColor: space.data.color }}
        data-testid="space-detail"
      >
        {space.data.cover && (
          <img
            src={imageUrl(space.data.cover, IMAGE_SIZES.slide)}
            alt=""
            className="mb-4 aspect-video w-full rounded-xl object-cover"
          />
        )}
        <header className="mb-4 flex items-center gap-3">
          <Avatar>
            <AvatarImage
              src={space.data.ownerPhotoURL ?? undefined}
              alt=""
              referrerPolicy="no-referrer"
            />
            <AvatarFallback>{initials(space.data.ownerName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-semibold text-neutral-900">
              {space.data.ownerName}
            </p>
            <p className="text-xs text-neutral-500">
              {formatRelative(
                toDate(space.data.updatedAt),
                i18n.resolvedLanguage ?? 'es',
              )}
            </p>
          </div>
          {canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              {t('space.edit')}
            </Button>
          )}
        </header>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900">
          {space.data.title ||
            (isMine ? t('space.emptyMine') : t('space.empty'))}
        </h1>
        {space.data.summary && (
          <p className="whitespace-pre-line text-neutral-800">
            {space.data.summary}
          </p>
        )}
      </article>

      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {t('space.slides', { count: space.data.slideCount })}
        </h2>
        <div className="flex gap-2">
          {(isMine || teacher) && space.data.slideCount > 0 && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={`/b/${boardId}/present/${space.data.id}`} />}
            >
              <Play />
              {t('presenter.present')}
            </Button>
          )}
          {canEdit && (
            <Button
              nativeButton={false}
              render={<Link to={`/b/${boardId}/s/${space.data.id}/edit`} />}
            >
              <Presentation />
              {t('slides.edit')}
            </Button>
          )}
        </div>
      </div>

      {slides.data.length === 0 && !slides.loading ? (
        <p className="rounded-lg bg-muted p-4 text-sm">
          {canEdit ? t('slides.noneMine') : t('slides.none')}
        </p>
      ) : (
        <ol className="flex flex-col gap-4" data-testid="slides-viewer">
          {slides.data.map((slide, index) => (
            <li key={slide.id} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                {index + 1} / {slides.data.length}
              </span>
              <SlidePreview
                slide={slide}
                large
                className="rounded-xl border shadow-sm"
              />
            </li>
          ))}
        </ol>
      )}

      {editing && (
        <SpaceProfileDialog
          boardId={boardId}
          space={space.data}
          open
          onOpenChange={(open) => !open && setEditing(false)}
        />
      )}
    </section>
  )
}
