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
  joinCode: (code: string) => `${COLLECTIONS.joinCodes}/${code}`,
}

// ---------- documents (as stored; timestamps are SDK-specific, typed as unknown) ----------

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
  createdAt: unknown
  updatedAt: unknown
}

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

export type AssetKind = 'cover' | 'slide'
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
