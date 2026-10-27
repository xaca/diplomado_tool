import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import path from 'node:path'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { Timestamp } from 'firebase-admin/firestore'
import { emulatorDb } from '../../scripts/emulator.ts'

// Integration: the REAL Worker (wrangler dev, emulator mode) + Auth/Firestore emulators + real rules.
// Proves the Worker reads Firestore with the caller's token and the rules decide.
// Cloudinary is a local fake server (CLOUDINARY_API_BASE) with a fake secret: nothing leaves the machine.
// Run: npm run test:worker-integration

const WORKER = 'http://127.0.0.1:8788'
const AUTH_EMULATOR = 'http://127.0.0.1:9099'
const ORIGIN = 'http://localhost:5173'
const FAKE_CLOUDINARY_PORT = 8789
const FAKE_SECRET = 'integration-test-secret'

// Fake Cloudinary Admin API: records what the Worker asks for
const cloudinaryRequests: { method: string; url: string; auth: string }[] = []
const cloudinary = createServer((request, response) => {
  cloudinaryRequests.push({
    method: request.method ?? '',
    url: request.url ?? '',
    auth: request.headers.authorization ?? '',
  })
  const url = new URL(request.url ?? '/', 'http://localhost')
  response.setHeader('Content-Type', 'application/json')
  if (url.pathname.endsWith('/usage')) {
    response.end(
      JSON.stringify({ credits: { usage: 2.5, limit: 25, used_percent: 10 } }),
    )
    return
  }
  const ids = url.searchParams.getAll('public_ids[]')
  response.end(
    JSON.stringify({
      deleted: Object.fromEntries(ids.map((id) => [id, 'deleted'])),
      partial: false,
    }),
  )
})
cloudinary.listen(FAKE_CLOUDINARY_PORT)

async function call(
  token: string,
  method: 'GET' | 'POST',
  route: string,
  body?: unknown,
) {
  const response = await fetch(`${WORKER}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

async function emulatorSignIn(email: string) {
  const idToken = JSON.stringify({ sub: email, email, email_verified: true })
  const response = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnSecureToken: true,
      }),
    },
  )
  if (!response.ok)
    throw new Error(`Auth emulator sign-in failed: ${response.status}`)
  return (await response.json()) as { idToken: string; localId: string }
}

async function sign(token: string, studentId: string) {
  const response = await fetch(`${WORKER}/uploads/sign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ boardId: DEMO.boardId, studentId }),
  })
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

async function waitForWorker() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${WORKER}/health`)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Worker did not start')
}

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(`✖ ${message}`)
  console.log(`✔ ${message}`)
}

const worker = spawn(
  'npx',
  [
    'wrangler',
    'dev',
    '--port',
    '8788',
    '--var',
    'AUTH_MODE:emulator',
    '--var',
    'FIREBASE_PROJECT_ID:demo-pbl',
    '--var',
    'FIRESTORE_HOST:http://127.0.0.1:8080',
    '--var',
    `CLOUDINARY_API_BASE:http://127.0.0.1:${FAKE_CLOUDINARY_PORT}`,
    '--var',
    `CLOUDINARY_API_SECRET:${FAKE_SECRET}`,
  ],
  {
    cwd: path.resolve(import.meta.dirname, '../../services/media-api'),
    shell: true,
    stdio: 'ignore',
  },
)

// Stop wrangler and its workerd child (Windows needs the whole process tree)
function stopWorker() {
  if (process.platform === 'win32' && worker.pid) {
    spawnSync('taskkill', ['/pid', String(worker.pid), '/T', '/F'], {
      stdio: 'ignore',
    })
  } else {
    worker.kill()
  }
}

// If the emulators die mid-run, the admin SDK retries forever: fail instead of hanging the gate
const watchdog = setTimeout(() => {
  console.error('✖ Worker integration timed out after 3 minutes')
  stopWorker()
  process.exit(1)
}, 180_000)

