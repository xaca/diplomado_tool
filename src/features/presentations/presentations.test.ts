import { describe, expect, it } from 'vitest'
import {
  embedUrl,
  openUrl,
  parseSlidesUrl,
  presentUrl,
  thumbnailUrl,
} from '@/features/presentations/presentations'
import { toEmbedUrl } from '@/features/slides/embeds'
import { GOOGLE_SLIDES_ID } from '@/model'

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd'
const PUBLISHED = `2PACX-1v${'Q'.repeat(78)}`

describe('Google Slides links (M25, D123)', () => {
  it.each([
    `https://docs.google.com/presentation/d/${ID}/edit#slide=id.p`,
    `https://docs.google.com/presentation/d/${ID}/edit?usp=sharing`,
    `https://docs.google.com/presentation/d/${ID}/view`,
    `https://docs.google.com/presentation/d/${ID}/present`,
    `https://docs.google.com/presentation/d/${ID}`,
    `docs.google.com/presentation/d/${ID}/edit`,
  ])('reads the id from %s', (link) => {
    expect(parseSlidesUrl(link)).toEqual({
      presentationId: ID,
      published: false,
    })
  })

  it('reads a link published to the web, whose id is longer', () => {
    const parsed = parseSlidesUrl(
      `https://docs.google.com/presentation/d/e/${PUBLISHED}/pub?start=false`,
    )
    expect(parsed).toEqual({ presentationId: PUBLISHED, published: true })
    expect(GOOGLE_SLIDES_ID.test(PUBLISHED)).toBe(true)
  })

  it.each([
    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit',
    'https://docs.google.com/presentation/d/short/edit',
    'https://www.canva.com/design/DAF/view',
    'not a link',
    '',
  ])('refuses %s', (link) => {
    expect(parseSlidesUrl(link)).toBeNull()
  })

  it('builds the viewer, present and open addresses', () => {
    expect(embedUrl(ID)).toBe(
      `https://docs.google.com/presentation/d/${ID}/embed?start=false&loop=false&delayms=3000`,
    )
    expect(embedUrl(PUBLISHED, true)).toContain(
      `/presentation/d/e/${PUBLISHED}/embed`,
    )
    expect(presentUrl(ID)).toBe(
      `https://docs.google.com/presentation/d/${ID}/present`,
    )
    expect(presentUrl(PUBLISHED, true)).toContain(
      `/d/e/${PUBLISHED}/pub?start=true`,
    )
    expect(openUrl(ID)).toBe(
      `https://docs.google.com/presentation/d/${ID}/edit`,
    )
    expect(openUrl(PUBLISHED, true)).toBe(
      `https://docs.google.com/presentation/d/e/${PUBLISHED}/pub`,
    )
  })

  it('has a thumbnail only for a presentation that is not published', () => {
    expect(thumbnailUrl(ID)).toBe(
      `https://lh3.googleusercontent.com/d/${ID}=w400`,
    )
    expect(thumbnailUrl(PUBLISHED, true)).toBeNull()
  })

  it('the viewer address is one the embed registry (M14) understands', () => {
    expect(toEmbedUrl(embedUrl(ID))).toContain(`/presentation/d/${ID}/embed`)
    expect(toEmbedUrl(embedUrl(PUBLISHED, true))).toContain(
      `/presentation/d/e/${PUBLISHED}/embed`,
    )
  })
})
