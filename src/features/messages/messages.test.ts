import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  cleanText,
  cooldownLeft,
  dayLabel,
  isUnread,
  isWaiting,
  millis,
  previewOf,
  seenByOther,
  segments,
  sortConversations,
  unreadForTeacher,
} from '@/features/messages/messages'
import type { ConversationDoc } from '@/model'

const at = (minutes: number) =>
  Timestamp.fromMillis(Date.UTC(2026, 10, 7, 12, minutes))
const conversation = (
  overrides: Partial<ConversationDoc> = {},
): ConversationDoc => ({
  studentId: 'st_laura',
  createdAt: at(0),
  lastMessageAt: at(10),
  lastMessageId: 'm1',
  lastFrom: 'student',
  lastText: 'Hola profe',
  studentReadAt: at(10),
  ...overrides,
})

describe('unread, waiting and order (M26)', () => {
  it('the teacher has something new until a teacher opens it after the last message', () => {
    expect(isUnread(conversation(), 'teacher')).toBe(true)
    expect(isUnread(conversation({ teacherReadAt: at(9) }), 'teacher')).toBe(
      true,
    )
    expect(isUnread(conversation({ teacherReadAt: at(10) }), 'teacher')).toBe(
      false,
    )
    // "Marcar como no leído" clears the read time
    expect(isUnread(conversation({ teacherReadAt: null }), 'teacher')).toBe(
      true,
    )
    // my own last message is never "new" for me
    expect(isUnread(conversation(), 'student')).toBe(false)
    expect(isUnread(null, 'teacher')).toBe(false)
  })

  it('the student has something new when the teacher wrote after they last looked', () => {
    const reply = conversation({
      lastFrom: 'teacher',
      lastMessageAt: at(20),
      studentReadAt: at(10),
    })
    expect(isUnread(reply, 'student')).toBe(true)
    expect(isUnread({ ...reply, studentReadAt: at(21) }, 'student')).toBe(false)
    expect(isWaiting(reply)).toBe(false)
    expect(isWaiting(conversation({ teacherReadAt: at(11) }))).toBe(true)
  })

  it('sorts unread first, then waiting for a reply, then the newest', () => {
    const answered = {
      ...conversation({ lastFrom: 'teacher', lastMessageAt: at(50) }),
      id: 'answered',
    }
    const waiting = {
      ...conversation({ lastMessageAt: at(30), teacherReadAt: at(31) }),
      id: 'waiting',
    }
    const fresh = { ...conversation({ lastMessageAt: at(5) }), id: 'fresh' }
    const older = {
      ...conversation({ lastFrom: 'teacher', lastMessageAt: at(1) }),
      id: 'older',
    }
    expect(
      sortConversations([older, answered, waiting, fresh]).map((c) => c.id),
    ).toEqual(['fresh', 'waiting', 'answered', 'older'])
    expect(unreadForTeacher([older, answered, waiting, fresh])).toBe(1)
  })

  it('a pending server time counts as now; nothing stored is "never"', () => {
    expect(millis(undefined)).toBeNull()
    expect(millis(null)).toBeNull()
    expect(millis({}, 1234)).toBe(1234)
    expect(millis(at(10))).toBe(Date.UTC(2026, 10, 7, 12, 10))
  })
})

describe('text, links and limits (M26)', () => {
  it('keeps 1–1000 characters, trimmed', () => {
    expect(cleanText('  hola  ')).toBe('hola')
    expect(cleanText('   ')).toBeNull()
    expect(cleanText('x'.repeat(1000))).toHaveLength(1000)
    expect(cleanText('x'.repeat(1001))).toBeNull()
  })

  it('the preview is one line of at most 120 characters', () => {
    expect(previewOf('Hola\n\nprofe,   una   pregunta')).toBe(
      'Hola profe, una pregunta',
    )
    const long = previewOf('a'.repeat(300))
    expect(long).toHaveLength(120)
    expect(long.endsWith('…')).toBe(true)
  })

  it('only https links become links; punctuation after them stays text', () => {
    expect(
      segments(
        'Mire https://forms.gle/abc123, y http://x.co o javascript:alert(1).',
      ),
    ).toEqual([
      { text: 'Mire ' },
      { text: 'https://forms.gle/abc123', href: 'https://forms.gle/abc123' },
      { text: ', y http://x.co o javascript:alert(1).' },
    ])
    expect(segments('sin enlaces')).toEqual([{ text: 'sin enlaces' }])
    expect(segments('(https://docs.google.com/forms/d/e/1/viewform)')).toEqual([
      { text: '(' },
      {
        text: 'https://docs.google.com/forms/d/e/1/viewform',
        href: 'https://docs.google.com/forms/d/e/1/viewform',
      },
      { text: ')' },
    ])
  })

  it('waits 2 s after the last message before sending again', () => {
    const now = Date.UTC(2026, 10, 7, 12, 10)
    const c = conversation({ lastMessageAt: Timestamp.fromMillis(now - 500) })
    expect(cooldownLeft(c, now)).toBe(1500)
    expect(cooldownLeft(c, now + 5000)).toBe(0)
    expect(cooldownLeft(null, now)).toBe(0)
  })
})

describe('days and "Visto" (M26)', () => {
  it('labels today, yesterday and other days', () => {
    const now = new Date(2026, 10, 7, 15)
    expect(dayLabel(new Date(2026, 10, 7, 8), 'es', now)).toBe('Hoy')
    expect(dayLabel(new Date(2026, 10, 6, 23), 'es', now)).toBe('Ayer')
    expect(dayLabel(new Date(2026, 10, 6, 23), 'en', now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 9, 12), 'es', now)).toMatch(/12/)
  })

  it('my message is "Visto" once the other side opened the conversation after it', () => {
    const c = conversation({ teacherReadAt: at(12) })
    expect(seenByOther(c, 'student', at(11))).toBe(true)
    expect(seenByOther(c, 'student', at(13))).toBe(false)
    expect(seenByOther(conversation(), 'student', at(1))).toBe(false)
    // the teacher's message, seen by the student
    expect(seenByOther(c, 'teacher', at(10))).toBe(true)
  })
})
