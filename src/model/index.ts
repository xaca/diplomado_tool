import { customAlphabet } from 'nanoid'
import { z } from 'zod'
import { COLLECTIONS, normalizeEmail } from '@/lib/collections'

// Shared data contracts (PLAN.md → "Data model"). No Firebase SDK imports here:
// the app, the admin CLI, the seed script and the tests all use this file.

// ---------- paths ----------

export const paths = {
  board: (boardId: string) => `${COLLECTIONS.boards}/${boardId}`,
  students: (boardId: string) => `${COLLECTIONS.boards}/${boardId}/students`,
  student: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/students/${studentId}`,
  studentEmails: (boardId: string) =>
    `${COLLECTIONS.boards}/${boardId}/studentEmails`,
  studentEmail: (boardId: string, email: string) =>
    `${COLLECTIONS.boards}/${boardId}/studentEmails/${email}`,
  members: (boardId: string) => `${COLLECTIONS.boards}/${boardId}/members`,
  member: (boardId: string, uid: string) =>
    `${COLLECTIONS.boards}/${boardId}/members/${uid}`,
  spaces: (boardId: string) => `${COLLECTIONS.boards}/${boardId}/spaces`,
  assets: (boardId: string) => `${COLLECTIONS.boards}/${boardId}/assets`,
  asset: (boardId: string, assetId: string) =>
    `${COLLECTIONS.boards}/${boardId}/assets/${assetId}`,
  space: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}`,
  slides: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/slides`,
  slide: (boardId: string, studentId: string, slideId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/slides/${slideId}`,
  notes: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/notes`,
  note: (boardId: string, studentId: string, noteId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/notes/${noteId}`,
  /** M16: polls in a student's space, and their votes (one per student) */
  polls: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/polls`,
  poll: (boardId: string, studentId: string, pollId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/polls/${pollId}`,
  vote: (boardId: string, studentId: string, pollId: string, voterId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/polls/${pollId}/votes/${voterId}`,
  /** M15: a slide's saved version ('student' = before the teacher's changes) */
  version: (
    boardId: string,
    studentId: string,
    slideId: string,
    kind: VersionKind,
  ) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/slides/${slideId}/versions/${kind}`,
  /** M15: who is editing a slide right now */
  lock: (boardId: string, studentId: string, slideId: string) =>
    `${COLLECTIONS.boards}/${boardId}/spaces/${studentId}/locks/${slideId}`,
  /** M18: one doc per class date (YYYY-MM-DD), and each student's own summary */
  attendances: (boardId: string) =>
    `${COLLECTIONS.boards}/${boardId}/attendance`,
  attendance: (boardId: string, date: string) =>
    `${COLLECTIONS.boards}/${boardId}/attendance/${date}`,
  attendanceSummaries: (boardId: string) =>
    `${COLLECTIONS.boards}/${boardId}/attendanceByStudent`,
  attendanceSummary: (boardId: string, studentId: string) =>
    `${COLLECTIONS.boards}/${boardId}/attendanceByStudent/${studentId}`,
  /** M19: the teacher's announcements, and each member's read / removed state (doc id = uid) */
  announcements: (boardId: string) =>
    `${COLLECTIONS.boards}/${boardId}/announcements`,
  announcement: (boardId: string, id: string) =>
    `${COLLECTIONS.boards}/${boardId}/announcements/${id}`,
  announcementStates: (boardId: string) =>
    `${COLLECTIONS.boards}/${boardId}/announcementState`,
  announcementState: (boardId: string, uid: string) =>
    `${COLLECTIONS.boards}/${boardId}/announcementState/${uid}`,
  joinCode: (code: string) => `${COLLECTIONS.joinCodes}/${code}`,
}

// ---------- documents (as stored; timestamps are SDK-specific, typed as unknown) ----------

/** users/{uid}: the Google fields are refreshed on every login; the profile fields never are */
export type UserDoc = {
  displayName: string
  email: string
  photoURL: string | null
  locale?: 'es' | 'en'
  /** Name chosen on /me (null → the Google name) */
  profileName?: string | null
  /** Show the Google photo on my cards (default true). Replaced by photoSource (M11), still read. */
  showPhoto?: boolean
  /** Which photo my cards show (M11). Missing → from showPhoto. */
  photoSource?: PhotoSource
  /** My uploaded photo: one per person, overwritten on change (M11) */
  avatar?: AvatarRef | null
  /** M21: my short profile message ("¡Feliz Halloween! 🎃"), shown on my cards */
  status?: StatusMessage | null
  /** M21: my card banner and sticker */
  decor?: Decor | null
  /** M20: once-only moments already celebrated ("first slide"…), so they never repeat */
  milestones?: Partial<Record<Milestone, true>>
  /** M20: "Mensajes de ánimo" on /me (missing = on) */
  cheer?: boolean
  createdAt: unknown
  lastLoginAt: unknown
}

export type PhotoSource = 'google' | 'upload' | 'initials'
export const PHOTO_SOURCES = ['google', 'upload', 'initials'] as const

/** Cloudinary image of an uploaded profile photo: pbl/{env}/users/{uid}/avatar */
export type AvatarRef = { publicId: string; version: number }

export type BoardStatus = 'active' | 'locked' | 'archived'

export type BoardDoc = {
  title: string
  description: string
  teacherEmails: string[]
  joinCode: string
  joinCodeEnabled: boolean
  status: BoardStatus
  archiveAfterDays: number
  background: string
  createdAt: unknown
  updatedAt: unknown
  lastActivityAt: unknown
  /** Set by "archive now" (M7) */
  archivedAt?: unknown
  /** The board's stage list (M11). Missing → DEFAULT_STAGES (Design Thinking). */
  stages?: StageDef[] | null
  /** Look (M12). Missing → today's look: yellow, dots, masonry, sticky header. */
  pattern?: BoardPattern
  layout?: BoardLayout
  sortBy?: BoardSort
  stickyHeader?: boolean
  /** M21: board style and its options (see boardLookSchema) */
  style?: BoardStyleId | null
  ambient?: boolean
  accessories?: boolean
  tagline?: string
  schedule?: StyleSchedule | null
  /** Board logo, uploaded by the teacher (M12) */
  logo?: ImageRef | null
  /** Name and photo of each teacher, by email, for the #DOCENTE ring in the header (M12) */
  teacherProfiles?: Record<string, TeacherProfile>
  /** The class clock: a timed activity or a break, shown to everyone (M16) */
  clock?: ClassClock | null
}

// ---------- class tools (M16) ----------

/**
 * Running: remaining = durationMs - elapsedBeforeMs - (now - startedAt).
 * Paused: remaining = durationMs - elapsedBeforeMs.
 */
export type ClassClock = {
  mode: 'activity' | 'break'
  label: string
  instructions: string
  durationMs: number
  startedAt: unknown
  elapsedBeforeMs: number
  paused: boolean
}
export const CLOCK_PRESETS_MIN = {
  activity: [3, 5, 10, 15, 25],
  break: [5, 10, 15],
} as const
/** Keep in sync with firestore.rules (validClock) */
export const MAX_CLOCK_MS = 3 * 60 * 60_000
export const clockInputSchema = z.object({
  mode: z.enum(['activity', 'break']),
  label: z.string().trim().max(80),
  instructions: z.string().trim().max(300),
  minutes: z.number().min(1).max(180),
})

// ---------- announcements (M19) ----------

/** announcements/{id}: written by the board's teacher; members read them */
export type AnnouncementDoc = {
  title: string
  body: string
  /** '' = none; an https address or an app path ("/b/…") */
  link: string
  /** Opens as a window for students (otherwise only the 🔔) */
  important: boolean
  authorEmail: string
  authorName: string
  createdAt: unknown
  updatedAt: unknown
  /** = createdAt, or the last "Recordar": newer than a student's read / removed → new again */
  remindedAt: unknown
}

/** announcementState/{uid}: when I read / removed each announcement (mine only) */
export type AnnouncementStateDoc = {
  read: Record<string, unknown>
  removed: Record<string, unknown>
  updatedAt: unknown
}

export const announcementInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(500),
  link: z
    .string()
    .trim()
    .max(500)
    .refine(
      (link) =>
        link === '' || /^https:\/\/\S+$/.test(link) || /^\/\S*$/.test(link),
      'https or an app path',
    ),
  important: z.boolean(),
})
export type AnnouncementInput = z.infer<typeof announcementInputSchema>

