import { env } from '@/lib/env'
import type { ImageRef } from '@/model'

// Browser-side Cloudinary helpers: URL building only.
// Uploads are signed by the media-api Worker; the API secret never reaches the app.

export type { ImageRef } from '@/model'

type ImageSize = {
  w?: number
  h?: number
  crop?: 'fill' | 'limit' | 'fit'
}

/** Presets used across the app (see PLAN.md → Images → Delivery). */
export const IMAGE_SIZES = {
  cardCover: { w: 400, h: 225, crop: 'fill' },
  slide: { w: 1280, crop: 'limit' },
  present: { w: 1920, crop: 'limit' },
  /** Board logo (M12): header, "Mis tableros", presenter */
  logo: { w: 320, h: 160, crop: 'fit' },
} as const satisfies Record<string, ImageSize>

export function imageUrl(
  ref: Pick<ImageRef, 'publicId' | 'version'>,
  { w, h, crop = 'limit' }: ImageSize = {},
) {
  const transformations = [
    'f_auto',
    'q_auto',
    `c_${crop}`,
    w && `w_${w}`,
    h && `h_${h}`,
  ]
    .filter(Boolean)
    .join(',')

  return `https://res.cloudinary.com/${env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/v${ref.version}/${ref.publicId}`
}
