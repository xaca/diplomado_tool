import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorAuth, emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { spacePath } from './slides-fixtures.ts'

// M20: encouraging messages (once-only milestones, confetti, the switch) and small animations.

const editorUrl = (studentId: string) =>
  `/b/${DEMO.boardId}/s/${studentId}/edit`
const spaceUrl = (studentId: string) => `/b/${DEMO.boardId}/s/${studentId}`

const cheerToast = (page: Page) => page.locator('.cheer-toast')
const confetti = (page: Page) => page.getByTestId('confetti')

async function milestones(email: string) {
  const { uid } = await emulatorAuth.getUserByEmail(email)
  return (await emulatorDb.doc(`users/${uid}`).get()).data()?.milestones
}

async function createFirstSlide(page: Page) {
  await page
    .getByRole('button', { name: 'Crear la primera diapositiva' })
    .click()
  await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible({
    timeout: 15_000,
  })
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M20 · encouraging messages', () => {
  test('the first slide is celebrated once (message + confetti); marking the slides ready cheers too', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto(editorUrl('st_laura'))
    await createFirstSlide(page)

    await expect(cheerToast(page)).toContainText(
      /Primera diapositiva|primera diapositiva/,
    )
    await expect(confetti(page)).toHaveCount(1)
    await expect(confetti(page)).toHaveCount(0, { timeout: 5_000 })
    await expect
      .poll(() => milestones('laura@gmail.com'))
      .toEqual({ firstSlide: true })
    await expect(page.getByTestId('slide-item').first()).toHaveClass(/slide-in/)

    // Delete it (it shrinks away) and start again: no second "first slide"
    await page.getByRole('button', { name: 'Eliminar diapositiva 1' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(page.getByTestId('slide-item')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Crear la primera diapositiva' })
      .click()
    await expect(page.getByTestId('slide-item')).toHaveCount(1)
    await expect(cheerToast(page)).toHaveCount(0)

    // Ready: a cheer instead of the plain toast (no confetti: one burst every 30 s)
    await page.getByTestId('ready-toggle').click()
    await expect(cheerToast(page)).toContainText(/list|Lo lograste|presentar/i)
    await expect(page.getByText('Marcaste tu proyecto «Listo»')).toHaveCount(0)
    await expect(page.getByTestId('ready-toggle').locator('svg')).toHaveClass(
      /check-draw/,
    )
    await expect(confetti(page)).toHaveCount(0)
  })

  test('"Mensajes de ánimo" off on /me: only the plain messages', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto('/me')
    const toggle = page.getByTestId('cheer-switch')
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    const { uid } = await emulatorAuth.getUserByEmail('laura@gmail.com')
    await expect
      .poll(
        async () => (await emulatorDb.doc(`users/${uid}`).get()).data()?.cheer,
      )
      .toBe(false)

    await page.goto(editorUrl('st_laura'))
    await createFirstSlide(page)
    await page.getByTestId('ready-toggle').click()
    await expect(page.getByText('Marcaste tu proyecto «Listo»')).toBeVisible()
    await expect(cheerToast(page)).toHaveCount(0)
    await expect(confetti(page)).toHaveCount(0)
    expect(await milestones('laura@gmail.com')).toBeUndefined()
  })

  test('with "reduce motion": the message, but no confetti', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await signIn(page, 'laura@gmail.com')
    await page.goto(editorUrl('st_laura'))
    await createFirstSlide(page)
    await expect(cheerToast(page)).toBeVisible()
    await page.waitForTimeout(500)
    await expect(confetti(page)).toHaveCount(0)
  })

  test("a new note from the teacher: announced live, or on the student's next visit; never twice; teachers get no messages", async ({
    page,
  }) => {
    const note = (text: string) =>
      emulatorDb.collection(`${spacePath('st_sebastian')}/notes`).add({
        slideId: 'slide1',
        text,
        authorEmail: DEMO.teacher,
        authorName: 'Docente Demo',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(spaceUrl('st_sebastian'))
    await expect(page.getByTestId('ready-toggle')).toBeVisible()
    // First visit: only remembers what's there
    await page.waitForTimeout(500)
    await expect(cheerToast(page)).toHaveCount(0)

    // While I'm looking
    await note('Revisa el problema')
    await expect(cheerToast(page)).toContainText(/nota/i)

    // While I'm away: on my next visit
    await page.goto('/')
    await note('Y el prototipo')
    await page.goto(spaceUrl('st_sebastian'))
    await expect(cheerToast(page)).toContainText(/nota/i)

    // Nothing new: nothing said
    await page.reload()
    await expect(page.getByTestId('ready-toggle')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(cheerToast(page)).toHaveCount(0)

    // Teachers never get these messages
    await signIn(page, DEMO.teacher)
    await page.goto(spaceUrl('st_sebastian'))
    await expect(page.getByText('Plataforma para agencias')).toBeVisible()
    await page.waitForTimeout(500)
    await expect(cheerToast(page)).toHaveCount(0)
  })
})
