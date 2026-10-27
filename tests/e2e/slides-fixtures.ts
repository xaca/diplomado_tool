import { FieldValue } from 'firebase-admin/firestore'
import { DEMO } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'

// Slides written straight to the emulator (as if a student had made them in the editor).

export const spacePath = (studentId: string) =>
  `boards/${DEMO.boardId}/spaces/${studentId}`

// Minimal stored Excalidraw elements (restoreElements fills in the rest)
export const base = (id: string) => ({
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
export const textElement = (text: string) => ({
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
export const embedElement = (id: string, link: string, y: number) => ({
  ...base(id),
  type: 'embeddable',
  y,
  width: 320,
  height: 180,
  link,
})

export async function seedSlides(studentId: string, slides: object[][]) {
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
