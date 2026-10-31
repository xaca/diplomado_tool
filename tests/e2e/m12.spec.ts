import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { fakeMediaServices, PNG_1x1 } from './media-fakes.ts'

// M12: the teacher customizes the board (name, logo, background, layout, sticky header) with a
// live preview; the #DOCENTE ring. Seed: Sebastian (Equipo 1), Elma (Equipo 2), Carolina (no group).

test.beforeEach(async () => {
  await seedDemo()
})

async function openPanel(page: Page) {
  await signIn(page, DEMO.teacher)
  await page.goto(`/b/${DEMO.boardId}`)
  await page.getByRole('button', { name: 'Personalizar' }).click()
  return page.getByTestId('customize-panel')
}

test.describe('M12 · board customization', () => {
  test('the teacher renames the board and changes background and layout; students see it', async ({
    page,
    browser,
  }) => {
    const panel = await openPanel(page)
    await panel.getByLabel('Nombre del tablero').fill('Diseño de Servicios')
    await panel.getByRole('radio', { name: 'Noche' }).click()
    await panel.getByRole('radio', { name: 'Por etapa' }).click()
    // Live preview before saving
    await expect(page.getByTestId('board-title')).toHaveText(
      'Diseño de Servicios',
    )
    await expect(page.getByTestId('board-page')).toHaveAttribute(
      'data-background',
      'night',
    )
    await expect(page.getByTestId('board-grid')).toHaveAttribute(
      'data-layout',
      'stages',
    )

    await panel.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Tablero actualizado')).toBeVisible()
    await expect(panel).toBeHidden()

    // One column per Design Thinking stage (the seed has Prototipando, Ideando, Vitrineando)
    const columns = page.getByTestId('board-column')
    await expect(columns).toHaveCount(6)
    await expect(columns.filter({ hasText: 'Ideando' })).toContainText('Elma')

    // A student sees the same board
    const student = await (await browser.newContext()).newPage()
    await signIn(student, 'elma@gmail.com')
    await student.goto(`/b/${DEMO.boardId}`)
    await expect(student.getByTestId('board-title')).toHaveText(
      'Diseño de Servicios',
    )
    await expect(student.getByTestId('board-page')).toHaveAttribute(
      'data-background',
      'night',
    )
    await expect(student.getByTestId('board-column')).toHaveCount(6)
    await expect(
      student.getByRole('button', { name: 'Personalizar' }),
    ).toHaveCount(0)
  })

  test('cancel discards the preview', async ({ page }) => {
    const panel = await openPanel(page)
    await panel.getByRole('radio', { name: 'Lista' }).click()
    await expect(page.getByTestId('board-grid')).toHaveAttribute(
      'data-layout',
      'list',
    )
    await panel.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByTestId('board-grid')).toHaveAttribute(
      'data-layout',
      'masonry',
    )
    await expect(page.getByTestId('board-page')).toHaveAttribute(
      'data-background',
      'yellow',
    )
  })

  test('"Por grupo" shows the roster groups (copied to the cards on the teacher’s visit)', async ({
    page,
  }) => {
    const panel = await openPanel(page)
    await panel.getByRole('radio', { name: 'Por grupo' }).click()
    const columns = page.getByTestId('board-column')
    await expect(columns.filter({ hasText: 'Equipo 1' })).toContainText(
      'Sebastian',
    )
    await expect(columns.filter({ hasText: 'Equipo 2' })).toContainText('Elma')
    await expect(columns.filter({ hasText: 'Sin grupo' })).toContainText(
      'Carolina',
    )
  })

  test('the teacher uploads a logo: header and the students’ board list', async ({
    page,
  }) => {
    const fakes = await fakeMediaServices(page)
    const panel = await openPanel(page)
    await panel.getByTestId('logo-input').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    await expect(page.getByText('Logo actualizado')).toBeVisible()
    expect(fakes.signRequests.at(-1)?.body).toEqual({
      scope: 'board',
      boardId: DEMO.boardId,
    })
    await expect(page.getByTestId('board-logo')).toHaveAttribute(
      'src',
      new RegExp(`/pbl/dev/${DEMO.boardId}/board/asset1$`),
    )
  })

  test('sticky header stays visible and shrinks while scrolling; can be turned off', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 })
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('space-card')).toHaveCount(3)
    await page.mouse.wheel(0, 3000)
    await expect(page.getByTestId('board-header')).toBeInViewport()
    await expect(page.getByTestId('board-header')).toHaveAttribute(
      'data-compact',
      'true',
    )

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: 'Personalizar' }).click()
    await page
      .getByTestId('customize-panel')
      .getByRole('switch', { name: /Encabezado fijo/ })
      .click()
    await page
      .getByTestId('customize-panel')
      .getByRole('button', { name: 'Guardar' })
      .click()
    await expect(page.getByText('Tablero actualizado')).toBeVisible()
    await page.mouse.wheel(0, 3000)
    await expect(page.getByTestId('board-header')).not.toBeInViewport()
  })

  test('the teacher wears the #DOCENTE ring in the board header and the menu', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    const teachers = page.getByTestId('board-teachers')
    await expect(teachers.locator('[data-teacher]')).toHaveCount(1)
    await expect(teachers.getByTestId('teacher-badge')).toBeVisible()
    await expect(
      page.getByRole('banner').first().locator('[data-teacher]'),
    ).toHaveCount(1)

    // …and students see it too
    await signIn(page, 'elma@gmail.com')
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(
      page.getByTestId('board-teachers').locator('[data-teacher]'),
    ).toHaveCount(1)
    // students never get it
    await expect(
      page.getByTestId('space-card').locator('[data-teacher]'),
    ).toHaveCount(0)
  })
})
