import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { fakeMediaServices, PNG_1x1 } from './media-fakes.ts'

// The Worker and Cloudinary are faked at the network level (no real uploads, no secrets);
// everything else is real: image preparation, Firestore rules (emulator), registry, UI.

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
