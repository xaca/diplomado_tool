import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { fakeAdminServices } from './media-fakes.ts'
import { seedSlides, spacePath, textElement } from './slides-fixtures.ts'

// Data lifecycle: archived projects, activity, storage cleanup, backup / restore, purge.
// The Worker is faked (its checks are covered by the Worker and integration tests).

const BOARD = `boards/${DEMO.boardId}`
const daysAgo = (days: number) =>
  Timestamp.fromMillis(Date.now() - days * 24 * 3600 * 1000)

test.beforeEach(async () => {
  await seedDemo()
})

async function openTeacherBoard(page: Page) {
  await signIn(page, DEMO.teacher)
  await page.goto(`/teacher/boards/${DEMO.boardId}`)
  await expect(page.getByTestId('lifecycle-panel')).toBeVisible()
}

test.describe('M7 · archived projects', () => {
  test('the teacher archives a board: read-only for students, then restores it', async ({
    browser,
  }) => {
    const teacher = await browser.newPage()
    await openTeacherBoard(teacher)
    await teacher.getByRole('button', { name: 'Archivar ahora' }).click()
    await teacher
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Archivar ahora' })
      .click()
    await expect(teacher.getByTestId('lifecycle-panel')).toContainText(
      'Archivado desde',
    )
    await teacher.goto('/teacher')
    await expect(teacher.getByTestId('archived-boards')).toContainText(
      DEMO.boardTitle,
    )

    // The student finds it under "Proyectos archivados", read-only
    const student = await browser.newPage()
    await signIn(student, 'laura@gmail.com')
    await expect(student.getByTestId('archived-boards')).toContainText(
      DEMO.boardTitle,
    )
    await student.getByText(DEMO.boardTitle).click()
    await expect(student.getByText('Este tablero está cerrado')).toBeVisible()
    await expect(
      student.getByRole('button', { name: 'Editar mi tarjeta' }),
    ).toHaveCount(0)

    // Restore → editable again
    await teacher.goto(`/teacher/boards/${DEMO.boardId}`)
    await teacher.getByRole('button', { name: 'Restaurar' }).click()
    await expect(teacher.getByTestId('lifecycle-panel')).toContainText(
      'pasará a «Proyectos archivados»',
    )
    await expect(
      student.getByRole('button', { name: 'Editar mi tarjeta' }),
    ).toBeVisible()
  })

  test('a board unused for longer than its limit moves to "Proyectos archivados" by itself', async ({
    page,
  }) => {
    await emulatorDb.doc(BOARD).update({ lastActivityAt: daysAgo(100) })
    await signIn(page, DEMO.teacher)
    await expect(page.getByTestId('archived-boards')).toContainText(
      DEMO.boardTitle,
    )
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await expect(page.getByTestId('lifecycle-panel')).toContainText(
      'Archivado desde',
    )
    // Changing the limit is a teacher setting; a longer one brings it back
    await page.getByRole('button', { name: 'Restaurar' }).click()
    await expect(page.getByLabel('Archivar automáticamente tras')).toHaveValue(
      '90',
    )
    await page.getByLabel('Archivar automáticamente tras').selectOption('180')
    await expect
      .poll(async () =>
        (await emulatorDb.doc(BOARD).get()).get('archiveAfterDays'),
      )
      .toBe(180)
  })

  test("a student's edit records activity on the board (at most once an hour)", async ({
    page,
  }) => {
    await emulatorDb.doc(BOARD).update({ lastActivityAt: daysAgo(2) })
    await signIn(page, 'laura@gmail.com')
    await page.getByText(DEMO.boardTitle).click()
    await page.getByRole('button', { name: 'Editar mi tarjeta' }).click()
    await page.getByLabel('Título del proyecto').fill('Mi proyecto')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect
      .poll(async () => {
        const last = (await emulatorDb.doc(BOARD).get()).get(
          'lastActivityAt',
        ) as Timestamp
        return Date.now() - last.toMillis()
      })
      .toBeLessThan(60_000)
  })
})

