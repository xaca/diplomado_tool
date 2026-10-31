import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { seedSlides, spacePath, textElement } from './slides-fixtures.ts'

// M15: the board's teacher edits a student's slides; the student's version is kept and can be
// restored; one editor per slide.

const spaceUrl = `/b/${DEMO.boardId}/s/st_sebastian`

test.beforeEach(async () => {
  await seedDemo()
  await seedSlides('st_sebastian', [
    [textElement('Problema')],
    [textElement('Prototipo')],
  ])
})

/** Text tool → click on the slide → type → leave the text box (as in m5.spec). */
async function writeText(page: Page, text: string) {
  await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible()
  const canvas = page.locator('canvas.excalidraw__canvas.interactive')
  const box = (await canvas.boundingBox())!
  await page.getByTestId('toolbar-text').click({ force: true })
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

async function firstSlide() {
  const space = (await emulatorDb.doc(spacePath('st_sebastian')).get()).data()!
  const id = (space.slideOrder as string[])[0]
  const slide = await emulatorDb
    .doc(`${spacePath('st_sebastian')}/slides/${id}`)
    .get()
  const version = await emulatorDb
    .doc(`${spacePath('st_sebastian')}/slides/${id}/versions/student`)
    .get()
  return { space, slide: slide.data()!, version: version.data() }
}

test.describe("M15 · teacher edits students' slides", () => {
  test('the teacher edits a slide and leaves a note; the student compares and restores', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl)
    await page
      .getByTestId('slides-viewer')
      .locator('li')
      .first()
      .getByRole('button', { name: 'Editar diapositiva' })
      .click()
    await expect(page.getByTestId('teacher-editing')).toContainText(
      'Sebastian Cetina',
    )
    // Reordering, duplicating and deleting stay with the student
    await expect(
      page.getByRole('button', { name: /Eliminar diapositiva/ }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Duplicar/ })).toHaveCount(0)

    await writeText(page, 'Corregido')
    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 15_000,
    })
    await expect
      .poll(async () => (await firstSlide()).slide.lastEditedBy)
      .toBe('teacher')
    const saved = await firstSlide()
    expect(saved.version?.content).toContain('Problema')
    expect(saved.version?.content).not.toContain('Corregido')
    expect(saved.space.teacherEditsUnseen).toBe(true)

    // The optional note
    await page.getByRole('button', { name: 'Dejar una nota' }).click()
    const note = page.getByLabel('Anotación', { exact: true })
    await expect(note).toHaveValue('Hice estos cambios: ')
    await note.press('End')
    await note.type('ortografía del título.')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByTestId('note')).toContainText(
      'ortografía del título',
    )

    // The student: badge on the card, "Editada por el docente", compare, restore, undo
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('teacher-edits-badge')).toBeVisible()
    await page.goto(spaceUrl)
    const first = page.getByTestId('slides-viewer').locator('li').first()
    await expect(first.getByTestId('teacher-edited')).toContainText(
      'Editada por el docente',
    )
    await expect(first.getByTestId('note')).toContainText('ortografía')
    await first.getByRole('button', { name: 'Comparar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Tu versión', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: 'Restaurar mi versión' }).click()
    await expect(page.getByText('Volviste a tu versión')).toBeVisible()
    await expect(first.getByTestId('teacher-edited')).toHaveCount(0)
    await expect
      .poll(async () => (await firstSlide()).slide.content as string)
      .not.toContain('Corregido')
    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(
      page.getByText('Volviste a la versión del docente'),
    ).toBeVisible()
    await expect
      .poll(async () => (await firstSlide()).slide.content as string)
      .toContain('Corregido')
    // Having looked, the card badge is gone
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('teacher-edits-badge')).toHaveCount(0)
  })

  test('the teacher adds a slide at the end of the student’s space', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`${spaceUrl}/edit`)
    await expect(page.getByTestId('teacher-editing')).toBeVisible()
    await page.getByRole('button', { name: 'Nueva' }).click()
    await expect
      .poll(
        async () => ((await firstSlide()).space.slideOrder as string[]).length,
      )
      .toBe(3)
  })

  test('one editor at a time: the teacher waits while the student edits', async ({
    browser,
  }) => {
    const student = await (await browser.newContext()).newPage()
    await signIn(student, 'scetina@uni.edu.co')
    await student.goto(`${spaceUrl}/edit`)
    await expect(student.locator('.excalidraw .App-toolbar')).toBeVisible()

    const teacher = await (await browser.newContext()).newPage()
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(`${spaceUrl}/edit`)
    await expect(teacher.getByTestId('slide-locked')).toContainText(
      'Sebastian Cetina está editando esta diapositiva',
    )
    await expect(teacher.locator('.excalidraw .App-toolbar')).toHaveCount(0)

    // The student leaves the editor (in-app navigation releases the lock; a closed tab's lock
    // expires after 60 s): the slide is free for the teacher
    await student.getByRole('link', { name: DEMO.boardTitle }).click()
    await expect(student).toHaveURL(new RegExp(`/b/${DEMO.boardId}$`))
    await expect(teacher.locator('.excalidraw .App-toolbar')).toBeVisible({
      timeout: 15_000,
    })
  })
})
