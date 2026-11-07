import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SaveButton } from '@/components/save/SaveButton'
import { useSaveLock } from '@/components/save/use-save-lock'
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
import { zonesOf } from '@/features/classes/wall'
import { cn } from '@/lib/utils'
import {
  CLASS_LAYOUTS,
  classSlideInputSchema,
  type ClassLayout,
  type ClassSlideInput,
} from '@/model'

/** Mini drawing of each layout for the picker */
function LayoutIcon({ layout }: { layout: ClassLayout }) {
  return (
    <svg viewBox="0 0 32 18" className="h-6 w-10" aria-hidden>
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="17"
        rx="2"
        fill="none"
        stroke="currentColor"
      />
      {zonesOf(layout).map((zone, index) =>
        index === 0 ? null : (
          <path
            key={index}
            d={
              zone.x > 0 && zone.y === 0
                ? `M${zone.x * 32} 0.5V17.5`
                : zone.y > 0 && zone.x === 0
                  ? `M0.5 ${zone.y * 18}H31.5`
                  : ''
            }
            stroke="currentColor"
            strokeDasharray="2 1.5"
          />
        ),
      )}
    </svg>
  )
}

/** The teacher writes a slide's prompt and picks the wall's layout (M10, D82). */
export function PromptDialog({
  title,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  title: string
  initial: ClassSlideInput
  onSave: (input: ClassSlideInput) => Promise<unknown>
  onDelete?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(initial)
  const lock = useSaveLock()
  const zoneCount = draft.layout === 'free' ? 0 : zonesOf(draft.layout).length
  const input = { ...draft, zones: draft.zones.slice(0, zoneCount) }
  const valid = classSlideInputSchema.safeParse(input).success

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg"
        data-testid="prompt-dialog"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) return
            lock
              .run(async () => {
                await onSave(input)
                onClose()
              })
              .catch(() => {})
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('classes.promptTitle')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-title">{t('classes.promptTitle')}</Label>
            <Input
              id="prompt-title"
              autoFocus
              maxLength={120}
              value={draft.title}
              placeholder={t('classes.firstPromptPlaceholder')}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-instructions">
              {t('classes.instructions')}
            </Label>
            <Textarea
              id="prompt-instructions"
              rows={2}
              maxLength={500}
              value={draft.instructions}
              onChange={(event) =>
                setDraft({ ...draft, instructions: event.target.value })
              }
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              {t('classes.layout')}
            </legend>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="radiogroup"
            >
              {CLASS_LAYOUTS.map((layout) => (
                <button
                  key={layout}
                  type="button"
                  role="radio"
                  aria-checked={draft.layout === layout}
                  onClick={() => setDraft({ ...draft, layout })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs',
                    draft.layout === layout
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'hover:bg-muted',
                  )}
                >
                  <LayoutIcon layout={layout} />
                  {t(`classes.layouts.${layout}`)}
                </button>
              ))}
            </div>
            {zoneCount > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: zoneCount }, (_, index) => (
                  <Input
                    key={index}
                    aria-label={t('classes.zoneN', { number: index + 1 })}
                    placeholder={t('classes.zoneN', { number: index + 1 })}
                    maxLength={40}
                    value={draft.zones[index] ?? ''}
                    onChange={(event) => {
                      const zones = [...draft.zones]
                      for (let i = 0; i < zoneCount; i++) zones[i] ??= ''
                      zones[index] = event.target.value
                      setDraft({ ...draft, zones })
                    }}
                  />
                ))}
              </div>
            )}
          </fieldset>
          <DialogFooter className="gap-2 sm:justify-between">
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 />
                {t('classes.deleteSlide')}
              </Button>
            ) : (
              <span />
            )}
            <SaveButton type="submit" lock={lock} disabled={!valid}>
              {t('classes.save')}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
