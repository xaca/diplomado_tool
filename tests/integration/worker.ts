import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'

// Integration: the REAL Worker (wrangler dev, emulator mode) + Auth/Firestore emulators + real rules.
// Proves the Worker reads Firestore with the caller's token and the rules decide.
// No Cloudinary request is made: /uploads/sign only computes a signature.
// Run: npm run test:worker-integration

const WORKER = 'http://127.0.0.1:8788'
const AUTH_EMULATOR = 'http://127.0.0.1:9099'
const ORIGIN = 'http://localhost:5173'

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

  console.log('\nWorker integration: all checks passed')
} finally {
  clearTimeout(watchdog)
  stopWorker()
}
