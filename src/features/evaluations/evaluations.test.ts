import { describe, expect, it } from 'vitest'
import {
  editFormUrl,
  embedFormUrl,
  parseFormsUrl,
  viewFormUrl,
} from '@/features/evaluations/evaluations'
import { sandboxFor, toEmbedUrl } from '@/features/slides/embeds'

const EDIT_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd'
const PUBLISHED = '1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh'

describe('Google Forms links (M25, D123)', () => {
  it.each([
    `https://docs.google.com/forms/d/${EDIT_ID}/edit`,
    `https://docs.google.com/forms/d/${EDIT_ID}/edit#responses`,
    `https://docs.google.com/forms/d/${EDIT_ID}/viewform`,
  ])("reads the editor's id from %s", (link) => {
    expect(parseFormsUrl(link)).toEqual({ formId: EDIT_ID, published: false })
  })

  it.each([
    `https://docs.google.com/forms/d/e/${PUBLISHED}/viewform`,
    `https://docs.google.com/forms/d/e/${PUBLISHED}/viewform?usp=sf_link`,
    `https://docs.google.com/forms/d/e/${PUBLISHED}/viewform?embedded=true`,
  ])('reads the published id from %s', (link) => {
    expect(parseFormsUrl(link)).toEqual({ formId: PUBLISHED, published: true })
  })

  it.each([
    'https://forms.gle/abc123',
    'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
    'https://docs.google.com/forms/d/short/edit',
    'nada',
  ])('refuses %s (a forms.gle link is expanded before parsing)', (link) => {
    expect(parseFormsUrl(link)).toBeNull()
  })

  it('builds the embedded, open and editor addresses', () => {
    expect(embedFormUrl(EDIT_ID, false)).toBe(
      `https://docs.google.com/forms/d/${EDIT_ID}/viewform?embedded=true`,
    )
    expect(embedFormUrl(PUBLISHED, true)).toBe(
      `https://docs.google.com/forms/d/e/${PUBLISHED}/viewform?embedded=true`,
    )
    expect(viewFormUrl(PUBLISHED, true)).toBe(
      `https://docs.google.com/forms/d/e/${PUBLISHED}/viewform`,
    )
    expect(editFormUrl(EDIT_ID)).toBe(
      `https://docs.google.com/forms/d/${EDIT_ID}/edit`,
    )
  })

  it('the embedded form keeps working in the viewer: same address, forms allowed', () => {
    const link = embedFormUrl(PUBLISHED, true)
    expect(toEmbedUrl(link)).toBe(link)
    expect(sandboxFor(link)).toContain('allow-forms')
  })
})
