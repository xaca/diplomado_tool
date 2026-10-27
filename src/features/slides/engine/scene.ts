import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ImageRef } from '@/model'

// Pure scene helpers (no Excalidraw runtime import, unit-tested).
// A slide is stored as { elements, background } in a JSON string; images only as references.

/** Fixed 16:9 slide. 960 × 540 keeps Excalidraw's font sizes readable when presented full screen. */
export const SLIDE_WIDTH = 960
export const SLIDE_HEIGHT = 540
export const FRAME_ID = 'slide-frame'
export const DEFAULT_BACKGROUND = '#ffffff'

export type StoredScene = {
  elements: ExcalidrawElement[]
  background: string
}

const encoder = new TextEncoder()

/** Only live elements are stored (Excalidraw keeps deleted ones for undo). */
export function serializeScene(
  elements: readonly ExcalidrawElement[],
  background: string,
) {
  const scene: StoredScene = {
    elements: elements.filter((element) => !element.isDeleted),
    background,
  }
  const content = JSON.stringify(scene)
  return { content, bytes: encoder.encode(content).length }
}

export function parseScene(content: string | undefined): StoredScene {
  try {
    const scene = JSON.parse(content ?? '') as Partial<StoredScene>
    return {
      elements: Array.isArray(scene.elements) ? scene.elements : [],
      background:
        typeof scene.background === 'string'
          ? scene.background
          : DEFAULT_BACKGROUND,
    }
  } catch {
    return { elements: [], background: DEFAULT_BACKGROUND }
  }
}

/** File ids of the images still on the slide. */
export function imageFileIds(elements: readonly ExcalidrawElement[]) {
  const ids = new Set<string>()
  for (const element of elements) {
    if (!element.isDeleted && element.type === 'image' && element.fileId)
      ids.add(element.fileId)
  }
  return [...ids]
}

/** Splits the slide's images into already-uploaded (with their refs) and still-missing ones. */
export function planFiles(
  fileIds: readonly string[],
  known: ReadonlyMap<string, ImageRef>,
) {
  const files: Record<string, ImageRef> = {}
  const missing: string[] = []
  for (const id of fileIds) {
    const ref = known.get(id)
    if (ref) files[id] = ref
    else missing.push(id)
  }
  return { files, missing }
}

/** Data the slide document stores for its images. */
export function filesPayload(files: Record<string, ImageRef>) {
  return {
    files,
    assetIds: [...new Set(Object.values(files).map((ref) => ref.assetId))],
  }
}

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function mimeType(format: string) {
  return MIME_BY_FORMAT[format.toLowerCase()] ?? 'image/webp'
}

/** "data:image/png;base64,…" → File (for uploading a pasted or dropped image). */
export function dataUrlToFile(dataUrl: string, name: string) {
  const [header, base64 = ''] = dataUrl.split(',')
  const type = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type })
}

// Sites that may play live inside a slide (PLAN.md review R9). Any other link stays a plain link,
// in the editor (validateEmbeddable) and in the viewer (iframes are filtered after export).
const EMBED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'player.vimeo.com',
  'figma.com',
  'www.figma.com',
  'embed.figma.com',
  'docs.google.com',
  'canva.com',
  'www.canva.com',
])

export function isAllowedEmbed(link: string) {
  try {
    const url = new URL(link)
    return url.protocol === 'https:' && EMBED_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

/** Cheap change detector: Excalidraw bumps `version` on every edit of an element. */
export function sceneSignature(
  elements: readonly ExcalidrawElement[],
  background: string,
) {
  let sum = 0
  for (const element of elements) sum += element.version
  return `${elements.length}:${sum}:${background}`
}
