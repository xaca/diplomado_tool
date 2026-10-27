import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, ExternalLink, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InvitePanel } from '@/features/boards/components/InvitePanel'
import { LifecyclePanel } from '@/features/boards/components/LifecyclePanel'
import { useBoard } from '@/features/boards/hooks'
import { ImportDialog } from '@/features/students/components/ImportDialog'
import { StudentFormDialog } from '@/features/students/components/StudentFormDialog'
import { StudentsTable } from '@/features/students/components/StudentsTable'
import { useStudents } from '@/features/students/hooks'
import { toStudentsFile } from '@/features/students/import'
import { downloadJson, slugify } from '@/lib/download'

export function TeacherBoardPage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const board = useBoard(boardId)
  const students = useStudents(boardId)
  const [adding, setAdding] = useState(false)

  if (board.loading) {
    return (
      <section className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </section>
    )
  }

  if (!board.data || !boardId) {
    return (
      <section className="mx-auto max-w-5xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const joined = students.data.filter(
    (student) => student.status === 'joined',
  ).length

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/teacher"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('teacher.title')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              {board.data.title}
            </h1>
            {board.data.description && (
              <p className="text-muted-foreground">{board.data.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/b/${boardId}`} />}
          >
            <ExternalLink />
            {t('boards.open')}
          </Button>
        </div>
      </div>

      <InvitePanel board={board.data} />

      <LifecyclePanel board={board.data} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {t('students.title')}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              {t('students.counts', { total: students.data.length, joined })}
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdding(true)}>
              <UserPlus />
              {t('students.add')}
            </Button>
            <ImportDialog boardId={boardId} roster={students.data} />
            <Button
              variant="outline"
              disabled={students.data.length === 0}
              onClick={() =>
                downloadJson(
                  `estudiantes-${slugify(board.data!.title)}.json`,
                  toStudentsFile(students.data),
                )
              }
            >
              <Download />
              {t('students.export')}
            </Button>
          </div>
        </div>

        {students.loading ? (
          <Skeleton className="h-40" />
        ) : (
          <StudentsTable boardId={boardId} students={students.data} />
        )}
      </div>

      {adding && (
        <StudentFormDialog
          boardId={boardId}
          roster={students.data}
          open
          onOpenChange={(open) => !open && setAdding(false)}
        />
      )}
    </section>
  )
}
