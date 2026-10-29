import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Merge, Pencil, SquarePlus, Trash2 } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createMissingSpace,
  mergeStudents,
  removeStudent,
  type Student,
} from '@/features/students/api'
import { StudentFormDialog } from '@/features/students/components/StudentFormDialog'

export function StudentsTable({
  boardId,
  students,
  cardIds,
}: {
  boardId: string
  students: Student[]
  /** Students that have a card (null while loading) */
  cardIds?: ReadonlySet<string> | null
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<Student | null>(null)
  const [removing, setRemoving] = useState<Student | null>(null)
  const [merging, setMerging] = useState(false)
  const [creatingCard, setCreatingCard] = useState<string | null>(null)

  async function createCard(student: Student) {
    setCreatingCard(student.id)
    try {
      await createMissingSpace(boardId, student)
      toast.success(t('students.cardCreated'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setCreatingCard(null)
    }
  }

  const selectedStudents = students.filter((student) =>
    selected.includes(student.id),
  )

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    )
  }

  async function confirmRemove() {
    if (!removing) return
    try {
      await removeStudent(boardId, removing)
      toast.success(t('students.removed'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setRemoving(null)
    }
  }

  if (students.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t('students.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length === 2 && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted p-2 text-sm">
          <span>{t('merge.selected')}</span>
          <Button size="sm" onClick={() => setMerging(true)}>
            <Merge />
            {t('merge.button')}
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t('students.name')}</TableHead>
            <TableHead>{t('students.emails')}</TableHead>
            <TableHead>{t('students.group')}</TableHead>
            <TableHead>{t('students.status')}</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id} data-testid="student-row">
              <TableCell>
                <Checkbox
                  aria-label={t('merge.select', { name: student.displayName })}
                  checked={selected.includes(student.id)}
                  disabled={
                    !selected.includes(student.id) && selected.length >= 2
                  }
                  onCheckedChange={(checked) =>
                    toggle(student.id, checked === true)
                  }
                />
              </TableCell>
              <TableCell className="font-medium">
                {student.displayName}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {student.emails.map((email) => (
                    <Badge
                      key={email}
                      variant="outline"
                      className="font-normal"
                    >
                      {email}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{student.group}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    student.status === 'joined' ? 'default' : 'secondary'
                  }
                >
                  {t(`students.statuses.${student.status}`)}
                </Badge>
                {cardIds &&
                  student.status === 'joined' &&
                  !cardIds.has(student.id) && (
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700"
                        data-testid="no-card"
                      >
                        {t('students.noCard')}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={creatingCard === student.id}
                        onClick={() => void createCard(student)}
                      >
                        <SquarePlus />
                        {t('students.createCard')}
                      </Button>
                    </span>
                  )}
                {student.linkedUids.length > 1 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t('students.accounts', {
                      count: student.linkedUids.length,
                    })}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('students.edit')}
                    onClick={() => setEditing(student)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.remove')}
                    onClick={() => setRemoving(student)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editing && (
        <StudentFormDialog
          key={editing.id}
          boardId={boardId}
          roster={students}
          student={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('students.removeTitle', { name: removing?.displayName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('students.removeHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void confirmRemove()}
            >
              {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {merging && selectedStudents.length === 2 && (
        <MergeDialog
          boardId={boardId}
          students={[selectedStudents[0], selectedStudents[1]]}
          onClose={(done) => {
            setMerging(false)
            if (done) setSelected([])
          }}
        />
      )}
    </div>
  )
}

function MergeDialog({
  boardId,
  students,
  onClose,
}: {
  boardId: string
  students: [Student, Student]
  onClose: (done: boolean) => void
}) {
  const { t } = useTranslation()
  // Default: keep the one that already has linked accounts (it may have work in its space)
  const [keepId, setKeepId] = useState(
    students[1].linkedUids.length > students[0].linkedUids.length
      ? students[1].id
      : students[0].id,
  )
  const [saving, setSaving] = useState(false)
  const keep = students.find((student) => student.id === keepId)!
  const remove = students.find((student) => student.id !== keepId)!

  async function confirm() {
    setSaving(true)
    try {
      await mergeStudents(boardId, keep, remove)
      toast.success(t('merge.done'))
      onClose(true)
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === 'tooManyEmails'
          ? t('merge.tooManyEmails')
          : t('errors.generic'),
      )
      setSaving(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('merge.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('merge.hint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t('merge.keep')}
          </legend>
          {students.map((student) => (
            <label
              key={student.id}
              className="flex items-start gap-2 rounded-md border p-2 text-sm"
            >
              <input
                type="radio"
                name="keep"
                checked={keepId === student.id}
                onChange={() => setKeepId(student.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{student.displayName}</span>
                <span className="block text-muted-foreground">
                  {student.emails.join(', ')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={saving} onClick={() => void confirm()}>
            {t('merge.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
