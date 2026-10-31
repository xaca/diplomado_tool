import type { Page } from '@playwright/test'

// The Worker and Cloudinary faked at the network level (no real uploads, no secrets).

export const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
)

export type Fakes = {
  signRequests: { authorization: string | null; body: unknown }[]
}

export async function fakeMediaServices(
  page: Page,
  options: { signStatus?: number } = {},
): Promise<Fakes> {
  const fakes: Fakes = { signRequests: [] }
  let counter = 0

  await page.route('http://localhost:8787/uploads/sign', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors() })
    const body = request.postDataJSON() as {
      boardId: string
      studentId: string
      scope?: string
    }
    fakes.signRequests.push({
      authorization: await request.headerValue('authorization'),
      body,
    })
    if (options.signStatus)
      return route.fulfill({
        status: options.signStatus,
        headers: cors(),
        json: { error: 'x' },
      })
    if (body.scope === 'avatar') {
      // Like the Worker: the caller's own folder (emulator tokens are unsigned JWTs)
      const token = (await request.headerValue('authorization')) ?? ''
      const { user_id: uid } = JSON.parse(
        Buffer.from(token.split('.')[1] ?? '', 'base64url').toString() || '{}',
      ) as { user_id?: string }
      return route.fulfill({
        headers: cors(),
        json: {
          assetId: 'avatar',
          cloudName: 'syqkgwws',
          apiKey: 'test-key',
          signature: 'test-signature',
          params: { public_id: `pbl/dev/users/${uid}/avatar`, timestamp: 1 },
        },
      })
    }
    counter += 1
    const assetId = `asset${counter}`
    await route.fulfill({
      headers: cors(),
      json: {
        assetId,
        cloudName: 'syqkgwws',
        apiKey: 'test-key',
        signature: 'test-signature',
        params: {
          public_id: `pbl/dev/${body.boardId}/${body.studentId}/${assetId}`,
          timestamp: 1,
        },
      },
    })
  })

  await page.route(
    'https://api.cloudinary.com/v1_1/syqkgwws/image/upload',
    async (route) => {
      const form = route.request().postData() ?? ''
      const publicId = /name="public_id"\r\n\r\n([^\r]+)/.exec(form)?.[1]
      await route.fulfill({
        json: {
          public_id: publicId,
          version: 1730000000,
          width: 1,
          height: 1,
          format: 'png',
          bytes: PNG_1x1.length,
        },
      })
    },
  )

  await page.route('https://res.cloudinary.com/**', (route) =>
    route.fulfill({ body: PNG_1x1, contentType: 'image/png' }),
  )
  await page.route('http://localhost:8787/avatar/delete', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors() })
      : route.fulfill({ headers: cors(), json: { deleted: true } }),
  )
  return fakes
}

export type AdminFakes = {
  deleteRequests: { boardId: string; assetIds: string[] }[]
  purgeRequests: { boardId: string }[]
}

/**
 * M7 Worker routes (cleanup, purge, usage), faked: the real permission checks run in the Worker
 * tests and the integration test; here we check what the app sends and does with the answers.
 */
export async function fakeAdminServices(
  page: Page,
  options: {
    usagePercent?: number
    purgePages?: number
    usageError?: string
  } = {},
): Promise<AdminFakes> {
  const fakes: AdminFakes = { deleteRequests: [], purgeRequests: [] }
  let purgePages = options.purgePages ?? 1

  await page.route('http://localhost:8787/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors() })
    if (path === '/assets/delete') {
      const body = request.postDataJSON() as AdminFakes['deleteRequests'][0]
      fakes.deleteRequests.push(body)
      return route.fulfill({
        headers: cors(),
        json: {
          results: Object.fromEntries(
            body.assetIds.map((id) => [id, 'deleted']),
          ),
        },
      })
    }
    if (path === '/boards/purge') {
      fakes.purgeRequests.push(request.postDataJSON() as { boardId: string })
      purgePages -= 1
      return route.fulfill({
        headers: cors(),
        json: { deleted: 1000, complete: purgePages <= 0 },
      })
    }
    if (path === '/usage') {
      if (options.usageError)
        return route.fulfill({
          status: 502,
          headers: cors(),
          json: { error: options.usageError },
        })
      const percent = options.usagePercent ?? 16
      return route.fulfill({
        headers: cors(),
        json: {
          credits: { used: (25 * percent) / 100, limit: 25, percent },
          storageBytes: 300 * 1024 * 1024,
          bandwidthBytes: 2 * 1024 * 1024 * 1024,
          transformations: 120,
          images: 80,
          updatedAt: null,
        },
      })
    }
    return route.fallback()
  })
  return fakes
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}
