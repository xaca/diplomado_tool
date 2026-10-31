import { useTranslation } from 'react-i18next'
import { Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Note } from '@/features/notes/api'
import { SlideNotes } from '@/features/notes/components/SlideNotes'
import type { TeacherProfile } from '@/model'

type Props = {
  boardId: string
  studentId: string | undefined
  slideId: string | undefined
  notes: Note[]
  teacherProfiles?: Record<string, TeacherProfile>
  /** Projected window: warn that the panel is visible to the class (D34) */
  onScreen: boolean
  onClose?: () => void
}

/**
 * The teacher's notes on the slide on screen (M13): same notes as the space page (F11), private
 * to the teacher and that student. Enter saves, Shift+Enter new line; typing never moves slides.
 */
export function PresenterNotesPanel({
  boardId,
  studentId,
  slideId,
  notes,
  teacherProfiles,
  onScreen,
  onClose,
}: Props) {
  const { t } = useTranslation()
  return (
    <aside
      className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto bg-neutral-900 p-3 sm:w-80"
      aria-label={t('presenterNotes.open')}
      data-testid="presenter-notes"
    >
      <header className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold">
          {t('presenterNotes.open')}
        </h2>
        {onScreen && (
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">
            <Eye className="size-3.5" />
            {t('presenterNotes.onScreen')}
          </span>
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white hover:bg-white/15 hover:text-white"
            aria-label={t('presenterNotes.close')}
            onClick={onClose}
          >
            <X />
          </Button>
        )}
      </header>
      {studentId && slideId ? (
        <SlideNotes
          key={slideId}
          boardId={boardId}
          studentId={studentId}
          slideId={slideId}
          notes={notes}
          canWrite
          enterToSave
          teacherProfiles={teacherProfiles}
        />
      ) : (
        <p className="text-sm text-white/60">{t('presenterNotes.noSlide')}</p>
      )}
    </aside>
  )
}
