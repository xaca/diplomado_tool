import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveStatus } from '@/features/profile/api'
import { STATUS_EMOJIS, STATUS_SUGGESTIONS } from '@/features/profile/decor'
import { cn } from '@/lib/utils'
import { statusSchema, type StatusMessage } from '@/model'
import { useAuth } from '@/providers/auth-context'

/**
 * "Mi estado" (M21, D70): a short message on my profile ("¡Feliz Halloween! 🎃"), with an
 * optional emoji and a few ideas. Saving copies it to my cards on every board.
 */
export function StatusEditor({
  current,
  onDone,
}: {
  current: StatusMessage | null | undefined
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [emoji, setEmoji] = useState(current?.emoji ?? '')
  const [text, setText] = useState(current?.text ?? '')
  const [busy, setBusy] = useState(false)
  const valid = statusSchema.safeParse({ emoji, text }).success

  async function save(next: StatusMessage | null) {
    if (!user) return
    setBusy(true)
    try {
      const { skipped } = await saveStatus(user, next)
      toast.success(
        skipped
          ? t('status.skipped', { count: skipped })
          : next
            ? t('status.saved')
            : t('status.cleared'),
      )
      if (!next) {
        setEmoji('')
        setText('')
      }
      onDone?.()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      data-testid="status-editor"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) void save({ emoji, text })
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status-text">{t('status.label')}</Label>
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-lg"
            aria-hidden
          >
            {emoji || '·'}
          </span>
          <Input
            id="status-text"
            value={text}
            maxLength={60}
            placeholder={t('status.placeholder')}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>{t('status.noLinks')}</span>
          <span>{t('status.count', { count: text.length })}</span>
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">
          {t('status.emoji')}
        </legend>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            aria-pressed={!emoji}
            onClick={() => setEmoji('')}
            className={cn(
              'h-8 rounded-md border px-2 text-xs',
              !emoji && 'ring-2 ring-ring',
            )}
          >
            {t('status.noEmoji')}
          </button>
          {STATUS_EMOJIS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={emoji === option}
              aria-label={option}
              onClick={() => setEmoji(option)}
              className={cn(
                'size-8 rounded-md border text-base transition-transform hover:scale-110 motion-reduce:transition-none',
                emoji === option && 'ring-2 ring-ring',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-medium">
          {t('status.suggestions')}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_SUGGESTIONS.map((idea) => (
            <button
              key={idea.key}
              type="button"
              onClick={() => {
                setEmoji(idea.emoji)
                setText(t(`status.ideas.${idea.key}`))
              }}
              className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted"
            >
              {idea.emoji} {t(`status.ideas.${idea.key}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid || busy}>
          {t('status.save')}
        </Button>
        {current && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void save(null)}
          >
            <Trash2 />
            {t('status.clear')}
          </Button>
        )}
      </div>
    </form>
  )
}
