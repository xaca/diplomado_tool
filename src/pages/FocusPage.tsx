import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BellRing, Coffee, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useBoard } from '@/features/boards/hooks'
import { formatClock } from '@/features/clock/clock'
import { BreakAnimation } from '@/features/clock/components/BreakAnimation'
import { ClockControls } from '@/features/clock/components/ClockControls'
import { useClockNow, useCloseEndedClock } from '@/features/clock/hooks'
import { normalizeEmail } from '@/lib/collections'
import { gsap, motionAllowed } from '@/lib/gsap'
import { cn } from '@/lib/utils'
import { isTeacherRole, useAuth } from '@/providers/auth-context'

/** A short chime on the teacher's device when time is up (opt-in). */
function chime() {
  const audio = new AudioContext()
  for (const [index, frequency] of [880, 660, 990].entries()) {
    const tone = audio.createOscillator()
    const volume = audio.createGain()
    tone.frequency.value = frequency
    volume.gain.setValueAtTime(0.2, audio.currentTime + index * 0.25)
    volume.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + index * 0.25 + 0.6,
    )
    tone.connect(volume).connect(audio.destination)
    tone.start(audio.currentTime + index * 0.25)
    tone.stop(audio.currentTime + index * 0.25 + 0.6)
  }
}

/**
 * Focus view for the projector (M16, F19 / F22): the class clock full screen, with a progress ring,
 * the activity and its instructions; during a break, random Lottie animations (a calm one and a
 * funny one). When the clock closes (or the teacher ends it) it goes back to the board.
 */
export function FocusPage() {
  const { t } = useTranslation()
  const { boardId } = useParams()
  const { role, user } = useAuth()
  const board = useBoard(boardId)
  const clock = board.data?.clock ?? null
  const now = useClockNow(clock)
  const [controls, setControls] = useState(false)
  const [sound, setSound] = useState(false)
  const time = useRef<HTMLParagraphElement>(null)
  const navigate = useNavigate()
  const isBoardTeacher =
    isTeacherRole(role) &&
    !!board.data?.teacherEmails.includes(normalizeEmail(user?.email ?? ''))

  // Time's up and shown long enough: close it (the teacher's device clears it) and leave
  const closed = !!now?.closed
  useCloseEndedClock(boardId, closed, isBoardTeacher)
  const hadClock = useRef(false)
  const live = !!clock && !closed
  useEffect(() => {
    if (live) hadClock.current = true
    else if (hadClock.current && boardId)
      void navigate(`/b/${boardId}`, { replace: true })
  }, [live, boardId, navigate])

  // "¡Tiempo!": a pulse (and the chime, if on)
  const ended = now?.status === 'ended'
  useEffect(() => {
    if (!ended) return
    if (sound) chime()
    if (motionAllowed() && time.current)
      gsap.fromTo(
        time.current,
        { scale: 1.15 },
        { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)' },
      )
  }, [ended, sound])

  if (board.loading) return null
  if (!boardId || !board.data) return <Navigate to="/" replace />

  const isBreak = clock?.mode === 'break'
  const radius = 45
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 text-center',
        isBreak ? 'bg-sky-950 text-white' : 'bg-neutral-950 text-white',
      )}
      data-testid="focus-view"
      data-mode={clock?.mode ?? 'none'}
    >
      <Link
        to={`/b/${boardId}`}
        className="absolute top-4 left-4 flex items-center gap-1 text-sm text-white/70 hover:text-white"
      >
        <ArrowLeft className="size-4" />
        {t('clock.back')}
      </Link>

      {!clock || !now ? (
        <p className="text-white/70">{t('clock.none')}</p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-xl text-white/80 sm:text-3xl">
            {isBreak ? (
              <Coffee className="size-7" />
            ) : (
              <Timer className="size-7" />
            )}
            {clock.label ||
              (isBreak ? t('clock.breakLabel') : t('clock.activity'))}
            {clock.paused && ` · ${t('clock.paused')}`}
          </p>
          {isBreak && !ended && (
            <div className="flex items-center justify-center gap-[4vw]">
              <BreakAnimation className="w-[min(40vw,42svh)]" />
              <BreakAnimation kind="fun" className="w-[min(40vw,42svh)]" />
            </div>
          )}
          <div className="relative flex items-center justify-center">
            {!isBreak && (
              <svg
                viewBox="0 0 100 100"
                className="size-[min(70vw,55svh)] -rotate-90"
                aria-hidden
              >
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="rgb(255 255 255 / 0.12)"
                  strokeWidth="4"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={
                    now.status === 'ending'
                      ? '#fbbf24'
                      : ended
                        ? '#f43f5e'
                        : '#ffffff'
                  }
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * now.progress}
                  className="transition-[stroke-dashoffset] duration-300"
                />
              </svg>
            )}
            <p
              ref={time}
              className={cn(
                'font-mono font-semibold tabular-nums',
                isBreak
                  ? 'text-6xl sm:text-8xl'
                  : 'absolute text-[min(16vw,14svh)]',
                now.status === 'ending' && 'text-amber-300',
                ended && 'text-rose-400',
              )}
              role="timer"
              data-testid="focus-time"
            >
              {ended
                ? isBreak
                  ? t('clock.breakOver')
                  : t('clock.time')
                : formatClock(now.remaining)}
            </p>
          </div>
          {clock.instructions && !isBreak && (
            <p className="max-w-3xl text-lg whitespace-pre-line text-white/80 sm:text-2xl">
              {clock.instructions}
            </p>
          )}
        </>
      )}

      {isBoardTeacher && (
        <div className="absolute right-4 bottom-4 flex items-center gap-3">
          <Label
            htmlFor="focus-sound"
            className="flex items-center gap-1.5 text-sm text-white/70"
          >
            <BellRing className="size-4" />
            {t('clock.chime')}
          </Label>
          <Switch id="focus-sound" checked={sound} onCheckedChange={setSound} />
          <Button variant="secondary" onClick={() => setControls(true)}>
            <Timer />
            {t('clock.button')}
          </Button>
        </div>
      )}
      {isBoardTeacher && (
        <ClockControls
          boardId={boardId}
          clock={clock}
          open={controls}
          onOpenChange={setControls}
        />
      )}
    </div>
  )
}
