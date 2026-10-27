import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, HardDrive } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  archiveBoard,
  restoreBoard,
  setArchiveAfterDays,
} from '@/features/boards/api'
import {
  ARCHIVE_AFTER_CHOICES,
  archivedSince,
  autoArchiveDate,
  isArchived,
  lifecycleOf,
  suggestPurge,
} from '@/features/boards/lifecycle'
import type { WithId } from '@/lib/firestore-hooks'
import type { BoardDoc } from '@/model'

/** Teacher board page: archived or not, archive now / restore, auto-archive delay, storage link. */
export function LifecyclePanel({ board }: { board: WithId<BoardDoc> }) {
  const { t, i18n } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const lifecycle = lifecycleOf(board)
  const archived = isArchived(lifecycle)
  const date = (value: Date) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'es', {
      dateStyle: 'long',
    }).format(value)

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border p-4"
      data-testid="lifecycle-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">{t('lifecycle.title')}</h2>
          {archived ? (
            <p className="text-sm text-muted-foreground">
              {t('lifecycle.archivedSince', {
                date: date(archivedSince(lifecycle)),
              })}
            </p>
          ) : board.status === 'active' ? (
            <p className="text-sm text-muted-foreground">
              {t('lifecycle.autoArchive', {
                date: date(autoArchiveDate(lifecycle)),
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('lifecycle.locked')}
            </p>
          )}
          {suggestPurge(lifecycle) && (
            <p className="text-sm text-amber-700">
              {t('lifecycle.considerPurge')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={`/teacher/boards/${board.id}/storage`} />}
          >
            <HardDrive />
            {t('storage.title')}
          </Button>
          {archived ? (
            <Button
              disabled={busy}
              onClick={() =>
                void run(() => restoreBoard(board.id), t('lifecycle.restored'))
              }
            >
              <ArchiveRestore />
              {t('lifecycle.restore')}
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              <Archive />
              {t('lifecycle.archiveNow')}
            </Button>
          )}
        </div>
      </div>

      {!archived && board.status === 'active' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="archive-after">{t('lifecycle.after')}</Label>
          <select
            id="archive-after"
            className="h-8 rounded-lg border bg-background px-2"
            value={board.archiveAfterDays}
            disabled={busy}
            onChange={(event) =>
              void run(
                () => setArchiveAfterDays(board.id, Number(event.target.value)),
                t('lifecycle.saved'),
              )
            }
          >
            {(ARCHIVE_AFTER_CHOICES as readonly number[])
              .concat(
                ARCHIVE_AFTER_CHOICES.includes(
                  board.archiveAfterDays as (typeof ARCHIVE_AFTER_CHOICES)[number],
                )
                  ? []
                  : [board.archiveAfterDays],
              )
              .map((days) => (
                <option key={days} value={days}>
                  {t('lifecycle.days', { count: days })}
                </option>
              ))}
          </select>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('lifecycle.archiveTitle', { title: board.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('lifecycle.archiveHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void run(() => archiveBoard(board.id), t('lifecycle.archived'))
              }
            >
              {t('lifecycle.archiveNow')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
