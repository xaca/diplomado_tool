import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

// Profile page (/me): the name shown in the menu and on the student's cards.

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('Profile', () => {
  test('a student renames themselves; the menu and their card follow, and can go back', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await expect(page.getByText(DEMO.boardTitle)).toBeVisible()

    await page.getByRole('button', { name: 'laura@gmail.com' }).click()
    await page.getByRole('menuitem', { name: 'Mi perfil' }).click()
    await expect(page).toHaveURL(/\/me$/)

    await page.getByLabel('Nombre').fill('Lau Gómez')
    await page.getByRole('radio', { name: 'Iniciales' }).click()
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Perfil guardado')).toBeVisible()

    // Survives a reload (and a new login refreshing the Google fields)
    await page.reload()
    await expect(page.getByLabel('Nombre')).toHaveValue('Lau Gómez')
    await expect(page.getByRole('radio', { name: 'Iniciales' })).toBeChecked()

    await page.getByRole('button', { name: 'laura@gmail.com' }).click()
    await expect(page.getByRole('menu')).toContainText('Lau Gómez')
    await page.keyboard.press('Escape')

    await page.goto(`/b/${DEMO.boardId}`)
    const mine = page.getByTestId('space-card').first()
    await expect(mine).toContainText('Lau Gómez')

    // Empty name → back to the teacher's spelling on the card
    await page.goto('/me')
    await page.getByLabel('Nombre').fill('')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Perfil guardado')).toBeVisible()
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('space-card').first()).toContainText(
      'Laura Nataly',
    )
  })

  test('the teacher has a profile page too', async ({ page }) => {
    await signIn(page, DEMO.teacher)
    await page.goto('/me')
    await page.getByLabel('Nombre').fill('Profe Andrés')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Perfil guardado')).toBeVisible()
    await expect(page.getByTestId('profile-preview')).toContainText(
      'Profe Andrés',
    )
  })
})
