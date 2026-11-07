import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { seedSlides, spacePath, textElement } from './slides-fixtures.ts'

// M27: the teacher's comments (project / slide, private / public), a comment never lost when
// moving, save buttons that lock, En progreso / Listo, and the teacher editing the project.

const SEBASTIAN = 'scetina@uni.edu.co'
const ELMA = 'elma@gmail.com'
const spaceUrl = (studentId = 'st_sebastian') =>
  `/b/${DEMO.boardId}/s/${studentId}`

test.beforeEach(async () => {
  await seedDemo()
  await seedSlides('st_sebastian', [
    [textElement('Sebastian uno')],
    [textElement('Sebastian dos')],
  ])
})

async function notesOf(studentId = 'st_sebastian') {
  const snapshot = await emulatorDb
    .collection(`${spacePath(studentId)}/notes`)
    .get()
  return snapshot.docs.map((doc) => doc.data())
}

/** The teacher opens a comment box in the presenter's notes panel and types */
async function typeInPresenter(page: Page, text: string) {
  const panel = page.getByTestId('presenter-notes')
  await panel.getByRole('button', { name: 'Agregar anotación' }).click()
  await panel.getByLabel('Anotación', { exact: true }).fill(text)
  return panel
}

test.describe('M27 · comments never lost', () => {
  test('moving to another slide with an unsaved comment asks: keep writing, save and continue, discard', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}/present/st_sebastian`)
    const counter = page.getByTestId('presenter-counter')
    await expect(counter).toHaveText('1 / 2')
    await page.keyboard.press('n')
    await typeInPresenter(page, 'Buen arranque')
    const next = page.getByRole('button', { name: 'Diapositiva siguiente (→)' })

    // "Seguir escribiendo": stays, the text is still there
    await next.click()
    const ask = page.getByTestId('unsaved-comment')
    await expect(ask).toContainText('Tienes un comentario sin guardar')
    await expect(ask).toContainText('en la diapositiva 1 de Sebastian Cetina')
    await ask.getByRole('button', { name: 'Seguir escribiendo' }).click()
    await expect(ask).toHaveCount(0)
    await expect(counter).toHaveText('1 / 2')
    await expect(page.getByLabel('Anotación', { exact: true })).toHaveValue(
      'Buen arranque',
    )

    // "Guardar y continuar": saved on slide 1, then it moves
    await next.click()
    await ask.getByRole('button', { name: 'Guardar y continuar' }).click()
    await expect(counter).toHaveText('2 / 2')
    await expect
      .poll(async () => (await notesOf()).map((note) => note.text))
      .toEqual(['Buen arranque'])
    expect((await notesOf())[0]).toMatchObject({
      slideId: 'slide1',
      visibility: 'private',
    })

    // "Descartar": moves without saving
    await typeInPresenter(page, 'No lo guardo')
    await page.getByRole('button', { name: 'Diapositiva anterior (←)' }).click()
    await ask.getByRole('button', { name: 'Descartar' }).click()
    await expect(counter).toHaveText('1 / 2')
    expect(await notesOf()).toHaveLength(1)

    // With nothing typed, moving never asks
    await expect(ask).toHaveCount(0)
    await page.keyboard.press('ArrowRight')
    await expect(counter).toHaveText('2 / 2')
    await expect(ask).toHaveCount(0)
  })

  test('leaving the space page with an unsaved comment asks too; a draft comes back', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl())
    const project = page.getByTestId('project-comments')
    await project.getByRole('button', { name: 'Comentar el proyecto' }).click()
    await project
      .getByLabel('Anotación', { exact: true })
      .fill('Falta el prototipo')
    await page.getByRole('link', { name: DEMO.boardTitle }).click()
    const ask = page.getByTestId('unsaved-comment')
    await expect(ask).toContainText('en el proyecto de Sebastian Cetina')
    await ask.getByRole('button', { name: 'Seguir escribiendo' }).click()
    await expect(page).toHaveURL(new RegExp(`${spaceUrl()}$`))

    // A reload keeps the draft on this tab
    page.once('dialog', (dialog) => void dialog.accept())
    await page.reload()
    await expect(page.getByTestId('draft-recovered')).toBeVisible()
    await expect(page.getByLabel('Anotación', { exact: true })).toHaveValue(
      'Falta el prototipo',
    )
  })

  test('a double click on Agregar saves one comment', async ({ page }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl())
    const project = page.getByTestId('project-comments')
    await project.getByRole('button', { name: 'Comentar el proyecto' }).click()
    await project.getByLabel('Anotación', { exact: true }).fill('Una sola vez')
    await project
      .getByRole('button', { name: 'Agregar', exact: true })
      .dblclick()
    await expect(project.getByTestId('note')).toHaveCount(1)
    await page.waitForTimeout(500)
    expect(await notesOf()).toHaveLength(1)
  })
})

test.describe('M27 · public and private comments', () => {
  test('classmates read public comments only; the student sees both with who reads them', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl())
    // A public comment on the project
    const project = page.getByTestId('project-comments')
    await project.getByRole('button', { name: 'Comentar el proyecto' }).click()
    await project
      .getByLabel('Anotación', { exact: true })
      .fill('Gran idea para la clase')
    await project.getByRole('radio', { name: 'Público' }).click()
    await project.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(project.getByTestId('note-visibility')).toHaveText('Público')
    // A private one on slide 1 (the default)
    const slideNotes = page.getByTestId('slide-notes').first()
    await slideNotes.getByRole('button', { name: 'Agregar anotación' }).click()
    await slideNotes
      .getByLabel('Anotación', { exact: true })
      .fill('Solo para ti')
    await slideNotes
      .getByRole('button', { name: 'Agregar', exact: true })
      .click()
    await expect(slideNotes.getByTestId('note-visibility')).toHaveText(
      'Privado',
    )

    // A classmate: the public one only
    await signIn(page, ELMA)
    await page.goto(spaceUrl())
    await expect(page.getByTestId('project-comments')).toContainText(
      'Gran idea para la clase',
    )
    await expect(page.getByText('Solo para ti')).toHaveCount(0)
    await expect(page.getByTestId('note-visibility')).toHaveCount(0)

    // The student: both, with their badges, and "Comentario nuevo" goes away once seen
    await signIn(page, SEBASTIAN)
    await page.goto(spaceUrl())
    await expect(page.getByText('Solo para ti')).toBeVisible()
    await expect(page.getByTestId('note-visibility')).toHaveText([
      'Público',
      'Privado',
    ])
    await expect(
      page.getByRole('button', { name: 'Responder en Mensajes' }).first(),
    ).toBeVisible()
    await expect
      .poll(
        async () =>
          (await emulatorDb.doc(spacePath('st_sebastian')).get()).data()
            ?.teacherCommentsUnseen,
      )
      .toBe(false)
  })
})

test.describe('M27 · En progreso / Listo', () => {
  test('the student marks En progreso, then Listo; the board, Presentaciones and "Presentar listos" follow', async ({
    page,
  }) => {
    await signIn(page, SEBASTIAN)
    await page.goto(spaceUrl())
    await page.getByTestId('wip-toggle').click()
    await expect(page.getByTestId('wip-toggle')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('wip-badge')).toHaveCount(1)

    await page.goto(`/b/${DEMO.boardId}/presentaciones`)
    const mine = page.getByTestId('my-presentation')
    await mine.getByTestId('ready-toggle').click()
    await expect(page.getByTestId('ready-badge')).toHaveCount(1)
    await expect
      .poll(async () =>
        (await emulatorDb.doc(spacePath('st_sebastian')).get()).data(),
      )
      .toMatchObject({
        workStatus: 'ready',
        workStatusBy: 'student',
        readyToPresent: true,
      })

    // The teacher presents only the ready ones, and sees the status
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}/present?ready=1`)
    await expect(page.getByTestId('presenter-student')).toHaveText(
      'Sebastian Cetina',
    )
    await expect(
      page.getByTestId('presenter').getByTestId('ready-badge'),
    ).toBeVisible()
  })
})

