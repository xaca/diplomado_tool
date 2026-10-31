import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { nextNoteId, toggleReaction, type Point } from '@/features/classes/wall'
import { db } from '@/lib/firebase'
import {
  classInputSchema,
  classSlideInputSchema,
  MAX_CLASS_SLIDES,
  paths,
  stickyTextSchema,
  type ClassDoc,
  type ClassInput,
  type ClassSlideDoc,
  type ClassSlideInput,
  type NoteColor,
  type NoteReactions,
  type Reaction,
  type StickyNoteDoc,
} from '@/model'

// Class participation (M10): classes and wall slides (teacher), sticky notes and reactions
// (everyone, as firestore.rules allows). Each note is its own document: nobody overwrites anyone.

const BATCH_LIMIT = 450

export const classesCollection = (boardId: string) =>
  collection(db, paths.classes(boardId))
export const classRef = (boardId: string, classId: string) =>
  doc(db, paths.class(boardId, classId))
export const classSlidesCollection = (boardId: string, classId: string) =>
  collection(db, paths.classSlides(boardId, classId))
const slideRef = (boardId: string, classId: string, slideId: string) =>
  doc(db, paths.classSlide(boardId, classId, slideId))
export const stickyNotesCollection = (
  boardId: string,
  classId: string,
  slideId: string,
) => collection(db, paths.stickyNotes(boardId, classId, slideId))
const noteRef = (
  boardId: string,
  classId: string,
  slideId: string,
  noteId: string,
) => doc(db, paths.stickyNote(boardId, classId, slideId, noteId))

export class TooManyNotesError extends Error {}

function newSlide(input: ClassSlideInput) {
  return {
    ...classSlideInputSchema.parse(input),
    locked: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

async function deleteAll(refs: DocumentReference[]) {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const ref of refs.slice(start, start + BATCH_LIMIT)) batch.delete(ref)
    await batch.commit()
  }
}

// ---------- classes (teacher) ----------

