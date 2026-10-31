import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Expand, Pause, Play, Plus, Square, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  addClassMinute,
  pauseClassClock,
  resumeClassClock,
  startClassClock,
  stopClassClock,
} from '@/features/clock/api'
import { formatClock } from '@/features/clock/clock'
import { useClockNow } from '@/features/clock/hooks'
import { cn } from '@/lib/utils'
import { CLOCK_PRESETS_MIN, type ClassClock } from '@/model'

/** Teacher: "Reloj" → start an activity or a break; pause / +1 min / stop while it runs (M16). */
export function ClockControls({
  boardId,
  clock,
  open,
  onOpenChange,
}: {
  boardId: string
  clock: ClassClock | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const now = useClockNow(clock)
  const [mode, setMode] = useState<ClassClock['mode']>('activity')
  const [label, setLabel] = useState('')
  const [instructions, setInstructions] = useState('')
  const [minutes, setMinutes] = useState(10)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true)
    try {
      await action()
      if (done) toast.success(done)
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('clock.title')}</DialogTitle>
          <DialogDescription>{t('clock.remaining')}</DialogDescription>
        </DialogHeader>

        {clock && now ? (
          <div
            className="flex flex-col items-center gap-4"
            data-testid="clock-running"
          >
            <p className="text-sm text-muted-foreground">
              {clock.label ||
                (clock.mode === 'break'
                  ? t('clock.breakLabel')
                  : t('clock.activity'))}
            </p>
            <p className="font-mono text-5xl font-semibold tabular-nums">
              {now.status === 'ended'
                ? t('clock.time')
                : formatClock(now.remaining)}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {clock.paused ? (
                <Button
                  disabled={busy}
                  onClick={() => void run(() => resumeClassClock(boardId))}
                >
                  <Play />
                  {t('clock.resume')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy || now.status === 'ended'}
                  onClick={() =>
                    void run(() => pauseClassClock(boardId, clock))
                  }
                >
                  <Pause />
                  {t('clock.pause')}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => addClassMinute(boardId, clock))}
              >
                <Plus />
                {t('clock.addMinute')}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => void run(() => stopClassClock(boardId))}
              >
                <Square />
                {t('clock.stop')}
              </Button>
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link to={`/b/${boardId}/focus`} />}
              >
                <Expand />
                {t('clock.focus')}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                () =>
                  startClassClock(boardId, {
                    mode,
                    label,
                    instructions,
                    minutes,
                  }),
                t('clock.started'),
              ).then(() => onOpenChange(false))
            }}
          >
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label={t('clock.title')}
            >
              {(['activity', 'break'] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  variant={mode === value ? 'default' : 'outline'}
                  onClick={() => {
                    setMode(value)
                    setMinutes(value === 'break' ? 10 : 10)
                  }}
                >
                  {t(`clock.${value}`)}
                </Button>
              ))}
            </div>
            {mode === 'activity' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clock-label">{t('clock.label')}</Label>
                  <Input
                    id="clock-label"
                    value={label}
                    maxLength={80}
                    placeholder={t('clock.labelPlaceholder')}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="clock-instructions">
                    {t('clock.instructions')}
                  </Label>
                  <Textarea
                    id="clock-instructions"
                    rows={2}
                    value={instructions}
                    maxLength={300}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </div>
              </>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {t('clock.minutes')}
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                {CLOCK_PRESETS_MIN[mode].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={minutes === value ? 'default' : 'outline'}
                    aria-pressed={minutes === value}
                    className={cn('min-w-12')}
                    onClick={() => setMinutes(value)}
                  >
                    {value}
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={180}
                  aria-label={t('clock.custom')}
                  className="h-8 w-20"
                  value={minutes}
                  onChange={(event) =>
                    setMinutes(
                      Math.max(
                        1,
                        Math.min(180, Number(event.target.value) || 1),
                      ),
                    )
                  }
                />
              </div>
            </fieldset>
            <Button type="submit" disabled={busy}>
              <Timer />
              {t('clock.start')}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
