import { useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { NOTE_PAPER } from '@/features/classes/colors'
import { ReactionBar } from '@/features/classes/components/ReactionBar'
import {
  clampPosition,
  NOTE_H,
  NOTE_W,
  type Point,
} from '@/features/classes/wall'
import type { WithId } from '@/lib/firestore-hooks'
import { cn } from '@/lib/utils'
import type { Reaction, StickyNoteDoc } from '@/model'

/** Below this many pixels a press is a click (open), not a drag */
const DRAG_FROM_PX = 4

type Props = {
  note: WithId<StickyNoteDoc>
  wall: RefObject<HTMLDivElement | null>
  uid: string | undefined
  /** Mine (or I'm the teacher) and the slide is writable */
  canMove: boolean
  canEdit: boolean
  /** Someone else's note, the slide writable */
  canReact: boolean
  /** Created after the page opened: pops in */
  fresh: boolean
  onMove: (point: Point) => Promise<unknown>
  onOpen: () => void
  onReact: (emoji: Reaction) => void
}

/**
 * One sticky note on the wall (M10). Drag with mouse or finger (pointer events), saved on drop
 * (D87); other people's moves glide in. Click opens the editor (own notes / the teacher).
 */
export function StickyNote({
  note,
  wall,
  uid,
  canMove,
  canEdit,
  canReact,
  fresh,
  onMove,
  onOpen,
  onReact,
}: Props) {
  const { t } = useTranslation()
  const start = useRef<{
    px: number
    py: number
    from: Point
    rect: DOMRect
    moved: boolean
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [drag, setDrag] = useState<Point | null>(null)
  // While dragging, and after the drop until the save is done (the saved place has arrived)
  const place = drag ?? { x: note.x, y: note.y }
  const teacherNote = note.authorRole === 'teacher'

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button, [role="menu"]')) return
    const rect = wall.current?.getBoundingClientRect()
    if (!rect) return
    start.current = {
      px: event.clientX,
      py: event.clientY,
      from: { x: note.x, y: note.y },
      rect,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = start.current
    if (!current || !canMove) return
    const dx = event.clientX - current.px
    const dy = event.clientY - current.py
    if (!current.moved && Math.hypot(dx, dy) < DRAG_FROM_PX) return
    current.moved = true
    setDragging(true)
    setDrag(
      clampPosition({
        x: current.from.x + dx / current.rect.width,
        y: current.from.y + dy / current.rect.height,
      }),
    )
  }

  function onPointerUp() {
    const current = start.current
    start.current = null
    setDragging(false)
    if (!current) return
    if (!current.moved) {
      if (canEdit) onOpen()
      return
    }
    if (drag)
      onMove(drag)
        .catch(() => undefined)
        .finally(() => setDrag(null))
  }

  return (
    <div
      role={canEdit ? 'button' : 'note'}
      tabIndex={canEdit ? 0 : undefined}
      aria-label={t('classes.noteBy', {
        name: note.authorName,
        text: note.text,
      })}
      onKeyDown={(event) => {
        if (canEdit && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onOpen()
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null
        setDragging(false)
        setDrag(null)
      }}
      className={cn(
        'absolute flex flex-col gap-[0.4cqw] rounded-[0.3cqw] p-[0.7cqw] text-neutral-900 shadow-md outline-none select-none focus-visible:ring-2 focus-visible:ring-sky-500',
        canMove && 'cursor-grab touch-none',
        dragging
          ? 'z-20 scale-105 cursor-grabbing shadow-xl'
          : 'transition-[left,top] duration-300 ease-out',
        canEdit && !canMove && 'cursor-pointer',
        fresh && 'note-pop',
        teacherNote && 'ring-2 ring-neutral-900/70',
      )}
      style={{
        left: `${place.x * 100}%`,
        top: `${place.y * 100}%`,
        width: `${NOTE_W * 100}%`,
        height: `${NOTE_H * 100}%`,
        backgroundColor: NOTE_PAPER[note.color] ?? NOTE_PAPER.yellow,
        rotate: `${((note.id.charCodeAt(note.id.length - 1) % 5) - 2) * 0.6}deg`,
      }}
      data-testid="sticky-note"
      data-note-id={note.id}
      data-author={note.authorName}
    >
      <p className="line-clamp-5 min-h-0 flex-1 overflow-hidden text-[clamp(9px,1.05cqw,16px)] leading-snug break-words whitespace-pre-line">
        {note.text}
      </p>
      <div className="flex items-center gap-1 text-[clamp(8px,0.8cqw,12px)] text-black/60">
        <span className="truncate font-medium">{note.authorName}</span>
        {teacherNote && (
          <span className="shrink-0 rounded bg-neutral-900 px-1 font-semibold text-white">
            {t('classes.teacher')}
          </span>
        )}
        {note.editedByTeacher && (
          <span className="shrink-0" title={t('classes.editedByTeacher')}>
            ✎
          </span>
        )}
      </div>
      <ReactionBar
        reactions={note.reactions}
        uid={uid}
        authorName={note.authorName}
        onReact={canReact ? onReact : undefined}
      />
    </div>
  )
}
