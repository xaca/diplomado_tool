import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Clapperboard } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UploadError, uploadImage } from '@/features/assets/upload'
import { recordBoardActivity } from '@/features/boards/api'
import { saveClassDrawing } from '@/features/classes/api'
import { useClass, useClassSlides } from '@/features/classes/hooks'
import { useClassAccess } from '@/features/classes/use-class-access'
import { InsertEmbedDialog } from '@/features/slides/components/InsertEmbedDialog'
import { SaveIndicator } from '@/features/slides/components/SaveIndicator'
import type { SaveStatus } from '@/features/slides/engine/autosave'
import type {
  CanvasPersist,
  SlideCanvasHandle,
} from '@/features/slides/engine/SlideCanvas'
import { TooManyImagesError } from '@/features/slides/engine/scene'

const SlideCanvas = lazy(() => import('@/features/slides/engine/SlideCanvas'))

/**
 * M10b: the teacher designs a class slide with Excalidraw (the students' slide editor, autosaved
 * onto the class slide). The drawing becomes the wall's background; students only react and
 * add notes.
 */
export function ClassDesignPage() {
  const { t, i18n } = useTranslation()
  const { boardId = '', classId = '', slideId = '' } = useParams()
  const access = useClassAccess(boardId)
  const klass = useClass(access.teacher ? boardId : undefined, classId)
  const slides = useClassSlides(
    access.teacher ? boardId : undefined,
    classId,
    klass.data?.slideOrder,
  )
  const canvas = useRef<SlideCanvasHandle>(null)
  const [status, setStatus] = useState<{ value: SaveStatus; error?: unknown }>({
    value: 'idle',
  })
  const [bytes, setBytes] = useState(0)
  const [inserting, setInserting] = useState(false)
  // The drawing as it was when the page opened: the canvas owns it from then on
  const [persist] = useState<CanvasPersist>(() => ({
    save: (content, size, files) =>
      saveClassDrawing(boardId, classId, slideId, {
        content,
        bytes: size,
        files,
      }),
    upload: (file) =>
      uploadImage({ file, boardId, studentId: 'board', kind: 'class' }),
  }))
  const slide = slides.data.find((item) => item.id === slideId)
  const number = (klass.data?.slideOrder.indexOf(slideId) ?? -1) + 1
  const back = `/b/${boardId}/class/${classId}${number > 1 ? `?slide=${number}` : ''}`

  if (!access.loading && !access.teacher)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  return (
    <section className="flex h-[calc(100svh-3.5rem)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Link
          to={back}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {klass.data?.title}
        </Link>
        <h1 className="flex-1 truncate font-semibold">
          {t('classes.designTitle', { number })}
        </h1>
        <Button
          variant="outline"
          size="sm"
          disabled={!slide}
          onClick={() => setInserting(true)}
        >
          <Clapperboard />
          {t('embeds.insert')}
        </Button>
        <SaveIndicator
          status={status.value}
          error={status.error}
          bytes={bytes}
        />
        <Button size="sm" nativeButton={false} render={<Link to={back} />}>
          {t('classes.designDone')}
        </Button>
      </header>
      <div className="min-h-0 flex-1" data-testid="class-design">
        {slide ? (
          <Suspense fallback={<Skeleton className="h-full rounded-none" />}>
            <SlideCanvas
              ref={canvas}
              boardId={boardId}
              studentId="board"
              slide={{
                id: slide.id,
                content: slide.content ?? '',
                files: slide.files ?? {},
              }}
              language={i18n.resolvedLanguage ?? 'es'}
              persist={persist}
              onStatus={(value, error) => {
                setStatus({ value, error })
                if (value === 'saved') void recordBoardActivity(boardId)
              }}
              onSize={setBytes}
              onImageError={(error) =>
                toast.error(
                  error instanceof TooManyImagesError
                    ? t('slides.tooManyImages')
                    : t(
                        `cover.errors.${error instanceof UploadError ? error.reason : 'network'}`,
                      ),
                )
              }
            />
          </Suspense>
        ) : (
          <Skeleton className="h-full rounded-none" />
        )}
      </div>
      {inserting && (
        <InsertEmbedDialog
          onClose={() => setInserting(false)}
          onInsert={(link, aspect) => {
            canvas.current?.insertEmbed(link, aspect)
            toast.success(t('embeds.inserted'))
          }}
        />
      )}
    </section>
  )
}
