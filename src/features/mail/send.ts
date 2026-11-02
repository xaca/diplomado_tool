import type { User } from 'firebase/auth'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import {
  GmailError,
  gmailToken,
  sendRaw,
  type GmailProblem,
} from '@/features/mail/gmail'
import {
  buildMime,
  renderEmail,
  type EmailDraft,
  type EmailFrame,
} from '@/features/mail/message'
import { normalizeEmail } from '@/lib/collections'
import { db } from '@/lib/firebase'
import {
  MAX_EMAIL_RECIPIENTS,
  paths,
  type EmailKind,
  type EmailSender,
} from '@/model'

// One email per student (D101), from the teacher's Gmail with the board's sender name and
// Reply-To (D107); then one line in the board's email log (teacher only).

export type Recipient = { studentId: string; name: string; email: string }

export type SendResult = {
  sent: Recipient[]
  failed: Recipient[]
  /** Why sending stopped early (the permission expired or was refused) */
  problem: GmailProblem | null
}

export const emailsCollection = (boardId: string) =>
  collection(db, paths.emails(boardId))

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function sendToStudents({
  boardId,
  user,
  sender,
  kind,
  draft,
  frame,
  recipients,
  onProgress,
}: {
  boardId: string
  user: User
  sender: EmailSender
  kind: EmailKind
  draft: EmailDraft
  frame: EmailFrame
  recipients: Recipient[]
  onProgress?: (done: number, total: number) => void
}): Promise<SendResult> {
  const list = recipients.slice(0, MAX_EMAIL_RECIPIENTS)
  // Asks Google first (popup): nothing is sent if the teacher says no
  const token = await gmailToken(user)
  const from = { name: sender.name, email: user.email ?? '' }
  const sent: Recipient[] = []
  const failed: Recipient[] = []
  let problem: GmailProblem | null = null

  for (const [index, recipient] of list.entries()) {
    if (problem) {
      failed.push(recipient)
      continue
    }
    const email = renderEmail(draft, frame, recipient.name)
    const raw = buildMime({
      from,
      to: { name: recipient.name, email: recipient.email },
      replyTo: sender.replyTo || undefined,
      subject: email.subject,
      text: email.text,
      html: email.html,
    })
    try {
      try {
        await sendRaw(token, raw)
      } catch (error) {
        // Too fast for Gmail: wait and try once more
        if (!(error instanceof GmailError) || error.problem !== 'rate')
          throw error
        await pause(2000)
        await sendRaw(token, raw)
      }
      sent.push(recipient)
    } catch (error) {
      failed.push(recipient)
      if (
        error instanceof GmailError &&
        (error.problem === 'expired' || error.problem === 'scope')
      )
        problem = error.problem
    }
    onProgress?.(index + 1, list.length)
  }

  await addDoc(emailsCollection(boardId), {
    kind,
    subject: draft.subject.slice(0, 200),
    sentBy: normalizeEmail(user.email ?? ''),
    sent: sent.map((item) => item.email),
    failed: failed.map((item) => item.email),
    createdAt: serverTimestamp(),
  }).catch(() => {})

  return { sent, failed, problem }
}
