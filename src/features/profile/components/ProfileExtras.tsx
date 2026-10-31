import { BANNER_CSS } from '@/features/profile/decor'
import { cn } from '@/lib/utils'
import type { Decor, StatusMessage } from '@/model'

/** A person's profile message on cards and pages (M21). */
export function StatusLine({
  status,
  className,
}: {
  status: StatusMessage | null | undefined
  className?: string
}) {
  if (!status) return null
  return (
    <p
      className={cn('truncate text-xs text-neutral-600', className)}
      data-testid="status-line"
      title={`${status.emoji} ${status.text}`.trim()}
    >
      {status.emoji && <span className="mr-1">{status.emoji}</span>}
      {status.text}
    </p>
  )
}

/** The banner strip at the top of a card (M21); nothing without one. */
export function DecorBanner({
  decor,
  className,
}: {
  decor: Decor | null | undefined
  className?: string
}) {
  if (!decor?.banner) return null
  return (
    <div
      aria-hidden
      className={cn('h-2.5 shrink-0', className)}
      style={{ background: BANNER_CSS[decor.banner] }}
      data-testid="decor-banner"
      data-banner={decor.banner}
    />
  )
}

/** The sticker next to a name (M21). */
export function DecorSticker({ decor }: { decor: Decor | null | undefined }) {
  if (!decor?.sticker) return null
  return (
    <span className="ml-1 text-sm" aria-hidden data-testid="decor-sticker">
      {decor.sticker}
    </span>
  )
}
