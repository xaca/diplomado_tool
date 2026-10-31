import type { User } from 'firebase/auth'
import {
  sendToCloudinary,
  UploadError,
  type CloudinaryResponse,
} from '@/features/assets/upload'
import { clearAvatar, myMemberships, saveAvatar } from '@/features/profile/api'
import { mediaApi } from '@/lib/media-api'

// Uploaded profile photo (M11, PLAN.md → Images → Profile photos). One fixed Cloudinary file per
// person, overwritten on change: the browser crops a square, the Worker signs, Cloudinary stores.

export const AVATAR_SIZE = 512
export const MAX_ZOOM = 4

/**
 * The square of the picture to keep (pure, unit-tested). `zoom` 1 = the largest square that fits;
 * `x` / `y` move its center, as a share of the room left on each side (-1 … 1).
 */
export function cropSquare(
  width: number,
  height: number,
  zoom: number,
  x: number,
  y: number,
) {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))
  const size = Math.min(width, height) / clamp(zoom, 1, MAX_ZOOM)
  const roomX = (width - size) / 2
  const roomY = (height - size) / 2
  return {
    sx: roomX + clamp(x, -1, 1) * roomX,
    sy: roomY + clamp(y, -1, 1) * roomY,
    size,
  }
}

/** Draws the chosen square at 512 × 512 and encodes it as WebP. */
export async function renderAvatar(
  bitmap: ImageBitmap,
  crop: ReturnType<typeof cropSquare>,
) {
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  canvas
    .getContext('2d')!
    .drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.size,
      crop.size,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  )
  if (!blob) throw new UploadError('type')
  return blob
}

/** Teachers sign by their role; students prove one membership (any board). */
async function proofBoardId(user: User, isTeacher: boolean) {
  if (isTeacher) return undefined
  const memberships = await myMemberships(user.uid)
  return memberships.docs[0]?.ref.parent.parent?.id
}

export async function uploadAvatar(
  user: User,
  photo: Blob,
  isTeacher: boolean,
  onProgress?: (percent: number) => void,
) {
  let signed
  try {
    signed = await mediaApi.signAvatar(await proofBoardId(user, isTeacher))
  } catch (error) {
    const status = (error as { status?: number }).status
    throw new UploadError(
      status === 401 || status === 403 ? 'forbidden' : 'network',
      'sign',
      { cause: error },
    )
  }
  const response = (await sendToCloudinary(
    signed,
    photo,
    onProgress,
  )) as Partial<CloudinaryResponse> | null
  if (
    response?.public_id !== signed.params.public_id ||
    typeof response.version !== 'number'
  )
    throw new UploadError('network', 'response', { cause: response })
  return saveAvatar(user, {
    publicId: response.public_id,
    version: response.version,
  })
}

/** "Quitar foto": deletes it from Cloudinary, then goes back to the Google photo. */
export async function removeAvatar(user: User) {
  await mediaApi.deleteAvatar()
  return clearAvatar(user)
}
