import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// M21: profile message, card decorations and board styles.

const boardUrl = `/b/${DEMO.boardId}`
const board = () => emulatorDb.doc(`boards/${DEMO.boardId}`)
const card = (studentId: string) =>
  emulatorDb.doc(`boards/${DEMO.boardId}/spaces/${studentId}`)
const pad = (value: number) => String(value).padStart(2, '0')
const day = (offset: number) => {
  const date = new Date(Date.now() + offset * 86_400_000)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M21 · profile message and decorations', () => {
  test('a student sets a message and a banner; classmates see them on the card; the teacher can clear the message', async ({
    page,
  }) => {
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(boardUrl)
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Mi estado' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Never quit/ }).click()
    await expect(dialog.getByLabel('Mensaje')).toHaveValue('Never quit')
    await dialog.getByRole('button', { name: 'Guardar mensaje' }).click()
    await expect(page.getByText('Mensaje guardado')).toBeVisible()

    const mine = page
      .getByTestId('space-card')
      .filter({ hasText: 'Sebastian Cetina' })
    await expect(mine.getByTestId('status-line')).toHaveText('💪Never quit')

    await page.goto('/me')
    await page
      .getByTestId('decor-picker')
      .getByRole('button', { name: 'Uva' })
      .click()
    await expect(page.getByText('Decoración guardada')).toBeVisible()
    await page
      .getByTestId('decor-picker')
      .getByRole('button', { name: '🚀' })
      .click()
    await expect
      .poll(async () => (await card('st_sebastian').get()).data()?.ownerDecor)
      .toEqual({ banner: 'grape', sticker: '🚀' })

    // A classmate sees it
    await signIn(page, 'elma@gmail.com')
    await page.goto(boardUrl)
    const seb = page
      .getByTestId('space-card')
      .filter({ hasText: 'Sebastian Cetina' })
    await expect(seb.getByTestId('status-line')).toContainText('Never quit')
    await expect(seb.getByTestId('decor-banner')).toHaveAttribute(
      'data-banner',
      'grape',
    )
    await expect(seb.getByTestId('decor-sticker')).toHaveText('🚀')

    // The teacher removes the message on this board
    await signIn(page, DEMO.teacher)
    await page.goto(`${boardUrl}/s/st_sebastian`)
    await page.getByRole('button', { name: 'Quitar mensaje' }).click()
    await expect(
      page.getByText('Mensaje quitado de esta tarjeta'),
    ).toBeVisible()
    await expect
      .poll(async () => (await card('st_sebastian').get()).data()?.ownerStatus)
      .toBeNull()
  })
})

test.describe('M21 · board styles', () => {
  test('no style by default; the teacher picks Navidad (garland, line, hats), turns the hats off, and the animation respects reduced motion', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(boardUrl)
    await expect(page.getByTestId('board-page')).not.toHaveAttribute(
      'data-board-style',
    )
    await expect(page.locator('[data-accessory]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Personalizar' }).click()
    const panel = page.getByTestId('customize-panel')
    await panel.getByRole('radio', { name: /Navidad/ }).click()
    await panel.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Tablero actualizado')).toBeVisible()

    const boardPage = page.getByTestId('board-page')
    await expect(boardPage).toHaveAttribute('data-board-style', 'navidad')
    await expect(page.getByTestId('garland')).toHaveAttribute(
      'data-garland',
      'lights',
    )
    await expect(page.getByTestId('board-tagline')).toHaveText(
      '¡Feliz Navidad!',
    )
    await expect(page.getByTestId('ambient')).toHaveAttribute(
      'data-ambient',
      'snow',
    )
    // Santa hats on the students' photos
    await expect(
      page.getByTestId('space-card').first().locator('[data-accessory]'),
    ).toHaveAttribute('data-accessory', 'santa')
    expect((await board().get()).data()?.style).toBe('navidad')

    // The teacher turns the accessories off and writes their own line
    await page.getByRole('button', { name: 'Personalizar' }).click()
    await panel.getByRole('switch', { name: /Accesorios en las fotos/ }).click()
    await panel
      .getByLabel('Frase junto al título')
      .fill('¡Último día de clase!')
    await panel.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Tablero actualizado')).toBeVisible()
    await expect(page.locator('[data-accessory]')).toHaveCount(0)
    await expect(page.getByTestId('board-tagline')).toHaveText(
      '¡Último día de clase!',
    )

    // "Reduce motion": no animated background
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    await expect(boardPage).toHaveAttribute('data-board-style', 'navidad')
    await expect(page.getByTestId('ambient')).toHaveCount(0)
  })

  test('Graduación: birretes and the class line; optional dates switch a style on and back', async ({
    page,
  }) => {
    await board().update({ style: 'graduacion' })
    await signIn(page, 'elma@gmail.com')
    await page.goto(boardUrl)
    await expect(page.getByTestId('board-tagline')).toHaveText(
      `¡Lo lograron! · Clase de ${new Date().getFullYear()}`,
    )
    await expect(
      page.getByTestId('space-card').first().locator('[data-accessory]'),
    ).toHaveAttribute('data-accessory', 'grad')

    // Inside the dates: Halloween; after them: back to the chosen style
    await board().update({
      schedule: { style: 'halloween', from: day(-1), to: day(1) },
    })
    await expect(page.getByTestId('board-page')).toHaveAttribute(
      'data-board-style',
      'halloween',
    )
    await board().update({
      schedule: { style: 'halloween', from: day(-10), to: day(-3) },
    })
    await expect(page.getByTestId('board-page')).toHaveAttribute(
      'data-board-style',
      'graduacion',
    )
  })
})
