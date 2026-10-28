import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { seedSlides, textElement } from './slides-fixtures.ts'

// After a deploy, a tab running the previous version asks for code files that no longer exist.
// Simulated here by failing those requests: the app reloads once, or shows a friendly page.

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('after a deploy', () => {
  test('a slide renderer file that is gone: the page reloads once and the slide shows', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[textElement('Problema')]])
    await signIn(page, 'laura@gmail.com')

    let failed = 0
    await page.route(/\/src\/features\/slides\/engine\/runtime\.ts/, (route) =>
      failed++ === 0 ? route.abort() : route.fallback(),
    )
    let loads = 0
    page.on('load', () => loads++)
    await page.goto(`/b/${DEMO.boardId}/s/st_sebastian`)

    await expect(
      page.getByTestId('slides-viewer').getByTestId('slide-preview').first(),
    ).toContainText('Problema', { timeout: 30_000 })
    expect(failed).toBeGreaterThanOrEqual(2)
    expect(loads).toBe(2)
  })

  test('a page file that stays missing: one reload, then a friendly error page', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.route(/\/src\/pages\/EditorPage\.tsx/, (route) => route.abort())
    let loads = 0
    page.on('load', () => loads++)
    await page.goto(`/b/${DEMO.boardId}/s/st_laura/edit`)

    await expect(
      page.getByRole('heading', { name: 'Algo salió mal' }),
    ).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible()
    await expect(page.getByText('Unexpected Application Error')).toHaveCount(0)
    expect(loads).toBe(2)
  })
})
