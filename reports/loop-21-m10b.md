# Loop 21 — M10b Class slides drawn by the teacher (Excalidraw)

2026-10-31 · commits listed in section 2 · D89–D93 taken as proposed ("go")

## 1. Summary

- **"Diseñar"** (teacher bar) opens the same **Excalidraw editor** the students use for their slides: text, shapes, arrows, images, embeds ("Insertar contenido") and autosave. **"Listo"** goes back to the wall.
- **The drawing is the slide:** the wall shows it as its background and the sticky notes sit on top. Students see changes live; the presenter shows it big.
- **Students never draw** (D89). While the class is open they add notes and **react to the slide itself** (👍 ❤️ 💡 😂 🎉 ❓, next to the question; tap again to remove). The teacher sees the counts; when the class closes, reactions stop.
- **The question above the slide is optional** now (D91): the drawing can carry it. Layouts stay as guides for "Ordenar".
- **"Seguir al docente" is now "Llevar a todos a mi diapositiva"** (D90), with its explanation under the switch.
- The **reaction picker** fix from earlier today (all six emojis in a row) is included.
- **Backups** keep the drawings (image references) and the slide reactions. Cleanup counts images in drawings as in use.

## 2. Done

| Commit    | What                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eb5fac9` | The reaction picker shows the six emojis (it was squeezed to its button's width)                                                                                                                        |
| `3f1eff8` | Model + rules: the drawing on a class slide (teacher only, same limits as a student's slide), slide reactions (own key only, while students may write), class images in the board's folder; rules tests |
| `4c536ea` | "Diseñar": the slide canvas with a pluggable save / upload, autosaved onto the class slide; images through the board's own (teacher-only) upload                                                        |
| `c4ba640` | Drawing as the wall's background, slide reactions, "Diseñar" button, optional question, "Llevar a todos a mi diapositiva", presenter                                                                    |
| `6755508` | Backup / restore of drawings and slide reactions; images in drawings count as in use (app and CLI)                                                                                                      |
| `bec3b30` | E2E                                                                                                                                                                                                     |
| (last)    | Report and plan                                                                                                                                                                                         |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                     |
| Unit                           | ✅ **198** (+1: drawings and slide reactions in the backup, empty titles allowed)                                                                                                                                      |
| Rules                          | ✅ **118** (+2: only the teacher writes the drawing, within the size limit; members react to the slide with their own key while the class is open, not when closed; class images registered by the teacher only)       |
| Worker                         | ✅ **46** (no change)                                                                                                                                                                                                  |
| E2E                            | ✅ **102** (+2: the teacher draws with autosave, the student sees it live under the notes and can't open the designer; slide reactions while open, counts for the teacher, removed by tapping again, none when closed) |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                |
| Build                          | ✅ (main chunk 773 KB, 254 KB gzip, +14 KB; Excalidraw stays in its lazy chunk)                                                                                                                                        |

## 4. Your turn

```bash
npm run deploy:rules   # required: drawings, slide reactions and class images
npm run update:web
git push
```

**No Worker deploy needed:** D92 expected one, but the Worker already lets the board's teacher upload into the board's own folder (the logo uses it), and class images go there too.

## 5. Acceptance test

- [ ] Clases → a class → **Diseñar**: write a question, draw two boxes, add an image → "Guardado" → **Listo**.
- [ ] On a student's screen (class open): the drawing is there; they add notes on top and react 🎉 to the slide.
- [ ] You see the counts next to the question; **Presentar** shows the drawing big with the notes.
- [ ] **Cerrar clase**: the student can't add notes or react anymore.
- [ ] Turn on **Llevar a todos a mi diapositiva** and change slide: students' screens follow.

## 6. Assumptions (change any of them)

- **No Worker change** (see "Your turn"): class images live in the board's folder, like the logo.
- **The teacher doesn't react to their own slide** (the counts are what students think); students react only while the class is open and the slide isn't locked.
- **The drawing isn't clickable on the wall** (embeds play in the designer and the presenter); otherwise clicks would land on the drawing instead of adding notes.
- **One editor at a time:** only the board's teacher draws, so there's no edit lock or saved versions for class slides (unlike the students' slides edited by the teacher).
- **Not tested end to end:** uploading an image into a class drawing (it uses the same upload code as the logo, which is tested; the rules test covers registering it).

## 7. Issues / risks

- A drawing is read by every student on that slide each time it changes (autosave every few seconds while the teacher draws). Designing before class, or with the class closed, keeps reads low; during class it's one read per student per save.
- Very large drawings (many images) are limited like students' slides: 900 KB and 30 images.

## 8. Next loop

**Loop 20 · M22 Achievements (Logros):** the list of achievements per board with how many students unlocked each one. Confirm or change **D84–D86 and D88**, then say "next".
