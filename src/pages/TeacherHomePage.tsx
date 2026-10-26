import { Link } from 'react-router'
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

export function TeacherHomePage() {
  const { t } = useTranslation()
  const { data: boards, loading, error } = useTeacherBoards()

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              to={`/teacher/boards/${board.id}`}
              className="group"
            >
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
                  <CardTitle>{board.title}</CardTitle>
                  {board.description && (
                    <CardDescription className="line-clamp-2">
                      {board.description}
                    </CardDescription>
                  )}
                  <Badge variant="outline" className="mt-2 w-fit font-mono">
                    {board.joinCode}
                  </Badge>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
