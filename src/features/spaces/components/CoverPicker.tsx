import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ACCEPTED_TYPES } from '@/features/assets/prepare-image'
import { uploadImage, UploadError } from '@/features/assets/upload'
import { recordBoardActivity } from '@/features/boards/api'
import { setSpaceCover, type Space } from '@/features/spaces/api'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'

/** Card cover: upload (with progress) or remove. Applies immediately. */
export function CoverPicker({
  boardId,
  space,
}: {
  boardId: string
  space: Space
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const busy = progress !== null

  async function upload(file: File) {
    setProgress(0)
    try {
      const ref = await uploadImage({
        file,
        boardId,
        studentId: space.id,
        kind: 'cover',
        onProgress: setProgress,
      })
      await setSpaceCover(boardId, space.id, ref, space.cover)
      void recordBoardActivity(boardId)
      toast.success(t('cover.saved'))
    } catch (error) {
      toast.error(
        t(
          `cover.errors.${error instanceof UploadError ? error.reason : 'network'}`,
        ),
      )
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    try {
      await setSpaceCover(boardId, space.id, null, space.cover)
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t('cover.label')}</span>
      {space.cover ? (
        <img
          src={imageUrl(space.cover, IMAGE_SIZES.cardCover)}
          alt=""
          className="aspect-video w-full rounded-lg border object-cover"
          data-testid="cover-preview"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {t('cover.none')}
        </div>
      )}

      {busy && (
        <div
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-24 text-right text-xs text-muted-foreground">
            {t('cover.uploading', { progress })}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          aria-label={t('cover.choose')}
          data-testid="cover-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlus />
          {space.cover ? t('cover.change') : t('cover.choose')}
        </Button>
        {space.cover && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 />
            {t('cover.remove')}
          </Button>
        )}
      </div>
    </div>
  )
}
