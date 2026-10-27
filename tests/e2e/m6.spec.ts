import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { seedSlides, textElement } from './slides-fixtures.ts'

// Presentation mode: keyboard, overview, student picker, who may present what.

const presentUrl = (studentId: string) =>
  `/b/${DEMO.boardId}/present/${studentId}`

test.beforeEach(async () => {
  await seedDemo()
  // Sebastian (2 slides) joined first, then Elma (1 slide); Carolina has none
  await seedSlides('st_sebastian', [
    [textElement('Sebastian uno')],
    [textElement('Sebastian dos')],
  ])
  await seedSlides('st_elma', [[textElement('Elma uno')]])
})

function presenter(page: Page) {
  const root = page.getByTestId('presenter')
  return {
    root,
    stage: root.getByTestId('presenter-stage'),
    counter: root.getByTestId('presenter-counter'),
    student: root.getByTestId('presenter-student'),
  }
}

test.describe('M6 · presentation mode', () => {
  test('the teacher presents the whole board with the keyboard', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Presentar tablero' }).click()

    const { root, stage, counter, student } = presenter(page)
    await expect(student).toHaveText('Sebastian Cetina')
    await expect(stage).toContainText('Sebastian uno')
    await expect(counter).toHaveText('1 / 2')
    // Only students with slides are presented (Carolina is skipped)
    await expect(root).toContainText('Estudiante 1 de 2')

    await page.keyboard.press('ArrowRight')
    await expect(stage).toContainText('Sebastian dos')
    await expect(counter).toHaveText('2 / 2')

    // → after the last slide: the next student
    await page.keyboard.press('ArrowRight')
    await expect(student).toHaveText('Elma')
    await expect(stage).toContainText('Elma uno')
    await expect(page).toHaveURL(new RegExp(`/present/st_elma$`))

    // ← from the first slide: back to the previous student's last slide
    await page.keyboard.press('ArrowLeft')
    await expect(student).toHaveText('Sebastian Cetina')
    await expect(counter).toHaveText('2 / 2')

    // ↓ / ↑ jump between students, to their first slide
    await page.keyboard.press('ArrowDown')
    await expect(student).toHaveText('Elma')
    await page.keyboard.press('ArrowUp')
    await expect(counter).toHaveText('1 / 2')
    await expect(stage).toContainText('Sebastian uno')

    // Esc leaves the presentation, back to the board
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(new RegExp(`/b/${DEMO.boardId}$`))
  })

  test('presenting one card, the overview and the student picker', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    await page
      .getByTestId('space-card')
      .filter({ hasText: 'Sebastian' })
      .getByRole('button', { name: 'Presentar' })
      .click()
    const { stage, counter, student } = presenter(page)
    await expect(student).toHaveText('Sebastian Cetina')

    // Overview (O): all slides of the student, pick one
    await page.keyboard.press('o')
    const overview = page.getByTestId('slide-overview')
    await expect(overview.getByTestId('slide-preview')).toHaveCount(2)
    await overview
      .getByRole('button', { name: 'Ir a la diapositiva 2' })
      .click()
    await expect(overview).toHaveCount(0)
    await expect(counter).toHaveText('2 / 2')
    await expect(stage).toContainText('Sebastian dos')

    // Student picker
    await page.getByRole('button', { name: 'Elegir estudiante' }).click()
    await page.getByRole('menuitemradio', { name: /Elma/ }).click()
    await expect(student).toHaveText('Elma')
    await expect(counter).toHaveText('1 / 1')

    // Cards without slides have no "Presentar"
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(
      page
        .getByTestId('space-card')
        .filter({ hasText: 'Carolina' })
        .getByRole('button', { name: 'Presentar' }),
    ).toHaveCount(0)
  })

  test('a student presents only their own space', async ({ page }) => {
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`/b/${DEMO.boardId}/s/st_sebastian`)
    await page.getByRole('button', { name: 'Presentar' }).click()

    const { root, stage, counter } = presenter(page)
    await expect(stage).toContainText('Sebastian uno')
    await page.keyboard.press('ArrowRight')
    await expect(counter).toHaveText('2 / 2')
    // No moving to classmates
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await expect(counter).toHaveText('2 / 2')
    await expect(
      root.getByRole('button', { name: /Estudiante siguiente/ }),
    ).toHaveCount(0)

    // Someone else's presentation opens the read-only viewer instead
    await page.goto(presentUrl('st_elma'))
    await expect(page).toHaveURL(new RegExp(`/b/${DEMO.boardId}/s/st_elma$`))
    await expect(page.getByRole('button', { name: 'Presentar' })).toHaveCount(0)
  })

  test('controls work with buttons and touch swipes', async ({ page }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(presentUrl('st_sebastian'))
    const { counter, stage, student } = presenter(page)
    await expect(counter).toHaveText('1 / 2')

    await page.getByRole('button', { name: /Diapositiva siguiente/ }).click()
    await expect(counter).toHaveText('2 / 2')
    await page.getByRole('button', { name: /Diapositiva anterior/ }).click()
    await expect(counter).toHaveText('1 / 2')
    await page.getByRole('button', { name: /Estudiante siguiente/ }).click()
    await expect(student).toHaveText('Elma')

    // Swipe left on the slide (touch) → next slide; at Elma's end nothing happens
    await page.getByRole('button', { name: /Estudiante anterior/ }).click()
    await expect(student).toHaveText('Sebastian Cetina')
    const box = (await stage.boundingBox())!
    await stage.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      clientX: box.x + box.width * 0.8,
      clientY: box.y + box.height / 2,
    })
    await stage.dispatchEvent('pointerup', {
      pointerType: 'touch',
      clientX: box.x + box.width * 0.2,
      clientY: box.y + box.height / 2,
    })
    await expect(counter).toHaveText('2 / 2')

    await page.getByRole('button', { name: /^Salir/ }).click()
    await expect(page).toHaveURL(new RegExp(`/b/${DEMO.boardId}$`))
  })
})