// ---------- attendance (M18) ----------

export const ATTENDANCE_STATUSES = [
  'present',
  'late',
  'absent',
  'excused',
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
export type AttendanceMark = { status: AttendanceStatus; note?: string }
/** A class date: YYYY-MM-DD (the teacher's local day). Keep in sync with firestore.rules */
export const ATTENDANCE_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** attendance/{date}: the teacher's record of one class (teacher only) */
export type AttendanceDoc = {
  date: string
  topic: string
  /** studentId → mark; students not marked are missing */
  marks: Record<string, AttendanceMark>
  takenBy: string
  updatedAt: unknown
}

/** attendanceByStudent/{studentId}: what that student sees (dates and states, no notes) */
export type AttendanceSummaryDoc = {
  dates: Record<string, AttendanceStatus>
  updatedAt: unknown
}

export const attendanceMarkSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().trim().max(200).optional(),
})
export const attendanceInputSchema = z.object({
  date: z.string().regex(ATTENDANCE_DATE),
  topic: z.string().trim().max(120),
  marks: z.record(z.string().min(1).max(128), attendanceMarkSchema),
})

/** spaces/{studentId}/polls/{pollId}: a quick vote in a student's space */
export type PollDoc = {
  question: string
  options: { id: string; label: string }[]
  /** Same ids as `options` (the rules can't read inside a list of maps) */
  optionIds: string[]
  /** Votes per option id, kept in step with the votes by the rules */
  counts: Record<string, number>
  anonymous: boolean
  status: 'open' | 'closed'
  authorUid: string
  authorName: string
  authorRole: 'student' | 'teacher'
  createdAt: unknown
}
/** polls/{pollId}/votes/{studentId}: one per student (both accounts of a person count once) */
export type VoteDoc = { optionId: string; votedAt: unknown }
export const MAX_OPEN_POLLS = 3
export const pollInputSchema = z.object({
  question: z.string().trim().min(1).max(200),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  anonymous: z.boolean(),
})
export type PollInput = z.infer<typeof pollInputSchema>

