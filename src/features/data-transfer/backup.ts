import { z } from 'zod'
import {
  announcementInputSchema,
  attendanceMarkSchema,
  ATTENDANCE_DATE,
  emailSchema,
  MAX_EMAILS_PER_STUDENT,
  MAX_IMAGES_PER_SLIDE,
  MAX_SLIDE_BYTES,
  MAX_SLIDES,
  SPACE_COLORS,
  STAGE_ID_PATTERN,
  boardLookSchema,
  type BoardLook,
  stageListSchema,
  type ImageRef,
  type StageDef,
  type AttendanceMark,
  type AnnouncementInput,
  CLASS_LAYOUTS,
  MAX_CLASS_SLIDES,
  MAX_STICKY_TEXT,
  NOTE_COLORS,
  REACTIONS,
  type ClassDoc,
  type ClassSlideDoc,
  type StickyNoteDoc,
  MAX_RECORDING_TITLE,
  MAX_RECORDING_VIDEOS,
  MAX_VIDEO_TITLE,
  YOUTUBE_LIST_ID,
  YOUTUBE_VIDEO_ID,
  type RecordingDoc,
  courseSetupSchema,
  emailSenderSchema,
  newsInputSchema,
  type CourseSetup,
  type EmailSender,
  type NewsDoc,
  type NewsInput,
  MAX_MESSAGE_TEXT,
  type MessageDoc,
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
  /** M11: the board's own stage list (missing / null = Design Thinking defaults) */
  stages: stageListSchema.nullable().optional(),
  /** M12: the board's look (missing = today's look); the logo isn't restored, like covers */
  look: boardLookSchema.optional(),
  /** M24: the course setup (a template carries it too: copy a course's schedule) and the sender */
  course: courseSetupSchema.nullable().optional(),
  emailSender: emailSenderSchema.nullable().optional(),
})

const slideSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  content: z.string().max(MAX_SLIDE_BYTES),
  files: z
    .record(z.string(), imageRefSchema)
    .refine((files) => Object.keys(files).length <= MAX_IMAGES_PER_SLIDE),
})

const uidSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)

const reactionsSchema = z.record(
  uidSchema,
  z.object({
    name: z.string().min(1).max(120),
    emojis: z.array(z.enum(REACTIONS)).min(1).max(REACTIONS.length),
  }),
)

const stickyNoteBackupSchema = z
  .object({
    /** {authorUid}_{n}: kept so the author still owns it after a restore */
    id: z.string().regex(/^[A-Za-z0-9_-]{1,128}_([1-9]|1[0-9]|20)$/),
    text: z.string().min(1).max(MAX_STICKY_TEXT),
    color: z.enum(NOTE_COLORS),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    authorUid: uidSchema,
    authorStudentId: z.string().max(128).nullable(),
    authorName: z.string().min(1).max(120),
    authorRole: z.enum(['student', 'teacher']),
    reactions: reactionsSchema,
    editedByTeacher: z.boolean(),
  })
  .refine((note) => note.id.startsWith(`${note.authorUid}_`), {
    message: 'a note id starts with its author',
  })

const classBackupSchema = z.object({
  title: z.string().min(1).max(80),
  date: z.string().regex(ATTENDANCE_DATE),
  status: z.enum(['open', 'closed']),
  slides: z
    .array(
      z.object({
        // optional since M10b (D91)
        title: z.string().max(120),
        instructions: z.string().max(500),
        layout: z.enum(CLASS_LAYOUTS),
        zones: z.array(z.string().max(40)).max(4),
        locked: z.boolean(),
        /** M10b: the teacher's drawing (image references only) and the slide's reactions */
        drawing: slideSchema.omit({ id: true }).optional(),
        reactions: reactionsSchema.optional(),
        notes: z.array(stickyNoteBackupSchema).max(2000),
      }),
    )
    .max(MAX_CLASS_SLIDES),
})
export type ClassBackup = z.infer<typeof classBackupSchema>

