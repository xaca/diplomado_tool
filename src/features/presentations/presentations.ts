// Google Slides links (M25, D123): any link carrying the presentation's id. A link published to the
// web (`/presentation/d/e/<id>/pub`) has a different, longer id that only works on published
// addresses: no editor, no Drive thumbnail.
const SLIDES_URL_RE =
  /docs\.google\.com\/presentation\/d\/(e\/)?([A-Za-z0-9_-]{20,200})/

export function parseSlidesUrl(
  url: string,
): { presentationId: string; published: boolean } | null {
  const m = SLIDES_URL_RE.exec(url)
  return m ? { presentationId: m[2], published: !!m[1] } : null
}

const base = (presentationId: string, published = false) =>
  published
    ? `https://docs.google.com/presentation/d/e/${presentationId}`
    : `https://docs.google.com/presentation/d/${presentationId}`

export function embedUrl(presentationId: string, published = false): string {
  return `${base(presentationId, published)}/embed?start=false&loop=false&delayms=3000`
}

export function presentUrl(presentationId: string, published = false): string {
  return published
    ? `${base(presentationId, true)}/pub?start=true&loop=false`
    : `${base(presentationId)}/present`
}

/** The editor for the teacher; a published presentation only has its public page */
export function openUrl(presentationId: string, published = false): string {
  return published
    ? `${base(presentationId, true)}/pub`
    : `${base(presentationId)}/edit`
}

/** Drive's thumbnail (not a documented API: the card falls back to an icon); none when published */
export function thumbnailUrl(
  presentationId: string,
  published = false,
  width = 400,
): string | null {
  return published
    ? null
    : `https://lh3.googleusercontent.com/d/${presentationId}=w${width}`
}
