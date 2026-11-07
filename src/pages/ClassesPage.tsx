import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { formatClassDate } from '@/features/attendance/attendance'
import { createClass, deleteClass, updateClass } from '@/features/classes/api'
import { ClassDialog } from '@/features/classes/components/ClassDialog'
import { useClasses } from '@/features/classes/hooks'
import { useClassAccess } from '@/features/classes/use-class-access'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import type { ClassDoc } from '@/model'

/** "Clases" (M10): the board's class sessions, newest first; the teacher creates and manages them. */
export function ClassesPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'es'
  const { boardId = '' } = useParams()
  const navigate = useNavigate()
  const access = useClassAccess(boardId)
  const classes = useClasses(boardId, access.allowed)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<WithId<ClassDoc> | null>(null)
  const [removing, setRemoving] = useState<WithId<ClassDoc> | null>(null)

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {access.board.data?.title}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            {t('classes.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('classes.hint')}</p>
        </div>
        {access.teacher && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t('classes.new')}
          </Button>
        )}
      </div>

      {access.loading || classes.loading ? (
        <Skeleton className="h-40" />
      ) : classes.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {access.teacher ? t('classes.none') : t('classes.noneStudent')}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.data.map((item) => (
            <li
              key={item.id}
              className="card-lift relative flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md"
              data-testid="class-card"
            >
              <div className="flex items-start gap-2">
                <Link
                  to={`/b/${boardId}/class/${item.id}`}
                  className="flex-1 font-semibold after:absolute after:inset-0 hover:underline"
                >
                  {item.title}
                </Link>
                {access.teacher && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="relative z-10"
                          aria-label={t('classes.editClass')}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(item)}>
                        <Pencil />
                        {t('classes.editClass')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setRemoving(item)}
                      >
                        <Trash2 />
                        {t('classes.deleteClass')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-4" />
                {formatClassDate(item.date, locale)}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <Badge
                  className={cn(
                    item.status === 'open'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {item.status === 'open'
                    ? t('classes.open')
                    : t('classes.closed')}
                </Badge>
                <span className="text-muted-foreground">
                  {t('classes.slides', { count: item.slideOrder.length })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <ClassDialog
          onClose={() => setCreating(false)}
          onSave={async (input, prompt) => {
            try {
              const id = await createClass(boardId, input, {
                title: prompt,
                instructions: '',
                layout: 'free',
                zones: [],
              })
              toast.success(t('classes.created'))
              navigate(`/b/${boardId}/class/${id}`)
            } catch (error) {
              toast.error(t('errors.generic'))
              throw error
            }
          }}
        />
      )}
      {editing && (
        <ClassDialog
          initial={{ title: editing.title, date: editing.date }}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              await updateClass(boardId, editing.id, input)
              toast.success(t('classes.classSaved'))
            } catch (error) {
              toast.error(t('errors.generic'))
              throw error
            }
          }}
        />
      )}
      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('classes.deleteClassTitle', { title: removing?.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('classes.deleteClassBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = removing
                setRemoving(null)
                if (target)
                  deleteClass(boardId, target.id)
                    .then(() => toast.success(t('classes.classDeleted')))
                    .catch(() => toast.error(t('errors.generic')))
              }}
            >
              {t('classes.deleteClass')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
