import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

// M22: achievements — unlocked at their moments or from existing work, with how many did it.

const logrosUrl = `/b/${DEMO.boardId}/logros`
const row = (page: Page, key: string) =>
  page.locator(`[data-testid="achievement"][data-key="${key}"]`)

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M22 · achievements', () => {
  test('the first slide unlocks "Primera diapositiva" in the same toast as the cheer; the student sees counts, never names', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto(`/b/${DEMO.boardId}/s/st_laura/edit`)
    await page
      .getByRole('button', { name: 'Crear la primera diapositiva' })
      .click()
    await expect(page.locator('.cheer-toast').first()).toContainText(
      'Logro desbloqueado: Primera diapositiva',
    )
    // one toast, not two
    await expect(page.locator('.cheer-toast')).toHaveCount(1)

    await page.goto(logrosUrl)
    await expect(page.getByTestId('my-summary')).toHaveText(
      'Desbloqueaste 1 de 14',
    )
    await expect(row(page, 'firstSlide')).toHaveAttribute(
      'data-unlocked',
      'true',
    )
    await expect(row(page, 'firstSlide').getByTestId('counter')).toHaveText(
      /^1 de \d+ lo lograron$/,
    )
    await expect(row(page, 'photo')).toHaveAttribute('data-unlocked', 'false')
    await expect(row(page, 'photo')).toContainText('Sube tu foto')
    await expect(page.getByTestId('who')).toHaveCount(0)
  })

  test('work done before counts, without a toast; the teacher sees the counters and who has each one', async ({
    page,
  }) => {
    // Sebastian's card is already in "Prototipar" (seed)
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`/b/${DEMO.boardId}`)
    await page
      .getByRole('navigation', { name: 'Secciones del tablero' })
      .getByRole('link', { name: 'Logros' })
      .click()
    await expect(row(page, 'prototype')).toHaveAttribute(
      'data-unlocked',
      'true',
    )
    await expect(row(page, 'firstStage')).toHaveAttribute(
      'data-unlocked',
      'true',
    )
    await expect(row(page, 'test')).toHaveAttribute('data-unlocked', 'false')
    await expect(page.locator('.cheer-toast')).toHaveCount(0)

    await signIn(page, DEMO.teacher)
    await page.goto(logrosUrl)
    await expect(row(page, 'prototype').getByTestId('counter')).toHaveText(
      /^1 de \d+ lo lograron$/,
    )
    await row(page, 'prototype').locator('summary').click()
    await expect(row(page, 'prototype').getByTestId('who')).toHaveText(
      'Sebastian Cetina',
    )
    await expect(page.getByTestId('my-summary')).toHaveCount(0)
  })
})
