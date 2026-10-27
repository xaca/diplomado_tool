import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// The Worker and Cloudinary are faked at the network level (no real uploads, no secrets);
// everything else is real: image preparation, Firestore rules (emulator), registry, UI.

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

type Fakes = { signRequests: { authorization: string | null; body: unknown }[] }

async function fakeMediaServices(
  page: Page,
  options: { signStatus?: number } = {},
): Promise<Fakes> {
  const fakes: Fakes = { signRequests: [] }
  let counter = 0

  await page.route('http://localhost:8787/uploads/sign', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors() })
    const body = request.postDataJSON() as {
      boardId: string
      studentId: string
    }
    fakes.signRequests.push({
      authorization: await request.headerValue('authorization'),
      body,
    })
    if (options.signStatus)
      return route.fulfill({
        status: options.signStatus,
        headers: cors(),
        json: { error: 'x' },
      })
    counter += 1
    const assetId = `asset${counter}`
    await route.fulfill({
      headers: cors(),
      json: {
        assetId,
        cloudName: 'syqkgwws',
        apiKey: 'test-key',
        signature: 'test-signature',
        params: {
          public_id: `pbl/dev/${body.boardId}/${body.studentId}/${assetId}`,
          timestamp: 1,
        },
      },
    })
  })

  await page.route(
    'https://api.cloudinary.com/v1_1/syqkgwws/image/upload',
    async (route) => {
      const form = route.request().postData() ?? ''
      const publicId = /name="public_id"\r\n\r\n([^\r]+)/.exec(form)?.[1]
      await route.fulfill({
        json: {
          public_id: publicId,
          version: 1730000000,
          width: 1,
          height: 1,
          format: 'png',
          bytes: PNG_1x1.length,
        },
      })
    },
  )

  await page.route('https://res.cloudinary.com/**', (route) =>
    route.fulfill({ body: PNG_1x1, contentType: 'image/png' }),
  )
  return fakes
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

async function openMyCard(page: Page, email: string) {
  await signIn(page, email)
  await page.getByText(DEMO.boardTitle).click()
  await page.getByRole('button', { name: 'Editar mi tarjeta' }).click()
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M4 · card cover upload', () => {
  test('a student uploads a cover: signed by the Worker, shown on the card as a Cloudinary thumbnail', async ({
    page,
  }) => {
    const fakes = await fakeMediaServices(page)
    await openMyCard(page, 'laura@gmail.com')

    await page.getByTestId('cover-input').setInputFiles({
      name: 'portada.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    await expect(page.getByText('Portada actualizada')).toBeVisible()

    // The Worker was asked with the student's Firebase token for their own space
    expect(fakes.signRequests).toHaveLength(1)
    expect(fakes.signRequests[0].authorization).toMatch(/^Bearer .+/)
    expect(fakes.signRequests[0].body).toEqual({
      boardId: DEMO.boardId,
      studentId: 'st_laura',
    })

    // Preview + card use Cloudinary URLs built from the stored reference (never a stored URL)
    await expect(page.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      `https://res.cloudinary.com/syqkgwws/image/upload/f_auto,q_auto,c_fill,w_400,h_225/v1730000000/pbl/dev/${DEMO.boardId}/st_laura/asset1`,
    )
    await page.keyboard.press('Escape')
    await expect(
      page.getByTestId('space-card').first().getByTestId('card-cover'),
    ).toBeVisible()

    // Registered in Firestore
    const asset = await emulatorDb
      .doc(`boards/${DEMO.boardId}/assets/asset1`)
      .get()
    expect(asset.data()).toMatchObject({
      studentId: 'st_laura',
      kind: 'cover',
      status: 'active',
    })
  })

  test('changing and removing the cover marks the old images as unused (for cleanup)', async ({
    page,
  }) => {
    await fakeMediaServices(page)
    await openMyCard(page, 'laura@gmail.com')
    const input = page.getByTestId('cover-input')

    await input.setInputFiles({
      name: 'a.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    await expect(page.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      /asset1$/,
    )
    await input.setInputFiles({
      name: 'b.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    })
    await expect(page.getByTestId('cover-preview')).toHaveAttribute(
      'src',
      /asset2$/,
    )
    await page.getByRole('button', { name: 'Quitar' }).click()
    await expect(page.getByText('Sin portada')).toBeVisible()

    const status = async (id: string) =>
      (await emulatorDb.doc(`boards/${DEMO.boardId}/assets/${id}`).get()).data()
        ?.status
    // The UI updates instantly (local cache); wait for the write to reach the emulator
    await expect.poll(() => status('asset1')).toBe('orphaned')
    await expect.poll(() => status('asset2')).toBe('orphaned')
  })

  test('the teacher sees the new cover live on the dashboard', async ({
    browser,
  }) => {
    const teacher = await browser.newPage()
    await fakeMediaServices(teacher)
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(`/b/${DEMO.boardId}`)
    await expect(teacher.getByTestId('space-card')).not.toHaveCount(0)

    const student = await browser.newPage()
    await fakeMediaServices(student)
    await openMyCard(student, 'elma@gmail.com')
    await student
      .getByTestId('cover-input')
      .setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG_1x1 })
    await expect(student.getByText('Portada actualizada')).toBeVisible()

    const elma = teacher.getByTestId('space-card').filter({ hasText: 'Elma' })
    await expect(elma.getByTestId('card-cover')).toBeVisible()
  })

  test('a refused signature shows a clear message and changes nothing', async ({
    page,
  }) => {
    await fakeMediaServices(page, { signStatus: 403 })
    await openMyCard(page, 'laura@gmail.com')
    await page
      .getByTestId('cover-input')
      .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG_1x1 })
    await expect(
      page.getByText('No tienes permiso para subir imágenes'),
    ).toBeVisible()
    await expect(page.getByText('Sin portada')).toBeVisible()
  })

  test('unsupported files are rejected before any upload', async ({ page }) => {
    const fakes = await fakeMediaServices(page)
    await openMyCard(page, 'laura@gmail.com')
    // The picker filters by type, but a forced file must still be refused
    await page.getByTestId('cover-input').setInputFiles({
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    })
    await expect(page.getByText('Formato no soportado')).toBeVisible()
    expect(fakes.signRequests).toHaveLength(0)
  })
})
