import { Link, Outlet, useParams } from 'react-router'
import { HomeLink } from '@/components/layout/HomeLink'
import { UserMenu } from '@/components/layout/UserMenu'
import { NotificationBell } from '@/features/announcements/components/NotificationBell'
import { useBoard } from '@/features/boards/hooks'
import { BoardSections } from '@/features/classes/components/BoardSections'
import { MessagesButton } from '@/features/messages/components/MessagesButton'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'

export function BoardSubpageLayout() {
  const { boardId = '' } = useParams()
  const board = useBoard(boardId)

  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b px-4 sm:px-6">
        <HomeLink compact className="shrink-0" />
        {board.data && (
          <Link
            to={`/b/${boardId}`}
            className="flex min-w-0 items-center gap-2 hover:opacity-80"
          >
            {board.data.logo && (
              <img
                src={imageUrl(board.data.logo, IMAGE_SIZES.logo)}
                alt=""
                className="max-h-7 max-w-14 shrink-0 object-contain"
              />
            )}
            <span className="truncate font-heading text-sm font-semibold">
              {board.data.title}
            </span>
          </Link>
        )}
        <div className="ml-auto flex items-center gap-1">
          <MessagesButton boardId={boardId} />
          <NotificationBell boardId={boardId} />
          <UserMenu />
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-5">
        <BoardSections boardId={boardId} />
      </div>
      <Outlet />
    </>
  )
}
