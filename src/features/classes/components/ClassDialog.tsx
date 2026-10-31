import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { localDate } from '@/features/attendance/attendance'
import { classInputSchema, type ClassInput } from '@/model'

/**
 * "Nueva clase" (title, date, the first slide's prompt) or "Editar clase" (title, date).
 * `onSave` gets the first prompt only when creating.
 */
export function ClassDialog({
  initial,
  onSave,
  onClose,
}: {
  initial?: ClassInput
  onSave: (input: ClassInput, firstPrompt: string) => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const creating = !initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? localDate())
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const valid = classInputSchema.safeParse({ title, date }).success

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="class-dialog">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            setBusy(true)
            onSave({ title: title.trim(), date }, prompt.trim())
              .then(onClose)
              .catch(() => setBusy(false))
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {creating ? t('classes.new') : t('classes.editClass')}
            </DialogTitle>
            <DialogDescription>{t('classes.hint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="class-title">{t('classes.titleLabel')}</Label>
            <Input
              id="class-title"
              autoFocus
              maxLength={80}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="class-date">{t('classes.dateLabel')}</Label>
            <Input
              id="class-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {creating && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="class-prompt">{t('classes.firstPrompt')}</Label>
              <Input
                id="class-prompt"
                maxLength={120}
                value={prompt}
                placeholder={t('classes.firstPromptPlaceholder')}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valid || busy}>
              {creating ? t('classes.create') : t('classes.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
