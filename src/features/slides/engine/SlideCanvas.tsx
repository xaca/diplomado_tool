import '@/features/slides/engine/asset-path'
import '@excalidraw/excalidraw/index.css'
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react'
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  Excalidraw,
  MainMenu,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import { logUploadFailure, uploadImage } from '@/features/assets/upload'
import { saveSlide, type Slide } from '@/features/slides/api'
import { EmbedFrame } from '@/features/slides/components/EmbedFrame'
import {
  detectEmbed,
  embedBox,
  linksInText,
  toEmbedUrl,
} from '@/features/slides/embeds'
import { needsStudentSnapshot } from '@/features/slides/teacher-edits'
import {
  createAutosave,
  type SaveStatus,
} from '@/features/slides/engine/autosave'
import {
  FRAME_RENDERING,
  findFrame,
  loadElements,
  toBinaryFiles,
} from '@/features/slides/engine/runtime'
import {
  dataUrlToFile,
  imageFileIds,
  isAllowedEmbed,
  planFiles,
  sceneSignature,
  serializeScene,
  SlideTooLargeError,
  TooManyImagesError,
} from '@/features/slides/engine/scene'
import { MAX_IMAGES_PER_SLIDE, MAX_SLIDE_BYTES, type ImageRef } from '@/model'

// The slide editor: one Excalidraw canvas per slide, "basic edition" UI (PLAN.md → Slides).
// New images are uploaded to Cloudinary as soon as they appear; the slide stores only references.
// Default export: always loaded lazily (Excalidraw is the biggest chunk of the app).

export type SlideCanvasHandle = {
  /** Save pending changes now (slide switch, leaving the editor). */
  flush: () => Promise<void>
  /** M14: adds an embed (already converted link) centered on the slide */
  insertEmbed: (link: string, aspect: number) => void
  /** M14: replaces texts that are only an embeddable link by the embed, in place; returns how many */
  convertTextLinks: () => number
}

type Props = {
  boardId: string
  studentId: string
  slide: Slide
  language: string
  onStatus: (status: SaveStatus, error?: unknown) => void
  onSize?: (bytes: number) => void
  /** An image could not be uploaded (it is removed from the slide) */
  onImageError: (error: unknown) => void
  /** M15: the board's teacher editing a student's slide (their first save keeps the student's version) */
  editor?: 'student' | 'teacher'
  ref?: Ref<SlideCanvasHandle>
}

type Autosave = ReturnType<typeof createAutosave>
type Latest = { elements: readonly ExcalidrawElement[]; background: string }

