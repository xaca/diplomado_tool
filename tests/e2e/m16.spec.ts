import { expect, test, type Page } from '@playwright/test'
import { Timestamp } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { seedSlides, textElement } from './slides-fixtures.ts'

// M16: class clock / focus view, break with Lottie, polls, ready to present.

const boardUrl = `/b/${DEMO.boardId}`

test.beforeEach(async () => {
  await seedDemo()
})

async function setClock(clock: Record<string, unknown> | null) {
  await emulatorDb.doc(`boards/${DEMO.boardId}`).update({ clock })
}

async function newPage(
  browser: import('@playwright/test').Browser,
  email: string,
) {
  const page: Page = await (await browser.newContext()).newPage()
  await signIn(page, email)
  return page
}

test.describe('M16 · class clock', () => {
  test('the teacher starts a timed activity; a student sees it live in the editor; pause, +1 min, stop', async ({
    page,
    browser,
  }) => {
    await seedSlides('st_sebastian', [[textElement('Hola')]])
    const student = await newPage(browser, 'scetina@uni.edu.co')
    await student.goto(`${boardUrl}/s/st_sebastian/edit`)
    await expect(student.getByTestId('clock-banner')).toHaveCount(0)

    await signIn(page, DEMO.teacher)
    await page.goto(boardUrl)
    await page.getByRole('button', { name: 'Reloj' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nombre de la actividad').fill('Lluvia de ideas')
    await dialog.getByRole('button', { name: '5', exact: true }).click()
    await dialog.getByRole('button', { name: 'Iniciar' }).click()
    await expect(page.getByTestId('clock-banner')).toContainText(
      'Lluvia de ideas',
    )

    const banner = student.getByTestId('clock-banner')
    await expect(banner).toContainText('Lluvia de ideas')
    await expect(banner.getByTestId('clock-time')).toHaveText(/^[45]:\d\d$/)

    // Pause → the student sees "En pausa"
    await page.getByRole('button', { name: 'Reloj' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Pausar' })
      .click()
    await expect(banner).toContainText('En pausa')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '+1 min' })
      .click()
    await expect(banner.getByTestId('clock-time')).toHaveText(/^[56]:\d\d$/)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Terminar' })
      .click()
    await expect(banner).toHaveCount(0)
  })

  test('"¡Tiempo!" at zero, then the clock closes; students can\'t start the clock', async ({
    page,
  }) => {
    await setClock({
      mode: 'activity',
      label: 'Prototipo rápido',
      instructions: '',
      durationMs: 60_000,
      // Ended 3 s ago: "¡Tiempo!" for a moment, closed 15 s after the end
      startedAt: Timestamp.fromMillis(Date.now() - 63_000),
      elapsedBeforeMs: 0,
      paused: false,
    })
    await signIn(page, 'elma@gmail.com')
    await page.goto(boardUrl)
    await expect(page.getByTestId('clock-banner')).toHaveAttribute(
      'data-status',
      'ended',
    )
    await expect(page.getByTestId('clock-time')).toHaveText('¡Tiempo!')
    await expect(page.getByRole('button', { name: 'Reloj' })).toHaveCount(0)
    await expect(page.getByTestId('clock-banner')).toHaveCount(0, {
      timeout: 20_000,
    })
  })

  test('focus view for the projector, and the break screen with a Lottie animation', async ({
    page,
  }) => {
    await setClock({
      mode: 'activity',
      label: 'Lluvia de ideas',
      instructions: 'Escribe 3 ideas por persona',
      durationMs: 600_000,
      startedAt: Timestamp.now(),
      elapsedBeforeMs: 0,
      paused: false,
    })
    await signIn(page, DEMO.teacher)
    await page.goto(`${boardUrl}/focus`)
    const focus = page.getByTestId('focus-view')
    await expect(focus).toHaveAttribute('data-mode', 'activity')
    await expect(focus).toContainText('Escribe 3 ideas por persona')
    await expect(page.getByTestId('focus-time')).toHaveText(/^(10|9):\d\d$/)

    await setClock({
      mode: 'break',
      label: '',
      instructions: '',
      durationMs: 300_000,
      startedAt: Timestamp.now(),
      elapsedBeforeMs: 0,
      paused: false,
    })
    await expect(focus).toHaveAttribute('data-mode', 'break')
    const animation = page.getByTestId('break-animation')
    await expect(animation).not.toHaveAttribute('data-animation', '')
    await expect(animation.locator('svg')).toHaveCount(1)
    // …and a funny one beside it
    const fun = page.getByTestId('break-fun')
    await expect(fun).not.toHaveAttribute('data-animation', '')
    await expect(fun.locator('svg')).toHaveCount(1)
  })

  test('the focus view goes back to the board when the clock closes', async ({
    page,
  }) => {
    await setClock({
      mode: 'break',
      label: '',
      instructions: '',
      durationMs: 60_000,
      startedAt: Timestamp.fromMillis(Date.now() - 62_000),
      elapsedBeforeMs: 0,
      paused: false,
    })
    await signIn(page, DEMO.teacher)
    await page.goto(`${boardUrl}/focus`)
    await expect(page.getByTestId('focus-time')).toHaveText('¡Volvemos!')
    // The teacher's device clears it and the projector returns to the board
    await expect(page).toHaveURL(new RegExp(`${boardUrl}$`), {
      timeout: 20_000,
    })
    await expect
      .poll(async () =>
        (await emulatorDb.doc(`boards/${DEMO.boardId}`).get()).get('clock'),
      )
      .toBeNull()
  })
})

test.describe('M16 · polls and ready to present', () => {
  test('a student creates a poll; a classmate votes and changes it; the author sees who voted; the teacher closes it', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`${boardUrl}/s/st_sebastian`)
    await page.getByRole('button', { name: 'Crear encuesta' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Pregunta').fill('¿Qué idea desarrollo?')
    await dialog.getByLabel('Opción 1').fill('Agencias')
    await dialog.getByLabel('Opción 2').fill('Mascotas')
    await dialog.getByRole('button', { name: 'Crear encuesta' }).click()
    await expect(page.getByText('Encuesta creada')).toBeVisible()

    const elma = await newPage(browser, 'elma@gmail.com')
    await elma.goto(`${boardUrl}/s/st_sebastian`)
    const poll = elma.getByTestId('poll')
    await poll.getByRole('button', { name: /Mascotas/ }).click()
    await expect(poll.getByRole('button', { name: /Mascotas/ })).toContainText(
      '1 · 100%',
    )
    await poll.getByRole('button', { name: /Agencias/ }).click()
    await expect(poll.getByRole('button', { name: /Agencias/ })).toContainText(
      '1 · 100%',
    )
    await expect(poll.getByRole('button', { name: /Mascotas/ })).toContainText(
      '0 · 0%',
    )

    // The author sees results live and who voted
    const mine = page.getByTestId('poll')
    await expect(mine).toContainText('1 voto')
    await mine.getByRole('button', { name: 'Quién votó' }).click()
    await expect(mine.getByTestId('poll-voters')).toContainText(
      'Elma → Agencias',
    )

    // The teacher closes it: no more votes
    const teacher = await newPage(browser, DEMO.teacher)
    await teacher.goto(`${boardUrl}/s/st_sebastian`)
    await teacher
      .getByTestId('poll')
      .getByRole('button', { name: 'Cerrar' })
      .click()
    await expect(poll).toContainText('Cerrada')
    await expect(poll.getByRole('button', { name: /Mascotas/ })).toBeDisabled()
  })

  test('"Mis diapositivas están listas" → teacher filter → "Presentar listos"', async ({
    page,
    browser,
  }) => {
    await seedSlides('st_sebastian', [[textElement('Lista')]])
    await seedSlides('st_elma', [[textElement('Aún no')]])
    const sebastian = await newPage(browser, 'scetina@uni.edu.co')
    await sebastian.goto(`${boardUrl}/s/st_sebastian`)
    await sebastian.getByTestId('ready-toggle').click()
    await expect(
      sebastian.getByText('Marcaste tus diapositivas como listas'),
    ).toBeVisible()

    await signIn(page, DEMO.teacher)
    await page.goto(boardUrl)
    // "Avance: Todos ▾" opens the counts
    await page.getByTestId('ready-filters').click()
    const menu = page.getByRole('menu')
    await expect(
      menu.getByRole('menuitemradio', { name: /Listos\s*1/ }),
    ).toBeVisible()
    await expect(
      menu.getByRole('menuitemradio', { name: /Con diapositivas\s*2/ }),
    ).toBeVisible()
    await menu.getByRole('menuitemradio', { name: /Listos/ }).click()
    await expect(page.getByTestId('space-card')).toHaveCount(1)
    await expect(page.getByTestId('ready-badge')).toHaveCount(1)

    await page.getByRole('button', { name: 'Presentar listos' }).click()
    await expect(page.getByTestId('presenter-student')).toHaveText(
      'Sebastian Cetina',
    )
    await expect(
      page.getByRole('button', { name: /Siguiente estudiante/ }),
    ).toHaveCount(0)
  })
})
