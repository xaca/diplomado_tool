import { expect, test, type Browser, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// M19: the teacher's announcements; students get a chime, a window and the 🔔.

const boardUrl = `/b/${DEMO.boardId}`

test.beforeEach(async () => {
  await seedDemo()
})

/** A student's page whose sound is counted instead of played (each chime = 2 notes). */
async function studentPage(browser: Browser, email: string) {
  const page: Page = await (await browser.newContext()).newPage()
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number; AudioContext: unknown }
    w.__notes = 0
    const node = () => ({ connect: (next: unknown) => next })
    w.AudioContext = class {
      currentTime = 0
      state = 'running'
      destination = {}
      resume() {}
      createOscillator() {
        return {
          ...node(),
          type: '',
          frequency: { value: 0 },
          start: () => (w.__notes += 1),
          stop: () => undefined,
        }
      }
      createGain() {
        return {
          ...node(),
          gain: {
            setValueAtTime: () => undefined,
            exponentialRampToValueAtTime: () => undefined,
          },
        }
      }
    }
  })
  await signIn(page, email)
  return page
}

const notes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notes: number }).__notes)

test.describe('M19 · announcements', () => {
  test('an important announcement reaches a student live (chime, window, badge); read, removed, reminded, deleted', async ({
    page,
    browser,
  }) => {
    const student = await studentPage(browser, 'scetina@uni.edu.co')
    await student.goto(boardUrl)
    await expect(student.getByTestId('notification-bell')).toBeVisible()
    await expect(student.getByTestId('bell-badge')).toHaveCount(0)

    // The teacher publishes from the board
    await signIn(page, DEMO.teacher)
    await page.goto(boardUrl)
    await page.getByRole('button', { name: 'Anuncios' }).click()
    const panel = page.getByTestId('announcements-panel')
    await panel.getByLabel('Título').fill('Mañana traigan su prototipo')
    await panel.getByLabel('Mensaje').fill('En papel o digital.')
    await panel.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Anuncio publicado')).toBeVisible()
    await expect(panel.getByTestId('read-count')).toHaveText('0 de 3 leyeron')

    // The student: a chime, the window and the badge
    const window = student.getByTestId('announcement-window')
    await expect(window).toContainText('Mañana traigan su prototipo')
    await expect(window).toContainText('En papel o digital.')
    await expect(student.getByTestId('bell-badge')).toHaveText('1')
    await expect.poll(() => notes(student)).toBe(2)
    await window.getByRole('button', { name: 'Entendido' }).click()
    await expect(window).toHaveCount(0)
    await expect(student.getByTestId('bell-badge')).toHaveCount(0)
    await expect(panel.getByTestId('read-count')).toHaveText('1 de 3 leyeron')

    // In the 🔔: "Leído", then removed
    await student.getByTestId('notification-bell').click()
    const item = student.getByTestId('notification')
    await expect(item).toHaveAttribute('data-status', 'read')
    await item
      .getByRole('button', { name: 'Quitar: Mañana traigan su prototipo' })
      .click()
    await expect(item).toHaveCount(0)
    await expect(student.getByTestId('notifications')).toContainText(
      'No hay anuncios por ahora.',
    )
    await student.keyboard.press('Escape')

    // "Recordar": new again for everyone (also after removing it), with a chime
    // (at most one chime every 4 s: wait past the first one)
    await student.waitForTimeout(4_100)
    await panel.getByRole('button', { name: 'Recordar' }).click()
    await expect(page.getByText('Lo verán de nuevo como nuevo')).toBeVisible()
    await expect(student.getByTestId('bell-badge')).toHaveText('1')
    await expect(window).toContainText('Mañana traigan su prototipo')
    await expect.poll(() => notes(student)).toBe(4)
    await expect(panel.getByTestId('read-count')).toHaveText('0 de 3 leyeron')

    // Deleted by the teacher: gone for everyone
    await panel.getByRole('button', { name: 'Eliminar' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(page.getByText('Anuncio eliminado')).toBeVisible()
    await expect(window).toHaveCount(0)
    await expect(student.getByTestId('bell-badge')).toHaveCount(0)
  })

  test('a regular one goes only to the 🔔: "Nuevo" until opened; its link opens in the app; muted = no chime', async ({
    page,
    browser,
  }) => {
    const student = await studentPage(browser, 'elma@gmail.com')
    await student.goto(`${boardUrl}/s/st_elma`)
    // Mute first (remembered on this device)
    await student.getByTestId('notification-bell').click()
    await student
      .getByTestId('notifications')
      .getByRole('switch', { name: 'Silenciar sonido' })
      .click()
    await student.keyboard.press('Escape')

    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Anuncios' }).click()
    const panel = page.getByTestId('announcements-panel')
    await panel.getByLabel('Título').fill('Ya pueden insertar Canva')
    await panel.getByLabel('Enlace').fill(boardUrl)
    await panel.getByRole('checkbox', { name: /Importante/ }).click()
    await panel.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Anuncio publicado')).toBeVisible()

    // No window, no sound: only the badge (the student is on their space page)
    await expect(student.getByTestId('bell-badge')).toHaveText('1')
    await expect(student.getByTestId('announcement-window')).toHaveCount(0)
    expect(await notes(student)).toBe(0)

    await student.getByTestId('notification-bell').click()
    const item = student.getByTestId('notification')
    await expect(item).toHaveAttribute('data-status', 'new')
    await item.locator('button[aria-expanded]').click()
    await expect(item).toHaveAttribute('data-status', 'read')
    await expect(student.getByTestId('bell-badge')).toHaveCount(0)
    const uid = (
      await emulatorDb
        .collection(`boards/${DEMO.boardId}/members`)
        .where('studentId', '==', 'st_elma')
        .get()
    ).docs[0].id
    const id = (
      await emulatorDb.collection(`boards/${DEMO.boardId}/announcements`).get()
    ).docs[0].id
    await expect
      .poll(
        async () =>
          !!(
            await emulatorDb
              .doc(`boards/${DEMO.boardId}/announcementState/${uid}`)
              .get()
          ).data()?.read?.[id],
      )
      .toBe(true)
    await item.getByRole('button', { name: 'Abrir' }).click()
    await expect(student).toHaveURL(new RegExp(`${boardUrl}$`))
  })
})
