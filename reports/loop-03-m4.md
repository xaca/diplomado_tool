# Loop 03: M4 (image uploads and card cover)

**Date:** 2026-10-26 · **Commits:** `908b9dd` → `3b73567` → `c216bec` → `4bf9ad1` (+ this report) · **Status:** ✅ code done, waiting for your deploy + one real upload

---

## 1. Summary

- Students can now **upload a cover image** for their card. It shows on the dashboard as a small, fast Cloudinary thumbnail and large on the space page.
- The upload goes **straight from the browser to Cloudinary**, with a progress bar. The **Cloudflare Worker** only signs it after checking who is calling and that the space is theirs. **The Cloudinary secret never reaches the browser.**
- Every image is recorded in an **image registry**. Replaced or removed covers are marked "unused", so the cleanup in M7 can delete them from Cloudinary and keep us inside the free tier.
- Tested locally: **27 unit, 19 Worker, 42 rules, 21 browser tests**, plus a new **integration test** that runs the real Worker against the emulators (6/6).

## 2. Done

| Area             | What                                                                                                                                                                                                    | Commit    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Worker: identity | Verifies the Firebase login token against Google's public keys (Step 7). Unverified emails are refused. A broken token gets a clean 401.                                                                | `908b9dd` |
| Worker: access   | Reads Firestore **with the student's own token**, so the Firestore rules decide: the student must be a member of the board, the space must be theirs and the board must be active (Step 8)              | `908b9dd` |
| Worker: signing  | Signs the Cloudinary upload (Step 9): fixed folder `pbl/{dev\|prod}/{board}/{student}/{image}`, tags, allowed formats, max 2560 px, no overwrite. `localhost` → `dev` folder, the deployed app → `prod` | `908b9dd` |
| Rules            | Image registry (`assets`): only the space owner, only while the board is active, ≤ 10 MB, the folder must match. The card's `cover` must point to a registered image of that same student               | `3b73567` |
| Browser          | Before uploading: resize to ≤ 2560 px and convert to WebP when the file is large (GIFs untouched). Then sign → upload with progress → register                                                          | `c216bec` |
| Card cover       | "Imagen de portada" in **Mi tarjeta**: upload, change, remove, clear error messages. Shown on the card (400×225 thumbnail) and on the space page                                                        | `c216bec` |
| Fix: first login | Joining the boards listed for your email now happens **during login**, so a direct link to a board (or to your space) works on the very first sign-in                                                   | `4bf9ad1` |
| Tests + scripts  | 5 new e2e flows (Worker and Cloudinary faked), real Worker integration test, `npm run worker:dev` / `worker:deploy`, README section "media-api — local setup", emulator test hardening                  | `4bf9ad1` |

## 3. Quality gate (`npm run check`)

