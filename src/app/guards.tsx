import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api'
import { useBoard } from '@/features/boards/hooks'
import { normalizeEmail } from '@/lib/collections'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

export function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      {children}
    </div>
  )
}

function Loading() {
  const { t } = useTranslation()
  return (
    <FullScreenMessage>
      <p className="text-muted-foreground">{t('loading')}</p>
    </FullScreenMessage>
  )
}

/** Signed-in users only; also waits until the role is known. */
export function RequireAuth() {
  const { t } = useTranslation()
  const { user, loading, error } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (error) {
    return (
      <FullScreenMessage>
        <p className="max-w-sm">{t('auth.profileError')}</p>
        <Button variant="outline" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </Button>
      </FullScreenMessage>
    )
  }
  return <Outlet />
}

/** Teachers and admins only (role comes from staffEmails). */
export function RequireTeacher() {
  const { role } = useAuth()
  return isTeacherRole(role) ? <Outlet /> : <Navigate to="/" replace />
}

/**
 * Administrar and its pages: only the board's own teachers (`teacherEmails`), as in the rules. A
 * teacher of another board who is also a student here would otherwise see a page whose lists come
 * back empty and whose saves are refused. A missing board falls through to the page's own message.
 */
export function RequireBoardTeacher() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { boardId } = useParams()
  const board = useBoard(boardId)

  if (board.loading) return <Loading />
  if (
    board.data &&
    !board.data.teacherEmails.includes(normalizeEmail(user?.email ?? ''))
  ) {
    return (
      <FullScreenMessage>
        <p className="max-w-sm" data-testid="not-board-teacher">
          {t('boards.notTeacher')}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/teacher" />}
          >
            {t('boards.backToDashboard')}
          </Button>
          <Button nativeButton={false} render={<Link to={`/b/${boardId}`} />}>
            {t('boards.open')}
          </Button>
        </div>
      </FullScreenMessage>
    )
  }
  return <Outlet />
}

/** `/` sends teachers to their dashboard; students stay on their home. */
export function HomeRedirect({
  studentHome,
}: {
  studentHome: React.ReactNode
}) {
  const { role } = useAuth()
  return isTeacherRole(role) ? <Navigate to="/teacher" replace /> : studentHome
}
