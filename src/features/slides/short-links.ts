import { isShortLink } from '@/features/slides/embeds'
import { mediaApi } from '@/lib/media-api'

/**
 * A short link (forms.gle, goo.gl…) expanded by the media-api Worker (M14, only allow-listed
 * hosts); any other link, or one that can't be expanded, comes back as it was.
 */
export async function expandShortLink(link: string) {
  const trimmed = link.trim()
  if (!isShortLink(trimmed)) return trimmed
  try {
    return (await mediaApi.resolveLink(trimmed)).url
  } catch {
    return trimmed
  }
}
