import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  canReloadForNewVersion,
  isChunkLoadError,
  reloadForNewVersion,
} from '@/lib/stale-build'

/**
 * Error page of every route (instead of React Router's developer page). A page that couldn't be
 * loaded because a deploy replaced the files reloads once onto the new version.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  const stale = isChunkLoadError(error) && canReloadForNewVersion()

  useEffect(() => {
    if (stale) reloadForNewVersion()
    else console.error('[route] error', error)
  }, [stale, error])

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="route-error"
    >
      {stale ? (
        <p className="text-muted-foreground">{t('errors.page.updating')}</p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{t('errors.page.title')}</h1>
          <p className="max-w-md text-muted-foreground">
            {t('errors.page.body')}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>
              {t('errors.page.reload')}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign('/')}
            >
              {t('errors.page.home')}
            </Button>
          </div>
        </>
      )}
    </main>
  )
}
