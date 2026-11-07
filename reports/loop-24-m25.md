# Loop 24 — M25 Presentaciones and Evaluaciones

2026-11-07 · commits `c34dd16`..(last) · D120–D125 taken as proposed (you said "go")

The code for this milestone was started before it was in the plan (Presentaciones, Evaluaciones, the sections bar and the Administrar guard). This loop wrote it into the plan, closed the gaps and added the tests.

## 1. Summary

- **Presentaciones** (Administrar → Presentaciones):
  - Paste any Google Slides link: `/edit`, `/view`, `/present`, or **published to the web** (`/presentation/d/e/…`), and a title.
  - Reorder with ↑ ↓, **Ocultar / Mostrar a estudiantes**, Presentar, Abrir en Google Slides, rename, delete. The file in Google is never touched.
  - Students get a **Presentaciones** section: thumbnails (or a list), and Google's viewer when they open one.
- **Evaluaciones** (Administrar → Evaluaciones):
  - Paste a Google Forms link: the editor's, the "Enviar" one, or a **`forms.gle`** short link.
  - The same order, show / hide, open and delete.
  - Students fill in the form inside the app. **Answers stay in Google Forms**: read them there.
- **Hidden means hidden (D121).** Before, hiding only changed the screen, and a student could still read hidden items from the database. Now the rules give students only the visible ones.
- **The sections bar (D120):** Tarjetas · Clases · Grabaciones · Presentaciones · Evaluaciones · Calendario · Logros, on the board and on every section page, under a compact header (logo, title, 🔔, menu).
  - Students see **Presentaciones** and **Evaluaciones** only when there's something visible. You always see both.
- **"¿No carga?"** The viewers use the same frame as embeds in slides: "Cargando…", then "¿No carga? … Abrir" if Google doesn't answer, and an "↗ Abrir" corner link.
- **Sharing hint** in both panels: "Compartir → «Cualquier persona con el enlace»".
- **Limits (D125):** 50 presentations and 20 evaluations per course. "Agregar" turns off at the limit, with a note.
- **Backup, template and purge (D124):** both lists go into the backup **and into a template**, so a new cohort starts with the same material. Restoring creates them in order. Purge (app and CLI) deletes them.
- **Administrar only for the board's own teachers.** A teacher of another course who is a student here sees "No eres docente de este tablero" with a way back, instead of empty lists.

## 2. Done

| Commit    | What                                                                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c34dd16` | Presentaciones and Evaluaciones: model, rules (students read only visible ones), links (published Slides, short links), panels (limits, sharing hint), section pages (`EmbedFrame`), sections bar (D120), Administrar guard; backup / template / restore / purge (app + CLI); texts es / en; unit and rules tests |
| (last)    | E2E `m25.spec.ts`; tests can run beside another project's emulators (ports from the environment); plan and this report                                                                                                                                                                                            |

## 3. Quality gate

| Check                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Unit                           | ✅ **267** (+28: every Slides / Forms link form, published ids, wrong links, the addresses, the viewer's sandbox; backup and template with the material)                                                                                                                                                                                                                                                                                                                                                        |
| Rules                          | ✅ **127** (+3: the teacher manages presentations; students read only visible ones and never write; the same for evaluations)                                                                                                                                                                                                                                                                                                                                                                                   |
| Worker                         | ✅ **46** (no Worker change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| E2E                            | ✅ **117** (+5 in `m25.spec.ts`: link, order and hide presentations, students see only visible ones, a published link; a form filled in inside the app; the bar shows the sections only when there is something, on every section page; the 20-evaluation limit; a teacher of another course turned away). The first full run had 5 older tests failing because they clicked header buttons that are now links in the bar, or expected six Administrar tabs. I updated them and re-ran those 4 files (15 / 15). |
| Admin CLI · Worker integration | ✅ · not run (no Worker change)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Build                          | ✅ main chunk 844 KB, 272 KB gzip (+11 KB)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**How I ran the emulator tests:** your admin_grades_tool emulator (`demo-grades`) holds ports 8080 / 9099, and its Vite server holds 5174. I didn't stop them. I ran this project's emulators on other ports with a temporary config. To make that possible, the rules tests, the e2e app and Playwright now take the ports from the environment (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `E2E_PORT`). The defaults are unchanged, so `npm run check` works as before when the ports are free.

## 4. Your turn

```bash
npm run deploy:rules   # required: students may no longer read hidden items
npm run update:web
git push
```

Then link one real presentation and one real form, and look at them as a student on a phone and in Safari.

## 5. Acceptance test

- [ ] Administrar → **Presentaciones**: paste a Slides link (from the address bar) → it appears; ↑ ↓ changes the order; hide one.
- [ ] As a student: **Presentaciones** shows only the visible ones, in your order; opening one shows the slides.
- [ ] A presentation published to the web (Archivo → Compartir → Publicar en la web) is accepted too. It shows an icon instead of a thumbnail.
- [ ] Administrar → **Evaluaciones**: paste the form's `forms.gle` link → it's accepted; as a student, fill it in inside the app → the answer shows in Google Forms.
- [ ] With nothing visible, students don't see the Presentaciones / Evaluaciones tabs; you always do.
- [ ] Download a **template** of a course with presentations → create a new course from it → the presentations and forms are there.

## 6. Assumptions (change any of them)

- **Published Slides links** were rejected before (their id is longer and different). They are accepted now, stored with a `published` flag, and have no thumbnail: Drive's thumbnail only exists for the editor's id.
- **Short links** are expanded by the existing media-api Worker (only its allow-list: `forms.gle`, `goo.gl`…). If the Worker can't be reached, the link is checked as typed and the "not recognised" message explains it.
- **The teacher's view** of the section pages still shows hidden items marked "Oculta", as before.
- **The template carries the material visible or hidden**, as the teacher had it.
- **Evaluations grid view** still loads each form as a small preview: fine for a handful, heavier with many. The default is the list.

## 7. Issues / risks

- **Sharing:** a presentation or form that isn't shared with "anyone with the link" (or published) doesn't load for students. The panels say so, and the viewer offers "Abrir".
- **Forms limited to university accounts** may not load inside the app in Safari / Brave (third-party cookies). "Abrir" always works.
- **Thumbnails** use an undocumented Drive address. If Google changes it, cards show the icon.
- **Deploy order:** deploy the rules and the web together. With the new rules but the old web, students' lists would come back empty (the old pages ask for everything).

## 8. Next loop

Loop 25 · **M26 Mensajes** (student ↔ teacher DMs). Confirm or change D113–D119 in the plan, then say "next".
