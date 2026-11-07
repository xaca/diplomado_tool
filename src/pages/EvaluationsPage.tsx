import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  ClipboardCheck,
  EyeOff,
  LayoutGrid,
  List,
  Settings,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { adminTabPath } from '@/features/boards/admin-tabs'
import { useClassAccess } from '@/features/classes/use-class-access'
import { useEvaluations } from '@/features/evaluations/hooks'
import { embedFormUrl } from '@/features/evaluations/evaluations'
import { EmbedFrame } from '@/features/slides/components/EmbedFrame'
import { cn } from '@/lib/utils'
import type { EvaluationDoc } from '@/model'
import type { WithId } from '@/lib/firestore-hooks'

type View = 'grid' | 'list'

function readView(): View {
  try {
    const v = localStorage.getItem('evaluations-view')
    return v === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

function saveView(v: View) {
  try {
    localStorage.setItem('evaluations-view', v)
  } catch {
    /* ignore */
  }
}

export function EvaluationsPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  // Students read only the visible ones (D121): wait to know who's looking
  const evaluations = useEvaluations(boardId, {
    load: !access.loading && access.allowed,
    onlyVisible: !access.teacher,
  })
  const [view, setView] = useState<View>(readView)
  const [selected, setSelected] = useState<WithId<EvaluationDoc> | null>(null)

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const loading = access.loading || evaluations.loading
  const list = evaluations.data

  function toggleView(v: View) {
    setView(v)
    saveView(v)
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {access.board.data?.title}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            <ClipboardCheck className="mr-1 inline size-6" />
            {t('evaluations.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {access.teacher
              ? t('evaluations.teacherHint')
              : t('evaluations.hint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              title={t('evaluations.gridView')}
              onClick={() => toggleView('grid')}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              title={t('evaluations.listView')}
              onClick={() => toggleView('list')}
            >
              <List className="size-4" />
            </Button>
          </div>
          {access.teacher && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={adminTabPath(boardId, 'evaluations')} />}
            >
              <Settings />
              {t('evaluations.manage')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : list.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"
          data-testid="no-evaluations"
        >
          {access.teacher
            ? t('evaluations.noneTeacher')
            : t('evaluations.none')}
        </p>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              onClick={() => setSelected(e)}
              data-testid="evaluation"
              data-evaluation={e.id}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                <iframe
                  src={embedFormUrl(e.formId, e.published)}
                  title={e.title}
                  className="pointer-events-none size-full"
                  tabIndex={-1}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <div className="flex items-center gap-2 p-3">
                <span className="truncate text-sm font-semibold">
                  {e.title}
                </span>
                {access.teacher && !e.enabled && (
                  <Badge variant="secondary" className="shrink-0">
                    <EyeOff className="mr-1 size-3" />
                    {t('evaluations.disabled')}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        list.map((e) => (
          <article
            key={e.id}
            className="flex flex-col gap-2"
            data-testid="evaluation"
            data-evaluation={e.id}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{e.title}</h2>
              {access.teacher && !e.enabled && (
                <Badge variant="secondary">
                  <EyeOff className="mr-1 size-3" />
                  {t('evaluations.disabled')}
                </Badge>
              )}
            </div>
            <div
              className="w-full overflow-hidden rounded-xl border"
              style={{ height: '70vh', minHeight: 500 }}
            >
              <EmbedFrame
                link={embedFormUrl(e.formId, e.published)}
                title={e.title}
              />
            </div>
          </article>
        ))
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        {selected && (
          <DialogContent className={cn('sm:max-w-5xl', 'flex flex-col gap-3')}>
            <DialogTitle>{selected.title}</DialogTitle>
            <div
              className="w-full overflow-hidden rounded-lg border"
              style={{ height: '80vh' }}
            >
              <EmbedFrame
                link={embedFormUrl(selected.formId, selected.published)}
                title={selected.title}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
