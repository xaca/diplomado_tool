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
  /** Board logo, uploaded by the teacher (M12) */
  logo?: ImageRef | null
  /** Name and photo of each teacher, by email, for the #DOCENTE ring in the header (M12) */
  teacherProfiles?: Record<string, TeacherProfile>
}

export type TeacherProfile = { name: string; photoURL: string | null }

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
})
export type BoardLook = z.infer<typeof boardLookSchema>

export const DEFAULT_LOOK: BoardLook = {
  background: 'yellow',
  pattern: 'dots',
  layout: 'masonry',
  sortBy: 'joined',
  stickyHeader: true,
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
  title: string
  summary: string
  color: string
  slideOrder: string[]
  slideCount: number
  /** Card cover image (M4) */
  cover?: ImageRef | null
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
}

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
