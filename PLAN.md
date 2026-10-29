# Project Plan — diplomado_pbl

Stack: **Vite 8 + React 19 + TypeScript 6 + Firebase 13** (frontend + Firebase as backend)
UI: **Tailwind CSS v4, shadcn/ui (Base UI, selected components), GSAP, Excalidraw (slides)**
Images: **Cloudinary** · Media service: **Cloudflare Worker** · Admin tasks: **local admin CLI**

**Everything is free (academic project):** every service runs on a free tier and every library is open source (MIT / Apache).

Status legend: `[ ]` to do · `[x]` done

- **Phase 1 — Template setup:** ✅ done (2026-10-26), commit `8f20758`
- **Plan review (rev. 6, 2026-10-26):** ✅ consistency + free-tier review done, see [Review findings](#review-findings-rev-6)
- **Phase 2 — "Padlet for PBL" app:** 🚧 in progress — Google sign-in enabled · M4 Steps 1–6 done (`/health` → `config: ok`) · service account key ready · **M1 ✅** · **Loop 1 (M2) ✅** ([report](reports/loop-01-m2.md)) · **Loop 2 (M3) ✅** ([report](reports/loop-02-m3.md)) · **Loop 3 (M4) ✅ code done** ([report](reports/loop-03-m4.md)) · **Loop 4 (M5) ✅ code done** ([report](reports/loop-04-m5.md)) · **Loop 5 (M6) ✅ code done** ([report](reports/loop-05-m6.md)) · **Loop 6 (M7) ✅ code done** ([report](reports/loop-06-m7.md)) · **Loop 7 (M8) ✅ code done** ([report](reports/loop-07-m8.md)) · **Extras ✅ code done** (2026-10-29): profile page `/me`, teacher's notes on slides · **Loop 8 (M10) Class participation: 📝 planned**, decisions [D12–D17](#decisions-all-answered-) waiting for you — **ready to launch**, waiting for you: `npm run worker:deploy` + `npm run deploy:rules` (covers M2–M5) + one real upload, **before 2026-11-25** (Worker live at `https://media-api.paradisserossa.workers.dev`)

---

# Phase 2 — Product

A Padlet-style board where **each student owns one space** and documents their project process as **slides**. The teacher can **present each student's space** in full screen.

| #   | Feature                                                                                                                                                    | Who                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| F1  | Sign in with Google, using **any** of the student's emails (personal Gmail or university)                                                                  | everyone                                             |
| F2  | Board dashboard: columns of cards, one card per student (like the reference image), live updates                                                           | everyone in the board                                |
| F3  | Space editor: **one Excalidraw canvas per slide** (text, images, links, embeds, shapes, drawing); add / reorder slides                                     | the student who owns the space                       |
| F4  | Space profile: title, summary, cover image, color                                                                                                          | the student                                          |
| F5  | Presentation mode: full screen, keyboard navigation, **next / previous student**                                                                           | teacher (students: their own space)                  |
| F6  | Boards: create a board, add students, invite link                                                                                                          | teacher                                              |
| F7  | Import / export with **JSON** (students, board backup)                                                                                                     | teacher                                              |
| F8  | **Storage & cleanup**: image usage, remove unused images, **"Archived projects"** for inactive boards, purge                                               | teacher (dashboard) + you (admin CLI)                |
| F9  | **Spanish (default) / English** interface                                                                                                                  | everyone                                             |
| F10 | **Profile** (`/me`): display name, photo on cards, language ✅                                                                                             | everyone                                             |
| F11 | **Teacher's notes** on each slide, private to the teacher and the student ✅                                                                               | teacher writes · the student reads                   |
| F12 | **Class participation**: per class, the teacher opens **1–5 participation slides**; students add, edit and delete their own contributions (text + picture) | teacher creates and moderates · students participate |

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
  profileName?, showPhoto? }                                                      // set on /me; follow the student to their cards

staffEmails/{email}                       // lowercased
{ email, displayName, role: 'admin' | 'teacher', addedAt }   // exists → this email is a teacher

boards/{boardId}
{ title, description,
  teacherEmails: string[],                // who teaches it (your emails; co-teachers later)
  joinCode, joinCodeEnabled,
  status: 'active' | 'locked' | 'archived',
  lastActivityAt,                         // any edit in the board (throttled) → auto-archive
  archiveAfterDays: 90,                   // configurable per board
  background, createdAt, updatedAt, archivedAt? }

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

### Folder structure in Cloudinary

```
pbl/
  dev/ …                                  ← local development uploads (separate, easy to wipe)
  prod/
    {boardId}/
      {studentId}/{assetId}               ← public_id ↔ registry id (1:1)
      class/{assetId}                     ← class participation images (M10)
```

Tags: `board_{boardId}`, `student_{studentId}`, `env_prod`.

### Delivery (resize by URL)

| Where                    | Transformation                     | Typical size |
| ------------------------ | ---------------------------------- | ------------ |
| Dashboard card cover     | `f_auto,q_auto,c_fill,w_400,h_225` | ~15 KB       |
| Contribution card        | `f_auto,q_auto,c_limit,w_800`      | ~50 KB       |
| Editor / viewer          | `f_auto,q_auto,c_limit,w_1280`     | ~100 KB      |
| Full-screen presentation | `f_auto,q_auto,c_limit,w_1920`     | ~200 KB      |

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

