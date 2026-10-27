import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileJson,
  Sparkles,
  Trash2,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoard } from '@/features/boards/hooks'
import { buildBackup, buildTemplate } from '@/features/data-transfer/backup'
import { analyzeStorage, formatBytes } from '@/features/storage/analysis'
import {
  cleanUpImages,
  loadBoardData,
  purgeBoard,
  type BoardData,
  type PurgeStep,
} from '@/features/storage/api'
import { downloadJson, slugify } from '@/lib/download'
import { mediaApi, type CloudinaryUsage } from '@/lib/media-api'

/** Cloudinary credits warning threshold (PLAN.md → Usage meter) */
const USAGE_WARNING_PERCENT = 70

/** Teacher: storage used by a board, cleanup of unused images, backup and purge. */
export function StoragePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { boardId } = useParams()
  const board = useBoard(boardId)
  const locale = i18n.resolvedLanguage ?? 'es'

  const [data, setData] = useState<{
    value: BoardData | null
    error: boolean
  }>({ value: null, error: false })
  const [usage, setUsage] = useState<CloudinaryUsage | 'error' | null>(null)
  const [cleaning, setCleaning] = useState<number | null>(null)
  const [confirmClean, setConfirmClean] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [purging, setPurging] = useState<PurgeStep | null>(null)

  // Bumped to read the board again (after a cleanup)
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((value) => value + 1)

  useEffect(() => {
    if (!boardId) return
    let active = true
    loadBoardData(boardId).then(
      (value) => active && setData({ value, error: false }),
      (error: unknown) => {
        console.error('[storage] load failed', error)
        if (active) setData({ value: null, error: true })
      },
    )
    return () => {
      active = false
    }
  }, [boardId, version])

  useEffect(() => {
    mediaApi.usage().then(setUsage, () => setUsage('error'))
  }, [])

  if (board.loading) {
    return (
      <section className="mx-auto max-w-4xl p-6">
        <Skeleton className="h-40" />
      </section>
    )
  }
  if (!board.data || !boardId) {
    return (
      <section className="mx-auto max-w-4xl p-6">
        <p>{t('boards.notFound')}</p>
      </section>
    )
  }

  const title = board.data.title
  const report = data.value
    ? analyzeStorage({
        assets: data.value.assets,
        covers: data.value.covers,
        slideAssetIds: data.value.slideAssetIds,
      })
    : null
  const archived = board.data.status === 'archived'

  async function cleanUp() {
    if (!report || !boardId) return
    setConfirmClean(false)
    setCleaning(0)
    try {
      const { deleted, skipped } = await cleanUpImages(
        boardId,
        report.unused,
        setCleaning,
      )
      toast.success(t('storage.cleaned', { count: deleted }))
      if (skipped) toast.warning(t('storage.skipped', { count: skipped }))
    } catch (error) {
      console.error('[storage] cleanup failed', error)
      toast.error(t('storage.cleanError'))
    } finally {
      setCleaning(null)
      reload()
    }
  }

  function downloadBackup() {
    if (!data.value) return
    downloadJson(
      `copia-${slugify(title)}-${new Date().toISOString().slice(0, 10)}.json`,
      buildBackup(data.value.snapshot),
    )
    setBackupDone(true)
  }

  async function purge() {
    if (!boardId) return
    try {
      await purgeBoard(boardId, setPurging)
      toast.success(t('storage.purged', { title }))
      void navigate('/teacher', { replace: true })
    } catch (error) {
      console.error('[storage] purge failed', error)
      toast.error(t('storage.purgeError'))
      setPurging(null)
    }
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/teacher/boards/${boardId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          {title}
        </Link>
        <h1 className="font-heading text-2xl font-semibold">
          {t('storage.title')}
        </h1>
      </div>

      {/* Cloudinary credits, shared by every board and teacher */}
      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-semibold">{t('storage.usageTitle')}</h2>
        {usage === null ? (
          <Skeleton className="h-10" />
        ) : usage === 'error' ? (
          <p className="text-sm text-muted-foreground">
            {t('storage.usageError')}
          </p>
        ) : (
          <div className="flex flex-col gap-2" data-testid="usage-meter">
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usage.credits.percent)}
              aria-label={t('storage.usageTitle')}
            >
              <div
                className={
                  usage.credits.percent >= USAGE_WARNING_PERCENT
                    ? 'h-full bg-amber-500'
                    : 'h-full bg-primary'
                }
                style={{ width: `${Math.min(100, usage.credits.percent)}%` }}
              />
            </div>
            <p className="text-sm">
              {t('storage.credits', {
                used: usage.credits.used.toLocaleString(locale),
                limit: usage.credits.limit.toLocaleString(locale),
                percent: Math.round(usage.credits.percent),
              })}
              {' · '}
              {t('storage.cloudinaryTotals', {
                storage: formatBytes(usage.storageBytes, locale),
                bandwidth: formatBytes(usage.bandwidthBytes, locale),
              })}
            </p>
            {usage.credits.percent >= USAGE_WARNING_PERCENT && (
              <p className="flex items-center gap-1 text-sm text-amber-700">
                <AlertTriangle className="size-4" />
                {t('storage.usageWarning')}
              </p>
            )}
          </div>
        )}
      </section>

      {/* This board's images */}
      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('storage.boardTitle')}</h2>
        {data.error ? (
          <p className="text-sm text-destructive">{t('errors.generic')}</p>
        ) : !report ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <dl
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              data-testid="storage-report"
            >
              <Stat
                label={t('storage.stored')}
                value={t('storage.images', { count: report.stored.count })}
                detail={formatBytes(report.stored.bytes, locale)}
              />
              <Stat
                label={t('storage.used')}
                value={t('storage.images', { count: report.used.length })}
              />
              <Stat
                label={t('storage.unused')}
                value={t('storage.images', { count: report.unused.length })}
                detail={formatBytes(report.unusedBytes, locale)}
                testId="unused-count"
              />
            </dl>
            <p className="text-sm text-muted-foreground">
              {t('storage.unusedHint')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={report.unused.length === 0 || cleaning !== null}
                onClick={() => setConfirmClean(true)}
              >
                <Sparkles />
                {t('storage.cleanUp', { count: report.unused.length })}
              </Button>
              {cleaning !== null && (
                <span className="text-sm text-muted-foreground" role="status">
                  {t('storage.cleaning', {
                    done: cleaning,
                    total: report.unused.length,
                  })}
                </span>
              )}
            </div>
          </>
        )}
      </section>

      {/* Backup and template */}
      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('storage.backupTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('storage.backupHint')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!data.value}
            onClick={downloadBackup}
          >
            <Download />
            {t('storage.downloadBackup')}
          </Button>
          <Button
            variant="outline"
            disabled={!data.value}
            onClick={() =>
              data.value &&
              downloadJson(
                `plantilla-${slugify(title)}.json`,
                buildTemplate(data.value.snapshot.board),
              )
            }
          >
            <FileJson />
            {t('storage.downloadTemplate')}
          </Button>
        </div>
      </section>

      {/* Purge */}
      <section
        className="flex flex-col gap-3 rounded-xl border border-destructive/40 p-4"
        data-testid="purge-section"
      >
        <h2 className="font-semibold text-destructive">
          {t('storage.purgeTitle')}
        </h2>
        {!archived ? (
          <p className="text-sm text-muted-foreground">
            {t('storage.purgeOnlyArchived')}
          </p>
        ) : (
          <>
            <p className="text-sm">{t('storage.purgeHint')}</p>
            <ol className="flex flex-col gap-3 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <span>1.</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.value}
                  onClick={downloadBackup}
                >
                  <Download />
                  {t('storage.downloadBackup')}
                </Button>
                {backupDone && (
                  <span className="text-muted-foreground">
                    {t('storage.backupReady')}
                  </span>
                )}
              </li>
              <li className="flex flex-col gap-1">
                <Label htmlFor="purge-confirm">
                  2. {t('storage.typeTitle', { title })}
                </Label>
                <Input
                  id="purge-confirm"
                  value={confirmName}
                  disabled={!backupDone || purging !== null}
                  onChange={(event) => setConfirmName(event.target.value)}
                  autoComplete="off"
                />
              </li>
              <li>
                <Button
                  variant="destructive"
                  disabled={
                    !backupDone ||
                    confirmName.trim() !== title ||
                    purging !== null
                  }
                  onClick={() => void purge()}
                >
                  <Trash2 />
                  {purging
                    ? t(`storage.purgeSteps.${purging}`)
                    : t('storage.purgeConfirm')}
                </Button>
              </li>
            </ol>
          </>
        )}
      </section>

      <AlertDialog open={confirmClean} onOpenChange={setConfirmClean}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('storage.cleanTitle', { count: report?.unused.length ?? 0 })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('storage.cleanHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void cleanUp()}
            >
              {t('storage.cleanConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function Stat({
  label,
  value,
  detail,
  testId,
}: {
  label: string
  value: string
  detail?: string
  testId?: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
      {detail && <dd className="text-xs text-muted-foreground">{detail}</dd>}
    </div>
  )
}
