# Loop 01: Infrastructure + M2 (boards, students & joining)

**Date:** 2026-10-26 · **Commits:** `e0c1d40` → `4677d3e` → `044c480` (+ this report) · **Status:** ✅ code done, waiting for your deploy + acceptance test

---

## 1. Summary

- Teachers can create boards, add students one by one or in bulk, and share an invite link. Bulk adds take a pasted list or a JSON file, with a preview before anything is saved.
- Students only need to **sign in with Google**. If their email is on a board's list, they join it automatically, and **either of their emails leads to the same student and space**. Students who aren't on the list can use the invite link.
- Everything is tested locally with no production data: **13 unit tests, 29 rules tests, and 10 browser tests** against the Firebase emulators.

## 2. Done

| Area           | What                                                                                                                                                                                                                                      | Commit    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Data model     | Shared contracts (`src/model`): document paths and types, Zod input validation, invite codes (no ambiguous characters 0/O/1/I/L)                                                                                                          | `e0c1d40` |
| Import logic   | Parses JSON files and pasted lists (`;` `,` or tabs). The preview marks each row new / update / unchanged / invalid / conflict, matching by **any** email, case-insensitive. Includes the write count and a JSON export that round-trips. | `e0c1d40` |
| Security Rules | `boards`, `joinCodes`, `students`, `studentEmails`, `members`, `spaces`, the invite batch, and collection-group reads. Deny by default.                                                                                                   | `e0c1d40` |
| Indexes        | Collection-group exemptions for `studentEmails.email` and `members.uid`                                                                                                                                                                   | `e0c1d40` |
| Teacher UI     | Boards list (live), create board, manage board page: invite panel (copy, on/off, code), students table (add/edit with 1–5 emails, remove, merge two students), import dialog, JSON export, template download                              | `4677d3e` |
| Student UI     | "Mis tableros" with auto-join, `/join/:code` invite page with clear messages, board page placeholder (the dashboard arrives in M3)                                                                                                        | `4677d3e` |
| Translations   | All new screens in **Spanish and English** (typed keys)                                                                                                                                                                                   | `4677d3e` |
| Test infra     | Emulator mode (`.env.emulators`, project `demo-pbl`), demo seed, Playwright e2e, `npm run check`, automatic cleanup of leftover emulators                                                                                                 | `044c480` |
| Bug fix        | Auto-join race, found by the e2e tests (see §7)                                                                                                                                                                                           | `044c480` |

## 3. Quality gate (`npm run check`)

| Check                                                                  | Result                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Typecheck · lint · Prettier                                            | ✅ clean                                                           |
| Unit tests (`npm test`)                                                | ✅ **13 passed**                                                   |
| Rules tests (`npm run test:rules`, Firestore emulator)                 | ✅ **29 passed** (11 M1 + 18 M2)                                   |
| End-to-end (`npm run test:e2e`, Playwright + Auth/Firestore emulators) | ✅ **10 passed**                                                   |
| Build                                                                  | ✅ 1.50 MB JS (473 KB gzip). ⚠️ Over Vite's 500 KB warning; see §7 |

The e2e flows cover:

- teacher goes to `/teacher`; an unknown account sees an empty "Mis tableros"; a student can't open `/teacher`;
- create a board, then import a list with 2 new students and 1 invalid row;
- auto-join with the **second (university) email**;
- the teacher sees "Ingresó" and "5 en total · 1 ya ingresaron";
- invite link: valid, disabled and unknown;
- language switch.

## 4. Your turn (in this order)

From the project root (`D:\universidad\diplomado_pbl`):

```bash
git pull   # only if you work from another copy; otherwise skip
npm install
npm run deploy:rules
```

`deploy:rules` deploys the **new rules + the 2 index exemptions**. Expected: `Deploy complete!`.

> ⏱️ The index exemptions take **a few minutes** to build in Firebase. Until they're ready, students' auto-join fails with "Algo salió mal". Check **Firebase console → Firestore → Indexes → Exemptions**: both should say _Enabled_ before you test.

Optional, to explore with demo data on your computer (no production data involved):

```bash
npm run emulators          # terminal 1: local Firebase (Auth + Firestore)
npm run seed               # terminal 2: demo teacher, board and 5 students
npm run dev:emulators      # terminal 2: app at http://localhost:5173 against the emulators
```

In the emulator's Google screen, choose **"Add new account"** and type an email: `docente@demo.edu` for the teacher, or `laura@gmail.com` / `lnataly@uni.edu.co` for students.

## 5. Acceptance test

