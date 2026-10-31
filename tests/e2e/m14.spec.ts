import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import {
  embedElement,
  seedSlides,
  spacePath,
  textElement,
} from './slides-fixtures.ts'

// M14: embeds that work. The services themselves are faked at the network level.

const GOOGLE = '1EzVDdMtwbIWzijQqLjCsDht7vjL6sXVr'
const editLink = `https://docs.google.com/presentation/d/${GOOGLE}/edit?slide=id.p1#slide=id.p1`
const embedLink = `https://docs.google.com/presentation/d/${GOOGLE}/embed?start=false&loop=false`
const viewerUrl = `/b/${DEMO.boardId}/s/st_sebastian`
const editorUrl = `${viewerUrl}/edit`

test.beforeEach(async () => {
  await seedDemo()
})

/** Google answers at once with a tiny page (or never, to test the fallback). */
async function fakeGoogle(page: Page, mode: 'ok' | 'hang' = 'ok') {
  await page.route('https://docs.google.com/**', (route) =>
    mode === 'ok'
      ? route.fulfill({ contentType: 'text/html', body: '<p>Diapositivas</p>' })
      : undefined,
  )
}

async function savedElements() {
  const slide = await emulatorDb
    .doc(`${spacePath('st_sebastian')}/slides/slide1`)
    .get()
  return (
    JSON.parse(slide.data()!.content as string) as {
      elements: { type: string; link?: string; isDeleted?: boolean }[]
    }
  ).elements.filter((element) => !element.isDeleted)
}

test.describe('M14 · embeds that work', () => {
  test('"Insertar contenido": a Google Slides edit link is recognized, converted and inserted', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[textElement('Mi proyecto')]])
    await fakeGoogle(page)
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(editorUrl)
    await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible()

    await page.getByRole('button', { name: 'Insertar contenido' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Enlace').fill(editLink)
    await expect(dialog.getByTestId('embed-detected')).toHaveText(
      'Reconocimos: Google Slides',
    )
    await expect(dialog).toContainText('Cualquier persona con el enlace')
    await expect(dialog.locator('iframe')).toHaveAttribute('src', embedLink)
    await dialog
      .getByRole('button', { name: 'Insertar en la diapositiva' })
      .click()
    // The first embed is cheered (M20); later ones say "Contenido insertado"
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /contenido/i }),
    ).toBeVisible()

    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 15_000,
    })
    await expect
      .poll(
        async () =>
          (await savedElements()).find((e) => e.type === 'embeddable')?.link,
      )
      .toBe(embedLink)
  })

  test('unknown links and pages that cannot be framed are explained', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[textElement('x')]])
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(editorUrl)
    await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible()
    await page.getByRole('button', { name: 'Insertar contenido' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Enlace').fill('https://example.com/algo')
    await expect(dialog).toContainText('No reconocemos este enlace')
    await dialog.getByLabel('Enlace').fill('https://www.notion.so/Proyecto-123')
    await expect(dialog.getByTestId('embed-detected')).toContainText(
      'no se puede mostrar',
    )
    await expect(dialog).toContainText('notion.site')
    await expect(
      dialog.getByRole('button', { name: 'Insertar en la diapositiva' }),
    ).toBeDisabled()
  })

  test('a canva.link short link is expanded by the Worker', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[textElement('x')]])
    const asked: unknown[] = []
    await page.route('http://localhost:8787/links/resolve', async (route) => {
      if (route.request().method() === 'OPTIONS')
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'POST',
          },
        })
      asked.push(route.request().postDataJSON())
      await route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: {
          url: 'https://www.canva.com/design/DAGabc12345/xYz-tok3n/view',
        },
      })
    })
    await page.route('https://www.canva.com/**', (route) =>
      route.fulfill({ body: 'canva' }),
    )
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(editorUrl)
    await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible()
    await page.getByRole('button', { name: 'Insertar contenido' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Enlace').fill('https://canva.link/q3ta5rzcro4ifxn')
    await expect(dialog.getByTestId('embed-detected')).toHaveText(
      'Reconocimos: Canva',
    )
    expect(asked).toEqual([{ url: 'https://canva.link/q3ta5rzcro4ifxn' }])
    await expect(dialog.locator('iframe')).toHaveAttribute(
      'src',
      'https://www.canva.com/design/DAGabc12345/xYz-tok3n/view?embed',
    )
  })

  test('a link typed as text: "Convertir" in the editor, clickable in the viewer', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[textElement(editLink)]])
    await fakeGoogle(page)
    await signIn(page, 'scetina@uni.edu.co')

    await page.goto(viewerUrl)
    await expect(
      page.getByTestId('slides-viewer').locator(`a[href="${editLink}"]`),
    ).toHaveCount(1)

    await page.goto(editorUrl)
    await expect(page.getByTestId('text-links')).toContainText('1 enlace')
    await page.getByRole('button', { name: 'Convertir' }).click()
    await expect(page.getByText('Enlace convertido')).toBeVisible()
    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 15_000,
    })
    await expect
      .poll(async () => (await savedElements()).map((e) => e.type))
      .toEqual(expect.arrayContaining(['embeddable']))
    expect((await savedElements()).some((e) => e.type === 'text')).toBe(false)
  })

  test('old slides are fixed when shown; embeds show loading, "Abrir" and a fallback', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [[embedElement('slides', editLink, 100)]])
    await fakeGoogle(page)
    await signIn(page, DEMO.teacher)
    await page.goto(viewerUrl)
    const viewer = page.getByTestId('slides-viewer')
    await expect(viewer.locator('iframe')).toHaveAttribute('src', embedLink)
    await expect(viewer.getByTestId('embed-open')).toHaveAttribute(
      'href',
      embedLink,
    )
    // loads → the overlay goes away
    await expect(viewer.getByTestId('embed-loading')).toHaveCount(0)
  })

  test('an embed that never loads offers "¿No carga?" with the fix and "Abrir"', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await seedSlides('st_sebastian', [[embedElement('slides', editLink, 100)]])
    await fakeGoogle(page, 'hang')
    await signIn(page, DEMO.teacher)
    await page.goto(viewerUrl)
    const viewer = page.getByTestId('slides-viewer')
    await expect(viewer.getByTestId('embed-loading')).toContainText(
      'Cargando Google Slides',
    )
    const stuck = viewer.getByTestId('embed-stuck')
    await expect(stuck).toContainText('Cualquier persona con el enlace', {
      timeout: 20_000,
    })
    await expect(stuck.getByRole('link', { name: 'Abrir' })).toHaveAttribute(
      'href',
      embedLink,
    )
    await expect(
      stuck.getByRole('link', { name: 'Cómo insertarlo' }),
    ).toHaveAttribute('href', '/ayuda/insertar#googleSlides')
  })

  test('the guide is public and lists every service', async ({ page }) => {
    await page.goto('/ayuda/insertar#figma')
    await expect(
      page.getByRole('heading', {
        name: 'Cómo insertar contenido en tus diapositivas',
      }),
    ).toBeVisible()
    for (const name of [
      'Google Slides',
      'YouTube',
      'Figma',
      'Canva',
      'Notion',
      'Miro',
    ])
      await expect(
        page.getByRole('heading', { name, exact: true }),
      ).toBeVisible()
  })
})
