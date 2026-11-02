import { expect, test, type Page } from '@playwright/test'
import { Timestamp } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import {
  addDaysKey,
  courseState,
  momentOf,
  toKey,
} from '../../src/features/course/course.ts'
import { startOfISOWeek } from 'date-fns'
import { courseSetupSchema } from '../../src/model/index.ts'

// M24: Administrar in tabs, the course setup (everything optional) with its class counter and
// calendar, and emails sent from the teacher's Gmail (faked: the tests never send real mail).

const admin = (tab = '') =>
  `/teacher/boards/${DEMO.boardId}${tab ? `/${tab}` : ''}`
const boardPath = `boards/${DEMO.boardId}`

test.beforeEach(async () => {
  await seedDemo()
})

async function savedCourse() {
  const board = await emulatorDb.doc(boardPath).get()
  return courseSetupSchema.parse(board.data()?.course)
}

test.describe('M24 · Administrar in tabs', () => {
  test('six tabs, each with its own link; old links still land in the right place', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(admin())
    const tabs = page.getByTestId('admin-tabs')
    await expect(tabs.getByRole('link')).toHaveText([
      'Resumen',
      'Estudiantes',
      'Curso',
      'Grabaciones',
      'Comunicación',
      'Ajustes',
    ])
    await expect(page.getByTestId('admin-overview')).toBeVisible()
    await tabs.getByRole('link', { name: 'Estudiantes' }).click()
    await expect(page).toHaveURL(new RegExp(`${admin('students')}$`))
    await expect(page.getByTestId('student-row')).toHaveCount(5)
    await tabs.getByRole('link', { name: 'Ajustes' }).click()
    await expect(page.getByTestId('lifecycle-panel')).toBeVisible()
    await expect(page.getByTestId('stages-panel')).toBeVisible()
    // the Grabaciones page's old link, and an unknown tab
    await page.goto(`${admin()}#recordings`)
    await expect(page).toHaveURL(new RegExp(`${admin('recordings')}$`))
    await expect(page.getByTestId('recordings-panel')).toBeVisible()
    await page.goto(admin('nope'))
    await expect(page).toHaveURL(new RegExp(`${admin()}$`))
  })
})

