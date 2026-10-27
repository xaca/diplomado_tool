import { Link } from 'react-router'
import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateBoardDialog } from '@/features/boards/components/CreateBoardDialog'
import { useTeacherBoards } from '@/features/boards/hooks'
import {
  lifecycleOf,
  splitByLifecycle,
  suggestPurge,
} from '@/features/boards/lifecycle'
import type { WithId } from '@/lib/firestore-hooks'
import type { BoardDoc } from '@/model'

export function TeacherHomePage() {
  const { t } = useTranslation()
  const { data: boards, loading, error } = useTeacherBoards()
  const { active, archived } = splitByLifecycle(boards, lifecycleOf)

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold">
          {t('teacher.title')}
        </h1>
        <CreateBoardDialog />
      </div>

      {error && <p className="text-destructive">{t('errors.generic')}</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <p className="text-muted-foreground">{t('teacher.empty')}</p>
      ) : (
        <>
          <BoardGrid boards={active} />
          {archived.length > 0 && (
            <section
              className="flex flex-col gap-3"
              data-testid="archived-boards"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Archive className="size-5" />
                {t('lifecycle.archivedProjects')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('lifecycle.archivedTeacherHint')}
              </p>
              <BoardGrid boards={archived} archived />
            </section>
          )}
        </>
      )}
    </section>
  )
}

function BoardGrid({
  boards,
  archived = false,
}: {
  boards: WithId<BoardDoc>[]
  archived?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {boards.map((board) => (
        <Link
          key={board.id}
          to={`/teacher/boards/${board.id}`}
          className="group"
        >
          <Card
            className={`h-full transition-colors group-hover:border-primary ${archived ? 'opacity-80' : ''}`}
          >
            <CardHeader>
              <CardTitle>{board.title}</CardTitle>
              {board.description && (
                <CardDescription className="line-clamp-2">
                  {board.description}
                </CardDescription>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {archived ? (
                  <Badge variant="secondary">
                    {t('lifecycle.archivedBadge')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-mono">
                    {board.joinCode}
                  </Badge>
                )}
                {archived && suggestPurge(lifecycleOf(board)) && (
                  <Badge variant="outline" className="text-amber-700">
                    {t('lifecycle.considerPurgeShort')}
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}
