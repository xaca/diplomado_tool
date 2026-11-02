import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { boardRef } from '@/features/boards/api'
import { HOLIDAY_PROVIDERS } from '@/features/course/holidays'
import { db } from '@/lib/firebase'
import {
  courseSetupSchema,
  emailSenderSchema,
  newsInputSchema,
  paths,
  type CourseSetup,
  type EmailSender,
  type HolidayCountry,
  type NewsInput,
} from '@/model'

// The course setup on the board doc, course news, and holidays (M24). The board's teacher writes;
// members read.

/** Saves the whole setup (null = remove it: the board works as before) */
export function saveCourse(boardId: string, setup: CourseSetup | null) {
  return updateDoc(boardRef(boardId), {
    course: setup ? courseSetupSchema.parse(setup) : null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Classes given in a course without a schedule (attendance / Clase dates), saved by the teacher's
 * browser so students see the same counter. Only called when the number changed.
 */
export function saveHeld(boardId: string, held: number) {
  return updateDoc(boardRef(boardId), 'course.held', held)
}

export function saveEmailSender(boardId: string, sender: EmailSender) {
  return updateDoc(boardRef(boardId), {
    emailSender: emailSenderSchema.parse(sender),
    updatedAt: serverTimestamp(),
  })
}

export function loadHolidays(
  country: HolidayCountry,
  from: string,
  to: string,
) {
  return HOLIDAY_PROVIDERS[country].load(from, to)
}

// ---------- news ----------

export const newsCollection = (boardId: string) =>
  collection(db, paths.news(boardId))

export function addNews(boardId: string, input: NewsInput) {
  return addDoc(newsCollection(boardId), {
    ...newsInputSchema.parse(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function updateNews(boardId: string, id: string, input: NewsInput) {
  return updateDoc(doc(db, paths.newsItem(boardId, id)), {
    ...newsInputSchema.parse(input),
    updatedAt: serverTimestamp(),
  })
}

export function deleteNews(boardId: string, id: string) {
  return deleteDoc(doc(db, paths.newsItem(boardId, id)))
}
