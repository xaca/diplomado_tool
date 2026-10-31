import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReactionBar } from '@/features/classes/components/ReactionBar'
import { Wall } from '@/features/classes/components/Wall'
import { drawingOf } from '@/features/classes/wall'
import { updateClass } from '@/features/classes/api'
import {
  useClass,
  useClassSlides,
  useStickyNotes,
} from '@/features/classes/hooks'
import { useClassAccess } from '@/features/classes/use-class-access'

const READ_ONLY = {
  add: false,
  move: () => false,
  edit: () => false,
  react: () => false,
}

/**
 * A class on the projector (M10): the prompt big and the live wall, ←/→ between slides, Esc
 * leaves. With "Seguir al docente" on, the students follow the slide on screen.
 */
export function ClassPresentPage() {
  const { t } = useTranslation()
  const { boardId = '', classId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const access = useClassAccess(boardId)
  const klass = useClass(access.allowed ? boardId : undefined, classId)
  const order = klass.data?.slideOrder ?? []
  const slides = useClassSlides(
    access.allowed ? boardId : undefined,
    classId,
    order,
  )
  const [index, setIndex] = useState(() =>
    Math.max(0, Number(params.get('slide') ?? 1) - 1),
  )
  const current = Math.min(index, Math.max(0, order.length - 1))
  const slideId = order[current] ?? null
  const slide = slides.data.find((item) => item.id === slideId)
  const notes = useStickyNotes(
    access.allowed ? boardId : undefined,
    classId,
    slideId,
  )
  const back = `/b/${boardId}/class/${classId}`
  const follow = access.teacher && !!klass.data?.follow
  const live = klass.data?.liveSlideId

  // The students follow the slide on the projector
  useEffect(() => {
    if (follow && slideId && live !== slideId)
      void updateClass(boardId, classId, { liveSlideId: slideId }).catch(
        () => undefined,
      )
  }, [follow, slideId, live, boardId, classId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate(back)
      if (event.key === 'ArrowRight' || event.key === 'PageDown')
        setIndex((value) => Math.min(order.length - 1, value + 1))
      if (event.key === 'ArrowLeft' || event.key === 'PageUp')
        setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, back, order.length])

  return (
    <main
      className="flex min-h-svh flex-col gap-4 bg-neutral-900 p-4 text-white sm:p-8"
      data-testid="class-present"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-sm text-white/60">
            {klass.data?.title} · {t('classes.slideN', { number: current + 1 })}{' '}
            / {order.length}
          </p>
          {slide?.title && (
            <h1 className="font-heading text-3xl font-bold sm:text-5xl">
              {slide.title}
            </h1>
          )}
          {slide?.instructions && (
            <p className="mt-1 text-lg text-white/70">{slide.instructions}</p>
          )}
        </div>
        <Button
          variant="secondary"
          size="icon"
          aria-label={t('classes.exitPresent')}
          onClick={() => navigate(back)}
        >
          <X />
        </Button>
      </div>
      {slide && (
        <Wall
          slide={slide}
          drawing={drawingOf(slide)}
          notes={notes.data}
          uid={access.uid}
          can={READ_ONLY}
          onMove={() => Promise.resolve()}
          onOpen={() => undefined}
          onReact={() => undefined}
          className="mx-auto max-w-[calc((100svh-12rem)*16/9)]"
        />
      )}
      <div className="flex items-center justify-center gap-3 text-sm text-white/60">
        <Button
          variant="secondary"
          size="icon"
          aria-label={t('presenter.prevSlide')}
          disabled={current === 0}
          onClick={() => setIndex(current - 1)}
        >
          <ChevronLeft />
        </Button>
        {t('classes.presentHint')}
        {slide && (
          <span className="text-lg">
            <ReactionBar
              reactions={slide.reactions}
              uid={access.uid}
              authorName=""
              size="list"
            />
          </span>
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label={t('presenter.nextSlide')}
          disabled={current >= order.length - 1}
          onClick={() => setIndex(current + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </main>
  )
}