test.describe('M24 · course setup and class counter', () => {
  test('nothing set works as today; a workshop with only a total counts the days a class was given, and students see it', async ({
    page,
  }) => {
    // two classes already given (attendance taken)
    for (const date of ['2026-10-01', '2026-10-08'])
      await emulatorDb.doc(`${boardPath}/attendance/${date}`).set({
        date,
        topic: '',
        marks: {},
        takenBy: DEMO.teacher,
        updatedAt: Timestamp.now(),
      })
    await signIn(page, DEMO.teacher)
    await page.goto(admin())
    await expect(page.getByTestId('overview-course')).toContainText(
      'Opcional: agrega el horario',
    )
    await page.goto(admin('course'))
    const setup = page.getByTestId('course-setup')
    await setup.getByLabel('Total de clases').fill('4')
    await setup.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Curso guardado')).toBeVisible()
    await expect(setup.getByTestId('counter-text')).toHaveText('Clase 2 de 4')
    await expect(setup.getByTestId('counter-remaining')).toHaveText('quedan 2')
    // the teacher's browser saves the count for students
    await expect.poll(async () => (await savedCourse()).held).toBe(2)

    // the teacher's home shows how far each course is
    await page.goto('/teacher')
    await expect(page.getByTestId('home-counter')).toHaveText('2 / 4')

    await signIn(page, 'laura@gmail.com')
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('course-line')).toContainText('Clase 2 de 4')
    // no dates and no news: no calendar
    await expect(page.getByRole('button', { name: 'Calendario' })).toHaveCount(
      0,
    )
  })

  test('start, end and the schedule give the classes; holidays, a day off and a moved class; weeks, the calendar and attendance', async ({
    page,
  }) => {
    const now = momentOf()
    // Monday of last week → the course is in week 2 today; 4 weeks long
    const start = toKey(startOfISOWeek(new Date(Date.now() - 7 * 86_400_000)))
    const end = addDaysKey(start, 27)
    await signIn(page, DEMO.teacher)
    await page.goto(admin('course'))
    const setup = page.getByTestId('course-setup')
    await setup.getByLabel('Fecha de inicio').fill(start)
    await setup.getByLabel('Fecha de fin').fill(end)
    const schedule = setup.getByTestId('schedule-editor')
    await schedule.getByRole('button', { name: 'martes', exact: true }).click()
    await schedule.getByLabel('Hora de inicio del martes').fill('18:00')
    await schedule.getByLabel('Hora de fin del martes').fill('21:00')
    await schedule.getByLabel('Lugar o enlace del martes').fill('Salón 304')
    // a new day starts with the last day's time
    await schedule.getByRole('button', { name: 'sábado', exact: true }).click()
    await expect(schedule.getByLabel('Hora de inicio del sábado')).toHaveValue(
      '18:00',
    )
    await schedule.getByLabel('Hora de inicio del sábado').fill('08:00')
    await schedule.getByLabel('Hora de fin del sábado').fill('12:00')
    await schedule.getByLabel('Lugar o enlace del sábado').fill('')
    await expect(setup.getByTestId('dates-summary')).toContainText('8 clases')

    // holidays for the course's dates, a day off, and a class moved to another day
    await setup
      .getByRole('button', { name: 'Cargar festivos de Colombia' })
      .click()
    await expect(page.getByText(/festivos? cargados?/)).toBeVisible()
    const lastSaturday = addDaysKey(start, 26)
    await setup
      .getByTestId('course-days-off')
      .getByLabel('Fecha')
      .fill(lastSaturday)
    await setup.getByLabel('Motivo').fill('Receso')
    await setup.getByRole('button', { name: 'Agregar día sin clase' }).click()
    await expect(setup.getByTestId('day-off')).toHaveCount(1)
    // move the next class one day later
    const move = setup.getByTestId('move-class')
    const from = await move
      .getByLabel('Mover la clase del')
      .locator('option')
      .nth(1)
      .getAttribute('value')
    await move.getByLabel('Mover la clase del').selectOption(from!)
    await move.getByLabel('al', { exact: true }).fill(addDaysKey(from!, 1))
    await move.getByRole('button', { name: 'Mover clase' }).click()
    await expect(setup.getByTestId('extra')).toContainText('Movida del')
    await expect(setup.getByTestId('day-off')).toHaveCount(2)
    await setup.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Curso guardado')).toBeVisible()

    const course = await savedCourse()
    expect(course).toMatchObject({ start, end })
    expect(course.daysOff).toContainEqual({
      date: lastSaturday,
      reason: 'Receso',
    })
    expect(course.extras).toHaveLength(1)
    expect(course.schedule).toEqual([
      { day: 2, start: '18:00', end: '21:00', place: 'Salón 304' },
      { day: 6, start: '08:00', end: '12:00', place: '' },
    ])
    const state = courseState(course, now)
    expect(state.phase).toBe('running')
    const counter = `Clase ${state.given} de ${state.total}`
    await expect(setup.getByTestId('counter-text')).toHaveText(counter)
    await expect(setup.getByTestId('counter-week')).toHaveText(
      '· Semana 2 de 4',
    )

    // Resumen and the teacher's home
    await page.goto(admin())
    await expect(page.getByTestId('overview-course')).toContainText(counter)
    await expect(page.getByTestId('next-class')).toBeVisible()
    await page.goto('/teacher')
    await expect(page.getByTestId('home-counter')).toHaveText(
      `${state.given} / ${state.total}`,
    )
    // attendance says which class today is (or that it isn't one)
    await page.goto(`${admin('attendance')}`)
    await expect(page.getByTestId('attendance-course')).toBeVisible()

    // students: the counter and next class under the title, and the calendar
    await signIn(page, 'laura@gmail.com')
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(page.getByTestId('course-line')).toContainText(counter)
    await page.getByRole('button', { name: 'Calendario' }).click()
    await expect(page).toHaveURL(/\/calendario$/)
    await expect(page.getByTestId('calendar-week')).toHaveCount(4)
    const current = page.locator('[data-testid="calendar-week"][data-week="2"]')
    await expect(current).toContainText('Esta semana')
    await expect(page.getByTestId('schedule-summary')).toContainText(
      'Salón 304',
    )
    await expect(
      page.locator('[data-testid="calendar-week"][data-week="4"]'),
    ).toContainText('No hay clase: Receso')
  })
})

