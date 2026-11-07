import { describe, expect, it } from 'vitest'
import { afterChoice, draftKey, isDirty } from '@/features/notes/unsaved'

describe('isDirty (M27, D130)', () => {
  it('a new comment with text is unsaved; blank is not', () => {
    expect(isDirty('Falta el prototipo', '')).toBe(true)
    expect(isDirty('   \n', '')).toBe(false)
  })

  it('an edit is unsaved only when it differs from the saved text', () => {
    expect(isDirty('Hola', 'Hola')).toBe(false)
    expect(isDirty('Hola ', 'Hola')).toBe(false)
    expect(isDirty('Hola!', 'Hola')).toBe(true)
  })
})

describe('afterChoice', () => {
  it('"Guardar y continuar" moves only once the save is confirmed', () => {
    expect(afterChoice('save', true)).toBe('move')
    expect(afterChoice('save', false)).toBe('stay')
  })

  it('"Descartar" moves, "Seguir escribiendo" stays', () => {
    expect(afterChoice('discard')).toBe('move')
    expect(afterChoice('stay')).toBe('stay')
  })
})

describe('draftKey', () => {
  it('one draft per slide (or project) and per comment', () => {
    expect(draftKey('b1', 'st1', 's1')).toBe('pbl.commentDraft.b1.st1.s1.new')
    expect(draftKey('b1', 'st1', '_project', 'n1')).toBe(
      'pbl.commentDraft.b1.st1._project.n1',
    )
  })
})
