import { MAX_UPLOAD_BYTES } from '@/model'

// Shrinks images in the browser before uploading (PLAN.md → Image pipeline, step 2):
// faster on phones and fewer Cloudinary credits. Pure helpers are unit-tested.

export const MAX_DIMENSION = 2560
/** Phones produce 10–20 MB photos; we accept them because they shrink a lot */
export const MAX_INPUT_BYTES = 30 * 1024 * 1024
export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type FileProblem = 'type' | 'tooLarge' | null

export function checkFile(file: { type: string; size: number }): FileProblem {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'type'
  if (file.size > MAX_INPUT_BYTES) return 'tooLarge'
  return null
}

/** Largest size that fits in max × max keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION) {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

/** Should we re-encode, or is the original already fine? (GIFs keep their animation.) */
export function needsResize(
  file: { type: string; size: number },
  width: number,
  height: number,
  max = MAX_DIMENSION,
) {
  if (file.type === 'image/gif') return false
  return Math.max(width, height) > max || file.size > 1.5 * 1024 * 1024
}

/** `max`: longest side in px (2560 for slides; smaller for logos). */
export async function prepareImage(
  file: File,
  max = MAX_DIMENSION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    if (!needsResize(file, bitmap.width, bitmap.height, max)) {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('tooLarge')
      return file
    }
    const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)

    for (const quality of [0.85, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', quality),
      )
      if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob
    }
    throw new Error('tooLarge')
  } finally {
    bitmap.close()
  }
}
