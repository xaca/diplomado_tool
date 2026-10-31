import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StickyNote } from '@/features/classes/components/StickyNote'
import {
  clampPosition,
  NOTE_H,
  NOTE_W,
  zonesOf,
  type Point,
} from '@/features/classes/wall'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { ClassSlideDoc, Reaction, StickyNoteDoc } from '@/model'

export type WallPermissions = {
  /** Can add notes here */
  add: boolean
  move: (note: StickyNoteDoc) => boolean
  edit: (note: StickyNoteDoc) => boolean
  react: (note: StickyNoteDoc) => boolean
}

/**
 * The 16:9 sticky-note wall (M10): the layout's zones with their titles, and the notes on top.
 * Sizes follow the wall's width (container units), so it looks the same on any screen.
 */
export function Wall({
  slide,
  notes,
  uid,
  can,
  onAddAt,
  onMove,
  onOpen,
  onReact,
  className,
}: {
  slide: Pick<ClassSlideDoc, 'layout' | 'zones'>
  notes: WithId<StickyNoteDoc>[]
  uid: string | undefined
  can: WallPermissions
  onAddAt?: (point: Point) => void
  onMove: (note: WithId<StickyNoteDoc>, point: Point) => Promise<unknown>
  onOpen: (note: WithId<StickyNoteDoc>) => void
  onReact: (note: WithId<StickyNoteDoc>, emoji: Reaction) => void
  className?: string
}) {
  const { t } = useTranslation()
  const wall = useRef<HTMLDivElement>(null)
  // Notes written after the page opened pop in; the ones already there don't
  const [openedAt] = useState(() => Date.now())
  const zones = zonesOf(slide.layout)

  return (
    <div className={cn('@container w-full', className)}>
      <div
        ref={wall}
        className="relative aspect-video w-full overflow-hidden rounded-xl border bg-[#fdfcf8] shadow-inner"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgb(0 0 0 / 0.08) 1px, transparent 1.2px)',
          backgroundSize: '2.2cqw 2.2cqw',
        }}
        onDoubleClick={(event) => {
          if (!can.add || !onAddAt || event.target !== event.currentTarget)
            return
          const rect = event.currentTarget.getBoundingClientRect()
          onAddAt(
            clampPosition({
              x: (event.clientX - rect.left) / rect.width - NOTE_W / 2,
              y: (event.clientY - rect.top) / rect.height - NOTE_H / 2,
            }),
          )
        }}
        data-testid="wall"
        data-layout={slide.layout}
      >
        {zones.length > 1 &&
          zones.map((zone, index) => (
            <div
              key={index}
              aria-hidden={!slide.zones[index]}
              className={cn(
                'pointer-events-none absolute border-dashed border-neutral-300',
                zone.x > 0 && 'border-l-2',
                zone.y > 0 && 'border-t-2',
              )}
              style={{
                left: `${zone.x * 100}%`,
                top: `${zone.y * 100}%`,
                width: `${zone.w * 100}%`,
                height: `${zone.h * 100}%`,
              }}
            >
              {slide.zones[index] && (
                <p
                  className="truncate px-[1cqw] pt-[0.8cqw] text-[clamp(10px,1.4cqw,22px)] font-semibold text-neutral-500"
                  data-testid="zone-title"
                >
                  {slide.zones[index]}
                </p>
              )}
            </div>
          ))}
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            wall={wall}
            uid={uid}
            canMove={can.move(note)}
            canEdit={can.edit(note)}
            canReact={can.react(note)}
            fresh={
              !!note.createdAt && toDate(note.createdAt).getTime() > openedAt
            }
            onMove={(point) => onMove(note, point)}
            onOpen={() => onOpen(note)}
            onReact={(emoji) => onReact(note, emoji)}
          />
        ))}
        {notes.length === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-[clamp(12px,1.4cqw,20px)] text-neutral-400">
            {can.add ? t('classes.empty') : t('classes.emptyRead')}
          </p>
        )}
      </div>
    </div>
  )
}
