import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { Timestamp } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'

// M18: students' emails and attendance by date.

const boardPath = `boards/${DEMO.boardId}`
const pad = (value: number) => String(value).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

test.beforeEach(async () => {
  await seedDemo()
})

async function seedDay(date: string, marks: Record<string, string>) {
  await emulatorDb.doc(`${boardPath}/attendance/${date}`).set({
    date,
    topic: '',
    marks: Object.fromEntries(
      Object.entries(marks).map(([id, status]) => [id, { status }]),
    ),
    takenBy: DEMO.teacher,
    updatedAt: Timestamp.now(),
  })
  for (const [id, status] of Object.entries(marks))
    await emulatorDb
      .doc(`${boardPath}/attendanceByStudent/${id}`)
      .set(
        { dates: { [date]: status }, updatedAt: Timestamp.now() },
        { merge: true },
      )
}

test.describe('M18 · attendance', () => {
  test('the teacher takes attendance from the board; the table, a fix and the CSV; the student sees only theirs', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Asistencia' }).click()
    await expect(page).toHaveURL(/\/attendance$/)

    const take = page.getByTestId('take-attendance')
    await take.getByLabel('Tema de la clase').fill('Sesión 4 · Prototipos')
    await take.getByRole('button', { name: 'Todos presentes' }).click()
    await take
      .getByRole('radiogroup', { name: 'Asistencia de Elma' })
      .getByRole('radio', { name: 'Ausente' })
      .click()
    const seb = take.getByRole('radiogroup', {
      name: 'Asistencia de Sebastian Cetina',
    })
    await seb.getByRole('radio', { name: 'Tarde' }).click()
    await expect(seb.getByRole('radio', { name: 'Tarde' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await take
      .getByRole('button', { name: 'Nota para Sebastian Cetina' })
      .click()
    await take
      .getByRole('textbox', { name: 'Nota para Sebastian Cetina' })
      .fill('Llegó 20 min tarde')
    await expect(take.getByTestId('count-present')).toHaveText('Presente 3')
    await expect(take.getByTestId('attendance-state')).toHaveText(
      'Cambios sin guardar',
    )
    await take.getByRole('button', { name: 'Guardar asistencia' }).click()
    await expect(page.getByText('Asistencia guardada')).toBeVisible()
    await expect(take.getByTestId('attendance-state')).toHaveText(
      'Todo guardado',
    )

    // Stored: the day (with the note) and each student's summary (no notes)
    const day = (
      await emulatorDb.doc(`${boardPath}/attendance/${today}`).get()
    ).data()!
    expect(day.topic).toBe('Sesión 4 · Prototipos')
    expect(day.takenBy).toBe(DEMO.teacher)
    expect(day.marks.st_elma).toEqual({ status: 'absent' })
    expect(day.marks.st_sebastian).toEqual({
      status: 'late',
      note: 'Llegó 20 min tarde',
    })
    expect(
      (
        await emulatorDb
          .doc(`${boardPath}/attendanceByStudent/st_sebastian`)
          .get()
      ).data()!.dates,
    ).toEqual({ [today]: 'late' })

    // History: the day, the table, a fix from a cell
    await page.getByRole('tab', { name: 'Historial' }).click()
    await expect(page.getByTestId('attendance-day')).toHaveCount(1)
    await expect(page.getByTestId('attendance-day')).toContainText('Sesión 4')
    const elmaRow = page
      .getByTestId('attendance-table')
      .getByRole('row')
      .filter({ hasText: 'Elma' })
    await expect(elmaRow.getByTestId('attendance-rate')).toHaveText(/^0\s?%$/)
    await elmaRow.getByTestId('attendance-cell').click()
    await page.getByRole('menuitemradio', { name: 'Excusa' }).click()
    await expect(elmaRow.getByTestId('attendance-cell')).toHaveText('E')
    // excused days don't count against the rate
    await expect(elmaRow.getByTestId('attendance-rate')).toHaveText('—')
    await expect
      .poll(
        async () =>
          (
            await emulatorDb
              .doc(`${boardPath}/attendanceByStudent/st_elma`)
              .get()
          ).data()?.dates[today],
      )
      .toBe('excused')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar CSV' }).click()
    const csv = readFileSync(await (await download).path(), 'utf8')
    expect(csv.startsWith('﻿Nombre;Grupo;Correo;')).toBe(true)
    expect(csv).toContain(
      'Sebastian Cetina;Equipo 1;scetina@uni.edu.co;Tarde;100',
    )
    expect(csv).toContain('Elma;Equipo 2;elma@gmail.com;Excusa;')

    // The student sees their own attendance, without the teacher's note
    await signIn(page, 'scetina@uni.edu.co')
    await page.goto(`/b/${DEMO.boardId}/s/st_sebastian`)
    const mine = page.getByTestId('my-attendance')
    await expect(mine).toContainText('Mi asistencia')
    await expect(mine).toContainText('Tarde')
    await expect(mine).not.toContainText('Llegó')
    // …and not a classmate's
    await page.goto(`/b/${DEMO.boardId}/s/st_elma`)
    await expect(page.getByTestId('space-detail')).toBeVisible()
    await expect(page.getByTestId('my-attendance')).toHaveCount(0)
  })

  test('editing a past date from the history, and deleting a day', async ({
    page,
  }) => {
    await seedDay('2026-11-03', { st_elma: 'absent', st_laura: 'present' })
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}/attendance?tab=history`)
    await page.getByTestId('attendance-day').click()
    const take = page.getByTestId('take-attendance')
    await expect(take.getByLabel('Fecha')).toHaveValue('2026-11-03')
    await expect(
      take
        .getByRole('radiogroup', { name: 'Asistencia de Elma' })
        .getByRole('radio', { name: 'Ausente' }),
    ).toHaveAttribute('aria-checked', 'true')

    await take.getByRole('button', { name: 'Eliminar este día' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar este día' })
      .click()
    await expect(page.getByText('Día eliminado')).toBeVisible()
    await expect
      .poll(
        async () =>
          (await emulatorDb.doc(`${boardPath}/attendance/2026-11-03`).get())
            .exists,
      )
      .toBe(false)
    expect(
      (
        await emulatorDb.doc(`${boardPath}/attendanceByStudent/st_elma`).get()
      ).data()!.dates,
    ).toEqual({})
  })

  test('removing a student takes their attendance with them', async ({
    page,
  }) => {
    await seedDay('2026-11-03', { st_carolina: 'absent', st_elma: 'present' })
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await page
      .getByRole('row')
      .filter({ hasText: 'carolina@gmail.com' })
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect
      .poll(async () =>
        Object.keys(
          (
            await emulatorDb.doc(`${boardPath}/attendance/2026-11-03`).get()
          ).data()!.marks,
        ),
      )
      .toEqual(['st_elma'])
    expect(
      (
        await emulatorDb
          .doc(`${boardPath}/attendanceByStudent/st_carolina`)
          .get()
      ).exists,
    ).toBe(false)
  })
})

test.describe("M18 · students' emails", () => {
  test('copy, write (BCC) and filter the emails: group, all addresses, absent on a date', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await seedDay('2026-11-03', { st_elma: 'absent', st_laura: 'present' })
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}`)
    await page.getByRole('button', { name: 'Correos' }).click()
    const dialog = page.getByTestId('emails-dialog')
    await expect(dialog.getByTestId('emails-count')).toHaveText(
      '5 estudiantes · 5 correos',
    )

    await dialog.getByLabel('Para').selectOption({ label: 'Equipo 2' })
    await expect(dialog.getByTestId('emails-count')).toHaveText(
      '2 estudiantes · 2 correos',
    )
    await dialog.getByRole('switch', { name: /Todos sus correos/ }).click()
    await expect(dialog.getByTestId('emails-count')).toHaveText(
      '2 estudiantes · 3 correos',
    )
    await dialog.getByRole('button', { name: 'Copiar correos' }).click()
    await expect(page.getByText('Correos copiados')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'elma@gmail.com, hanna@gmail.com, hbuelvas@uni.edu.co',
    )
    await expect(dialog.getByTestId('emails-write')).toHaveAttribute(
      'href',
      'mailto:?bcc=elma%40gmail.com,hanna%40gmail.com,hbuelvas%40uni.edu.co',
    )

    // Untick one
    await dialog.getByRole('checkbox', { name: /^Elma/ }).click()
    await expect(dialog.getByTestId('emails-count')).toHaveText(
      '1 estudiantes · 2 correos',
    )

    await dialog.getByLabel('Para').selectOption('absent:2026-11-03')
    await expect(dialog.getByTestId('emails-count')).toHaveText(
      '1 estudiantes · 1 correos',
    )
    await expect(dialog).toContainText('elma@gmail.com')
  })
})
