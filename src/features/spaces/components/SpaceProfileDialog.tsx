import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { updateSpaceProfile, type Space } from '@/features/spaces/api'
import { CoverPicker } from '@/features/spaces/components/CoverPicker'
import { cn } from '@/lib/utils'
import {
  SPACE_COLOR_NAMES,
  SPACE_COLORS,
  spaceProfileSchema,
  type SpaceProfile,
} from '@/model'

type Props = {
  boardId: string
  space: Space
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpaceProfileDialog({
  boardId,
  space,
  open,
  onOpenChange,
}: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(space.title)
  const [summary, setSummary] = useState(space.summary)
  const [color, setColor] = useState<SpaceProfile['color']>(
    (SPACE_COLORS as readonly string[]).includes(space.color)
      ? (space.color as SpaceProfile['color'])
      : SPACE_COLORS[0],
  )
  const [saving, setSaving] = useState(false)

  const valid = spaceProfileSchema.safeParse({ title, summary, color }).success

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await updateSpaceProfile(boardId, space.id, { title, summary, color })
      toast.success(t('space.saved'))
      onOpenChange(false)
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('space.editTitle')}</DialogTitle>
            <DialogDescription>{t('space.editHint')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-title">{t('space.title')}</Label>
            <Input
              id="space-title"
              value={title}
              maxLength={120}
              placeholder={t('space.titlePlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-summary">{t('space.summary')}</Label>
            <Textarea
              id="space-summary"
              rows={6}
              value={summary}
              maxLength={1000}
              placeholder={t('space.summaryPlaceholder')}
              onChange={(event) => setSummary(event.target.value)}
            />
            <span className="self-end text-xs text-muted-foreground">
              {summary.length}/1000
            </span>
          </div>

          <CoverPicker boardId={boardId} space={space} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {t('space.color')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {SPACE_COLORS.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-label={t(`space.colors.${SPACE_COLOR_NAMES[index]}`)}
                  aria-pressed={color === value}
                  onClick={() => setColor(value)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-110',
                    color === value && 'ring-2 ring-primary ring-offset-2',
                  )}
                  style={{ backgroundColor: value }}
                >
                  {color === value && <Check className="size-4" />}
                </button>
              ))}
            </div>
          </fieldset>

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
