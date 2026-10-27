// Presenter navigation (PLAN.md → F5): ←/→ slides, ↑/↓ students. Pure, unit-tested.
// `slide: LAST` means "the last slide of that student" (their slides may not be loaded yet).

export const LAST = Number.POSITIVE_INFINITY

export type Position = { student: number; slide: number }

export type Move =
  | 'nextSlide'
  | 'prevSlide'
  | 'firstSlide'
  | 'lastSlide'
  | 'nextStudent'
  | 'prevStudent'

type Counts = {
  /** Students that can be presented (1 for a student presenting their own space) */
  students: number
  /** Slides of the current student */
  slides: number
}

/** The slide actually shown: LAST and out-of-range indexes are clamped. */
export function clampSlide(slide: number, slides: number) {
  return Math.max(0, Math.min(slide, slides - 1))
}

export function move(
  position: Position,
  action: Move,
  { students, slides }: Counts,
): Position {
  const slide = clampSlide(position.slide, slides)
  const { student } = position
  switch (action) {
    case 'nextSlide':
      if (slide < slides - 1) return { student, slide: slide + 1 }
      // past the last slide: the next student's first slide
      return student < students - 1
        ? { student: student + 1, slide: 0 }
        : { student, slide }
    case 'prevSlide':
      if (slide > 0) return { student, slide: slide - 1 }
      return student > 0
        ? { student: student - 1, slide: LAST }
        : { student, slide }
    case 'firstSlide':
      return { student, slide: 0 }
    case 'lastSlide':
      return { student, slide: LAST }
    case 'nextStudent':
      return student < students - 1
        ? { student: student + 1, slide: 0 }
        : { student, slide }
    case 'prevStudent':
      return student > 0
        ? { student: student - 1, slide: 0 }
        : { student, slide }
  }
}

/** Keyboard (and presentation clicker: PageUp/PageDown) → move. */
export function keyToMove(key: string): Move | null {
  switch (key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      return 'nextSlide'
    case 'ArrowLeft':
    case 'PageUp':
      return 'prevSlide'
    case 'ArrowDown':
      return 'nextStudent'
    case 'ArrowUp':
      return 'prevStudent'
    case 'Home':
      return 'firstSlide'
    case 'End':
      return 'lastSlide'
    default:
      return null
  }
}
