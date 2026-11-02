import { describe, expect, it } from 'vitest'
import {
  base64Utf8,
  buildMime,
  encodeHeader,
  firstName,
  formatAddress,
  renderEmail,
  toBase64Url,
} from '@/features/mail/message'

const decode = (base64: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)),
  )

describe('the message Gmail sends', () => {
  it('encodes accented names and subjects (RFC 2047) and keeps plain ones as they are', () => {
    expect(encodeHeader('Recordatorio')).toBe('Recordatorio')
    expect(encodeHeader('Entrega del 18 · ñ')).toBe(
      `=?UTF-8?B?${base64Utf8('Entrega del 18 · ñ')}?=`,
    )
    expect(formatAddress({ name: 'Diplomado UX', email: 'p@gmail.com' })).toBe(
      '"Diplomado UX" <p@gmail.com>',
    )
    expect(
      formatAddress({ name: 'Prof. García', email: 'p@gmail.com' }),
    ).toMatch(/^=\?UTF-8\?B\?.+\?= <p@gmail\.com>$/)
    expect(formatAddress({ name: '', email: 'p@gmail.com' })).toBe(
      'p@gmail.com',
    )
  })

  it('builds an ASCII multipart message (text + HTML) with Reply-To, and base64url for the API', () => {
    const raw = buildMime({
      from: {
        name: 'Diplomado UX/UI – Prof. García',
        email: 'profe@gmail.com',
      },
      to: { name: 'Laura Núñez', email: 'laura@gmail.com' },
      replyTo: 'docente@uni.edu.co',
      subject: 'Entrega: ¡ánimo!',
      text: 'Hola, Laura',
      html: '<p>Hola, Laura</p>',
      boundary: 'b1',
      date: new Date('2026-11-02T12:00:00Z'),
    })
    expect([...raw].every((char) => char.charCodeAt(0) < 128)).toBe(true)
    expect(raw).toContain('Reply-To: docente@uni.edu.co\r\n')
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="b1"')
    expect(raw).toContain('Date: Mon, 02 Nov 2026 12:00:00 GMT')
    const parts = raw.split('--b1')
    expect(parts).toHaveLength(4)
    expect(decode(parts[1].split('\r\n\r\n')[1].replace(/\r\n/g, ''))).toBe(
      'Hola, Laura',
    )
    expect(parts[2]).toContain('text/html')
    expect(toBase64Url('a?b>c')).toBe('YT9iPmM')
    expect(toBase64Url(raw)).not.toMatch(/[+/=]/)
  })
})

describe('the email’s content', () => {
  it('greets each student by first name; escapes HTML; adds the button and the footer', () => {
    const email = renderEmail(
      {
        subject: 'Entrega',
        title: 'Entrega del prototipo',
        body: 'Recuerden subir <el enlace>.\n\nSegundo párrafo\ncon salto.',
        button: { url: 'https://diplomado.app/b/1', label: 'Abrir en la app' },
      },
      {
        greeting: (name) => `Hola, ${name}`,
        boardTitle: 'Diplomado UX/UI',
        footer: 'Responde a este correo para escribirle a tu docente.',
      },
      'Laura Nataly Pérez',
    )
    expect(email.text).toContain('Hola, Laura\n')
    expect(email.text).toContain('Abrir en la app: https://diplomado.app/b/1')
    expect(email.html).toContain('Hola, Laura')
    expect(email.html).toContain('&lt;el enlace&gt;')
    expect(email.html).not.toContain('<el enlace>')
    expect(email.html).toContain('Segundo párrafo<br>con salto.')
    expect(email.html).toContain('href="https://diplomado.app/b/1"')
    expect(firstName('  Seb ')).toBe('Seb')
  })
})
