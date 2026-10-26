import { expect, test } from '@playwright/test'
import { DEMO, DEMO_CARDS, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

test.beforeEach(async () => {
  await seedDemo()
})

const boardUrl = `/b/${DEMO.boardId}`

test.describe('M3 · board dashboard', () => {
  test('the teacher sees one card per student who joined, with title and time', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(boardUrl)
    await expect(page.getByTestId('board-title')).toHaveText(DEMO.boardTitle)
    await expect(page.getByTestId('space-card')).toHaveCount(DEMO_CARDS.length)
    await expect(page.getByText('3 estudiantes')).toBeVisible()

    const elma = page.getByTestId('space-card').filter({ hasText: 'Elma' })
    await expect(elma).toContainText('App de rastreo')
    await expect(elma).toContainText('hace 3 días')
    // Teachers don't edit cards
    await expect(elma.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  })

  test('a student joins, finds their card first ("Tú") and edits it', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.getByText(DEMO.boardTitle).click()

    const cards = page.getByTestId('space-card')
    await expect(cards).toHaveCount(DEMO_CARDS.length + 1)
    await expect(cards.first()).toContainText('Laura Nataly')
    await expect(cards.first()).toContainText('Tú')

    await page.getByRole('button', { name: 'Editar mi tarjeta' }).click()
    await page.getByLabel('Título del proyecto').fill('Match con psicólogos')
    await page
      .getByLabel('Resumen')
      .fill(
        'Una app para encontrar al profesional de psicología que necesitas.',
      )
    await page.getByRole('button', { name: 'Rosa' }).click()
    await page.getByRole('button', { name: 'Guardar' }).click()

    await expect(cards.first()).toContainText('Match con psicólogos')
    await expect(cards.first()).toHaveCSS(
      'background-color',
      'rgb(252, 231, 243)',
    )
  })

  test("a student can't edit a classmate's card", async ({ page }) => {
    await signIn(page, 'laura@gmail.com')
    await page.getByText(DEMO.boardTitle).click()
    const elma = page.getByTestId('space-card').filter({ hasText: 'Elma' })
    await expect(elma).toBeVisible()
    await expect(elma.getByRole('button', { name: 'Editar' })).toHaveCount(0)
  })

  test("the teacher's dashboard updates live when a student edits", async ({
    browser,
  }) => {
    const teacher = await browser.newPage()
    await signIn(teacher, DEMO.teacher)
    await teacher.goto(boardUrl)
    await expect(teacher.getByTestId('space-card')).toHaveCount(
      DEMO_CARDS.length,
    )

    const student = await browser.newPage()
    await signIn(student, 'hbuelvas@uni.edu.co') // Hanna's university email
    await student.getByText(DEMO.boardTitle).click()
    await student.getByRole('button', { name: 'Editar mi tarjeta' }).click()
    await student
      .getByLabel('Título del proyecto')
      .fill('Idea 1: app para viajeros')
    await student.getByRole('button', { name: 'Guardar' }).click()

    // No reload on the teacher's side
    const hanna = teacher
      .getByTestId('space-card')
      .filter({ hasText: 'Hanna Buelvas' })
    await expect(hanna).toContainText('Idea 1: app para viajeros')
  })

  test('the space page shows the card and lets the owner edit', async ({
    page,
  }) => {
    await signIn(page, 'elma@gmail.com')
    await page.goto(`${boardUrl}/s/st_elma`)
    await expect(page.getByTestId('space-detail')).toContainText(
      'App de rastreo',
    )
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible()
  })

  test("renaming a student updates the card's name", async ({ page }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await page
      .getByTestId('student-row')
      .filter({ hasText: 'Elma' })
      .getByRole('button', { name: 'Editar estudiante' })
      .click()
    await page.getByLabel('Nombre').fill('Elma Rodríguez')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(
      page.getByTestId('student-row').filter({ hasText: 'Elma Rodríguez' }),
    ).toBeVisible()

    await page.goto(boardUrl)
    await expect(
      page.getByTestId('space-card').filter({ hasText: 'Elma Rodríguez' }),
    ).toBeVisible()
  })
})
