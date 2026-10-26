import { Navigate, Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { signOut } from '@/features/auth/api'
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

/** `/` sends teachers to their dashboard; students stay on their home. */
export function HomeRedirect({
  studentHome,
}: {
  studentHome: React.ReactNode
}) {
  const { role } = useAuth()
  return isTeacherRole(role) ? <Navigate to="/teacher" replace /> : studentHome
}
