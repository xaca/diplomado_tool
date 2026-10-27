import { describe, expect, it } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  dataUrlToFile,
  filesPayload,
  imageFileIds,
  isAllowedEmbed,
  parseScene,
  planFiles,
  sceneSignature,
  serializeScene,
} from '@/features/slides/engine/scene'
import type { ImageRef } from '@/model'

const el = (props: Record<string, unknown>) =>
  ({ version: 1, isDeleted: false, ...props }) as unknown as ExcalidrawElement

const ref = (assetId: string): ImageRef => ({
  assetId,
  publicId: `pbl/dev/b/s/${assetId}`,
  version: 1,
  width: 10,
  height: 10,
  format: 'webp',
})

describe('slide scene', () => {
  it('stores only live elements and measures the size in bytes', () => {
    const { content, bytes } = serializeScene(
      [
        el({ id: 'a', type: 'text', text: 'Señal' }),
        el({ id: 'b', isDeleted: true }),
      ],
      '#fff',
    )
    const scene = parseScene(content)
    expect(scene.elements.map((e) => e.id)).toEqual(['a'])
    expect(scene.background).toBe('#fff')
    expect(bytes).toBe(new TextEncoder().encode(content).length)
    expect(bytes).toBeGreaterThan(content.length - 1) // "ñ" takes 2 bytes
  })

  it('reads broken or empty content as an empty slide', () => {
    expect(parseScene('not json')).toEqual({
      elements: [],
      background: '#ffffff',
    })
    expect(parseScene(undefined).elements).toEqual([])
  })

  it('finds the images on the slide and which ones still need uploading', () => {
    const elements = [
      el({ type: 'image', fileId: 'f1' }),
      el({ type: 'image', fileId: 'f2' }),
      el({ type: 'image', fileId: 'f1' }), // same image twice
      el({ type: 'image', fileId: 'f3', isDeleted: true }),
      el({ type: 'rectangle' }),
    ]
    const ids = imageFileIds(elements)
    expect(ids).toEqual(['f1', 'f2'])
    const { files, missing } = planFiles(ids, new Map([['f1', ref('a1')]]))
    expect(Object.keys(files)).toEqual(['f1'])
    expect(missing).toEqual(['f2'])
    expect(filesPayload({ f1: ref('a1'), f9: ref('a1') }).assetIds).toEqual([
      'a1',
    ])
  })

  it('turns a pasted image (data URL) into a File', async () => {
    const file = dataUrlToFile('data:image/png;base64,iVBORw0K', 'paste.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(6)
  })

  it('the signature changes on edits, background changes and deletions', () => {
    const a = [el({ id: 'a', version: 1 })]
    const base = sceneSignature(a, '#fff')
    expect(sceneSignature([el({ id: 'a', version: 2 })], '#fff')).not.toBe(base)
    expect(sceneSignature(a, '#000')).not.toBe(base)
    expect(sceneSignature([], '#fff')).not.toBe(base)
    expect(sceneSignature(a, '#fff')).toBe(base)
  })

  it('only lets known video and design sites play live on a slide', () => {
    expect(isAllowedEmbed('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isAllowedEmbed('https://youtu.be/abc')).toBe(true)
    expect(isAllowedEmbed('https://player.vimeo.com/video/1')).toBe(true)
    expect(
      isAllowedEmbed('https://docs.google.com/presentation/d/e/x/embed'),
    ).toBe(true)
    expect(isAllowedEmbed('http://www.youtube.com/watch?v=abc')).toBe(false)
    expect(isAllowedEmbed('https://youtube.com.evil.example/x')).toBe(false)
    expect(isAllowedEmbed('javascript:alert(1)')).toBe(false)
    expect(isAllowedEmbed('not a url')).toBe(false)
  })
})