export type TeacherProfile = {
  name: string
  photoURL: string | null
  /** M21: the teacher's profile message, next to their name in the board header */
  status?: StatusMessage | null
}

// ---------- status message and decorations (M21) ----------

/** A short message on the profile: an optional emoji and up to 60 characters, no links. */
export const statusSchema = z.object({
  emoji: z.string().trim().max(16),
  text: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((text) => !/(https?:\/\/|www\.)/i.test(text), 'no links'),
})
export type StatusMessage = z.infer<typeof statusSchema>

/** Card banners (colors, gradients, patterns): CSS in features/profile/decor.ts */
export const CARD_BANNERS = [
  'sunrise',
  'lagoon',
  'mint',
  'grape',
  'coral',
  'gold',
  'sky',
  'rose',
  'forest',
  'night',
  'confetti',
  'waves',
] as const
export type CardBanner = (typeof CARD_BANNERS)[number]
export const STICKERS = [
  '🚀',
  '🎨',
  '🌱',
  '☕',
  '🐱',
  '🐶',
  '⭐',
  '🔥',
  '💡',
  '🎧',
  '📚',
  '🧠',
  '🌈',
  '⚽',
  '🎮',
  '🌻',
] as const
export const decorSchema = z.object({
  banner: z.enum(CARD_BANNERS).nullable(),
  sticker: z.enum(STICKERS).nullable(),
})
export type Decor = z.infer<typeof decorSchema>

// ---------- encouragement (M20) ----------

/** Once-only moments; keep in sync with validUser() in firestore.rules */
export const MILESTONES = [
  'firstSlide',
  'photo',
  'firstVote',
  'firstEmbed',
] as const
export type Milestone = (typeof MILESTONES)[number]

// ---------- board styles (M21) ----------

/** Keep in sync with boardStyles() in firestore.rules and features/boards/styles.ts */
export const BOARD_STYLES = [
  'pizarra',
  'cuaderno',
  'kraft',
  'neon',
  'minimal',
  'retro',
  'acuarela',
  'blueprint',
  'navidad',
  'amigo-secreto',
  'halloween',
  'verano',
  'flores',
  'graduacion',
] as const
export type BoardStyleId = (typeof BOARD_STYLES)[number]
const LOOK_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export const styleScheduleSchema = z
  .object({
    style: z.enum(BOARD_STYLES),
    from: z.string().regex(LOOK_DATE),
    to: z.string().regex(LOOK_DATE),
  })
  .refine((schedule) => schedule.from <= schedule.to, 'from after to')
