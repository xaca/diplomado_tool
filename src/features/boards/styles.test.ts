import { describe, expect, it } from 'vitest'
import { contrastRatio, resolveLook, TEXT_ON } from '@/features/boards/look'
import {
  activeStyleId,
  BOARD_STYLE_LIST,
  boardTheme,
  findBoardStyle,
} from '@/features/boards/styles'
import { BANNER_CSS } from '@/features/profile/decor'
// The rules file as text (Vite raw import), to check the style list matches
import rules from '../../../firestore.rules?raw'
import {
  BOARD_STYLES,
  CARD_BANNERS,
  DEFAULT_LOOK,
  boardLookSchema,
  statusSchema,
} from '@/model'

describe('board styles (M21)', () => {
  it('one entry per style id, the same list as the rules', () => {
    expect(BOARD_STYLE_LIST.map((style) => style.id)).toEqual([...BOARD_STYLES])
    for (const id of BOARD_STYLES) expect(rules).toContain(`'${id}'`)
    expect(
      BOARD_STYLE_LIST.filter((style) => style.kind === 'seasonal').map(
        (s) => s.id,
      ),
    ).toEqual([
      'navidad',
      'amigo-secreto',
      'halloween',
      'verano',
      'flores',
      'graduacion',
    ])
  })

  it('every style keeps its text readable on every color (WCAG AA, 4.5:1)', () => {
    for (const style of BOARD_STYLE_LIST)
      for (const stop of style.stops)
        expect(
          contrastRatio(stop, TEXT_ON[style.text]),
          `${style.id} ${stop}`,
        ).toBeGreaterThanOrEqual(4.5)
  })

  it('nothing seasonal by default: a board keeps its look until the teacher picks a style', () => {
    expect(DEFAULT_LOOK.style).toBeNull()
    expect(resolveLook({}).style).toBeNull()
    expect(boardTheme(resolveLook({}), '2026-12-24').style).toBeNull()
  })

  it('optional dates: the dated style inside them, the chosen one outside', () => {
    const look = {
      style: 'minimal',
      schedule: { style: 'navidad', from: '2026-12-01', to: '2027-01-06' },
    } as const
    expect(activeStyleId(look, '2026-11-30')).toBe('minimal')
    expect(activeStyleId(look, '2026-12-01')).toBe('navidad')
    expect(activeStyleId(look, '2027-01-06')).toBe('navidad')
    expect(activeStyleId(look, '2027-01-07')).toBe('minimal')
    expect(
      activeStyleId({ style: null, schedule: null }, '2026-12-24'),
    ).toBeNull()
  })

  it('a style gives the page its colors, pattern and card accent', () => {
    const theme = boardTheme(
      { ...DEFAULT_LOOK, style: 'navidad' },
      '2026-12-24',
    )
    expect(theme.style?.accessory).toBe('santa')
    expect(theme.tone).toBe('light')
    expect(theme.css.backgroundImage).toContain('data:image/svg+xml')
    expect(theme.css.backgroundImage).toContain('linear-gradient')
    expect((theme.css as Record<string, string>)['--card-accent']).toBe(
      '#fbbf24',
    )
    // without a style: the background preset, as before
    expect(
      boardTheme({ ...DEFAULT_LOOK, background: 'night' }, '2026-12-24').tone,
    ).toBe('light')
    expect(findBoardStyle('graduacion')?.ambient).toBe('confetti')
  })

  it('looks saved before M21 still parse; dates must be in order', () => {
    const old = {
      background: 'yellow',
      pattern: 'dots',
      layout: 'grid',
      sortBy: 'name',
      stickyHeader: true,
    }
    expect(boardLookSchema.parse(old)).toEqual({ ...DEFAULT_LOOK, ...old })
    expect(
      boardLookSchema.safeParse({
        ...DEFAULT_LOOK,
        schedule: { style: 'navidad', from: '2027-01-06', to: '2026-12-01' },
      }).success,
    ).toBe(false)
  })
})

describe('profile message and decorations (M21)', () => {
  it('a short message, no links', () => {
    expect(
      statusSchema.parse({ emoji: '🎃', text: ' ¡Feliz Halloween! ' }),
    ).toEqual({
      emoji: '🎃',
      text: '¡Feliz Halloween!',
    })
    for (const text of [
      '',
      'x'.repeat(61),
      'mira https://x.co',
      'www.spam.com',
    ])
      expect(statusSchema.safeParse({ emoji: '', text }).success).toBe(false)
  })

  it('every banner has its CSS', () => {
    expect(Object.keys(BANNER_CSS).sort()).toEqual([...CARD_BANNERS].sort())
  })
})
