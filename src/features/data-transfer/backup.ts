import { z } from 'zod'
import {
  emailSchema,
  MAX_EMAILS_PER_STUDENT,
  MAX_IMAGES_PER_SLIDE,
  MAX_SLIDE_BYTES,
  MAX_SLIDES,
  SPACE_COLORS,
  type ImageRef,
} from '@/model'

// Board backup and template files (PLAN.md → Import / export). Pure: shared with the admin CLI.
// Every file carries `type` + `version` and is validated before anything is written.
// Images are not inside the backup: only their Cloudinary references (they still work until purged).

const imageRefSchema = z.object({
  assetId: z.string().min(1).max(128),
  publicId: z.string().min(1).max(300),
  version: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  format: z.string().max(10),
})

const boardSettingsSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).default(''),
  archiveAfterDays: z.number().int().min(7).max(3650).default(90),
})

const slideSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  content: z.string().max(MAX_SLIDE_BYTES),
  files: z
    .record(z.string(), imageRefSchema)
    .refine((files) => Object.keys(files).length <= MAX_IMAGES_PER_SLIDE),
})

export const boardBackupSchema = z.object({
  type: z.literal('pbl.boardBackup'),
  version: z.literal(1),
  exportedAt: z.string(),
  board: boardSettingsSchema,
  students: z
    .array(
      z.object({
        id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        name: z.string().trim().min(1).max(120),
        emails: z.array(emailSchema).min(1).max(MAX_EMAILS_PER_STUDENT),
        group: z.string().max(60).default(''),
      }),
    )
    .max(500),
  spaces: z
    .array(
      z.object({
        studentId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        title: z.string().max(120),
        summary: z.string().max(1000),
        color: z.enum(SPACE_COLORS),
        cover: imageRefSchema.nullable(),
        slides: z.array(slideSchema).max(MAX_SLIDES),
      }),
    )
    .max(500),
})
export type BoardBackup = z.infer<typeof boardBackupSchema>

export const boardTemplateSchema = z.object({
  type: z.literal('pbl.boardTemplate'),
  version: z.literal(1),
  board: boardSettingsSchema,
})
export type BoardTemplate = z.infer<typeof boardTemplateSchema>

/** What the backup is built from (plain data, read by the app or the CLI). */
export type BoardSnapshot = {
  board: { title: string; description: string; archiveAfterDays: number }
  students: {
    id: string
    displayName: string
    emails: string[]
    group: string
  }[]
  spaces: {
    studentId: string
    title: string
    summary: string
    color: string
    cover?: ImageRef | null
    slideOrder: string[]
  }[]
  /** Slides per student id */
  slides: Record<
    string,
    { id: string; content: string; files: Record<string, ImageRef> }[]
  >
}

export function buildBackup(
  snapshot: BoardSnapshot,
  exportedAt = new Date(),
): BoardBackup {
  const settings = boardSettingsSchema.parse(snapshot.board)
  return boardBackupSchema.parse({
    type: 'pbl.boardBackup',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    board: settings,
    students: snapshot.students.map((student) => ({
      id: student.id,
      name: student.displayName,
      emails: student.emails,
      group: student.group ?? '',
    })),
    spaces: snapshot.spaces.map((space) => {
      const byId = new Map(
        (snapshot.slides[space.studentId] ?? []).map((slide) => [
          slide.id,
          slide,
        ]),
      )
      return {
        studentId: space.studentId,
        title: space.title,
        summary: space.summary,
        color: space.color,
        cover: space.cover ?? null,
        // In the space's order; slides without a document are skipped
        slides: space.slideOrder.flatMap((id) => {
          const slide = byId.get(id)
          return slide
            ? [{ id, content: slide.content, files: slide.files ?? {} }]
            : []
        }),
      }
    }),
  })
}

export function buildTemplate(board: BoardSnapshot['board']): BoardTemplate {
  return {
    type: 'pbl.boardTemplate',
    version: 1,
    board: boardSettingsSchema.parse(board),
  }
}

export type BoardFile =
  | { kind: 'backup'; file: BoardBackup }
  | { kind: 'template'; file: BoardTemplate }

export class BoardFileError extends Error {}

/** Reads a backup or template file; anything else (or a newer version) is refused. */
export function parseBoardFile(data: unknown): BoardFile {
  const type = (data as { type?: unknown } | null)?.type
  if (type === 'pbl.boardBackup') {
    const result = boardBackupSchema.safeParse(data)
    if (result.success) return { kind: 'backup', file: result.data }
  } else if (type === 'pbl.boardTemplate') {
    const result = boardTemplateSchema.safeParse(data)
    if (result.success) return { kind: 'template', file: result.data }
  }
  throw new BoardFileError('not a valid board backup or template')
}

/** Restored slides keep their image references; the asset ids are rebuilt from them. */
export function slideAssetIds(files: Record<string, ImageRef>) {
  return [...new Set(Object.values(files).map((ref) => ref.assetId))]
}
