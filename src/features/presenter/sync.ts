// "Vista del docente" (M13): the projected window and the teacher's console window show the same
// slide. Both are tabs of the same browser, so a BroadcastChannel is enough (no server, free).

export type PresenterMessage =
  | { type: 'goto'; studentId: string; slide: number }
  /** A window just opened and asks where the presentation is */
  | { type: 'hello' }

export const presenterChannelName = (boardId: string) =>
  `pbl-presenter-${boardId}`

const ID = /^[A-Za-z0-9_-]{1,128}$/

/** Only well-formed messages are applied (pure, unit-tested). */
export function parsePresenterMessage(data: unknown): PresenterMessage | null {
  if (!data || typeof data !== 'object') return null
  const message = data as Record<string, unknown>
  if (message.type === 'hello') return { type: 'hello' }
  if (
    message.type === 'goto' &&
    typeof message.studentId === 'string' &&
    ID.test(message.studentId) &&
    Number.isInteger(message.slide) &&
    (message.slide as number) >= 0
  )
    return {
      type: 'goto',
      studentId: message.studentId,
      slide: message.slide as number,
    }
  return null
}

/** Typing in a text box never moves slides (presenter shortcuts). */
export function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return !!element?.closest?.(
    'input, textarea, select, [contenteditable="true"], [role="menu"]',
  )
}

/** "12:05" for the console's timer. */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