| Check                               | Result                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Typecheck · lint · Prettier         | ✅ clean                                                                               |
| Unit tests                          | ✅ **27 passed** (+7: image resizing, upload result checks)                            |
| Worker tests (offline)              | ✅ **19 passed** (incl. Cloudinary's official signature example)                       |
| Rules tests (Firestore emulator)    | ✅ **42 passed** (+5: image registry, cover)                                           |
| End-to-end (Playwright + emulators) | ✅ **21 passed** (+5)                                                                  |
| Worker integration (real Worker)    | ✅ **6/6**: own space ✔ · other space ✖ · non-member ✖ · fake token ✖ · locked board ✖ |
| Build                               | ✅ 1.52 MB JS (479 KB gzip), about the same as Loop 2                                  |

New e2e flows:

- a student uploads a cover: signed by the Worker, shown on the card as a Cloudinary thumbnail;
- changing and removing the cover marks the old images as unused (for cleanup);
- the teacher sees the new cover **live** on the dashboard;
- a refused signature shows a clear message and changes nothing;
- unsupported files are rejected before any upload.

## 4. Your turn

```bash
npm install
npm run worker:deploy      # deploys the new Worker code (the secret is already stored in Cloudflare)
npm run deploy:rules       # rules for the image registry and the cover
```

Check the Worker: open `https://media-api.paradisserossa.workers.dev/health`. It should say `config: ok`.

Then try one real upload on your computer:

```bash
npm run dev                # uses the deployed Worker (VITE_MEDIA_API_URL in .env.local)
```

To use a local Worker instead: `npm run worker:dev` in another terminal and `VITE_MEDIA_API_URL=http://localhost:8787` in `.env.local`. See the README section "media-api — local setup".

## 5. Acceptance test

**As student (your second Google account, a member of a board)**

- [ ] **Editar mi tarjeta** → **Subir imagen** → pick a photo from your phone or computer. A progress bar appears, then the preview
- [ ] **Guardar**: the card on the dashboard shows the image
- [ ] Open your space: the cover appears large
- [ ] **Cambiar imagen** with another photo, then **Quitar**: the card goes back to no image
- [ ] Try a PDF: "Formato no soportado…" and nothing is uploaded

**In Cloudinary (Media Library)**

- [ ] The images are under `pbl/dev/<board>/<student>/` (from `localhost`; `pbl/prod/...` once the app is deployed to Hosting)
- [ ] Each image is at most 2560 px on its longest side

**As teacher (another browser or a private window)**

- [ ] Keep the board open while the student saves a cover: it appears **without reloading**
- [ ] The teacher has **no** upload option on students' cards

## 6. Assumptions (decisions I took; tell me to change any)

| #   | Decision                                                                                              | Why                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A1  | The cover is **saved as soon as the upload finishes** (no extra confirm step)                         | Fewer clicks; changing or removing it is one click                                                  |
| A2  | **Teachers can't upload** to students' cards                                                          | Same as M3: the card is the student's own voice                                                     |
| A3  | A replaced image is **not deleted right away**; it is marked "unused" and deleted by the cleanup (M7) | Deleting needs the secret (Worker); one cleanup path is simpler and safer than undo tokens          |
| A4  | **GIFs are uploaded as they are** (not resized)                                                       | Resizing in the browser would lose the animation; the 30 MB input limit and Cloudinary's cap remain |
| A5  | Images from `localhost` go to `pbl/dev/...`, images from the deployed app go to `pbl/prod/...`        | Your tests never mix with the students' real images, and dev can be wiped any time                  |
| A6  | The Worker **reads Firestore with the student's token**, not with an admin key                        | No service account in Cloudflare; the rules stay the single place that decides                      |

## 7. Issues and risks

| #   | Issue                                                                                                                  | Status / impact                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| I1  | A direct link to a board failed on a student's **first** login (they weren't joined yet)                               | ✅ Fixed: joining happens during login                                                                           |
| I2  | The Worker answered 500 instead of 401 for a broken token in emulator mode                                             | ✅ Fixed, with a test                                                                                            |
| I3  | On Windows, interrupted test runs could leave the emulators or the local Worker running and **hang** the next gate run | ✅ Fixed: the cleanup also covers the Worker port, and the integration test fails after 3 min instead of hanging |
| I4  | The full gate now takes about 10 minutes (real emulators + real Worker)                                                | 🟢 Acceptable; the individual scripts are faster for day-to-day work                                             |
| I5  | Bundle size about the same (479 KB gzip)                                                                               | 🟡 Code-splitting comes with M5 (Excalidraw is large)                                                            |
| I6  | Cloudinary free tier: 25 credits/month                                                                                 | 🟢 Covers are ≤ 2560 px WebP and thumbnails are cached; the M7 cleanup removes unused images                     |

## 8. Next loop

**Loop 4 (M5): slides with Excalidraw**

- A slide editor in each student's space: a list of slides, each one an Excalidraw canvas (text, shapes, links, images)
- Images in slides use the same signed upload and registry as the cover
- Autosave with a small "saved" indicator; read-only view for classmates
- Excalidraw loaded only when needed (code-splitting), so the dashboard stays light

**Before Loop 4 I need:** the deploys above and the acceptance test (one real upload is enough to prove the Worker in production).
