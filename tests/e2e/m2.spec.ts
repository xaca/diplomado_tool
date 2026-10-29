import { expect, test } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn, signInAt } from './helpers.ts'

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M1 · login and roles', () => {
  test('the teacher lands on the teacher dashboard and sees the demo board', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await expect(page).toHaveURL(/\/teacher$/)
    await expect(
      page.getByRole('heading', { name: 'Panel docente' }),
    ).toBeVisible()
    await expect(page.getByText(DEMO.boardTitle)).toBeVisible()
  })

  test('someone not on any list lands on "Mis tableros" with no boards', async ({
    page,
  }) => {
    await signIn(page, 'nobody@gmail.com')
    await expect(
      page.getByRole('heading', { name: 'Mis tableros' }),
    ).toBeVisible()
    await expect(
      page.getByText('Todavía no estás en ningún tablero'),
    ).toBeVisible()
  })

  test('a student cannot open the teacher area', async ({ page }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto('/teacher')
    await expect(
      page.getByRole('heading', { name: 'Mis tableros' }),
    ).toBeVisible()
  })
})

test.describe('M2 · boards, students and joining', () => {
  test('teacher creates a board and imports students (one with two emails)', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.getByRole('button', { name: 'Nuevo tablero' }).click()
    await page.getByLabel('Título').fill('Proyecto E2E')
    await page.getByRole('button', { name: 'Crear tablero' }).click()

    await expect(
      page.getByRole('heading', { name: 'Proyecto E2E' }),
    ).toBeVisible()
    await expect(page.getByTestId('invite-url')).toHaveValue(
      /\/join\/[A-Z2-9]{6}$/,
    )

    await page.getByRole('button', { name: 'Importar' }).click()
    await page
      .getByLabel('Lista rápida: nombre; correo; correo')
      .fill(
        'Ana Torres; ana@gmail.com; atorres@uni.edu.co\nPedro; pedro@gmail.com\nMal; no-es-correo',
      )
    await expect(page.getByTestId('import-summary')).toContainText('2 nuevos')
    await expect(page.getByTestId('import-summary')).toContainText(
      '1 inválidos',
    )
    await page.getByRole('button', { name: 'Importar 2' }).click()

    await expect(page.getByTestId('student-row')).toHaveCount(2)
    await expect(
      page.getByTestId('student-row').filter({ hasText: 'Ana Torres' }),
    ).toContainText('atorres@uni.edu.co')
  })

  test('an imported student joins automatically with their SECOND email and sees the board', async ({
    page,
  }) => {
    await signIn(page, 'lnataly@uni.edu.co')
    await expect(page.getByTestId('my-boards')).toContainText(DEMO.boardTitle)
    await page.getByText(DEMO.boardTitle).click()
    await expect(page.getByTestId('board-title')).toHaveText(DEMO.boardTitle)
  })

  test('the teacher sees who already joined', async ({ browser }) => {
    const student = await browser.newPage()
    await signIn(student, 'laura@gmail.com')
    await expect(student.getByTestId('my-boards')).toContainText(
      DEMO.boardTitle,
    )
    await student.close()

    const teacher = await browser.newPage()
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(`/teacher/boards/${DEMO.boardId}`)
    const laura = teacher
      .getByTestId('student-row')
      .filter({ hasText: 'Laura Nataly' })
    await expect(laura).toContainText('Ingresó')
    await expect(
      teacher.getByText('5 en total · 1 ya ingresaron'),
    ).toBeVisible()
  })

  test('a joined student without a card (interrupted join) gets it back: on sign-in, or from the teacher', async ({
    browser,
  }) => {
    const card = emulatorDb.doc(`boards/${DEMO.boardId}/spaces/st_laura`)
    const joinLaura = async () => {
      const student = await browser.newPage()
      await signIn(student, 'laura@gmail.com')
      await expect(student.getByTestId('my-boards')).toContainText(
        DEMO.boardTitle,
      )
      return student
    }
    await (await joinLaura()).close()
    await card.delete()

    // The teacher sees it and creates the card
    const teacher = await browser.newPage()
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(`/teacher/boards/${DEMO.boardId}`)
    const laura = teacher
      .getByTestId('student-row')
      .filter({ hasText: 'Laura Nataly' })
    await expect(laura.getByTestId('no-card')).toHaveText('Sin tarjeta')
    await expect(teacher.getByTestId('no-card')).toHaveCount(1)
    await laura.getByRole('button', { name: 'Crear tarjeta' }).click()
    await expect(laura.getByTestId('no-card')).toHaveCount(0)
    // The badge goes as soon as the write is applied locally; the server gets it a moment later
    await expect.poll(async () => (await card.get()).exists).toBe(true)
    expect((await card.get()).data()).toMatchObject({
      studentId: 'st_laura',
      ownerName: 'Laura Nataly',
      title: '',
    })

    // Or the student's next sign-in recreates it, and she can edit it
    await card.delete()
    const student = await joinLaura()
    await expect.poll(async () => (await card.get()).exists).toBe(true)
    await student.getByText(DEMO.boardTitle).click()
    await expect(
      student.getByRole('button', { name: 'Editar mi tarjeta' }),
    ).toBeVisible()
  })

  test('someone not on the list joins with the invite link', async ({
    page,
  }) => {
    await signInAt(page, `/join/${DEMO.joinCode}`, 'nuevo@gmail.com')
    await expect(page.getByText(DEMO.boardTitle)).toBeVisible()
    await page.getByRole('button', { name: 'Unirme al tablero' }).click()
    await expect(page.getByTestId('board-title')).toHaveText(DEMO.boardTitle)
  })

  test('a disabled invite link is rejected', async ({ browser }) => {
    const teacher = await browser.newPage()
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(`/teacher/boards/${DEMO.boardId}`)
    await teacher.getByRole('switch').click()
    await expect(teacher.getByText('Enlace desactivado')).toBeVisible()
    await teacher.close()

    const page = await browser.newPage()
    await signInAt(page, `/join/${DEMO.joinCode}`, 'tarde@gmail.com')
    await page.getByRole('button', { name: 'Unirme al tablero' }).click()
    await expect(page.getByText('el enlace está desactivado')).toBeVisible()
  })

  test('an unknown invite code shows a clear message', async ({ page }) => {
    await signInAt(page, '/join/ZZZZZZ', 'alguien@gmail.com')
    await expect(page.getByText('Enlace no válido')).toBeVisible()
  })
})

test('language switch on the login page', async ({ page }) => {
  await page.goto('/login')
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible()
})
