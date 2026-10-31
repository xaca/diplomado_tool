import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cropSquare, MAX_ZOOM, renderAvatar } from '@/features/profile/avatar'

const PREVIEW = 240

type Props = {
  bitmap: ImageBitmap
  busy: boolean
  /** Upload progress (0–100) while busy */
  progress: number
  onCancel: () => void
  onConfirm: (photo: Blob) => void
}

/** Square crop of the chosen picture: drag to move, slider to zoom. Shows exactly what's saved. */
export function AvatarCropDialog({
  bitmap,
  busy,
  progress,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 0, y: 0 })
  const crop = cropSquare(bitmap.width, bitmap.height, zoom, center.x, center.y)

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    context?.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.size,
      crop.size,
      0,
      0,
      PREVIEW,
      PREVIEW,
    )
  }, [bitmap, crop.sx, crop.sy, crop.size])

  /** Moves the square with the pointer (in shares of the room left on each side). */
  function move(event: React.PointerEvent) {
    if (!drag.current) return
    const scale = crop.size / PREVIEW
    const roomX = (bitmap.width - crop.size) / 2
    const roomY = (bitmap.height - crop.size) / 2
    const dx = (event.clientX - drag.current.x) * scale
    const dy = (event.clientY - drag.current.y) * scale
    drag.current = { x: event.clientX, y: event.clientY }
    setCenter((c) => ({
      x: roomX > 0 ? Math.max(-1, Math.min(1, c.x - dx / roomX)) : 0,
      y: roomY > 0 ? Math.max(-1, Math.min(1, c.y - dy / roomY)) : 0,
    }))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.cropTitle')}</DialogTitle>
          <DialogDescription>{t('profile.cropHint')}</DialogDescription>
        </DialogHeader>
        <canvas
          ref={canvas}
          width={PREVIEW}
          height={PREVIEW}
          data-testid="avatar-crop"
          className="mx-auto cursor-grab touch-none rounded-full shadow ring-4 ring-muted active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
        <div className="flex items-center gap-3">
          <Label htmlFor="avatar-zoom">{t('profile.zoom')}</Label>
          <input
            id="avatar-zoom"
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1 accent-primary"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void renderAvatar(bitmap, crop).then(onConfirm, onCancel)
            }
          >
            {busy
              ? t('profile.uploading', { percent: progress })
              : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
