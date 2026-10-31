// Embeds that work (M14, PLAN.md → M14): which services may play inside a slide, and how a link
// the student pastes becomes the link a frame can show. Pure, unit-tested; one entry per service,
// so a provider changing its URLs is a one-line fix here.

export type EmbedProviderId =
  | 'googleSlides'
  | 'googleDocs'
  | 'googleSheets'
  | 'googleForms'
  | 'googleDrive'
  | 'youtube'
  | 'vimeo'
  | 'loom'
  | 'figma'
  | 'canva'
  | 'miro'
  | 'notion'
  | 'genially'
  | 'prezi'
  | 'padlet'

export type EmbedProvider = {
  id: EmbedProviderId
  name: string
  /** width / height of the box inserted in the slide */
  aspect: number
  /** The file must be shared "anyone with the link" (shown in the dialog and the fallback) */
  needsSharing: boolean
  /** Extra sandbox permissions (always on top of scripts / same-origin / presentation / popups) */
  sandbox?: string[]
  matches: (url: URL) => boolean
  /** The embeddable link, or null when this link can't be shown in a frame (e.g. a private page) */
  toEmbed: (url: URL) => string | null
}

const host = (url: URL, ...names: string[]) => names.includes(url.hostname)
const segments = (url: URL) => url.pathname.split('/').filter(Boolean)
const ID = /^[A-Za-z0-9_-]{6,}$/

