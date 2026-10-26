import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyBoards } from '@/features/membership/hooks'

export function StudentHomePage() {
  const { t } = useTranslation()
  const { boards, loading, error } = useMyBoards()

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
        <div className="grid gap-4 sm:grid-cols-2" data-testid="my-boards">
          {boards.map((board) => (
            <Link key={board.id} to={`/b/${board.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader>
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
      )}
    </section>
  )
}
