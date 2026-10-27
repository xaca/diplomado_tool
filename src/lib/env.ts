import { z } from 'zod'

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().min(1),
  VITE_MEDIA_API_URL: z.url(),
  // App Check (M8): reCAPTCHA v3 site key (public). Empty → App Check off (e.g. before setup).
  VITE_RECAPTCHA_SITE_KEY: z.string().default(''),
  // Local development only: the debug token registered in Firebase console → App Check
  VITE_APPCHECK_DEBUG_TOKEN: z.string().default(''),
  VITE_USE_EMULATORS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Fail fast: a missing var would otherwise surface as a cryptic Firebase error
  throw new Error(
    `Invalid environment variables (check .env.local against .env.example):\n${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data
