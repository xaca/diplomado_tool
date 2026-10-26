# diplomado_pbl

React 19 + TypeScript + Vite, with Firebase (Auth + Firestore + Hosting) as backend.
UI: Tailwind CSS v4, shadcn/ui (Base UI), GSAP.

## Setup

```bash
npm install
cp .env.example .env.local   # fill with values from Firebase console → Project settings
npm run dev
```

## Scripts

| Script                            | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                       |
| `npm run build`                   | Type-check + production build to `dist/`                         |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                |
| `npm run emulators`               | Local Auth + Firestore emulators (set `VITE_USE_EMULATORS=true`) |
| `npm run deploy`                  | Build and deploy to Firebase Hosting + Firestore rules           |

## Structure

```
src/
  app/          App.tsx (providers), router.tsx
  components/ui shadcn components — add with `npx shadcn@latest add <name>`
  lib/          env.ts (validated env), firebase.ts (app/auth/db), gsap.ts, utils.ts (cn)
  pages/        route components
  providers/    AuthProvider + useAuth()
  features/     (phase 2) one folder per feature: api.ts, hooks.ts, types.ts, components/
```

## Conventions

- Import Firebase services only from `@/lib/firebase`; components use feature hooks, not the SDK.
- Import GSAP from `@/lib/gsap` and animate with `useGSAP()` (auto cleanup).
- Firestore rules in `firestore.rules` are open and **expire 2026-11-25** — replace before then.