export type StyleSchedule = z.infer<typeof styleScheduleSchema>

// ---------- board look (M12) ----------

/**
 * Background presets. `text` = the color that stays readable on it (checked in tests).
 * Gradients list their stops so the contrast test can check each one.
 */
export const BOARD_BACKGROUNDS = [
  { id: 'yellow', stops: ['#fcd34d'], text: 'dark' },
  { id: 'mint', stops: ['#a7f3d0'], text: 'dark' },
  { id: 'sky', stops: ['#bae6fd'], text: 'dark' },
  { id: 'lavender', stops: ['#ddd6fe'], text: 'dark' },
  { id: 'peach', stops: ['#fed7aa'], text: 'dark' },
  { id: 'sand', stops: ['#f5efe6'], text: 'dark' },
  { id: 'white', stops: ['#ffffff'], text: 'dark' },
  { id: 'charcoal', stops: ['#262626'], text: 'light' },
  { id: 'sunset', stops: ['#fde68a', '#fca5a5'], text: 'dark' },
  { id: 'ocean', stops: ['#a5f3fc', '#a5b4fc'], text: 'dark' },
  { id: 'forest', stops: ['#bbf7d0', '#99f6e4'], text: 'dark' },
  { id: 'night', stops: ['#1e293b', '#4c1d95'], text: 'light' },
] as const satisfies readonly {
  id: string
  stops: readonly string[]
  text: 'dark' | 'light'
}[]
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number]['id']
export const BOARD_BACKGROUND_IDS = BOARD_BACKGROUNDS.map((b) => b.id) as [
  BoardBackground,
  ...BoardBackground[],
]
export const BOARD_PATTERNS = ['dots', 'grid', 'none'] as const
export type BoardPattern = (typeof BOARD_PATTERNS)[number]
export const BOARD_LAYOUTS = [
  'masonry',
  'grid',
  'list',
  'stages',
  'groups',
] as const
export type BoardLayout = (typeof BOARD_LAYOUTS)[number]
export const BOARD_SORTS = ['joined', 'name', 'updated'] as const
export type BoardSort = (typeof BOARD_SORTS)[number]

/** Keep in sync with validBoard() in firestore.rules */
export const boardLookSchema = z.object({
  background: z.enum(BOARD_BACKGROUND_IDS),
  pattern: z.enum(BOARD_PATTERNS),
  layout: z.enum(BOARD_LAYOUTS),
  sortBy: z.enum(BOARD_SORTS),
  stickyHeader: z.boolean(),
  /** M21: the teacher's style (null: background + pattern as chosen); defaults keep old boards */
  style: z.enum(BOARD_STYLES).nullable().default(null),
  /** M21: the style's background animation (snow, petals…) */
  ambient: z.boolean().default(true),
  /** M21: seasonal accessories on the photos (Santa hats…), switched by the teacher */
  accessories: z.boolean().default(true),
  /** M21: a line next to the title ("¡Lo lograron! · Clase de 2026"); empty = the style's own */
  tagline: z.string().trim().max(60).default(''),
  /** M21: optional dates for a style; outside them the board shows `style` */
  schedule: styleScheduleSchema.nullable().default(null),
})
export type BoardLook = z.infer<typeof boardLookSchema>

export const DEFAULT_LOOK: BoardLook = {
  background: 'yellow',
  pattern: 'dots',
  layout: 'masonry',
  sortBy: 'joined',
  stickyHeader: true,
  style: null,
  ambient: true,
  accessories: true,
  tagline: '',
  schedule: null,
}

export type StudentSource = 'import' | 'manual' | 'invite'

export type StudentDoc = {
  displayName: string
  emails: string[]
  group: string
  status: 'invited' | 'joined'
  linkedUids: string[]
  source: StudentSource
  createdAt: unknown
  joinedAt?: unknown
  /** Only on students who joined with the invite link (proof checked by the rules) */
  inviteCode?: string
}

export type StudentEmailDoc = { email: string; studentId: string }

export type MemberDoc = {
  uid: string
  studentId: string
  email: string
  joinedAt: unknown
}

