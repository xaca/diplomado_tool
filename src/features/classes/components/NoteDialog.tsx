import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NOTE_PAPER } from '@/features/classes/colors'
import { cn } from '@/lib/utils'
import {
  MAX_STICKY_TEXT,
  NOTE_COLORS,
  stickyTextSchema,
  type NoteColor,
} from '@/model'

export type NoteDraft = { text: string; color: NoteColor }

/** Write or edit a sticky note (M10): text and paper color; delete when editing. */
export function NoteDialog({
  initial,
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  initial: NoteDraft
  editing: boolean
  onSave: (draft: NoteDraft) => Promise<unknown>
  onDelete?: () => Promise<unknown>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(initial.text)
  const [color, setColor] = useState<NoteColor>(initial.color)
  const [busy, setBusy] = useState(false)
  const valid = stickyTextSchema.safeParse(text).success

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="note-dialog">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) void run(() => onSave({ text: text.trim(), color }))
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? t('classes.editNote') : t('classes.newNote')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('classes.hintAdd')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sticky-text">{t('classes.noteText')}</Label>
            <Textarea
              id="sticky-text"
              autoFocus
              rows={4}
              maxLength={MAX_STICKY_TEXT}
              value={text}
              placeholder={t('classes.notePlaceholder')}
              style={{ backgroundColor: NOTE_PAPER[color] }}
              className="text-neutral-900"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                // Ctrl/⌘ + Enter saves
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
                  event.currentTarget.form?.requestSubmit()
              }}
            />
            <p className="text-right text-xs text-muted-foreground">
              {text.length} / {MAX_STICKY_TEXT}
            </p>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">
              {t('classes.color')}
            </legend>
            <div className="flex gap-2" role="radiogroup">
              {NOTE_COLORS.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={color === name}
                  aria-label={t(`classes.colors.${name}`)}
                  title={t(`classes.colors.${name}`)}
                  onClick={() => setColor(name)}
                  className={cn(
                    'size-8 rounded-md border border-black/10 shadow-sm',
                    color === name && 'ring-2 ring-sky-500 ring-offset-2',
                  )}
                  style={{ backgroundColor: NOTE_PAPER[name] }}
                />
              ))}
            </div>
          </fieldset>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => void run(onDelete)}
              >
                <Trash2 />
                {t('classes.delete')}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={!valid || busy}>
              {t('classes.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
