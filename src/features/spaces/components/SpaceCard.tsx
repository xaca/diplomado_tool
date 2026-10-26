import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, Pencil } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Space } from '@/features/spaces/api'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import { initials } from '@/lib/initials'
import { formatRelative, toDate } from '@/lib/time'

type Props = {
  boardId: string
  space: Space
  isMine: boolean
  onEdit?: () => void
}

/** One student's card on the board (Padlet-like). */
export function SpaceCard({ boardId, space, isMine, onEdit }: Props) {
  const { t, i18n } = useTranslation()
  const updated = formatRelative(
    toDate(space.updatedAt),
    i18n.resolvedLanguage ?? 'es',
  )

  return (
    <article
      data-card
      data-testid="space-card"
      className="mb-4 break-inside-avoid rounded-xl border border-black/5 shadow-sm transition-shadow hover:shadow-md"
      style={{ backgroundColor: space.color }}
    >
      {space.cover && (
        <img
          src={imageUrl(space.cover, IMAGE_SIZES.cardCover)}
          alt=""
          loading="lazy"
          width={400}
          height={225}
          className="aspect-video w-full rounded-t-xl object-cover"
          data-testid="card-cover"
        />
      )}
      <header className="flex items-center gap-2 p-3 pb-0">
        <Avatar className="size-7">
          <AvatarImage
            src={space.ownerPhotoURL ?? undefined}
            alt=""
            referrerPolicy="no-referrer"
          />
          <AvatarFallback className="text-xs">
            {initials(space.ownerName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {space.ownerName}
          </p>
          <p className="text-xs text-neutral-500">{updated}</p>
        </div>
        {isMine && <Badge variant="secondary">{t('space.mine')}</Badge>}
      </header>

      <div className="flex flex-col gap-2 p-3">
        {space.title ? (
          <h3 className="text-lg leading-snug font-bold text-neutral-900">
            {space.title}
          </h3>
        ) : (
          <p className="text-sm text-neutral-500 italic">
            {isMine ? t('space.emptyMine') : t('space.empty')}
          </p>
        )}
        {space.summary && (
          <p className="line-clamp-[12] text-sm whitespace-pre-line text-neutral-700">
            {space.summary}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-1 border-t border-black/5 px-2 py-1.5">
        <span className="flex-1 px-1 text-xs text-neutral-500">
          {t('space.slides', { count: space.slideCount })}
        </span>
        {isMine && onEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-neutral-700"
          >
            <Pencil />
            {t('space.edit')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="text-neutral-700"
          render={<Link to={`/b/${boardId}/s/${space.id}`} />}
        >
          {t('space.open')}
          <ArrowUpRight />
        </Button>
      </footer>
    </article>
  )
}