test.describe('M7 · storage, backup and purge', () => {
  async function seedImages() {
    const asset = (
      id: string,
      kind: 'cover' | 'slide',
      status: string,
      createdAt: Timestamp,
    ) =>
      emulatorDb.doc(`${BOARD}/assets/${id}`).set({
        publicId: `pbl/dev/${DEMO.boardId}/st_sebastian/${id}`,
        studentId: 'st_sebastian',
        kind,
        width: 100,
        height: 100,
        format: 'webp',
        bytes: 1024 * 1024,
        status,
        createdAt,
      })
    await Promise.all([
      asset('inSlide', 'slide', 'active', daysAgo(3)),
      asset('cover', 'cover', 'active', daysAgo(3)),
      asset('oldCover', 'cover', 'orphaned', daysAgo(5)),
      asset('removed', 'slide', 'active', daysAgo(4)),
      asset('fresh', 'slide', 'active', daysAgo(0)),
    ])
    const ref = (id: string) => ({
      assetId: id,
      publicId: `pbl/dev/${DEMO.boardId}/st_sebastian/${id}`,
      version: 1,
      width: 100,
      height: 100,
      format: 'webp',
    })
    await seedSlides('st_sebastian', [[textElement('Con imagen')]])
    await emulatorDb.doc(`${spacePath('st_sebastian')}/slides/slide1`).update({
      files: { f1: ref('inSlide') },
      assetIds: ['inSlide'],
    })
    await emulatorDb
      .doc(spacePath('st_sebastian'))
      .update({ cover: ref('cover') })
  }

  test('the teacher sees the usage meter and cleans up unused images', async ({
    page,
  }) => {
    await seedImages()
    const fakes = await fakeAdminServices(page, { usagePercent: 75 })
    await openTeacherBoard(page)
    await page.getByRole('button', { name: 'Almacenamiento' }).click()

    await expect(page.getByTestId('usage-meter')).toContainText(
      '18,75 de 25 créditos (75 %)',
    )
    await expect(page.getByText('Más del 70 % del plan gratuito')).toBeVisible()
    // 5 stored (fresh included), 2 unused: the replaced cover and the removed slide image
    await expect(page.getByTestId('storage-report')).toContainText('5 imágenes')
    await expect(page.getByTestId('unused-count')).toContainText('2 imágenes')

    await page
      .getByRole('button', { name: 'Limpiar imágenes sin usar (2)' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(page.getByText('2 imágenes eliminadas')).toBeVisible()
    await expect(page.getByTestId('unused-count')).toContainText('0 imágenes')

    expect(fakes.deleteRequests).toEqual([
      {
        boardId: DEMO.boardId,
        assetIds: expect.arrayContaining(['oldCover', 'removed']),
      },
    ])
    const status = async (id: string) =>
      (await emulatorDb.doc(`${BOARD}/assets/${id}`).get()).get('status')
    expect(await status('oldCover')).toBe('deleted')
    expect(await status('removed')).toBe('deleted')
    expect(await status('inSlide')).toBe('active')
    expect(await status('fresh')).toBe('active')
  })

  test('the storage page says when the Cloudinary key and secret do not match', async ({
    page,
  }) => {
    await fakeAdminServices(page, {
      usageError: 'cloudinary credentials invalid',
    })
    await openTeacherBoard(page)
    await page.getByRole('button', { name: 'Almacenamiento' }).click()
    await expect(page.getByTestId('usage-credentials')).toContainText(
      'Las credenciales de Cloudinary no coinciden',
    )
    await expect(page.getByTestId('usage-meter')).toHaveCount(0)
  })

  test('backup → restore into a new board, with students, cards and slides', async ({
    page,
  }) => {
    await seedImages()
    await fakeAdminServices(page)
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}/storage`)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('button', { name: 'Descargar copia de seguridad' })
        .first()
        .click(),
    ])
    const backup = JSON.parse(await readFile((await download.path())!, 'utf8'))
    expect(backup).toMatchObject({ type: 'pbl.boardBackup', version: 1 })
    expect(backup.students).toHaveLength(DEMO.students.length)

    await page.goto('/teacher')
    await page.getByRole('button', { name: 'Restaurar desde archivo' }).click()
    await page.getByTestId('restore-input').setInputFiles({
      name: 'copia.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    })
    await expect(page.getByTestId('restore-preview')).toContainText(
      `${DEMO.students.length} estudiantes, 1 diapositivas`,
    )
    await page.getByRole('button', { name: 'Crear tablero' }).click()
    await expect(page).toHaveURL(/\/teacher\/boards\/(?!demo-board)[^/]+$/)
    const newId = page.url().split('/').pop()!

    const restored = emulatorDb.doc(`boards/${newId}`)
    expect((await restored.get()).get('title')).toBe(DEMO.boardTitle)
    expect((await restored.collection('students').get()).size).toBe(
      DEMO.students.length,
    )
    const space = await restored.collection('spaces').doc('st_sebastian').get()
    expect(space.data()).toMatchObject({
      title: 'Plataforma para agencias',
      slideCount: 1,
      cover: null,
    })
    const slide = await restored
      .collection('spaces/st_sebastian/slides')
      .doc('slide1')
      .get()
    expect(slide.get('content')).toContain('Con imagen')
    expect(slide.get('assetIds')).toEqual(['inSlide'])
    // Students join the new board again with their email
    expect(
      (
        await restored.collection('studentEmails').doc('laura@gmail.com').get()
      ).get('studentId'),
    ).toBe('st_laura')

    // A wrong file is refused before anything is written
    await page.goto('/teacher')
    await page.getByRole('button', { name: 'Restaurar desde archivo' }).click()
    await page.getByTestId('restore-input').setInputFiles({
      name: 'otro.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"type":"pbl.students","version":1,"students":[]}'),
    })
    await expect(page.getByText('no es una copia de seguridad')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Crear tablero' }),
    ).toBeDisabled()
  })

  test('purge: only archived boards, backup first, type the name', async ({
    page,
  }) => {
    await seedImages()
    const fakes = await fakeAdminServices(page, { purgePages: 2 })
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}/storage`)
    const purge = page.getByTestId('purge-section')
    await expect(purge).toContainText(
      'Solo se pueden purgar tableros archivados',
    )

    await emulatorDb
      .doc(BOARD)
      .update({ status: 'archived', archivedAt: FieldValue.serverTimestamp() })
    const confirm = purge.getByRole('button', {
      name: 'Purgar definitivamente',
    })
    await expect(confirm).toBeDisabled()
    // the name field unlocks only after the backup is downloaded
    await expect(purge.getByRole('textbox')).toBeDisabled()
    await Promise.all([
      page.waitForEvent('download'),
      purge
        .getByRole('button', { name: 'Descargar copia de seguridad' })
        .click(),
    ])
    await purge.getByRole('textbox').fill('Otro nombre')
    await expect(confirm).toBeDisabled()
    await purge.getByRole('textbox').fill(DEMO.boardTitle)
    await confirm.click()

    await expect(page).toHaveURL(/\/teacher$/)
    await expect(
      page.getByText(`«${DEMO.boardTitle}» fue purgado`),
    ).toBeVisible()
    // Cloudinary folder: the Worker was called until it reported "complete"
    expect(fakes.purgeRequests).toEqual([
      { boardId: DEMO.boardId },
      { boardId: DEMO.boardId },
    ])
    // Every Firestore document is gone
    expect((await emulatorDb.doc(BOARD).get()).exists).toBe(false)
    expect(
      (await emulatorDb.doc(`joinCodes/${DEMO.joinCode}`).get()).exists,
    ).toBe(false)
    for (const sub of ['students', 'studentEmails', 'spaces', 'assets'])
      expect((await emulatorDb.collection(`${BOARD}/${sub}`).get()).size).toBe(
        0,
      )
    expect(
      (await emulatorDb.collection(`${spacePath('st_sebastian')}/slides`).get())
        .size,
    ).toBe(0)
  })
})
