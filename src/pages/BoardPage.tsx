import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** Board view. The Padlet-like dashboard arrives in M3; for now: title + who's in. */
export function BoardPage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const { role } = useAuth()
  const board = useBoard(boardId)

  if (board.loading) {
    return (
      <section className="mx-auto max-w-5xl p-6">
        <Skeleton className="h-8 w-64" />
      </section>
    )
  }

  if (!board.data) {
    return (
      <section className="mx-auto max-w-5xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1
          className="font-heading text-2xl font-semibold"
          data-testid="board-title"
        >
          {board.data.title}
        </h1>
        {isTeacherRole(role) && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/teacher/boards/${boardId}`} />}
          >
            <Settings />
            {t('boards.manage')}
          </Button>
        )}
      </div>
      {board.data.description && (
        <p className="text-muted-foreground">{board.data.description}</p>
      )}
      <p className="rounded-md bg-muted p-4 text-sm">
        {t('boards.dashboardSoon')}
      </p>
    </section>
  )
}