| Loop | Milestone                                 | I build                                                                                                                                                                                              | You do at the end                                                                            |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0 ✅ | **M1 finish**                             | —                                                                                                                                                                                                    | `npm run admin -- setup --email paradisserossa@gmail.com` · log in as teacher and as student |
| 1 ✅ | **Infra + M2** Boards, students & joining | emulator seed, Playwright setup, `npm test`; teacher dashboard, create board, students table, JSON import + quick add, auto-join, invite link, merge, rules + tests                                  | `npm run deploy:rules` (rules + indexes) · acceptance test                                   |
| 2 ✅ | **M3** Dashboard                          | Padlet-like board view, live cards, space profile (no cover yet)                                                                                                                                     | `npm run deploy:rules` · acceptance test                                                     |
| 3 ✅ | **M4** Uploads (Worker Steps 7–12)        | token check, permission check, signed uploads, cover image, asset registry, rules                                                                                                                    | `npx wrangler deploy` · upload a real image · `npm run deploy:rules`                         |
| 4 ✅ | **M5** Excalidraw slides                  | editor, autosave (throttled), images via Cloudinary, viewer, self-hosted fonts                                                                                                                       | `npm run deploy:rules` · acceptance test                                                     |
| 5 ✅ | **M6** Presentation                       | full screen, keyboard, next student, GSAP transitions                                                                                                                                                | acceptance test                                                                              |
| 6 ✅ | **M7** Lifecycle & backups                | archived projects, cleanup, purge, JSON backup/restore, CLI commands, Worker delete/usage                                                                                                            | `npx wrangler deploy` · `npm run deploy:rules` · try cleanup on a test board                 |
| 7 ✅ | **M8** Hardening & launch                 | App Check code, final rules review, privacy notice, metadata                                                                                                                                         | create a reCAPTCHA v3 key + register App Check (console) · `npm run deploy` (hosting)        |
| 8 📝 | **M10** Class participation               | classes with 1–5 participation slides, contribution cards (text + picture), own edit / delete, teacher moderation, open / close, present, Worker `scope: 'class'`, orphans, backup v2, rules + tests | answer D12–D17 · `npm run worker:deploy` · `npm run deploy:rules` · acceptance test          |
| —    | **M9** More teachers                      | when you need it                                                                                                                                                                                     | —                                                                                            |

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

D12–D17 (class participation, M10) are **proposed** (⏳): confirm or change them before Loop 8.

| #   | Decision                | Answer                                                                                                                                                             |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Image storage           | **Cloudinary**, signed uploads via the media-api                                                                                                                   |
| D2  | Slide editor            | **Excalidraw** canvas per slide (MIT, free, no key, no watermark)                                                                                                  |
| D3  | Text                    | **Excalidraw's text tool** (font, size, color, align; no inline bold/italic)                                                                                       |
| D4  | Teacher / admin roles   | **Recognized by email**: `staffEmails/{email}` (you = admin via CLI); everyone else signs in as a student                                                          |
| D5  | Classmates' spaces      | **Visible read-only**                                                                                                                                              |
| D6  | Joining a board         | **A: teacher adds students (auto-join) + B: invite link**                                                                                                          |
| D7  | Language                | **Spanish (default) + English**                                                                                                                                    |
| D8  | Import / export         | **JSON** + quick-add paste box                                                                                                                                     |
| D9  | Students with 2 emails  | **Person + email index**                                                                                                                                           |
| D10 | First admin             | **Your personal Gmail**, via `npm run admin -- setup` from this console                                                                                            |
| D11 | Removing old data       | **Teacher dashboard (Storage page) + local CLI**, via the media-api                                                                                                |
| Q1  | Free canvas             | **Excalidraw** (the whole project must be free, academic use)                                                                                                      |
| Q2  | Cloudflare Worker       | **Yes**, built step by step (M4 walkthrough)                                                                                                                       |
| Q3  | Old boards              | **Auto-move to "Proyectos archivados" after 90 days without use** (configurable); purge is manual, after a backup                                                  |
| Q4  | Default language        | **Spanish**                                                                                                                                                        |
| Q5  | Admin email             | **Your personal Gmail**                                                                                                                                            |
| D12 | ⏳ Participation format | **Proposed:** each participation slide = the teacher's prompt + a grid of contribution cards (not a shared Excalidraw canvas, which would overwrite people's work) |
| D13 | ⏳ Limits               | **Proposed:** 1–5 slides per class; up to 3 contributions per student per slide; text ≤ 1000 + 1 picture                                                           |
| D14 | ⏳ Visibility           | **Proposed:** the whole class sees every contribution with the author's name (anonymous mode: Later)                                                               |
| D15 | ⏳ Teacher powers       | **Proposed:** edit / delete any contribution (marked "editado por el docente"), open / close each class; a removed student's contributions stay                    |
| D16 | ⏳ Backup               | **Proposed:** classes and contributions are part of the board backup (v2) and restored with it                                                                     |
| D17 | ⏳ Where it lives       | **Proposed:** a "Clases" section in each board (not a separate board), so members and rules are reused                                                             |

**Next step:** see the Phase 2 status line at the top and the latest loop report.
