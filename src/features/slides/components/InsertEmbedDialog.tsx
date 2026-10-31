import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
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
import { EmbedFrame } from '@/features/slides/components/EmbedFrame'
import {
  aspectOf,
  canvaViewUrl,
  detectEmbed,
  EMBED_PROVIDERS,
  isCanvaWebsite,
  isShortLink,
  readEmbedInput,
  toEmbedUrl,
  type EmbedProvider,
  type EmbedProviderId,
} from '@/features/slides/embeds'
import { mediaApi } from '@/lib/media-api'
import { cn } from '@/lib/utils'

type Props = {
  onInsert: (link: string, aspect: number) => void
  onClose: () => void
}

type Checked =
  | { status: 'empty' }
  | { status: 'resolving' }
  | { status: 'unknown' }
  | { status: 'notFramable'; provider: EmbedProvider; site: boolean }
  | { status: 'ok'; provider: EmbedProvider; embed: string }

type CanvaInfo =
  | { state: 'checking' }
  | { state: 'shared'; aspect: number; title: string }
  | { state: 'private' }
  | { state: 'unknown' }

function check(link: string): Checked {
  if (!link.trim()) return { status: 'empty' }
  const provider = detectEmbed(link)
  if (!provider) return { status: 'unknown' }
  const embed = toEmbedUrl(link)
  return embed
    ? { status: 'ok', provider, embed }
    : { status: 'notFramable', provider, site: isCanvaWebsite(link) }
}

/** Tiles order (M17, D55): Canva first, then what students use most */
const TILE_ORDER: EmbedProviderId[] = [
  'canva',
  'googleSlides',
  'youtube',
  'figma',
  'googleDocs',
  'googleSheets',
  'googleForms',
  'googleDrive',
  'miro',
  'notion',
  'genially',
  'prezi',
  'vimeo',
  'loom',
  'padlet',
]

const BRAND: Record<EmbedProviderId, string> = {
  canva: '#7d2ae8',
  googleSlides: '#f4b400',
  youtube: '#ff0000',
  figma: '#a259ff',
  googleDocs: '#4285f4',
  googleSheets: '#0f9d58',
  googleForms: '#673ab7',
  googleDrive: '#1fa463',
  miro: '#ffd02f',
  notion: '#191919',
  genially: '#2f3bec',
  prezi: '#3181ff',
  vimeo: '#1ab7ea',
  loom: '#625df5',
  padlet: '#ff4081',
}

const TILES = TILE_ORDER.map((id) =>
  EMBED_PROVIDERS.find((provider) => provider.id === id)!,
)

/**
 * "Insertar contenido" (M14, M17): pick a service (its sharing steps) or paste right away. A link
 * or an embed code ("Insertar" in Canva, YouTube, Figma…) → the service is recognized, the link
 * converted, a live preview in the content's real shape; "Insertar" adds it centered on the
 * slide. Short links (canva.link, forms.gle…) are expanded by the media-api Worker first; Canva
 * designs are checked there too (shared publicly? size and title).
 */