export type SpaceDoc = {
  studentId: string
  ownerName: string
  ownerPhotoURL: string | null
  /** M21: the owner's profile message and decorations (copied from their profile) */
  ownerStatus?: StatusMessage | null
  ownerDecor?: Decor | null
  title: string
  summary: string
  color: string
  slideOrder: string[]
  slideCount: number
  /** Card cover image (M4) */
  cover?: ImageRef | null
  /** M16: the student marked their slides ready to present */
  readyToPresent?: boolean
  readyAt?: unknown
  /** M15: the teacher changed the student's slides and the student hasn't looked yet */
  teacherEditsUnseen?: boolean
  /** The student's group (e.g. "Equipo 1"), copied from the roster for the "Por grupo" layout (M12) */
  group?: string
  /** Where the student is in the process (M11): a StageDef id of this board; null = no ring */
  stage?: string | null
  stageUpdatedAt?: unknown
  stageSetBy?: 'student' | 'teacher'
  createdAt: unknown
  updatedAt: unknown
}

// ---------- stages (M11): the ring around the student's photo ----------

/**
 * One step of the board's process. Default stages have no `label` (translated as stages.<id>);
 * stages the teacher renames or adds carry their own. `browsing` = only here to learn.
 */
export type StageDef = {
  id: string
  label?: string
  color: string
  kind: 'stage' | 'browsing'
}

/** Keep in sync with the stage id check in firestore.rules */
export const STAGE_ID_PATTERN = /^[a-z0-9-]{1,40}$/
export const MAX_STAGES = 9
export const MAX_STAGE_LABEL = 24

/** Ring colors: dark enough for white text on the ring */
export const STAGE_COLORS = [
  '#E11D48',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#64748B',
] as const

/** Design Thinking (Stanford d.school) + "Vitrineando" */
export const DEFAULT_STAGES: StageDef[] = [
  { id: 'empathize', color: '#E11D48', kind: 'stage' },
  { id: 'define', color: '#EA580C', kind: 'stage' },
  { id: 'ideate', color: '#CA8A04', kind: 'stage' },
  { id: 'prototype', color: '#16A34A', kind: 'stage' },
  { id: 'test', color: '#2563EB', kind: 'stage' },
  { id: 'browsing', color: '#64748B', kind: 'browsing' },
]
export const DEFAULT_STAGE_IDS = DEFAULT_STAGES.map((stage) => stage.id)

export const stageListSchema = z
  .array(
    z.object({
      id: z.string().regex(STAGE_ID_PATTERN),
      label: z.string().trim().min(1).max(MAX_STAGE_LABEL).optional(),
      color: z.enum(STAGE_COLORS),
      kind: z.enum(['stage', 'browsing']),
    }),
  )
  .min(1)
  .max(MAX_STAGES)
  .refine(
    (stages) => new Set(stages.map((stage) => stage.id)).size === stages.length,
    'duplicated stage id',
  )

/** Reference to an image stored in Cloudinary (never a URL; see lib/cloudinary.ts imageUrl) */
export type ImageRef = {
  assetId: string
  publicId: string
  version: number
  width: number
  height: number
  format: string
}

/** boards/{boardId}/spaces/{studentId}/slides/{slideId}: one Excalidraw scene per slide (M5) */
export type SlideDoc = {
  engine: 'excalidraw'
  /** JSON string of the scene (elements + background); never image data */
  content: string
  /** Excalidraw file id → Cloudinary image */
  files: Record<string, ImageRef>
  /** Same images as asset ids (unused-image detection in M7) */
  assetIds: string[]
  /** Size of `content` in bytes (Firestore documents are limited to 1 MiB) */
  bytes: number
  schemaVersion: 1
  updatedAt: unknown
  /** M15: who saved last; 'teacher' shows "Editada por el docente" to the student */
  lastEditedBy?: 'student' | 'teacher'
  teacherEditedAt?: unknown
  /** M15: images of the saved versions (they count as used, so a restore finds them) */
  versionAssetIds?: string[]
}

// ---------- teacher edits (M15) ----------

export type VersionKind = 'student' | 'teacher'
export const VERSION_KINDS = ['student', 'teacher'] as const

/**
 * slides/{slideId}/versions/{kind}: 'student' = the slide as the student left it before the
 * teacher's first change; 'teacher' = the teacher's version, kept when the student restores theirs.
 */
