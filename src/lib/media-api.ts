import { env } from '@/lib/env'
import { auth } from '@/lib/firebase'

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
}
