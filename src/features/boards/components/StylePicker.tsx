import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { localDate } from '@/features/attendance/attendance'
import {
  BOARD_STYLE_LIST,
  hasTagline,
  type BoardStyle,
} from '@/features/boards/styles'
import { cn } from '@/lib/utils'
import type { BoardLook, BoardStyleId } from '@/model'

function swatch(style: BoardStyle) {
  const gradient =
    style.stops.length > 1
      ? `linear-gradient(160deg, ${style.stops.join(', ')})`
      : style.stops[0]
  return style.pattern
    ? `${style.pattern.image} 0 0 / ${style.pattern.size}, ${gradient}`
    : gradient
}

/**
 * "Estilo del tablero" (M21, D74): a whole look in one click, only when the teacher picks it (no
 * seasonal default). With a style: background animation, photo accessories (seasonal), a line
 * next to the title, and optional dates for a style (it switches back by itself).
 */
export function StylePicker({
  look,
  onChange,
}: {
  look: BoardLook
  onChange: (change: Partial<BoardLook>) => void
}) {
  const { t } = useTranslation()
  const selected = BOARD_STYLE_LIST.find((style) => style.id === look.style)
  const year = new Date().getFullYear()

  const tile = (style: BoardStyle) => (
    <button
      key={style.id}
      type="button"
      role="radio"
      aria-checked={look.style === style.id}
      onClick={() => onChange({ style: style.id })}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border text-left text-xs shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        look.style === style.id && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      <span
        className={cn(
          'flex h-12 items-center justify-center text-xl',
          style.text === 'light' ? 'text-white' : 'text-neutral-900',
        )}
        style={{ background: swatch(style) }}
        aria-hidden
      >
        {style.emoji}
      </span>
      <span className="truncate px-2 py-1 font-medium">
        {t(`styles.names.${style.id}`)}
      </span>
    </button>
  )

  return (
    <section className="flex flex-col gap-3" data-testid="style-picker">
      <div>
        <h3 className="text-sm font-semibold">{t('styles.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('styles.hint')}</p>
      </div>
      <div
        role="radiogroup"
        aria-label={t('styles.title')}
        className="flex flex-col gap-3"
      >
        <button
          type="button"
          role="radio"
          aria-checked={!look.style}
          onClick={() => onChange({ style: null })}
          className={cn(
            'rounded-lg border px-3 py-2 text-left text-sm',
            !look.style && 'ring-2 ring-primary ring-offset-2',
          )}
        >
          {t('styles.none')}
        </button>
        {(['everyday', 'seasonal'] as const).map((kind) => (
          <div key={kind} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t(`styles.${kind}`)}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {BOARD_STYLE_LIST.filter((style) => style.kind === kind).map(
                tile,
              )}
            </div>
          </div>
        ))}
      </div>

      {(selected || look.schedule) && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex flex-col">
              {t('styles.ambient')}
              <span className="text-xs text-muted-foreground">
                {t('styles.ambientHint')}
              </span>
            </span>
            <Switch
              checked={look.ambient}
              onCheckedChange={(ambient) => onChange({ ambient })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="flex flex-col">
              {t('styles.accessories')}
              <span className="text-xs text-muted-foreground">
                {t('styles.accessoriesHint')}
              </span>
            </span>
            <Switch
              checked={look.accessories}
              onCheckedChange={(accessories) => onChange({ accessories })}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-tagline">{t('styles.tagline')}</Label>
            <Input
              id="board-tagline"
              value={look.tagline}
              maxLength={60}
              placeholder={
                hasTagline(selected?.id)
                  ? t(`styles.taglines.${selected.id}`, { year })
                  : t('styles.taglinePlaceholder')
              }
              onChange={(event) => onChange({ tagline: event.target.value })}
            />
          </div>
        </div>
      )}

      <details className="rounded-lg border p-3 text-sm" open={!!look.schedule}>
        <summary className="cursor-pointer font-medium">
          {t('styles.dates')}
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('styles.datesHint')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="schedule-style">{t('styles.datesStyle')}</Label>
            <select
              id="schedule-style"
              className="h-8 rounded-lg border border-input bg-transparent px-2"
              value={look.schedule?.style ?? ''}
              onChange={(event) => {
                const style = event.target.value as BoardStyleId | ''
                const today = localDate()
                onChange({
                  schedule: style
                    ? {
                        style,
                        from: look.schedule?.from ?? today,
                        to: look.schedule?.to ?? today,
                      }
                    : null,
                })
              }}
            >
              <option value="">{t('styles.noDates')}</option>
              {BOARD_STYLE_LIST.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.emoji} {t(`styles.names.${style.id}`)}
                </option>
              ))}
            </select>
          </div>
          {look.schedule && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-from">{t('styles.from')}</Label>
                <Input
                  id="schedule-from"
                  type="date"
                  value={look.schedule.from}
                  max={look.schedule.to}
                  onChange={(event) =>
                    event.target.value &&
                    onChange({
                      schedule: { ...look.schedule!, from: event.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-to">{t('styles.to')}</Label>
                <Input
                  id="schedule-to"
                  type="date"
                  value={look.schedule.to}
                  min={look.schedule.from}
                  onChange={(event) =>
                    event.target.value &&
                    onChange({
                      schedule: { ...look.schedule!, to: event.target.value },
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </details>
    </section>
  )
}