export default function SlideCanvas({
  boardId,
  studentId,
  slide,
  language,
  onStatus,
  onSize,
  onImageError,
  editor = 'student',
  ref,
}: Props) {
  const slideId = slide.id
  // The slide as stored when the editor opened it, and whether the student's version was kept
  const [opened] = useState(slide)
  const studentKept = useRef(false)
  const api = useRef<ExcalidrawImperativeAPI | null>(null)
  const known = useRef(new Map(Object.entries(slide.files ?? {})))
  const uploads = useRef(new Map<string, Promise<ImageRef | null>>())
  const signature = useRef<string | null>(null)
  const callbacks = useRef({ onStatus, onSize, onImageError })
  useLayoutEffect(() => {
    callbacks.current = { onStatus, onSize, onImageError }
  })
  const autosave = useRef<Autosave | null>(null)

  const [initial] = useState(() => {
    const { elements, background } = loadElements(slide.content)
    return {
      elements,
      appState: {
        viewBackgroundColor: background,
        frameRendering: FRAME_RENDERING,
      },
      files: Object.fromEntries(
        toBinaryFiles(slide.files ?? {}).map((file) => [file.id, file]),
      ) as BinaryFiles,
    }
  })
  // What the next save writes: the last scene Excalidraw reported (works after unmount too)
  const latest = useRef<Latest>({
    elements: initial.elements,
    background: initial.appState.viewBackgroundColor,
  })

  /** New elements must belong to the slide frame (export clips to it). */
  function addToSlide(
    created: readonly ExcalidrawElement[],
    remove: readonly string[] = [],
  ) {
    const scene = api.current
    const frame = scene && findFrame(scene.getSceneElements())
    if (!scene || !frame) return
    scene.updateScene({
      elements: [
        ...scene
          .getSceneElementsIncludingDeleted()
          .map((element) =>
            remove.includes(element.id)
              ? newElementWith(element, { isDeleted: true })
              : element,
          ),
        ...created.map((element) =>
          newElementWith(element, { frameId: frame.id }),
        ),
      ],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
  }

  /**
   * An embed element. Excalidraw doesn't export its embeddable constructor; an embeddable has the
   * shape of a rectangle plus a link, so we build a rectangle and change its type.
   */
  function embeddable(
    link: string,
    box: ReturnType<typeof embedBox>,
  ): ExcalidrawElement[] {
    const [rectangle] = convertToExcalidrawElements([
      { type: 'rectangle', ...box },
    ])
    return [
      {
        ...rectangle,
        type: 'embeddable',
        link,
        strokeColor: 'transparent',
      } as unknown as ExcalidrawElement,
    ]
  }

  useImperativeHandle(
    ref,
    () => ({
      flush: async () => autosave.current?.flush(),
      insertEmbed: (link, aspect) =>
        addToSlide(embeddable(link, embedBox(aspect))),
      convertTextLinks: () => {
        const scene = api.current
        if (!scene) return 0
        const created: ExcalidrawElement[] = []
        const removed: string[] = []
        for (const element of scene.getSceneElements()) {
          if (element.type !== 'text') continue
          const [link] = linksInText(element.originalText || element.text)
          const embed = link && toEmbedUrl(link)
          if (!embed) continue
          const box = embedBox(detectEmbed(embed)!.aspect)
          created.push(
            ...embeddable(embed, {
              ...box,
              // in place, but inside the slide
              x: Math.max(0, Math.min(element.x, 960 - box.width)),
              y: Math.max(0, Math.min(element.y, 540 - box.height)),
            }),
          )
          removed.push(element.id)
        }
        if (created.length) addToSlide(created, removed)
        return created.length
      },
    }),
    [],
  )

  useEffect(() => {
    const scheduler = createAutosave({
      save: async () => {
        // Wait for the images still uploading; failed ones are dropped from the slide
        await Promise.all(uploads.current.values())
        const { elements, background } = latest.current
        const { files, missing } = planFiles(
          imageFileIds(elements),
          known.current,
        )
        const kept = missing.length
          ? elements.filter(
              (element) =>
                !(
                  element.type === 'image' && missing.includes(element.fileId!)
                ),
            )
          : elements
        const { content, bytes } = serializeScene(kept, background)
        callbacks.current.onSize?.(bytes)
        if (bytes > MAX_SLIDE_BYTES) throw new SlideTooLargeError()
        const keep =
          editor === 'teacher' &&
          needsStudentSnapshot(opened, studentKept.current)
            ? opened
            : undefined
        await saveSlide(
          boardId,
          studentId,
          slideId,
          content,
          bytes,
          files,
          (error) => callbacks.current.onStatus('error', error),
          editor === 'teacher'
            ? { role: 'teacher', keep }
            : { role: 'student' },
        )
        if (editor === 'teacher') studentKept.current = true
      },
      onStatus: (status, error) => callbacks.current.onStatus(status, error),
    })
    autosave.current = scheduler

    const onHide = () => {
      if (document.visibilityState === 'hidden') void scheduler.flush()
    }
    const onUnload = (event: BeforeUnloadEvent) => {
      if (!scheduler.dirty) return
      void scheduler.flush()
      event.preventDefault()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      // Leaving the slide: save what's pending, then stop the timers
      void scheduler.flush().finally(() => scheduler.dispose())
      autosave.current = null
    }
  }, [boardId, studentId, slideId, editor, opened])

  /** Zooms so the whole 16:9 slide fits the canvas (false while Excalidraw isn't ready yet). */
  function fitSlide() {
    const scene = api.current
    const frame = scene && findFrame(scene.getSceneElements())
    if (!frame || !scene.getAppState().width) return false
    scene.scrollToContent(frame, {
      fitToViewport: true,
      viewportZoomFactor: 0.9,
      animate: false,
    })
    return true
  }

  // Fit once the scene is ready, and again when the canvas size changes (rotating a phone)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frames = 0
    let request = 0
    const tryFit = () => {
      if (!fitSlide() && frames++ < 120) request = requestAnimationFrame(tryFit)
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(request)
      frames = 0
      request = requestAnimationFrame(tryFit)
    })
    if (container.current) observer.observe(container.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(request)
    }
  }, [])

  function removeImages(fileIds: readonly string[]) {
    const scene = api.current
    if (!scene) return
    scene.updateScene({
      elements: scene
        .getSceneElementsIncludingDeleted()
        .map((element) =>
          element.type === 'image' && fileIds.includes(element.fileId!)
            ? newElementWith(element, { isDeleted: true })
            : element,
        ),
      captureUpdate: CaptureUpdateAction.NEVER,
    })
  }

  function upload(fileId: string, dataURL: string) {
    const extension = dataURL.slice(11, dataURL.indexOf(';')) || 'png'
    const pending = uploadImage({
      file: dataUrlToFile(dataURL, `${fileId}.${extension}`),
      boardId,
      studentId,
      kind: 'slide',
    })
      .then((ref) => {
        known.current.set(fileId, ref)
        return ref
      })
      .catch((error: unknown) => {
        logUploadFailure(error)
        removeImages([fileId])
        callbacks.current.onImageError(error)
        return null
      })
      .finally(() => uploads.current.delete(fileId))
    uploads.current.set(fileId, pending)
  }

  function onChange(
    elements: readonly ExcalidrawElement[],
    background: string,
    files: BinaryFiles,
  ) {
    latest.current = { elements, background }
    const next = sceneSignature(elements, background)
    if (signature.current === null) {
      signature.current = next
      return
    }
    if (signature.current === next) return
    signature.current = next

    const ids = imageFileIds(elements)
    const fresh = ids.filter(
      (id) => !known.current.has(id) && !uploads.current.has(id),
    )
    if (fresh.length) {
      const room = MAX_IMAGES_PER_SLIDE - (ids.length - fresh.length)
      const rejected = fresh.slice(Math.max(0, room))
      if (rejected.length) {
        removeImages(rejected)
        callbacks.current.onImageError(new TooManyImagesError())
      }
      for (const id of fresh.slice(0, Math.max(0, room))) {
        const dataURL = files[id]?.dataURL
        if (dataURL?.startsWith('data:')) upload(id, dataURL)
      }
    }
    autosave.current?.change()
  }

  return (
    <div
      ref={container}
      className="slide-canvas h-full w-full"
      data-testid="slide-canvas"
    >
      <Excalidraw
        excalidrawAPI={(instance) => {
          api.current = instance
        }}
        initialData={initial}
        onChange={(elements, appState, files) =>
          onChange(elements, appState.viewBackgroundColor, files)
        }
        langCode={language.startsWith('en') ? 'en' : 'es-ES'}
        validateEmbeddable={isAllowedEmbed}
        // M14: converted link, sandboxed, with the loading / "¿No carga?" states
        renderEmbeddable={(element) =>
          element.link ? <EmbedFrame link={element.link} /> : null
        }
        aiEnabled={false}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: false,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            toggleTheme: false,
          },
          tools: { image: true },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  )
}
