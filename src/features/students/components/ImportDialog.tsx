import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { importStudents, type Student } from '@/features/students/api'
import {
  buildPreview,
  parseQuickAdd,
  parseStudentsJson,
  STUDENTS_TEMPLATE,
  summarize,
  type PreviewItem,
  type RawRow,
} from '@/features/students/import'
import { downloadJson } from '@/lib/download'

const STATUS_VARIANT = {
  new: 'default',
  update: 'secondary',
  unchanged: 'outline',
  invalid: 'destructive',
  conflict: 'destructive',
} as const

export function ImportDialog({
  boardId,
  roster,
}: {
  boardId: string
  roster: Student[]
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [fileRows, setFileRows] = useState<RawRow[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const rows = useMemo(() => fileRows ?? parseQuickAdd(text), [fileRows, text])
  const preview = useMemo(() => buildPreview(rows, roster), [rows, roster])
  const summary = summarize(preview)
  const importable = summary.new + summary.update

  function reset() {
    setText('')
    setFileRows(null)
    setFileError(null)
    setProgress(0)
  }

  async function loadFile(file: File) {
    const result = parseStudentsJson(await file.text())
    if (result.error) {
      setFileError(t(`import.${result.error}`))
      setFileRows(null)
    } else {
      setFileError(null)
      setFileRows(result.rows)
    }
  }

  async function confirm() {
    setImporting(true)
    try {
      const count = await importStudents(boardId, preview, setProgress)
      toast.success(t('import.done', { count }))
      setOpen(false)
      reset()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload />
        {t('import.button')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('import.title')}</DialogTitle>
          <DialogDescription>{t('import.hint')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quick-add">{t('import.quickAdd')}</Label>
          <Textarea
            id="quick-add"
            rows={5}
            value={text}
            disabled={fileRows !== null}
            placeholder={
              'Laura Nataly; laura@gmail.com; lnataly@universidad.edu.co\nSebastian Cetina; scetina@universidad.edu.co'
            }
            onChange={(event) => setText(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('import.orFile')}</span>
          <input
            type="file"
            accept="application/json,.json"
            aria-label={t('import.file')}
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void loadFile(file)
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              downloadJson('estudiantes-plantilla.json', STUDENTS_TEMPLATE)
            }
          >
            <Download />
            {t('import.template')}
          </Button>
          {fileRows && (
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('import.clearFile')}
            </Button>
          )}
        </div>
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}

        {preview.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm" data-testid="import-summary">
              {t('import.summary', summary)}
            </p>
            <ul className="max-h-60 divide-y overflow-auto rounded-md border text-sm">
              {preview.map((item) => (
                <PreviewRow key={item.line} item={item} />
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => void confirm()}
            disabled={importable === 0 || importing}
          >
            {importing
              ? t('import.importing', { done: progress, total: importable })
              : t('import.confirm', { count: importable })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewRow({ item }: { item: PreviewItem }) {
  const { t } = useTranslation()
  const name = 'input' in item ? item.input.name : item.name
  const detail =
    item.status === 'invalid'
      ? t(`import.reason.${item.reason}`)
      : item.status === 'conflict'
        ? t(`import.reason.${item.reason}`)
        : item.input.emails.join(', ')

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Badge variant={STATUS_VARIANT[item.status]}>
        {t(`import.status.${item.status}`)}
      </Badge>
      <span className="font-medium">{name || '—'}</span>
      <span className="truncate text-muted-foreground">{detail}</span>
    </li>
  )
}
