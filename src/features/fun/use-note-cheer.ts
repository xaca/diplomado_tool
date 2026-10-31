import { useEffect } from 'react'
import { newNotes } from '@/features/fun/cheer'
import { useCheer } from '@/features/fun/use-cheer'
import { useProfile } from '@/features/profile/hooks'
import { toDate } from '@/lib/time'
import type { NoteDoc } from '@/model'

const seenKey = (boardId: string, studentId: string) =>
  `pbl.notesSeen.${boardId}.${studentId}`

function readSeen(key: string) {
  try {
    const value = localStorage.getItem(key)
    return value == null ? null : Number(value)
  } catch {
    return null
  }
}

function writeSeen(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // private window: no message next time, nothing else
  }
}

/**
 * "Tu docente te dejó una nota" (M20) when the student opens their space and the teacher wrote
 * since their last visit on this browser. The first visit only remembers what's there.
 */
export function useNoteCheer(
  boardId: string | undefined,
  studentId: string | undefined,
  notes: { data: NoteDoc[]; loading: boolean },
  enabled: boolean,
) {
  const cheer = useCheer()
  const profile = useProfile()
  const times = notes.data
    .map((note) => toDate(note.createdAt).getTime())
    .filter(Number.isFinite)
  const latest = times.length ? Math.max(...times) : 0
  const count = times.length
  const ready = enabled && !notes.loading && !profile.loading

  useEffect(() => {
    if (!ready || !boardId || !studentId) return
    const key = seenKey(boardId, studentId)
    const seen = readSeen(key)
    if (newNotes(times, seen) > 0) cheer('teacherNote')
    writeSeen(key, Math.max(seen ?? 0, latest))
    // `times` changes with `latest` / `count`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, boardId, studentId, latest, count, cheer])
}
