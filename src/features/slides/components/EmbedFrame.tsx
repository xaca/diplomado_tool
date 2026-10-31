import { useEffect, useState } from 'react'
import { FALLBACK_MS } from '@/features/slides/embed-overlay'
import { detectEmbed, sandboxFor, toEmbedUrl } from '@/features/slides/embeds'
import { useEmbedTexts } from '@/features/slides/use-embed-texts'

/**
 * A live embed in the editor and in the "Insertar contenido" preview (M14): the converted link,
 * sandboxed, with the same loading / "¿No carga?" / "Abrir" states as the viewer.
 */
export function EmbedFrame({ link, title }: { link: string; title?: string }) {
  const texts = useEmbedTexts()
  const src = toEmbedUrl(link)
  const provider = detectEmbed(link)
  const [state, setState] = useState<'loading' | 'loaded' | 'stuck'>('loading')

  useEffect(() => {
    if (state !== 'loading') return
    const timer = setTimeout(() => setState('stuck'), FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [state, src])

  if (!src) return null
  return (
    <div className="relative h-full w-full bg-white" data-embed={provider?.id}>
      <iframe
        key={src}
        src={src}
        title={title ?? provider?.name ?? ''}
        sandbox={sandboxFor(src)}
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        className="h-full w-full border-0"
        onLoad={() => setState('loaded')}
      />
      {state !== 'loaded' && (
        <div
          className={`embed-overlay${state === 'stuck' ? 'embed-overlay--stuck' : ''}`}
          role="status"
          data-testid={state === 'stuck' ? 'embed-stuck' : 'embed-loading'}
        >
          {state === 'loading' ? (
            <>
              <span className="embed-spinner" aria-hidden />
              <span>{texts.loading(provider?.name ?? '')}</span>
            </>
          ) : (
            <>
              <p>{texts.stuck(provider)}</p>
              <span className="embed-actions">
                <a
                  className="embed-button"
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {texts.open}
                </a>
                <a
                  className="embed-link"
                  href={`/ayuda/insertar#${provider?.id ?? ''}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {texts.help}
                </a>
              </span>
            </>
          )}
        </div>
      )}
      <a
        className="embed-open"
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="embed-open"
      >
        ↗ {texts.open}
      </a>
    </div>
  )
}