try {
  await seedDemo()
  await waitForWorker()

  const laura = await emulatorSignIn('laura@gmail.com')
  await emulatorDb.doc(`boards/${DEMO.boardId}/members/${laura.localId}`).set({
    uid: laura.localId,
    studentId: 'st_laura',
    email: 'laura@gmail.com',
    joinedAt: new Date(),
  })

  const own = await sign(laura.idToken, 'st_laura')
  check(own.status === 200, 'the student gets a signature for her own space')
  check(
    (own.body.params as Record<string, string>).public_id.startsWith(
      `pbl/dev/${DEMO.boardId}/st_laura/`,
    ),
    'the signed upload goes to her dev folder',
  )

  const other = await sign(laura.idToken, 'st_elma')
  check(other.status === 403, "another student's space is refused")

  const stranger = await emulatorSignIn('stranger@gmail.com')
  const outsider = await sign(stranger.idToken, 'st_laura')
  check(
    outsider.status === 403,
    'a non-member is refused (Firestore rules deny the read)',
  )

  const forged = await sign('not-a-token', 'st_laura')
  check(forged.status === 401, 'a fake token is refused')

  await emulatorDb.doc(`boards/${DEMO.boardId}`).update({ status: 'locked' })
  const locked = await sign(laura.idToken, 'st_laura')
  check(locked.status === 403, 'no uploads when the board is locked')

  // ---------- M7: lifecycle, cleanup, purge, usage ----------
  const board = emulatorDb.doc(`boards/${DEMO.boardId}`)
  await board.update({
    status: 'active',
    lastActivityAt: Timestamp.fromMillis(Date.now() - 100 * 24 * 3600 * 1000),
  })
  const unused = await sign(laura.idToken, 'st_laura')
  check(
    unused.status === 403,
    'no uploads on a board unused for longer than its limit (auto-archived)',
  )

  const teacher = await emulatorSignIn(DEMO.teacher)
  const usage = await call(teacher.idToken, 'GET', '/usage')
  check(
    usage.status === 200 &&
      (usage.body.credits as { used: number }).used === 2.5,
    'a teacher reads the Cloudinary usage',
  )
  check(
    (await call(laura.idToken, 'GET', '/usage')).status === 403,
    'a student cannot read the usage',
  )
  check(
    cloudinaryRequests.every(
      (request) =>
        request.auth ===
        `Basic ${Buffer.from(`719523683767324:${FAKE_SECRET}`).toString('base64')}`,
    ),
    'Cloudinary is called with the API key and secret (Basic auth)',
  )

  const asset = (id: string, status: string) =>
    emulatorDb.doc(`boards/${DEMO.boardId}/assets/${id}`).set({
      publicId: `pbl/dev/${DEMO.boardId}/st_laura/${id}`,
      studentId: 'st_laura',
      kind: 'slide',
      width: 1,
      height: 1,
      format: 'webp',
      bytes: 10,
      status,
      createdAt: new Date(),
    })
  await asset('orphan1', 'orphaned')
  await asset('inuse1', 'active')
  const deleted = await call(teacher.idToken, 'POST', '/assets/delete', {
    boardId: DEMO.boardId,
    assetIds: ['orphan1', 'inuse1'],
  })
  check(
    JSON.stringify(deleted.body.results) ===
      JSON.stringify({ inuse1: 'skipped', orphan1: 'deleted' }),
    'cleanup deletes only images marked unused',
  )
  const deleteCall = cloudinaryRequests.at(-1)!
  check(
    deleteCall.method === 'DELETE' &&
      decodeURIComponent(deleteCall.url).includes(
        `public_ids[]=pbl/dev/${DEMO.boardId}/st_laura/orphan1`,
      ) &&
      !deleteCall.url.includes('inuse1'),
    'only that image is sent to Cloudinary',
  )
  check(
    (
      await call(laura.idToken, 'POST', '/assets/delete', {
        boardId: DEMO.boardId,
        assetIds: ['orphan1'],
      })
    ).status === 403,
    'a student cannot delete images',
  )

  const activePurge = await call(teacher.idToken, 'POST', '/boards/purge', {
    boardId: DEMO.boardId,
  })
  check(activePurge.status === 409, 'an active board cannot be purged')
  await board.update({ status: 'archived' })
  const purged = await call(teacher.idToken, 'POST', '/boards/purge', {
    boardId: DEMO.boardId,
  })
  check(
    purged.status === 200 &&
      purged.body.complete === true &&
      cloudinaryRequests
        .slice(-2)
        .map((request) => decodeURIComponent(request.url))
        .every((url, index) =>
          url.includes(
            `prefix=pbl/${index === 0 ? 'prod' : 'dev'}/${DEMO.boardId}/`,
          ),
        ),
    'purging an archived board deletes its prod and dev folders',
  )
  check(
    (
      await call(laura.idToken, 'POST', '/boards/purge', {
        boardId: DEMO.boardId,
      })
    ).status === 403,
    'a student cannot purge',
  )

  console.log('\nWorker integration: all checks passed')
} finally {
  clearTimeout(watchdog)
  stopWorker()
  cloudinary.close()
}
