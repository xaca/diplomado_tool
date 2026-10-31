import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { seedSlides, spacePath, textElement } from './slides-fixtures.ts'

// M17: Canva and the embed options. Canva and the media-api Worker are faked at the network level.

const editorUrl = `/b/${DEMO.boardId}/s/st_sebastian/edit`
const DESIGN = 'https://www.canva.com/design/DAFTFxhLLPw/ddljelrvwHm5zBTlNywJMQ'
// Canva's "Compartir → Insertar → Código HTML" for an A4 portrait design
const CANVA_CODE = `<div style="position: relative; width: 100%; height: 0; padding-top: 141.4286%; padding-bottom: 0; overflow: hidden; border-radius: 8px;"> <iframe loading="lazy" style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; border: none;" src="${DESIGN}/view?embed" allowfullscreen="allowfullscreen" allow="fullscreen"></iframe></div><a href="${DESIGN}/view?utm_content=DAFTFxhLLPw&amp;utm_campaign=designshare" target="_blank" rel="noopener">Currículo</a>`

test.beforeEach(async () => {
  await seedDemo()
  await seedSlides('st_sebastian', [[textElement('Mi proyecto')]])
})

/** The Worker's POST /links/canva answers `answer` (and records what it was asked). */
async function fakeWorker(page: Page, answer: Record<string, unknown>) {
  const asked: unknown[] = []
  await page.route('http://localhost:8787/links/canva', async (route) => {
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
      json: answer,
    })
  })
  await page.route('https://www.canva.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Canva</p>' }),
  )
  return asked
}

async function openDialog(page: Page) {
  await signIn(page, 'scetina@uni.edu.co')
  await page.goto(editorUrl)
  await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Insertar contenido' }).click()
  return page.getByRole('dialog')
}

test.describe('M17 · Canva and the embed options', () => {
  test("the services come first (Canva on top); Canva's embed code is inserted in its real shape", async ({
    page,
  }) => {
    const asked = await fakeWorker(page, {
      shared: true,
      width: 794,
      height: 1123,
      title: 'Currículo',
    })
    const dialog = await openDialog(page)
    const services = dialog.getByTestId('embed-services').getByRole('button')
    await expect(services.first()).toContainText('Canva')
    await expect(services).toHaveCount(15)

    await services.first().click()
    await expect(dialog).toContainText('Cómo compartirlo desde Canva')
    await expect(dialog).toContainText('Opción 2 · Código')
    await dialog.getByLabel('Enlace o código').fill(CANVA_CODE)

    await expect(dialog.getByTestId('embed-detected')).toHaveText(
      'Reconocimos: Canva · «Currículo»',
    )
    expect(asked).toEqual([{ url: `${DESIGN}/view` }])
    await expect(dialog.locator('iframe')).toHaveAttribute(
      'src',
      `${DESIGN}/view?embed`,
    )
    await expect(dialog.getByTestId('embed-preview')).toHaveAttribute(
      'data-aspect',
      '0.707',
    )
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

    // Saved as a portrait box, not 16:9
    await expect
      .poll(async () => {
        const slide = await emulatorDb
          .doc(`${spacePath('st_sebastian')}/slides/slide1`)
          .get()
        const embed = (
          JSON.parse(slide.data()!.content as string) as {
            elements: { type: string; width: number; height: number }[]
          }
        ).elements.find((element) => element.type === 'embeddable')
        return embed && Math.round((embed.width / embed.height) * 100) / 100
      })
      .toBe(0.71)
  })

  test("a design that isn't shared is flagged before inserting; Canva websites are explained", async ({
    page,
  }) => {
    await fakeWorker(page, { shared: false })
    const dialog = await openDialog(page)
    const field = dialog.getByLabel('Enlace o código')

    await field.fill(`${DESIGN}/edit?utm_content=x&utm_source=sharebutton`)
    await expect(dialog.getByTestId('canva-private')).toContainText(
      'todavía no está compartido',
    )
    // Still insertable (the student may share it right after)
    await expect(
      dialog.getByRole('button', { name: 'Insertar en la diapositiva' }),
    ).toBeEnabled()

    await field.fill('https://michalgeyer.my.canva.site/')
    await expect(dialog.getByTestId('embed-detected')).toContainText(
      'Los sitios web de Canva',
    )
    await expect(
      dialog.getByRole('button', { name: 'Insertar en la diapositiva' }),
    ).toBeDisabled()

    // Pasting HTML without an address is not a link
    await field.fill('<div style="padding-top: 56%"></div>')
    await expect(dialog).toContainText('No reconocemos este enlace')
  })

  test('without the Worker (not deployed yet) Canva links still insert as before', async ({
    page,
  }) => {
    await page.route('http://localhost:8787/links/canva', (route) =>
      route.abort(),
    )
    await page.route('https://www.canva.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<p>Canva</p>' }),
    )
    const dialog = await openDialog(page)
    await dialog.getByLabel('Enlace o código').fill(`${DESIGN}/view`)
    await expect(dialog.getByTestId('embed-detected')).toHaveText(
      'Reconocimos: Canva',
    )
    await expect(dialog.getByTestId('embed-preview')).toHaveAttribute(
      'data-aspect',
      '1.778',
    )
    await expect(
      dialog.getByRole('button', { name: 'Insertar en la diapositiva' }),
    ).toBeEnabled()
  })
})
