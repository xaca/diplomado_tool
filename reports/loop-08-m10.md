# Loop 8 — M10 Class participation: the sticky-note wall

2026-10-31 · commits listed in section 2 · D13, D14, D16, D81–D83, D87 taken as proposed ("run loop 8")

## 1. Summary

- **Clases** next to **Tarjetas**: a "Clases" button on the board header and a **Tarjetas | Clases** switch on the class pages. **Tarjetas is unchanged** (one button added to its header; every existing test still passes).
- **The teacher prepares a class:**
  - "Nueva clase" asks for a title, a date and the first prompt. Then up to **5 slides**, each with a prompt (question + instructions).
  - Each slide has a **layout**: Libre, 2 columnas, 3 columnas or Matriz 2×2, with zone titles.
  - A new class starts **closed**. **Abrir clase** lets the students write.
- **Students on the wall:**
  - **"Agregar nota"** or **double-click an empty spot** → a sticky note there (≤ 200 characters, 6 paper colors), with the name on their card.
  - They **drag**, edit and delete **only their own** (up to 20 per slide). They **react** 👍 ❤️ 💡 😂 🎉 ❓ to anyone else's (hover shows who).
  - Everything is **live** for everyone: notes pop in, moved notes glide, reactions count up. The first note gets an encouraging message (M20).
- **The teacher controls the space:**
  - Moves, edits (marked "✎ editado por el docente") and deletes **any** note, and adds their own (marked "Docente").
  - **Bloquear** a slide; **Ordenar** (tidy notes into a grid per zone); **Vaciar** (with confirmation).
  - **Seguir al docente:** students' screens follow the teacher's slide; they can look at another and "Volver con el docente".
  - **Presentar:** full screen, ←/→, live; with "Seguir al docente" on, presenting moves everyone.
- **Lista** view (default on phones): the same notes as a list, with the same actions.
- **Closed class, locked slide, archived board:** students only read, with a notice saying why.
- **Backups** include classes, slides, notes and reactions; **restore** brings them back with the same authors; **purge** (app and CLI) deletes them. Removing a student keeps their notes (D15).

## 2. Done

| Commit    | What                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `3c1338d` | Model + rules: classes and wall slides (teacher), sticky notes (own id `{uid}_{1..20}` caps the count; the author edits / moves / deletes; anyone reacts with their own key only; the teacher changes anything); rules tests |
| `cc285c2` | Wall logic: zones, notes kept inside, free spot, nudge, "Ordenar" per zone, list order, reactions, note ids, following the teacher; unit tests                                                                               |
| `d03eadc` | Data layer + live hooks (only the slide on screen, D87); es / en                                                                                                                                                             |
| `3b9e122` | Pages: Clases list, the wall (drag with mouse or finger, saved on drop), Lista view, teacher bar, prompt / layout dialog, presenter; the "Clases" button on the board; first-note cheer                                      |
| `49e5323` | Backup (classes with notes and reactions), restore, purge (app + CLI); privacy notice                                                                                                                                        |
| `536cc57` | Notes carry the name on the student's card, not the Google account's                                                                                                                                                         |
| `376fd39` | E2E                                                                                                                                                                                                                          |
| (last)    | Report and plan                                                                                                                                                                                                              |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                                                                                         |
| Unit                           | ✅ **197** (+13: zones, notes kept inside, free spot and nudge, "Ordenar" per zone, list order, reaction toggle and counts, note ids up to 20, following the teacher; classes in the backup, ids must be their author's)                                                                                                   |
| Rules                          | ✅ **116** (+5: teacher-only classes and slides with checked content; a student's notes with their own id, name and student id, max 20; the author edits / moves / deletes, a classmate only reacts with their own key; the teacher changes anything and restores any author's note; closed / locked / archived read-only) |
| Worker                         | ✅ **46**                                                                                                                                                                                                                                                                                                                  |
| E2E                            | ✅ **100** (+5: create and open a class with a 2-column prompt, Tarjetas unchanged; two students live with reactions, a classmate's note can't be moved or edited, own drag saved; the teacher edits / tidies / deletes, list view; closed / locked / archived; follow the teacher and presenter)                          |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                                                                                                    |
| Build                          | ✅ (main chunk 759 KB, 250 KB gzip, +45 KB for the class pages)                                                                                                                                                                                                                                                            |

## 4. Your turn

```bash
npm run deploy:rules   # required: classes, slides and notes are new collections
npm run update:web
git push
```

No Worker or Cloudinary change: notes are text only (D83).

## 5. Acceptance test (in class)

- [ ] **Clases → Nueva clase**: title, date, "¿Qué aprendiste hoy?" → the wall opens, **Cerrada**.
- [ ] **Consigna** → 2 columnas, "Funcionó / Mejorar" → Guardar. **+ Diapositiva** for a second question.
- [ ] **Abrir clase**. Students open **Clases** on their phones or laptops and add notes; you see them appear.
- [ ] A student drags their note into the other column; a classmate reacts 💡; the count shows for everyone.
- [ ] You edit a student's note (it shows ✎), use **Ordenar**, delete one.
- [ ] **Seguir al docente** on, change slide: students' screens follow. **Presentar** on the projector.
- [ ] **Cerrar clase**: students see the notice and can only read.

## 6. Assumptions (change any of them)

- **A new class starts closed** so you can prepare it before class; "Abrir clase" is the first button.
- **Notes show the name on the student's card** (what the teacher typed or the student chose), not their Google account's.
- **Students can't react to their own notes** (D81), and reactions stop when the class is closed or the slide locked.
- **"Ordenar"** puts notes in each zone's grid, oldest first; when a zone is full, the rest stack slightly offset.
- **Moving a note doesn't mark it "editado por el docente"**; changing its text or color does.
- **Restoring a backup** writes students' notes under their names: the rules let the board's teacher create a note for any author, as long as the id is that author's (the teacher can already edit any note).
- **No picture on the prompt** (D83): the slide's question is text. Pictures can come later with a Worker change.
- **Slide order:** ← → in the teacher bar. Up to 5 slides; the last slide can't be deleted (delete the class instead).

## 7. Issues / risks

- **Free tier:** reads grow with notes × people watching that slide. Your 18-student board is about 7K reads per busy class; a 40-student class about 33K (the free limit is 50K a day). Only the slide on screen is listened to, and positions are saved on drop.
- **Several people dragging at once** never overwrite each other (one owner per note); if the teacher moves a note while its author drags it, the last drop wins.
- **Phones:** the wall shrinks with the screen, so phones start on **Lista**; the wall is there too (drag works with a finger).
- **Moderation** is manual: close the class, lock a slide, or delete notes.

## 8. Next loop

**Loop 20 · M22 Achievements (Logros):** a list of achievements per board with a counter of how many students unlocked each one; "Mis logros" for students, a "Logros" panel for you. Confirm or change **D84–D86 and D88**, then say "next" (or "run loop 20").
