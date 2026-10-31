import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ringText, stageLabel } from '@/features/stages/stages'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'
import type { StageDef } from '@/model'

type Props = {
  name: string
  photoURL: string | null | undefined
  stage?: StageDef | null
  /** Pixels. From LARGE_FROM up the stage is written along the ring, like #OPENTOWORK. */
  size: number
  className?: string
}

const LARGE_FROM = 72

/**
 * A person's photo with their stage (M11) as a colored ring. Small avatars show only the ring
 * (the name is in the tooltip); large ones write it on a band along the lower arc. "Vitrineando"
 * (browsing) uses a dashed ring so it never reads as "behind". No stage = a plain avatar.
 */
export function StageAvatar({ name, photoURL, stage, size, className }: Props) {
  const { t } = useTranslation()
  const pathId = useId()
  const label = stage ? stageLabel(stage, t) : null
  const large = size >= LARGE_FROM
  // Ring width as a share of the size: thick band on large avatars, thin ring on small ones
  const inset = !stage ? 0 : large ? size * 0.13 : Math.max(2.5, size * 0.09)
  const browsing = stage?.kind === 'browsing'
  // Space between the outer edge and the photo (1 px of air inside a thin ring)
  const gap = inset ? inset + (large ? 0 : 1) : 0

  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
      title={label ? t('stages.tooltip', { stage: label }) : undefined}
      aria-label={
        label ? `${name} · ${t('stages.tooltip', { stage: label })}` : undefined
      }
      role={label ? 'img' : undefined}
      data-testid="stage-avatar"
      data-stage={stage?.id ?? ''}
    >
      <Avatar
        className="absolute"
        style={{
          top: gap,
          left: gap,
          width: size - 2 * gap,
          height: size - 2 * gap,
        }}
        aria-hidden={label ? true : undefined}
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
      {stage && label && (
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          {large ? (
            <LargeRing
              id={pathId}
              color={stage.color}
              text={ringText(label)}
              browsing={browsing}
            />
          ) : (
            <circle
              cx="50"
              cy="50"
              r={50 - ((inset / size) * 100) / 2}
              fill="none"
              stroke={stage.color}
              strokeWidth={(inset / size) * 100}
              strokeDasharray={browsing ? '9 6' : undefined}
            />
          )}
        </svg>
      )}
    </span>
  )
}

/** Thin full ring + a thick band on the lower arc carrying the text (reads left to right). */
function LargeRing({
  id,
  color,
  text,
  browsing,
}: {
  id: string
  color: string
  text: string
  browsing: boolean
}) {
  const band = 13
  const r = 50 - band / 2
  // Lower arc from 165° to 15° (screen angles, y down): passes through the bottom, left → right
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
        strokeDasharray={browsing ? '6 4' : undefined}
      />
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth={band}
        strokeLinecap="round"
        strokeDasharray={browsing ? '14 3' : undefined}
      />
      <path id={id} d={textArc} fill="none" />
      <text
        fill="#fff"
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