/** /type/d/ID/… or /type/d/e/ID/… (Google "published" links) */
function googleId(url: URL, type: string) {
  const parts = segments(url)
  if (parts[0] !== type || parts[1] !== 'd') return null
  if (parts[2] === 'e' && ID.test(parts[3] ?? ''))
    return { id: parts[3], published: true }
  return ID.test(parts[2] ?? '') ? { id: parts[2], published: false } : null
}

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: 'googleSlides',
    name: 'Google Slides',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'docs.google.com') && !!googleId(url, 'presentation'),
    toEmbed: (url) => {
      const doc = googleId(url, 'presentation')!
      return doc.published
        ? `https://docs.google.com/presentation/d/e/${doc.id}/embed?start=false&loop=false`
        : `https://docs.google.com/presentation/d/${doc.id}/embed?start=false&loop=false`
    },
  },
  {
    id: 'googleDocs',
    name: 'Google Docs',
    aspect: 4 / 3,
    needsSharing: true,
    matches: (url) =>
      host(url, 'docs.google.com') && !!googleId(url, 'document'),
    toEmbed: (url) => {
      const doc = googleId(url, 'document')!
      return doc.published
        ? `https://docs.google.com/document/d/e/${doc.id}/pub?embedded=true`
        : `https://docs.google.com/document/d/${doc.id}/preview`
    },
  },
  {
    id: 'googleSheets',
    name: 'Google Sheets',
    aspect: 4 / 3,
    needsSharing: true,
    matches: (url) =>
      host(url, 'docs.google.com') && !!googleId(url, 'spreadsheets'),
    toEmbed: (url) => {
      const doc = googleId(url, 'spreadsheets')!
      return doc.published
        ? `https://docs.google.com/spreadsheets/d/e/${doc.id}/pubhtml?widget=true&headers=false`
        : `https://docs.google.com/spreadsheets/d/${doc.id}/preview`
    },
  },
  {
    id: 'googleForms',
    name: 'Google Forms',
    aspect: 3 / 4,
    needsSharing: false,
    sandbox: ['allow-forms'],
    matches: (url) => host(url, 'docs.google.com') && !!googleId(url, 'forms'),
    toEmbed: (url) => {
      const doc = googleId(url, 'forms')!
      return doc.published
        ? `https://docs.google.com/forms/d/e/${doc.id}/viewform?embedded=true`
        : `https://docs.google.com/forms/d/${doc.id}/viewform?embedded=true`
    },
  },
  {
    id: 'googleDrive',
    name: 'Google Drive',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'drive.google.com') &&
      segments(url)[0] === 'file' &&
      segments(url)[1] === 'd' &&
      ID.test(segments(url)[2] ?? ''),
    toEmbed: (url) =>
      `https://drive.google.com/file/d/${segments(url)[2]}/preview`,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    aspect: 16 / 9,
    needsSharing: false,
    matches: (url) => youtubeId(url) !== null,
    toEmbed: (url) => {
      const start = Number.parseInt(
        url.searchParams.get('t') ?? url.searchParams.get('start') ?? '',
        10,
      )
      return `https://www.youtube-nocookie.com/embed/${youtubeId(url)}${start > 0 ? `?start=${start}` : ''}`
    },
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    aspect: 16 / 9,
    needsSharing: false,
    matches: (url) => vimeo(url) !== null,
    toEmbed: (url) => {
      const { id, hash } = vimeo(url)!
      return `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`
    },
  },
  {
    id: 'loom',
    name: 'Loom',
    aspect: 16 / 9,
    needsSharing: false,
    matches: (url) =>
      host(url, 'www.loom.com', 'loom.com') &&
      ['share', 'embed'].includes(segments(url)[0]) &&
      ID.test(segments(url)[1] ?? ''),
    toEmbed: (url) => `https://www.loom.com/embed/${segments(url)[1]}`,
  },
  {
    id: 'figma',
    name: 'Figma',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) => figma(url) !== null,
    toEmbed: (url) => figma(url),
  },
  {
    id: 'canva',
    name: 'Canva',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'www.canva.com', 'canva.com') &&
      segments(url)[0] === 'design' &&
      ID.test(segments(url)[1] ?? ''),
    toEmbed: (url) => {
      const [, id, token] = segments(url)
      const withToken = token && !['view', 'edit', 'watch'].includes(token)
      return `https://www.canva.com/design/${id}/${withToken ? `${token}/` : ''}view?embed`
    },
  },
  {
    id: 'miro',
    name: 'Miro',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'miro.com') &&
      segments(url)[0] === 'app' &&
      ['board', 'live-embed'].includes(segments(url)[1]) &&
      !!segments(url)[2],
    toEmbed: (url) =>
      `https://miro.com/app/live-embed/${segments(url)[2]}/?embedMode=view_only_without_ui`,
  },
  {
    id: 'notion',
    name: 'Notion',
    aspect: 4 / 3,
    needsSharing: true,
    matches: (url) =>
      url.hostname.endsWith('.notion.site') ||
      host(url, 'notion.so', 'www.notion.so'),
    // Only pages published to the web (notion.site) can be shown in a frame
    toEmbed: (url) =>
      url.hostname.endsWith('.notion.site')
        ? `https://${url.hostname}${url.pathname}`
        : null,
  },
  {
    id: 'genially',
    name: 'Genially',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'view.genial.ly', 'app.genial.ly') &&
      segments(url).some((part) => ID.test(part)),
    toEmbed: (url) =>
      `https://view.genial.ly/${segments(url).find((part) => /^[0-9a-f]{24}$/.test(part)) ?? segments(url).at(-1)}`,
  },
  {
    id: 'prezi',
    name: 'Prezi',
    aspect: 16 / 9,
    needsSharing: true,
    matches: (url) =>
      host(url, 'prezi.com') &&
      ['p', 'v', 'view'].includes(segments(url)[0]) &&
      !!segments(url)[1],
    toEmbed: (url) => {
      const parts = segments(url)
      const id = parts[1] === 'embed' ? parts[2] : parts[1]
      return id ? `https://prezi.com/p/embed/${id}/` : null
    },
  },
  {
    id: 'padlet',
    name: 'Padlet',
    aspect: 4 / 3,
    needsSharing: true,
    matches: (url) => host(url, 'padlet.com'),
    // Padlet's own embed links (Compartir → Insertar) only; a board's address can't be framed
    toEmbed: (url) =>
      segments(url)[0] === 'embed' ? `https://padlet.com${url.pathname}` : null,
  },
]