export type SlideVersionDoc = Pick<
  SlideDoc,
  'content' | 'files' | 'assetIds' | 'bytes'
> & { kind: VersionKind; createdAt: unknown }

/** spaces/{studentId}/locks/{slideId}: one editor per slide (heartbeat; stale after LOCK_STALE_MS) */
export type SlideLockDoc = {
  uid: string
  name: string
  role: 'student' | 'teacher'
  at: unknown
}
export const LOCK_HEARTBEAT_MS = 20_000
/** Keep in sync with the 60 s in firestore.rules (locks) */
export const LOCK_STALE_MS = 60_000

export const MAX_SLIDES = 50
export const MAX_IMAGES_PER_SLIDE = 30
/** Hard limit enforced by the rules; the editor warns from SLIDE_WARN_BYTES */
export const MAX_SLIDE_BYTES = 900_000
export const SLIDE_WARN_BYTES = 800_000

/**
 * boards/{boardId}/spaces/{studentId}/notes/{noteId}: the teacher's annotation on one slide.
 * Private: only the board's teachers and the space's owner read them.
 */
export type NoteDoc = {
  slideId: string
  text: string
  authorEmail: string
  authorName: string
  createdAt: unknown
  updatedAt: unknown
}

export const MAX_NOTE_LENGTH = 2000

export const noteTextSchema = z.string().trim().min(1).max(MAX_NOTE_LENGTH)

export type AssetKind = 'cover' | 'slide' | 'logo'
/** Registry `studentId` (and Cloudinary folder) of board-level images, e.g. the logo (M12) */
export const BOARD_ASSET_OWNER = 'board'
export type AssetStatus = 'active' | 'orphaned' | 'deleted'

/** boards/{boardId}/assets/{assetId}: one per upload (storage usage, cleanup in M7) */
export type AssetDoc = {
  publicId: string
  studentId: string
  kind: AssetKind
  width: number
  height: number
  format: string
  bytes: number
  status: AssetStatus
  createdAt: unknown
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export type JoinCodeDoc = {
  boardId: string
  boardTitle: string
  createdAt: unknown
}

// ---------- inputs (validated before writing) ----------

export const MAX_EMAILS_PER_STUDENT = 5

export const emailSchema = z
  .string()
  .trim()
  .transform(normalizeEmail)
  .pipe(z.email())

export const boardInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
})
export type BoardInput = z.infer<typeof boardInputSchema>

/** Profile page (/me). An empty name means "use my Google name". */
export const userProfileSchema = z.object({
  name: z.string().trim().max(120),
  photoSource: z.enum(PHOTO_SOURCES),
})
export type UserProfile = z.infer<typeof userProfileSchema>

export const studentInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  emails: z
    .array(emailSchema)
    .min(1)
    .max(MAX_EMAILS_PER_STUDENT)
    .refine(
      (emails) => new Set(emails).size === emails.length,
      'duplicated email',
    ),
  group: z.string().trim().max(60).default(''),
})
export type StudentInput = z.infer<typeof studentInputSchema>

// ---------- join codes ----------

/** No 0/O/1/I/L: codes are read aloud and typed by students */
export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const JOIN_CODE_LENGTH = 6
export const newJoinCode = customAlphabet(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH)

/** Card colors (Padlet-like pastels). White first: the default card. */
export const SPACE_COLORS = [
  '#FFFFFF',
  '#FEF3C7',
  '#FCE7F3',
  '#EDE9FE',
  '#DBEAFE',
  '#DCFCE7',
  '#FFEDD5',
] as const

/** Same order as SPACE_COLORS (translated as space.colors.<name>) */
export const SPACE_COLOR_NAMES = [
  'white',
  'yellow',
  'pink',
  'purple',
  'blue',
  'green',
  'orange',
] as const

export const spaceProfileSchema = z.object({
  title: z.string().trim().max(120),
  summary: z.string().trim().max(1000),
  color: z.enum(SPACE_COLORS),
})
export type SpaceProfile = z.infer<typeof spaceProfileSchema>

export function defaultSpace(
  studentId: string,
  ownerName: string,
  ownerPhotoURL: string | null,
) {
  return {
    studentId,
    ownerName,
    ownerPhotoURL,
    title: '',
    summary: '',
    color: SPACE_COLORS[0],
    slideOrder: [] as string[],
    slideCount: 0,
  }
}
