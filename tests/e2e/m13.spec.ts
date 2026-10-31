import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { seedSlides, textElement } from './slides-fixtures.ts'

// M13: the teacher's notes while presenting, and the "Vista del docente" window in sync.

const presentUrl = (studentId: string) =>
  `/b/${DEMO.boardId}/present/${studentId}`

test.beforeEach(async () => {
  await seedDemo()
  await seedSlides('st_sebastian', [
    [textElement('Sebastian uno')],
    [textElement('Sebastian dos')],
  ])
})

test.describe('M13 · notes while presenting', () => {
  test('the teacher writes a note on the slide on screen; the student reads it', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(presentUrl('st_sebastian'))
    const presenter = page.getByTestId('presenter')
    await expect(presenter.getByTestId('presenter-counter')).toHaveText('1 / 2')
    // Closed by default (projector safety)
    await expect(page.getByTestId('presenter-notes')).toHaveCount(0)

    await page.keyboard.press('n')
    const panel = page.getByTestId('presenter-notes')
    await expect(panel).toContainText('Visible en pantalla')
    await panel.getByRole('button', { name: 'Agregar anotación' }).click()
    const box = panel.getByLabel('Anotación', { exact: true })
    // Typing never moves slides
    await box.type('Buen problema ')
    await box.press('ArrowRight')
    await box.press('Space')
    await expect(presenter.getByTestId('presenter-counter')).toHaveText('1 / 2')
    await box.press('Enter')
    await expect(panel.getByTestId('note')).toContainText('Buen problema')
    // saved: the text box closes (Esc inside a text box only cancels it)
    await expect(box).toHaveCount(0)

    // Esc closes the panel; the badge shows the count
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page.getByTestId('notes-badge')).toHaveText('1 nota')
    await page.keyboard.press('ArrowRight')
    await expect(presenter.getByTestId('presenter-counter')).toHaveText('2 / 2')
    await expect(page.getByTestId('notes-badge')).toHaveCount(0)

    // The student reads it on their space page
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`/b/${DEMO.boardId}/s/st_sebastian`)
    await expect(page.getByTestId('note')).toContainText('Buen problema')
  })

  test('a student presenting their own space sees no notes panel', async ({
    page,
  }) => {
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(presentUrl('st_sebastian'))
    await expect(page.getByTestId('presenter-counter')).toHaveText('1 / 2')
    await page.keyboard.press('n')
    await expect(page.getByTestId('presenter-notes')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Notas' })).toHaveCount(0)
  })

  test('"Vista del docente" opens a second window that follows the projected one', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(presentUrl('st_sebastian'))
    await expect(page.getByTestId('presenter-counter')).toHaveText('1 / 2')
    const [console] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Vista del docente' }).click(),
    ])
    await expect(console.getByTestId('presenter-notes')).toBeVisible()
    await expect(console.getByTestId('console-timer')).toBeVisible()
    await expect(console.getByTestId('presenter-notes')).not.toContainText(
      'Visible en pantalla',
    )

    // Projected → console
    await page.keyboard.press('ArrowRight')
    await expect(console.getByTestId('presenter-counter')).toHaveText('2 / 2')
    // Console → projected
    await console.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('presenter-counter')).toHaveText('1 / 2')
  })
})
