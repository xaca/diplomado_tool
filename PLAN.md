# Project Plan — diplomado_pbl

Stack: **Vite 8 + React 19 + TypeScript 6 + Firebase 13** (frontend + Firebase as backend)
UI: **Tailwind CSS v4, shadcn/ui (Base UI, selected components), GSAP, Excalidraw (slides)**
Images: **Cloudinary** · Media service: **Cloudflare Worker** · Admin tasks: **local admin CLI**

**Everything is free (academic project):** every service runs on a free tier and every library is open source (MIT / Apache).

Status legend: `[ ]` to do · `[x]` done

- **Phase 1 — Template setup:** ✅ done (2026-10-26), commit `8f20758`
- **Plan review (rev. 6, 2026-10-26):** ✅ consistency + free-tier review done, see [Review findings](#review-findings-rev-6)
- **Phase 2 — "Padlet for PBL" app:** 🚧 in progress — Google sign-in enabled · M4 Steps 1–6 done (`/health` → `config: ok`) · service account key ready · **M1 ✅** · **Loop 1 (M2) ✅** ([report](reports/loop-01-m2.md)) · **Loop 2 (M3) ✅** ([report](reports/loop-02-m3.md)) · **Loop 3 (M4) ✅ code done** ([report](reports/loop-03-m4.md)) · **Loop 4 (M5) ✅ code done** ([report](reports/loop-04-m5.md)) · **Loop 5 (M6) ✅ code done** ([report](reports/loop-05-m6.md)) · **Loop 6 (M7) ✅ code done** ([report](reports/loop-06-m7.md)) · **Loop 7 (M8) ✅ code done** ([report](reports/loop-07-m8.md)) · **Extras ✅ code done** (2026-10-29): profile page `/me`, teacher's notes on slides · **Loop 8 (M10) Class participation: 📝 planned**, decisions [D12–D17](#decisions-all-answered-) waiting for you · **Loop 9 (M11) Profile photo & Design Thinking stage ✅ code done** (2026-10-31, [report](reports/loop-09-m11.md)) · **Loop 10 (M12 Board customization + M13 Notes while presenting) ✅ code done** (2026-10-31, [report](reports/loop-10-m12-m13.md)) · **Loop 12 (M14) Embeds that work ✅ code done** (2026-10-31, [report](reports/loop-12-m14.md)) · **Loop 14 (M16) Teacher's class tools ✅ code done** (2026-10-31, [report](reports/loop-14-m16.md)) · **Loop 13 (M15) Teacher edits students' slides ✅ code done** (2026-10-31, [report](reports/loop-13-m15.md)) — M1–M8 + extras deployed 2026-10-30/31; **waiting for you:** deploy Loops 10, 12, 13 and 14 (`npm run release`), App Check steps, **before 2026-11-25** (Worker live at `https://media-api.paradisserossa.workers.dev`)

## ▶ Resume here (last session: 2026-10-31)

**Where we are:** M1–M8, extras, Loop 9 (M11) and the navigation fix are deployed. **Code done, not deployed:** Loop 10 (M12 + M13), Loop 12 (M14 embeds), Loop 13 (M15 teacher edits) and **Loop 14 (M16) Teacher's class tools** ([report](reports/loop-14-m16.md)). Next: Loop 8 (M10 Class participation, D12–D17).

**Your turn now:** `npm run release` (all tests, then Worker → rules → Hosting), `git push`, then the acceptance tests in the reports (loops 10, 12, 13, 14).

**Planned 2026-10-31 (proposed ⏳, not started): [M17](#m17--canva-and-the-embed-options-f23--loop-15--code-done-2026-10-31)–[M21](#m21--status-profile-decorations-and-board-styles-f28f30--loop-17)**

- **Loop 15 · M17 Canva** ✅ code done ([report](reports/loop-15-m17.md)): "Insertar contenido" shows the services as tiles (Canva first) with their sharing steps; accepts Canva links, `canva.link`, Canva's **embed code** and Canva sites.
- **Loop 16 · M18 Emails + attendance:** copy / write (BCC) / CSV the emails of everyone or a filtered group; **attendance by date** (Presente · Tarde · Ausente · Excusa), history table with %, CSV; each student sees their own.
- **Loop 17 · M21 Status, decorations and board styles:** a status ("🛠 Prototipando", "🙋 Necesito ayuda") with expiry for students and teachers; card banner, sticker and seasonal accessories; one-click board styles (Pizarra, Cuaderno, Neón…) and seasonal ones, **Navidad** first (snow, lights, Santa hats), with dates so it switches on and off by itself.
- **Loop 18 · M19 Novedades:** a modal announcing new features (and teacher announcements) + a 🔔 with summaries that stay until the student clears them.
- **Loop 19 · M20 Feedback + animations:** encouraging messages and small celebrations at milestones, micro-animations on interactions, no rankings, off with "reduce motion".
- **Next:** confirm or change **[D56–D77](#decisions-all-answered-)** (D63–D68 for Loop 16), then say "run loop 16".

**Session 2026-10-30 / 31: new computer + new milestone**

- New laptop set up: Java 21 (`brew install openjdk@21`, on `PATH` in `~/.zshrc`), `.env.local`, `services/media-api/.dev.vars`, `.env.admin.local`, `secrets/service-account.json`, `wrangler login`. Firebase CLI: `firebase login:add` + `firebase login:use paradisserossa@gmail.com` (the project owner). Gotchas: Cloudinary shows the API secret as `**********` until you click the eye (copying the mask gives a 401); never put the Cloudinary key / secret in `.env.local` (every `VITE_*` value ends up in the browser).
- Checks on the new machine: unit 71/71 · rules 68/68 · Worker 34/34 · admin CLI ✅ · Worker integration ✅ · e2e 48/48 (one m5 test timed out in the full run, passed alone) · local and production `/health` → `config: ok` · `admin -- usage` reads production.
- Profile `/me` tried in the app ✅. Planned **[M11](#m11--profile-photo--design-thinking-stage-f13-f14--loop-9)**: upload your own profile photo, and a **stage ring** around the photo (like LinkedIn's #OPENTOWORK) showing where each student is in the Design Thinking process, or **"Vitrineando"** (only here to learn, no project).

**Built 2026-10-29 (on `main`, all tests green)**

| Commit    | What                                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `d511b31` | **Profile page `/me`** (F10, "Mi perfil" in the user menu): display name (empty = Google name), "show my Google photo", language. Saving renames the student's cards on active boards; the teacher's roster keeps its own spelling (last write wins).      |
| `df9a562` | **Teacher's notes on slides** (F11): the teacher adds / edits / deletes notes under each slide (space page); the student reads them there and beside the slide in the editor; classmates never see them; deleted with the slide, the student and on purge. |
| `f97a676` | Plan: first draft of a class wall (discarded, replaced by the next commit)                                                                                                                                                                                 |
| `083e981` | Plan: **M10 Class participation** (see below)                                                                                                                                                                                                              |

Checks at the end of the session: rules tests 68/68 · unit 71/71 · admin CLI ✅ · lint / format / build ✅ · e2e 46/48 in the full run (the 2 failures, `deploy.spec` and the M8 lazy-chunk test, were timeouts in a slow run and passed when re-run alone).

**Your turn (before anything from today works in production)**

1. `npm run deploy:rules` (profile and notes changed `firestore.rules`)
2. `npm run deploy` (Hosting)
3. Still pending from earlier loops: `npm run worker:deploy` + one real upload, App Check / reCAPTCHA steps from the [M8 report](reports/loop-07-m8.md#4-your-turn-launch-step-by-step) — **open rules expire 2026-11-25**
4. Try it: change your name in "Mi perfil" and check your card; as the teacher, add a note under a student's slide and open it as that student.

**Next: Loop 8 = [M10 Class participation](#m10--class-participation-participación-en-clase-f12--loop-8)** (planned, not started)

- Per board, a **"Clases"** section. The teacher creates a class with **1–5 participation slides** (prompt: question, instructions, optional picture) and opens / closes it.
- Students add **contribution cards** (text + picture) on each slide, up to 3 per slide, and **edit / delete only their own**; the teacher edits / deletes any and can present the class live.
- Stored in its own `classes` collection: **all existing features stay as they are** (see "What does NOT change" in M10).
- **To start:** confirm or change decisions **[D12–D17](#decisions-all-answered-)** (format, limits, visibility, teacher powers, backup, location), then say **"run loop 8"**.

**Loop 13 = [M15 Teacher edits students' slides](#m15--teacher-edits-students-slides-f18--loop-13)** ✅ code done 2026-10-31

- Today only the student edits their slides (editor, rules and the image Worker all check it). The teacher gets **"Editar"** on any student's slide: same editor, can fix text, move things, add images and drawings.
- **The student stays in control:** before the teacher's first change, the student's version is saved; the slide shows **"Editada por el docente"**, and the student can **compare and restore their version**. The teacher is invited to leave a note explaining the change.
- **No overwriting:** while one person edits a slide, the other sees it read-only ("Laura está editando esta diapositiva").
- Decisions D42–D47 confirmed ("run loop 13").

**Loop 14 = [M16 Teacher's class tools](#m16--teachers-class-tools-f19f22--loop-14)** ✅ code done 2026-10-31

- **Class timer / focus mode:** the teacher starts a countdown for an activity ("Lluvia de ideas · 10 min"); every student sees it live (board, space page and slide editor) and the teacher projects a big **focus view**. Pause, +1 min, stop; "¡Tiempo!" at the end.
- **Polls (votación):** in each student's space, the student (on their own) or the teacher (on any) creates a poll, e.g. "¿Cuál de mis 3 ideas desarrollo?"; classmates vote once, results live; the teacher can show them while presenting.
- **"Listos para presentar":** the student marks their slides as ready; the dashboard filters **Listos · Con diapositivas · Sin diapositivas**, and "Presentar listos" presents only those.
- **Break time:** a break countdown with a full-screen **Lottie animation that changes randomly** (a curated, self-hosted set of free animations).
- Decisions D48–D54 confirmed ("go").

**Loop 12 = [M14 Embeds that work](#m14--embeds-that-work-f17--loop-12)** ✅ code done 2026-10-31

- Production check (2026-10-31, read-only): of 50 slides, **1 embed** (a Figma Slides deck that stays on Figma's loading screen, most likely not shared publicly) and **3 links pasted as plain text** (Google Slides, Google Forms, a `canva.link` short link). Students don't know how to embed.
- An **"Insertar contenido"** button: paste a link → the app recognizes Google Slides / Docs / Sheets / Forms / Drive, YouTube, Vimeo, Loom, Figma, Canva, Miro, Notion, Genially, Prezi, Padlet; converts it to the embeddable form, previews it and tells the student exactly how to share it.
- Existing slides improve on their own (links fixed when shown), links typed as text get a **"Convertir"** button and become clickable, and every embed shows a **loading animation** with a "¿No carga?" fix and an "Abrir" button.
- Decisions D36–D41 confirmed ("go").

**Loop 10 = [M12 Board customization](#m12--board-customization-f15-f16--loop-10)** ✅ code done 2026-10-31

- A **"Personalizar tablero"** panel for the teacher, with live preview: **name and description** (today there's no screen to rename a board), **logo**, **background** (colors, gradients, patterns), **layout** (Muro · Cuadrícula · Lista · Por etapa · Por grupo), **sticky header**.
- **Teacher distinction:** a "#DOCENTE" ring with a cap badge on the teacher's photo, and the board's teacher(s) shown in the board header.
- **GSAP animations:** cards rearrange smoothly when the layout / filter changes (Flip), new cards pop in, the stage ring draws itself, the header shrinks on scroll; all off with "reduce motion".
- Decisions D25–D32 confirmed ("run loop 10").

**[M13 Teacher's notes while presenting](#m13--teachers-notes-while-presenting-f11-in-the-presenter)** ✅ code done 2026-10-31 (inside Loop 10, D35)

- In the presenter, the teacher opens a **notes panel** (key **N**) and adds / edits / deletes notes on the slide on screen, without leaving the presentation; the student sees them as today.
- Because the presenter is usually **projected**, notes are hidden by default and a **"Vista del docente"** second window (laptop screen) can show the notes + next slide, synced with the projected window.
- Decisions D33–D35 confirmed.

**Loop 9 = [M11 Profile photo & Design Thinking stage](#m11--profile-photo--design-thinking-stage-f13-f14--loop-9)** ✅ code done 2026-10-31 (ran before Loop 8, D24)

- **Photo:** on `/me`, choose Google photo, **an uploaded photo** (square crop, stored once per person in Cloudinary) or initials.
- **Stage ring:** each student marks their stage **per board**: Empatizar · Definir · Idear · Prototipar · Evaluar, or **Vitrineando** (here to learn, no project). A colored ring with the stage name curved around the photo, like #OPENTOWORK, on cards, the space page, the presenter and class contributions. The teacher sees how many students are in each stage and can filter the dashboard.
- Decisions D18–D24 confirmed. Deploy it, then Loop 8.

---

# Phase 2 — Product

A Padlet-style board where **each student owns one space** and documents their project process as **slides**. The teacher can **present each student's space** in full screen.

| #   | Feature                                                                                                                                                                    | Who                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| F1  | Sign in with Google, using **any** of the student's emails (personal Gmail or university)                                                                                  | everyone                                             |
| F2  | Board dashboard: columns of cards, one card per student (like the reference image), live updates                                                                           | everyone in the board                                |
| F3  | Space editor: **one Excalidraw canvas per slide** (text, images, links, embeds, shapes, drawing); add / reorder slides                                                     | the student who owns the space                       |
| F4  | Space profile: title, summary, cover image, color                                                                                                                          | the student                                          |
| F5  | Presentation mode: full screen, keyboard navigation, **next / previous student**                                                                                           | teacher (students: their own space)                  |
| F6  | Boards: create a board, add students, invite link                                                                                                                          | teacher                                              |
| F7  | Import / export with **JSON** (students, board backup)                                                                                                                     | teacher                                              |
| F8  | **Storage & cleanup**: image usage, remove unused images, **"Archived projects"** for inactive boards, purge                                                               | teacher (dashboard) + you (admin CLI)                |
| F9  | **Spanish (default) / English** interface                                                                                                                                  | everyone                                             |
| F10 | **Profile** (`/me`): display name, photo on cards, language ✅                                                                                                             | everyone                                             |
| F11 | **Teacher's notes** on each slide, private to the teacher and the student ✅ (M13: also while presenting)                                                                  | teacher writes · the student reads                   |
| F12 | **Class participation**: per class, the teacher opens **1–5 participation slides**; students add, edit and delete their own contributions (text + picture)                 | teacher creates and moderates · students participate |
| F13 | **Profile photo**: Google photo, **an uploaded photo** or initials                                                                                                         | everyone                                             |
| F14 | **Design Thinking stage**: a ring around the student's photo with their current stage, or "Vitrineando"; stage summary + filter on the dashboard                           | the student sets it · the teacher sees and can set   |
| F15 | **Board customization**: name, description, logo, background, layout, sticky header, with live preview; GSAP animations                                                    | teacher sets it · everyone sees it                   |
| F16 | **Teacher distinction**: "#DOCENTE" ring + badge on the teacher's photo; the board's teachers shown in its header                                                          | everyone                                             |
| F17 | **Embeds that work**: guided "Insertar contenido" (Google, YouTube, Figma, Canva, Notion, Miro…), automatic link fixes, loading state and fallback, how-to guide           | the student inserts · everyone views                 |
| F18 | **Teacher edits students' slides**: edit text, layout, images; the student's version is kept and can be restored; "Editada por el docente"; one editor at a time           | teacher edits · the student reviews / restores       |
| F19 | **Class timer / focus mode**: a shared countdown for timed activities, live for everyone, big focus view for the projector                                                 | teacher runs it · everyone sees it                   |
| F20 | **Polls** in each student's space: question + options, one vote per student, live results, shown while presenting                                                          | student (own space) or teacher creates · class votes |
| F21 | **Ready to present**: the student marks their slides ready; filters and "Presentar listos"                                                                                 | student marks · teacher filters / presents           |
| F22 | **Break time**: break countdown with random Lottie animations                                                                                                              | teacher runs it · everyone sees it                   |
| F23 | **Canva and the embed options**: service tiles in "Insertar contenido", Canva embed code, Canva sites, edit-link hint                                                      | the student inserts · everyone views                 |
| F24 | **Students' emails**: copy, write (BCC) or download the emails of everyone or a filtered group                                                                             | teacher                                              |
| F25 | **Attendance by date**: Presente / Tarde / Ausente / Excusa per class date, history table with %, CSV; students see their own                                              | teacher takes it · the student sees their own        |
| F26 | **"Novedades"**: a modal announcing new features (and teacher announcements) + a notifications bell with summaries until cleared                                           | you / teacher write · students and teachers read     |
| F27 | **Feedback messages and interaction animations**: encouraging messages at milestones, celebrations, micro-animations; no rankings                                          | everyone                                             |
| F28 | **Status**: emoji + short text with expiry, on cards, space page and the board header; "Necesito ayuda" counter for the teacher                                            | everyone sets their own · teacher can clear          |
| F29 | **Profile decorations**: card banner, sticker, seasonal accessories (never over the stage / #DOCENTE rings)                                                                | everyone, for their own profile                      |
| F30 | **Board styles**: one-click styles (Pizarra, Cuaderno, Neón…) and seasonal ones (**Navidad**, Halloween, Año nuevo, Amor y amistad) with ambient animations and scheduling | teacher sets it · everyone sees it                   |

Students can see their classmates' spaces **read-only**. **Class participation** (F12) is the one place where everybody writes together, on **separate slides** that never touch the students' own spaces.

---

## Architecture overview

```
                        ┌──────────────── Browser (React app on Firebase Hosting) ───────────────┐
                        │  dashboard · Excalidraw editor / viewer · presenter · teacher dashboard │
                        └───────┬───────────────────────┬───────────────────────────┬────────────┘
                                │ Firestore SDK          │ fetch + Firebase ID token │ image URLs (CDN)
                                ▼                        ▼                           ▼
                     ┌─────────────────────┐   ┌──────────────────────┐   ┌───────────────────┐
                     │ Firebase (Spark)    │   │ media-api            │   │ Cloudinary Free   │
                     │ Auth · Firestore    │◄──│ Cloudflare Worker    │──►│ storage + CDN +   │
                     │ Hosting · App Check │   │ (holds the Cloudinary│   │ resize by URL     │
                     │ Rules = the backend │   │ secret)              │   └───────────────────┘
                     └─────────▲───────────┘   └──────────────────────┘             ▲
                               │ Admin SDK                                          │ Admin API
                     ┌─────────┴──────────────────────────────────────────────────────┴──┐
                     │ Admin CLI — runs only on your computer: `npm run admin -- <cmd>`   │
                     └─────────────────────────────────────────────────────────────────────┘
```

| Piece                             | Why it exists                                                                                                            | Free tier                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Firebase (Spark)                  | Login, database, hosting, App Check (reCAPTCHA v3). Security Rules enforce permissions.                                  | Auth free · Firestore 50K reads / 20K writes per day, 1 GiB · Hosting 10 GB, 360 MB/day       |
| Cloudinary Free                   | Images: storage, CDN, resizing by URL                                                                                    | 25 credits/month (1 credit = 1 GB storage **or** 1 GB bandwidth **or** 1,000 transformations) |
| **media-api** (Cloudflare Worker) | Everything that needs the **Cloudinary secret**: signed uploads, deleting images from the teacher dashboard, usage meter | 100K requests/day, no credit card                                                             |
| **Admin CLI** (local)             | Full-privilege tasks that never go to the browser: create the first admin, bulk cleanup, purge, backups                  | runs on your computer                                                                         |
| Excalidraw                        | Slide canvas                                                                                                             | MIT license, no key, no watermark                                                             |

Cloud Functions and Cloud Storage for Firebase need the paid Blaze plan, so they are **not used**. The Worker replaces Functions for the few server tasks we need.

### Budget estimate (40 students, 1 board, per month)

| Item                                                               | Usage                                                               | Free limit         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------ |
| Firestore reads (dashboard ~40, space ~11, full presentation ~450) | a few thousand per day at peak                                      | 50K / day          |
| Firestore writes (autosave: idle 3 s, max 1 save / 15 s per slide) | ≤ 120 per student per 30-min session → ~5K for 40 students in class | 20K / day          |
| Cloudinary storage (40 × 20 images × ~300 KB)                      | ~0.25 GB                                                            | 25 credits / month |
| Cloudinary bandwidth (thumbnails + presentations)                  | 2–4 GB                                                              | (shared credits)   |
| Worker requests (sign / delete / usage)                            | a few hundred per day                                               | 100K / day         |

→ About **3–5 Cloudinary credits** per class per month. Cleanup and purging old boards keep storage from growing semester after semester.

---

## Identity model: people, emails and accounts

A student may sign in with a **personal Gmail** one day and a **university email** the next. Each Google login is a different Firebase account (`uid`), and Firebase can't merge two Google accounts. So the app separates:

| Concept     | What it is                                                         | Example                                                       |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| **Person**  | The real student or teacher. Owns the work.                        | `students/st_8f2k` "Laura Nataly"                             |
| **Email**   | A way to recognize the person at login. A person can have several. | `laura@gmail.com`, `lnataly@uni.edu.co`                       |
| **Account** | A Firebase login (`uid`), linked to a person.                      | `uid_A` (Gmail) → `st_8f2k`, `uid_B` (university) → `st_8f2k` |

The space belongs to the **person**, so either email leads to the **same space**. Teachers are simpler: **a teacher is recognized by email** (see [Roles](#roles-who-is-a-teacher)).

```
 login (uid, email) ──► studentEmails/{email} ──► students/{studentId} ──► spaces/{studentId}
                              (lookup index)          (the person)            (their work)
 members/{uid} = { studentId }   ← remembers which person this account belongs to
```

Security Rules can't search inside arrays, only read documents by path. The `*Emails` index documents turn "which person is this email?" into a single `get()`. The person and its index documents are always written together in one batch.

---

## Data model (Firestore)

```
users/{uid}                                     login account profile + preferences

staffEmails/{email}                             teacher list: one doc per teacher email → role

boards/{boardId}                                a class board
boards/{boardId}/students/{studentId}           a student (person), 1..n emails
boards/{boardId}/studentEmails/{email}          email → studentId (lookup index)
boards/{boardId}/members/{uid}                  a login account linked to a student
boards/{boardId}/spaces/{studentId}             one space per student
boards/{boardId}/spaces/{studentId}/slides/{slideId}   one Excalidraw scene per slide
boards/{boardId}/spaces/{studentId}/notes/{noteId}     teacher's note on one slide (teacher + owner only)
boards/{boardId}/assets/{assetId}               registry of every image uploaded in this board
boards/{boardId}/classes/{classId}              class participation: one class session, 1–5 slides     (M10)
boards/{boardId}/classes/{classId}/slides/{slideId}          the teacher's prompt for one slide (M10)
boards/{boardId}/classes/{classId}/contributions/{id}        one student's (or teacher's) contribution (M10)

joinCodes/{code}                                invite code → boardId
```

### Documents

```ts
users/{uid}
{ displayName, email, photoURL, locale: 'es' | 'en', createdAt, lastLoginAt,   // Google fields: refreshed on every login
  profileName?, showPhoto?,                                                       // set on /me; follow the student to their cards
  photoSource?: 'google' | 'upload' | 'initials',  // M11, replaces showPhoto (showPhoto false → 'initials')
  avatar?: { publicId, version } | null }          // M11: the uploaded photo, one per person (not per board)

staffEmails/{email}                       // lowercased
{ email, displayName, role: 'admin' | 'teacher', addedAt }   // exists → this email is a teacher

boards/{boardId}
{ title, description,
  teacherEmails: string[],                // who teaches it (your emails; co-teachers later)
  joinCode, joinCodeEnabled,
  status: 'active' | 'locked' | 'archived',
  lastActivityAt,                         // any edit in the board (throttled) → auto-archive
  archiveAfterDays: 90,                   // configurable per board
  stages?: StageDef[] | null,             // M11: missing = Design Thinking defaults (D21)
  background,                             // M12: preset id ('yellow' = today's look), see BOARD_BACKGROUNDS
  pattern?: 'dots' | 'grid' | 'none',     // M12, default 'dots'
  layout?: 'masonry' | 'grid' | 'list' | 'stages' | 'groups',   // M12, default 'masonry'
  sortBy?: 'joined' | 'name' | 'updated', // M12, default 'joined'
  stickyHeader?: boolean,                 // M12, default true
  logo?: ImageRef | null,                 // M12: uploaded by the teacher (kind 'logo')
  teacherProfiles?: { [email]: { name, photoURL } },   // M12: shown in the header with the #DOCENTE ring
  createdAt, updatedAt, archivedAt? }

StageDef = { id, label?, color, kind: 'stage' | 'browsing' }   // default ids: empathize · define · ideate · prototype · test · browsing
                                                               // default labels come from i18n; custom stages carry `label`

boards/{boardId}/students/{studentId}
{ displayName, emails: string[], group?,
  status: 'invited' | 'joined', linkedUids: string[],
  source: 'import' | 'manual' | 'invite', createdAt, joinedAt? }

boards/{boardId}/studentEmails/{email}    // lowercased
{ email, studentId }

boards/{boardId}/members/{uid}
{ uid, studentId, email, joinedAt }

boards/{boardId}/spaces/{studentId}       // ← what the dashboard card shows
{ studentId, ownerName, ownerPhotoURL,    // denormalized: 1 read per card
  title, summary, color,
  cover?: ImageRef,
  slideOrder: string[], slideCount,
  stage?: string | null,                  // M11: a StageDef id of this board; null = no ring
  group?: string,                         // M12: copied from the student (teacher), for the "Por grupo" layout
  stageUpdatedAt?, stageSetBy?: 'student' | 'teacher',
  updatedAt, createdAt }

boards/{boardId}/spaces/{studentId}/slides/{slideId}
{ engine: 'excalidraw',
  content: string,                        // JSON: Excalidraw elements + background (no image data)
  files: Record<excalidrawFileId, ImageRef>,  // images of this slide → Cloudinary
  assetIds: string[],                     // same images as ids → orphan detection
  bytes: number,                          // size guard (Firestore doc limit is 1 MiB)
  schemaVersion: 1, updatedAt }

boards/{boardId}/spaces/{studentId}/notes/{noteId}   // the teacher's annotation on one slide
{ slideId, text,                          // ≤ 2000 chars
  authorEmail, authorName, createdAt, updatedAt }

boards/{boardId}/classes/{classId}        // class participation (M10) — everyone in the board reads it
{ title,                                  // "Clase 3 · Prototipos" (≤ 120)
  date?,                                  // 'YYYY-MM-DD'
  status: 'open' | 'closed',              // closed → read-only for students
  slideOrder: string[], slideCount,       // 1–5 participation slides
  createdBy, createdAt, updatedAt }

boards/{boardId}/classes/{classId}/slides/{slideId}   // written only by the board's teachers
{ title,                                  // the question or activity (≤ 120)
  prompt,                                 // instructions (≤ 1000, plain text)
  image: ImageRef | null,                 // optional picture for the prompt
  color,                                  // same palette as the cards
  createdAt, updatedAt }

boards/{boardId}/classes/{classId}/contributions/{slideId}_{uid}_{n}   // n = 1..3 per person per slide
{ slideId, authorUid, authorRole: 'teacher' | 'student',
  authorStudentId: string | null,         // null for teachers
  authorName, authorPhotoURL,             // denormalized from the profile (cardName / cardPhoto)
  text,                                   // ≤ 1000 chars, plain text, auto-linked URLs
  image: ImageRef | null, assetIds: string[],
  color,
  createdAt, updatedAt,
  editedByTeacher?: boolean }             // shown as "editado por el docente"

boards/{boardId}/assets/{assetId}         // one per upload
{ publicId, studentId, slideId?, kind: 'slide' | 'cover' | 'class',
  ownerUid?,                              // class images: who uploaded it (teachers have no studentId)
  width, height, format, bytes,
  status: 'active' | 'orphaned' | 'deleted',
  createdAt, deletedAt? }

type ImageRef = { assetId, publicId, version, width, height, format }

joinCodes/{code}
{ boardId, createdAt }
```

**Scalability choices**

- **Asset registry per board:** one query answers "how much storage does this board use?" and "which images are unused?". Purging a board is one Cloudinary folder plus one subcollection.
- **Slides store `assetIds`**, so finding unused images doesn't require parsing scene JSON.
- **`content` is a JSON string**, excluded from indexes (`fieldOverrides`). This avoids index costs and map-depth limits. The editor warns at 800 KB per slide.
- **Images are never inside the scene:** only references, so slides stay small.
- **Slide saves don't touch the space document.** The dashboard listens live to `spaces`, so every space update costs 1 read **per open dashboard**. The space doc changes only when title, summary, cover or slide order change, and `updatedAt` at most every 10 minutes. Without this, 40 students saving while 40 dashboards are open would burn the 50K reads/day.
- **`engine` + `schemaVersion`:** old slides always say how they were made, which allows future migrations.
- **Notes live under the space, not in the slide:** a slide save never rewrites the teacher's feedback, and one listener per page covers every slide.
- **One document per contribution, with a predictable id** (`{slideId}_{uid}_{n}`, n = 1..3): the rules protect each student's content (only the author or the teacher can change it), and they cap participation at 3 per person per slide without a counter.
- **Participation slides are not Excalidraw scenes:** a shared canvas is one document, so 40 students would overwrite each other and the rules couldn't protect anyone's work. Each slide is the teacher's prompt plus a grid of contribution cards.
- **The page listens to the slide on screen** (`contributions where slideId == current`), not to the whole class: a contribution on slide 2 costs nothing to people looking at slide 1.

---

## Slides with Excalidraw (D2, D3)

`@excalidraw/excalidraw` 0.18 (MIT, React 19 compatible).

### How it works

- **One Excalidraw canvas per slide.** Each slide is a small, independent scene, so saves are small and fast.
- **Fixed 16:9 slide (960 × 540 scene units, Loop 4):** each slide has one locked Excalidraw **frame** of 960 × 540 (at 1920 × 1080 Excalidraw's largest font looked tiny when presented; the SVG scales to any screen), and the editor keeps the view centered on it. The viewer and presenter export **only that frame**, so a slide looks the same everywhere.
- **"Basic edition" UI:** `UIOptions` and props hide what we don't need (library, collaboration, export, save/load, theme switch). The toolbar keeps select, hand, rectangle, ellipse, arrow, line, draw, **text**, **image**, eraser, **embed** and **link**.
- **Text (D3):** Excalidraw's text tool gives font family (hand-drawn, normal, code), size (S/M/L/XL), color and alignment.
  - It has **no bold or italic inside a text box**. For an academic slide that's usually enough. Accepted as "simple text".
- **Links:**
  - Any element can carry a **hyperlink** (click opens it).
  - **Embeds** show allow-listed sites (YouTube, Vimeo, Figma and others) live on the slide. We extend the list with `validateEmbeddable` (e.g. Google Slides published links) and check each one in M5.
  - No link-preview server is needed.
- **Images:**
  - Excalidraw keeps images in a separate `files` map (data URLs).
  - **Save:** we detect new files, upload them to Cloudinary (signed, through the media-api) and store only `fileId → ImageRef` in Firestore.
  - **Load:** we fetch each image from Cloudinary at the size needed and give it back to Excalidraw with `addFiles()`. This is the same pattern excalidraw.com uses with its own storage.
- **Autosave:** saves after **3 s idle**, at most **once every 15 s** per slide, and always on slide switch, tab hide and page close. Only when the scene version changed. Shows "Guardando… / Guardado". This keeps a full class drawing at the same time well under the 20K writes/day limit.
- **Viewer & presenter:** `exportToSvg()` of the slide frame, which is crisp at any size and has no editor UI to load. Thumbnails for the slide sidebar and presenter overview use the same export, cached in memory, at zero quota cost.
- **Language:** `langCode="es-ES"` or `"en"`, following the app language.
- **Fonts:** the Excalidraw fonts are **self-hosted** from `/public` (`EXCALIDRAW_ASSET_PATH`) instead of a third-party CDN, so slides don't depend on an external service.
- **Bundle:** Excalidraw is large, so it is **lazy-loaded** only on the editor, viewer and presenter routes. The dashboard stays light.
- **Adapter:** all canvas code lives in `features/slides/engine/`. The rest of the app only knows "load slide / save slide / render slide".

---

## Images (Cloudinary + media-api)

### Upload flow (signed)

1. Excalidraw (or the cover picker) gives us an image. The browser resizes it to max 2560 px and compresses it.
2. The app calls `media-api POST /uploads/sign` with the Firebase ID token and `{ boardId, studentId }`.
3. The Worker picks `env` from the request origin (`localhost` → `dev`, Firebase domains → `prod`), verifies the token and checks with Firestore that the user is that student or a board teacher. It uses the **user's own token**, so the Security Rules decide. It then returns a **signature** for exactly `public_id = pbl/{env}/{boardId}/{studentId}/{assetId}`.
4. The browser uploads directly to Cloudinary with that signature. The file never passes through the Worker.
5. The app writes the `assets` registry entry and the slide's `files` map.

**Nobody can upload to your Cloudinary account** without being a signed-in member of a board. No public upload preset exists.

**Class participation images (M10):** the app calls `POST /uploads/sign` with `{ boardId, scope: 'class' }`. The Worker allows **any member or board teacher** of a writable board and signs `public_id = pbl/{env}/{boardId}/class/{assetId}`. The registry entry has `kind: 'class'` and `ownerUid`. Same browser resize (max 2560 px, WebP) and same 10 MB limit as slides.

**Profile photos (M11):** `POST /uploads/sign` with `{ scope: 'avatar' }` (no board). The Worker allows a signed-in user who is **staff or a member of at least one board** (checked with the caller's token), so a random Google account can't upload. It signs **one fixed** `public_id = pbl/{env}/users/{uid}/avatar` with `overwrite: true`: a new photo replaces the old one, so there are no orphans and no registry entry; the `version` in the URL busts the CDN cache. The browser crops a square and resizes to 512 px WebP (≤ 2 MB). `POST /avatar/delete` removes it ("Quitar foto").

**Board logo (M12):** `POST /uploads/sign` with `{ boardId, scope: 'board' }`, **board teacher only**, writable board → `pbl/{env}/{boardId}/board/{assetId}`. Registry entry `kind: 'logo'`, `studentId: '_board'`; replacing or removing the logo marks the old one `orphaned` (same cleanup as covers). Browser resize to max 512 px; purge already deletes the whole board folder.

### Folder structure in Cloudinary

```
pbl/
  dev/ …                                  ← local development uploads (separate, easy to wipe)
  prod/
    {boardId}/
      {studentId}/{assetId}               ← public_id ↔ registry id (1:1)
      class/{assetId}                     ← class participation images (M10)
      board/{assetId}                     ← board logo (M12)
    users/{uid}/avatar                    ← uploaded profile photo, one per person (M11)
```

Tags: `board_{boardId}`, `student_{studentId}`, `env_prod`.

### Delivery (resize by URL)

| Where                    | Transformation                               | Typical size |
| ------------------------ | -------------------------------------------- | ------------ |
| Dashboard card cover     | `f_auto,q_auto,c_fill,w_400,h_225`           | ~15 KB       |
| Contribution card        | `f_auto,q_auto,c_limit,w_800`                | ~50 KB       |
| Avatar (cards / large)   | `f_auto,q_auto,c_fill,g_face,w_96` / `w_256` | ~4 / ~15 KB  |
| Editor / viewer          | `f_auto,q_auto,c_limit,w_1280`               | ~100 KB      |
| Full-screen presentation | `f_auto,q_auto,c_limit,w_1920`               | ~200 KB      |

`lib/cloudinary.ts` builds the URLs. No Cloudinary SDK is needed in the browser.

---

## Data lifecycle: archived projects & cleanup (F8, Q3)

### 1. Archived projects (automatic, based on last use)

Your idea: **when a board hasn't been used for a while, it moves to "Archived projects".**

- Every board stores `lastActivityAt`. Any edit in the board (slides, students, settings) updates it, at most once per hour to save writes.
- **A board inactive for more than `archiveAfterDays` (default 90 days) appears automatically under "Proyectos archivados"** in the teacher dashboard and in the students' home.
- This needs no server and no scheduled job: the app compares the date when it lists boards. Archived boards are **read-only**, but they can still be viewed and presented.
- **"Restore"** (teacher) moves the board back to active.
- **"Archive now"** (teacher) archives it immediately, for example at the end of the semester.

```
active ──(no use for 90 days, or "Archive now")──► archived (read-only, in "Proyectos archivados")
   ▲                                                   │
   └──────────────────── "Restore" ────────────────────┤
                                                       └──("Purge", backup first)──► deleted
```

### 2. Purge (manual, never automatic)

Purging deletes the Cloudinary folder `pbl/prod/{boardId}/` and all Firestore documents of the board.

- **Who deletes what:** the **Worker** deletes the Cloudinary folder (it has the secret). The **teacher's browser** deletes the Firestore documents in batches, because the rules allow a board teacher to delete an **archived** board. The Worker only has the user's token, so it can't bypass the rules. The CLI can do both with admin credentials.

- Only possible on an **archived** board, and **only after downloading the JSON backup**.
- To confirm, you type the board name.
- Available from the dashboard (via the media-api) and from the CLI (`npm run admin -- board purge <id>`).
- Boards that have been archived for a long time (e.g. more than 1 year) show a **"consider purging"** hint. Nothing is ever deleted automatically.

### 3. Unused images (orphans)

An image becomes unused when it's deleted from a slide, replaced as a cover, its slide is deleted, or (M10) its class contribution or prompt is edited or deleted.

- **Detection:** `assets` (status `active`) minus the union of all `slides.assetIds`, `spaces.cover` and (M10) the images of class prompts and contributions. Images younger than 24 h are skipped, because they may be in the middle of an edit.
- **Teacher dashboard → Board → Storage:** used storage, number of images, unused images with their size, and a **"Clean up unused images"** button (media-api `POST /assets/delete`).
- **CLI:** `npm run admin -- cleanup --board <id> | --all [--dry-run]`.

### 4. Usage meter

`media-api GET /usage` → Cloudinary credits used this month, shown in the teacher dashboard with a warning at 70 %. `npm run admin -- usage` also shows Firestore document counts per board.

---

## Admin CLI (D10: setup from this project's console)

A small TypeScript tool in `scripts/admin/`, run with `npm run admin -- <command>`. It uses the **Firebase Admin SDK** and the **Cloudinary Admin API**, so it bypasses Security Rules. That's why it only runs on your computer and is never deployed.

| Command                                                          | What it does                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `setup --email <your personal gmail> --name "…"`                 | Creates `staffEmails/{your gmail}` with role **admin**. Run once. |
| `staff add / remove / list`                                      | Add / remove teacher emails (before the admin screen in M9)       |
| `cleanup --board <id> \| --all [--dry-run]`                      | Delete unused images                                              |
| `board archive <id>` · `board restore <id>` · `board purge <id>` | Lifecycle, same rules as the dashboard                            |
| `backup <boardId>`                                               | Writes the JSON backup to `backups/` (git-ignored)                |
| `usage`                                                          | Cloudinary credits + Firestore document counts                    |

**Credentials (git-ignored, never committed):**

- `secrets/service-account.json` (Firebase console → Project settings → Service accounts → Generate new private key)
- `.env.admin.local` with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

---

## Joining a board

**"How does a student end up inside your board?"** There are two ways, and the app uses both:

| Way                            | What you do                                             | What the student does                                                  |
| ------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A. You add them** (main way) | Import the JSON or paste the list (name + 1–2 emails)   | Just **signs in with Google**. They're inside the board automatically. |
| **B. Invite link** (fallback)  | Share a link like `…/join/K7M2QX` (you can turn it off) | Opens the link and signs in. Used when someone wasn't on your list.    |

If a student joined with the link and you later also import them, the teacher dashboard offers **"merge these two students"**.

### Under the hood

- **A:** after login, the app looks for the user's email in `studentEmails` (collection-group query). The rule allows creating `members/{uid}` only if `studentEmails/{token.email}` points to that `studentId` and `email_verified == true`.
- **Index:** the collection-group query needs a single-field index exemption for `studentEmails.email` (collection group scope) in `firestore.indexes.json`, and a rule `match /{path=**}/studentEmails/{email}` that allows reading only your own email.
- **B:** the rules allow `get` on `joinCodes/{code}` but not `list`, so codes can't be guessed by listing. The student creates their `students` + `studentEmails` + `members` documents in one batch, validated with `getAfter()`.

---

## Roles: who is a teacher?

**The app recognizes your role by your email.** Nobody picks a role, and there's nothing to configure at login:

```
Sign in with Google ──► is staffEmails/{my email} there?
                           ├─ yes → TEACHER → /teacher (boards, students, presentation)
                           └─ no  → STUDENT → /  (boards where my email is on the student list)
```

- **You (teacher):** your personal Gmail is in `staffEmails` with role `admin`. Sign in with it and the app opens the teacher dashboard.
- **Students:** sign in with their **Gmail** (any Google account works, including university accounts on Google Workspace). The app matches their email to the student list of each board (see [Joining a board](#joining-a-board)).
- **Role lookup for students:** the app reads `staffEmails/{my email}` right after login. For a student that document doesn't exist, so the rule must allow `get` by path (`email == request.auth.token.email.lower()`), not by `resource.data`; otherwise the student gets a permission error instead of "not a teacher".
- **Your two emails:** a board lists its teachers by email. **Use your personal Gmail for teaching in v1.** If you add your university email later (`staff add`), the app adds it to `teacherEmails` of your boards at the same time.
- **Security:** the same check runs in the Security Rules (`exists(/staffEmails/{token.email})` with `email_verified`). A student can't become a teacher by changing anything in the browser.

**How the teacher list is managed**

| Stage                        | How                                                                   |
| ---------------------------- | --------------------------------------------------------------------- |
| **v1 (only you)**            | `npm run admin -- setup --email <your gmail>` → 1 document, done once |
| Your second email (optional) | `npm run admin -- staff add <other email>`                            |
| Another teacher              | `npm run admin -- staff add teacher@uni.edu.co` (1 command)           |
| **M9 (many teachers)**       | `/admin/staff` screen. Same documents, **no migration**               |
| Co-teaching                  | Add the email to `boards.teacherEmails`                               |

**Why one document per email instead of writing your email inside the rules:** adding a teacher is one command, with no rules edit and no redeploy, and it's the same data the future admin screen will use.

**Rule helpers:** `staffRole()` = `get(/staffEmails/{token.email}).data.role` (with `email_verified`), plus `isAdmin()`, `isTeacher()`, `isBoardTeacher(boardId)` (`token.email in board.teacherEmails`), `isMember(boardId)`, `myStudentId(boardId)`, `isBoardWritable(boardId)` (status `active` and not past `archiveAfterDays`).

**Shared quota:** all teachers share the free quotas of the project, and the usage meter shows them.

---

## Security Rules (summary)

| Path                            | Read                          | Create / Update                                                                                                                                                                | Delete                                                   |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `users/{uid}`                   | signed in                     | self only                                                                                                                                                                      | ✗                                                        |
| `staffEmails/{email}`           | self or admin                 | admin (v1: only the admin CLI)                                                                                                                                                 | admin                                                    |
| `boards/{id}`                   | board teacher or member       | create: `isTeacher()` with own email in `teacherEmails` · update: board teacher · members: only `lastActivityAt`                                                               | board teacher, only when `archived` (purge)              |
| `joinCodes/{code}`              | `get` only (no `list`)        | `isTeacher()`                                                                                                                                                                  | board teacher                                            |
| `students`, `studentEmails`     | board teacher · own entry     | board teacher · student: link own uid · invite batch                                                                                                                           | board teacher                                            |
| `members/{uid}`                 | board teacher or member       | self, linked to a `studentId` proven by email index or invite code                                                                                                             | board teacher or self                                    |
| `spaces/{studentId}` + `slides` | board teacher or member       | `myStudentId(boardId) == studentId` and `isBoardWritable(boardId)`; size and shape validation                                                                                  | the student or board teacher                             |
| `assets/{assetId}`              | board teacher · owner student | owner student (after signed upload) · status changes by owner / board teacher                                                                                                  | ✗                                                        |
| `spaces/…/notes/{noteId}`       | board teacher · space owner   | board teacher (slide must exist, own email, server time) · edit: text only                                                                                                     | board teacher · owner with its slide                     |
| `classes/…` + `slides` (M10)    | board teacher or member       | board teacher only                                                                                                                                                             | board teacher                                            |
| `classes/…/contributions` (M10) | board teacher or member       | members: id `{slideId}_{myUid}_{1..3}`, author = me, server time, sizes, class `open`, board writable, slide exists · author edits own · teacher edits any (`editedByTeacher`) | the author (class open, board writable) or board teacher |

Tested with `@firebase/rules-unit-testing` on the emulator before deploying. **Deadline: the current open rules expire 2026-11-25.**

---

## Internationalization (Spanish default + English)

- **`i18next` + `react-i18next`.** **Spanish is the default** (and the fallback); English is the second language.
- **Detection:** the saved preference in `users.locale` → browser language (`en*` → English) → **Spanish**.
- **Language switch** in the user menu; the choice is saved in the user's profile.
- **Translation files per feature:** `src/locales/{es,en}/{common,auth,board,editor,teacher}.json`, loaded lazily per route.
- **Typed keys**, so a missing translation fails the build.
- **Dates:** `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` ("hace 3 días" / "3 days ago"), with no extra library.
- **Excalidraw's UI** follows the same language.
- **Not translated:** content written by students and teachers.
- **Rule from day 1:** no hardcoded UI text in components.

---

## Import / export (JSON)

**Students file** (`estudiantes.json`, downloadable template in the dashboard):

```json
{
  "type": "pbl.students",
  "version": 1,
  "students": [
    {
      "name": "Laura Nataly",
      "emails": ["laura@gmail.com", "lnataly@uni.edu.co"],
      "group": "Equipo 1"
    },
    { "name": "Sebastian Cetina", "emails": ["scetina@uni.edu.co"] }
  ]
}
```

**Import:** drag the file → preview with validation (Zod) → confirm.

- Each row is marked ✅ new · ♻️ existing (matched by **any** email → updates it) · ❌ invalid · ⚠️ email belongs to another student.
- Writes are batched with a progress bar, and re-importing never duplicates.
- **Quick add box:** paste lines like `Laura Nataly; laura@gmail.com; lnataly@uni.edu.co`. They go through the same preview.

**Exports (all JSON):**

| File           | `type`              | Content                                              | Use                          |
| -------------- | ------------------- | ---------------------------------------------------- | ---------------------------- |
| Students       | `pbl.students`      | Same format as the import, + status                  | Re-import next semester      |
| Board backup   | `pbl.boardBackup`   | Board, students, spaces, slides (scenes), image refs | Before purging, restore      |
| Board template | `pbl.boardTemplate` | Board settings only                                  | Start a new semester quickly |

- **Restore** always creates a **new** board.
- If the original images were purged, restored slides show an "image no longer available" placeholder.
- Every file carries `type` + `version` and is validated before anything is written.

---

## Routes

| Route                                | Page                                                                                           | Access                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| `/login`                             | Google sign-in (account chooser always shown)                                                  | public                        |
| `/`                                  | My boards + **Proyectos archivados** section                                                   | signed in                     |
| `/join/:code`                        | Invite link                                                                                    | signed in                     |
| `/me`                                | Profile: name, photo on cards, language                                                        | signed in                     |
| `/b/:boardId`                        | **Dashboard** (cards grid)                                                                     | member / board teacher        |
| `/b/:boardId/class`                  | **Classes** (M10): list of class sessions (teacher: new class, open / close)                   | member / board teacher        |
| `/b/:boardId/class/:classId`         | **Class participation** (M10): slides 1–5, prompt + live contribution cards                    | member / board teacher        |
| `/b/:boardId/class/:classId/present` | Class participation full screen (←/→ slides, live)                                             | board teacher                 |
| `/b/:boardId/s/:studentId`           | View a space (read-only) + the teacher's notes under each slide                                | member / board teacher        |
| `/b/:boardId/s/:studentId/edit`      | **Editor** (Excalidraw per slide)                                                              | the student                   |
| `/b/:boardId/present/:studentId?`    | **Presentation** (←/→ slides, ↑/↓ students, Esc)                                               | board teacher · student (own) |
| `/teacher`                           | **Teacher dashboard**: active boards, archived projects, usage meter                           | teacher                       |
| `/teacher/boards/new`                | Create a board                                                                                 | teacher                       |
| `/teacher/boards/:boardId`           | Manage: students (import / quick add / emails / merge), invite link, export, archive / restore | board teacher                 |
| `/teacher/boards/:boardId/storage`   | **Storage & cleanup**: usage, unused images, purge                                             | board teacher                 |
| `/admin/staff`                       | Teachers and admins (**M9**)                                                                   | admin                         |

Editor, viewer, presenter (Excalidraw) and the teacher area are **lazy-loaded** chunks.

---

## Code structure

```
src/
  app/                 App.tsx, router.tsx, guards (RequireAuth, RequireTeacher, RequireMember)
  components/ui/       shadcn
  components/layout/   AppShell, Header, UserMenu, LanguageSwitch
  features/
    auth/              signInWithGoogle, signOut, ensureUserDoc, useRole
    boards/            boards api/hooks/components, lifecycle (archive / restore, isArchived)
    membership/        autoJoinFromEmail, joinWithCode, useMyStudentId
    students/          import (JSON + quick add), merge, StudentsTable
    spaces/            SpaceCard, useSpaces (live), space profile
    profile/           /me: profile name, photo switch, card sync
    notes/             teacher's notes on slides (SlideNotes, useNotes)
    classes/           (M10) class participation: sessions, prompt slides, contribution cards, present
    slides/
      engine/          ⬅ adapter: ExcalidrawSlideEditor, renderSlideSvg, scene load/save, image files ↔ Cloudinary
      editor/          EditorPage, SlideSidebar (reorder), autosave, save status
      presenter/       PresenterPage, keyboard, preload, GSAP transitions
    assets/            upload (sign → Cloudinary), prepare-image, registry, orphan detection
    storage/           StoragePage, usage meter, cleanup, purge
    data-transfer/     JSON schemas (Zod), import preview, exporters
    staff/             (M9) staff screen
  lib/                 env, firebase, gsap, utils, i18n, cloudinary (URL builder), media-api (typed client), collections
  locales/             es/*.json, en/*.json
  pages/               thin route components

services/media-api/    Cloudflare Worker (TypeScript, wrangler)
scripts/admin/         Admin CLI (firebase-admin + Cloudinary Admin API)
```

**Architecture rules**

- **Layers:** `pages → features/*/hooks → features/*/api → lib/*`. Components never import the Firebase SDK, Excalidraw or the media-api `fetch` directly.
- **One slide renderer** (the `engine/` adapter) for the editor, viewer and presenter.
- **Live data** with `onSnapshot`, plus the Firestore offline cache (`persistentLocalCache`, multi-tab).
- **Contracts in one place:** the Zod schemas for documents and JSON files are shared by the app, the Worker and the CLI.
- **No secrets in the browser:** the Cloudinary secret lives only in the Worker (`wrangler secret`) and in the local CLI.

---

## Dependencies to add in Phase 2 (all free / open source)

| Package                                                                                                                                                | License      | For                                    | Where                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------------------------------------- | -------------------- |
| `@excalidraw/excalidraw`                                                                                                                               | MIT          | Slide canvas                           | lazy chunk           |
| `i18next`, `react-i18next`, `i18next-browser-languagedetector`                                                                                         | MIT          | ES / EN                                | app                  |
| `@dnd-kit/core`, `@dnd-kit/sortable`                                                                                                                   | MIT          | Reordering slides                      | editor chunk         |
| `nanoid`                                                                                                                                               | MIT          | ids, invite codes                      | app                  |
| ~~`react-hook-form`, `@hookform/resolvers`~~ (not used: peer-dependency conflict; forms are small → React state + Zod)                                 | MIT          | Forms                                  | app                  |
| shadcn: `dialog`, `dropdown-menu`, `input`, `textarea`, `card`, `avatar`, `tooltip`, `sonner`, `progress`, `table`, `alert-dialog`, `skeleton`, `tabs` | MIT          | UI                                     | on demand            |
| Worker: `wrangler` (dev), `jose`                                                                                                                       | Apache / MIT | media-api, Firebase token verification | `services/media-api` |
| CLI: `firebase-admin`, `cloudinary`, `commander`, `tsx` (dev)                                                                                          | Apache / MIT | Admin CLI                              | `scripts/admin`      |
| Dev: `@playwright/test` (end-to-end on the emulators)                                                                                                  | Apache-2.0   | E2E tests                              | —                    |
| Dev: `vitest`, `@testing-library/react`, `jsdom`, `@firebase/rules-unit-testing`                                                                       | MIT / Apache | Tests                                  | —                    |

---

## Working mode: autonomous loops (from M2)

From M2 on, **I develop on my own** in loops: each loop takes a milestone from start to finish, verifies it locally, commits it, and ends with a **report** for you. You only do what needs your accounts, your secrets or your eyes: deploys, console clicks, and a final check with real Google accounts.

### Who does what

| Me (independently)                                                                                  | You                                                                                             |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| All code: app, Worker, admin CLI, Security Rules, indexes                                           | **Deploys:** `npm run deploy:rules`, `npm run deploy` (hosting), `npx wrangler deploy` (Worker) |
| Tests: unit, rules (emulator), Worker (Cloudinary mocked), end-to-end (Playwright on the emulators) | **Console actions:** Firebase, Cloudinary, Cloudflare (e.g. App Check, reCAPTCHA key)           |
| Spanish + English texts                                                                             | **Secrets:** anything with keys (`.dev.vars`, `wrangler secret put`)                            |
| Plan updates (checkboxes, decisions)                                                                | **Production admin commands:** `npm run admin -- setup / staff add / board purge`               |
| Local commits (authored as you, no Claude attribution)                                              | **Acceptance test** with real Google accounts (a checklist in each report)                      |
| The loop report                                                                                     | **Product decisions** I flag in the report, plus `git push` once there's a remote               |

### What I never do without you

- Deploy anything (rules, hosting, Worker) or change Firebase / Cloudflare / Cloudinary settings
- Write to the **production** database or Cloudinary account (I only use the **local emulators**; Worker tests mock Cloudinary)
- Handle or print secrets (I only check that they exist)
- Delete data, push to a remote, add anything that costs money or needs a license key (**everything stays free**)

### How I verify without you (all free, all local)

| Check                       | Tool                                                                                                  | Command                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Types, lint, format         | TypeScript, ESLint, Prettier                                                                          | `npm run typecheck` · `npm run lint` · `npx prettier --check .` |
| Database rules              | Firestore emulator + rules-unit-testing                                                               | `npm run test:rules`                                            |
| Logic and components        | Vitest + Testing Library                                                                              | `npm test`                                                      |
| Worker                      | Vitest (Workers pool), Cloudinary mocked                                                              | `npm test` in `services/media-api`                              |
| **Real flows in a browser** | **Playwright** (Apache-2.0) on the **Auth + Firestore emulators**, with fake teacher/student accounts | `npm run test:e2e`                                              |
| Demo data                   | Seed script: 1 teacher, 1 board, 5 students (some with 2 emails)                                      | `npm run seed` (emulators only)                                 |
| Build + bundle size         | Vite                                                                                                  | `npm run build`                                                 |

**Quality gate:** a milestone only counts as done when **all** the checks above pass. If one fails and I can't fix it, the loop stops and the report says why.

### Loop structure

1. Read the plan and pick the milestone's open tasks.
2. Implement in small steps, **one commit per step**.
3. Run the quality gate.
4. Tick the plan's checkboxes; record any decision I took.
5. Write the report and stop.

**Stop early** when I hit something only you can do (a deploy needed to continue, a console setting, a secret), or a product decision that can't be undone. For reversible details I pick the plan's default and list it in the report as an **assumption** you can change.

### The report (end of each loop)

Saved as `reports/loop-NN-<milestone>.md` (committed) and summarized in the chat:

```
# Loop NN — <milestone>            date · commits a1b2c3d..e4f5g6h
1. Summary            what works now, in 3–5 lines
2. Done               tasks + commits
3. Quality gate       typecheck · lint · tests (n passed) · e2e · build size
4. Your turn          exact commands to run (deploys) + console steps, in order
5. Acceptance test    click-through checklist with real accounts (teacher + student)
6. Assumptions        decisions I took that you may want to change
7. Issues / risks     anything open, free-tier impact
8. Next loop          what comes next and what I need from you before it
```

### Loop roadmap

| Loop  | Milestone                                 | I build                                                                                                                                                                                                                           | You do at the end                                                                                      |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0 ✅  | **M1 finish**                             | —                                                                                                                                                                                                                                 | `npm run admin -- setup --email paradisserossa@gmail.com` · log in as teacher and as student           |
| 1 ✅  | **Infra + M2** Boards, students & joining | emulator seed, Playwright setup, `npm test`; teacher dashboard, create board, students table, JSON import + quick add, auto-join, invite link, merge, rules + tests                                                               | `npm run deploy:rules` (rules + indexes) · acceptance test                                             |
| 2 ✅  | **M3** Dashboard                          | Padlet-like board view, live cards, space profile (no cover yet)                                                                                                                                                                  | `npm run deploy:rules` · acceptance test                                                               |
| 3 ✅  | **M4** Uploads (Worker Steps 7–12)        | token check, permission check, signed uploads, cover image, asset registry, rules                                                                                                                                                 | `npx wrangler deploy` · upload a real image · `npm run deploy:rules`                                   |
| 4 ✅  | **M5** Excalidraw slides                  | editor, autosave (throttled), images via Cloudinary, viewer, self-hosted fonts                                                                                                                                                    | `npm run deploy:rules` · acceptance test                                                               |
| 5 ✅  | **M6** Presentation                       | full screen, keyboard, next student, GSAP transitions                                                                                                                                                                             | acceptance test                                                                                        |
| 6 ✅  | **M7** Lifecycle & backups                | archived projects, cleanup, purge, JSON backup/restore, CLI commands, Worker delete/usage                                                                                                                                         | `npx wrangler deploy` · `npm run deploy:rules` · try cleanup on a test board                           |
| 7 ✅  | **M8** Hardening & launch                 | App Check code, final rules review, privacy notice, metadata                                                                                                                                                                      | create a reCAPTCHA v3 key + register App Check (console) · `npm run deploy` (hosting)                  |
| 8 📝  | **M10** Class participation               | classes with 1–5 participation slides, contribution cards (text + picture), own edit / delete, teacher moderation, open / close, present, Worker `scope: 'class'`, orphans, backup v2, rules + tests                              | answer D12–D17 · `npm run worker:deploy` · `npm run deploy:rules` · acceptance test                    |
| 9 ✅  | **M11** Profile photo & DT stage          | uploaded profile photo (crop, Worker `scope: 'avatar'`), stage ring on every avatar, stage picker, board stage list (teacher), dashboard summary + filter, rules + tests                                                          | answer D18–D24 · `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test |
| 10 ✅ | **M12** Board customization               | "Personalizar tablero" panel (name, logo, background, layout, sticky header), #DOCENTE ring, GSAP Flip / ScrollTrigger animations, Worker `scope: 'board'`, rules + tests                                                         | answer D25–D32 · `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test |
| 10 ✅ | **M13** Notes while presenting            | notes panel in the presenter (N), quick add / edit / delete on the slide on screen, "Vista del docente" window synced by BroadcastChannel, e2e                                                                                    | answer D33–D35 · `npm run deploy` · acceptance test (no rules / Worker change)                         |
| 12 ✅ | **M14** Embeds that work                  | "Insertar contenido" dialog (detect, convert, preview, instructions), display-time link fixes, text-link → embed, embed loading / fallback, "¿Cómo insertar…?" guide, Worker short-link resolver, e2e                             | answer D36–D41 · `npm run worker:deploy` · `npm run deploy` · acceptance test with real links          |
| 13 ✅ | **M15** Teacher edits students' slides    | teacher opens the editor on any slide, version kept before the first change, "Editada por el docente" + compare / restore, edit lock, Worker + rules for teacher uploads, e2e                                                     | answer D42–D47 · `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test |
| 14 ✅ | **M16** Teacher's class tools             | shared class clock (activity / break) on the board doc, focus view, student banners, polls in spaces (+ presenter results), "Lista para presentar" + filters + "Presentar listos", break screen with random Lottie, rules + tests | answer D48–D54 · approve the animation set · `npm run deploy:all` · acceptance test in class           |
| 15 ✅ | **M17** Canva and the embed options       | service tiles (Canva first), embed codes with their shape, Worker `/links/canva` (oEmbed: shared? size, title), Canva sites explained, guide, e2e                                                                                 | `npm run worker:deploy` · `npm run update:web` · acceptance test with a real Canva design              |
| —     | **M9** More teachers                      | when you need it                                                                                                                                                                                                                  | —                                                                                                      |

**Starting a loop:** say **"run loop N"** (e.g. "run loop 1"). I'll work through it and come back with the report.

---

## Milestones (pair programming order)

Each milestone ends with something we can try in the browser, plus a commit.

### M1 — Auth, i18n base & admin setup

- [x] **Enable Google sign-in** (done 2026-10-26) (you, Firebase console → Authentication → Sign-in method → Google):
  - Turn on **Habilitar**
  - **Correo electrónico de asistencia:** your personal Gmail · **Nombre público:** e.g. "PBL Diplomado"
  - **Ignore** the SHA-1 notice (Android apps only), "entidades seguras" (optional) and "Configuración del SDK web" (not needed)
  - **Guardar**
  - Check **Authentication → Configuración → Dominios autorizados** lists `localhost`, `diplomado-fc679.firebaseapp.com` and `diplomado-fc679.web.app`
- [x] **Firestore database** created (2026-10-26): `(default)`, Standard edition, native mode, location **`nam5`** (US multi-region, free tier) — `firebase.json` updated to match
- [x] `signInWithGoogle` (`prompt: 'select_account'`, popup → redirect fallback), `signOut`, `users/{uid}` (`features/auth/api.ts`)
- [x] `/login` (Spanish/English switch, privacy line), `RequireAuth`, `UserMenu` (signed in as…, role, switch account, language, sign out), `AppShell`
- [x] i18next setup (**es default**, en), language switch saved in `users.locale`, typed keys (`src/i18next.d.ts`)
- [x] `.gitignore`: `secrets/`, `backups/` (`.env.admin.local` is already covered by `.env.*`)
- [x] Download the Firebase **service account key** (verified 2026-10-26) (you) → `secrets/service-account.json` — [step by step](#how-to-get-the-firebase-service-account-key)
- [x] Admin CLI (`scripts/admin/`, `npm run admin`): `setup`, `staff list | add | remove`
- [x] **Run** `npm run admin -- setup --email paradisserossa@gmail.com` → your Gmail becomes the teacher (admin) — verified 2026-10-26
- [x] After login: teacher email → `/teacher`; any other email → student home `/` (`HomeRedirect`)
- [x] Role in `AuthProvider` (`useAuth().role`) + `RequireTeacher` (`RequireAdmin` arrives with M9)
- [x] Firestore offline cache (`persistentLocalCache`, multi-tab)
- [x] Rules: `users`, `staffEmails`, deny everything else + **11 emulator tests** (`npm run test:rules`)
- [x] Rules dry run: compiled successfully on Firebase (2026-10-26)
- [x] **Deploy the rules** (you): `npm run deploy:rules` — done 2026-10-26
- [x] **Try it:** teacher → `/teacher`, other accounts → student home (also covered by e2e tests)

### M2 — Boards, students & joining

- [x] Teacher dashboard: my boards (live), create a board with invite code, invite link (copy, on/off)
- [x] Students table: add / edit a student (1–5 emails), remove, joined status + linked accounts
- [x] **JSON import** (template, preview with new / update / unchanged / invalid / conflict, batched) + **quick add** box + students JSON export
- [x] Auto-join with either email · `/join/:code` fallback · merge students
- [x] Rules + tests, including "two accounts → same student → same space" (29 rules tests)
- [x] Test infra: emulator mode (`.env.emulators`, `demo-pbl`), `npm run seed`, Playwright e2e (10 flows), `npm run check`
- [ ] **Deploy rules + indexes** (you): `npm run deploy:rules`
- [ ] **Acceptance test** (you): [checklist](reports/loop-01-m2.md#5-acceptance-test)

### M3 — Dashboard (the reference screen)

- [x] Board header (title, description, student count), Padlet-like yellow background, masonry columns of `SpaceCard`, **live updates**, my card first, skeletons, empty and read-only states, GSAP entrance
- [x] Card actions: open (space page), edit (owner only) · **present (teacher) moves to M6**, where presentation mode exists
- [x] Space profile: title, summary (1000 chars), 7 named colors (cover image comes in M4)
- [x] Rules: student edits only their own card (either account), only while the board is active; teacher syncs the name on rename (37 rules tests)
- [x] Space page `/b/:boardId/s/:studentId` (slides viewer arrives in M5)
- [x] E2E: 6 dashboard flows incl. live teacher ↔ student update (16 e2e total)
- [ ] **Deploy rules** (you): `npm run deploy:rules`
- [ ] **Acceptance test** (you): [checklist](reports/loop-02-m3.md#5-acceptance-test)

### M4 — Media API (Cloudflare Worker) + Cloudinary — **baby steps below**

- [x] Steps 1–9 and 12 of the [Worker walkthrough](#m4-walkthrough-cloudflare-worker--cloudinary-baby-steps) (Step 11 is M7)
- [x] **Step 10 (you):** `npm run worker:deploy` — Loop 3 Worker verified live 2026-10-27 (`/me` answers 401)
- [ ] One real image upload (you), and redeploy the Worker for M7 (`npm run worker:deploy`)
- [x] Cover image upload in the space profile (resize/WebP in the browser, signed upload with progress, registry, orphan marking)
- [x] Rules + tests for `assets` and `spaces.cover` (42 rules tests)
- [x] Worker: 19 offline tests + **real integration test** (`npm run test:worker-integration`: real Worker + emulators + rules)
- [x] Auto-join now runs right after login, so direct links to a board work on the first login
- [ ] **Deploy rules** (you): `npm run deploy:rules`

### M5 — Slides with Excalidraw

- [x] Engine adapter: `SlideCanvas` (basic UI, locked 16:9 frame fitted to view, image files ↔ Cloudinary, self-hosted fonts, es/en, allow-listed embeds) + `renderSlideSvg` (sandboxed embeds)
- [x] Editor page: slide sidebar (add / duplicate / delete / drag or keyboard reorder), throttled autosave (3 s idle, ≤ 1 / 15 s), save status, size guard (warn 800 KB, max 900 KB), max 50 slides / 30 images per slide
- [x] Space viewer (on the space page), card date refreshed by slide saves at most every 10 min
- [x] Rules + tests for `spaces.slideOrder`, `slides` (49 rules tests) · 6 e2e flows (27 e2e total)
- [ ] **Deploy rules + indexes** (you): `npm run deploy:rules`
- [ ] **Acceptance test** (you): [checklist](reports/loop-04-m5.md#5-acceptance-test)

### M6 — Presentation mode

- [x] Fullscreen (F), ←/→ slides (+ PageUp/PageDown clickers, Space), ↑/↓ students, Home/End, Esc, student picker, overview (O), touch swipes, auto-hiding controls
- [x] Preload the next slides and the next student (SVG + 1920 px images), GSAP transitions (off with `prefers-reduced-motion`)
- [x] "Presentar" on cards (teacher, from M3), "Presentar tablero", and on the space page (teacher or owner) · 6 unit + 4 e2e tests (31 e2e total)
- [ ] **Acceptance test** (you): [checklist](reports/loop-05-m6.md#5-acceptance-test)

### M7 — Data lifecycle & backups

- [x] `lastActivityAt` (hourly, from student and teacher edits) + **"Proyectos archivados"** (auto after `archiveAfterDays`, configurable), archive now / restore — the rules apply the same date check to every student write
- [x] Asset status tracking + orphan detection (registry minus slides and covers, 24 h grace)
- [x] Worker: `POST /assets/delete` (40 per call: free plan's 50 subrequests), `POST /boards/purge` (prod + dev folders, resumable), `GET /usage`
- [x] Storage page: usage meter (warning at 70 %), **clean up unused images**, purge (archived + backup downloaded + type the name)
- [x] Board backup / template JSON export + restore into a new board ("Restaurar desde archivo")
- [x] CLI: `cleanup`, `board archive|restore|purge`, `backup`, `usage` (+ `npm run test:admin`)
- [ ] **Deploy** (you): `npm run deploy:rules` + `npm run worker:deploy` · create `.env.admin.local` for the CLI
- [ ] **Acceptance test** (you): [checklist](reports/loop-06-m7.md#5-acceptance-test)

### M8 — Hardening & launch

- [x] Full rules review + `npm run test:rules` (58) — **fixed a hijack of invite-joined students' spaces** (see [report](reports/loop-07-m8.md#2-done)); invite link closed on auto-archived boards; https-only photos
- [x] App Check with the **reCAPTCHA v3** provider (code ready, off until `VITE_RECAPTCHA_SITE_KEY` is set); the Worker checks `X-Firebase-AppCheck` (`APP_CHECK` = off / monitor / enforce, deployed as monitor) and forwards it to Firestore
- [x] **Privacy notice** `/privacidad` (Ley 1581 de 2012), linked from the login page and the footer
- [x] Final `<title>`, `lang="es"`, favicon, Open Graph image, noindex, Hosting cache + security headers, teacher-only chunk
- [ ] **Launch** (you): [step by step](reports/loop-07-m8.md#4-your-turn-launch-step-by-step) — deploy rules, Worker, reCAPTCHA key + App Check registration, Hosting
- [ ] After a few days in monitor mode (you): enforce App Check for Firestore (console) and set `APP_CHECK` to `enforce` (Worker)

### Extras (2026-10-29)

- [x] **Profile page `/me`** (F10): display name (empty = Google name), "show my Google photo", language; saving renames the student's cards on writable boards (rules: the owner may change `ownerName`) — commit `d511b31`
- [x] **Teacher's notes on slides** (F11): add / edit / delete under each slide in the space viewer; the student reads them there and next to the slide in the editor; classmates never see them; deleted with their slide, with the student and on purge — commit `df9a562`
- [ ] **Deploy rules** (you): `npm run deploy:rules` (both extras need it), then `npm run deploy`

### Navigation fix (2026-10-31)

- [x] The app name in the header is a **home link** (`/` → the teacher dashboard or the student's boards)
- [x] **Mi perfil** has a **"Volver"** link: back to the page you came from, or home when `/me` was opened directly (new tab, reload)
- [ ] Deploy (you): `npm run deploy` (Hosting only; no rules or Worker change)

### M10 — Class participation ("Participación en clase", F12) — Loop 8

A shared board **per class session** where the teacher and the students interact. It lives in **separate participation slides**, apart from each student's own space.

**What people see**

- A **"Tarjetas | Clases"** switch in the board header (`/b/:boardId` ↔ `/b/:boardId/class`). "Clases" lists the sessions, newest first, with date, number of slides and open / closed.
- **Teacher:** "Nueva clase" → title + date → **1 to 5 participation slides** (add, reorder, delete). Each slide has a **prompt**: a question or activity title, instructions and an optional picture. The teacher **opens or closes** the class: when closed, students only read.
- **Class page** `/b/:boardId/class/:classId`: slide tabs **1 … 5**. Each slide shows the prompt at the top and the **contribution cards** below (masonry grid, like the dashboard), live.
- **Students:** "Participar" → text (≤ 1000 chars) + optional picture + card color. They **edit and delete their own** contributions while the class is open, up to **3 per slide**. Their cards show their name and photo (from `/me`).
- **Teacher:** edits or deletes **any** contribution (the card then says "editado por el docente") and can also add their own (marked "Docente").
- **Present** (teacher): full screen, ←/→ between slides, contributions appear live; good for discussing in class.
- **Archived or locked boards:** classes stay readable and presentable; nobody writes (same check as slides).

**What does NOT change (functionality preserved)**

- Personal spaces, cards, slides (Excalidraw), the editor, the viewer, presentation mode, the teacher's notes, the profile, storage, backups and purge work exactly as today. Participation is stored in its **own collection** (`classes`), so no existing document, rule or route changes meaning.
- The only shared pieces are **extended, not changed**: the Worker gets a new upload scope, the asset registry a new `kind`, orphan detection / purge / student removal also look at `classes`, and the backup gets a version 2 that still restores version 1 files.
- Every existing test (rules, unit, Worker, admin CLI, e2e) must still pass at the end of the loop.

**How it's built**

- [ ] Model + Zod schemas: `ClassDoc`, `ClassSlideDoc`, `ContributionDoc`, limits (5 slides, 3 per person per slide, 1000 chars, 1 picture)
- [ ] Rules: read = board teacher or member · classes and prompt slides: board teacher only · contributions: create with id `{slideId}_{myUid}_{1..3}`, author fields = me, `createdAt == request.time`, slide exists, class `open`, board writable (teacher: always) · update: the author (same checks, can't move it to another slide or change the author) or the teacher (`text` / `image` / `color` / `editedByTeacher`) · delete: the author while open, or the teacher
- [ ] Worker: `scope: 'class'` in `POST /uploads/sign` (member or board teacher, board writable) → `pbl/{env}/{boardId}/class/{assetId}`; Worker tests + integration test
- [ ] Asset registry: `kind: 'class'`, `ownerUid`; rules let members and teachers register their class uploads; replacing / deleting a picture marks it `orphaned`
- [ ] Orphan detection, storage page, purge (app + CLI) include `classes`; removing a student keeps their contributions (D15)
- [ ] **Backup v2** (`pbl.boardBackup` version 2): classes, prompt slides and contributions (text, picture refs, author name and role); restore accepts v1 and v2
- [ ] Pages: classes list, class editor (teacher: title, date, slides, prompts, open / close), class page (tabs, prompt, live cards, "Participar", edit / delete), present view; es / en; mobile layout
- [ ] Privacy notice: contributions are visible to the whole class
- [ ] Tests: unit (limits, id helper, ordering, backup v2), rules (≈ 18), Worker, e2e (teacher creates a class with 3 slides; two students participate with text + picture; a student edits / deletes only their own; the 4th contribution on a slide is refused; teacher edits / deletes any; closed class is read-only; present view updates live; archived board read-only) + the full existing suite
- [ ] **Your turn:** `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test

**Free-tier budget (40 students, one class with 5 slides)**

| What                                                                | Estimate                                 | Limit      |
| ------------------------------------------------------------------- | ---------------------------------------- | ---------- |
| Writes: ~2 contributions per student per slide + edits + registry   | ~500 per class                           | 20K / day  |
| Reads: each contribution × people on that slide (≤ 41) + first load | ~10–20K per class                        | 50K / day  |
| Cloudinary: ~100 pictures × ~400 KB stored, ~50 KB per view         | ~40 MB stored, ~2 GB delivered per month | 25 credits |

Two big classes on the same day still fit; the usage meter (M7) shows Firestore and Cloudinary use.

**Risks:** reads grow with "contributions × viewers" (mitigated by listening only to the slide on screen and the 3-per-slide cap); moderation is manual (the teacher closes the class or deletes cards).

### M11 — Profile photo & Design Thinking stage (F13, F14) — Loop 9

The diplomado is a **Design Thinking** course. Each student shows **where they are in the process** with a ring around their photo, like LinkedIn's #OPENTOWORK frame, and can use **their own photo** instead of the Google one.

**What people see**

- **`/me` → "Foto":** three options: **Google photo** · **Uploaded photo** ("Subir foto": pick a file, drag / zoom a square crop, save) · **Initials**. "Quitar foto" deletes the uploaded one. The preview shows the photo with the current ring.
- **The stage ring:** a colored ring around the avatar. On large avatars (space page, `/me`, presenter, ≥ 72 px) the stage name is written **along the lower arc** of the ring, like #OPENTOWORK: **#EMPATIZANDO · #DEFINIENDO · #IDEANDO · #PROTOTIPANDO · #EVALUANDO**, and **#VITRINEANDO** for students who are only here to learn or don't have a project yet (dashed ring, eye icon, so it never looks like "behind"). On small avatars (cards, contributions, user menu) only the colored ring plus a tooltip. No stage = no ring, exactly as today.
- **Choosing the stage (student):** a stage picker in the space profile ("¿En qué etapa vas?") and by clicking the ring on their own card. The stage is **per board** (per project), so the same person can be in different stages in different courses.
- **Teacher:** sees a **stage summary** on the board header (e.g. "Empatizando 6 · Definiendo 9 · … · Vitrineando 2 · Sin etapa 4"); clicking a stage **filters the dashboard**. Can set a student's stage (marked "puesta por el docente"). In board settings, can **rename, recolor, reorder, add or hide stages** (up to 8, plus "Vitrineando"); a new board starts with the Design Thinking stages.
- **Where the ring appears:** dashboard cards, space page, presenter (next to the student's name), user menu, `/me`, and class contributions (M10) when that loop exists.

**What does NOT change**

- Name, photo and language on `/me` work as today; students who never choose a stage see exactly the current cards. `showPhoto` keeps working (read as `photoSource`) so no data migration is needed.
- Board images, the asset registry, orphan detection and purge are untouched: the avatar lives outside the boards, one fixed file per person.

**How it's built**

- [x] Model + Zod: `photoSource`, `avatar`, `StageDef`, `DEFAULT_STAGES` (Design Thinking + browsing, colors), `space.stage` / `stageUpdatedAt` / `stageSetBy`; helper `cardPhoto(user)` covers the three sources
- [x] Worker: `scope: 'avatar'` in `POST /uploads/sign` (staff or member of ≥ 1 board) → `pbl/{env}/users/{uid}/avatar`, overwrite; `POST /avatar/delete`; Worker tests + integration test
- [x] Profile: photo source picker, square crop (canvas, no new library) + upload, remove; saving updates `ownerPhotoURL` on the person's writable boards (same path as the name today)
- [x] `StageAvatar` component: SVG ring, curved label (`textPath`) on large sizes, dashed style for browsing, tooltip + `aria-label` ("Etapa: Ideando"), respects reduced motion; used everywhere avatars appear
- [x] Stage picker (space profile + own card); teacher's per-student picker; board settings editor for the stage list (default DT)
- [x] Dashboard: stage summary chips with counts + filter (no extra reads: the counts come from the cards already loaded)
- [x] Rules (stage ids are checked by pattern, not against the board's list; an unknown id shows as "Sin etapa"): the space owner may change only `stage` / `stageUpdatedAt` / `stageSetBy == 'student'` (on writable boards); the board teacher may set them with `stageSetBy == 'teacher'`; `stage` must be null or a known id (≤ 40 chars); `users/{uid}` owner may set `photoSource` / `avatar` (publicId must be `pbl/*/users/{uid}/avatar`); `boards.stages` teacher only, ≤ 9 entries
- [x] Backup: `stage` fields go with the spaces (optional fields, so version 1 files still restore); `boards.stages` included; avatars are not part of a board backup (they belong to the person)
- [x] ADMIN_CLI
- [x] Privacy notice: uploaded photo and stage are visible to the board
- [x] es / en texts; mobile layout
- [x] Tests: unit (stage defaults, label / color lookup, `cardPhoto`, crop math), rules (≈ 12: own stage only, teacher sets any, unknown id refused, locked board refused, avatar publicId of another uid refused), Worker (avatar scope allowed / refused for a non-member, fixed public_id, delete), e2e (upload + crop + card shows it; switch to initials; student picks "Ideando" and the ring + curved label appear; "Vitrineando" style; teacher filter by stage; teacher renames a stage; locked board can't change stage) + the full existing suite
- [x] YOUR_TURN `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test (upload your photo, set a stage as a student, filter as the teacher)

**Free-tier budget (40 students)**

| What                                                                        | Estimate                         | Limit      |
| --------------------------------------------------------------------------- | -------------------------------- | ---------- |
| Cloudinary: 40 avatars × ~60 KB, ~4–15 KB per view                          | ~2.4 MB stored, < 0.2 GB / month | 25 credits |
| Writes: a stage change = 1 write; a photo change = 1 + one per active board | a few dozen per week             | 20K / day  |
| Reads: none extra (stage and photo URL travel on the card already loaded)   | 0                                | 50K / day  |

**Risks:** students may forget to update their stage (the teacher can set it, and `stageUpdatedAt` shows "hace 3 semanas"); a stage list edited mid-course leaves students on a hidden stage (shown as "Sin etapa" until they pick again, the value is kept).

### M12 — Board customization (F15, F16) — Loop 10

The teacher makes each board look like their course, and everyone can tell who the teacher is.

**What people see**

- **Teacher → "Personalizar tablero"** (button on the board header): a **side panel** over the board with **live preview** (the board behind it changes as you choose; "Guardar" / "Cancelar").
  - **Nombre y descripción** of the board (the invite link keeps showing the new name).
  - **Logo:** upload (square or wide, max 512 px), remove. Shown in the board header, on the students' "Mis tableros" card and in the presenter's top bar.
  - **Fondo:** 12 presets (today's yellow, mint, sky, lavender, peach, sand, white, charcoal + 4 soft gradients) × pattern (dots · grid · none). Each preset declares light or dark text so titles stay readable (contrast checked in tests).
  - **Distribución:** **Muro** (today's masonry) · **Cuadrícula** (equal cards in rows) · **Lista** (compact rows: photo + ring, name, title, slides, updated) · **Por etapa** (one column per Design Thinking stage, like a Kanban; uses M11) · **Por grupo** (one column per student group, e.g. "Equipo 1"). Plus **order**: joining order · name · last updated.
  - **Encabezado fijo:** on by default; the header (logo, title, stage chips, buttons) stays at the top while scrolling and **shrinks** (smaller logo, description hidden).
- **Teacher distinction:** the teacher's photo gets a **"#DOCENTE" ring** (dark ring with a gold label + graduation-cap badge) everywhere it appears: user menu, `/me`, the board header ("Docente: [photo] Name", all co-teachers), notes on slides, and class contributions (M10). Students never get this ring; teachers have no stage.
- **Animations (GSAP, free incl. Flip):**
  - Layout, order or stage-filter changes: cards **glide to their new place** (Flip) instead of jumping.
  - A classmate's card that appears live **pops in**; a card updated live gets a short glow.
  - Choosing a stage: the ring **draws itself** around the photo and the curved label fades in.
  - Sticky header **shrinks smoothly** with ScrollTrigger; the background **crossfades** when changed.
  - Board intro: logo, title and chips enter in a short stagger (today only the cards fade in).
  - Everything is skipped with the system's **"reduce motion"**, and nothing animates during the presenter.

**What does NOT change**

- Boards without settings look exactly as today (`background: 'yellow'`, dots, masonry, sticky header on). Cards, spaces, slides, stages, presenter navigation and backups keep working; the new fields are optional.

**How it's built**

- [x] Model + Zod: `BOARD_BACKGROUNDS` (id, css, text: light/dark), `BOARD_LAYOUTS`, `boardLookSchema`; `space.group`; `teacherProfiles`
- [x] Board look helpers (pure, unit-tested): resolve background / layout defaults, sort, group spaces by stage and by group (unknown → "Sin etapa" / "Sin grupo")
- [x] Panel: `BoardCustomizePanel` (side sheet, live preview via local draft, save / cancel), name + description (existing `updateBoardInfo`, also syncs `joinCodes.boardTitle`), logo picker
- [x] Layouts: `BoardGrid` renders masonry / grid / list / columns (stages, groups) with horizontal scroll on phones; sticky header component
- [x] Teacher ring: `StageAvatar` gets a `teacher` variant (#DOCENTE); `teacherProfiles` refreshed when a teacher saves `/me` or opens their board; header "Docente" row
- [x] `space.group`: written when the teacher edits / imports a student and on join (rules: teacher may change `ownerName` and `group`)
- [x] Worker: `scope: 'board'` (board teacher, writable) → `pbl/{env}/{boardId}/board/{assetId}`; tests + integration test
- [x] Rules: new board fields (teacher only, enums and sizes), logo `validImageRef` in the board folder, asset `kind: 'logo'` created by the board teacher
- [x] GSAP: register `Flip`; `useBoardAnimations` (Flip on layout / filter / sort, live arrivals, header shrink), ring draw-in; all behind `prefers-reduced-motion`
- [x] Backup / template: look settings + `group` (optional fields; logo reference like covers, not restored)
- [x] es / en texts; mobile layout (panel full screen on phones)
- [x] Tests: unit (defaults, sorting, grouping, contrast of every preset), rules (≈ 10: teacher-only look fields, enums, logo path / registry, student can't change), Worker (board scope allowed / refused), e2e (rename board; change background + layout and a student sees it live; "Por etapa" columns; sticky header stays visible after scrolling; logo upload; #DOCENTE ring in the header; reduced motion = no animation) + the full existing suite
- [ ] **Your turn:** `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test

**Free-tier budget:** no extra reads (look settings and teacher profiles travel on the board document every page already listens to); a logo ≈ 50 KB per board; GSAP Flip ≈ 10 KB gzip in the board chunk.

**Risks:** "Por etapa" / "Por grupo" with many columns on a phone (mitigated: horizontal scroll with snap, column counts in the header); a dark background with light cards needs the contrast check; `teacherProfiles` can be stale if a teacher changes their photo and never opens the board (refreshed on next visit).

### M13 — Teacher's notes while presenting (F11 in the presenter)

While presenting a student's slides in class, the teacher writes feedback **on the slide on screen**, without leaving full screen. Same notes as F11: private to the teacher(s) and that student, deleted with the slide.

**What people see**

- **Presenter (teacher only):** a **"Notas"** button and the key **N** open a side panel next to the slide (the slide shrinks, nothing is covered). It lists the notes of the current slide and has a text box: **Enter** saves, **Shift+Enter** new line, **Esc** closes the panel (a second Esc leaves the presenter, as today). Edit / delete like on the space page. Moving to the next slide or student (←/→, overview) follows with the panel open.
- **Badge** on the presenter's slide counter when the slide has notes ("2 notas"), visible only to the teacher.
- **Projector safety:** the panel starts **closed** on every presentation and shows "Visible en pantalla" while open. Option **"Vista del docente"** opens a **second window** (the laptop screen) with the current slide, the next slide, the notes panel and a timer; the projected window shows only the slide. Both windows stay in sync (same slide, same student) through `BroadcastChannel` (same browser, no server, free).
- **Students** presenting their own space don't see the panel or the badge (they read notes on their space page, as today).
- Typing in the panel never moves slides (arrow keys and space only navigate outside the text box).

**What does NOT change**

- Notes data, rules and the space page are the same as F11 (no rules or Worker change, no new collection).

**How it's built**

- [x] `PresenterNotesPanel` reusing `useNotes` / `addNote` / `updateNote` / `deleteNote` and the `SlideNotes` list; keyboard shortcuts guarded while typing
- [x] Presenter: "Notas" button + N, badge with the count, layout with the panel (slide scales down), starts closed
- [x] "Vista del docente": `/b/:boardId/present/:studentId?view=console` window + `BroadcastChannel('pbl-presenter-<boardId>')` messages (`goto`, `student`), next-slide preview, timer
- [x] es / en texts
- [x] Tests: unit (sync message reducer, shortcut guard), e2e (teacher adds a note while presenting → the student sees it on their space page; arrows don't move slides while typing; the student presenting sees no panel; console and projected windows stay in sync)
- [ ] **Your turn:** `npm run deploy` · acceptance test with a projector or a second screen

**Free-tier budget:** the notes of the student on screen are one small query (as on the space page); a few writes per class.

**Risks:** a teacher may open the panel on the projector by mistake (mitigated: closed by default, "Visible en pantalla" label, the console window).

### M14 — Embeds that work (F17) — Loop 12

Students document their process with tools they already use (Google Slides, Figma, Canva…). Today the slide editor only has Excalidraw's generic "web embed" tool, so students paste links as text or use links that can't play inside a frame.

**What we found (production, 2026-10-31, read-only, no personal data)**

| Case                                               | Count | Why it fails                                                                                                                              |
| -------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Figma Slides deck embed (`embed.figma.com/deck/…`) | 1     | Correct format; Figma shows its own loading screen forever when the viewer has no access → the file must be shared "Anyone with the link" |
| Google Slides link typed as text                   | 1     | Not an embed; an `/edit` link can't run in a frame anyway (needs `/embed` or `/preview`)                                                  |
| Google Forms link typed as text                    | 1     | Not an embed; needs `?embedded=true`                                                                                                      |
| `canva.link/…` short link typed as text            | 1     | Short links redirect; the frame needs the final `canva.com/design/…/view?embed` link                                                      |

Our site doesn't block frames (no CSP `frame-src`), so the fixes are on the link format, the sharing settings and guidance.

**What people see**

- **Editor → "Insertar contenido"** (a clear button next to the toolbar, also when pasting a link on the canvas): paste a link → the app shows the **service it recognized** (icon + name), **converts** it to the embeddable form, shows a **live preview** in the dialog and a short **checklist for that service** ("Compartir → Cualquier persona con el enlace → Lector"). "Insertar" places it in the slide at the right size (16:9 for slides and videos, 4:3 for documents, tall for forms).
- **Supported services (v1):**

| Service                                   | Accepted links                                    | Embedded as                                       | What the student must do                                                 |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Google Slides                             | `/presentation/d/ID/edit`, `/view`, `/pub`        | `/presentation/d/ID/embed?start=false&loop=false` | Share → "Cualquier persona con el enlace" (or File → Publicar en la web) |
| Google Docs / Sheets                      | `/document/d/ID/…`, `/spreadsheets/d/ID/…`        | `…/preview`                                       | Share → anyone with the link                                             |
| Google Forms                              | `/forms/d/e/ID/viewform`, `forms.gle/…`           | `…/viewform?embedded=true`                        | Nothing (forms are public when sent)                                     |
| Google Drive (video, PDF)                 | `/file/d/ID/view`                                 | `/file/d/ID/preview`                              | Share → anyone with the link                                             |
| YouTube                                   | `watch?v=`, `youtu.be/`, `shorts/`                | `youtube-nocookie.com/embed/ID` (privacy)         | Public or unlisted video                                                 |
| Vimeo                                     | `vimeo.com/ID`                                    | `player.vimeo.com/video/ID`                       | Embedding allowed                                                        |
| Loom                                      | `loom.com/share/ID`                               | `loom.com/embed/ID`                               | Nothing                                                                  |
| Figma (design, prototype, FigJam, Slides) | `figma.com/design                                 | proto                                             | board                                                                    | deck/…` | `embed.figma.com/…?embed-host=pbl` | Share → "Anyone with the link can view" |
| Canva                                     | `canva.com/design/ID/…`, `canva.link/…`           | `canva.com/design/ID/view?embed`                  | Share → "Cualquier persona con el enlace" (view)                         |
| Miro                                      | `miro.com/app/board/ID`                           | `miro.com/app/live-embed/ID`                      | Share → anyone with the link can view                                    |
| Notion                                    | `*.notion.site/…`                                 | same link                                         | Share → Publish to web                                                   |
| Genially, Prezi, Padlet                   | `view.genial.ly/…`, `prezi.com/…`, `padlet.com/…` | their embed URL                                   | Public / "anyone with the link"                                          |

Anything else stays a normal link (button "Abrir enlace"), as today.

- **Existing slides fix themselves:** when a slide is shown (viewer, presenter, editor), known links are rewritten to their embeddable form (e.g. Google `/edit` → `/embed`, YouTube → nocookie). No data migration.
- **Links typed as text:** the editor shows a hint on that slide ("Este enlace se puede ver dentro de la diapositiva") with **"Convertir"** (replaces the text by the embed, same place). In the viewer and presenter, links inside text are **clickable** (open in a new tab).
- **Short links** (`canva.link`, `forms.gle`, `youtu.be`…): the media-api Worker resolves the redirect (**only for an allow-list of shorteners**, no page content is read) so the dialog can convert them.
- **Loading:**
  - The slide shows a **shimmer skeleton** with "Cargando diapositiva…" and fades in (GSAP) when ready.
  - Each embed shows an **overlay with the service's icon and a spinner** until the frame loads.
  - After **12 s** without loading, or for services that need sign-in, the overlay changes to **"¿No carga?"** with the fix for that service ("Pídele a … que lo comparta como 'Cualquier persona con el enlace'") and an **"Abrir en una pestaña nueva"** button.
  - Every embed has a small **"↗ Abrir"** chip in the viewer and presenter.
  - Presenter: the next slide's embeds start loading in the background (hidden) so they're ready when you move.
- **"¿Cómo insertar…?" guide:** a short page per service (3–4 steps, es / en), linked from the editor, the dialog and the "¿No carga?" message. The teacher can share its link with the class.

**What does NOT change**

- Excalidraw slides, images, text and drawings; the slide data format (embeds stay Excalidraw `embeddable` elements); every embed is still sandboxed and allow-listed.

**How it's built**

- [x] `embeds.ts` (pure, unit-tested): provider registry (hosts, URL patterns → embed URL, aspect ratio, sandbox extras, instructions key, needs-sharing flag), `detectEmbed(url)`, `toEmbedUrl(url)`; replaces `EMBED_HOSTS`
- [x] Display-time rewrite in `renderSlideSvg` (iframe `src` → `toEmbedUrl`), per-provider sandbox extras (e.g. `allow-forms` for Forms), `allow="fullscreen; autoplay; encrypted-media"`
- [x] `InsertEmbedDialog` in the editor (paste, detect, convert, live preview, checklist, insert sized element) + paste-on-canvas hook
- [x] Text-link checker in the editor (hint + "Convertir"); clickable URLs in rendered text
- [x] Embed loading overlay + 12 s fallback + "↗ Abrir" chip (viewer, presenter, editor); slide shimmer skeleton + GSAP fade-in
- [x] Presenter pre-warm of the next slide's embeds — **deferred**: a frame created again on the next slide reloads anyway, so a hidden copy doesn't make it faster (see report)
- [x] Worker: `POST /links/resolve` (signed-in users, allow-listed shortener hosts, follows ≤ 5 redirects with HEAD / GET without body, returns the final URL only); tests
- [x] Guide page `/ayuda/insertar` (es / en) + links
- [x] Privacy notice: embedded services (Google, YouTube nocookie, Figma, Canva…) load from their own servers when a slide is shown
- [x] Tests: unit (every provider: accepted / rejected links, conversion, short links, sizes), Worker (resolver allow-list, redirect limit, no content), e2e (insert a Google Slides `/edit` link → embedded as `/embed`; YouTube link → nocookie; text link → "Convertir"; an embed that never loads shows "¿No carga?" + "Abrir"; the slide skeleton shows while loading) + the full existing suite
- [ ] **Manual compatibility check** (you + me, real public test files): each service in the table, viewer and presenter, Chrome + Safari (Safari blocks some third-party cookies) → result table in the report
- [ ] **Your turn:** `npm run worker:deploy` · `npm run deploy` · acceptance test with real links

**Free-tier budget:** the Worker resolver only for short links (a few calls per week); no Firestore change; embeds load from the providers.

**Risks:** providers change their embed URLs (registry in one file, unit tests per provider); Safari / Brave block third-party cookies, so private Figma or Google files never load there (the "¿No carga?" message explains it: share publicly); some services may refuse frames entirely (they stay links with "Abrir").

### M15 — Teacher edits students' slides (F18) — Loop 13

The teacher improves or corrects a student's slides directly (a typo, a misplaced image, a clearer diagram), instead of only writing notes. Today that's impossible: the editor redirects anyone but the owner, the rules allow slide writes only to the owner, and the Worker signs image uploads only for the owner.

**What people see**

- **Teacher, on a student's space page or while presenting:** an **"Editar diapositiva"** button on each slide (and "Editar" in the presenter, which opens the editor on that slide). The same editor as the student's, with a banner: **"Editando la diapositiva de Laura Nataly"** and a "Volver" link.
- **What the teacher can change (D43):** everything inside the slide (text, shapes, drawings, images, embeds) and **add a slide** to the student's space (marked as added by the teacher). Reordering and deleting the student's slides stay with the student.
- **The student's version is kept (D44):** the first time a teacher saves changes to a slide (per editing session), a copy of the slide **as the student left it** is stored. The student sees on that slide **"Editada por el docente · hace 2 h"**, a **"Comparar"** view (their version and the teacher's, side by side) and **"Restaurar mi versión"** (one click; the teacher's version is kept as the "previous" one, so restoring can be undone).
- **Explaining the change (D45):** when the teacher leaves the editor after changing a slide, a small prompt offers **"Dejar una nota"** (M13 notes) pre-filled with "Hice estos cambios: …". Optional.
- **One editor at a time (D46):** whoever opens a slide in the editor holds it (heartbeat every 20 s, expires after 60 s without one). The other person sees **"Prof. Andrés está editando esta diapositiva"** and the editor opens read-only, switching to editable automatically when it's free. No silent overwrites.
- **Boards:** only on writable boards, like the student (archived / locked boards stay read-only for everyone) (D47).
- **Badges:** the student's card on the board shows a small "✎ Docente" badge while they haven't opened their slides since the teacher's changes; it disappears when they open the editor or the space page.

**What does NOT change**

- Students still edit only their own space; classmates still read only. Notes (F11 / M13), the presenter, backups and purge work as today. Autosave limits (idle 3 s, max 1 save / 15 s per slide) apply to the teacher too.

**How it's built**

- [x] Model: `SlideDoc.lastEditedBy: 'student' | 'teacher'`, `teacherEditedAt?`, `editing?: { uid, name, role, at }`; `slides/{slideId}/versions/{versionId}` (`content`, `files`, `assetIds`, `bytes`, `kind: 'student' | 'teacher'`, `createdAt`), at most 2 per slide (the student's last version and the teacher's previous one); `space.teacherEditsUnseen?`
- [x] Rules: the board teacher may update a student's slide (same validation, `lastEditedBy == 'teacher'`, board writable) and create a slide appended to `slideOrder` (space update by the teacher limited to `slideOrder` / `slideCount` appends + `teacherEditsUnseen`); versions: teacher creates `kind: 'student'` copies, the owner restores; the `editing` lock writable by the owner or the board teacher, only when free or stale
- [x] Worker: `POST /uploads/sign` also for the **board teacher** into a student's folder (writable board); registry `assets` create by the teacher for that student; Worker + integration tests
- [x] Editor: open for the board teacher (`EditorPage` guard), banner, lock (acquire / heartbeat / release / read-only when held), version snapshot before the first teacher save, "Dejar una nota" prompt
- [x] Student side: "Editada por el docente" + "Comparar" (two `SlidePreview`s) + "Restaurar mi versión" on the space page and in the editor sidebar; card badge + "seen" reset
- [x] Storage analysis (app + CLI): images referenced by versions count as used (a restore must find them); purge / student removal delete versions
- [x] Backup: versions are not included (current slides only); restore unchanged
- [x] es / en texts
- [x] Tests: unit (version rules: when to snapshot, which one to restore; lock staleness), rules (≈ 14: teacher edits / adds, can't reorder / delete, other teacher of another board can't, classmate can't, versions, lock), Worker (teacher signs into a student's folder, other teacher refused), e2e (teacher edits a slide → student sees "Editada por el docente", compares, restores; teacher adds a slide; lock: student open → teacher read-only, then editable when the student leaves; teacher image upload; note prompt) + the full existing suite
- [ ] **Your turn:** `npm run worker:deploy` · `npm run deploy:rules` · `npm run deploy` · acceptance test with a real student account

**Free-tier budget:** a version copy ≤ 900 KB per slide the teacher edits (Firestore 1 GiB: thousands of edits); lock heartbeats: 3 writes / minute while editing (≈ 90 per 30-min session); no extra Cloudinary use.

**Risks:** a student may feel their work was taken over (mitigated: "Editada por el docente", compare, one-click restore, optional note); two editors at once (the lock); large slides near the 900 KB limit can't keep a version → the teacher sees "Esta diapositiva es muy grande para guardar una copia; deja una nota en su lugar" and edits stay disabled.

### M16 — Teacher's class tools (F19–F22) — Loop 14

Tools for running a class session on the board: timed activities, quick votes, knowing who is ready, and breaks.

**1. Class timer and focus mode (F19)**

- **Teacher → "Reloj"** (board header): pick an activity name ("Lluvia de ideas"), a duration (presets 3 · 5 · 10 · 15 · 25 min or custom) and **Iniciar**. Controls: **Pausar / Reanudar · +1 min · Terminar**.
- **Everyone sees it live:** a sticky **countdown banner** on the board, the student's space page and the slide editor ("Lluvia de ideas · 07:42"), turning amber in the last minute and **"¡Tiempo!"** at zero (GSAP pulse, no sound for students).
- **Focus view** `/b/:boardId/focus` (teacher, for the projector): full-screen, huge countdown with a progress ring, the activity name and optional instructions; optional chime at the end (teacher's device only).
- One clock per board (activity **or** break), stored on the board document every page already listens to.

**2. Polls in each student's space (F20)**

- On a space: **"Crear encuesta"** — the student on their own space, the teacher on any. Question (≤ 200), **2–6 options** (≤ 80 each), single choice, optional **"Anónima"**.
- **Voting:** every classmate and the teacher's view show the poll on that space (and a "📊" badge on the card while it's open). One vote per student (both accounts of a person count once), **changeable while open**. Results update live as bars with counts and %.
- **Who voted:** counts are public to the class; names are visible to the teacher and the poll's author, unless the poll is anonymous (then nobody sees names in the app).
- The author or the teacher **closes / reopens / deletes** it. Up to 3 open polls per space.
- **Presenter:** when the student on screen has polls, the teacher opens them as an overlay with live results (class discussion).

**3. "Lista para presentar" + filters (F21)**

- The student marks **"Mis diapositivas están listas"** on their card dialog / editor (can unmark); the card shows "✓ Lista".
- Dashboard filters (teacher, combinable with the stage filter): **Listos (n) · Con diapositivas (n) · Sin diapositivas (n)**.
- Presenter: **"Presentar listos"** presents only ready students, in the board order.

**4. Break time (F22)**

- **Teacher → "Descanso"** with presets 5 · 10 · 15 min: everyone's banner says "Descanso · 08:12"; the focus view becomes a **break screen**: big countdown + a **Lottie animation that changes randomly** every 20 s (no repeats until all were shown), GSAP crossfade, "¡Volvemos!" at the end.
- **Animations:** a curated set of ~10 free LottieFiles animations (coffee, stretching, plants, music…) checked for the **Lottie Simple License** (free use, no attribution required), **self-hosted** in `public/lottie/` (no third-party requests, ~50–150 KB each, loaded only on the break screen); player: `@lottiefiles/dotlottie-web` (MIT), lazy chunk. With "reduce motion": a still frame.

**What does NOT change**

- Boards, cards, slides, stages, notes, teacher edits and presenting work as today; the clock and polls are new optional data.

**How it's built**

- [x] Model: `BoardDoc.clock?: { mode: 'activity' | 'break', label, instructions?, durationMs, startedAt, pausedAt?, remainingMs? } | null`; `SpaceDoc.readyToPresent?`, `readyAt?`, `openPolls?`; `spaces/{id}/polls/{pollId}` (`question`, `options[{id,label}]`, `anonymous`, `status`, `authorUid`, `authorName`, `authorRole`, `createdAt`); `polls/{pollId}/votes/{studentId | 'teacher-<uid>'}` (`optionId`, `voterName`, `votedAt`)
- [x] Clock logic (pure, unit-tested): remaining time with pause / resume / +1 min, server-time offset estimate, display format, last-minute and ended states
- [x] Rules: `clock` board teacher only (enum, ≤ 3 h, server time); `readyToPresent` by the owner; polls (author = owner or board teacher, ≤ 3 open, sizes), votes (members: doc id = my `studentId` from my member doc; teacher: `teacher-<uid>`), poll / board writable; names readable per the anonymity rule
- [x] UI: `ClassClockControls` (header), `ClockBanner` (board, space, editor), `FocusPage` (activity + break), `PollCard` / `CreatePollDialog` / results, presenter poll overlay, ready toggle + card badge + filters + "Presentar listos"
- [x] Break screen: `@lottiefiles/dotlottie-web`, curated `public/lottie/*.lottie` + `manifest.json` (name, license, source URL), random no-repeat rotation
- [x] Backup: polls not included (session data); `readyToPresent` not restored
- [x] es / en; privacy notice (votes)
- [x] Tests: unit (clock math, rotation, poll tallies), rules (≈ 15: clock teacher-only, students can't start it; one vote per student across accounts, change vote, closed poll, anonymous names; ready flag owner-only), e2e (teacher starts a 1-min timer → a student's banner counts down in the editor; pause / +1 min; focus view; break screen shows an animation and switches; student creates a poll, two classmates vote, results live, teacher closes; ready filter + "Presentar listos")
- [ ] **Your turn:** approve the animation set (I'll propose ~10 with previews and license links) · `npm run deploy:all` · try it in a real class

**Free-tier budget:** the clock = 1–4 board writes per activity, no extra reads (board doc already listened); polls: ~40 votes per poll, reads = votes × viewers of that space (small); Lottie files served by Hosting (≈ 1 MB total, cached).

**Risks:** clocks drift a few seconds between devices (mitigated by a server-time offset estimate); a poll in a space is per student, so a whole-class vote belongs to M10 class participation (Later / Loop 8); Lottie licenses must be checked one by one (the manifest records them).

### M17 — Canva and the embed options (F23) — Loop 15 ✅ code done 2026-10-31

Canva links already work when pasted (M14), but nothing in the dialog says so: "Insertar contenido" is an empty paste box, and Canva's own **Compartir → Insertar** gives an HTML code (`<iframe …>`) that the app rejects today.

**What people see**

- **"Insertar contenido" shows the options first:** a grid of service tiles (Canva first, then Google Slides, Figma, YouTube, Miro, Notion, Genially…). Picking one shows its 2–3 sharing steps (with a small screenshot for Canva) and the paste box; pasting still auto-detects any service.
- **Canva, every way students get a link:** a design link (`/design/…/view` or `/edit`), a `canva.link` short link, the **embed code** from "Insertar" (the app reads the `src` from the pasted `<iframe>` / `<div>` snippet) and **Canva websites** (`*.my.canva.site`).
- **Edit links:** an `/edit` link only works if the design is public; the preview checks it and says "Este enlace es de edición: en Canva usa Compartir → Insertar o Compartir → Ver solo" instead of a blank frame.
- The **"¿Cómo insertar…?" guide** gets a Canva section with the screenshots.

**How it's built**

- [x] `embeds.ts`: parse pasted HTML snippets (only the `src` / `href` of the first iframe / link, never the HTML itself) **with their shape**, `*.my.canva.site` (recognized, not framable: Canva refuses frames); unit tests per link shape. The edit-link hint was dropped: edit links play once shared (checked with real designs)
- [x] `InsertEmbedDialog`: service tiles + steps, then paste; es / en texts; guide page section
- [x] Worker `POST /links/canva` (added): Canva's oEmbed says whether a design is shared, its size and title → "todavía no está compartido" warning and the real shape (portrait posters, A4)
- [x] Real check: public Canva designs play from `/view?embed` (also edit links converted), in the app's sandbox; `/view` and `/watch` alone stay blank; Canva sites refuse frames
- [ ] **Your turn:** `npm run worker:deploy` · `npm run update:web` · acceptance test with a real Canva account ([report](reports/loop-15-m17.md))
- [x] Tests: unit (every Canva link shape, snippets, rejects other HTML), Worker (shared / private / unknown / refused), e2e (pick Canva → paste embed code → portrait preview → insert; not shared; Canva site; without the Worker)

**Risks:** Canva changes its embed URLs from time to time (the unit tests list every known shape; the "¿No carga?" fallback stays).

### M18 — Student emails and attendance (F24, F25) — Loop 16

Two teacher tools on the roster the app already has (`boards/{id}/students`, each with its emails and group).

**1. Students' emails (F24)**

- **Teacher → Estudiantes → "Correos"**: choose who (everyone · a group · a stage · ready / not ready · absent on a date · picked by hand), then:
  - **"Copiar correos"** (comma-separated, ready to paste in Gmail / Outlook "CCO"),
  - **"Escribir correo"** (opens the teacher's mail app with everyone in **BCC**, split in batches when the list is too long for a `mailto:` link),
  - **"Descargar CSV"** (name, email, group).
- **One email per student** by default (D63), with an option "todos sus correos".
- **No emails are sent by the app** (no server, no third-party mail service, free tier): the teacher sends from their own account.

**2. Attendance by date (F25)**

- **Teacher → "Asistencia"** (board header and teacher board page): pick a date (today by default), the roster appears with one-tap states **Presente · Tarde · Ausente · Excusa**, an optional note per student, **"Todos presentes"** to start from, and an optional topic for the class ("Sesión 4 · Prototipos").
- **History arranged by date:** a list of class dates (newest first) with counts (✓ 15 · ⏱ 1 · ✗ 1), and a **table** students × dates with each student's % attendance; click a cell to fix it; filter by group.
- **Export:** CSV of the table (for the university's records); attendance goes into the board backup.
- **Students** see only their own attendance (dates and states) on their space page (D67).
- Optional later: student self check-in with a code on the projector (D66).

**How it's built**

- [ ] Model: `boards/{id}/attendance/{yyyy-mm-dd}` (`date`, `topic`, `marks: { [studentId]: { status, note? } }`, `takenBy`, `updatedAt`) — one doc per class date; `boards/{id}/attendanceByStudent/{studentId}` (`dates: { [date]: status }`) for the student's own view, written in the same batch
- [ ] Rules: attendance docs board teacher only (status enum, note ≤ 200, date format); `attendanceByStudent/{studentId}` readable by that student (member doc check), writable by the teacher only
- [ ] Pure logic (unit-tested): email list from the filters (dedupe, one per person), `mailto:` batching, CSV escaping, attendance % and counts
- [ ] UI: `EmailsDialog`, `AttendancePage` (`/teacher/boards/:id/attendance`, date list + take / edit + table), student's own attendance on the space page
- [ ] Backup / restore: attendance included; student removal / purge deletes their marks
- [ ] es / en; privacy page: attendance is stored and who sees it
- [ ] Tests: unit, rules (≈ 10: teacher only, student reads only their own summary, other board's teacher refused), e2e (copy emails of a group; take attendance, "Todos presentes", mark one late, see it in the table and as that student; CSV)

**Free-tier budget:** one class = 1 + N writes (≈ 20 for 17 students); the table reads one doc per date (≈ 30 per term); emails are local (no reads beyond the roster).

**Risks:** `mailto:` length limits differ per mail app (batches of ~40 addresses; "Copiar" always works); emails are personal data (Ley 1581): only the board's teachers see them, as today.

### M19 — "Novedades": announcements and notifications (F26) — Loop 18

Students don't notice new features (embeds, polls, ready to present…). The app tells them, once, and keeps a summary until they clear it.

**What people see**

- **"Novedades" window:** after a release with news for them, a student's next visit opens a modal: title, a short explanation, a picture or Lottie animation and a **"Probar"** button that takes them to the feature. Several news items are pages in the same window ("1 de 3"); **"Entendido"** or **"Ver más tarde"**. At most one window per visit.
- **Notifications (🔔 in the header):** a badge with the number of unread items; the panel lists every news item as a **one-line summary** with its date; they **stay until the student clears them** ("Limpiar" per item or "Limpiar todo"). Opening the panel marks them read (badge off) but doesn't clear them.
- **Teacher announcements** (D60): the teacher writes a short message to their board ("Mañana traigan su prototipo"), optional link; students get it in the modal (if "importante") and in the bell.
- Separate news for students and teachers (each sees what applies to them).

**How it's built**

- [ ] App news in code: `src/features/news/releases.ts` (`id`, `date`, `audience`, es / en title / summary / body, image or Lottie, `try` route) — written with each release, no database writes
- [ ] Per user state: `users/{uid}.news = { seen: string[], cleared: string[] }` (trimmed to the last 50 ids)
- [ ] Teacher announcements: `boards/{id}/announcements/{id}` (`title`, `body`, `link?`, `important`, `createdAt`, `expiresAt?`); rules: teacher writes, members read
- [ ] UI: `NewsModal`, `NotificationBell` (board header + app header), "Escribir anuncio" for the teacher
- [ ] Tests: unit (which news a user sees, ordering, trimming), rules, e2e (a new release shows the modal once; bell count; clear one / all; teacher announcement reaches a student)

**Free-tier budget:** reading the user doc already happens; 1 write when the modal closes and 1 per "Limpiar"; announcements: one listener per board page.

### M20 — Feedback messages and interaction animations (F27) — Loop 19

Encouraging feedback when students make progress, and small animations that make every interaction feel alive.

**What people see**

- **Feedback messages (ánimo):** a friendly message with an emoji and a small animation at meaningful moments, e.g. first slide ("¡Primera diapositiva! 🎉"), every 5 slides, slides marked ready, stage changed ("¡Pasaste a Prototipar! 🛠"), profile photo added, first vote, first embed, and when the teacher edited or left a note ("Tu docente te dejó una nota 💬"). Several phrasings per moment, chosen at random, es / en.
- **Celebrations for milestones only** (first slide, marked ready, stage change): a short confetti burst; everything else is a toast with a bounce.
- **Interaction animations:** buttons press, cards lift on hover, a new slide flies into the list, deleted items shrink away, poll bars grow, the "Lista" check draws itself, dialogs pop in, toasts bounce, the bell shakes once with news.
- **Not a competition** (D56): no points, rankings or leaderboards; the messages compare a student only with themselves.
- **Calm by design:** at most one celebration every 30 s; all motion off with "reduce motion"; a **"Mensajes de ánimo"** switch on `/me`.

**How it's built**

- [ ] `src/features/fun/`: `celebrate(event)` (pure part: which message, cooldown, milestone detection; unit-tested), message pools in the locales, toast + confetti (`canvas-confetti`, ISC, ~5 KB, lazy) or GSAP-only (D58)
- [ ] Hook the events where they already happen (slide add, ready toggle, stage change, vote, embed insert, photo upload, note read); "first time" flags in `users/{uid}.milestones` (one write the first time only)
- [ ] Shared motion utilities (`lib/gsap`): press, lift, enter / exit, number count-up; applied to buttons, cards, slide list, polls, dialogs, toasts
- [ ] Preference on `/me`; "reduce motion" respected everywhere
- [ ] Tests: unit (event → message, cooldown, once-only milestones), e2e (first slide shows the message once; the switch turns it off; with reduced motion no confetti)

**Risks:** too much celebration feels childish in a diplomado (subtle tone, cooldown, switch); performance on old laptops (lazy confetti, CSS transforms only).

### M21 — Status, profile decorations and board styles (F28–F30) — Loop 17

Personality for people and boards: a status like WhatsApp / Slack, decorations on the profile, and more board styles, including seasonal ones like **Navidad**.

**1. Status (F28)** — students and teachers

- On `/me` and from the user menu: **"Estado"** = an emoji + a short text (≤ 60 characters, no links), e.g. "🛠 Prototipando", "🙋 Necesito ayuda", "🎧 Concentrado", "🤒 Incapacitado", or anything custom; **expires** after 1 h · today · this week · never.
- **Where it shows:** next to the name on the student's card, their space page and the user menu; the teacher's status next to "Docente: Andrés Bedoya" in the board header ("🏖 De vacaciones hasta el lunes").
- **"Necesito ayuda"** (D72): the teacher sees "🙋 3 piden ayuda" in the board header and can filter those cards.
- The teacher can clear a student's status on their board (moderation, D71).

**2. Profile decorations (F29)**

- **Card banner:** a color, gradient or pattern strip at the top of the student's card and space page (a set of ~12, like the board backgrounds).
- **Sticker:** one emoji or small illustrated sticker next to the name (🚀 🎨 🌱 ☕ 🐱 …).
- **Seasonal accessories** (only while the board uses a seasonal style): e.g. a Santa hat or a scarf on the photo in Navidad, a witch hat in Halloween; each person can turn theirs off.
- **Rule (D73):** decorations never cover or replace the **stage ring** (M11) or the **#DOCENTE ring** (M12); they sit around them (banner, sticker beside the name, hat on top).
- Saved once per person, shown on every board (like the photo).

**3. Board styles (F30)** — "Personalizar tablero" gets a **Estilos** tab

- A **style** is a full look in one click: background + pattern + card shape and shadow + fonts + header treatment, plus an optional **ambient animation**. The teacher can still change any detail afterwards (today's options stay).
- **Everyday styles:** Pizarra (chalkboard), Cuaderno (lined paper), Papel kraft, Neón, Minimal, Retro, Acuarela, Blueprint.
- **Seasonal styles:**
  - **Navidad:** red / green / gold, snow falling slowly over the board, a string of lights along the header that twinkles, a pine-and-ornaments pattern, optional Santa hats on the photos, "¡Feliz Navidad!" next to the title.
  - **Halloween:** night purple / orange, bats and moon, pumpkin pattern.
  - **Año nuevo:** dark with gold, fireworks once when the board opens.
  - **Amor y amistad** (September in Colombia): hearts and pastel tones.
- **Scheduling:** "usar desde … hasta …" so a seasonal style switches on and back to the usual style by itself (e.g. Dec 1 → Jan 6).
- **Animations:** canvas particles (snow, hearts, fireworks) on a lazy chunk, paused when the tab is hidden, capped particles, off with "reduce motion", and an "animación de fondo" switch for the teacher; cards stay readable (contrast checked per style).

**How it's built**

- [ ] Model: `users/{uid}.status = { emoji, text, expiresAt | null, updatedAt }`, `users/{uid}.decor = { banner, sticker, seasonalAccessories }`; mirrored to the cards as `space.ownerStatus` / `ownerDecor` (like `ownerName` today) and to `board.teacherProfiles`; `BoardDoc.look.style?`, `look.ambient?`, `look.schedule? = { style, from, to }`
- [ ] Styles as data (`src/features/boards/styles.ts`): tokens per style (colors, pattern, card, fonts, header), checked by a unit test for text contrast
- [ ] Ambient layer: `AmbientEffects` (snow, hearts, fireworks, lights garland), lazy, one canvas, `requestAnimationFrame` paused when hidden
- [ ] Rules: status text ≤ 60, no `http`; decor ids from the allowed lists; the board teacher can clear `ownerStatus` on their board's spaces; look fields validated
- [ ] UI: status editor (presets + custom + expiry) in `/me` and the user menu; decor picker in `/me`; status and decor on cards, space page, header; "Estilos" tab with previews; schedule fields; "piden ayuda" counter + filter
- [ ] Backup: board style included; personal status / decor not (they belong to the person)
- [ ] es / en
- [ ] Tests: unit (expiry, schedule → active style by date, contrast), rules (≈ 8), e2e (set a status → classmates see it on the card; it expires; the teacher clears one; pick Navidad → snow and lights, hats on photos, "reduce motion" → none; schedule switches back)

**Free-tier budget:** status / decor = 1 write per change + the mirror writes to that person's cards (one per board); styles are code and CSS; seasonal art self-hosted SVG (≈ 100 KB total).

**Risks:** status text visible to the whole class (≤ 60 characters, no links, teacher can clear); heavy animations on old laptops (particle cap, lazy, switch); a style unreadable with some content (contrast test, cards keep a solid background).

### M9 — More teachers (when needed)

- [ ] `/admin/staff` screen, co-teachers, admin sees all boards

### Later

- Comments and reactions on cards (like Padlet); reactions (👍 ❤️ 💡) on class contributions
- Class participation: free placement of cards on the slide, anonymous mode, attachments (PDF), export a class to PDF
- Slide templates, board themes
- Export a space to PDF
- Self-service email linking (one-time code from account A, entered in account B)

---

## M4 walkthrough: Cloudflare Worker + Cloudinary (baby steps)

How we'll do it in pair programming: **one small step at a time**. Each step says who types, what to run, and how we check it worked. We commit after each ✅.

> **Order note:** Steps 1–6 don't depend on anything else and can be done now. Step 7 onwards needs Google login (M1) to get a real ID token.

### Step 1 — Create the free accounts (you, ~10 min)

- [x] **Cloudflare** (2026-10-26): free plan, 100,000 requests/day. Subdomain **`paradisserossa.workers.dev`**, so the Worker will live at **`https://media-api.paradisserossa.workers.dev`**.
- [x] **Cloudinary** (2026-10-26): free plan. Cloud name **`syqkgwws`**. The API key is in `wrangler.jsonc` (public); the API secret goes only in `.dev.vars` and Cloudflare secrets (Step 6).

> **Lesson learned:** Cloudinary's dashboard shows a Node.js quickstart (`import { v2 as cloudinary } from 'cloudinary'` + `api_secret`). That code is for **servers only**. It was removed from `src/lib/cloudinary.ts`, and the `cloudinary` package was uninstalled from the app. In the browser we only build URLs; the secret lives in the Worker.

✅ Check: you can see both dashboards. **Never paste the API Secret in the chat or in any committed file.**

> **Don't use "Create application" in the Cloudflare dashboard.** That creates a Worker whose code lives in Cloudflare's web editor. We create it from the terminal instead, so the code lives **in this repo** (versioned, reviewed, deployed with one command). The dashboard is only for watching usage, logs and secrets.

### Step 2 ✅ — Create the Worker project (you type in the VS Code terminal, I guide)

From the **project root** (`D:\universidad\diplomado_pbl`):

```bash
npm create cloudflare@latest -- services/media-api
```

The wizard asks a few questions. Answer:

| Question                                      | Answer                                         |
| --------------------------------------------- | ---------------------------------------------- |
| Ok to proceed? (installs `create-cloudflare`) | `y`                                            |
| What would you like to start with?            | **Hello World example**                        |
| Which template?                               | **Worker only**                                |
| Which language?                               | **TypeScript**                                 |
| Do you want to use git for version control?   | **No** (the project is already a git repo)     |
| Do you want to deploy your application?       | **No** (we deploy in Step 4, after logging in) |

This creates `services/media-api/` with `src/index.ts`, `wrangler.jsonc`, `tsconfig.json`, its own `package.json` and a `.gitignore` that already ignores `.dev.vars` and `.wrangler/`.

Then I adjust the root project so it doesn't trip over the new folder:

- `eslint.config.js` → add `services` to `globalIgnores` (the Worker has its own types and runtime)
- `.prettierignore` → add `services/media-api/.wrangler`
- `wrangler.jsonc` → confirm `"name": "media-api"`

✅ Check: `git status` shows only `services/media-api/…` plus those two config edits; `npm run lint` still passes. **Commit:** `chore(media-api): scaffold Cloudflare Worker`.

### Step 3 ✅ — Run it locally (you type)

```bash
cd services/media-api
npx wrangler dev
```

Open `http://localhost:8787`.

✅ Check: you see "Hello World!". Stop it with `x` or `Ctrl+C`.

### Step 4 ✅ — Log in and first deploy (you type)

```bash
npx wrangler login      # opens the browser → log in with the Cloudflare account (Paradisserossa@g…) → Allow
npx wrangler whoami     # confirms the account + Account ID 6887552c…
npx wrangler deploy
```

✅ Check: the output prints `https://media-api.paradisserossa.workers.dev`. Open it and see "Hello World!" on the internet; the Worker now also appears in the dashboard under **Workers & Pages**. **Commit** if anything changed.

### Step 5 ✅ — Health route + CORS (I write, you review)

- Replace Hello World with a tiny router: `GET /health` → `{ ok: true }`.
- Add CORS for the allowed origins: `http://localhost:5173` and the Firebase Hosting domains `diplomado-fc679.web.app` / `.firebaseapp.com`.
- Add `VITE_MEDIA_API_URL` to `.env.local` / `.env.example`, plus a typed `lib/media-api.ts` client in the app.

Done:

- `services/media-api/src/index.ts`: route table, `GET /health`, CORS from `ALLOWED_ORIGINS` (other origins → `403`), `404` for unknown routes
- `services/media-api/test/index.spec.ts`: 4 tests (health, 404, allowed origin, rejected origin) — `npm test` in `services/media-api`
- App: `VITE_MEDIA_API_URL` + `VITE_CLOUDINARY_CLOUD_NAME` (validated in `lib/env.ts`), `lib/media-api.ts` (typed client), `lib/cloudinary.ts` (`ImageRef` type + `imageUrl()` builder, no SDK)

✅ Check: tests pass; from the app, `mediaApi.health()` answers `ok` (we wire a button in M1 when the app has a layout).

### Step 6 ✅ — Configuration and secrets (you type the secret)

- **Public values** go in `wrangler.jsonc` → `vars`: `FIREBASE_PROJECT_ID`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `ALLOWED_ORIGINS`.
- **The secret, locally:** put it in `services/media-api/.dev.vars` (git-ignored): `CLOUDINARY_API_SECRET=…`
- **The secret, in production:**

```bash
npx wrangler secret put CLOUDINARY_API_SECRET   # paste it when asked; it's stored encrypted in Cloudflare
```

Done by me: `vars` in `wrangler.jsonc`, `.dev.vars.example`, an empty `.dev.vars` (git-ignored), regenerated `Env` types (`npm run cf-typegen`).

Your part:

- [x] Open `services/media-api/.dev.vars` and paste the secret after `CLOUDINARY_API_SECRET=`
- [x] `npx wrangler secret put CLOUDINARY_API_SECRET` (paste it when asked)
- [x] `npx wrangler deploy` — verified 2026-10-26: `https://media-api.paradisserossa.workers.dev/health` → `{"ok":true,"config":"ok"}`

✅ Check: `http://localhost:8787/health` (with `npx wrangler dev`) and `https://media-api.paradisserossa.workers.dev/health` both report `config: ok`. The Worker confirms the secret exists without ever printing it.

### Step 7 ✅ — Who is calling? Verify the Firebase ID token (I write, we test together)

- The app sends `Authorization: Bearer <idToken>`.
- The Worker verifies it with `jose` against Google's public keys. It checks issuer `https://securetoken.google.com/diplomado-fc679`, audience `diplomado-fc679`, expiry and `email_verified`.
- New route: `GET /me` → `{ uid, email }`.

✅ Check: signed in → `/me` shows your email. Signed out or with a fake token → `401`.

### Step 8 ✅ — May this user upload here? (I write, you review)

- Helper `firestoreGet(path, idToken)`: it calls the Firestore REST API **with the user's own token**, so the Security Rules decide, exactly as in the app.
- An upload for `{ boardId, studentId }` is allowed only if `members/{uid}.studentId == studentId`, or if the user is a board teacher.

✅ Check: your own space → allowed; another student's space → `403`.

### Step 9 ✅ — Sign uploads (I write, we test together)

- `POST /uploads/sign` → creates an `assetId`, builds `public_id = pbl/{env}/{boardId}/{studentId}/{assetId}` plus a timestamp and tags, and signs them. The signature is SHA-1 of the sorted parameters + the API secret, using `crypto.subtle`, which is built into Workers.
- It returns `{ signature, timestamp, apiKey, publicId, ... }`.
- In the app: `features/assets/upload.ts` prepares the image → asks for the signature → uploads directly to Cloudinary with a progress bar.

✅ Check: upload a test image from a dev page. It appears in the Cloudinary Media Library under `pbl/dev/...`. Changing any signed field → Cloudinary rejects it.

### Step 10 — Deploy and connect production (you type)

```bash
npx wrangler deploy
```

✅ Check: the production app uploads through `https://media-api.paradisserossa.workers.dev`.

### Step 11 ✅ — Delete, purge, usage (M7, Loop 6)

`POST /assets/delete` (board teacher only, ids must be under `pbl/{env}/{boardId}/`), `POST /boards/:id/purge` (archived board only) and `GET /usage` all follow the same pattern as Step 9.

### Step 12 ✅ — Scripts and docs

- Root `package.json` scripts: `worker:dev`, `worker:deploy`.
- README section: "media-api — local setup".

---

## Review findings (rev. 6)

Full review of the plan for consistency, free-tier limits and security, done before starting M1. All fixes are already applied above.

| #   | Finding                                                                                                            | Risk                                   | Fix                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| R1  | Autosave every ~1.5 s could reach ~12K writes/day with a full class drawing at the same time                       | 🔴 hit the 20K writes/day limit        | Save after 3 s idle, max 1 save / 15 s per slide, plus on slide switch / tab hide                                 |
| R2  | Updating the space document on every slide save makes every open dashboard re-read it                              | 🔴 hit the 50K reads/day limit         | Slide saves don't touch the space doc; `updatedAt` at most every 10 min                                           |
| R3  | Purge: the Worker uses the user's token, but the rules denied deleting boards                                      | 🟠 purge from the dashboard would fail | Board teacher may delete an **archived** board; the browser deletes Firestore docs, the Worker deletes Cloudinary |
| R4  | App Check with reCAPTCHA **Enterprise** requires a Google Cloud billing account                                    | 🟠 breaks "100% free"                  | Use the **reCAPTCHA v3** provider                                                                                 |
| R5  | The collection-group query on `studentEmails` needs an index exemption and a matching rule                         | 🟡 auto-join fails at runtime          | Added to "Joining a board"                                                                                        |
| R6  | Students reading the nonexistent `staffEmails/{email}` doc get a permission error if the rule uses `resource.data` | 🟡 login error for students            | Rule checks the path, not the document                                                                            |
| R7  | A teacher with two emails is only teacher of boards that list that email                                           | 🟡 confusion                           | Use your Gmail in v1; `staff add` also updates your boards                                                        |
| R8  | The Worker needs to know `dev` vs `prod` for Cloudinary folders                                                    | 🟢                                     | Derived from the request origin                                                                                   |
| R9  | Not every site can be embedded in Excalidraw by default                                                            | 🟢                                     | Extend with `validateEmbeddable`, verify in M5                                                                    |
| R10 | The app stores student names and emails (personal data)                                                            | 🟢                                     | Privacy notice on the login page (M8)                                                                             |

### Ready to start M1? Remaining setup checklist

| #   | Task                                                                                                                | Who | Status          |
| --- | ------------------------------------------------------------------------------------------------------------------- | --- | --------------- |
| 1   | Enable Google sign-in in Firebase                                                                                   | you | ✅              |
| 2   | Cloudinary secret in `.dev.vars` + `wrangler secret put` + `wrangler deploy` (Step 6)                               | you | ✅ `config: ok` |
| 3   | Firebase service account key → `secrets/service-account.json` ([how](#how-to-get-the-firebase-service-account-key)) | you | ✅              |
| 4   | Everything else (template, Worker, Cloudinary URL builder, env validation)                                          | —   | ✅              |

### How to get the Firebase service account key

**What it is:** a private key file (JSON) that lets the **admin CLI** on your computer act as the project's administrator. The CLI needs it to write the first teacher (your Gmail) to `staffEmails`, which the browser can never do because the rules block it. Later it is also used for cleanup and backups.

**Cost:** free. It's part of every Firebase project on the Spark plan; no billing is involved.

**Treat it like a password:** whoever has this file controls your database. It stays in `secrets/` (already git-ignored), and you never paste its content in the chat or send it to anyone.

**Steps (you, ~2 minutes):**

1. Open **Firebase console → ⚙️ Configuración del proyecto → Cuentas de servicio**
   (direct link: `https://console.firebase.google.com/project/diplomado-fc679/settings/serviceaccounts/adminsdk`).
2. On the **SDK de Firebase Admin** tab, leave **Node.js** selected.
3. Click **Generar nueva clave privada** → confirm **Generar clave**. A file like `diplomado-fc679-firebase-adminsdk-xxxxx.json` downloads.
4. In the project root, create a folder named **`secrets`** (next to `src`).
5. Move the downloaded file into it and **rename** it to **`service-account.json`**.
   Result: `D:\universidad\diplomado_pbl\secrets\service-account.json`
6. Delete the copy left in your Downloads folder.

✅ **Check (I'll run it):** `git status` doesn't show `secrets/`, and `git check-ignore secrets/service-account.json` confirms it's ignored. I'll only check that the file exists and that its `project_id` is `diplomado-fc679`; I won't print the key.

**If something goes wrong:**

- _"Key creation is disabled by an organization policy"_: tell me. We'd use `gcloud auth application-default login` instead (also free).
- _The file leaked_ (committed, shared, lost laptop): Google Cloud console → **IAM → Cuentas de servicio** → `firebase-adminsdk-…` → **Claves** → delete that key, then generate a new one. The old one stops working immediately.

---

## Decisions (all answered ✅)

D12–D17 (class participation, M10) are **proposed** (⏳): confirm or change them before Loop 8. **D55 confirmed 2026-10-31 (Loop 15). D56–D77 (M18–M21) are proposed (⏳)**: confirm or change them before Loop 16. D18–D54 confirmed 2026-10-31. D18–D24 (M11) and D25–D35 (M12, M13) confirmed 2026-10-31. D18–D24 (M11) confirmed 2026-10-31.

| #   | Decision                | Answer                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Image storage           | **Cloudinary**, signed uploads via the media-api                                                                                                                                                                                                                                                                                |
| D2  | Slide editor            | **Excalidraw** canvas per slide (MIT, free, no key, no watermark)                                                                                                                                                                                                                                                               |
| D3  | Text                    | **Excalidraw's text tool** (font, size, color, align; no inline bold/italic)                                                                                                                                                                                                                                                    |
| D4  | Teacher / admin roles   | **Recognized by email**: `staffEmails/{email}` (you = admin via CLI); everyone else signs in as a student                                                                                                                                                                                                                       |
| D5  | Classmates' spaces      | **Visible read-only**                                                                                                                                                                                                                                                                                                           |
| D6  | Joining a board         | **A: teacher adds students (auto-join) + B: invite link**                                                                                                                                                                                                                                                                       |
| D7  | Language                | **Spanish (default) + English**                                                                                                                                                                                                                                                                                                 |
| D8  | Import / export         | **JSON** + quick-add paste box                                                                                                                                                                                                                                                                                                  |
| D9  | Students with 2 emails  | **Person + email index**                                                                                                                                                                                                                                                                                                        |
| D10 | First admin             | **Your personal Gmail**, via `npm run admin -- setup` from this console                                                                                                                                                                                                                                                         |
| D11 | Removing old data       | **Teacher dashboard (Storage page) + local CLI**, via the media-api                                                                                                                                                                                                                                                             |
| Q1  | Free canvas             | **Excalidraw** (the whole project must be free, academic use)                                                                                                                                                                                                                                                                   |
| Q2  | Cloudflare Worker       | **Yes**, built step by step (M4 walkthrough)                                                                                                                                                                                                                                                                                    |
| Q3  | Old boards              | **Auto-move to "Proyectos archivados" after 90 days without use** (configurable); purge is manual, after a backup                                                                                                                                                                                                               |
| Q4  | Default language        | **Spanish**                                                                                                                                                                                                                                                                                                                     |
| Q5  | Admin email             | **Your personal Gmail**                                                                                                                                                                                                                                                                                                         |
| D12 | ⏳ Participation format | **Proposed:** each participation slide = the teacher's prompt + a grid of contribution cards (not a shared Excalidraw canvas, which would overwrite people's work)                                                                                                                                                              |
| D13 | ⏳ Limits               | **Proposed:** 1–5 slides per class; up to 3 contributions per student per slide; text ≤ 1000 + 1 picture                                                                                                                                                                                                                        |
| D14 | ⏳ Visibility           | **Proposed:** the whole class sees every contribution with the author's name (anonymous mode: Later)                                                                                                                                                                                                                            |
| D15 | ⏳ Teacher powers       | **Proposed:** edit / delete any contribution (marked "editado por el docente"), open / close each class; a removed student's contributions stay                                                                                                                                                                                 |
| D16 | ⏳ Backup               | **Proposed:** classes and contributions are part of the board backup (v2) and restored with it                                                                                                                                                                                                                                  |
| D17 | ⏳ Where it lives       | **Proposed:** a "Clases" section in each board (not a separate board), so members and rules are reused                                                                                                                                                                                                                          |
| D18 | Photo options           | Google photo · uploaded photo · initials (on `/me`); the uploaded photo is cropped square in the browser                                                                                                                                                                                                                        |
| D19 | Photo storage           | one fixed Cloudinary file per person (`users/{uid}/avatar`, overwritten on change), signed by the Worker only for staff or board members                                                                                                                                                                                        |
| D20 | Stage scope             | the stage is **per board** (on the student's space), not per person, because each course is a different project                                                                                                                                                                                                                 |
| D21 | Stage list              | default = Design Thinking: Empatizar · Definir · Idear · Prototipar · Evaluar + **Vitrineando** (here to learn / no project); teacher can edit per board                                                                                                                                                                        |
| D22 | Look                    | colored ring; on large avatars the label curved along the ring like #OPENTOWORK (#EMPATIZANDO … #VITRINEANDO); Vitrineando = dashed ring + eye icon                                                                                                                                                                             |
| D23 | Who sets the stage      | the student, and the teacher too (marked "puesta por el docente"); teacher gets a summary + filter on the dashboard                                                                                                                                                                                                             |
| D24 | Order                   | run **Loop 9 (M11) before Loop 8 (M10)**: smaller, and class contributions then show the photo + ring from the start                                                                                                                                                                                                            |
| D25 | Where                   | a "Personalizar tablero" side panel on the board itself with live preview (not a separate settings page)                                                                                                                                                                                                                        |
| D26 | Backgrounds             | 12 presets (colors + soft gradients) × dots / grid / none, readable text guaranteed; custom background images: Later (credits, contrast)                                                                                                                                                                                        |
| D27 | Layouts                 | Muro · Cuadrícula · Lista · Por etapa · Por grupo, plus order; chosen by the teacher, everyone sees the same (no per-student choice in v1)                                                                                                                                                                                      |
| D28 | Logo                    | one uploaded image per board (teacher only), shown in the header, the students' board card and the presenter                                                                                                                                                                                                                    |
| D29 | Sticky header           | on by default (teacher can turn it off), shrinks while scrolling                                                                                                                                                                                                                                                                |
| D30 | Teacher distinction     | "#DOCENTE" ring (dark + gold) with a cap badge wherever a teacher's photo appears, and the board's teachers in its header                                                                                                                                                                                                       |
| D31 | Animations              | GSAP Flip / ScrollTrigger as listed in M12; always off with "reduce motion"; no per-board switch                                                                                                                                                                                                                                |
| D32 | Order                   | run **Loop 10 (M12) next**, then Loop 8 (M10); M12 doesn't depend on M10, and M10 then reuses the #DOCENTE ring                                                                                                                                                                                                                 |
| D33 | Notes in the presenter  | teacher only; side panel (key N) on the slide on screen, same notes as F11 (private to the teacher and that student)                                                                                                                                                                                                            |
| D34 | Projector safety        | panel closed by default + "Visible en pantalla" label + optional "Vista del docente" second window synced by BroadcastChannel                                                                                                                                                                                                   |
| D35 | When                    | build M13 **inside Loop 10** (both touch the presenter and the teacher's tools)                                                                                                                                                                                                                                                 |
| D36 | Services                | the 13 services in the M14 table (Google Slides / Docs / Sheets / Forms / Drive, YouTube, Vimeo, Loom, Figma, Canva, Miro, Notion, Genially / Prezi / Padlet); anything else stays a link                                                                                                                                       |
| D37 | Fix old slides          | rewrite known links when a slide is shown (no migration, no edits to students' slides)                                                                                                                                                                                                                                          |
| D38 | Text links              | hint + "Convertir" in the editor (student decides); links in text clickable in viewer / presenter                                                                                                                                                                                                                               |
| D39 | Short links             | the Worker resolves redirects for an allow-list of shorteners only (canva.link, forms.gle, youtu.be, figma short links)                                                                                                                                                                                                         |
| D40 | Loading / fallback      | shimmer + spinner overlay, "¿No carga?" after 12 s with the service's fix, "↗ Abrir" always; presenter pre-loads the next slide's embeds                                                                                                                                                                                        |
| D41 | Help                    | a "¿Cómo insertar…?" guide page (es / en) per service, linked from the editor and the fallback                                                                                                                                                                                                                                  |
| D42 | Who                     | the board's teacher(s) only; other teachers and classmates never edit a student's slides                                                                                                                                                                                                                                        |
| D43 | What                    | edit everything inside existing slides + add a slide; reorder / delete stay with the student                                                                                                                                                                                                                                    |
| D44 | Student's control       | keep the student's version before the teacher's first change; "Editada por el docente", compare and one-click restore (undoable)                                                                                                                                                                                                |
| D45 | Explain                 | after editing, an optional "Dejar una nota" prompt (M13 notes)                                                                                                                                                                                                                                                                  |
| D46 | Simultaneous editing    | one editor per slide (lock with heartbeat, 60 s expiry); the other sees it read-only with who is editing                                                                                                                                                                                                                        |
| D47 | Order                   | run **Loop 13 (M15) next**, before Loop 12 (embeds) and Loop 8 (class participation): it's what you need now                                                                                                                                                                                                                    |
| D48 | Class clock             | one shared clock per board (activity or break), started / paused / stopped by the teacher, live for everyone, stored on the board document                                                                                                                                                                                      |
| D49 | Where students see it   | a countdown banner on the board, space page and slide editor; "¡Tiempo!" visually, no sound for students; focus view (and optional chime) for the teacher's projector                                                                                                                                                           |
| D50 | Polls                   | inside each student's space (student on their own, teacher on any); 2–6 options, single choice, vote changeable while open, ≤ 3 open per space; teacher can show results while presenting                                                                                                                                       |
| D51 | Poll privacy            | counts public to the class; voter names only for the teacher and the poll author; "Anónima" hides names from everyone in the app                                                                                                                                                                                                |
| D52 | Ready to present        | the student marks "lista"; filters Listos / Con diapositivas / Sin diapositivas; "Presentar listos" in the presenter                                                                                                                                                                                                            |
| D53 | Break animations        | ~10 free LottieFiles animations (Lottie Simple License checked), self-hosted, random no-repeat every 20 s, still frame with "reduce motion"; you approve the set                                                                                                                                                                |
| D54 | Order                   | run **Loop 14 (M16) next**, then Loop 8 (M10 class participation, which would add whole-class polls)                                                                                                                                                                                                                            |
| D55 | Canva / embed options   | ✅ service tiles in "Insertar contenido" (Canva first); Canva links, `canva.link` and the "Insertar" embed code, in the design's real shape; "not shared yet" warning via Canva oEmbed (Worker); Canva websites explained (they refuse frames); no edit-link warning (edit links work once shared)                              |
| D56 | Gamification style      | ⏳ encouraging messages + celebrations only; **no points, badges ranking or leaderboards** (students compare only with themselves)                                                                                                                                                                                              |
| D57 | Moments                 | ⏳ first slide, every 5 slides, marked ready, stage change, photo added, first vote, first embed, teacher note / edit received                                                                                                                                                                                                  |
| D58 | Animation library       | ⏳ GSAP (already in the app) for micro-interactions + `canvas-confetti` (ISC, ~5 KB, lazy) for milestone bursts; all off with "reduce motion"; a switch on `/me`                                                                                                                                                                |
| D59 | News source             | ⏳ app news written in code with each release (no database writes), separate for students and teachers                                                                                                                                                                                                                          |
| D60 | Teacher announcements   | ⏳ yes: the teacher writes short messages to their board; "importante" ones open the modal, all go to the bell                                                                                                                                                                                                                  |
| D61 | Modal                   | ⏳ once per news item, at most one window per visit (several items as pages), "Probar" button to the feature, "Ver más tarde" keeps it in the bell                                                                                                                                                                              |
| D62 | Notifications           | ⏳ bell with unread count in the header; summaries stay until the user clears them (per item / all); reading only removes the badge                                                                                                                                                                                             |
| D63 | Which email             | ⏳ one per student: the one they signed in with last, else the first on the roster; option "todos sus correos"                                                                                                                                                                                                                  |
| D64 | Sending email           | ⏳ the app never sends email: copy, `mailto:` with BCC in batches, CSV; recipients filtered by group / stage / ready / absent on a date / by hand                                                                                                                                                                               |
| D65 | Attendance states       | ⏳ Presente · Tarde · Ausente · Excusa (+ optional note), "Todos presentes" to start, optional class topic                                                                                                                                                                                                                      |
| D66 | Who takes attendance    | ⏳ the board's teachers in v1; student self check-in with a code on the projector → Later                                                                                                                                                                                                                                       |
| D67 | Students see            | ⏳ only their own attendance (dates and states) on their space page; never classmates'                                                                                                                                                                                                                                          |
| D68 | Attendance records      | ⏳ one doc per class date; history list + students × dates table with %; past dates editable; CSV export; included in the board backup                                                                                                                                                                                          |
| D69 | Order                   | ⏳ Loop 15 (M17 Canva) → Loop 16 (M18 emails + attendance) → **Loop 17 (M21 status, decorations, styles: Navidad ready before December 1)** → Loop 18 (M19 Novedades, which can announce M17–M21) → Loop 19 (M20 feedback + animations, last because it touches every screen); Loop 8 (M10) after, unless you prefer it earlier |
| D70 | Status                  | ⏳ emoji + text ≤ 60 (no links), presets + custom, expiry 1 h / today / this week / never; for students and teachers; shown on cards, space page, user menu and (teacher) the board header                                                                                                                                      |
| D71 | Status moderation       | ⏳ the board's teacher can clear a student's status on their board                                                                                                                                                                                                                                                              |
| D72 | "Necesito ayuda"        | ⏳ a preset status that the teacher sees as a counter + card filter in the board header                                                                                                                                                                                                                                         |
| D73 | Decorations             | ⏳ card banner + sticker by the name + seasonal accessories (hat / scarf) only while the board has a seasonal style; never over the stage ring or the #DOCENTE ring; each person can turn accessories off                                                                                                                       |
| D74 | Board styles            | ⏳ one-click styles that set background, pattern, cards, fonts and header; every detail still editable; 8 everyday + 4 seasonal (Navidad, Halloween, Año nuevo, Amor y amistad)                                                                                                                                                 |
| D75 | Navidad                 | ⏳ red / green / gold, slow snow, twinkling lights on the header, pine pattern, optional Santa hats, "¡Feliz Navidad!" by the title                                                                                                                                                                                             |
| D76 | Ambient animations      | ⏳ canvas particles, lazy, capped and paused when the tab is hidden; off with "reduce motion"; teacher switch per board                                                                                                                                                                                                         |
| D77 | Scheduling              | ⏳ a seasonal style can have dates (e.g. Dec 1 → Jan 6) and switches back to the usual style by itself                                                                                                                                                                                                                          |

**Next step:** see the Phase 2 status line at the top and the latest loop report.
