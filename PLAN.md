# Project Plan — diplomado_pbl

Stack: **Vite 8 + React 19 + TypeScript 6 + Firebase 13** (frontend only, Firebase as backend)
UI: **Tailwind CSS v4, shadcn/ui (Base UI, selected components), GSAP**

Status legend: `[ ]` to do · `[x]` done

- **Phase 1 — Template setup:** ✅ done (2026-10-26)
- **Phase 2 — App definition & features:** pending (app idea not defined yet)

---

## Review findings (initial state)

| #   | Finding                                                                                     | Severity  | Status                               |
| --- | ------------------------------------------------------------------------------------------- | --------- | ------------------------------------ |
| 1   | `firebase.json` → `hosting.public` was `"public"`; Vite builds to `dist`.                   | 🔴 High   | ✅ Fixed                             |
| 2   | `public/index.html` (from `firebase init`) would overwrite the app's `index.html` on build. | 🔴 High   | ✅ Deleted                           |
| 3   | `firestore.rules` allow anyone to read/write everything and **expire on 2026-11-25**.       | 🔴 High   | ⏳ Phase 2 (step 7)                  |
| 4   | `src/firebase.ts`: hardcoded config, `app` not exported, no services initialized.           | 🟠 Medium | ✅ Replaced by `src/lib/firebase.ts` |
| 5   | Project was not a git repository.                                                           | 🟠 Medium | ✅ Fixed                             |
| 6   | Vite template boilerplate still present.                                                    | 🟢 Low    | ✅ Removed                           |
| 7   | No path alias (`@/…`), required by shadcn.                                                  | 🟢 Low    | ✅ Added                             |

> The Firebase `apiKey` is **not a secret**; security comes from **Security Rules** and **App Check**. It lives in `.env.local` so we can switch projects/environments cleanly.

---

# Phase 1 — Template setup ✅

## 1. Version control

- [x] `git init` + first commit with the template
- [x] `.gitignore`: `.env`, `.env.*` (except `.env.example`), `.firebase/`, Firebase debug logs

## 2. Firebase Hosting config

- [x] `firebase.json`: `"public": "dist"` (SPA rewrite to `/index.html` kept)
- [x] Delete `public/index.html`
- [x] npm script `deploy` (`npm run build && firebase deploy`)
- [x] Emulators in `firebase.json`: Auth `9099`, Firestore `8080`, UI enabled; npm script `emulators`

## 3. Clean the Vite boilerplate

- [x] Removed `App.css`, `src/assets/*`, `public/icons.svg`, demo `App.tsx`
- [x] New entry: `src/main.tsx` → `src/app/App.tsx` (providers) → `src/app/router.tsx`
- [ ] Set final `<title>` and `lang` in `index.html` (when the app name/language is decided)

## 4. Firebase layer

- [x] `src/lib/firebase.ts`: single `initializeApp`, exports `app`, `auth`, `db`
- [x] `.env.local` (git-ignored) + `.env.example` (committed, no values)
- [x] Env vars typed in `src/vite-env.d.ts` and validated with Zod in `src/lib/env.ts` (fails fast)
- [x] Emulators connect in dev when `VITE_USE_EMULATORS=true`
- [x] `src/providers/AuthProvider.tsx` + `useAuth()` (`{ user, loading }`)

## 5. Tailwind CSS v4 + path alias

- [x] `tailwindcss` + `@tailwindcss/vite` plugin
- [x] `src/index.css` with `@import "tailwindcss"` (theme via CSS variables / `@theme`)
- [x] Alias `@/*` → `./src/*` in `tsconfig.json`, `tsconfig.app.json`, `vite.config.ts`

## 6. shadcn/ui

- [x] `shadcn init` (style `base-nova`, Base UI primitives, `lucide` icons, Geist font)
- [x] `button` added; `src/lib/utils.ts` re-exports `cn` (official `cn` package, replaces clsx + tailwind-merge)
- [x] ESLint `react-refresh/only-export-components` disabled for `src/components/ui/**`
- Rule: add components **on demand** with `npx shadcn@latest add <name>`. With Base UI, use `render={<Link />}` (+ `nativeButton={false}`) instead of `asChild`.

## 8. GSAP

- [x] `gsap` + `@gsap/react`
- [x] `src/lib/gsap.ts` registers `useGSAP` + `ScrollTrigger`; import gsap from there
- [x] Pattern in `HomePage.tsx`: `useGSAP({ scope })` + `gsap.matchMedia()` for `prefers-reduced-motion`

## 9. Dependencies installed

- [x] `react-router`, `zod`, `lucide-react`
- [x] Dev: `prettier` + `prettier-plugin-tailwindcss` (`npm run format`)

---

# Phase 2 — App definition & features ⏳

## Open questions

1. **What does the app do?** (main entities/collections, users and roles) → drives rules and features.
2. **Authentication?** Email/Password, Google, both, or none?
3. **Firebase Storage** (file/image uploads) needed?
4. **Real-time data** or mostly one-time reads? → decides React Query.
5. **UI language**: Spanish, English, or both (i18n)?

## 4b. Data layer (per feature)

- [ ] `src/lib/collections.ts` — central collection names
- [ ] Typed Firestore access with `withConverter<T>()` + Zod validation, one per collection
- [ ] `src/features/<x>/{api.ts, hooks.ts, types.ts, components/}` — components never import the SDK

## 7. Firestore Security Rules — **deadline 2026-11-25**

- [ ] Deny-by-default + per-collection rules (`request.auth != null`, ownership, field validation)
- [ ] Test rules with the emulator (`@firebase/rules-unit-testing`)
- [ ] Later: App Check (reCAPTCHA Enterprise)

## Auth UI

- [ ] Enable providers in Firebase console
- [ ] Sign-in / sign-out flow, protected routes in the router

## Pending dependencies (add when needed)

| Package                                       | When                                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `react-hook-form` + `@hookform/resolvers`     | First form (shadcn `Form`/`Field` builds on it)                  |
| `sonner` (`npx shadcn@latest add sonner`)     | First toast/notification                                         |
| `@tanstack/react-query`                       | If we do mostly one-time reads (skip for real-time `onSnapshot`) |
| `zustand`                                     | Global client state beyond auth                                  |
| `date-fns`                                    | Date formatting (Firestore `Timestamp`)                          |
| `vitest` + `@testing-library/react` + `jsdom` | Unit/component tests                                             |

## Performance

- [ ] Bundle is ~1 MB (330 KB gzip), mostly Firebase → lazy-load routes with `React.lazy` / router `lazy` once pages exist

## Folder structure (target)

```
src/
  app/            App.tsx, router.tsx          ✅
  components/
    ui/           shadcn components            ✅
    layout/       Header, Footer, Shell…
  features/
    auth/         api.ts, hooks.ts, components/, types.ts
    <feature>/    same shape
  lib/            env.ts, firebase.ts, gsap.ts, utils.ts ✅ · collections.ts
  pages/          HomePage, NotFoundPage       ✅
  providers/      AuthProvider + useAuth       ✅
  index.css, main.tsx                          ✅
```
