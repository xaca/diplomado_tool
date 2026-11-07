import { expect, test, type Page } from '@playwright/test'
import { emulatorDb } from '../../scripts/emulator.ts'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

// M25: Presentaciones and Evaluaciones — Google Slides and Google Forms linked by the teacher,
// embedded for students (only the visible ones, D121), the sections bar on every board page
// (D120) and Administrar only for the board's own teachers.

const SLIDES_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd'
const PUBLISHED_ID = `2PACX-1v${'Q'.repeat(78)}`
const FORM_ID = '1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh'
const board = `/b/${DEMO.boardId}`
const admin = (tab: string) => `/teacher/boards/${DEMO.boardId}/${tab}`

/** Google answers at once with a tiny page; Drive thumbnails fail (the card shows its icon) */
async function fakeGoogle(page: Page) {
  await page.route('https://docs.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }),
  )
  await page.route('https://lh3.googleusercontent.com/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
}

const sections = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones del tablero' })

async function addPresentation(page: Page, link: string, title: string) {
  const panel = page.getByTestId('presentations-panel')
  await panel.getByRole('button', { name: 'Agregar presentación' }).click()
  await panel.getByLabel('Enlace de Google Slides').fill(link)
  await panel.getByRole('textbox', { name: 'Título' }).fill(title)
  await panel.getByRole('button', { name: 'Guardar' }).click()
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M25 · Presentaciones and Evaluaciones', () => {
  test('the teacher links, orders and hides presentations; students see only the visible ones', async ({
    page,
  }) => {
    await fakeGoogle(page)
    await signIn(page, DEMO.teacher)
    await page.goto(admin('presentations'))
    const panel = page.getByTestId('presentations-panel')

    // a link that isn't Google Slides is explained, nothing is saved
    await addPresentation(page, 'https://www.canva.com/design/DAF/view', 'Mal')
    await expect(panel.getByRole('alert')).toContainText(
      'No se reconoce como enlace de Google Slides',
    )
    await panel.getByRole('button', { name: 'Cancelar' }).click()

    await addPresentation(
      page,
      `https://docs.google.com/presentation/d/${SLIDES_ID}/edit?usp=sharing`,
      'Clase 1 — Introducción',
    )
    await expect(panel.getByTestId('presentation-row')).toHaveCount(1)
    // a presentation published to the web (its own, longer id)
    await addPresentation(
      page,
      `https://docs.google.com/presentation/d/e/${PUBLISHED_ID}/pub?start=false`,
      'Clase 2 — Publicada',
    )
    await addPresentation(
      page,
      `https://docs.google.com/presentation/d/${SLIDES_ID.replace('1A', '9Z')}/view`,
      'Borrador',
    )
    const rows = panel.getByTestId('presentation-row')
    await expect(rows).toHaveCount(3)

    // Clase 2 goes first; Borrador is hidden from students
    await rows.nth(1).getByRole('button', { name: 'Subir' }).click()
    await expect(rows.nth(0)).toContainText('Clase 2 — Publicada')
    await rows
      .nth(2)
      .getByRole('button', { name: 'Ocultar de estudiantes' })
      .click()
    await expect(rows.nth(2)).toContainText('Oculta')

    // The teacher sees all three, the hidden one marked
    await page.goto(`${board}/presentaciones`)
    await expect(page.getByTestId('presentation')).toHaveCount(3)
    await expect(page.getByTestId('presentation').nth(2)).toContainText(
      'Oculta',
    )

    // Laura sees the two visible ones, in the teacher's order, and opens one
    await signIn(page, 'laura@gmail.com')
    await page.goto(`${board}/presentaciones`)
    const cards = page.getByTestId('presentation')
    await expect(cards).toHaveCount(2)
    await expect(cards.nth(0)).toContainText('Clase 2 — Publicada')
    await expect(cards.nth(1)).toContainText('Clase 1 — Introducción')
    await expect(page.getByText('Borrador')).toHaveCount(0)
    await cards.nth(0).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('iframe')).toHaveAttribute(
      'src',
      new RegExp(`/presentation/d/e/${PUBLISHED_ID}/embed`),
    )
    await expect(dialog.getByTestId('embed-open')).toBeVisible()
  })

  test('evaluations: the teacher links a form, students fill it in inside the app', async ({
    page,
  }) => {
    await fakeGoogle(page)
    await signIn(page, DEMO.teacher)
    await page.goto(admin('evaluations'))
    const panel = page.getByTestId('evaluations-panel')
    await panel.getByRole('button', { name: 'Agregar evaluación' }).click()
    await panel
      .getByLabel('Enlace de Google Forms')
      .fill(`https://docs.google.com/forms/d/e/${FORM_ID}/viewform?usp=sf_link`)
    await panel
      .getByRole('textbox', { name: 'Título' })
      .fill('Rúbrica Shark Tank — Equipo 1')
    await panel.getByRole('button', { name: 'Guardar' }).click()
    await expect(panel.getByTestId('evaluation-row')).toHaveCount(1)

    await signIn(page, 'laura@gmail.com')
    await page.goto(board)
    await sections(page).getByRole('link', { name: 'Evaluaciones' }).click()
    await expect(page).toHaveURL(new RegExp(`${board}/evaluaciones$`))
    const form = page.getByTestId('evaluation')
    await expect(form).toHaveCount(1)
    await expect(form).toContainText('Rúbrica Shark Tank — Equipo 1')
    const frame = form.locator('iframe')
    await expect(frame).toHaveAttribute(
      'src',
      `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?embedded=true`,
    )
    await expect(frame).toHaveAttribute('sandbox', /allow-forms/)
  })

  test('the sections bar: students see Presentaciones / Evaluaciones only when there is something; the teacher always', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto(board)
    const bar = sections(page)
    await expect(bar.getByRole('link', { name: 'Tarjetas' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Logros' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Presentaciones' })).toHaveCount(
      0,
    )
    await expect(bar.getByRole('link', { name: 'Evaluaciones' })).toHaveCount(0)

    // a hidden presentation doesn't count; a visible one does
    await emulatorDb.collection(`boards/${DEMO.boardId}/presentations`).add({
      title: 'Oculta',
      presentationId: SLIDES_ID,
      position: 0,
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await page.reload()
    await expect(
      sections(page).getByRole('link', { name: 'Logros' }),
    ).toBeVisible()
    await expect(
      sections(page).getByRole('link', { name: 'Presentaciones' }),
    ).toHaveCount(0)
    await emulatorDb.collection(`boards/${DEMO.boardId}/presentations`).add({
      title: 'Clase 1',
      presentationId: SLIDES_ID,
      position: 1,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await expect(
      sections(page).getByRole('link', { name: 'Presentaciones' }),
    ).toBeVisible()

    // the same bar on every section page, with the board's compact header
    for (const [name, path] of [
      ['Logros', '/logros'],
      ['Grabaciones', '/videos'],
      ['Clases', '/class'],
    ] as const) {
      await sections(page).getByRole('link', { name }).click()
      await expect(page).toHaveURL(new RegExp(`${board}${path}$`))
      await expect(sections(page)).toBeVisible()
      await expect(
        page.getByRole('link', { name: DEMO.boardTitle }),
      ).toBeVisible()
    }

    // the teacher always sees both, even with no evaluation at all
    await signIn(page, DEMO.teacher)
    await page.goto(board)
    await expect(
      sections(page).getByRole('link', { name: 'Evaluaciones' }),
    ).toBeVisible()
    await expect(
      sections(page).getByRole('link', { name: 'Presentaciones' }),
    ).toBeVisible()
  })

  test('limits: "Agregar" is off at 20 evaluations', async ({ page }) => {
    const batch = emulatorDb.batch()
    for (let i = 0; i < 20; i++)
      batch.set(emulatorDb.doc(`boards/${DEMO.boardId}/evaluations/e${i}`), {
        title: `Evaluación ${i + 1}`,
        formId: FORM_ID,
        published: true,
        position: i,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    await batch.commit()
    await signIn(page, DEMO.teacher)
    await page.goto(admin('evaluations'))
    const panel = page.getByTestId('evaluations-panel')
    await expect(panel.getByTestId('evaluation-row')).toHaveCount(20)
    await expect(
      panel.getByRole('button', { name: 'Agregar evaluación' }),
    ).toBeDisabled()
    await expect(panel.getByTestId('limit')).toContainText('máximo de 20')
  })

  test("a teacher of another course who is a student here can't open Administrar", async ({
    page,
  }) => {
    // Elma joins as a student first (her email is on the roster) …
    await signIn(page, 'elma@gmail.com')
    await page.goto(board)
    await expect(sections(page)).toBeVisible()
    // … and then becomes a teacher (of her own courses)
    await emulatorDb.doc('staffEmails/elma@gmail.com').set({
      email: 'elma@gmail.com',
      displayName: 'Elma',
      role: 'teacher',
      addedAt: new Date(),
    })
    await signIn(page, 'elma@gmail.com')
    await page.goto(admin('presentations'))
    await expect(page.getByTestId('not-board-teacher')).toContainText(
      'No eres docente de este tablero',
    )
    await expect(page.getByTestId('presentations-panel')).toHaveCount(0)
  })
})
