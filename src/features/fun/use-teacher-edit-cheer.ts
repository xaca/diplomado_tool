import { useEffect } from 'react'
import { useCheer } from '@/features/fun/use-cheer'
import { markTeacherEditsSeen } from '@/features/slides/api'

/**
 * The student opened their slides after the teacher edited them: "Tu docente hizo cambios…"
 * (M20), then the card's "✎ Docente" badge goes away. Waits for my profile so the message
 * isn't lost to a slow load.
 */
export function useTeacherEditCheer(
  boardId: string | undefined,
  studentId: string | undefined,
  unseen: boolean,
) {
  const cheer = useCheer()
  const ready = unseen && !!boardId && !!studentId
  useEffect(() => {
    if (!ready || !boardId || !studentId) return
    // null = my profile is still loading: this runs again when `cheer` changes
    if (cheer('teacherEdit') === null) return
    void markTeacherEditsSeen(boardId, studentId).catch(() => undefined)
  }, [ready, boardId, studentId, cheer])
}
