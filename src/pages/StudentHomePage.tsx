import { Link } from 'react-router'
import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { lifecycleOf, splitByLifecycle } from '@/features/boards/lifecycle'
import { useMyBoards } from '@/features/membership/hooks'
import type { WithId } from '@/lib/firestore-hooks'
import type { BoardDoc } from '@/model'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'

export function StudentHomePage() {
  const { t } = useTranslation()
  const { boards, loading, error } = useMyBoards()
  const { active, archived } = splitByLifecycle(boards, lifecycleOf)

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-semibold">
        {t('student.title')}
      </h1>

      {error && <p className="text-destructive">{t('errors.generic')}</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : boards.length === 0 ? (
        <p className="text-muted-foreground">{t('student.empty')}</p>
      ) : (
        <>
          <BoardGrid boards={active} testId="my-boards" />
          {archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Archive className="size-5" />
                {t('lifecycle.archivedProjects')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('lifecycle.archivedStudentHint')}
              </p>
              <BoardGrid boards={archived} testId="archived-boards" />
            </section>
          )}
        </>
      )}
    </section>
  )
}

function BoardGrid({
  boards,
  testId,
}: {
  boards: WithId<BoardDoc>[]
  testId: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid={testId}>
      {boards.map((board) => (
        <Link key={board.id} to={`/b/${board.id}`} className="group">
          <Card className="h-full transition-colors group-hover:border-primary">
            <CardHeader>
              {board.logo && (
                <img
                  src={imageUrl(board.logo, IMAGE_SIZES.logo)}
                  alt=""
                  className="mb-2 max-h-12 max-w-28 object-contain"
                />
              )}
              <CardTitle>{board.title}</CardTitle>
              {board.description && (
                <CardDescription className="line-clamp-2">
                  {board.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  )
}
