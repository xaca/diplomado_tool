import { env } from '@/lib/env'
import { appCheckToken, auth } from '@/lib/firebase'

// Typed client for the media-api Worker (services/media-api).
// Features call these functions; components never fetch the Worker directly.

export type HealthResponse = {
  ok: boolean
  config: 'ok' | 'missing CLOUDINARY_API_SECRET'
}

export type SignedUpload = {
  assetId: string
  cloudName: string
  apiKey: string
  params: Record<string, string | number>
  signature: string
}

export type DeleteAssetsResponse = {
  results: Record<string, 'deleted' | 'not_found' | 'skipped'>
}

export type PurgeResponse = { deleted: number; complete: boolean }

export type CloudinaryUsage = {
  credits: { used: number; limit: number; percent: number }
  storageBytes: number
  bandwidthBytes: number
  transformations: number
  images: number
  updatedAt: string | null
}

/** Free Workers plan: the Worker accepts at most this many assets per delete call */
export const MAX_DELETE_BATCH = 40

export class MediaApiError extends Error {
  readonly status: number

  constructor(status: number, path: string) {
    super(`media-api ${path} failed: ${status}`)
    this.status = status
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (authenticated) {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new MediaApiError(401, path)
    headers.set('Authorization', `Bearer ${token}`)
    const appCheck = await appCheckToken()
    if (appCheck) headers.set('X-Firebase-AppCheck', appCheck)
  }
  const response = await fetch(`${env.VITE_MEDIA_API_URL}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) throw new MediaApiError(response.status, path)
  return response.json() as Promise<T>
}

export const mediaApi = {
  health: () => request<HealthResponse>('/health'),

  /** Asks the Worker to sign an upload into this student's space (it checks permissions). */
  signUpload: (boardId: string, studentId: string) =>
    request<SignedUpload>(
      '/uploads/sign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, studentId }),
      },
      true,
    ),

  /** Deletes unused images (already marked "orphaned") from Cloudinary. Board teacher only. */
  deleteAssets: (boardId: string, assetIds: string[]) =>
    request<DeleteAssetsResponse>(
      '/assets/delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, assetIds }),
      },
      true,
    ),

  /** Deletes all images of an archived board. Call again until `complete`. */
  purgeBoard: (boardId: string) =>
    request<PurgeResponse>(
      '/boards/purge',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
      },
      true,
    ),

  /** Cloudinary credits used this month. Teachers only. */
  usage: () => request<CloudinaryUsage>('/usage', {}, true),
}
