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

const serviceAccount = loadServiceAccount()

export const projectId = serviceAccount.project_id
export const app = initializeApp({ credential: cert(serviceAccount) })
export const db = getFirestore(app)
