import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { fakeMediaServices, PNG_1x1 } from './media-fakes.ts'

// M11: uploaded profile photo and the Design Thinking stage ring. The seed puts Sebastian in
// "Prototipando", Elma in "Ideando" and Carolina in "Vitrineando".

test.beforeEach(async () => {
  await seedDemo()
})

const cardOf = (page: Page, name: string) =>
  page.getByTestId('space-card').filter({ hasText: name })

test.describe('M11 · Design Thinking stage', () => {
  test('a student picks their stage; the ring shows on the card and, curved, on their space', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.getByText(DEMO.boardTitle).click()
    const mine = cardOf(page, 'Laura Nataly')
    await expect(mine.getByTestId('stage-avatar')).toHaveAttribute(
      'data-stage',
      '',
    )

    await page.getByRole('button', { name: 'Editar mi tarjeta' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('¿En qué etapa vas?')).toBeVisible()
    await dialog.getByRole('button', { name: /Ideando/ }).click()
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Tarjeta guardada')).toBeVisible()

    await expect(mine.getByTestId('stage-avatar')).toHaveAttribute(
      'data-stage',
      'ideate',
    )
    await expect(mine.getByTestId('stage-avatar')).toHaveAttribute(
      'title',
      'Etapa: Ideando',
    )

    await page.goto(`/b/${DEMO.boardId}/s/st_laura`)
    const detail = page.getByTestId('space-detail')
    await expect(detail.locator('textPath')).toHaveText('#IDEANDO')
    await expect(detail.getByTestId('stage-since')).toBeVisible()

    // "Vitrineando": only here to learn
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Vitrineando/ })
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Guardar' })
      .click()
    await expect(detail.locator('textPath')).toHaveText('#VITRINEANDO')
  })

  test('the teacher sees students per stage, filters, and sets a stage', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    const summary = page.getByTestId('stage-summary')
    await expect(
      summary.getByRole('button', { name: /Prototipando\s*1/ }),
    ).toBeVisible()
    await expect(
      summary.getByRole('button', { name: /Vitrineando\s*1/ }),
    ).toBeVisible()

    await summary.getByRole('button', { name: /Ideando/ }).click()
    await expect(page.getByTestId('space-card')).toHaveCount(1)
    await expect(page.getByTestId('space-card')).toContainText('Elma')
    await page.getByRole('button', { name: 'Ver todos' }).click()
    await expect(page.getByTestId('space-card')).toHaveCount(3)

    // On a student's space the teacher sets the stage (signed as the teacher)
    await page.goto(`/b/${DEMO.boardId}/s/st_sebastian`)
    await page
      .getByTestId('stage-picker')
      .getByRole('button', { name: /Evaluando/ })
      .click()
    await expect(page.getByText('Etapa guardada')).toBeVisible()
    await expect(page.getByTestId('stage-since')).toContainText(
      'puesta por el docente',
    )
    await expect(
      page.getByTestId('space-detail').locator('textPath'),
    ).toHaveText('#EVALUANDO')
  })

  test('the teacher renames a stage for the board', async ({ page }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    const panel = page.getByTestId('stages-panel')
    await panel.getByLabel('Etapa 5', { exact: true }).fill('Probando')
    await panel.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Etapa guardada')).toBeVisible()

    await page.goto(`/b/${DEMO.boardId}`)
    await expect(
      page
        .getByTestId('stage-summary')
        .getByRole('button', { name: /Probando/ }),
    ).toBeVisible()

    // and back to the defaults
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Volver a Design Thinking' }).click()
    await expect(page.getByText('Etapa guardada')).toBeVisible()
    await expect(panel.getByLabel('Etapa 5', { exact: true })).toHaveValue('')
  })
})

test.describe('M11 · uploaded profile photo', () => {
  test('a student uploads a cropped photo, sees it on their card, then removes it', async ({
    page,
  }) => {
    const fakes = await fakeMediaServices(page)
    await signIn(page, 'laura@gmail.com')
    await expect(page.getByText(DEMO.boardTitle)).toBeVisible()
    await page.goto('/me')

    await page.getByTestId('avatar-file').setInputFiles({
      name: 'yo.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    const crop = page.getByRole('dialog')
    await expect(crop.getByTestId('avatar-crop')).toBeVisible()
    await crop.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Foto actualizada')).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Mi foto' })).toBeChecked()

    // Signed as an avatar, proving a board membership
    expect(fakes.signRequests.at(-1)?.body).toEqual({
      scope: 'avatar',
      boardId: DEMO.boardId,
    })

    await page.goto(`/b/${DEMO.boardId}`)
    await expect(
      cardOf(page, 'Laura Nataly').locator('img').first(),
    ).toHaveAttribute(
      'src',
      /res\.cloudinary\.com\/.+\/pbl\/dev\/users\/[^/]+\/avatar$/,
    )

    await page.goto('/me')
    await page.getByRole('button', { name: 'Quitar foto' }).click()
    await expect(page.getByText('Foto eliminada')).toBeVisible()
    await expect(
      page.getByRole('radio', { name: 'Foto de Google' }),
    ).toBeChecked()
    await expect(page.getByRole('button', { name: 'Subir foto' })).toBeVisible()
  })
})
