import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { EMBED_PROVIDERS } from '@/features/slides/embeds'

// Canva first, like the tiles in "Insertar contenido" (M17)
const GUIDE = [
  ...EMBED_PROVIDERS.filter((provider) => provider.id === 'canva'),
  ...EMBED_PROVIDERS.filter((provider) => provider.id !== 'canva'),
]

/** "¿Cómo insertar…?" (M14, D41): sharing steps per service. Public, so the teacher can share it. */
export function EmbedGuidePage() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <Link
        to="/"
        className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t('appName')}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          {t('embeds.guideTitle')}
        </h1>
        <p className="text-muted-foreground">{t('embeds.guideIntro')}</p>
      </header>
      <ol className="flex flex-col gap-3">
        {GUIDE.map((provider) => (
          <li
            key={provider.id}
            id={provider.id}
            className="scroll-mt-6 rounded-xl border p-4 target:border-primary target:ring-2 target:ring-primary/30"
          >
            <h2 className="font-semibold">{provider.name}</h2>
            <p className="text-sm whitespace-pre-line">
              {t(`embeds.providers.${provider.id}`)}
            </p>
          </li>
        ))}
      </ol>
    </main>
  )
}
