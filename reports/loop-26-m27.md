# Loop 26 — M27 The teacher's feedback on a project, comments never lost, En progreso / Listo

2026-11-07 · commits `a047398`..(last) · D128, D129 decided by you; D133 left to me; D130–D132 taken as proposed

## 1. Summary

- **Comments, private or public (D128).**
  - You comment on a whole project ("Comentar el proyecto") or on a slide.
  - Each comment has a switch, **🔒 Privado** (the default) or **👥 Público**, and you can change it later with Editar. Comments from before this loop stay private.
  - Classmates see only the public ones, on the student's space page (= Presentaciones → Ver). The database refuses private ones to them, so they never reach a classmate's browser.
  - The student sees every comment, each with its 🔒 / 👥 badge, plus **"Responder en Mensajes"**: it opens their conversation with the comment quoted in the box.
  - A **"💬 Comentario nuevo"** badge stays on the student's card until they open their space.
  - In the presenter, the notes panel (N) has two tabs, **Esta diapositiva · Proyecto**.
- **A comment is never lost (D130).** If you have typed a comment and haven't saved it, the app asks before you leave it:

  > **Tienes un comentario sin guardar.** Lo estás escribiendo en la diapositiva 1 de Sebastian Cetina.
  > **Guardar y continuar** · Descartar · Seguir escribiendo
  - **When it asks:** ← / →, the buttons, swipe, the overview, changing student, Esc, closing the panel, "Editar", leaving the page, switching slides in the editor.
  - **Guardar y continuar** moves only once the server confirmed the save. If the save fails, you stay on the slide with your text.
  - **Closing the tab** shows the browser's own "¿Salir del sitio?" warning.
  - **Drafts:** the text is kept in that browser tab. Coming back to the slide (or reloading) shows **"Borrador recuperado"**.

- **Save buttons lock (D131).** Every save, send and confirm button in the app now locks from the first click until the server confirms. It shows "Guardando…", and after 8 s "Sigue guardando… revisa tu conexión". That's 29 files. Six had no protection at all: removing / merging a student, importing students, restoring a backup, sending emails (a double click could send them twice), joining a board, and the storage clean-up.
- **You can edit anything in a student's project (D129).**
  - **"Editar proyecto"** on their space page: title, description, cover, color.
  - **In the editor:** you can now also **reorder and delete** their slides. Adding is still at the end only, with no duplicating.
  - **En progreso / Listo** you can set too; it shows "Marcado por el docente".
- **The student always has a way back.** A **"Cambios de tu docente"** box on their space page offers:
  - **Restaurar mi versión** for the details (undoable with "Volver a la versión del docente");
  - **Restaurar el orden**;
  - **"Eliminadas por el docente"**, where each deleted slide has **Restaurar** (back where it was, with its notes) or **Quitar definitivamente**.
- **🚧 En progreso · ✓ Listo (D132).**
  - **The control** (two buttons) replaces "Mis diapositivas están listas": on the space page, in the editor and in the student's box in Presentaciones.
  - **Badges** on the card, in Presentaciones and in the presenter's header.
  - **Filters:** the board's "Avance" filter and Correos have **Listos · En progreso · Sin marcar**.
  - **"Presentar listos"** and the "Lista para presentar" achievement work as before.
- **"¿Vuelves a En progreso?" (D133, my call).** When a student marked Listo saves a change to a slide, a toast asks it once per editing session ("Sí, En progreso" · "No, sigue Listo"). The status never changes by itself, and your edits never change it.

## 2. Done

