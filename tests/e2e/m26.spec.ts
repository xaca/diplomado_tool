import { expect, test, type Page } from '@playwright/test'
import { FieldValue } from 'firebase-admin/firestore'
import { emulatorDb } from '../../scripts/emulator.ts'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { signIn } from './helpers.ts'

// M26: Mensajes — one private conversation per student and course with the course's teachers.
// Text and https links; a 💬 with a badge in the header and on the teacher's home; either side
// starts; "Visto"; only the teacher deletes; classmates never see it.

const SEB = 'scetina@uni.edu.co'
const board = `/b/${DEMO.boardId}`
const conversationPath = `boards/${DEMO.boardId}/conversations/st_sebastian`

const thread = (page: Page) => page.getByTestId('message-thread')
const composer = (page: Page) => page.getByLabel('Escribe un mensaje…')

async function write(page: Page, text: string) {
  await composer(page).fill(text)
  await composer(page).press('Enter')
  await expect(
    thread(page).getByTestId('message').filter({ hasText: text }),
  ).toBeVisible()
  // the box empties once the server has it (leaving earlier would drop a pending write)
  await expect(composer(page)).toHaveValue('')
}

/** The teacher's reply arrives (written straight to the database, as the app would) */
async function teacherReplies(text: string) {
  const message = emulatorDb.collection(`${conversationPath}/messages`).doc()
  const batch = emulatorDb.batch()
  batch.set(message, {
    from: 'teacher',
    authorUid: 'teacher-uid',
    authorName: 'Docente Demo',
    text,
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.update(emulatorDb.doc(conversationPath), {
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessageId: message.id,
    lastFrom: 'teacher',
    lastText: text,
    teacherReadAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M26 · Mensajes', () => {
  test('a student writes; the teacher sees it on the home and the board, opens it and answers with a link; "Visto"', async ({
    page,
  }) => {
    await signIn(page, SEB)
    await page.goto(board)
    await page.getByTestId('messages-button').click()
    await expect(page).toHaveURL(new RegExp(`${board}/mensajes$`))
    await expect(
      page.getByRole('heading', { name: 'Mensajes con tu docente' }),
    ).toBeVisible()
    await expect(page.getByTestId('no-messages')).toBeVisible()
    await expect(thread(page)).toContainText(
      'Solo tú y tu docente ven estos mensajes',
    )
    await write(page, '¿La entrega final es el viernes?')
    // Shift + Enter is a new line, not a send
    await composer(page).fill('Línea 1')
    await composer(page).press('Shift+Enter')
    await expect(thread(page).getByTestId('message')).toHaveCount(1)
    await composer(page).fill('')

    // The teacher: a badge on the course card and on the board's 💬
    await signIn(page, DEMO.teacher)
    await page.goto('/teacher')
    await expect(page.getByTestId('home-messages')).toHaveText(
      '1 mensaje nuevo',
    )
    await page.goto(board)
    await expect(page.getByTestId('messages-badge')).toHaveText('1')
    await page.getByTestId('messages-button').click()
    const item = page.locator(
      '[data-testid="conversation"][data-student="st_sebastian"]',
    )
    await expect(item).toContainText('Sebastian Cetina')
    await expect(item).toContainText('Sin responder')
    await expect(item).toHaveAttribute('data-unread', 'true')
    await item.click()
    await expect(thread(page)).toContainText('¿La entrega final es el viernes?')
    // opened → read: the badge goes
    await expect(page.getByTestId('messages-badge')).toHaveCount(0)
    await write(
      page,
      'Sí, el viernes. Rúbrica: https://forms.gle/abc123 (no javascript:alert(1))',
    )
    await expect(item).not.toContainText('Sin responder')
    await expect(item).toContainText('Tú: Sí, el viernes.')

    // The student: the reply, its link clickable (only https), and "Visto" under their message
    await signIn(page, SEB)
    await page.goto(board)
    await expect(page.getByTestId('messages-badge')).toHaveText('1')
    await page.getByTestId('messages-button').click()
    const reply = thread(page)
      .getByTestId('message')
      .filter({ hasText: 'Rúbrica' })
    await expect(reply).toContainText('Docente')
    await expect(
      reply.getByRole('link', { name: 'https://forms.gle/abc123' }),
    ).toHaveAttribute('href', 'https://forms.gle/abc123')
    await expect(reply.getByRole('link')).toHaveCount(1)
    // the teacher had opened it after Sebastian's question: "Visto" under it
    await expect(thread(page).getByTestId('seen')).toBeVisible()
    await expect(page.getByTestId('messages-badge')).toHaveCount(0)
  })

  test('the student is told when the teacher writes while they are elsewhere; "Visto" shows once the teacher opened it', async ({
    page,
  }) => {
    await signIn(page, SEB)
    await page.goto(`${board}/mensajes`)
    await write(page, 'Profe, ¿me revisa el prototipo?')
    await page.goto(board)
    await expect(page.getByTestId('messages-button')).toBeVisible()
    await teacherReplies('Claro, mañana en clase')
    await expect(page.getByText('Tu docente te escribió')).toBeVisible()
    await expect(page.getByTestId('messages-badge')).toHaveText('1')
    await page.getByTestId('messages-button').click()
    await expect(thread(page)).toContainText('Claro, mañana en clase')
    // the teacher read it after Sebastian's message (teacherReadAt moved): "Visto"
    await write(page, 'Gracias')
    await emulatorDb
      .doc(conversationPath)
      .update({ teacherReadAt: FieldValue.serverTimestamp() })
    await expect(thread(page).getByTestId('seen')).toBeVisible()
  })

  test('the teacher starts a conversation from Estudiantes, deletes a message, marks unread and deletes the conversation', async ({
    page,
  }) => {
    await signIn(page, DEMO.teacher)
    await page.goto(`/teacher/boards/${DEMO.boardId}/students`)
    await page
      .getByRole('button', { name: 'Escribir a Sebastian Cetina' })
      .click()
    await expect(page).toHaveURL(
      new RegExp(`${board}/mensajes\\?s=st_sebastian$`),
    )
    await expect(page.getByTestId('thread-name')).toHaveText('Sebastian Cetina')
    await write(page, 'Hola Sebastian, ¿cómo vas con el prototipo?')
    await page.waitForTimeout(2100)
    await write(page, 'Mensaje por error')

    // delete the last one: gone, and the preview goes back to the one before
    const wrong = thread(page)
      .getByTestId('message')
      .filter({ hasText: 'Mensaje por error' })
    await wrong.hover()
    await wrong.getByRole('button', { name: 'Eliminar mensaje' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(wrong).toHaveCount(0)
    // the delete reached the server before switching accounts
    await expect
      .poll(async () =>
        (
          await emulatorDb.collection(`${conversationPath}/messages`).get()
        ).docs.map((d) => d.data().text),
      )
      .toEqual(['Hola Sebastian, ¿cómo vas con el prototipo?'])
    const item = page.locator(
      '[data-testid="conversation"][data-student="st_sebastian"]',
    )
    await expect(item).toContainText('Tú: Hola Sebastian')

    // the student sees only what's left
    await signIn(page, SEB)
    await page.goto(`${board}/mensajes`)
    await expect(thread(page).getByTestId('message')).toHaveCount(1)
    await expect(thread(page)).not.toContainText('Mensaje por error')
    await write(page, 'Bien, profe')

    // the teacher: "Marcar como no leído" brings the badge back; then delete the conversation
    await signIn(page, DEMO.teacher)
    await page.goto(`${board}/mensajes?s=st_sebastian`)
    await expect(thread(page)).toContainText('Bien, profe')
    await page.getByRole('button', { name: 'Marcar como no leído' }).click()
    await expect(page.getByTestId('messages-badge')).toHaveText('1')
    await item.click()
    await page.getByRole('button', { name: 'Eliminar conversación' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Eliminar' })
      .click()
    await expect(item).toHaveCount(0)
    await expect
      .poll(async () => (await emulatorDb.doc(conversationPath).get()).exists)
      .toBe(false)
  })

  test("a classmate never sees another student's conversation", async ({
    page,
  }) => {
    await signIn(page, SEB)
    await page.goto(`${board}/mensajes`)
    await write(page, 'Algo privado')
    await signIn(page, 'elma@gmail.com')
    // even with the teacher's link to Sebastian's conversation, Elma sees only her own
    await page.goto(`${board}/mensajes?s=st_sebastian`)
    await expect(page.getByTestId('no-messages')).toBeVisible()
    await expect(page.getByText('Algo privado')).toHaveCount(0)
    await expect(page.getByTestId('conversation-list')).toHaveCount(0)
  })
})
