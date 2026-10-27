import type { AssetDoc, ImageRef } from '@/model'

// Storage analysis (PLAN.md → Data lifecycle → Unused images). Pure: shared with the admin CLI.
// Unused = registered images that no slide and no card cover references any more.

/** Images younger than this are never "unused": they may be in the middle of an edit. */
export const UNUSED_GRACE_MS = 24 * 60 * 60 * 1000

export type AssetRow = Pick<
  AssetDoc,
  'publicId' | 'studentId' | 'kind' | 'bytes' | 'status'
> & { id: string; createdAt: Date }

type Input = {
  assets: readonly AssetRow[]
  covers: readonly (Pick<ImageRef, 'assetId'> | null | undefined)[]
  slideAssetIds: readonly (readonly string[])[]
  now?: number
}

export type StorageReport = {
  /** Images still stored in Cloudinary (not deleted) */
  stored: { count: number; bytes: number }
  used: AssetRow[]
  unused: AssetRow[]
  unusedBytes: number
  /** Unused, but too recent to clean up yet */
  recent: number
}

export function analyzeStorage({
  assets,
  covers,
  slideAssetIds,
  now = Date.now(),
}: Input): StorageReport {
  const referenced = new Set<string>()
  for (const cover of covers) if (cover) referenced.add(cover.assetId)
  for (const ids of slideAssetIds) for (const id of ids) referenced.add(id)

  const used: AssetRow[] = []
  const unused: AssetRow[] = []
  let recent = 0
  let storedBytes = 0
  let storedCount = 0
  for (const asset of assets) {
    if (asset.status === 'deleted') continue
    storedCount += 1
    storedBytes += asset.bytes
    // A reference always wins, even over an "orphaned" mark (e.g. a cover set back again)
    if (referenced.has(asset.id)) used.push(asset)
    else if (now - asset.createdAt.getTime() < UNUSED_GRACE_MS) {
      recent += 1
      used.push(asset)
    } else unused.push(asset)
  }
  return {
    stored: { count: storedCount, bytes: storedBytes },
    used,
    unused,
    unusedBytes: unused.reduce((sum, asset) => sum + asset.bytes, 0),
    recent,
  }
}

/** Splits ids into Worker-sized batches. */
export function chunk<T>(items: readonly T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size)
    chunks.push(items.slice(i, i + size))
  return chunks
}

export function formatBytes(bytes: number, locale = 'es') {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`
}
