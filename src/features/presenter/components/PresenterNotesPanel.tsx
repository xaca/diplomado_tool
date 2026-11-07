import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Note } from '@/features/notes/api'
import { cn } from '@/lib/utils'
import { SlideNotes } from '@/features/notes/components/SlideNotes'
import type { TeacherProfile } from '@/model'

type Props = {
  boardId: string
  studentId: string | undefined
  slideId: string | undefined
  notes: Note[]
  /** M27: comments on the whole project ("Proyecto" tab) */
  projectNotes: Note[]
  /** "en la diapositiva 3 de Laura Nataly" / "en el proyecto de Laura Nataly" */
  whereSlide: string
  whereProject: string
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
  projectNotes,
  whereSlide,
  whereProject,
  teacherProfiles,
  onScreen,
  onClose,
}: Props) {
  const { t } = useTranslation()
  // M27: this slide's comments, or the project's
  const [tab, setTab] = useState<'slide' | 'project'>('slide')
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
      <div className="flex gap-1" role="tablist">
        {(['slide', 'project'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs',
              tab === option
                ? 'bg-white text-neutral-900'
                : 'bg-white/10 text-white/80 hover:bg-white/20',
            )}
            onClick={() => setTab(option)}
          >
            {option === 'slide'
              ? t('comments.tabSlide')
              : t('comments.tabProject')}
            {(option === 'slide' ? notes : projectNotes).length > 0 &&
              ` · ${(option === 'slide' ? notes : projectNotes).length}`}
          </button>
        ))}
      </div>
      {studentId && tab === 'project' ? (
        <SlideNotes
          key={`${studentId}:project`}
          boardId={boardId}
          studentId={studentId}
          slideId={null}
          notes={projectNotes}
          canWrite
          enterToSave
          where={whereProject}
          teacherProfiles={teacherProfiles}
        />
      ) : studentId && slideId ? (
        <SlideNotes
          key={slideId}
          boardId={boardId}
          studentId={studentId}
          slideId={slideId}
          notes={notes}
          canWrite
          enterToSave
          where={whereSlide}
          teacherProfiles={teacherProfiles}
        />
      ) : (
        <p className="text-sm text-white/60">{t('presenterNotes.noSlide')}</p>
      )}
    </aside>
  )
}