/** Gmail faked at the network level; each request's message decoded */
async function fakeGmail(page: Page, failOnce: string[] = []) {
  const sent: { auth: string; raw: string }[] = []
  const failing = new Set(failOnce)
  await page.addInitScript(() => {
    window.__pblGmailToken = 'fake-token'
  })
  await page.route('https://gmail.googleapis.com/**', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as {
      raw: string
    }
    const raw = Buffer.from(body.raw, 'base64url').toString('utf8')
    sent.push({ auth: route.request().headers().authorization ?? '', raw })
    const to = /^To: .*<(.+)>$/m.exec(raw)?.[1] ?? ''
    if (failing.delete(to))
      return route.fulfill({ status: 500, body: '{"error":"boom"}' })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"id":"m1"}',
    })
  })
  return sent
}

const textPart = (raw: string) =>
  Buffer.from(
    raw
      .split('Content-Type: text/plain; charset="UTF-8"')[1]
      .split('\r\n\r\n')[1]
      .split('--')[0]
      .replace(/\r\n/g, ''),
    'base64',
  ).toString('utf8')

test.describe('M24 · emails from the teacher’s Gmail', () => {
  test('one email per student with the sender name and Reply-To; a failure is retried; the history shows what went out', async ({
    page,
  }) => {
    const sent = await fakeGmail(page, ['carolina@gmail.com'])
    await signIn(page, DEMO.teacher)
    await page.goto(admin('communication'))
    const sender = page.getByTestId('sender-form')
    await sender
      .getByLabel('Nombre del remitente')
      .fill('Diplomado UX/UI – Prof. Demo')
    await sender
      .getByLabel('Las respuestas llegan a')
      .fill('docente@uni.edu.co')
    await sender.getByRole('button', { name: 'Guardar' }).click()
    await expect(
      page.getByText('Configuración de envío guardada'),
    ).toBeVisible()

    await page
      .getByTestId('communication-actions')
      .getByRole('button', { name: 'Enviar correo' })
      .click()
    const dialog = page.getByTestId('send-email-dialog')
    await expect(dialog.getByTestId('sender')).toContainText(
      'De: Diplomado UX/UI – Prof. Demo <docente@demo.edu>',
    )
    await expect(dialog.getByTestId('sender')).toContainText(
      'Respuestas a: docente@uni.edu.co',
    )
    await expect(dialog.getByTestId('send-count')).toHaveText(
      'Para: 5 estudiantes',
    )
    await dialog.getByLabel('Asunto').fill('Recordatorio de entrega')
    await dialog
      .getByLabel('Mensaje')
      .fill('Mañana hay entrega.\n\nTraigan el prototipo.')
    await dialog.getByRole('button', { name: 'Enviar a 5 estudiantes' }).click()
    await expect(dialog.getByTestId('send-result')).toContainText(
      'Enviado a 4 estudiantes',
    )
    await expect(dialog.getByTestId('send-failed')).toHaveText(
      '1 no se pudo enviar',
    )
    await dialog.getByRole('button', { name: 'Reintentar' }).click()
    await expect(dialog.getByTestId('send-result')).toContainText(
      'Enviado a 5 estudiantes',
    )
    await expect(dialog.getByTestId('send-failed')).toHaveCount(0)

    expect(sent).toHaveLength(6)
    expect(new Set(sent.map((item) => item.auth))).toEqual(
      new Set(['Bearer fake-token']),
    )
    const laura = sent.find((item) =>
      item.raw.includes('<laura@gmail.com>'),
    )!.raw
    expect(laura).toContain('Reply-To: docente@uni.edu.co\r\n')
    expect(laura).toMatch(/^From: =\?UTF-8\?B\?.+<docente@demo\.edu>$/m)
    expect(laura).toMatch(/^Subject: Recordatorio de entrega$/m)
    expect(textPart(laura)).toContain('Hola, Laura:')
    expect(textPart(laura)).toContain('Traigan el prototipo.')

    await dialog.getByRole('button', { name: 'Listo' }).click()
    await expect(page.getByTestId('email-log')).toHaveCount(2)
    await expect(page.getByTestId('email-log').first()).toContainText(
      'Recordatorio de entrega',
    )
    const log = await emulatorDb.collection(`${boardPath}/emails`).get()
    expect(log.docs.map((item) => item.data().sent.length).sort()).toEqual([
      1, 4,
    ])
  })

  test('from Correos’ filters, an announcement ("también enviar por correo"), a news item and the weekly summary, the composer opens filled in', async ({
    page,
  }) => {
    await fakeGmail(page)
    await signIn(page, DEMO.teacher)
    // Correos → a group → "Enviar desde la app"
    await page.goto(admin('students'))
    await page.getByRole('button', { name: 'Correos' }).click()
    const emails = page.getByTestId('emails-dialog')
    await emails.getByLabel('Para').selectOption('group:Equipo 1')
    await emails.getByRole('button', { name: 'Enviar desde la app' }).click()
    const dialog = page.getByTestId('send-email-dialog')
    await expect(dialog.getByTestId('send-count')).toContainText('Para: ')
    await expect(dialog.getByTestId('send-count')).not.toHaveText(
      'Para: 5 estudiantes',
    )
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // an announcement, also by email
    await page.getByRole('button', { name: 'Anuncios' }).click()
    const panel = page.getByTestId('announcements-panel')
    await panel.getByLabel('Título').fill('Cambio de salón')
    await panel.getByLabel('Mensaje').fill('Mañana nos vemos en el 305.')
    await panel
      .getByRole('checkbox', { name: /También enviar por correo/ })
      .click()
    await panel.getByRole('button', { name: 'Publicar' }).click()
    await expect(dialog.getByLabel('Asunto')).toHaveValue('Cambio de salón')
    await expect(dialog.getByLabel('Mensaje')).toHaveValue(
      'Mañana nos vemos en el 305.',
    )
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // a news item → students see it in Calendario; ✉ fills the composer
    await page.goto(admin('course'))
    const news = page.getByTestId('news-panel')
    await news.getByLabel('Tipo').selectOption('deliverable')
    await news.getByLabel('Título').fill('Entrega del prototipo')
    await news.getByRole('button', { name: 'Agregar novedad' }).click()
    await expect(news.getByTestId('news-row')).toHaveCount(1)
    await news
      .getByRole('button', {
        name: 'Enviar «Entrega del prototipo» por correo',
      })
      .click()
    await expect(dialog.getByLabel('Asunto')).toHaveValue(
      'Entrega: Entrega del prototipo',
    )
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // the weekly summary
    await page.goto(admin('communication'))
    await page
      .getByTestId('communication-actions')
      .getByRole('button', { name: 'Resumen de la semana' })
      .click()
    await expect(dialog.getByLabel('Asunto')).toHaveValue(
      /Resumen de la semana/,
    )
    await expect(dialog.getByLabel('Mensaje')).toHaveValue(
      /Entrega del prototipo|no hay clases/,
    )
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    await signIn(page, 'laura@gmail.com')
    await page.goto(`/b/${DEMO.boardId}/calendario`)
    await expect(page.getByTestId('news-item')).toContainText(
      'Entrega del prototipo',
    )
  })
})
