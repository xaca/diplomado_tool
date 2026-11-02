import { expect, test, type Page } from '@playwright/test'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import { fakeYouTube, type FakeYouTube } from './youtube-fake.ts'

// M23: recorded classes — a YouTube playlist linked by the teacher, read again on opening (new
// classes appear on their own), and a study player that remembers where each student is.

const LIST = 'PLtest_Diplomado01'
const videosUrl = `/b/${DEMO.boardId}/videos`
const video = (page: Page, id: string) =>
  page.locator(`[data-testid="video"][data-video="${id}"]`)

function youtube(): FakeYouTube {
  return {
    lists: { [LIST]: ['clase0001a', 'clase0002b', 'privada003'] },
    videos: {
      clase0001a: { title: '02 Octubre - Diplomado', seconds: 600 },
      clase0002b: { title: '05 Octubre - Diplomado', seconds: 30 },
      privada003: {
        title: '09 Octubre - Diplomado',
        seconds: 0,
        playable: false,
      },
      clase0004d: { title: '23 Octubre - Diplomado', seconds: 900 },
    },
  }
}

/** The teacher links the playlist in Administrar (review first, then save) */
async function linkPlaylist(page: Page) {
  await signIn(page, DEMO.teacher)
  await page.goto(`/teacher/boards/${DEMO.boardId}/recordings`)
  const panel = page.getByTestId('recordings-panel')
  await panel.getByRole('button', { name: 'Agregar lista de YouTube' }).click()
  await panel
    .getByLabel('Enlace de la lista')
    .fill(`https://www.youtube.com/watch?v=clase0001a&list=${LIST}&index=1`)
  await panel.getByLabel('Título').fill('Diplomado UX/UI')
  await panel.getByRole('button', { name: 'Revisar' }).click()
  await expect(panel.getByTestId('found')).toHaveText(
    'YouTube tiene 3 clases en esta lista:',
  )
  await expect(panel.getByTestId('preview-video').nth(2)).toContainText(
    'no se puede ver dentro de la app',
  )
  await panel.getByRole('button', { name: 'Guardar' }).click()
  await expect(panel.getByTestId('recording-row')).toContainText('3 clases')
  await expect(panel.getByTestId('blocked')).toContainText(
    '1 clase no se puede ver dentro de la app',
  )
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M23 · recorded classes', () => {
  test('the teacher links a playlist; when it grows on YouTube the new class shows up on its own, newest last', async ({
    page,
  }) => {
    const fake = youtube()
    await fakeYouTube(page, fake)
    await linkPlaylist(page)
    // a link without a playlist is explained
    const panel = page.getByTestId('recordings-panel')
    await panel
      .getByRole('button', { name: 'Agregar lista de YouTube' })
      .click()
    await panel
      .getByLabel('Enlace de la lista')
      .fill('https://www.youtube.com/watch?v=clase0001a')
    await panel.getByRole('button', { name: 'Revisar' }).click()
    await expect(panel.getByRole('alert')).toContainText(
      'no tiene una lista de reproducción',
    )

    // A new class is added to the playlist on YouTube; nobody touches the app
    fake.lists[LIST].push('clase0004d')
    await signIn(page, 'laura@gmail.com')
    // from the board's header (Tarjetas)
    await page.goto(`/b/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Grabaciones' }).click()
    await expect(page).toHaveURL(new RegExp(`${videosUrl}$`))
    await expect(page.getByTestId('video')).toHaveCount(4)
    await expect(video(page, 'clase0004d')).toContainText('Más reciente')
    await expect(video(page, 'clase0004d')).toContainText('23 Octubre')
    await expect(video(page, 'clase0004d')).toContainText('15:00')
    await expect(page.getByTestId('video').last()).toHaveAttribute(
      'data-video',
      'clase0004d',
    )
    await page.getByText('Ver la última clase').click()
    await expect(page.getByTestId('playing-title')).toHaveText(
      '23 Octubre - Diplomado',
    )
  })

  test('a student studies a class: ±10 s, speed, resume where they left off, watched at 90 % and the next one offered; the teacher sees who watched', async ({
    page,
  }) => {
    const fake = youtube()
    await fakeYouTube(page, fake)
    await linkPlaylist(page)
    fake.lists[LIST].push('clase0004d')

    await signIn(page, 'laura@gmail.com')
    await page.goto(videosUrl)
    await video(page, 'clase0001a').click()
    await expect(page.getByTestId('playing-title')).toHaveText(
      '02 Octubre - Diplomado',
    )
    const time = page.getByTestId('time')
    await expect(time).toHaveText('0:00 / 10:00')
    // keyboard: → three times = 30 s
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(time).toHaveText('0:30 / 10:00')
    await page.getByRole('button', { name: 'Atrás 10 s' }).click()
    await expect(time).toHaveText('0:20 / 10:00')
    await page.getByTestId('speed').selectOption('2')
    await page.getByRole('button', { name: 'Reproducir' }).click()
    await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: 'Pausar' }).click()

    // the list shows where I am, and opening the class resumes there
    await page.goto(videosUrl)
    await expect(video(page, 'clase0001a').getByTestId('at')).toContainText(
      /Vas en 0:2\d/,
    )
    await page.getByText('Seguir donde quedé').click()
    await expect(time).toHaveText(/^0:2\d \/ 10:00$/)

    // Class 2 is 30 s long: jump to 0:20 and play to the end → watched; the next class that
    // plays here is offered (class 3 can't be embedded)
    await page.getByRole('button', { name: 'Clase siguiente' }).click()
    await expect(page.getByTestId('playing-title')).toHaveText(
      '05 Octubre - Diplomado',
    )
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(time).toHaveText('0:20 / 0:30')
    await page.getByRole('button', { name: 'Reproducir' }).click()
    await expect(page.getByTestId('up-next')).toContainText(
      'Siguiente: 23 Octubre',
      { timeout: 15_000 },
    )
    await expect(time).toHaveText('0:30 / 0:30', { timeout: 15_000 })
    await page.goto(videosUrl)
    await expect(video(page, 'clase0002b').getByTestId('watched')).toHaveText(
      'Vista',
    )

    // a video that can't be embedded explains why, with a way out
    await video(page, 'privada003').click()
    await expect(page.getByTestId('player-error')).toContainText(
      'no se puede ver dentro de la app',
    )
    await expect(
      page.getByTestId('player-error').getByText('Abrir en YouTube'),
    ).toBeVisible()

    // the teacher: who watched each class
    await signIn(page, DEMO.teacher)
    await page.goto(videosUrl)
    await expect(video(page, 'clase0002b').getByTestId('watchers')).toHaveText(
      /^1 de \d+ la vieron$/,
    )
    await expect(video(page, 'clase0001a').getByTestId('watchers')).toHaveText(
      /^0 de \d+ la vieron$/,
    )
  })

  test("the teacher renames and hides a class; students see the teacher's title and not the hidden one", async ({
    page,
  }) => {
    await fakeYouTube(page, youtube())
    await linkPlaylist(page)
    const panel = page.getByTestId('recordings-panel')
    await panel.getByRole('button', { name: 'Editar lista' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Título de la clase 1').fill('Clase 1: Empatía')
    await dialog
      .getByTestId('edit-video')
      .nth(2)
      .getByRole('button', { name: 'Ocultar a los estudiantes' })
      .click()
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(panel.getByTestId('recording-row')).toContainText(
      '2 clases · 1 oculta',
    )

    await signIn(page, 'laura@gmail.com')
    await page.goto(videosUrl)
    await expect(page.getByTestId('video')).toHaveCount(2)
    await expect(video(page, 'clase0001a')).toContainText('Clase 1: Empatía')
    await expect(video(page, 'privada003')).toHaveCount(0)
  })
})
