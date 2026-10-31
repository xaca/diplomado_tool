import { forwardRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { StageAvatar } from '@/features/stages/components/StageAvatar'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import { cn } from '@/lib/utils'
import type { BoardDoc, TeacherProfile } from '@/model'

type Props = {
  board: Pick<BoardDoc, 'logo' | 'teacherEmails' | 'teacherProfiles'>
  title: string
  description: string
  studentCount: number
  tone: 'dark' | 'light'
  /** The board background, for the sticky header's backdrop */
  backdrop: string
  sticky: boolean
  /** Scrolled down: smaller logo and title, no description (sticky only) */
  compact: boolean
  actions: ReactNode
  /** Under the title: stage summary, read-only notice… */
  children?: ReactNode
}

/**
 * Board header (M12): logo, title, description, the board's teachers with the #DOCENTE ring and
 * the actions. Sticky (D29) keeps it on top while scrolling and shrinks it.
 */
export const BoardHeader = forwardRef<HTMLElement, Props>(function BoardHeader(
  {
    board,
    title,
    description,
    studentCount,
    tone,
    backdrop,
    sticky,
    compact,
    actions,
    children,
  },
  ref,
) {
  const { t } = useTranslation()
  const teachers = board.teacherEmails
    .map((email) => board.teacherProfiles?.[email])
    .filter((profile): profile is TeacherProfile => !!profile)
  const shrink = sticky && compact

  return (
    <header
      ref={ref}
      className={cn(
        'flex flex-col gap-3 transition-[padding] duration-300',
        tone === 'light' ? 'text-white' : 'text-neutral-900',
        sticky &&
          'sticky top-0 z-30 -mx-4 px-4 backdrop-blur-md sm:-mx-6 sm:px-6',
        sticky && (shrink ? 'py-2 shadow-md' : 'py-3'),
      )}
      style={
        sticky
          ? {
              backgroundColor: `color-mix(in srgb, ${backdrop} 88%, transparent)`,
            }
          : undefined
      }
      data-testid="board-header"
      data-compact={shrink || undefined}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {board.logo && (
            <img
              src={imageUrl(board.logo, IMAGE_SIZES.logo)}
              alt=""
              className={cn(
                'shrink-0 object-contain transition-all duration-300',
                shrink ? 'max-h-9 max-w-20' : 'max-h-16 max-w-32',
              )}
              data-intro
              data-testid="board-logo"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            {!shrink && (
              <p
                className="flex items-center gap-1 text-sm opacity-80"
                data-intro
              >
                <Users className="size-4" />
                {t('dashboard.students', { count: studentCount })}
              </p>
            )}
            <h1
              className={cn(
                'truncate font-heading font-bold transition-all duration-300',
                shrink ? 'text-xl' : 'text-2xl sm:text-3xl',
              )}
              data-testid="board-title"
              data-intro
            >
              {title}
            </h1>
            {description && !shrink && (
              <p className="max-w-3xl opacity-90" data-intro>
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-intro>
          {teachers.length > 0 && !shrink && (
            <div
              className="mr-2 flex items-center gap-2 text-sm"
              data-testid="board-teachers"
            >
              <span className="opacity-80">
                {t('look.teachers', { count: teachers.length })}:
              </span>
              {teachers.map((teacher) => (
                <span key={teacher.name} className="flex items-center gap-1.5">
                  <StageAvatar
                    name={teacher.name}
                    photoURL={teacher.photoURL}
                    teacher
                    size={36}
                  />
                  <span className="font-medium">{teacher.name}</span>
                </span>
              ))}
            </div>
          )}
          {actions}
        </div>
      </div>
      {children}
    </header>
  )
})
