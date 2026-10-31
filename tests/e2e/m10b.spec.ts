import { expect, test, type Browser, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// M10b: the teacher designs class slides with Excalidraw; students react to the slide and add
// notes on top of the drawing while the class is open.

const classUrl = `/b/${DEMO.boardId}/class/c1`
const classDoc = () => emulatorDb.doc(`boards/${DEMO.boardId}/classes/c1`)
const slideDoc = () => classDoc().collection('slides').doc('s1')

async function newPage(browser: Browser, email: string) {
  const page: Page = await (await browser.newContext()).newPage()
  await signIn(page, email)
  return page
}

async function seedClass(status: 'open' | 'closed' = 'open') {
  const now = new Date()
  await classDoc().set({
    title: 'Clase 5',
    date: '2026-11-19',
    status,
    slideOrder: ['s1'],
    follow: false,
    liveSlideId: null,
    createdAt: now,
    updatedAt: now,
  })
  await slideDoc().set({
    title: '',
    instructions: '',
    layout: 'free',
    zones: [],
    locked: false,
    reactions: {},
    createdAt: now,
    updatedAt: now,
  })
}

/** Text tool → click on the slide → type → leave the text box (as in the slide editor tests). */
async function writeText(page: Page, text: string) {
  const canvas = page.locator('canvas.excalidraw__canvas.interactive')
  const box = (await canvas.boundingBox())!
  await page.getByTestId('toolbar-text').click({ force: true })
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M10b · drawn class slides', () => {
  test('the teacher draws the slide; a student sees the drawing live under the notes and can’t open the designer', async ({
    page,
    browser,
  }) => {
    await seedClass()
    const laura = await newPage(browser, 'laura@gmail.com')
    await laura.goto(classUrl)
    await expect(laura.getByTestId('wall')).toBeVisible()
    await expect(laura.getByRole('button', { name: 'Diseñar' })).toHaveCount(0)

    await signIn(page, DEMO.teacher)
    await page.goto(classUrl)
    await page.getByRole('button', { name: 'Diseñar' }).click()
    await expect(page.getByTestId('class-design')).toBeVisible()
    await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible({
      timeout: 15_000,
    })
    await writeText(page, '¿Qué aprendiste?')
    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 15_000,
    })
    expect((await slideDoc().get()).data()?.content).toContain(
      '¿Qué aprendiste?',
    )
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(
      page.getByTestId('wall').getByTestId('slide-preview'),
    ).toContainText('¿Qué aprendiste?')

    // Live for the student, with notes on top of the drawing
    await expect(
      laura.getByTestId('wall').getByTestId('slide-preview'),
    ).toContainText('¿Qué aprendiste?')
    await laura.getByRole('button', { name: 'Agregar nota' }).click()
    await laura.getByLabel('Texto de la nota').fill('Escuchar más')
    await laura.getByRole('button', { name: 'Guardar' }).click()
    await expect(
      page.getByTestId('sticky-note').filter({ hasText: 'Escuchar más' }),
    ).toBeVisible()

    // Students can't open the designer by its address either
    await laura.goto(`${classUrl}/s/s1/design`)
    await expect(laura.getByTestId('class-design')).toHaveCount(0)
  })

  test('students react to the slide while the class is open; the teacher sees the counts; closed = no reactions', async ({
    page,
    browser,
  }) => {
    await seedClass()
    const laura = await newPage(browser, 'laura@gmail.com')
    await laura.goto(classUrl)
    const bar = laura.getByTestId('slide-reactions')
    await bar
      .getByRole('button', { name: 'Reaccionar a la diapositiva' })
      .click()
    await laura.getByRole('menuitem', { name: 'Reaccionar con 🎉' }).click()
    await expect(bar.getByTestId('reaction')).toHaveText('🎉1')

    await signIn(page, DEMO.teacher)
    await page.goto(classUrl)
    await expect(
      page.getByTestId('slide-reactions').getByTestId('reaction'),
    ).toHaveText('🎉1')
    // the teacher reads the counts (no picker for the teacher)
    await expect(
      page
        .getByTestId('slide-reactions')
        .getByRole('button', { name: 'Reaccionar a la diapositiva' }),
    ).toHaveCount(0)
    // "Llevar a todos a mi diapositiva" is explained under the switch
    await expect(page.getByTestId('teacher-bar')).toContainText(
      'Llevar a todos a mi diapositiva',
    )

    // Tapping again removes it; a closed class takes the picker away
    await bar.getByTestId('reaction').click()
    await expect(bar.getByTestId('reaction')).toHaveCount(0)
    await classDoc().update({ status: 'closed' })
    await expect(
      bar.getByRole('button', { name: 'Reaccionar a la diapositiva' }),
    ).toHaveCount(0)
  })
})
