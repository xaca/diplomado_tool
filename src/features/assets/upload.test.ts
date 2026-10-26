import { describe, expect, it } from 'vitest'
import {
  checkFile,
  fitWithin,
  needsResize,
} from '@/features/assets/prepare-image'
import { toImageRef, UploadError } from '@/features/assets/upload'

const MB = 1024 * 1024

describe('checkFile', () => {
  it('accepts common image types up to 30 MB', () => {
    expect(checkFile({ type: 'image/jpeg', size: 12 * MB })).toBeNull()
    expect(checkFile({ type: 'image/png', size: 1 })).toBeNull()
    expect(checkFile({ type: 'image/gif', size: 1 })).toBeNull()
  })

  it('rejects other types and huge files', () => {
    expect(checkFile({ type: 'application/pdf', size: 1 })).toBe('type')
    expect(checkFile({ type: 'image/svg+xml', size: 1 })).toBe('type')
    expect(checkFile({ type: 'image/jpeg', size: 31 * MB })).toBe('tooLarge')
  })
})

describe('fitWithin', () => {
  it('scales the long side down to 2560, keeping the ratio', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2560, height: 1920 })
    expect(fitWithin(1080, 1920)).toEqual({ width: 1080, height: 1920 })
  })

  it('never upscales', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('needsResize', () => {
  it('re-encodes big photos but keeps small ones and GIFs', () => {
    expect(needsResize({ type: 'image/jpeg', size: 4 * MB }, 4032, 3024)).toBe(
      true,
    )
    expect(needsResize({ type: 'image/jpeg', size: 300_000 }, 1200, 800)).toBe(
      false,
    )
    expect(needsResize({ type: 'image/gif', size: 5 * MB }, 4000, 3000)).toBe(
      false,
    )
  })
})

describe('toImageRef', () => {
  const signed = { assetId: 'a1', params: { public_id: 'pbl/dev/b/s/a1' } }

  it('keeps what we store in Firestore', () => {
    const ref = toImageRef(signed, {
      public_id: 'pbl/dev/b/s/a1',
      version: 1730000000,
      width: 1600,
      height: 900,
      format: 'webp',
      bytes: 123,
      secure_url: 'https://…',
    })
    expect(ref).toEqual({
      assetId: 'a1',
      publicId: 'pbl/dev/b/s/a1',
      version: 1730000000,
      width: 1600,
      height: 900,
      format: 'webp',
      bytes: 123,
    })
  })

  it('rejects an answer for a different upload', () => {
    expect(() => toImageRef(signed, { public_id: 'other' })).toThrow(
      UploadError,
    )
  })
})