| Commit    | What                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a047398` | Save lock (`useSaveLock`, `SaveButton`) and the sweep of every save / send / confirm button; es / en texts                                                                                              |
| `7464be4` | Data and rules: comments on the project and visibility, the teacher's project edits (signed), `deletedSlides`, `workStatus`; storage analysis, purge (app + CLI), student removal; rules and unit tests |
| `ce44274` | UI: comments, the guard, "Editar proyecto", reorder / delete for the teacher, "Cambios de tu docente", En progreso / Listo, filters, privacy notice; e2e `m27.spec.ts`                                  |
| (last)    | Project comments in the editor's side panel; the rule letting you register a new cover image; M15 e2e updated to D129; plan and this report                                                             |

## 3. Quality gate

| Check                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | ✅                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Unit                    | ✅ **266** (+16: save lock, unsaved / drafts, project comments and visibility, status and filters, "¿Vuelves a En progreso?", the version to keep, the student's order back)                                                                                                                                                                                                                                                     |
| Rules                   | ✅ **139** (+9 groups: comments private / public, classmates and old notes, students can't write or re-label; the teacher edits the details signed, not profile extras, not on a locked board; delete only with a copy, the student restores; status signed and consistent; the badge only the student clears; the teacher registers a cover). Updated to D129: the M15 "can't reorder" and M16 "teacher can't mark ready" tests |
| Worker                  | No Worker change (it already signed your uploads into a student's folder)                                                                                                                                                                                                                                                                                                                                                        |
| E2E                     | ✅ full suite **126 / 127**, then the one failure (M15 expected you could _not_ delete slides; D129 changed that) fixed and re-run with the related specs: **18 / 18**. `m27.spec.ts`: 7 tests                                                                                                                                                                                                                                   |
| Admin CLI               | ✅                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Build                   | ✅ main chunk 891 KB, 288 KB gzip (+34 KB: the save lock in 29 files and the new panels)                                                                                                                                                                                                                                                                                                                                         |

**How I ran the emulator tests:** your admin_grades_tool emulator held 8080 again. Partway through, another project's test run (`demo-streetcoach`) started on 8180. I didn't stop either of them. I ran this project's emulators on 8287 / 9297 with a temporary config outside the repo.

## 4. Your turn

1. `npm run deploy:rules` (comments, project edits, deleted slides, status, the teacher's cover)
2. `npm run update:web`
3. `git push`

No Worker deploy is needed.

## 5. Acceptance test (teacher + a student account)

1. **Presenter:** present a student with 2+ slides, press **N**, type a comment, press →. The question appears.
   - Try **Seguir escribiendo**, then **Guardar y continuar** (it moves after saving), then **Descartar** on another one.
2. **Public / private:** on the student's space page, **Comentar el proyecto** → **Público** → Agregar; on a slide, a comment left as **Privado**.
   - As a classmate, open that space: only the public one shows.
   - As the student: both, with 🔒 / 👥, and "Responder en Mensajes".
3. **Slow Wi-Fi:** on any save button, double-click. Only one thing is saved.
4. **Editar proyecto:** change the title and the cover. As the student, see "Cambios de tu docente" → Restaurar mi versión → Volver a la versión del docente.
5. **Editor as teacher:** drag a slide to a new place and delete one (the confirm says the student can restore it). As the student: Restaurar el orden, and Restaurar the deleted slide.
6. **Status:** as the student, 🚧 En progreso → the card shows it; ✓ Listo → "Presentar listos" includes them. Open the editor, change something on a slide, and see "¿Vuelves a En progreso?".

## 6. Assumptions (easy to change)

- **Comments start Privado.** Old notes stay private.
- **Public comments show only on the student's space page**, not in the presenter for the class (the panel stays yours).
- **When you edit the project,** the student's original version is what's kept, even after several edits by you.
- **The status stays Listo after your edits.** Only the student's own slide changes trigger "¿Vuelves a En progreso?", as a toast, not a window.
- **You still add slides only at the end, and don't duplicate.** The rules allow add-at-end, reorder and delete-with-copy, which covered everything you asked.
- **Drafts live in the browser tab** (session storage). A draft typed in the projected window isn't asked about when the other window ("Vista del docente") moves it, because the question would show on the projector. The draft comes back when you return to that slide.
- **Backups:** teacher's notes were never in the backup, so comments aren't either. Deleted-slide copies aren't in it (like M15 versions).
- **Status labels:** "Listo" replaces "Lista" on cards and Presentaciones, and the toast now says "Marcaste tu proyecto «Listo»".

## 7. Issues / risks

- **Not automated:**
  - "¿Vuelves a En progreso?" needs drawing in Excalidraw; it is unit-tested, so please try it once (step 6).
  - The 8 s "Sigue guardando…" hint never shows on the fast emulator.
- **A comment made public by mistake:** anyone who had the page open saw it until you switch it back.
- **The "Sigue guardando…" hint** sits beside the button. In a few right-aligned dialog footers it may look slightly off when it appears.
- **Free tier:** a comment = 1 write (+1 for the "Comentario nuevo" badge); a status change = 1 write. A deleted slide is kept as a copy (≤ 900 KB) until the student restores or removes it; its images count as used. Nothing new listens in the background.

## 8. Next loop

Nothing else is planned. M9 (more teachers) waits until you need it.
