import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Admin SDK: bypasses Security Rules. Runs only on the teacher's computer, never deployed.

const KEY_PATH = path.resolve(
  import.meta.dirname,
  '../../secrets/service-account.json',
)

function loadServiceAccount(): ServiceAccount & { project_id: string } {
  if (!existsSync(KEY_PATH)) {
    throw new Error(
      `Service account key not found at ${KEY_PATH}\n` +
        'See PLAN.md → "How to get the Firebase service account key".',
    )
  }
  return JSON.parse(readFileSync(KEY_PATH, 'utf8'))
}

// Emulator mode (tests): set by `firebase emulators:exec`. Only "demo-*" projects, which can't
// reach production even by mistake.
const emulatorProject = process.env.FIRESTORE_EMULATOR_HOST
  ? (process.env.GCLOUD_PROJECT ?? 'demo-pbl')
  : null
if (emulatorProject && !emulatorProject.startsWith('demo-'))
  throw new Error(
    `Emulator mode needs a demo-* project, got ${emulatorProject}`,
  )

const serviceAccount = emulatorProject ? null : loadServiceAccount()

export const projectId = emulatorProject ?? serviceAccount!.project_id
export const app = emulatorProject
  ? initializeApp({ projectId: emulatorProject })
  : initializeApp({ credential: cert(serviceAccount!) })
export const db = getFirestore(app)
