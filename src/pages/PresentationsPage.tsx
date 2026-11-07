import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { EyeOff, LayoutGrid, List, Presentation, Settings } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { adminTabPath } from '@/features/boards/admin-tabs'
import { useClassAccess } from '@/features/classes/use-class-access'
import { usePresentations } from '@/features/presentations/hooks'
import {
  embedUrl,
  thumbnailUrl as slideThumbnail,
} from '@/features/presentations/presentations'
import { EmbedFrame } from '@/features/slides/components/EmbedFrame'
import { cn } from '@/lib/utils'
import type { PresentationDoc } from '@/model'
import type { WithId } from '@/lib/firestore-hooks'

type View = 'grid' | 'list'

function readView(): View {
  try {
    const v = localStorage.getItem('presentations-view')
    return v === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function saveView(v: View) {
  try {
    localStorage.setItem('presentations-view', v)
  } catch {
    /* ignore */
  }
}

export function PresentationsPage() {
  const { t } = useTranslation()
  const { boardId = '' } = useParams()
  const access = useClassAccess(boardId)
  // Students read only the visible ones (D121): wait to know who's looking
  const presentations = usePresentations(boardId, {
    load: !access.loading && access.allowed,
    onlyVisible: !access.teacher,
  })
  const [view, setView] = useState<View>(readView)
  const [selected, setSelected] = useState<WithId<PresentationDoc> | null>(null)

  if (!access.loading && !access.allowed)
    return (
      <section className="mx-auto max-w-3xl p-6">
        <p>{t('space.notFound')}</p>
      </section>
    )

  const loading = access.loading || presentations.loading
  const list = presentations.data

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
            <Presentation className="mr-1 inline size-6" />
            {t('presentations.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {access.teacher
              ? t('presentations.teacherHint')
              : t('presentations.hint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon-sm"
              title={t('presentations.gridView')}
              onClick={() => toggleView('grid')}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon-sm"
              title={t('presentations.listView')}
              onClick={() => toggleView('list')}
            >
              <List className="size-4" />
            </Button>
          </div>
          {access.teacher && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to={adminTabPath(boardId, 'presentations')} />}
            >
              <Settings />
              {t('presentations.manage')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96" />
      ) : list.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center text-muted-foreground"
          data-testid="no-presentations"
        >
          {access.teacher
            ? t('presentations.noneTeacher')
            : t('presentations.none')}
        </p>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
              onClick={() => setSelected(p)}
              data-testid="presentation"
              data-presentation={p.id}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {slideThumbnail(p.presentationId, p.published) && (
                  <img
                    src={slideThumbnail(p.presentationId, p.published) ?? ''}
                    alt={p.title}
                    loading="lazy"
                    className="size-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget
                      img.style.display = 'none'
                      img.parentElement
                        ?.querySelector('[data-fallback]')
                        ?.removeAttribute('hidden')
                    }}
                  />
                )}
                <span
                  data-fallback
                  hidden={!!slideThumbnail(p.presentationId, p.published)}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Presentation className="size-12 text-muted-foreground/40" />
                </span>
              </div>
              <div className="flex items-center gap-2 p-3">
                <span className="truncate text-sm font-semibold">
                  {p.title}
                </span>
                {access.teacher && !p.enabled && (
                  <Badge variant="secondary" className="shrink-0">
                    <EyeOff className="mr-1 size-3" />
                    {t('presentations.disabled')}
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        list.map((p) => (
          <article
            key={p.id}
            className="flex flex-col gap-2"
            data-testid="presentation"
            data-presentation={p.id}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{p.title}</h2>
              {access.teacher && !p.enabled && (
                <Badge variant="secondary">
                  <EyeOff className="mr-1 size-3" />
                  {t('presentations.disabled')}
                </Badge>
              )}
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-xl border">
              <EmbedFrame
                link={embedUrl(p.presentationId, p.published)}
                title={p.title}
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
            <div className="aspect-video w-full overflow-hidden rounded-lg border">
              <EmbedFrame
                link={embedUrl(selected.presentationId, selected.published)}
                title={selected.title}
              />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
