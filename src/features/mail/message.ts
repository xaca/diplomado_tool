// Emails sent from the teacher's Gmail (M24, F34, D100–D102, D107): the message as Gmail's API
// takes it (RFC 5322 / MIME, base64url) and its content (plain text + HTML). Pure, unit-tested.
// Every non-ASCII header (names, subject) goes as an RFC 2047 encoded word; bodies are base64,
// so the raw message is plain ASCII.

export type Address = { name: string; email: string }

/** UTF-8 → base64 (works in the browser and in Node) */
export function base64Utf8(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/** base64url without padding, as users.messages.send wants `raw` */
export function toBase64Url(ascii: string) {
  return btoa(ascii).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/** A header text: as is when plain ASCII, else encoded words of ≤ 30 characters each */
export function encodeHeader(text: string) {
  if (PRINTABLE_ASCII.test(text)) return text
  const chars = [...text]
  const words: string[] = []
  for (let index = 0; index < chars.length; index += 30)
    words.push(
      `=?UTF-8?B?${base64Utf8(chars.slice(index, index + 30).join(''))}?=`,
    )
  return words.join('\r\n ')
}

/** "Diplomado UX/UI" <profe@gmail.com>, with the name encoded when needed */
export function formatAddress({ name, email }: Address) {
  const clean = name.replace(/[\r\n]+/g, ' ').trim()
  if (!clean) return email
  return PRINTABLE_ASCII.test(clean)
    ? `"${clean.replace(/(["\\])/g, '\\$1')}" <${email}>`
    : `${encodeHeader(clean)} <${email}>`
}

const wrap76 = (text: string) => text.replace(/.{76}/g, '$&\r\n')

/** The whole message: multipart/alternative (text + HTML), ASCII only */
export function buildMime({
  from,
  to,
  replyTo,
  subject,
  text,
  html,
  boundary = `pbl_${Math.random().toString(36).slice(2)}`,
  date = new Date(),
}: {
  from: Address
  to: Address
  replyTo?: string
  subject: string
  text: string
  html: string
  boundary?: string
  date?: Date
}) {
  const headers = [
    `From: ${formatAddress(from)}`,
    `To: ${formatAddress(to)}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeader(subject.replace(/[\r\n]+/g, ' '))}`,
    `Date: ${date.toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const part = (type: string, body: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(base64Utf8(body)),
    ].join('\r\n')
  return [
    ...headers,
    '',
    part('text/plain', text),
    part('text/html', html),
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

// ---------- content ----------

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "Laura Nataly Pérez" → "Laura" */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ''
}

/** What the teacher writes once; personalized for each student */
export type EmailDraft = {
  subject: string
  /** Title inside the email (e.g. the announcement's) */
  title: string
  /** Plain text; blank lines separate paragraphs */
  body: string
  /** A button, e.g. "Abrir en la app" */
  button?: { url: string; label: string }
}

/** The fixed texts around the message, already translated */
export type EmailFrame = {
  greeting: (name: string) => string
  boardTitle: string
  footer: string
}

/** Text and HTML for one student ("Hola, Laura") */
export function renderEmail(
  draft: EmailDraft,
  frame: EmailFrame,
  studentName: string,
) {
  const greeting = frame.greeting(firstName(studentName))
  const paragraphs = draft.body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const text = [
    greeting,
    '',
    ...(draft.title ? [draft.title, ''] : []),
    ...paragraphs.flatMap((paragraph) => [paragraph, '']),
    ...(draft.button ? [`${draft.button.label}: ${draft.button.url}`, ''] : []),
    '—',
    frame.boardTitle,
    frame.footer,
  ].join('\n')

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(draft.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<tr><td style="padding:20px 24px 0;font-size:13px;color:#71717a;">${escapeHtml(frame.boardTitle)}</td></tr>
<tr><td style="padding:12px 24px 0;font-size:16px;">${escapeHtml(greeting)}</td></tr>
${draft.title ? `<tr><td style="padding:12px 24px 0;font-size:20px;font-weight:bold;">${escapeHtml(draft.title)}</td></tr>` : ''}
${paragraphs
  .map(
    (paragraph) =>
      `<tr><td style="padding:12px 24px 0;font-size:15px;line-height:1.5;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</td></tr>`,
  )
  .join('\n')}
${
  draft.button
    ? `<tr><td style="padding:20px 24px 0;"><a href="${escapeHtml(draft.button.url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:15px;">${escapeHtml(draft.button.label)}</a></td></tr>`
    : ''
}
<tr><td style="padding:24px;font-size:12px;color:#71717a;">${escapeHtml(frame.footer)}</td></tr>
</table>
</td></tr>
</table>
</body></html>`

  return { subject: draft.subject, text, html }
}
