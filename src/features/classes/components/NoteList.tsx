import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOTE_PAPER } from '@/features/classes/colors'
import { ReactionBar } from '@/features/classes/components/ReactionBar'
import type { WallPermissions } from '@/features/classes/components/Wall'
import { listOrder } from '@/features/classes/wall'
import type { WithId } from '@/lib/firestore-hooks'
import type { ClassSlideDoc, Reaction, StickyNoteDoc } from '@/model'

/** "Lista": the same notes as a list (phones, keyboard users), zone by zone. */
export function NoteList({
  slide,
  notes,
  uid,
  can,
  onOpen,
  onReact,
}: {
  slide: Pick<ClassSlideDoc, 'layout' | 'zones'>
  notes: WithId<StickyNoteDoc>[]
  uid: string | undefined
  can: WallPermissions
  onOpen: (note: WithId<StickyNoteDoc>) => void
  onReact: (note: WithId<StickyNoteDoc>, emoji: Reaction) => void
}) {
  const { t } = useTranslation()
  if (notes.length === 0)
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {can.add ? t('classes.empty') : t('classes.emptyRead')}
      </p>
    )
  return (
    <ul className="flex flex-col gap-2" data-testid="note-list">
      {listOrder(slide.layout, notes).map((note) => (
        <li
          key={note.id}
          className="flex flex-col gap-2 rounded-lg p-3 text-neutral-900 shadow-sm"
          style={{ backgroundColor: NOTE_PAPER[note.color] }}
          data-testid="sticky-note"
          data-note-id={note.id}
          data-author={note.authorName}
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm break-words whitespace-pre-line">
              {note.text}
            </p>
            {can.edit(note) && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('classes.editNote')}
                onClick={() => onOpen(note)}
              >
                <Pencil />
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-black/60">
            <span className="font-medium">{note.authorName}</span>
            {note.authorRole === 'teacher' && (
              <span className="rounded bg-neutral-900 px-1 font-semibold text-white">
                {t('classes.teacher')}
              </span>
            )}
            {note.editedByTeacher && (
              <span>✎ {t('classes.editedByTeacher')}</span>
            )}
            <span className="ml-auto">
              <ReactionBar
                reactions={note.reactions}
                uid={uid}
                authorName={note.authorName}
                onReact={
                  can.react(note) ? (emoji) => onReact(note, emoji) : undefined
                }
                size="list"
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
