import { expect, test, type Page } from '@playwright/test'
import { emulatorDb } from '../../scripts/emulator.ts'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'
import {
  embedElement,
  seedSlides,
  spacePath,
  textElement,
} from './slides-fixtures.ts'

// M25 (revised 2026-11-07): Presentaciones are the students' own slides, nothing else; a student's
// evaluation is a Google Form inside one of their slides, filled in by classmates right there.
// (Buttons that open a page are links with the button role, as elsewhere in the app.)
// Also: the sections bar on every board page, and Administrar only for the board's own teachers.

const FORM_ID = '1FAIpQLSdAbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefgh'
const formLink = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?usp=sf_link`
const formEmbed = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform?embedded=true`
const board = `/b/${DEMO.boardId}`

const sections = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones del tablero' })
const card = (page: Page, studentId: string) =>
  page.locator(`[data-testid="presentation"][data-student="${studentId}"]`)

async function fakeGoogle(page: Page) {
  await page.route('https://docs.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Formulario</p>' }),
  )
}

/** Sebastian's pitch: a title slide and a slide with his evaluation form; marked ready */
async function sebastianWithForm() {
  await seedSlides('st_sebastian', [
    [textElement('Shark Tank — Plataforma para agencias')],
    [embedElement('form', formLink, 100)],
  ])
  await emulatorDb.doc(spacePath('st_sebastian')).update({
    readyToPresent: true,
  })
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M25 · Presentaciones: the students’ own slides', () => {
  test('a classmate sees only presentations with slides, and fills in the form inside one', async ({
    page,
  }) => {
    await sebastianWithForm()
    await fakeGoogle(page)
    await signIn(page, 'elma@gmail.com')
    await page.goto(board)
    await sections(page).getByRole('link', { name: 'Presentaciones' }).click()
    await expect(page).toHaveURL(new RegExp(`${board}/presentaciones$`))

    // Only Sebastian has slides; the others are counted, not listed
    await expect(page.getByTestId('presentation')).toHaveCount(1)
    const pitch = card(page, 'st_sebastian')
    await expect(pitch).toContainText('Sebastian Cetina')
    await expect(pitch).toContainText('2 diapositivas')
    await expect(pitch).toContainText('Lista')
    // a classmate can view it, not present it
    await expect(
      pitch.getByRole('button', { name: 'Presentar', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByTestId('without-slides')).toContainText(
      'aún no tienen diapositivas',
    )

    // Elma's own: how to add her form, and a way to edit her slides
    const mine = page.getByTestId('my-presentation')
    await expect(mine).toContainText('Tu presentación: 0 diapositivas')
    await expect(mine).toContainText('Insertar contenido → Google Forms')
    await expect(
      mine.getByRole('button', {
        name: 'Editar mis diapositivas',
        exact: true,
      }),
    ).toHaveAttribute('href', `${board}/s/st_elma/edit`)

    // Ver → Sebastian's slides, with his form live and fillable (forms allowed in the sandbox)
    await pitch.getByRole('button', { name: 'Ver', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${board}/s/st_sebastian$`))
    const viewer = page.getByTestId('slides-viewer')
    const form = viewer.locator('iframe')
    await expect(form).toHaveAttribute('src', formEmbed)
    await expect(form).toHaveAttribute('sandbox', /allow-forms/)
    await expect(viewer.getByTestId('embed-open')).toHaveAttribute(
      'href',
      formEmbed,
    )
  })

  test('the teacher presents everyone, the ready ones, or one student; no extra slides to manage', async ({
    page,
  }) => {
    await sebastianWithForm()
    await signIn(page, DEMO.teacher)
    await page.goto(`${board}/presentaciones`)
    await expect(
      page.getByRole('button', { name: 'Presentar todas', exact: true }),
    ).toHaveAttribute('href', `${board}/present`)
    await expect(
      page.getByRole('button', { name: 'Presentar listos', exact: true }),
    ).toHaveAttribute('href', `${board}/present?ready=1`)
    await expect(page.getByTestId('my-presentation')).toHaveCount(0)
    await card(page, 'st_sebastian')
      .getByRole('button', { name: 'Presentar', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`${board}/present/st_sebastian`))

    // Administrar has no tab to add presentations or forms
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    const tabs = page.getByTestId('admin-tabs')
    await expect(tabs.getByRole('link', { name: 'Grabaciones' })).toBeVisible()
    await expect(
      tabs.getByRole('link', { name: 'Presentaciones' }),
    ).toHaveCount(0)
    await expect(tabs.getByRole('link', { name: 'Evaluaciones' })).toHaveCount(
      0,
    )
  })

  test('the sections bar is on every board page, under the board’s compact header', async ({
    page,
  }) => {
    await signIn(page, 'laura@gmail.com')
    await page.goto(board)
    for (const [name, path] of [
      ['Presentaciones', '/presentaciones'],
      ['Logros', '/logros'],
      ['Grabaciones', '/videos'],
      ['Clases', '/class'],
    ] as const) {
      await sections(page).getByRole('link', { name }).click()
      await expect(page).toHaveURL(new RegExp(`${board}${path}$`))
      await expect(sections(page)).toBeVisible()
      await expect(
        page.getByRole('link', { name: DEMO.boardTitle }),
      ).toBeVisible()
    }
  })

  test("a teacher of another course who is a student here can't open Administrar", async ({
    page,
  }) => {
    // Elma joins as a student first (her email is on the roster) …
    await signIn(page, 'elma@gmail.com')
    await page.goto(board)
    await expect(sections(page)).toBeVisible()
    // … and then becomes a teacher (of her own courses)
    await emulatorDb.doc('staffEmails/elma@gmail.com').set({
      email: 'elma@gmail.com',
      displayName: 'Elma',
      role: 'teacher',
      addedAt: new Date(),
    })
    await signIn(page, 'elma@gmail.com')
    await page.goto(`/teacher/boards/${DEMO.boardId}/students`)
    await expect(page.getByTestId('not-board-teacher')).toContainText(
      'No eres docente de este tablero',
    )
    await expect(page.getByTestId('student-row')).toHaveCount(0)
  })
})
