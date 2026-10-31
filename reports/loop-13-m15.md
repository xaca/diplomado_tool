# Loop 13 — M15 Teacher edits students' slides

2026-10-31 · commits listed in section 2

## 1. Summary

- The board's teacher edits a student's slides: **"Editar diapositiva"** under each slide on the student's space (and a pencil button in the presenter) opens the same editor with a banner "Editando la diapositiva de …". Text, shapes, drawings, images and embeds; **"Nueva"** adds a slide at the end. Reordering, duplicating and deleting stay with the student.
- **The student keeps control:** before the teacher's first change, the slide **as the student left it** is saved. The slide shows **"Editada por el docente · hace …"**, the card shows **"✎ Docente"** until they look, and they can **compare** both versions and **"Restaurar mi versión"** (with **"Deshacer"**).
- **One editor per slide:** whoever opens it holds it; the other sees it read-only ("Sebastian Cetina está editando esta diapositiva…") and gets the editor automatically when it's free. A closed tab's hold expires after 60 s.
- After changing a slide the teacher is offered **"Dejar una nota"** (pre-filled "Hice estos cambios: …").

## 2. Done

| Area   | What                                                                                                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model  | `lastEditedBy`, `teacherEditedAt`, `versionAssetIds` on slides; `slides/{id}/versions/{student,teacher}`; `spaces/{id}/locks/{slideId}`; `space.teacherEditsUnseen`                                                               |
| Rules  | Teacher saves signed as the teacher (board writable); append-only slide add; versions (teacher keeps the student's, student swaps); locks (fresh lock blocks, stale is free); badge; teacher image registry in the student folder |
| Worker | `POST /uploads/sign` also for the board's teacher into an existing student space (writable board)                                                                                                                                 |
| App    | Editor open for the board teacher (banner, sidebar without reorder / delete, add at the end, note prompt), `useSlideLock`, `TeacherEditBadge` (compare / restore / undo), card badge, presenter button                            |
| Data   | Saves replace only their fields (versions' images survive); versions and locks deleted with the slide, the student and on purge (app + CLI); versions' images count as used in the storage analysis                               |

## 3. Quality gate

| Check                   | Result                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | ✅                                                                                                                      |
| Unit                    | ✅ **99** (+4: when to keep the student's version, lock expiry, version images)                                         |
| Rules                   | ✅ **92** (+9)                                                                                                          |
| Worker (offline)        | ✅ **41** (+2)                                                                                                          |
| Worker integration      | ✅                                                                                                                      |
| Admin CLI               | ✅                                                                                                                      |
| E2E                     | ✅ **65** (+3: teacher edits + note → student compares / restores / undoes; teacher adds a slide; one editor at a time) |
| Build                   | ✅                                                                                                                      |

## 4. Your turn

Covers Loop 10 and Loop 13 if Loop 10 isn't deployed yet:

```bash
npm run worker:deploy    # teacher uploads into a student's slide (+ Loop 10 logos)
npm run deploy:rules     # teacher edits, versions, locks (+ Loop 10 look)
npm run deploy           # build + Hosting
git push
```

## 5. Acceptance test

- [ ] As the teacher, on a student's space: **Editar diapositiva** → banner with the student's name; change some text; "Guardado".
- [ ] "Dejar una nota" → write, Agregar.
- [ ] Sidebar: no drag, duplicate or delete; **Nueva** adds a slide at the end.
- [ ] As that student: card shows **✎ Docente**; the slide shows "Editada por el docente"; **Comparar** → both versions; **Restaurar mi versión**; **Deshacer**. The badge disappears after looking.
- [ ] Two browsers: the student in the editor, the teacher opens the same slide → read-only with the student's name; the student goes back to the board → the teacher can edit.
- [ ] Presenting: the pencil button opens the editor on the slide on screen.

## 6. Assumptions (change any of them)

- D42–D47 taken as proposed ("run loop 13").
- The note prompt is a banner button after the first save (not a dialog when leaving): less intrusive, same result.
- Only one "student version" is kept per slide: the one before the teacher's first change. If the teacher edits again before the student saves, that same version stays (the student's work is never replaced by an intermediate teacher draft).
- Undo after a restore puts the teacher's content back, saved by the student (so no "Editada por el docente" badge).
- Teachers can still delete slides at the database level (removing a student needs it); the editor never offers it.
- A slide's hold is released when leaving the editor inside the app; closing the tab leaves it for up to 60 s.

## 7. Issues / risks

- Free tier: a version ≤ 900 KB per slide the teacher changes; holds: ~3 writes / minute while editing.
- Older open tabs (before this deploy) keep working; the stale-build reload refreshes them.

## 8. Next loop

**Loop 12 — M14 Embeds that work** (confirm D36–D41) or **Loop 8 — M10 Class participation** (confirm D12–D17).