const recordingBackupSchema = z.object({
  title: z.string().trim().min(1).max(MAX_RECORDING_TITLE),
  listId: z.string().regex(YOUTUBE_LIST_ID),
  videos: z
    .array(
      z.object({
        id: z.string().regex(YOUTUBE_VIDEO_ID),
        title: z.string().max(MAX_VIDEO_TITLE),
        seconds: z.number().int().min(0),
        playable: z.boolean(),
      }),
    )
    .max(MAX_RECORDING_VIDEOS),
  titles: z.record(
    z.string().regex(YOUTUBE_VIDEO_ID),
    z.string().max(MAX_VIDEO_TITLE),
  ),
  hidden: z.array(z.string().regex(YOUTUBE_VIDEO_ID)).max(MAX_RECORDING_VIDEOS),
})

/** M26: one student's conversation with the teachers, oldest message first (D119) */
const conversationBackupSchema = z.object({
  studentId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  messages: z
    .array(
      z.object({
        from: z.enum(['student', 'teacher']),
        authorName: z.string().min(1).max(200),
        text: z.string().min(1).max(MAX_MESSAGE_TEXT),
        sentAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(5000),
})
export type ConversationBackup = z.infer<typeof conversationBackupSchema>

/** A conversation as it goes into the backup: its messages, oldest first */
export const conversationBackupOf = (
  studentId: string,
  messages: (Pick<MessageDoc, 'from' | 'authorName' | 'text'> & {
    sentAt: Date
  })[],
): ConversationBackup => ({
  studentId,
  messages: [...messages]
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    .map((message) => ({
      from: message.from,
      authorName: message.authorName,
      text: message.text,
      sentAt: message.sentAt.toISOString(),
    })),
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
        /** M11 (optional: files from before keep restoring) */
        stage: z.string().regex(STAGE_ID_PATTERN).nullable().optional(),
        slides: z.array(slideSchema).max(MAX_SLIDES),
      }),
    )
    .max(500),
  /** M18: one record per class date (optional: files from before keep restoring) */
  attendance: z
    .array(
      z.object({
        date: z.string().regex(ATTENDANCE_DATE),
        topic: z.string().max(120),
        marks: z.record(
          z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
          attendanceMarkSchema,
        ),
      }),
    )
    .max(1000)
    .optional(),
  /** M19: the teacher's announcements (students' read state is not kept) */
  announcements: z.array(announcementInputSchema).max(200).optional(),
  /** M10: class walls with their notes and reactions (optional: files from before keep restoring) */
  classes: z.array(classBackupSchema).max(500).optional(),
  /** M23: the YouTube playlists, in the teacher's order (students' progress is not kept) */
  recordings: z.array(recordingBackupSchema).max(50).optional(),
  /** M24: course news (the email log stays out: it's a record of what was sent) */
  news: z.array(newsInputSchema).max(1000).optional(),
  /** M26: the students' conversations (not in a template); optional: files from before restore */
  conversations: z.array(conversationBackupSchema).max(500).optional(),
})
export type BoardBackup = z.infer<typeof boardBackupSchema>

export type RecordingBackup = z.infer<typeof recordingBackupSchema>

/** A playlist as it goes into the backup (from the app or the CLI) */
export const recordingBackupOf = (
  recording: Pick<
    RecordingDoc,
    'title' | 'listId' | 'videos' | 'titles' | 'hidden'
  >,
): RecordingBackup => ({
  title: recording.title,
  listId: recording.listId,
  videos: recording.videos ?? [],
  titles: recording.titles ?? {},
  hidden: recording.hidden ?? [],
})

/** A news item as it goes into the backup */
export const newsBackupOf = (
  item: Pick<
    NewsDoc,
    'date' | 'wholeWeek' | 'kind' | 'title' | 'text' | 'link'
  >,
): NewsInput => ({
  date: item.date,
  wholeWeek: item.wholeWeek ?? false,
  kind: item.kind,
  title: item.title,
  text: item.text ?? '',
  link: item.link ?? '',
})

