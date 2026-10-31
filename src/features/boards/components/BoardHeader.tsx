import { forwardRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { HomeLink } from '@/components/layout/HomeLink'
import { UserMenu } from '@/components/layout/UserMenu'
import { Garland } from '@/features/boards/components/Garland'
import type { Garland as GarlandKind } from '@/features/boards/styles'
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
  /** Scrolled down: one row (logo, title, icon actions), no description (sticky only) */
  compact: boolean
  /** Wrap labels in <HeaderActionLabel> so they fold to icons when compact or narrow */
  actions: ReactNode
  /** Under the title: stage summary, read-only notice… */
  children?: ReactNode
  /** M21: the style's decoration along the top, and the line next to the title */
  garland?: GarlandKind
  tagline?: string
}

/** An action's text: hidden (still the accessible name) on phones and in the compact header. */
export function HeaderActionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="group-data-compact/header:sr-only max-md:sr-only">
      {children}
    </span>
  )
}

/**
 * The board's header and the page's only one (M12), full width: the app's home link, the actions
 * and the user menu (the only avatar), then logo, students · teachers, title and description.
 * Sticky (D29) keeps it on top while scrolling (below the class clock banner) and folds it into
 * a single row.
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
    garland,
    tagline,
  },
  ref,
) {
  const { t } = useTranslation()
  const teachers = board.teacherEmails
    .map((email) => board.teacherProfiles?.[email])
    .filter((profile): profile is TeacherProfile => !!profile)
  const shrink = sticky && compact

  const logo = board.logo && (
    <img
      src={imageUrl(board.logo, IMAGE_SIZES.logo)}
      alt=""
      className={cn(
        'shrink-0 object-contain',
        shrink ? 'max-h-8 max-w-16' : 'max-h-16 max-w-32',
      )}
      data-intro
      data-testid="board-logo"
    />
  )
  const heading = (
    <h1
      className={cn(
        'truncate font-heading font-bold',
        shrink ? 'text-lg sm:text-xl' : 'text-2xl sm:text-4xl',
      )}
      data-testid="board-title"
      data-intro
    >
      {title}
    </h1>
  )

  return (
    <header
      ref={ref}
      role="banner"
      className={cn(
        'group/header flex flex-col transition-[padding,box-shadow] duration-300',
        shrink ? 'gap-2' : 'gap-4',
        tone === 'light' ? 'text-white' : 'text-neutral-900',
        // Full width, edge to edge (the cards below keep their centered column)
        'px-4 sm:px-6 lg:px-8',
        shrink ? 'py-2 shadow-md' : 'py-4',
        garland && 'pt-6',
        !sticky && 'relative z-[1]',
        sticky &&
          'sticky top-[var(--clock-banner-h,0px)] z-30 backdrop-blur-md',
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
      {garland && <Garland kind={garland} />}
      {/* Top row: home · (compact: logo + title) · actions · user menu */}
      <div className="flex items-center gap-3">
        <HomeLink
          compact={shrink}
          className={cn('shrink-0', !shrink && 'text-sm opacity-80')}
        />
        {shrink && (
          <div className="flex min-w-0 items-center gap-3">
            {logo}
            {heading}
          </div>
        )}
        <div
          className={cn(
            'ml-auto flex items-center justify-end gap-2',
            shrink ? 'shrink-0' : 'flex-wrap',
          )}
          data-intro
        >
          {actions}
        </div>
        <span className="h-6 w-px shrink-0 bg-current opacity-20" aria-hidden />
        <UserMenu />
      </div>

      {!shrink && (
        <div className="flex min-w-0 items-center gap-4">
          {logo}
          <div className="flex min-w-0 flex-col gap-1">
            <p
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              data-intro
            >
              <span className="flex items-center gap-1 opacity-80">
                <Users className="size-4" />
                {t('dashboard.students', { count: studentCount })}
              </span>
              {teachers.length > 0 && (
                <span data-testid="board-teachers">
                  <span className="opacity-80">
                    {t('look.teachers', { count: teachers.length })}:
                  </span>{' '}
                  <span className="font-medium">
                    {teachers.map((teacher) => teacher.name).join(', ')}
                  </span>
                  {teachers
                    .filter((teacher) => teacher.status)
                    .slice(0, 1)
                    .map((teacher) => (
                      <span
                        key={teacher.name}
                        className="ml-2 opacity-90"
                        data-testid="teacher-status"
                      >
                        · {teacher.status!.emoji} {teacher.status!.text}
                      </span>
                    ))}
                </span>
              )}
            </p>
            {heading}
            {tagline && (
              <p
                className="font-heading text-lg font-semibold opacity-95 sm:text-xl"
                data-testid="board-tagline"
                data-intro
              >
                {tagline}
              </p>
            )}
            {description && (
              <p className="max-w-3xl text-balance opacity-90" data-intro>
                {description}
              </p>
            )}
          </div>
        </div>
      )}
      {children}
    </header>
  )
})