/** A new class, closed until the teacher opens it, with its first slide. Returns its id. */
export async function createClass(
  boardId: string,
  input: ClassInput,
  firstSlide: ClassSlideInput,
) {
  const ref = doc(classesCollection(boardId))
  const slide = doc(classSlidesCollection(boardId, ref.id))
  const batch = writeBatch(db)
  batch.set(ref, {
    ...classInputSchema.parse(input),
    status: 'closed',
    slideOrder: [slide.id],
    follow: false,
    liveSlideId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Record<keyof ClassDoc, unknown>)
  batch.set(slide, newSlide(firstSlide))
  await batch.commit()
  return ref.id
}

export function updateClass(
  boardId: string,
  classId: string,
  fields: Partial<
    Pick<ClassDoc, 'title' | 'date' | 'status' | 'follow' | 'liveSlideId'>
  >,
) {
  if (fields.title !== undefined || fields.date !== undefined)
    classInputSchema.partial().parse(fields)
  return updateDoc(classRef(boardId, classId), {
    ...fields,
    updatedAt: serverTimestamp(),
  })
}

/** Everything of a class: its slides and all their notes. */
export async function classRefs(boardId: string, classId: string) {
  const slides = await getDocs(classSlidesCollection(boardId, classId))
  const notes = await Promise.all(
    slides.docs.map((slide) =>
      getDocs(stickyNotesCollection(boardId, classId, slide.id)),
    ),
  )
  return [
    ...notes.flatMap((snapshot) => snapshot.docs.map((note) => note.ref)),
    ...slides.docs.map((slide) => slide.ref),
  ]
}

export async function deleteClass(boardId: string, classId: string) {
  await deleteAll([
    ...(await classRefs(boardId, classId)),
    classRef(boardId, classId),
  ])
}

// ---------- slides (teacher) ----------

export async function addClassSlide(
  boardId: string,
  classId: string,
  order: readonly string[],
  input: ClassSlideInput,
) {
  if (order.length >= MAX_CLASS_SLIDES) throw new Error('too many slides')
  const slide = doc(classSlidesCollection(boardId, classId))
  const batch = writeBatch(db)
  batch.set(slide, newSlide(input))
  batch.update(classRef(boardId, classId), {
    slideOrder: [...order, slide.id],
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return slide.id
}

export function updateClassSlide(
  boardId: string,
  classId: string,
  slideId: string,
  fields: Partial<ClassSlideInput> & Partial<Pick<ClassSlideDoc, 'locked'>>,
) {
  const { locked, ...prompt } = fields
  return updateDoc(slideRef(boardId, classId, slideId), {
    ...classSlideInputSchema.partial().parse(prompt),
    ...(locked !== undefined && { locked }),
    updatedAt: serverTimestamp(),
  })
}

/** Moves a slide one place left (-1) or right (+1). */
export function moveClassSlide(
  boardId: string,
  classId: string,
  order: readonly string[],
  slideId: string,
  step: -1 | 1,
) {
  const from = order.indexOf(slideId)
  const to = from + step
  if (from < 0 || to < 0 || to >= order.length) return Promise.resolve()
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return updateDoc(classRef(boardId, classId), {
    slideOrder: next,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteClassSlide(
  boardId: string,
  classId: string,
  klass: Pick<ClassDoc, 'slideOrder' | 'liveSlideId'>,
  slideId: string,
) {
  const notes = await getDocs(stickyNotesCollection(boardId, classId, slideId))
  await deleteAll(notes.docs.map((note) => note.ref))
  const batch = writeBatch(db)
  batch.delete(slideRef(boardId, classId, slideId))
  batch.update(classRef(boardId, classId), {
    slideOrder: klass.slideOrder.filter((id) => id !== slideId),
    ...(klass.liveSlideId === slideId && { liveSlideId: null }),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}

/** "Vaciar diapositiva": every note of the slide goes. */
export async function clearClassSlide(
  boardId: string,
  classId: string,
  slideId: string,
) {
  const notes = await getDocs(stickyNotesCollection(boardId, classId, slideId))
  await deleteAll(notes.docs.map((note) => note.ref))
}

// ---------- sticky notes ----------

export type NoteAuthor = {
  uid: string
  studentId: string | null
  name: string
  role: 'student' | 'teacher'
}

/** My new note; throws TooManyNotesError at 20 on this slide. Returns its id. */
export async function addStickyNote(
  boardId: string,
  classId: string,
  slideId: string,
  author: NoteAuthor,
  existingIds: Iterable<string>,
  note: { text: string; color: NoteColor } & Point,
) {
  const id = nextNoteId(author.uid, existingIds)
  if (!id) throw new TooManyNotesError()
  await setDoc(noteRef(boardId, classId, slideId, id), {
    text: stickyTextSchema.parse(note.text),
    color: note.color,
    x: note.x,
    y: note.y,
    authorUid: author.uid,
    authorStudentId: author.studentId,
    authorName: author.name.slice(0, 120),
    authorRole: author.role,
    reactions: {},
    editedByTeacher: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Record<keyof StickyNoteDoc, unknown>)
  return id
}

/** New text / color. The teacher changing someone else's note marks it "editado por el docente". */
export function editStickyNote(
  boardId: string,
  classId: string,
  slideId: string,
  noteId: string,
  fields: { text: string; color: NoteColor },
  byTeacherOnOthers: boolean,
) {
  return updateDoc(noteRef(boardId, classId, slideId, noteId), {
    text: stickyTextSchema.parse(fields.text),
    color: fields.color,
    ...(byTeacherOnOthers && { editedByTeacher: true }),
    updatedAt: serverTimestamp(),
  })
}

/** Saved when the note is dropped, not while dragging (D87). */
export function moveStickyNote(
  boardId: string,
  classId: string,
  slideId: string,
  noteId: string,
  { x, y }: Point,
) {
  return updateDoc(noteRef(boardId, classId, slideId, noteId), {
    x,
    y,
    updatedAt: serverTimestamp(),
  })
}

export function deleteStickyNote(
  boardId: string,
  classId: string,
  slideId: string,
  noteId: string,
) {
  return deleteDoc(noteRef(boardId, classId, slideId, noteId))
}

/** Tap an emoji: adds or removes it from my own entry only (the rules check that). */
export function reactToNote(
  boardId: string,
  classId: string,
  slideId: string,
  noteId: string,
  reactions: NoteReactions | undefined,
  me: { uid: string; name: string },
  emoji: Reaction,
) {
  const entry = toggleReaction(reactions, me.uid, me.name.slice(0, 120), emoji)
  return updateDoc(
    noteRef(boardId, classId, slideId, noteId),
    new FieldPath('reactions', me.uid),
    entry ?? deleteField(),
  )
}

/** "Ordenar" (teacher): writes only the notes that move. */
export async function tidyStickyNotes(
  boardId: string,
  classId: string,
  slideId: string,
  moves: Map<string, Point>,
) {
  const entries = [...moves]
  for (let start = 0; start < entries.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const [id, { x, y }] of entries.slice(start, start + BATCH_LIMIT))
      batch.update(noteRef(boardId, classId, slideId, id), {
        x,
        y,
        updatedAt: serverTimestamp(),
      })
    await batch.commit()
  }
}
