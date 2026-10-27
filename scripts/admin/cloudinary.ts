import { existsSync } from 'node:fs'
import path from 'node:path'

// Cloudinary Admin API for the CLI (same calls as the media-api Worker). Credentials come from
// .env.admin.local (git-ignored) or the environment; they are never printed.

const ENV_FILE = path.resolve(import.meta.dirname, '../../.env.admin.local')
// Variables already set (tests: fake credentials + local fake server) are never replaced
if (!process.env.CLOUDINARY_API_SECRET && existsSync(ENV_FILE))
  process.loadEnvFile(ENV_FILE)

function credentials() {
  const {
    CLOUDINARY_CLOUD_NAME: cloud,
    CLOUDINARY_API_KEY: key,
    CLOUDINARY_API_SECRET: secret,
  } = process.env
  if (!cloud || !key || !secret)
    throw new Error(
      'Missing Cloudinary credentials: create .env.admin.local with CLOUDINARY_CLOUD_NAME, ' +
        'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET (see PLAN.md → Admin CLI).',
    )
  const base = process.env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com'
  return {
    url: `${base}/v1_1/${cloud}`,
    authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
  }
}

async function call<T>(
  method: 'GET' | 'DELETE',
  route: string,
  query = new URLSearchParams(),
) {
  const { url, authorization } = credentials()
  const response = await fetch(
    `${url}${route}${query.size ? `?${query}` : ''}`,
    { method, headers: { Authorization: authorization } },
  )
  if (!response.ok)
    throw new Error(`Cloudinary ${method} ${route}: ${response.status}`)
  return (await response.json()) as T
}

/** Deletes these public ids (up to 100 per call, as the API allows). */
export async function deleteImages(publicIds: string[]) {
  const results: Record<string, string> = {}
  for (let i = 0; i < publicIds.length; i += 100) {
    const query = new URLSearchParams()
    for (const id of publicIds.slice(i, i + 100))
      query.append('public_ids[]', id)
    const body = await call<{ deleted?: Record<string, string> }>(
      'DELETE',
      '/resources/image/upload',
      query,
    )
    Object.assign(results, body.deleted)
  }
  return results
}

/** Deletes everything under a folder prefix (1000 images per call, repeated until done). */
export async function deleteFolder(prefix: string) {
  let deleted = 0
  for (;;) {
    const body = await call<{
      deleted?: Record<string, string>
      partial?: boolean
    }>('DELETE', '/resources/image/upload', new URLSearchParams({ prefix }))
    deleted += Object.keys(body.deleted ?? {}).length
    if (!body.partial) return deleted
  }
}

export async function cloudinaryUsage() {
  const body = await call<{
    credits?: { usage?: number; limit?: number; used_percent?: number }
    storage?: { usage?: number }
    bandwidth?: { usage?: number }
  }>('GET', '/usage')
  return {
    used: body.credits?.usage ?? 0,
    limit: body.credits?.limit ?? 0,
    percent: body.credits?.used_percent ?? 0,
    storageBytes: body.storage?.usage ?? 0,
    bandwidthBytes: body.bandwidth?.usage ?? 0,
  }
}
