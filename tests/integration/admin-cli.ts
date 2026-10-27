import { spawn } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { DEMO, seedDemo } from '../../scripts/seed.ts'
import { emulatorDb } from '../../scripts/emulator.ts'

// Integration: the REAL admin CLI against the Firestore emulator (demo-pbl) and a local fake
// Cloudinary (fake credentials). Run: npm run test:admin

const FAKE_CLOUDINARY_PORT = 8790
const BOARD = `boards/${DEMO.boardId}`

const cloudinaryRequests: { method: string; url: string }[] = []
const cloudinary = createServer((request, response) => {
  cloudinaryRequests.push({
    method: request.method ?? '',
    url: decodeURIComponent(request.url ?? ''),
  })
  const url = new URL(request.url ?? '/', 'http://localhost')
  response.setHeader('Content-Type', 'application/json')
  if (url.pathname.endsWith('/usage')) {
    response.end(
      JSON.stringify({
        credits: { usage: 2.5, limit: 25, used_percent: 10 },
        storage: { usage: 1024 },
      }),
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

/** Runs `npm run admin -- <args>` for real (async: the fake server must keep answering). */
function admin(...args: string[]) {
  return new Promise<{ code: number; output: string }>((resolve) => {
    const child = spawn('npx', ['tsx', 'scripts/admin/index.ts', ...args], {
      cwd: path.resolve(import.meta.dirname, '../..'),
      shell: true,
      env: {
        ...process.env,
        CLOUDINARY_CLOUD_NAME: 'demo-cloud',
        CLOUDINARY_API_KEY: 'test-key',
        CLOUDINARY_API_SECRET: 'test-secret',
        CLOUDINARY_API_BASE: `http://127.0.0.1:${FAKE_CLOUDINARY_PORT}`,
      },
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

function check(condition: boolean, message: string, details = '') {
  if (!condition) throw new Error(`✖ ${message}\n${details}`)
  console.log(`✔ ${message}`)
}

const daysAgo = (days: number) =>
  Timestamp.fromMillis(Date.now() - days * 24 * 3600 * 1000)

async function seedImages() {
  const asset = (id: string, status: string) =>
    emulatorDb.doc(`${BOARD}/assets/${id}`).set({
      publicId: `pbl/prod/${DEMO.boardId}/st_sebastian/${id}`,
      studentId: 'st_sebastian',
      kind: 'slide',
      width: 1,
      height: 1,
      format: 'webp',
      bytes: 2048,
      status,
      createdAt: daysAgo(3),
    })
  await Promise.all([asset('used1', 'active'), asset('unused1', 'orphaned')])
  const space = emulatorDb.doc(`${BOARD}/spaces/st_sebastian`)
  await space
    .collection('slides')
    .doc('s1')
    .set({
      engine: 'excalidraw',
      content: '{"elements":[]}',
      files: {},
      assetIds: ['used1'],
      bytes: 15,
      schemaVersion: 1,
      updatedAt: FieldValue.serverTimestamp(),
    })
  await space.update({ slideOrder: ['s1'], slideCount: 1 })
}

const watchdog = setTimeout(() => {
  console.error('✖ Admin CLI integration timed out after 3 minutes')
  process.exit(1)
}, 180_000)
const backupDir = mkdtempSync(path.join(tmpdir(), 'pbl-backups-'))

try {
  await seedDemo()
  await seedImages()

  const backup = await admin('backup', DEMO.boardId, '--dir', backupDir)
  const [file] = readdirSync(backupDir)
  const content = file
    ? JSON.parse(readFileSync(path.join(backupDir, file), 'utf8'))
    : null
  check(
    backup.code === 0 &&
      content?.type === 'pbl.boardBackup' &&
      content.students.length === DEMO.students.length,
    'backup writes the same JSON file as the dashboard',
    backup.output,
  )

  const dry = await admin('cleanup', '--board', DEMO.boardId, '--dry-run')
  const status = async (id: string) =>
    (await emulatorDb.doc(`${BOARD}/assets/${id}`).get()).get('status')
  check(
    dry.code === 0 &&
      dry.output.includes('1 unused images') &&
      dry.output.includes('unused1') &&
      !dry.output.includes('/used1') &&
      (await status('unused1')) === 'orphaned' &&
      cloudinaryRequests.length === 0,
    'cleanup --dry-run lists unused images and changes nothing',
    dry.output,
  )

  const cleanup = await admin('cleanup', '--board', DEMO.boardId)
  check(
    cleanup.code === 0 &&
      (await status('unused1')) === 'deleted' &&
      (await status('used1')) === 'active' &&
      cloudinaryRequests.some((r) =>
        r.url.includes(
          `public_ids[]=pbl/prod/${DEMO.boardId}/st_sebastian/unused1`,
        ),
      ),
    'cleanup deletes the unused image from Cloudinary and marks it in the registry',
    cleanup.output,
  )

  const usage = await admin('usage')
  check(
    usage.code === 0 &&
      usage.output.includes('2.5 of 25 credits') &&
      usage.output.includes(DEMO.boardTitle),
    'usage shows Cloudinary credits and the documents per board',
    usage.output,
  )

  const active = await admin('board', 'purge', DEMO.boardId, '--yes')
  check(
    active.code !== 0 &&
      active.output.includes('Only archived boards') &&
      (await emulatorDb.doc(BOARD).get()).exists,
    'an active board is never purged',
    active.output,
  )

  await admin('board', 'archive', DEMO.boardId)
  check(
    (await emulatorDb.doc(BOARD).get()).get('status') === 'archived',
    'board archive',
  )
  await admin('board', 'restore', DEMO.boardId)
  check(
    (await emulatorDb.doc(BOARD).get()).get('status') === 'active',
    'board restore',
  )

  await admin('board', 'archive', DEMO.boardId)
  const purge = await admin(
    'board',
    'purge',
    DEMO.boardId,
    '--yes',
    '--backup-dir',
    backupDir,
  )
  const prefixes = cloudinaryRequests
    .filter((r) => r.url.includes('prefix='))
    .map((r) => r.url)
  check(
    purge.code === 0 &&
      !(await emulatorDb.doc(BOARD).get()).exists &&
      (await emulatorDb.collection(`${BOARD}/students`).get()).empty &&
      (await emulatorDb.collection(`${BOARD}/spaces/st_sebastian/slides`).get())
        .empty &&
      !(await emulatorDb.doc(`joinCodes/${DEMO.joinCode}`).get()).exists &&
      purge.output.includes('Backup:') &&
      readdirSync(backupDir).length >= 1 &&
      prefixes.some((u) => u.includes(`prefix=pbl/prod/${DEMO.boardId}/`)) &&
      prefixes.some((u) => u.includes(`prefix=pbl/dev/${DEMO.boardId}/`)),
    'purge writes a backup, deletes both image folders and every document',
    purge.output,
  )

  console.log('\nAdmin CLI integration: all checks passed')
} finally {
  clearTimeout(watchdog)
  cloudinary.close()
  rmSync(backupDir, { recursive: true, force: true })
}
