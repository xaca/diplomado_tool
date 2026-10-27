# diplomado_pbl

A Padlet-style board for PBL classes: each student gets a space, edits slides, and the teacher presents them.

React 19 + TypeScript + Vite, with Firebase (Auth + Firestore + Hosting) as backend.
Images go to Cloudinary through a small Cloudflare Worker (`services/media-api`) that holds the secret.
UI: Tailwind CSS v4, shadcn/ui (Base UI), GSAP. Everything runs on free tiers. See [PLAN.md](PLAN.md).

## Setup

```bash
npm install
cp .env.example .env.local   # fill with values from Firebase console → Project settings
npm run dev
```

Offline, without touching production (fake `demo-pbl` project):

```bash
npm run emulators            # terminal 1: Auth + Firestore emulators
npm run seed                 # terminal 2: demo teacher, board and students
npm run dev:emulators        # terminal 2: app on http://localhost:5173
```

## media-api (Cloudflare Worker) — local setup

The Worker verifies the Firebase ID token, checks in Firestore (with the caller's token, so the rules decide)
that the student owns the space, and signs the Cloudinary upload. The browser never sees the API secret.

```bash
npm --prefix services/media-api install
cp services/media-api/.dev.vars.example services/media-api/.dev.vars   # paste the Cloudinary API secret
npm run worker:dev           # http://localhost:8787 — set VITE_MEDIA_API_URL=http://localhost:8787 in .env.local
```

- Against the emulators: `npm run worker:dev:emulators` (accepts emulator tokens, `demo-*` projects only).
- Deploy: `npm run worker:deploy`. The secret is stored once with `npx wrangler secret put CLOUDINARY_API_SECRET`
  (run inside `services/media-api`).
- Health check: `GET /health` reports whether the config is complete (never the secret value).
- Production builds use the URL in `.env.production`.

## Scripts

| Script                            | What it does                                            |
| --------------------------------- | ------------------------------------------------------- |
| `npm run dev`                     | Dev server (real Firebase project)                      |
| `npm run dev:emulators`           | Dev server against the local emulators                  |
| `npm run emulators` / `seed`      | Start Auth + Firestore emulators / load demo data       |
| `npm run build`                   | Type-check + production build to `dist/`                |
| `npm run lint` / `npm run format` | ESLint / Prettier                                       |
| `npm test`                        | Unit tests                                              |
| `npm run test:rules`              | Firestore Security Rules tests (emulator)               |
| `npm run test:e2e`                | Playwright end-to-end tests (emulators)                 |
| `npm run test:worker`             | Worker type-check + offline tests                       |
| `npm run test:worker-integration` | Real Worker + emulators + rules                         |
| `npm run test:admin`              | Real admin CLI + Firestore emulator + fake Cloudinary   |
| `npm run check`                   | Full quality gate (all of the above + build)            |
| `npm run worker:dev`              | Run the media-api Worker locally                        |
| `npm run worker:deploy`           | Deploy the media-api Worker to Cloudflare               |
| `npm run deploy:rules`            | Deploy Firestore rules + indexes                        |
| `npm run deploy`                  | Build and deploy Hosting + Firestore rules              |
| `npm run admin`                   | Admin CLI — see below                                   |
| `npm run emulators:free`          | Stop leftover emulator/test processes holding the ports |

## Admin CLI

Runs only on your computer, with admin credentials (it bypasses the Security Rules):
`secrets/service-account.json` for Firebase, and `.env.admin.local` for Cloudinary:

```bash
CLOUDINARY_CLOUD_NAME=syqkgwws
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

| Command                                                        | What it does                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| `npm run admin -- setup --email <gmail>`                       | First admin (once)                                          |
| `npm run admin -- staff list \| add <email> \| remove <email>` | Teacher list                                                |
| `npm run admin -- board archive <id>` / `board restore <id>`   | Archive now / back to active                                |
| `npm run admin -- board purge <id>`                            | Archived boards only: backup to `backups/`, then delete all |
| `npm run admin -- backup <id>`                                 | Board backup (same JSON as the dashboard) to `backups/`     |
| `npm run admin -- cleanup --board <id> \| --all [--dry-run]`   | Delete unused images (Cloudinary + registry)                |
| `npm run admin -- usage`                                       | Cloudinary credits + documents per board                    |

## Structure

```
src/
  app/          router.tsx, guards.tsx
  components/   shadcn ui/ + shared components
  features/     one folder per feature: api.ts, hooks.ts, components/
  lib/          firebase.ts, cloudinary.ts (URL builder), media-api.ts, i18n.ts, hooks
  locales/      es (default) / en
  model/        shared types, paths and zod schemas (no SDK)
  pages/        route components
  providers/    AuthProvider + useAuth()
services/media-api/   Cloudflare Worker (signed uploads)
scripts/              admin CLI, seed, emulator helpers
tests/                rules/, e2e/, integration/
```

## Conventions

- Import Firebase services only from `@/lib/firebase`; components use feature hooks, not the SDK.
- Firestore Security Rules (`firestore.rules`) are the backend: every write is validated there and covered by `tests/rules`.
- Images are stored as an `ImageRef` (never a URL); build delivery URLs with `imageUrl()` from `@/lib/cloudinary`.
- The Cloudinary secret lives only in `services/media-api/.dev.vars` (git-ignored) and in Cloudflare.
- Import GSAP from `@/lib/gsap` and animate with `useGSAP()` (auto cleanup).
