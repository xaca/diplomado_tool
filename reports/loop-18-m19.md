# Loop 18 — M19 "Novedades": the teacher's announcements

2026-10-31 · commits listed in section 2

## 1. Summary

- **"Anuncios"** (teacher: board header and Administrar): write an announcement with a title, a message, an optional link (a page of the app or an https address) and **"Importante"**. The list shows **how many students read each one** ("1 de 3 leyeron") and three actions:
  - **Recordar:** new again for everyone, including students who had removed it.
  - **Editar.**
  - **Eliminar:** gone for everyone.
- **Students** get it **live**, with a **short chime**, a red badge on the **🔔** (next to their avatar on the board, their space page and the editor) and, if it's important, a **window** with "Entendido" (and "Abrir" when there's a link).
- **In the 🔔**, each announcement is **"Nuevo"** until opened, then **"Leído"**. It **stays until the student removes it** ("✕" or "Quitar leídos") or the teacher deletes it. A **"Silenciar sonido"** switch is remembered on that device.
- Announcements go into the **board backup** (not who read them), come back on restore, and are deleted on purge (app and CLI). Removing a student deletes their read state.

## 2. Done

| Commit    | What                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `54b7cfe` | Model + rules: announcements (teacher writes, members read; "Recordar" moves `remindedAt`), each member's read / removed state (own only; the teacher reads all for the counts); rules tests |
| `ba76f62` | Logic: Nuevo / Leído / removed, inbox order, badge, window queue, read count, arrivals, chime throttle; unit tests                                                                           |
| `3b86072` | Data layer + Web Audio chime (no file) with mute; es / en                                                                                                                                    |
| `f72727f` | 🔔 + window for students, "Anuncios" panel for the teacher; backup / restore / purge / student removal                                                                                       |
| (last 2)  | E2E (with the sound counted in the browser), report and plan                                                                                                                                 |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                     |
| Unit                           | ✅ **177** (+7: Nuevo / Leído / removed, a reminder brings it back as new, inbox order, badge, window queue and dismiss key, read count after a reminder, arrivals and the chime throttle, link validation, backup with announcements) |
| Rules                          | ✅ **110** (+3: only the teacher writes announcements and a reminder must use the server time, members read and outsiders can't, each member writes only their own read / removed state and the teacher can list them)                 |
| Worker                         | ✅ **46**                                                                                                                                                                                                                              |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                |
| E2E                            | ✅ **90** (+2: important announcement → chime, window, badge, read, removed, reminded back, deleted; a regular one only in the 🔔, app link, mute)                                                                                     |
| Build                          | ✅                                                                                                                                                                                                                                     |

## 4. Your turn

```bash
npm run deploy:rules   # required: announcements are new collections (also covers Loops 16–17)
npm run update:web
git push
```

## 5. Acceptance test (in class)

- [ ] Ask two students to keep the board open. **Anuncios → Nuevo anuncio**, check **Importante** → Publicar. They hear the chime and see the window.
- [ ] One clicks **Entendido**: your panel shows "1 de N leyeron".
- [ ] A **non-important** one with a link (e.g. `/ayuda/insertar`): only the badge. Opening it in the 🔔 changes it to "Leído", and **Abrir** goes to the page.
- [ ] A student removes one; you click **Recordar**: it comes back as "Nuevo" with the chime.
- [ ] **Eliminar**: it disappears for everyone.
- [ ] **Silenciar sonido** in the 🔔: the next one arrives without sound.

## 6. Assumptions (change any of them)

- **"Abrir" instead of "Probar"** (your call to me): it appears only when the announcement has a link.
- **The 🔔 is for students** (board members). Teachers manage everything from "Anuncios" and don't get a bell.
- **"Importante" is ticked by default** in the form (most class announcements are), so untick it for a quiet one.
- **Closing the window with ✕** hides it for that visit but leaves the announcement "Nuevo" in the 🔔. **"Entendido"** marks it read.
- **Chime:** at most one every 4 seconds (several at once = one sound). It doesn't play for what was already there when the student opened the app (the badge and window show it). Browsers block sound until the student has clicked on the page.
- **Read count** = students who opened it (or removed it) after the last reminder, out of the students on the board.

## 7. Issues / risks

- A student who removes an announcement and then gets it reminded sees it again: that's the point of "Recordar".
- Free tier: one listener per open board page on the announcements and one on the student's own state; one small write per read / removal (17 students × 1 announcement = 17 writes).

## 8. Next loop

**Loop 19 · M20 Encouragement messages and interaction animations** (the last in the current plan). Before it, confirm or change **D56–D58**:

- **D56:** encouraging messages + small celebrations, no points, rankings or leaderboards.
- **D57:** the moments: first slide, every 5 slides, slides marked ready, stage change, first vote, first embed, a teacher note received.
- **D58:** GSAP for micro-animations + a small confetti burst for milestones; off with "reduce motion"; a switch on `/me`.

Then say "next" (or "go").
