import { describe, expect, it } from 'vitest'
import {
  analyzeStorage,
  chunk,
  formatBytes,
  type AssetRow,
} from '@/features/storage/analysis'

const NOW = Date.UTC(2026, 9, 27, 12)
const HOUR = 60 * 60 * 1000

const asset = (id: string, overrides: Partial<AssetRow> = {}): AssetRow => ({
  id,
  publicId: `pbl/prod/b1/st_1/${id}`,
  studentId: 'st_1',
  kind: 'slide',
  bytes: 100,
  status: 'active',
  createdAt: new Date(NOW - 48 * HOUR),
  ...overrides,
})

describe('storage analysis', () => {
  it('finds images that no slide and no cover uses', () => {
    const report = analyzeStorage({
      assets: [
        asset('inSlide'),
        asset('cover', { kind: 'cover' }),
        asset('old'),
        asset('replacedCover', { kind: 'cover', status: 'orphaned' }),
        asset('gone', { status: 'deleted', bytes: 999 }),
      ],
      covers: [{ assetId: 'cover' }, null, undefined],
      slideAssetIds: [['inSlide'], []],
      now: NOW,
    })
    expect(report.used.map((a) => a.id)).toEqual(['inSlide', 'cover'])
    expect(report.unused.map((a) => a.id)).toEqual(['old', 'replacedCover'])
    expect(report.unusedBytes).toBe(200)
    // deleted images no longer count as stored
    expect(report.stored).toEqual({ count: 4, bytes: 400 })
  })

  it('never offers images from the last 24 h (they may be mid-edit)', () => {
    const report = analyzeStorage({
      assets: [asset('fresh', { createdAt: new Date(NOW - 2 * HOUR) })],
      covers: [],
      slideAssetIds: [],
      now: NOW,
    })
    expect(report.unused).toEqual([])
    expect(report.recent).toBe(1)
  })

  it('a reference wins over an "orphaned" mark', () => {
    const report = analyzeStorage({
      assets: [asset('back', { status: 'orphaned' })],
      covers: [{ assetId: 'back' }],
      slideAssetIds: [],
      now: NOW,
    })
    expect(report.unused).toEqual([])
  })

  it('splits into batches and formats sizes', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 40)).toEqual([])
    expect(formatBytes(512, 'en')).toBe('512 B')
    expect(formatBytes(1536, 'en')).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024, 'en')).toBe('5 MB')
  })
})
