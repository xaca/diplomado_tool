import { useTranslation } from 'react-i18next'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SlidePreview } from '@/features/slides/components/SlidePreview'
import type { Slide } from '@/features/slides/api'
import { cn } from '@/lib/utils'
import { MAX_SLIDES } from '@/model'

type Props = {
  slides: Slide[]
  currentId: string | undefined
  busy: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onDuplicate: (slide: Slide) => void
  onDelete: (slide: Slide) => void
  onReorder: (order: string[]) => void
}

/** Slide list of the editor: select, add, duplicate, delete, drag (or keyboard) to reorder. */
export function SlideSidebar({
  slides,
  currentId,
  busy,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
}: Props) {
  const { t } = useTranslation()
  const sensors = useSensors(
    // A small distance keeps plain clicks working as "select"
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const ids = slides.map((slide) => slide.id)
  const full = slides.length >= MAX_SLIDES

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onReorder(
      arrayMove(
        ids,
        ids.indexOf(String(active.id)),
        ids.indexOf(String(over.id)),
      ),
    )
  }

  return (
    <aside
      className="flex shrink-0 gap-2 overflow-auto border-b bg-muted/40 p-2 md:w-48 md:flex-col md:border-r md:border-b-0"
      aria-label={t('slides.list')}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <ol className="flex gap-2 md:flex-col">
            {slides.map((slide, index) => (
              <SortableSlide
                key={slide.id}
                slide={slide}
                index={index}
                selected={slide.id === currentId}
                busy={busy}
                full={full}
                onSelect={onSelect}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        className="shrink-0"
        disabled={busy || full}
        onClick={onAdd}
        title={full ? t('slides.max', { count: MAX_SLIDES }) : undefined}
      >
        <Plus />
        {t('slides.add')}
      </Button>
    </aside>
  )
}

function SortableSlide({
  slide,
  index,
  selected,
  busy,
  full,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  slide: Slide
  index: number
  selected: boolean
  busy: boolean
  full: boolean
} & Pick<Props, 'onSelect' | 'onDuplicate' | 'onDelete'>) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative w-36 shrink-0 md:w-full',
        isDragging && 'z-10 opacity-80',
      )}
      data-testid="slide-item"
    >
      <button
        type="button"
        className={cn(
          'block w-full overflow-hidden rounded-md border-2 bg-white text-left',
          selected
            ? 'border-primary'
            : 'border-transparent hover:border-muted-foreground/30',
        )}
        aria-current={selected ? 'true' : undefined}
        aria-label={t('slides.open', { number: index + 1 })}
        onClick={() => onSelect(slide.id)}
      >
        <SlidePreview slide={slide} />
      </button>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <span
          className="cursor-grab touch-none rounded p-0.5 hover:bg-muted"
          aria-label={t('slides.drag', { number: index + 1 })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </span>
        <span className="flex-1">{index + 1}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy || full}
          aria-label={t('slides.duplicate', { number: index + 1 })}
          onClick={() => onDuplicate(slide)}
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={busy}
          aria-label={t('slides.delete', { number: index + 1 })}
          onClick={() => onDelete(slide)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
