import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Columns3,
  ImagePlus,
  LayoutGrid,
  LayoutList,
  LayoutTemplate,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ACCEPTED_TYPES } from '@/features/assets/prepare-image'
import {
  logUploadFailure,
  uploadImage,
  UploadError,
} from '@/features/assets/upload'
import {
  saveBoardLook,
  setBoardLogo,
  updateBoardInfo,
} from '@/features/boards/api'
import { backgroundCss } from '@/features/boards/look'
import { IMAGE_SIZES, imageUrl } from '@/lib/cloudinary'
import type { WithId } from '@/lib/firestore-hooks'
import { gsap, motionAllowed } from '@/lib/gsap'
import { cn } from '@/lib/utils'
import {
  BOARD_ASSET_OWNER,
  BOARD_BACKGROUNDS,
  BOARD_LAYOUTS,
  BOARD_PATTERNS,
  BOARD_SORTS,
  boardInputSchema,
  type BoardDoc,
  type BoardLayout,
  type BoardLook,
} from '@/model'

/** What the panel edits; BoardPage shows it live (preview) until saved or cancelled. */
export type BoardDraft = BoardLook & { title: string; description: string }

type Props = {
  board: WithId<BoardDoc>
  draft: BoardDraft
  onChange: (draft: BoardDraft) => void
  onClose: () => void
}

const LAYOUT_ICONS: Record<BoardLayout, typeof LayoutGrid> = {
  masonry: LayoutTemplate,
  grid: LayoutGrid,
  list: LayoutList,
  stages: Columns3,
  groups: Users,
}

/**
 * Teacher's "Personalizar tablero" (M12, D25): a side panel over the board. Look and name are a
 * draft shown live on the board; "Guardar" writes them. The logo applies at once (like covers).
 */
export function BoardCustomizePanel({
  board,
  draft,
  onChange,
  onClose,
}: Props) {
  const { t } = useTranslation()
  const panel = useRef<HTMLElement>(null)
  const [saving, setSaving] = useState(false)
  const set = (change: Partial<BoardDraft>) => onChange({ ...draft, ...change })
  const validInfo = boardInputSchema.safeParse({
    title: draft.title,
    description: draft.description,
  }).success

  useLayoutEffect(() => {
    if (motionAllowed())
      gsap.from(panel.current, {
        x: 48,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
      })
  }, [])

  async function save() {
    setSaving(true)
    try {
      const { title, description, ...look } = draft
      await saveBoardLook(board.id, look)
      if (
        title.trim() !== board.title ||
        description.trim() !== board.description
      )
        await updateBoardInfo(board.id, board.joinCode, { title, description })
      toast.success(t('look.saved'))
      onClose()
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      ref={panel}
      role="dialog"
      aria-label={t('look.title')}
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background text-foreground shadow-2xl sm:w-[400px]"
      data-testid="customize-panel"
    >
      <header className="flex items-start gap-2 border-b p-4">
        <div className="flex-1">
          <h2 className="font-heading text-lg font-semibold">
            {t('look.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('look.hint')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('look.close')}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t('look.info')}</h3>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-name">{t('look.name')}</Label>
            <Input
              id="board-name"
              value={draft.title}
              maxLength={120}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-description">{t('look.description')}</Label>
            <Textarea
              id="board-description"
              rows={2}
              value={draft.description}
              maxLength={500}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>
        </section>

        <LogoPicker board={board} />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t('look.background')}</h3>
          <div
            className="grid grid-cols-6 gap-2"
            role="radiogroup"
            aria-label={t('look.background')}
          >
            {BOARD_BACKGROUNDS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={draft.background === preset.id}
                aria-label={t(`look.backgrounds.${preset.id}`)}
                title={t(`look.backgrounds.${preset.id}`)}
                onClick={() => set({ background: preset.id })}
                className={cn(
                  'aspect-square rounded-lg border shadow-sm transition-transform hover:scale-105',
                  draft.background === preset.id &&
                    'ring-2 ring-primary ring-offset-2',
                )}
                style={{ background: backgroundCss(preset.stops) }}
              />
            ))}
          </div>
          <Choice
            label={t('look.pattern')}
            value={draft.pattern}
            options={BOARD_PATTERNS.map((id) => ({
              id,
              label: t(`look.patterns.${id}`),
            }))}
            onChange={(pattern) => set({ pattern })}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t('look.layout')}</h3>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label={t('look.layout')}
          >
            {BOARD_LAYOUTS.map((id) => {
              const Icon = LAYOUT_ICONS[id]
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={draft.layout === id}
                  onClick={() => set({ layout: id })}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors hover:bg-muted',
                    draft.layout === id &&
                      'border-primary bg-primary/5 font-semibold',
                  )}
                >
                  <Icon className="size-5" />
                  {t(`look.layouts.${id}`)}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="board-sort">{t('look.sortBy')}</Label>
            <select
              id="board-sort"
              className="h-8 flex-1 rounded-lg border bg-background px-2"
              value={draft.sortBy}
              onChange={(event) =>
                set({ sortBy: event.target.value as BoardDraft['sortBy'] })
              }
            >
              {BOARD_SORTS.map((id) => (
                <option key={id} value={id}>
                  {t(`look.sorts.${id}`)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="flex items-center justify-between gap-4">
          <Label
            htmlFor="board-sticky"
            className="flex flex-col items-start gap-1"
          >
            <span>{t('look.sticky')}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t('look.stickyHint')}
            </span>
          </Label>
          <Switch
            id="board-sticky"
            checked={draft.stickyHeader}
            onCheckedChange={(stickyHeader) => set({ stickyHeader })}
          />
        </section>
      </div>

      <footer className="flex justify-end gap-2 border-t p-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('look.cancel')}
        </Button>
        <Button onClick={() => void save()} disabled={saving || !validInfo}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </footer>
    </aside>
  )
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-sm"
      role="radiogroup"
      aria-label={label}
    >
      <span className="mr-1 text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          role="radio"
          aria-checked={value === option.id}
          variant={value === option.id ? 'default' : 'outline'}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

/** Logo: upload (max 512 px) or remove; applies at once. The old one is marked unused. */
function LogoPicker({ board }: { board: WithId<BoardDoc> }) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const busy = progress !== null

  async function upload(file: File) {
    setProgress(0)
    try {
      const ref = await uploadImage({
        file,
        boardId: board.id,
        studentId: BOARD_ASSET_OWNER,
        kind: 'logo',
        maxDimension: 512,
        onProgress: setProgress,
      })
      await setBoardLogo(board.id, ref, board.logo)
      toast.success(t('look.logoSaved'))
    } catch (error) {
      logUploadFailure(error)
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
      await setBoardLogo(board.id, null, board.logo)
      toast.success(t('look.logoRemoved'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t('look.logo')}</h3>
      <p className="text-xs text-muted-foreground">{t('look.logoHint')}</p>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed bg-muted/40">
          {board.logo && (
            <img
              src={imageUrl(board.logo, IMAGE_SIZES.logo)}
              alt=""
              className="max-h-14 max-w-24 object-contain"
              data-testid="logo-preview"
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            ref={input}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            data-testid="logo-input"
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
            {busy
              ? `${progress} %`
              : board.logo
                ? t('look.logoChange')
                : t('look.logoUpload')}
          </Button>
          {board.logo && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 />
              {t('look.logoRemove')}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
