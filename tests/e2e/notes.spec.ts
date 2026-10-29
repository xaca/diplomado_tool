import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { seedSlides, spacePath, textElement } from './slides-fixtures.ts'

// The teacher's annotations on a student's slides: private to the teacher and the owner.

const viewerUrl = (studentId: string) => `/b/${DEMO.boardId}/s/${studentId}`

test.beforeEach(async () => {
  await seedDemo()
  await seedSlides('st_sebastian', [
    [textElement('Problema')],
    [textElement('Prototipo')],
  ])
})

test.describe("Teacher's notes", () => {
  test('the teacher annotates a slide; the student reads it in the viewer and the editor', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(viewerUrl('st_sebastian'))
    const firstSlide = page.getByTestId('slides-viewer').locator('li').first()
    await firstSlide.getByRole('button', { name: 'Agregar anotación' }).click()
    await firstSlide
      .getByLabel('Anotación')
      .fill('Muy claro. Agrega de dónde sale la cifra.')
    await firstSlide
      .getByRole('button', { name: 'Agregar', exact: true })
      .click()
    await expect(firstSlide.getByTestId('note')).toContainText(
      'de dónde sale la cifra',
    )

    // Edit it
    await firstSlide.getByRole('button', { name: 'Editar anotación' }).click()
    await firstSlide
      .getByLabel('Anotación')
      .fill('Agrega la fuente de la cifra.')
    await firstSlide.getByRole('button', { name: 'Guardar' }).click()
    await expect(firstSlide.getByTestId('note')).toHaveText(
      /Agrega la fuente de la cifra\./,
    )
    // The second slide has none
    await expect(
      page
        .getByTestId('slides-viewer')
        .locator('li')
        .nth(1)
        .getByTestId('note'),
    ).toHaveCount(0)

    // The student sees it read-only
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(viewerUrl('st_sebastian'))
    const note = page.getByTestId('note')
    await expect(note).toHaveCount(1)
    await expect(note).toContainText('Agrega la fuente de la cifra.')
    await expect(
      page.getByRole('button', { name: 'Agregar anotación' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Editar anotación' }),
    ).toHaveCount(0)

    // …and next to the slide in the editor
    await page.goto(`${viewerUrl('st_sebastian')}/edit`)
    await expect(
      page.getByRole('button', { name: '1 anotación' }),
    ).toBeVisible()
    await expect(page.getByTestId('slide-notes')).toContainText(
      'Agrega la fuente de la cifra.',
    )

    // Deleting the slide deletes its notes
    await page.getByRole('button', { name: 'Eliminar diapositiva 1' }).click()
    await expect(
      page.getByText(
        'Las anotaciones del docente sobre ella también se eliminan.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(page.getByTestId('slide-item')).toHaveCount(1)
    await expect
      .poll(
        async () =>
          (
            await emulatorDb
              .collection(`${spacePath('st_sebastian')}/notes`)
              .get()
          ).size,
      )
      .toBe(0)
  })

  test('classmates never see the notes', async ({ page }) => {
    await emulatorDb.collection(`${spacePath('st_sebastian')}/notes`).add({
      slideId: 'slide1',
      text: 'Nota privada',
      authorEmail: DEMO.teacher,
      authorName: 'Docente Demo',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await signIn(page, 'laura@gmail.com')
    await page.goto(viewerUrl('st_sebastian'))
    await expect(
      page.getByTestId('slides-viewer').getByTestId('slide-preview'),
    ).toHaveCount(2)
    await expect(page.getByTestId('slide-notes')).toHaveCount(0)
    await expect(page.getByText('Nota privada')).toHaveCount(0)
  })
})
