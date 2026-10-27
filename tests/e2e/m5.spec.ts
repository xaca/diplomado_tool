import { expect, test, type Page } from '@playwright/test'
import { FieldValue } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'
import { signIn } from './helpers.ts'
import { fakeMediaServices } from './media-fakes.ts'

// Slides with Excalidraw: the real editor (lazy chunk) on the emulators; Worker/Cloudinary faked.

const spacePath = (studentId: string) =>
  `boards/${DEMO.boardId}/spaces/${studentId}`
const editorUrl = (studentId: string) =>
  `/b/${DEMO.boardId}/s/${studentId}/edit`
const viewerUrl = (studentId: string) => `/b/${DEMO.boardId}/s/${studentId}`

async function openEditor(page: Page, email = 'laura@gmail.com') {
  await signIn(page, email)
  await page.goto(editorUrl('st_laura'))
}

async function createFirstSlide(page: Page) {
  await page
    .getByRole('button', { name: 'Crear la primera diapositiva' })
    .click()
  await expect(page.locator('.excalidraw .App-toolbar')).toBeVisible()
}

/** Text tool → click on the slide → type → leave the text box. */
async function writeText(page: Page, text: string) {
  const canvas = page.locator('canvas.excalidraw__canvas.interactive')
  const box = (await canvas.boundingBox())!
  // The toolbar radio is visually hidden behind its icon
  await page.getByTestId('toolbar-text').click({ force: true })
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.type(text)
  await page.keyboard.press('Escape')
}

async function savedSlides(studentId: string) {
  const space = (await emulatorDb.doc(spacePath(studentId)).get()).data()!
  const slides = await emulatorDb
    .collection(`${spacePath(studentId)}/slides`)
    .get()
  return {
    order: space.slideOrder as string[],
    count: space.slideCount as number,
    slides: new Map(slides.docs.map((doc) => [doc.id, doc.data()])),
  }
}

// Minimal stored Excalidraw elements (restoreElements fills in the rest)
const base = (id: string) => ({
  id,
  x: 100,
  y: 100,
  angle: 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
})
const textElement = (text: string) => ({
  ...base(`text-${text.length}`),
  type: 'text',
  width: 400,
  height: 45,
  text,
  originalText: text,
  fontSize: 36,
  fontFamily: 5,
  textAlign: 'left',
  verticalAlign: 'top',
  containerId: null,
  lineHeight: 1.25,
  autoResize: true,
})
const embedElement = (id: string, link: string, y: number) => ({
  ...base(id),
  type: 'embeddable',
  y,
  width: 320,
  height: 180,
  link,
})

async function seedSlides(studentId: string, slides: object[][]) {
  const ids = slides.map((_, index) => `slide${index + 1}`)
  const batch = emulatorDb.batch()
  slides.forEach((elements, index) => {
    const content = JSON.stringify({ elements, background: '#ffffff' })
    batch.set(emulatorDb.doc(`${spacePath(studentId)}/slides/${ids[index]}`), {
      engine: 'excalidraw',
      content,
      files: {},
      assetIds: [],
      bytes: content.length,
      schemaVersion: 1,
      updatedAt: FieldValue.serverTimestamp(),
    })
  })
  batch.update(emulatorDb.doc(spacePath(studentId)), {
    slideOrder: ids,
    slideCount: ids.length,
  })
  await batch.commit()
}

test.beforeEach(async () => {
  await seedDemo()
})