With real accounts on `npm run dev` (http://localhost:5173), after the indexes are _Enabled_:

**As teacher (paradisserossa@gmail.com)**

- [ ] `/teacher` shows **Panel docente** → **Nuevo tablero** → create "Prueba 1"
- [ ] The board page shows the **invite link** and a 6-character code; **Copiar** copies it
- [ ] **Agregar estudiante**: add a second Google account of yours as a student, with 1 or 2 emails
- [ ] **Importar**: paste `Prueba Uno; prueba1@gmail.com` and check the preview says _1 nuevos_ → **Importar 1**
- [ ] **Exportar JSON** downloads `estudiantes-prueba-1.json`

**As student (the second Google account)**

- [ ] Avatar menu → **Cambiar de cuenta** → sign in with the student account
- [ ] **Mis tableros** shows "Prueba 1" (auto-join) → open it: the title appears
- [ ] Back as teacher: that student's status is **Ingresó**

**Invite link**

- [ ] With a third account (not on the list), open the invite link → **Unirme al tablero** → you land on the board
- [ ] As teacher, turn the link **off** → with yet another account the link shows the "desactivado" message

**Language**

- [ ] Avatar menu → **English**: everything switches; reload, and it's still English (saved to your profile)

## 6. Assumptions (decisions I took; tell me to change any)

| #   | Decision                                                                                                                                                             | Why                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A1  | **No `react-hook-form`**: forms use React state + Zod                                                                                                                | `@hookform/resolvers` fails to install (peer conflict with `effect`/`typeschema`). Our forms are small. |
| A2  | Up to **5 emails per student** (the form shows 2 fields; "Agregar otro correo" adds more)                                                                            | Room for personal, university and old accounts without abuse                                            |
| A3  | **Removing an email** from a student doesn't sign out an account already linked with it                                                                              | Unlinking accounts would need extra UI; the teacher can remove the student entirely                     |
| A4  | **Merge** keeps the student with more linked accounts by default (the teacher can pick the other). The other student's space is moved only if the kept one has none. | In M2 spaces are empty; from M3 the merge must also move slides (noted for M3/M5)                       |
| A5  | Students **don't see the classmates list** (only teachers do). They'll see classmates' **spaces** in the M3 dashboard.                                               | Less personal data exposed (emails)                                                                     |
| A6  | Board page `/b/:id` is a **placeholder** until M3                                                                                                                    | M3 builds the Padlet-like dashboard                                                                     |
| A7  | The UI name is **"PBL Diplomado"**                                                                                                                                   | Placeholder until you choose a final name (M8)                                                          |

## 7. Issues and risks

| #   | Issue                                                                                                                                      | Status / impact                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| I1  | **Auto-join race:** React StrictMode (dev) and a student with two tabs ran auto-join twice, and the second write was rejected by the rules | ✅ **Fixed.** One run per account; losing a race counts as success. Found by the e2e tests.                      |
| I2  | On Windows, `firebase emulators:exec` sometimes **leaves the emulator running**, and the next test run fails with "port taken"             | ✅ Handled. `npm run emulators:free` runs automatically before tests and stops only leftover Firebase emulators. |
| I3  | **Bundle 1.5 MB** (473 KB gzip), up from 1 MB, mostly Firebase + UI components                                                             | 🟡 Fine for now. Route-based code splitting is planned with M5 (Excalidraw must be lazy anyway).                 |
| I4  | Auto-join needs the **index exemptions** deployed and _Enabled_                                                                            | 🟡 Your step in §4                                                                                               |
| I5  | `MetadataLookupWarning` when the seed runs                                                                                                 | 🟢 Harmless: the Admin SDK looks for Google Cloud credentials it doesn't need for the emulators                  |
| I6  | `npm audit`: 4 "high" issues in `@grpc/grpc-js` (Firestore's Node build)                                                                   | 🟢 Not in the browser bundle; npm's "fix" downgrades Firebase to v9, so not applied                              |

**Free tier:** importing 40 students with 2 emails each ≈ **120 writes**. Each student's first login ≈ 4 writes. Far below the 20K/day limit.

## 8. Next loop

**Loop 2 (M3): the Padlet-like dashboard**

- Board header and masonry columns of student cards (avatar, name, time ago, title, summary, color), with live updates
- Space profile: the student edits their card's title, summary and color (cover image waits for M4)
- Rules for space updates, plus tests
- Card actions: open, edit (owner), present (teacher, a placeholder until M6)

**Before Loop 2 I need:** your deploy (§4), and the acceptance test result, or a note on anything that felt wrong.
