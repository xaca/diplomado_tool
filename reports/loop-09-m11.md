# Loop 09 — M11 Profile photo & Design Thinking stage

2026-10-31 · commits `88359a1..de205d3` (plan: `d5ddd2d`)

## 1. Summary

- On **Mi perfil** each person chooses their photo: **Google**, **an uploaded photo** (square crop in the browser, one file per person in Cloudinary) or **initials**. "Quitar foto" deletes the file.
- Each student marks **where they are in the Design Thinking process**, per board: Empatizando · Definiendo · Ideando · Prototipando · Evaluando, or **Vitrineando** (here to learn / no project yet). It shows as a **colored ring** around their photo; on large avatars the name is written along the ring, like #OPENTOWORK (`#IDEANDO`).
- The **teacher** sees how many students are in each stage, filters the board by stage, sets a student's stage (shown as "puesta por el docente") and can rename, recolor, reorder, add or remove stages per board ("Volver a Design Thinking" resets them).
- Backups and templates keep the stages; old backup files still restore.

## 2. Done

| Commit    | What                                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `88359a1` | Worker: `POST /uploads/sign` with `scope: 'avatar'` (teachers, or a member of the board they name) → `pbl/{env}/users/{uid}/avatar`, overwrite; `POST /avatar/delete`             |
| `afaa0ab` | Model (`photoSource`, `avatar`, `StageDef`, `DEFAULT_STAGES`, `space.stage*`, `board.stages`) and rules                                                                           |
| `1b3fdb2` | Profile photo picker + crop dialog + upload/remove; `StageAvatar`, `StagePicker`, `StageSummary`, `StagesPanel`; es / en texts; privacy notice                                    |
| `a2b08b9` | Ring on cards (own ring opens "Mi tarjeta"), space page (large, curved label, "desde …"), presenter; teacher filter; stages in backup / template / restore; demo seed with stages |
| `de205d3` | E2E: stage picking, Vitrineando, teacher summary / filter / set stage, stage editor, uploaded photo                                                                               |

Also fixed on the way: the **"Mi tarjeta" dialog now scrolls** (with the stage picker it was taller than the screen and "Guardar" was unreachable on short screens).

## 3. Quality gate

| Check                   | Result                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Typecheck, lint, format | ✅                                                                                               |
| Unit                    | ✅ **85** (+14: stages, photo choice, crop math, backup with stages)                             |
| Rules                   | ✅ **76** (+8)                                                                                   |
| Worker (offline)        | ✅ **37** (+3)                                                                                   |
| Worker integration      | ✅                                                                                               |
| Admin CLI               | ✅                                                                                               |
| E2E                     | ✅ **52** (+4). In the full run the known `m5` slides test timed out once and passed when re-run |
| Build                   | ✅                                                                                               |

## 4. Your turn

In this order (the app needs the Worker routes and the new rules):

```bash
npm run worker:deploy    # avatar upload / delete routes
npm run deploy:rules     # photo choice + stage fields
npm run deploy           # build + Hosting
```

Still pending from M8: App Check / reCAPTCHA steps ([M8 report](loop-07-m8.md#4-your-turn-launch-step-by-step)). **Open rules expire 2026-11-25.**

## 5. Acceptance test

- [ ] **Mi perfil** → "Subir foto" → move / zoom → Guardar: your card on the board shows the new photo. "Iniciales" + Guardar → initials. "Quitar foto" → back to Google's.
- [ ] As a student: "Editar mi tarjeta" → "¿En qué etapa vas?" → Ideando → Guardar: ring on the card; open your space: `#IDEANDO` along the ring.
- [ ] Choose "Vitrineando": dashed ring.
- [ ] As the teacher on the board: the stage chips show the counts; click one → only those cards; "Ver todos".
- [ ] As the teacher on a student's space: pick a stage → "puesta por el docente".
- [ ] Teacher board page → "Etapas del proceso": rename one, Guardar; the board chips use the new name. "Volver a Design Thinking".

## 6. Assumptions (change any of them)

- 5th stage = **Evaluando** (Stanford d.school "Test"). Stage names are gerunds so the ring reads as a status (#PROTOTIPANDO).
- The stage summary and filter are **for the teacher only**; students see the rings, not the counts.
- `/me` shows the photo without a ring (the stage belongs to each board, not to the person).
- Rules check stage ids by **pattern**, not against the board's list; a removed or unknown stage shows as "Sin etapa" (the value is kept, so restoring the stage brings the rings back).
- The uploaded photo is never part of a board backup (it belongs to the person); a restored board starts with no photos until students sign in again.
- Students prove they're in a class by naming one of their boards when uploading a photo (even an archived one).

## 7. Issues / risks

- **Deferred:** admin CLI `usage` / `cleanup --avatars`. Not needed for now: "Quitar foto" deletes the file and a new photo overwrites the old one, so avatars don't pile up (at most one per person, ~60 KB).
- Free tier: ~40 avatars ≈ 2.4 MB stored; a stage change = 1 write; no extra reads (stage and photo travel on the card).
- The `m5` slides e2e test is still slow / flaky in full runs (passes alone); unrelated to this loop.

## 8. Next loop

**Loop 8 — M10 Class participation.** Confirm or change **D12–D17** in PLAN.md, then say **"run loop 8"**. Class contributions will show each author's photo and stage ring.