test.describe('M5 · slides', () => {
  test('a student creates a slide, writes on it and it saves by itself', async ({
    page,
  }) => {
    await openEditor(page)
    await createFirstSlide(page)
    await writeText(page, 'Hola PBL')

    // Autosave after a few seconds idle
    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 15_000,
    })
    const saved = await savedSlides('st_laura')
    expect(saved.count).toBe(1)
    const slide = saved.slides.get(saved.order[0])!
    expect(slide).toMatchObject({ engine: 'excalidraw', schemaVersion: 1 })
    expect(slide.content).toContain('Hola PBL')
    // The fixed 16:9 frame keeps its id (the viewer exports exactly that area)
    expect(slide.content).toContain('"id":"slide-frame"')
    expect(slide.bytes).toBeGreaterThan(0)

    // Reloading the editor shows the same slide (with its text)
    await page.reload()
    await expect(page.getByTestId('slide-item')).toHaveCount(1)
    await expect(
      page.getByTestId('slide-item').getByTestId('slide-preview'),
    ).toContainText('Hola PBL')
  })

  test('adding, duplicating, deleting and reordering slides', async ({
    page,
  }) => {
    await openEditor(page)
    await createFirstSlide(page)
    await writeText(page, 'Primera')
    const items = page.getByTestId('slide-item')

    await page.getByRole('button', { name: 'Nueva' }).click()
    await expect(items).toHaveCount(2)
    // Switching slides saves the one being edited
    await expect
      .poll(async () => {
        const saved = await savedSlides('st_laura')
        return saved.slides.get(saved.order[0])?.content as string
      })
      .toContain('Primera')

    await page.getByRole('button', { name: 'Duplicar diapositiva 1' }).click()
    await expect(items).toHaveCount(3)
    await expect(items.nth(1).getByTestId('slide-preview')).toContainText(
      'Primera',
    )

    await page.getByRole('button', { name: 'Eliminar diapositiva 3' }).click()
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(items).toHaveCount(2)

    // Keyboard reorder: move slide 1 after slide 2
    await expect
      .poll(async () => (await savedSlides('st_laura')).order)
      .toHaveLength(2)
    const before = (await savedSlides('st_laura')).order
    const handle = page.getByRole('button', { name: 'Mover diapositiva 1' })
    await handle.focus()
    await page.keyboard.press('Space')
    await expect(handle).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    await expect(handle).not.toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => (await savedSlides('st_laura')).order)
      .toEqual([before[1], before[0]])
    const saved = await savedSlides('st_laura')
    expect(saved.count).toBe(2)
    expect([...saved.slides.keys()].sort()).toEqual([...saved.order].sort())
  })

  test('an image added to a slide is uploaded (signed) and stored as a Cloudinary reference', async ({
    page,
  }) => {
    const fakes = await fakeMediaServices(page)
    await openEditor(page)
    await createFirstSlide(page)

    // Drop a 200×120 PNG on the canvas, like dragging a file from the computer
    await page.evaluate(async () => {
      const canvas = new OffscreenCanvas(200, 120)
      const context = canvas.getContext('2d')!
      context.fillStyle = '#3b82f6'
      context.fillRect(0, 0, 200, 120)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([blob], 'diagrama.png', { type: 'image/png' }),
      )
      const target = document.querySelector(
        'canvas.excalidraw__canvas.interactive',
      )!
      const { x, y, width, height } = target.getBoundingClientRect()
      target.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: transfer,
          clientX: x + width / 2,
          clientY: y + height / 2,
          bubbles: true,
          cancelable: true,
        }),
      )
    })

    await expect(page.getByTestId('save-status')).toHaveText('Guardado', {
      timeout: 20_000,
    })
    expect(fakes.signRequests).toHaveLength(1)
    expect(fakes.signRequests[0].body).toEqual({
      boardId: DEMO.boardId,
      studentId: 'st_laura',
    })

    const saved = await savedSlides('st_laura')
    const slide = saved.slides.get(saved.order[0])!
    const refs = Object.values(
      slide.files as Record<string, { publicId: string }>,
    )
    expect(refs).toHaveLength(1)
    expect(refs[0].publicId).toBe(`pbl/dev/${DEMO.boardId}/st_laura/asset1`)
    expect(slide.assetIds).toEqual(['asset1'])
    // The scene never contains the image data itself
    expect(slide.content).not.toContain('data:image')
    const asset = await emulatorDb
      .doc(`boards/${DEMO.boardId}/assets/asset1`)
      .get()
    expect(asset.data()).toMatchObject({ kind: 'slide', status: 'active' })
  })

  test('classmates and the teacher see the slides read-only', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [
      [textElement('Problema')],
      [textElement('Prototipo')],
    ])

    await signIn(page, 'laura@gmail.com')
    await page.goto(viewerUrl('st_sebastian'))
    const previews = page
      .getByTestId('slides-viewer')
      .getByTestId('slide-preview')
    await expect(previews).toHaveCount(2)
    await expect(previews.first()).toContainText('Problema')
    await expect(previews.last()).toContainText('Prototipo')
    await expect(
      page.getByRole('button', { name: 'Editar diapositivas' }),
    ).toHaveCount(0)

    // The editor of someone else's space sends you back to the viewer
    await page.goto(editorUrl('st_sebastian'))
    await expect(page).toHaveURL(new RegExp(`${viewerUrl('st_sebastian')}$`))

    // The teacher sees the same slides, and the slide count on the card
    await signIn(page, DEMO.teacher)
    await page.goto(`/b/${DEMO.boardId}`)
    await expect(
      page.getByTestId('space-card').filter({ hasText: 'Sebastian' }),
    ).toContainText('2 diapositivas')
    await page.goto(viewerUrl('st_sebastian'))
    await expect(
      page.getByTestId('slides-viewer').getByTestId('slide-preview'),
    ).toHaveCount(2)
  })

  test('only allow-listed videos play inside a slide, always sandboxed', async ({
    page,
  }) => {
    await seedSlides('st_sebastian', [
      [
        embedElement(
          'video',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          100,
        ),
        embedElement('evil', 'https://evil.example/phishing', 320),
      ],
    ])
    await page.route('https://www.youtube.com/**', (route) =>
      route.fulfill({ body: '<html></html>', contentType: 'text/html' }),
    )
    await signIn(page, 'laura@gmail.com')
    await page.goto(viewerUrl('st_sebastian'))

    const frames = page.getByTestId('slides-viewer').locator('iframe')
    await expect(frames).toHaveCount(1)
    await expect(frames).toHaveAttribute(
      'src',
      /youtube\.com\/embed\/dQw4w9WgXcQ/,
    )
    await expect(frames).toHaveAttribute('sandbox', /allow-scripts/)
  })

  test('a locked board opens the slides read-only, even for the owner', async ({
    page,
  }) => {
    await openEditor(page)
    await createFirstSlide(page)
    // The owner reaches the editor from their space page
    await page.goto(viewerUrl('st_laura'))
    await page.getByRole('button', { name: 'Editar diapositivas' }).click()
    await expect(page).toHaveURL(new RegExp(`${editorUrl('st_laura')}$`))
    await expect(page.getByTestId('slide-item')).toHaveCount(1)

    await emulatorDb.doc(`boards/${DEMO.boardId}`).update({ status: 'locked' })
    await expect(page).toHaveURL(new RegExp(`${viewerUrl('st_laura')}$`))
    await expect(
      page.getByRole('button', { name: 'Editar diapositivas' }),
    ).toHaveCount(0)
  })
})
