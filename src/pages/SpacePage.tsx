import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil } from 'lucide-react'
import { doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { SpaceProfileDialog } from '@/features/spaces/components/SpaceProfileDialog'
import { useMyStudentId } from '@/features/spaces/hooks'
import { db } from '@/lib/firebase'
import { useLiveDoc } from '@/lib/firestore-hooks'
import { initials } from '@/lib/initials'
import { formatRelative, toDate } from '@/lib/time'
import { paths, type SpaceDoc } from '@/model'

/** One student's space. The slides (viewer) arrive in M5. */
export function SpacePage() {
  const { t, i18n } = useTranslation()
  const { boardId, studentId } = useParams()
  const board = useBoard(boardId)
  const me = useMyStudentId(boardId)
  const ref =
    boardId && studentId ? doc(db, paths.space(boardId, studentId)) : null
  const space = useLiveDoc<SpaceDoc>(ref, `space:${boardId}:${studentId}`)
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

      <p className="rounded-lg bg-muted p-4 text-sm">{t('space.slidesSoon')}</p>

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
