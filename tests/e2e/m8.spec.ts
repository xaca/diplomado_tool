import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

// Launch details: privacy notice (Ley 1581 de 2012), page metadata, teacher area as its own chunk.

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M8 · launch', () => {
  test('the login page links to the privacy notice, readable without signing in', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(
      page.getByText('solo para fines académicos del curso'),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Aviso de privacidad' }).click()
    await expect(page).toHaveURL(/\/privacidad$/)
    await expect(
      page.getByRole('heading', { name: 'Aviso de privacidad' }),
    ).toBeVisible()
    for (const section of [
      'Qué datos usamos',
      'Dónde se guardan',
      'Tus derechos',
    ])
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    await expect(page.getByText('Ley 1581 de 2012')).toBeVisible()

    // English too
    await page.goto('/login')
    await page.getByRole('button', { name: 'English' }).click()
    await page.getByRole('link', { name: 'Privacy notice' }).click()
    await expect(
      page.getByRole('heading', { name: 'Privacy notice' }),
    ).toBeVisible()
  })

  test('page metadata: Spanish, title, description, social preview, not indexed', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page).toHaveTitle('PBL Diplomado')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /proyecto/,
    )
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /og-image\.png$/,
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    )
    for (const file of [
      '/favicon.svg',
      '/og-image.png',
      '/apple-touch-icon.png',
    ])
      expect((await page.request.get(file)).ok()).toBe(true)
  })

  test('signed-in pages show the privacy link; the teacher area still works as a lazy chunk', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await expect(page.getByText(DEMO.boardTitle)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Privacidad' })).toBeVisible()
    await page.getByText(DEMO.boardTitle).click()
    await expect(page.getByTestId('lifecycle-panel')).toBeVisible()
  })
})
