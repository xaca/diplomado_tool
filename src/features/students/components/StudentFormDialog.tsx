import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addStudent,
  EmailTakenError,
  updateStudent,
  type Student,
} from '@/features/students/api'
import { MAX_EMAILS_PER_STUDENT, studentInputSchema } from '@/model'

type Props = {
  boardId: string
  roster: Student[]
  /** Edit this student; omit to add a new one */
  student?: Student
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StudentFormDialog({
  boardId,
  roster,
  student,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(student?.displayName ?? '')
  const [emails, setEmails] = useState<string[]>(student?.emails ?? ['', ''])
  const [group, setGroup] = useState(student?.group ?? '')
  const [saving, setSaving] = useState(false)

  const input = {
    name,
    emails: emails.filter((email) => email.trim() !== ''),
    group,
  }
  const valid = studentInputSchema.safeParse(input).success

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      if (student) await updateStudent(boardId, student, input, roster)
      else await addStudent(boardId, input, roster)
      toast.success(student ? t('students.updated') : t('students.added'))
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof EmailTakenError
          ? t('students.emailTaken', { email: error.email })
          : t('errors.generic'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {student ? t('students.edit') : t('students.add')}
            </DialogTitle>
            <DialogDescription>{t('students.emailsHint')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="student-name">{t('students.name')}</Label>
            <Input
              id="student-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('students.emails')}</Label>
            {emails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="email"
                  value={email}
                  aria-label={`${t('students.email')} ${index + 1}`}
                  placeholder={
                    index === 0
                      ? t('students.personalEmail')
                      : t('students.universityEmail')
                  }
                  onChange={(e) =>
                    setEmails(
                      emails.map((value, i) =>
                        i === index ? e.target.value : value,
                      ),
                    )
                  }
                />
                {emails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.remove')}
                    onClick={() =>
                      setEmails(emails.filter((_, i) => i !== index))
                    }
                  >
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {emails.length < MAX_EMAILS_PER_STUDENT && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setEmails([...emails, ''])}
              >
                <Plus />
                {t('students.addEmail')}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="student-group">{t('students.group')}</Label>
            <Input
              id="student-group"
              value={group}
              maxLength={60}
              onChange={(e) => setGroup(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!valid || saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
