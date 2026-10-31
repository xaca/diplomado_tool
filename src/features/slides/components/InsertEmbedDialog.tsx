import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, CircleCheck, ExternalLink } from 'lucide-react'
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
  detectEmbed,
  isShortLink,
  toEmbedUrl,
  type EmbedProvider,
} from '@/features/slides/embeds'
import { mediaApi } from '@/lib/media-api'

type Props = {
  onInsert: (link: string, aspect: number) => void
  onClose: () => void
}

type Checked =
  | { status: 'empty' }
  | { status: 'resolving' }
  | { status: 'unknown' }
  | { status: 'notFramable'; provider: EmbedProvider }
  | { status: 'ok'; provider: EmbedProvider; embed: string }

function check(link: string): Checked {
  if (!link.trim()) return { status: 'empty' }
  const provider = detectEmbed(link)
  if (!provider) return { status: 'unknown' }
  const embed = toEmbedUrl(link)
  return embed
    ? { status: 'ok', provider, embed }
    : { status: 'notFramable', provider }
}

/**
 * "Insertar contenido" (M14): paste a link → the service is recognized, the link converted, a
 * live preview and that service's sharing steps; "Insertar" adds it centered on the slide.
 * Short links (canva.link, forms.gle…) are expanded by the media-api Worker first.
 */
export function InsertEmbedDialog({ onInsert, onClose }: Props) {
  const { t } = useTranslation()
  const [link, setLink] = useState('')
  const [resolved, setResolved] = useState<{ from: string; to: string } | null>(
    null,
  )

  const short = isShortLink(link)
  // A short link is checked once the Worker expanded it ('' = it couldn't be expanded)
  const result: Checked = !short
    ? check(link)
    : resolved?.from !== link
      ? { status: 'resolving' }
      : resolved.to
        ? check(resolved.to)
        : { status: 'unknown' }

  useEffect(() => {
    if (!short) return
    let current = true
    mediaApi
      .resolveLink(link.trim())
      .then(({ url }) => current && setResolved({ from: link, to: url }))
      .catch(() => current && setResolved({ from: link, to: '' }))
    return () => {
      current = false
    }
  }, [short, link])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('embeds.insertTitle')}</DialogTitle>
          <DialogDescription>{t('embeds.insertHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="embed-link">{t('embeds.link')}</Label>
          <Input
            id="embed-link"
            type="url"
            autoFocus
            value={link}
            placeholder={t('embeds.placeholder')}
            onChange={(event) => setLink(event.target.value)}
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
                  <CircleCheck className="size-4" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                {result.status === 'ok'
                  ? t('embeds.detected', { name: result.provider.name })
                  : t('embeds.notFramable', { name: result.provider.name })}
              </p>
              <div className="rounded-lg bg-muted p-3">
                <p className="mb-1 font-medium">{t('embeds.steps')}</p>
                <p>{t(`embeds.providers.${result.provider.id}`)}</p>
              </div>
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
                  aspectRatio: result.provider.aspect,
                  maxWidth: result.provider.aspect < 1 ? 320 : undefined,
                }}
              >
                <EmbedFrame link={result.embed} />
              </div>
            </figure>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <a
            href="/ayuda/insertar"
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
                onInsert(result.embed, result.provider.aspect)
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
