import { useEffect, useMemo, useState } from 'react'
import { useAttendance } from '@/features/attendance/hooks'
import { useBoard } from '@/features/boards/hooks'
import { useClasses } from '@/features/classes/hooks'
import { saveHeld, newsCollection } from '@/features/course/api'
import {
  courseState,
  hasDates,
  heldDates,
  momentOf,
  type Moment,
} from '@/features/course/course'
import { useLiveQuery } from '@/lib/firestore-hooks'
import type { CourseSetup, NewsDoc } from '@/model'

/** Now (day and HH:MM), refreshed every minute: "next class" moves on by itself */
export function useNow(): Moment {
  const [now, setNow] = useState(momentOf)
  useEffect(() => {
    const timer = setInterval(() => setNow(momentOf()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/** The course right now: total, classes given, next class, week, phase */
export function useCourseState(
  course: CourseSetup | null | undefined,
  held?: readonly string[],
) {
  const now = useNow()
  return useMemo(() => courseState(course, now, held), [course, now, held])
}

/** The course of a board, for any page (D112) */
export function useCourse(boardId: string | undefined) {
  const board = useBoard(boardId)
  const course = board.data?.course ?? null
  return { loading: board.loading, course, state: useCourseState(course) }
}

/**
 * The teacher's view of classes given in a course without a schedule: the distinct dates with
 * attendance or a Clase. Keeps `course.held` on the board up to date so students see the same
 * counter (written only when it changed).
 */
export function useHeldDates(
  boardId: string | undefined,
  course: CourseSetup | null | undefined,
  teacher: boolean,
) {
  const needed = teacher && !!course && !hasDates(course)
  const attendance = useAttendance(needed ? boardId : undefined)
  const classes = useClasses(boardId, needed)
  const now = useNow()
  const loading = attendance.loading || classes.loading
  const dates = useMemo(
    () =>
      needed && !loading
        ? heldDates(
            [
              ...attendance.data.map((record) => record.date),
              ...classes.data.map((item) => item.date),
            ],
            now.date,
          )
        : undefined,
    [needed, loading, attendance.data, classes.data, now.date],
  )
  const saved = course?.held ?? null
  useEffect(() => {
    if (boardId && dates && dates.length !== saved)
      saveHeld(boardId, dates.length).catch(() => {})
  }, [boardId, dates, saved])
  return dates
}

/** Course news, by date */
export function useNews(boardId: string | undefined, enabled = true) {
  const result = useLiveQuery<NewsDoc>(
    enabled && boardId ? newsCollection(boardId) : null,
    `news:${boardId}:${enabled}`,
  )
  const data = useMemo(
    () => [...result.data].sort((a, b) => a.date.localeCompare(b.date)),
    [result.data],
  )
  return { ...result, data }
}

/** The board has a calendar to show (D105): dates, one-off classes or news */
export function useHasCalendar(
  boardId: string | undefined,
  course: CourseSetup | null | undefined,
) {
  const news = useNews(boardId)
  return (
    (!!course && (hasDates(course) || course.extras.length > 0)) ||
    news.data.length > 0
  )
}
