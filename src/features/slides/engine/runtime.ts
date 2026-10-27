import '@/features/slides/engine/asset-path'
import {
  convertToExcalidrawElements,
  exportToSvg,
  restoreElements,
} from '@excalidraw/excalidraw'
import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
} from '@excalidraw/excalidraw/element/types'
import type { BinaryFileData } from '@excalidraw/excalidraw/types'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import {
  FRAME_ID,
  isAllowedEmbed,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
  mimeType,
  parseScene,
} from '@/features/slides/engine/scene'
import type { ImageRef, SlideDoc } from '@/model'

// The only module (with SlideCanvas) that loads the Excalidraw runtime: always imported lazily.

const EMBED_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups'

export const FRAME_RENDERING = {
  enabled: true,
  name: false,
  outline: true,
  clip: true,
}

/** The fixed 16:9 slide area: a locked frame the student can't move or delete. */
export function createSlideFrame() {
  return convertToExcalidrawElements(
    [
      {
        type: 'frame',
        id: FRAME_ID,
        x: 0,
        y: 0,
        width: SLIDE_WIDTH,
        height: SLIDE_HEIGHT,
        children: [],
        locked: true,
      },
      // Keep FRAME_ID: the editor and the export find the slide frame by it
    ],
    { regenerateIds: false },
  )[0] as ExcalidrawFrameElement
}

export function findFrame(elements: readonly ExcalidrawElement[]) {
  return elements.find(
    (element): element is ExcalidrawFrameElement =>
      element.id === FRAME_ID && element.type === 'frame' && !element.isDeleted,
  )
}

/** Stored elements, upgraded to the current Excalidraw version, always with the slide frame. */
export function loadElements(content: string | undefined) {
  const scene = parseScene(content)
  const elements = restoreElements(scene.elements, null)
  return {
    elements: findFrame(elements)
      ? elements
      : [createSlideFrame(), ...elements],
    background: scene.background,
  }
}

/** Cloudinary refs → Excalidraw files. The image URL stands in for the data URL (no download needed). */
export function toBinaryFiles(
  files: Record<string, ImageRef>,
  size: { w: number; crop: 'limit' } = IMAGE_SIZES.slide,
): BinaryFileData[] {
  return Object.entries(files).map(([id, ref]) => ({
    id: id as BinaryFileData['id'],
    mimeType: mimeType(ref.format) as BinaryFileData['mimeType'],
    dataURL: imageUrl(ref, size) as BinaryFileData['dataURL'],
    created: 0,
  }))
}

type RenderOptions = {
  /** Live YouTube/Vimeo/… players instead of a link (viewer and presenter) */
  embeds?: boolean
  /** Embed the font subset in the SVG (crisp text without loading the editor) */
  inlineFonts?: boolean
}

/** Renders exactly the slide frame as an SVG string (viewer, presenter, thumbnails). */
export async function renderSlideSvg(
  slide: Pick<SlideDoc, 'content' | 'files'>,
  { embeds = false, inlineFonts = false }: RenderOptions = {},
) {
  const { elements, background } = loadElements(slide.content)
  const files = Object.fromEntries(
    toBinaryFiles(slide.files ?? {}).map((file) => [file.id, file]),
  )
  const svg = await exportToSvg({
    elements: elements.filter((element) => !element.isDeleted),
    appState: {
      exportBackground: true,
      viewBackgroundColor: background,
      frameRendering: { ...FRAME_RENDERING, outline: false },
    },
    files,
    exportPadding: 0,
    exportingFrame: findFrame(elements),
    renderEmbeddables: embeds,
    skipInliningFonts: inlineFonts ? undefined : true,
  })
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.setAttribute('class', 'block h-auto w-full')
  for (const link of svg.querySelectorAll('a')) {
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener noreferrer')
  }
  // Slides come from other students: only allow-listed players, always sandboxed
  for (const frame of svg.querySelectorAll('iframe')) {
    if (isAllowedEmbed(frame.src)) frame.setAttribute('sandbox', EMBED_SANDBOX)
    else frame.closest('foreignObject')?.remove()
  }
  return svg.outerHTML
}
