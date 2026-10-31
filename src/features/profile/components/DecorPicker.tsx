import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saveDecor } from '@/features/profile/api'
import { BANNER_CSS } from '@/features/profile/decor'
import { cn } from '@/lib/utils'
import { CARD_BANNERS, STICKERS, type Decor } from '@/model'
import { useAuth } from '@/providers/auth-context'

/** "Decoración de mi tarjeta" (M21, F29): a banner strip and a sticker; saved on each pick. */
export function DecorPicker({
  current,
}: {
  current: Decor | null | undefined
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const decor: Decor = current ?? { banner: null, sticker: null }

  async function pick(next: Decor) {
    if (!user) return
    try {
      await saveDecor(user, next)
      toast.success(t('decor.saved'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  const option = (on: boolean) =>
    cn(
      'rounded-lg border transition-transform hover:scale-105 motion-reduce:transition-none',
      on && 'ring-2 ring-ring ring-offset-2',
    )

  return (
    <div className="flex flex-col gap-4" data-testid="decor-picker">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t('decor.banner')}
        </legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          <button
            type="button"
            aria-pressed={!decor.banner}
            onClick={() => void pick({ ...decor, banner: null })}
            className={cn(option(!decor.banner), 'h-8 text-xs')}
          >
            {t('decor.none')}
          </button>
          {CARD_BANNERS.map((banner) => (
            <button
              key={banner}
              type="button"
              aria-pressed={decor.banner === banner}
              aria-label={t(`decor.banners.${banner}`)}
              title={t(`decor.banners.${banner}`)}
              onClick={() => void pick({ ...decor, banner })}
              className={cn(option(decor.banner === banner), 'h-8')}
              style={{ background: BANNER_CSS[banner] }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t('decor.sticker')}
        </legend>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={!decor.sticker}
            onClick={() => void pick({ ...decor, sticker: null })}
            className={cn(option(!decor.sticker), 'h-9 px-2 text-xs')}
          >
            {t('decor.noneSticker')}
          </button>
          {STICKERS.map((sticker) => (
            <button
              key={sticker}
              type="button"
              aria-pressed={decor.sticker === sticker}
              aria-label={sticker}
              onClick={() => void pick({ ...decor, sticker })}
              className={cn(
                option(decor.sticker === sticker),
                'size-9 text-lg',
              )}
            >
              {sticker}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
