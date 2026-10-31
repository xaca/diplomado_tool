import { expect, test, type Browser, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorAuth, emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// M10: class participation — the sticky-note wall (notes, reactions, live, teacher controls).

const classesUrl = `/b/${DEMO.boardId}/class`
const classDoc = (id = 'c1') =>
  emulatorDb.doc(`boards/${DEMO.boardId}/classes/${id}`)
const notesOf = (slideId: string, classId = 'c1') =>
  classDoc(classId).collection('slides').doc(slideId).collection('notes')

async function newPage(browser: Browser, email: string) {
  const page: Page = await (await browser.newContext()).newPage()
  await signIn(page, email)
  return page
}

/** Class c1 (open) with slide s1 (2 columns) and slide s2 (free) */
async function seedClass(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  await classDoc().set({
    title: 'Clase 3: entrevistas',
    date: '2026-11-12',
    status: 'open',
    slideOrder: ['s1', 's2'],
    follow: false,
    liveSlideId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
  const slide = (id: string, data: Record<string, unknown>) =>
    classDoc()
      .collection('slides')
      .doc(id)
      .set({
        instructions: '',
        locked: false,
        createdAt: now,
        updatedAt: now,
        ...data,
      })
  await slide('s1', {
    title: '¿Cómo fue la prueba?',
    layout: 'columns2',
    zones: ['Funcionó', 'Mejorar'],
  })
  await slide('s2', {
    title: 'Una palabra para hoy',
    layout: 'free',
    zones: [],
  })
}

async function addNote(page: Page, text: string) {
  await page.getByRole('button', { name: 'Agregar nota' }).click()
  const dialog = page.getByTestId('note-dialog')
  await dialog.getByLabel('Texto de la nota').fill(text)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toHaveCount(0)
}

const note = (page: Page, text: string) =>
  page.getByTestId('sticky-note').filter({ hasText: text })

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M10 · class participation', () => {
  test('the teacher creates a class, sets a 2-column prompt and opens it; Tarjetas stays as it was', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    // Tarjetas: the cards are still there, plus a "Clases" button
    await expect(page.getByTestId('space-card').first()).toBeVisible()
    // (a link styled as a button)
    await page.getByRole('button', { name: 'Clases' }).click()
    await expect(page).toHaveURL(new RegExp(`${classesUrl}$`))

    await page.getByRole('button', { name: 'Nueva clase' }).click()
    const dialog = page.getByTestId('class-dialog')
    await dialog.getByLabel('Título de la clase').fill('Clase 4: prototipos')
    await dialog
      .getByLabel('Consigna de la primera diapositiva')
      .fill('¿Qué probaste?')
    await dialog.getByRole('button', { name: 'Crear clase' }).click()

    await expect(page.getByTestId('prompt')).toHaveText('¿Qué probaste?')
    await expect(page.getByTestId('class-status')).toHaveText('Cerrada')

    await page.getByRole('button', { name: 'Consigna' }).click()
    const prompt = page.getByTestId('prompt-dialog')
    await prompt.getByRole('radio', { name: '2 columnas' }).click()
    await prompt.getByLabel('Título 1').fill('Funcionó')
    await prompt.getByLabel('Título 2').fill('Mejorar')
    await prompt.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByTestId('zone-title')).toHaveText([
      'Funcionó',
      'Mejorar',
    ])

    await page.getByRole('button', { name: 'Abrir clase' }).click()
    await expect(page.getByTestId('class-status')).toHaveText('Abierta')

    await page.getByRole('link', { name: 'Clases' }).first().click()
    await expect(page.getByTestId('class-card')).toContainText(
      'Clase 4: prototipos',
    )
  })

  test('two students add notes and react live; a classmate’s note can’t be moved or edited; my own drags and saves', async ({
    page,
    browser,
  }) => {
    await seedClass()
    await signIn(page, 'laura@gmail.com')
    const elma = await newPage(browser, 'elma@gmail.com')
    await page.goto(`${classesUrl}/c1`)
    await elma.goto(`${classesUrl}/c1`)

    await addNote(page, 'Entendían el menú')
    // live on Elma's screen, with Laura's name
    await expect(note(elma, 'Entendían el menú')).toContainText('Laura')
    // the first note is cheered (M20)
    await expect(page.locator('.cheer-toast')).toBeVisible()

    // Elma reacts; Laura sees the count
    await note(elma, 'Entendían el menú').getByTestId('react').click()
    await elma.getByRole('menuitem', { name: 'Reaccionar con 💡' }).click()
    await expect(
      note(page, 'Entendían el menú').getByTestId('reaction'),
    ).toHaveText('💡1')
    // no reactions on your own note
    await expect(
      note(page, 'Entendían el menú').getByTestId('react'),
    ).toHaveCount(0)

    // Elma can't open (edit) or drag Laura's note
    await expect(note(elma, 'Entendían el menú')).toHaveAttribute(
      'role',
      'note',
    )
    const before = (await notesOf('s1').get()).docs[0].data()
    const box = (await note(elma, 'Entendían el menú').boundingBox())!
    await elma.mouse.move(box.x + 20, box.y + 20)
    await elma.mouse.down()
    await elma.mouse.move(box.x + 220, box.y + 120, { steps: 5 })
    await elma.mouse.up()
    await elma.waitForTimeout(300)
    expect((await notesOf('s1').get()).docs[0].data().x).toBe(before.x)

    // Laura drags her own note: the new place is saved and Elma sees it
    const mine = (await note(page, 'Entendían el menú').boundingBox())!
    await page.mouse.move(mine.x + 20, mine.y + 20)
    await page.mouse.down()
    await page.mouse.move(mine.x + 320, mine.y + 140, { steps: 8 })
    await page.mouse.up()
    await expect
      .poll(async () => (await notesOf('s1').get()).docs[0].data().x)
      .toBeGreaterThan(before.x + 0.1)

    // Laura edits her note by clicking it
    await note(page, 'Entendían el menú').click()
    await page.getByLabel('Texto de la nota').fill('Entendían todo el menú')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(note(elma, 'Entendían todo el menú')).toBeVisible()
  })

  test('the teacher edits, moves and deletes any note; tidy up; the list view', async ({
    page,
  }) => {
    await seedClass()
    const { uid } = await emulatorAuth
      .getUserByEmail('laura@gmail.com')
      .catch(() => ({ uid: 'laura' }))
    const now = new Date()
    await notesOf('s1').doc(`${uid}_1`).set({
      text: 'Nota de Laura',
      color: 'pink',
      x: 0.7,
      y: 0.6,
      authorUid: uid,
      authorStudentId: 'st_laura',
      authorName: 'Laura Nataly',
      authorRole: 'student',
      reactions: {},
      editedByTeacher: false,
      createdAt: now,
      updatedAt: now,
    })
    await signIn(page, DEMO.teacher)
    await page.goto(`${classesUrl}/c1`)

    await note(page, 'Nota de Laura').click()
    await page.getByLabel('Texto de la nota').fill('Nota de Laura (corregida)')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(note(page, 'Nota de Laura (corregida)')).toBeVisible()
    await expect
      .poll(
        async () =>
          (await notesOf('s1').doc(`${uid}_1`).get()).data()?.editedByTeacher,
      )
      .toBe(true)

    // "Ordenar": the note goes to the top of its column
    await page.getByRole('button', { name: 'Ordenar' }).click()
    await expect
      .poll(async () => (await notesOf('s1').doc(`${uid}_1`).get()).data()?.y)
      .toBeLessThan(0.2)

    // The list view shows the same note; delete it from there
    await page.getByRole('radio', { name: 'Lista' }).click()
    await expect(page.getByTestId('note-list')).toContainText('Laura Nataly')
    await page.getByRole('button', { name: 'Editar nota' }).click()
    await page.getByRole('button', { name: 'Eliminar nota' }).click()
    await expect(page.getByTestId('sticky-note')).toHaveCount(0)
  })

  test('closed class, locked slide, archived board: students only read', async ({
    page,
  }) => {
    await seedClass({ status: 'closed' })
    await signIn(page, 'laura@gmail.com')
    await page.goto(`${classesUrl}/c1`)
    await expect(page.getByTestId('class-notice')).toContainText(
      'La clase está cerrada',
    )
    await expect(
      page.getByRole('button', { name: 'Agregar nota' }),
    ).toHaveCount(0)

    // The teacher opens it: Laura can write, live
    await classDoc().update({ status: 'open' })
    await expect(
      page.getByRole('button', { name: 'Agregar nota' }),
    ).toBeVisible()

    // A locked slide
    await classDoc().collection('slides').doc('s1').update({ locked: true })
    await expect(page.getByTestId('class-notice')).toContainText('bloqueó')
    await expect(
      page.getByRole('button', { name: 'Agregar nota' }),
    ).toHaveCount(0)

    // An archived board
    await classDoc().collection('slides').doc('s1').update({ locked: false })
    await emulatorDb
      .doc(`boards/${DEMO.boardId}`)
      .update({ status: 'archived' })
    await page.reload()
    await expect(page.getByTestId('class-notice')).toContainText('solo lectura')
  })

  test('"Seguir al docente": the student’s screen follows the teacher’s slide; the presenter view', async ({
    page,
    browser,
  }) => {
    await seedClass()
    await signIn(page, DEMO.teacher)
    const laura = await newPage(browser, 'laura@gmail.com')
    await laura.goto(`${classesUrl}/c1`)
    await expect(laura.getByTestId('prompt')).toHaveText('¿Cómo fue la prueba?')

    await page.goto(`${classesUrl}/c1`)
    await page.getByRole('tab', { name: 'Diapositiva 2' }).click()
    await page.getByTestId('follow-switch').click()
    await expect(laura.getByTestId('prompt')).toHaveText('Una palabra para hoy')
    await expect(laura.getByTestId('following')).toContainText(
      'Siguiendo al docente',
    )

    // Laura looks at another slide, then comes back
    await laura.getByRole('tab', { name: 'Diapositiva 1' }).click()
    await expect(laura.getByTestId('prompt')).toHaveText('¿Cómo fue la prueba?')
    await laura.getByRole('button', { name: 'Volver con el docente' }).click()
    await expect(laura.getByTestId('prompt')).toHaveText('Una palabra para hoy')

    // Presenting moves everyone along
    await page.getByRole('button', { name: 'Presentar' }).click()
    await expect(page.getByTestId('class-present')).toContainText(
      'Una palabra para hoy',
    )
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('class-present')).toContainText(
      '¿Cómo fue la prueba?',
    )
    await expect(laura.getByTestId('prompt')).toHaveText('¿Cómo fue la prueba?')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(new RegExp(`${classesUrl}/c1$`))
  })
})