test.describe('M27 · the teacher edits the project', () => {
  test('the teacher changes the title; the student restores their version', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl())
    await page.getByRole('button', { name: 'Editar proyecto' }).click()
    const dialog = page.getByRole('dialog')
    await dialog
      .getByLabel('Título del proyecto')
      .fill('Plataforma para agencias de viaje')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Plataforma para agencias de viaje',
    )

    await signIn(page, SEBASTIAN)
    await page.goto(spaceUrl())
    const changes = page.getByTestId('teacher-changes')
    await expect(changes).toContainText('Editado por el docente')
    await changes.getByRole('button', { name: 'Restaurar mi versión' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Plataforma para agencias',
    )
    // undoable
    await expect(
      changes.getByRole('button', { name: 'Volver a la versión del docente' }),
    ).toBeVisible()
  })

  test('the teacher deletes a slide; the student brings it back where it was', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`${spaceUrl()}/edit`)
    await page.getByRole('button', { name: 'Eliminar diapositiva 1' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('podrá restaurarla')
    await confirm.getByRole('button', { name: 'Eliminar' }).click()
    await expect
      .poll(
        async () =>
          (await emulatorDb.doc(spacePath('st_sebastian')).get()).data()
            ?.slideOrder,
      )
      .toEqual(['slide2'])

    await signIn(page, SEBASTIAN)
    await page.goto(spaceUrl())
    const deleted = page.getByTestId('deleted-slide')
    await expect(deleted).toHaveCount(1)
    await deleted.getByRole('button', { name: 'Restaurar' }).click()
    await expect(deleted).toHaveCount(0)
    await expect
      .poll(
        async () =>
          (await emulatorDb.doc(spacePath('st_sebastian')).get()).data()
            ?.slideOrder,
      )
      .toEqual(['slide1', 'slide2'])
  })
})