export function InsertEmbedDialog({ onInsert, onClose }: Props) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState<EmbedProviderId | null>(null)
  const [resolved, setResolved] = useState<{ from: string; to: string } | null>(
    null,
  )
  const [canva, setCanva] = useState<{ url: string; info: CanvaInfo } | null>(
    null,
  )
  const field = useRef<HTMLInputElement>(null)

  const read = readEmbedInput(input)
  const link = read?.link ?? ''
  const short = isShortLink(link)
  // A short link is checked once the Worker expanded it ('' = it couldn't be expanded)
  const target = short ? (resolved?.from === link ? resolved.to : null) : link
  const result: Checked = !input.trim()
    ? { status: 'empty' }
    : !read
      ? { status: 'unknown' }
      : target === null
        ? { status: 'resolving' }
        : target
          ? check(target)
          : { status: 'unknown' }

  useEffect(() => {
    if (!short) return
    let current = true
    mediaApi
      .resolveLink(link)
      .then(({ url }) => current && setResolved({ from: link, to: url }))
      .catch(() => current && setResolved({ from: link, to: '' }))
    return () => {
      current = false
    }
  }, [short, link])

  // Canva: shared with anyone with the link? and its real shape (a poster isn't 16:9)
  const canvaUrl = result.status === 'ok' ? canvaViewUrl(result.embed) : null
  useEffect(() => {
    if (!canvaUrl) return
    let current = true
    mediaApi
      .canvaInfo(canvaUrl)
      .then((answer) => {
        if (!current) return
        const aspect = answer.shared && aspectOf(answer.width, answer.height)
        setCanva({
          url: canvaUrl,
          info: answer.shared
            ? aspect
              ? { state: 'shared', aspect, title: answer.title }
              : { state: 'unknown' }
            : { state: 'private' },
        })
      })
      // Worker not deployed yet, Canva busy…: insert as before, without the check
      .catch(
        () =>
          current && setCanva({ url: canvaUrl, info: { state: 'unknown' } }),
      )
    return () => {
      current = false
    }
  }, [canvaUrl])

  const canvaInfo: CanvaInfo | null = !canvaUrl
    ? null
    : canva?.url === canvaUrl
      ? canva.info
      : { state: 'checking' }
  const aspect =
    result.status === 'ok'
      ? (read?.aspect ??
        (canvaInfo?.state === 'shared' ? canvaInfo.aspect : null) ??
        result.provider.aspect)
      : 1
  const shown =
    result.status === 'ok' || result.status === 'notFramable'
      ? result.provider
      : (TILES.find((provider) => provider.id === picked) ?? null)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl"
        data-testid="insert-embed"
      >
        <DialogHeader>
          <DialogTitle>{t('embeds.insertTitle')}</DialogTitle>
          <DialogDescription>{t('embeds.insertHint')}</DialogDescription>
        </DialogHeader>

        {!input.trim() && !picked ? (
          <section className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('embeds.pick')}</p>
            <ul
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              data-testid="embed-services"
            >
              {TILES.map((provider, index) => (
                <li
                  key={provider.id}
                  className={cn(index === 0 && 'col-span-2 sm:col-span-3')}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(provider.id)
                      requestAnimationFrame(() => field.current?.focus())
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                      index === 0 && 'border-[#7d2ae8]/40 bg-[#7d2ae8]/5 p-3',
                    )}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-md font-heading text-sm font-bold text-white"
                      style={{ backgroundColor: BRAND[provider.id] }}
                      aria-hidden
                    >
                      {provider.name[0]}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{provider.name}</span>
                      {index === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t('embeds.canvaTile')}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t('embeds.pasteAnyway')}
            </p>
          </section>
        ) : (
          picked &&
          !input.trim() && (
            <button
              type="button"
              className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:underline"
              onClick={() => setPicked(null)}
            >
              <ArrowLeft className="size-3.5" />
              {t('embeds.otherServices')}
            </button>
          )
        )}

        {shown && result.status !== 'ok' && result.status !== 'notFramable' && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="mb-1 font-medium">
              {t('embeds.stepsFor', { name: shown.name })}
            </p>
            <p className="whitespace-pre-line">
              {t(`embeds.providers.${shown.id}`)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="embed-link">{t('embeds.link')}</Label>
          <Input
            ref={field}
            id="embed-link"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={input}
            placeholder={
              picked === 'canva'
                ? 'https://www.canva.com/design/… · <iframe …>'
                : t('embeds.placeholder')
            }
            onChange={(event) => setInput(event.target.value)}
          />
        </div>

        <div aria-live="polite" className="flex flex-col gap-3 text-sm">
          {result.status === 'resolving' && (
            <p className="text-muted-foreground">{t('embeds.resolving')}</p>
          )}
          {result.status === 'unknown' && (
            <p className="flex items-start gap-2 text-amber-800">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {t('embeds.unknown')}
            </p>
          )}
          {(result.status === 'ok' || result.status === 'notFramable') && (
            <>
              <p
                className={
                  result.status === 'ok'
                    ? 'flex items-center gap-2 font-medium text-green-700'
                    : 'flex items-start gap-2 text-amber-800'
                }
                data-testid="embed-detected"
              >
                {result.status === 'ok' ? (
                  <CircleCheck className="size-4 shrink-0" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                {result.status === 'ok'
                  ? canvaInfo?.state === 'shared' && canvaInfo.title
                    ? t('embeds.detectedTitled', {
                        name: result.provider.name,
                        title: canvaInfo.title,
                      })
                    : t('embeds.detected', { name: result.provider.name })
                  : result.site
                    ? t('embeds.canvaSite')
                    : t('embeds.notFramable', { name: result.provider.name })}
              </p>
              {canvaInfo?.state === 'checking' && (
                <p className="text-muted-foreground">
                  {t('embeds.canvaChecking')}
                </p>
              )}
              {canvaInfo?.state === 'private' && (
                <p
                  className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900"
                  data-testid="canva-private"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                  {t('embeds.canvaPrivate')}
                </p>
              )}
              {(result.status === 'notFramable' ||
                canvaInfo?.state !== 'shared') && (
                <div className="rounded-lg bg-muted p-3">
                  <p className="mb-1 font-medium">{t('embeds.steps')}</p>
                  <p className="whitespace-pre-line">
                    {t(`embeds.providers.${result.provider.id}`)}
                  </p>
                </div>
              )}
            </>
          )}
          {result.status === 'ok' && (
            <figure className="flex flex-col gap-1">
              <figcaption className="text-xs text-muted-foreground">
                {t('embeds.preview')}
              </figcaption>
              <div
                className="mx-auto w-full overflow-hidden rounded-lg border"
                style={{
                  aspectRatio: aspect,
                  // Portrait content (a poster, a form) stays a reasonable height
                  maxWidth:
                    aspect < 1
                      ? `min(100%, ${Math.round(360 * aspect)}px)`
                      : undefined,
                }}
                data-testid="embed-preview"
                data-aspect={aspect.toFixed(3)}
              >
                <EmbedFrame link={result.embed} />
              </div>
            </figure>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <a
            href={`/ayuda/insertar${shown ? `#${shown.id}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
          >
            <ExternalLink className="size-3.5" />
            {t('embeds.guide')}
          </a>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={result.status !== 'ok'}
              onClick={() => {
                if (result.status !== 'ok') return
                onInsert(result.embed, aspect)
                onClose()
              }}
            >
              {t('embeds.insertButton')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
