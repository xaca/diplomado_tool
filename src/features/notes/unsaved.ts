// M27 (D130): a comment being written is never lost when the teacher moves to another slide,
// student or page. Pure logic (unit-tested) + the drafts kept on this device.

/** Unsaved = text that isn't blank and differs from what's saved ('' for a new comment) */
export function isDirty(text: string, saved: string) {
  const typed = text.trim()
  return typed !== '' && typed !== saved.trim()
}

export type GuardChoice = 'save' | 'discard' | 'stay'

/** What happens to the move once the teacher answered "Tienes un comentario sin guardar" */
export function afterChoice(
  choice: GuardChoice,
  saved = false,
): 'move' | 'stay' {
  if (choice === 'discard') return 'move'
  if (choice === 'save' && saved) return 'move'
  return 'stay'
}

/** Where a comment box writes its draft: one per slide (or the project) and per comment */
export const draftKey = (
  boardId: string,
  studentId: string,
  target: string,
  noteId?: string,
) => `pbl.commentDraft.${boardId}.${studentId}.${target}.${noteId ?? 'new'}`

// Session storage: the draft survives moving around and reloading this tab, not closing it.
// Private windows or blocked storage: the guard still asks; there's just no recovery.

export function readDraft(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeDraft(key: string, text: string, saved: string) {
  try {
    if (isDirty(text, saved)) sessionStorage.setItem(key, text)
    else sessionStorage.removeItem(key)
  } catch {
    // no storage: nothing to recover later, nothing else
  }
}

export function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // see writeDraft
  }
}
