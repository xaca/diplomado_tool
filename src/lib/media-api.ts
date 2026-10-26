import { env } from '@/lib/env'

// Typed client for the media-api Worker (services/media-api).
// Features call these functions; components never fetch the Worker directly.

export type HealthResponse = {
  ok: boolean
  config: 'ok' | 'missing CLOUDINARY_API_SECRET'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${env.VITE_MEDIA_API_URL}${path}`, init)
  if (!response.ok) {
    throw new Error(`media-api ${path} failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const mediaApi = {
  health: () => request<HealthResponse>('/health'),
}
