import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CircleCheck,
  ClipboardCheck,
  Eye,
  Pencil,
  Play,
  Presentation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useClassAccess } from '@/features/classes/use-class-access'
import { useSpaces } from '@/features/spaces/hooks'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import type { WithId } from '@/lib/firestore-hooks'
import {
  WorkStatusBadge,
  WorkStatusControl,
} from '@/features/spaces/components/WorkStatus'
import { statusOf } from '@/features/spaces/ready'
import type { SpaceDoc } from '@/model'

/**
 * Presentaciones (M25, revised 2026-11-07): the students' own slides made in the app — nothing
 * else. A student's evaluation form is a Google Form inside one of their slides (Insertar
 * contenido → Google Forms), so classmates fill it in while viewing the presentation.
 */
export function PresentationsPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  const spaces = useSpaces(
    access.allowed ? boardId : undefined,
    access.studentId ?? null,
  )

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const loading = access.loading || spaces.loading
  const withSlides = spaces.data.filter((space) => space.slideCount > 0)
  const empty = spaces.data.length - withSlides.length
  const mine = spaces.data.find((space) => space.id === access.studentId)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {access.board.data?.title}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            <Presentation className="mr-1 inline size-6" />
            {t('presentations.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {access.teacher
              ? t('presentations.teacherHint')
              : t('presentations.hint')}
          </p>
        </div>
        {access.teacher && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={`/b/${boardId}/present`} />}
            >
              <Play />
              {t('presentations.presentAll')}
            </Button>
            <Button
              nativeButton={false}
              render={<Link to={`/b/${boardId}/present?ready=1`} />}
            >
              <CircleCheck />
              {t('ready.presentReady')}
            </Button>
          </div>
        )}
      </div>

      {mine && (
        <div
          className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4"
          data-testid="my-presentation"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {t('presentations.mine', { count: mine.slideCount })}
            </p>
            <div className="flex flex-wrap gap-2">
              {access.writableBoard && (
                <WorkStatusControl
                  boardId={boardId}
                  studentId={mine.id}
                  status={statusOf(mine)}
                  by="student"
                />
              )}
              {access.writableBoard && (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link to={`/b/${boardId}/s/${mine.id}/edit`} />}
                >
                  <Pencil />
                  {t('presentations.editMine')}
                </Button>
              )}
              {mine.slideCount > 0 && (
                <Button
                  nativeButton={false}
                  render={<Link to={`/b/${boardId}/present/${mine.id}`} />}
                >
                  <Play />
                  {t('presentations.present')}
                </Button>
              )}
            </div>
          </div>
          <p className="flex gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="size-4 shrink-0" />
            {t('presentations.formTip')}
          </p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-64" />
      ) : withSlides.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"
          data-testid="no-presentations"
        >
          {t('presentations.none')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {withSlides.map((space) => (
            <PresentationCard
              key={space.id}
              boardId={boardId}
              space={space}
              canPresent={access.teacher || space.id === access.studentId}
            />
          ))}
        </ul>
      )}

      {!loading && empty > 0 && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="without-slides"
        >
          {t('presentations.withoutSlides', { count: empty })}
        </p>
      )}
    </section>
  )
}

function PresentationCard({
  boardId,
  space,
  canPresent,
}: {
  boardId: string
  space: WithId<SpaceDoc>
  canPresent: boolean
}) {
  const { t } = useTranslation()
  return (
    <li
      className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
      data-testid="presentation"
      data-student={space.id}
    >
      <div
        className="relative aspect-video w-full"
        style={{ backgroundColor: space.color }}
      >
        {space.cover ? (
          <img
            src={imageUrl(space.cover, IMAGE_SIZES.cardCover)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Presentation className="size-10 text-foreground/25" />
          </span>
        )}
        {/* M27: 🚧 En progreso · ✓ Listo */}
        <WorkStatusBadge
          status={statusOf(space)}
          className="absolute top-2 right-2"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate font-semibold">{space.ownerName}</p>
        {space.title && (
          <p className="truncate text-sm text-muted-foreground">
            {space.title}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t('presentations.slides', { count: space.slideCount })}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link to={`/b/${boardId}/s/${space.id}`} />}
          >
            <Eye />
            {t('presentations.view')}
          </Button>
          {canPresent && (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link to={`/b/${boardId}/present/${space.id}`} />}
            >
              <Play />
              {t('presentations.present')}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
