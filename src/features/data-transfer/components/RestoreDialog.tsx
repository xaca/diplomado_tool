import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { parseBoardFile, type BoardFile } from '@/features/data-transfer/backup'
import { restoreBoardFile } from '@/features/data-transfer/restore'
import { useAuth } from '@/providers/auth-context'

/** Teacher home: a backup or template file → a NEW board (never overwrites an existing one). */
export function RestoreDialog() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<BoardFile | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  function reset() {
    setFile(null)
    setInvalid(false)
    setProgress(null)
  }

  async function read(picked: File) {
    reset()
    try {
      setFile(parseBoardFile(JSON.parse(await picked.text())))
    } catch {
      setInvalid(true)
    }
  }

  async function restore() {
    if (!file || !user?.email) return
    setProgress({
      done: 0,
      total: file.kind === 'backup' ? file.file.students.length : 0,
    })
    try {
      const boardId = await restoreBoardFile(user.email, file, (done, total) =>
        setProgress({ done, total }),
      )
      toast.success(t('restore.done', { title: file.file.board.title }))
      setOpen(false)
      reset()
      void navigate(`/teacher/boards/${boardId}`)
    } catch (error) {
      console.error('[restore] failed', error)
      toast.error(t('restore.error'))
      setProgress(null)
    }
  }

  const slides =
    file?.kind === 'backup'
      ? file.file.spaces.reduce((sum, space) => sum + space.slides.length, 0)
      : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (progress) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload />
        {t('restore.open')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('restore.title')}</DialogTitle>
          <DialogDescription>{t('restore.hint')}</DialogDescription>
        </DialogHeader>

        <input
          type="file"
          accept="application/json,.json"
          aria-label={t('restore.choose')}
          data-testid="restore-input"
          disabled={progress !== null}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
          onChange={(event) => {
            const picked = event.target.files?.[0]
            if (picked) void read(picked)
          }}
        />

        {invalid && (
          <p className="text-sm text-destructive">{t('restore.invalid')}</p>
        )}
        {file && (
          <div
            className="rounded-lg bg-muted/50 p-3 text-sm"
            data-testid="restore-preview"
          >
            <p className="font-semibold">{file.file.board.title}</p>
            <p className="text-muted-foreground">
              {file.kind === 'backup'
                ? t('restore.backupSummary', {
                    students: file.file.students.length,
                    slides,
                  })
                : t('restore.templateSummary')}
            </p>
            {file.kind === 'backup' && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('restore.notes')}
              </p>
            )}
          </div>
        )}
        {progress && progress.total > 0 && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('restore.progress', progress)}
          </p>
        )}

        <DialogFooter>
          <Button
            disabled={!file || progress !== null}
            onClick={() => void restore()}
          >
            {t('restore.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
