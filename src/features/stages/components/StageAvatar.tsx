import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { GraduationCap } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ringText, stageLabel } from '@/features/stages/stages'
import { gsap, useGSAP } from '@/lib/gsap'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'
import type { StageDef } from '@/model'

type Props = {
  name: string
  photoURL: string | null | undefined
  stage?: StageDef | null
  /** A teacher's photo (M12): the "#DOCENTE" ring and a cap badge instead of a stage */
  teacher?: boolean
  /** Pixels. From LARGE_FROM up the label is written along the ring, like #OPENTOWORK. */
  size: number
  className?: string
}

const LARGE_FROM = 72
/** Teacher ring: dark with a gold label (D30) */
const TEACHER_RING = { color: '#171717', text: '#FACC15' }

/**
 * A person's photo with a ring: a student's stage (M11) or the teacher's "#DOCENTE" (M12).
 * Small avatars show only the ring (the name is in the tooltip); large ones write it on a band
 * along the lower arc. "Vitrineando" (browsing) uses a dashed ring so it never reads as "behind".
 * No stage = a plain avatar. A new stage makes the ring draw in (GSAP, not with reduced motion).
 */
export function StageAvatar({
  name,
  photoURL,
  stage,
  teacher = false,
  size,
  className,
}: Props) {
  const { t } = useTranslation()
  const pathId = useId()
  const root = useRef<HTMLSpanElement>(null)
  const ring = teacher
    ? {
        key: 'teacher',
        color: TEACHER_RING.color,
        textColor: TEACHER_RING.text,
        label: t('stages.teacher'),
        tooltip: t('stages.teacher'),
        dashed: false,
      }
    : stage
      ? {
          key: stage.id,
          color: stage.color,
          textColor: '#fff',
          label: stageLabel(stage, t),
          tooltip: t('stages.tooltip', { stage: stageLabel(stage, t) }),
          dashed: stage.kind === 'browsing',
        }
      : null
  const large = size >= LARGE_FROM
  // Ring width as a share of the size: thick band on large avatars, thin ring on small ones
  const inset = !ring ? 0 : large ? size * 0.13 : Math.max(2.5, size * 0.09)
  // Space between the outer edge and the photo (1 px of air inside a thin ring)
  const gap = inset ? inset + (large ? 0 : 1) : 0

  // The ring draws itself when the stage changes (not on first render)
  const firstRing = useRef(ring?.key)
  useGSAP(
    () => {
      if (!ring || firstRing.current === ring.key) return
      firstRing.current = ring.key
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          '[data-ring]',
          { rotate: -140, scale: 0.8, opacity: 0, transformOrigin: '50% 50%' },
          {
            rotate: 0,
            scale: 1,
            opacity: 1,
            duration: 0.7,
            ease: 'back.out(1.5)',
          },
        )
      })
    },
    { scope: root, dependencies: [ring?.key] },
  )

  return (
    <span
      ref={root}
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
      title={ring?.tooltip}
      aria-label={ring ? `${name} · ${ring.tooltip}` : undefined}
      role={ring ? 'img' : undefined}
      data-testid="stage-avatar"
      data-stage={stage?.id ?? ''}
      data-teacher={teacher || undefined}
    >
      <Avatar
        className="absolute"
        style={{
          top: gap,
          left: gap,
          width: size - 2 * gap,
          height: size - 2 * gap,
        }}
        aria-hidden={ring ? true : undefined}
      >
        <AvatarImage
          src={photoURL ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
        />
        <AvatarFallback
          style={{ fontSize: Math.max(10, (size - gap * 2) * 0.36) }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {ring && (
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
          data-ring
        >
          {large ? (
            <LargeRing
              id={pathId}
              color={ring.color}
              textColor={ring.textColor}
              text={ringText(ring.label)}
              dashed={ring.dashed}
            />
          ) : (
            <circle
              cx="50"
              cy="50"
              r={50 - ((inset / size) * 100) / 2}
              fill="none"
              stroke={ring.color}
              strokeWidth={(inset / size) * 100}
              strokeDasharray={ring.dashed ? '9 6' : undefined}
            />
          )}
        </svg>
      )}
      {teacher && size >= 28 && (
        <span
          className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full border-2 border-white shadow-sm"
          style={{
            width: Math.min(28, size * 0.4),
            height: Math.min(28, size * 0.4),
            backgroundColor: TEACHER_RING.text,
            color: TEACHER_RING.color,
          }}
          aria-hidden
          data-testid="teacher-badge"
        >
          <GraduationCap style={{ width: '65%', height: '65%' }} />
        </span>
      )}
    </span>
  )
}

/** Thin full ring + a thick band on the lower arc carrying the text (reads left to right). */
function LargeRing({
  id,
  color,
  textColor,
  text,
  dashed,
}: {
  id: string
  color: string
  textColor: string
  text: string
  dashed: boolean
}) {
  const band = 13
  const r = 50 - band / 2
  // Lower arc from 170° to 10° (screen angles, y down): passes through the bottom, left → right
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return `${50 + r * Math.cos(radians)} ${50 + r * Math.sin(radians)}`
  }
  const arc = `M ${point(170)} A ${r} ${r} 0 0 0 ${point(10)}`
  const textArc = `M ${point(178)} A ${r} ${r} 0 0 0 ${point(2)}`
  // Long custom labels are squeezed to fit the arc
  const fit =
    text.length > 15
      ? { textLength: 118, lengthAdjust: 'spacingAndGlyphs' }
      : {}

  return (
    <>
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth={band * 0.45}
        strokeDasharray={dashed ? '6 4' : undefined}
      />
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={band}
        strokeLinecap="round"
        strokeDasharray={dashed ? '14 3' : undefined}
      />
      <path id={id} d={textArc} fill="none" />
      <text
        fill={textColor}
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.4"
        dominantBaseline="central"
        style={{ fontFamily: 'inherit' }}
      >
        <textPath
          href={`#${id}`}
          startOffset="50%"
          textAnchor="middle"
          {...fit}
        >
          {text}
        </textPath>
      </text>
    </>
  )
}
