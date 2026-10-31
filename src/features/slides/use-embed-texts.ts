import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EmbedTexts } from '@/features/slides/embed-overlay'

/** The overlay's texts in the current language (M14). */
export function useEmbedTexts(): EmbedTexts {
  const { t } = useTranslation()
  return useMemo(
    () => ({
      loading: (name) =>
        name ? t('embeds.loadingNamed', { name }) : t('embeds.loading'),
      stuck: (provider) =>
        provider?.needsSharing
          ? t('embeds.stuckShare', { name: provider.name })
          : t('embeds.stuck'),
      open: t('embeds.open'),
      help: t('embeds.help'),
    }),
    [t],
  )
}