function youtubeId(url: URL) {
  let id: string | null = null
  if (host(url, 'youtu.be')) id = segments(url)[0] ?? null
  else if (
    host(
      url,
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    )
  ) {
    const parts = segments(url)
    if (parts[0] === 'watch') id = url.searchParams.get('v')
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0]))
      id = parts[1] ?? null
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

function vimeo(url: URL) {
  const parts = segments(url)
  if (
    host(url, 'player.vimeo.com') &&
    parts[0] === 'video' &&
    /^\d+$/.test(parts[1] ?? '')
  )
    return { id: parts[1], hash: url.searchParams.get('h') }
  if (host(url, 'vimeo.com', 'www.vimeo.com') && /^\d+$/.test(parts[0] ?? ''))
    return {
      id: parts[0],
      hash: parts[1] && /^[0-9a-f]+$/.test(parts[1]) ? parts[1] : null,
    }
  return null
}

const FIGMA_TYPES: Record<string, string> = {
  file: 'design',
  design: 'design',
  proto: 'proto',
  board: 'board',
  slides: 'slides',
  deck: 'deck',
}

function figma(url: URL) {
  if (!host(url, 'figma.com', 'www.figma.com', 'embed.figma.com')) return null
  const [type, key, ...rest] = segments(url)
  const kind = FIGMA_TYPES[type]
  if (!kind || !ID.test(key ?? '')) return null
  const params = new URLSearchParams(url.search)
  params.set('embed-host', params.get('embed-host') ?? 'pbl')
  return `https://embed.figma.com/${kind}/${key}${rest.length ? `/${rest.join('/')}` : ''}?${params}`
}

function parse(link: string) {
  try {
    const url = new URL(link.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

/** Which service a link belongs to (even if it can't be embedded as is). */
export function detectEmbed(link: string) {
  const url = parse(link)
  return (
    (url && EMBED_PROVIDERS.find((provider) => provider.matches(url))) || null
  )
}

/** The link a frame can show, or null (unknown service, or a link that can't be framed). */
export function toEmbedUrl(link: string) {
  const url = parse(link)
  const provider = url && EMBED_PROVIDERS.find((p) => p.matches(url))
  return provider ? provider.toEmbed(url!) : null
}

/** May this link play inside a slide? (Excalidraw's validateEmbeddable and the viewer's filter) */
export function isAllowedEmbed(link: string) {
  return parse(link)?.protocol === 'https:' && toEmbedUrl(link) !== null
}

export const BASE_SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-presentation',
  'allow-popups',
]

export function sandboxFor(link: string) {
  return [...BASE_SANDBOX, ...(detectEmbed(link)?.sandbox ?? [])].join(' ')
}

/** Short links the media-api Worker may expand (D39): only these hosts, nothing else is fetched */
export const SHORT_LINK_HOSTS = [
  'canva.link',
  'forms.gle',
  'youtu.be',
  'figma.fyi',
  'goo.gl',
]

export function isShortLink(link: string) {
  const url = parse(link)
  return !!url && SHORT_LINK_HOSTS.includes(url.hostname) && !detectEmbed(link)
}

/** The size of the box inserted in a 960 × 540 slide, centered (pure). */
export function embedBox(aspect: number, slide = { width: 960, height: 540 }) {
  const maxWidth = slide.width * 0.84
  const maxHeight = slide.height * 0.84
  const width = Math.min(maxWidth, maxHeight * aspect)
  const height = width / aspect
  return {
    x: Math.round((slide.width - width) / 2),
    y: Math.round((slide.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  }
}

/** URLs typed inside a text (the student pasted a link instead of embedding it). */
export function linksInText(text: string) {
  // A wrapped URL breaks across lines: join a URL with the next line when that whole line is one
  // word (a URL's continuation), never with a normal line of text
  let joined = text
  for (;;) {
    const next = joined.replace(/(https?:\/\/\S+)\n(\S+)(?=\n|$)/, '$1$2')
    if (next === joined) break
    joined = next
  }
  return [...joined.matchAll(/https?:\/\/[^\s<>"]+/g)].map((match) =>
    match[0].replace(/[.,;:)\]]+$/, ''),
  )
}
