import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WithId } from '@/lib/firestore-hooks'
import { toDate } from '@/lib/time'
import {
  paths,
  spaceProfileSchema,
  STAGE_ID_PATTERN,
  type ImageRef,
  type ProjectVersion,
  type SpaceDoc,
  type SpaceProfile,
  type WorkStatus,
} from '@/model'

export type Space = WithId<SpaceDoc>

export const spacesCollection = (boardId: string) =>
  collection(db, paths.spaces(boardId))

/**
 * The student edits their card, and their stage (M11) when `stage` is given (null = no stage).
 * Only touches the space doc (PLAN.md review R2: no fan-out on slide saves).
 */
export function updateSpaceProfile(
  boardId: string,
  studentId: string,
  profile: SpaceProfile,
  stage?: string | null,
) {
  const { title, summary, color } = spaceProfileSchema.parse(profile)
  if (stage != null && !STAGE_ID_PATTERN.test(stage))
    throw new Error(`invalid stage id: ${stage}`)
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    title,
    summary,
    color,
    ...(stage !== undefined && {
      stage,
      stageUpdatedAt: serverTimestamp(),
      stageSetBy: 'student',
    }),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Dashboard order, Padlet-like: my own card first, then by the order students joined.
 * Pure function (unit-tested).
 */
export function sortSpaces<
  T extends Pick<SpaceDoc, 'createdAt' | 'ownerName'> & { id: string },
>(spaces: T[], myStudentId: string | null): T[] {
  return [...spaces].sort((a, b) => {
    if (a.id === myStudentId) return -1
    if (b.id === myStudentId) return 1
    const byJoin = toDate(a.createdAt).getTime() - toDate(b.createdAt).getTime()
    return byJoin !== 0 ? byJoin : a.ownerName.localeCompare(b.ownerName, 'es')
  })
}

/**
 * Sets (or removes, with null) the card cover. The previous image is marked "orphaned" in the
 * registry so the M7 cleanup can delete it from Cloudinary, unless a kept version of the project
 * still shows it (M27, `keep`).
 */
export async function setSpaceCover(
  boardId: string,
  studentId: string,
  next: ImageRef | null,
  previous: ImageRef | null | undefined,
  keep?: ImageRef | null,
) {
  const batch = writeBatch(db)
  batch.update(doc(db, paths.space(boardId, studentId)), {
    cover: next,
    updatedAt: serverTimestamp(),
  })
  if (
    previous &&
    previous.assetId !== next?.assetId &&
    previous.assetId !== keep?.assetId
  ) {
    batch.update(doc(db, paths.asset(boardId, previous.assetId)), {
      status: 'orphaned',
    })
  }
  await batch.commit()
}

/** The student marks their slides ready to present, or not (M16, F21). */
export function setReadyToPresent(
  boardId: string,
  studentId: string,
  ready: boolean,
) {
  return setWorkStatus(boardId, studentId, ready ? 'ready' : 'wip', 'student')
}

/**
 * M27 (D132): "En progreso" or "Listo", signed by whoever sets it. Keeps the M16 flag equal to
 * "Listo", so every list, filter and achievement reading it keeps working.
 */
export function setWorkStatus(
  boardId: string,
  studentId: string,
  status: WorkStatus,
  by: 'student' | 'teacher',
) {
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    workStatus: status,
    workStatusAt: serverTimestamp(),
    workStatusBy: by,
    readyToPresent: status === 'ready',
    readyAt: status === 'ready' ? serverTimestamp() : null,
    // the student's own change bumps the card; the teacher's doesn't need to
    ...(by === 'student' && { updatedAt: serverTimestamp() }),
  })
}

type ProjectDetails = Pick<SpaceDoc, 'title' | 'summary' | 'color'> & {
  cover?: ImageRef | null
}

const detailsOf = (space: SpaceDoc): Omit<ProjectVersion, 'by'> => ({
  title: space.title,
  summary: space.summary,
  color: space.color,
  cover: space.cover ?? null,
})

/**
 * The version of the project to keep when the teacher changes it (M27, D129): the student's as
 * they left it. Already kept (an earlier change by the teacher) → keep that one. Pure, unit-tested.
 */
export function versionToKeep(space: SpaceDoc): ProjectVersion {
  if (space.previousVersion?.by === 'student') return space.previousVersion
  return { ...detailsOf(space), by: 'student' }
}

/**
 * M27 (D129): the board's teacher changes the project's details (and the cover, when given),
 * keeping the student's version for "Restaurar mi versión". Images no version shows any more
 * are marked unused.
 */
export async function updateProjectAsTeacher(
  boardId: string,
  space: Space,
  changes: Partial<ProjectDetails>,
) {
  const keep = versionToKeep(space)
  const next = { ...detailsOf(space), ...changes }
  if (changes.title !== undefined || changes.summary !== undefined) {
    const { title, summary, color } = spaceProfileSchema.parse(next)
    Object.assign(next, { title, summary, color })
  }
  const batch = writeBatch(db)
  batch.update(doc(db, paths.space(boardId, space.id)), {
    ...changes,
    ...(changes.title !== undefined && { title: next.title }),
    ...(changes.summary !== undefined && { summary: next.summary }),
    previousVersion: keep,
    teacherEditedAt: serverTimestamp(),
    teacherEditsUnseen: true,
    updatedAt: serverTimestamp(),
  })
  // Covers nobody shows any more: the one replaced now, and a dropped teacher version's
  const shown = new Set(
    [keep.cover?.assetId, next.cover?.assetId].filter(Boolean),
  )
  const dropped = [space.cover, space.previousVersion?.cover]
  const orphaned = new Set<string>()
  for (const cover of dropped)
    if (cover && !shown.has(cover.assetId)) orphaned.add(cover.assetId)
  for (const assetId of orphaned)
    batch.update(doc(db, paths.asset(boardId, assetId)), { status: 'orphaned' })
  await batch.commit()
}

/**
 * "Restaurar mi versión" (M27): the student brings back the kept details; the current ones are
 * kept in turn, so it can be undone ("Volver a la versión del docente").
 */
export function swapProjectVersion(boardId: string, space: Space) {
  const kept = space.previousVersion
  if (!kept) return Promise.resolve()
  return updateDoc(doc(db, paths.space(boardId, space.id)), {
    title: kept.title,
    summary: kept.summary,
    color: kept.color,
    cover: kept.cover,
    previousVersion: {
      ...detailsOf(space),
      by: kept.by === 'student' ? 'teacher' : 'student',
    },
    updatedAt: serverTimestamp(),
  })
}

/** The student looked at their space: "✎ Docente" and "Comentario nuevo" go away (M15, M27). */
export function markTeacherChangesSeen(
  boardId: string,
  studentId: string,
  flags: { edits?: boolean; comments?: boolean },
) {
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    ...(flags.edits && { teacherEditsUnseen: false }),
    ...(flags.comments && { teacherCommentsUnseen: false }),
  })
}

/** M21: the board's teacher clears a student's profile message on this board (moderation). */
export function clearCardStatus(boardId: string, studentId: string) {
  return updateDoc(doc(db, paths.space(boardId, studentId)), {
    ownerStatus: null,
  })
}