export const boardTemplateSchema = z.object({
  type: z.literal('pbl.boardTemplate'),
  version: z.literal(1),
  board: boardSettingsSchema,
})
export type BoardTemplate = z.infer<typeof boardTemplateSchema>

/** What the backup is built from (plain data, read by the app or the CLI). */
export type BoardSnapshot = {
  board: {
    title: string
    description: string
    archiveAfterDays: number
    stages?: StageDef[] | null
    look?: BoardLook
    course?: CourseSetup | null
    emailSender?: EmailSender | null
  }
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
    stage?: string | null
    slideOrder: string[]
  }[]
  /** Slides per student id */
  slides: Record<
    string,
    { id: string; content: string; files: Record<string, ImageRef> }[]
  >
  /** M18: class dates with their marks */
  attendance?: {
    date: string
    topic: string
    marks: Record<string, AttendanceMark>
  }[]
  /** M19: oldest first */
  announcements?: AnnouncementInput[]
  /** M10: class walls, oldest date first */
  classes?: ClassBackup[]
  /** M23: playlists in the teacher's order */
  recordings?: RecordingBackup[]
  /** M24: course news */
  news?: NewsInput[]
  /** M26: conversations, each with its messages */
  conversations?: ConversationBackup[]
}

/** A class as it goes into the backup: its slides in order, each with its notes (oldest first). */
export function classBackupOf(
  klass: Pick<ClassDoc, 'title' | 'date' | 'status' | 'slideOrder'>,
  slides: ReadonlyMap<string, ClassSlideDoc>,
  notes: ReadonlyMap<string, { id: string; data: StickyNoteDoc }[]>,
): ClassBackup {
  return {
    title: klass.title,
    date: klass.date,
    status: klass.status,
    slides: klass.slideOrder.flatMap((id) => {
      const slide = slides.get(id)
      if (!slide) return []
      return [
        {
          title: slide.title,
          instructions: slide.instructions,
          layout: slide.layout,
          zones: slide.zones,
          locked: slide.locked,
          ...(slide.content && {
            drawing: { content: slide.content, files: slide.files ?? {} },
          }),
          ...(slide.reactions &&
            Object.keys(slide.reactions).length > 0 && {
              reactions: slide.reactions,
            }),
          notes: (notes.get(id) ?? []).map(({ id: noteId, data }) => ({
            id: noteId,
            text: data.text,
            color: data.color,
            x: data.x,
            y: data.y,
            authorUid: data.authorUid,
            authorStudentId: data.authorStudentId,
            authorName: data.authorName,
            authorRole: data.authorRole,
            reactions: data.reactions ?? {},
            editedByTeacher: data.editedByTeacher,
          })),
        },
      ]
    }),
  }
}

export function buildBackup(
  snapshot: BoardSnapshot,
  exportedAt = new Date(),
): BoardBackup {
  const settings = boardSettingsSchema.parse(snapshot.board)
  const students = new Set(snapshot.students.map((student) => student.id))
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
        stage: space.stage ?? null,
        // In the space's order; slides without a document are skipped
        slides: space.slideOrder.flatMap((id) => {
          const slide = byId.get(id)
          return slide
            ? [{ id, content: slide.content, files: slide.files ?? {} }]
            : []
        }),
      }
    }),
    // Marks of students no longer on the roster are left out
    attendance: (snapshot.attendance ?? [])
      .map((day) => ({
        date: day.date,
        topic: day.topic,
        marks: Object.fromEntries(
          Object.entries(day.marks).filter(([id]) => students.has(id)),
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    announcements: snapshot.announcements ?? [],
    classes: [...(snapshot.classes ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    recordings: snapshot.recordings ?? [],
    news: [...(snapshot.news ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
    // Conversations of students no longer on the roster are left out (like attendance)
    conversations: (snapshot.conversations ?? []).filter(
      (item) => students.has(item.studentId) && item.messages.length > 0,
    ),
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
