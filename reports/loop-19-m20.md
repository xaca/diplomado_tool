# Loop 19 — M20 Encouraging messages and interaction animations

2026-10-31 · commits listed in section 2 · D56–D58 taken as proposed ("continue")

## 1. Summary

- **Encouraging messages (students only):** a friendly toast with a popping emoji at the moments that matter. Each moment has three phrasings, picked at random (es / en). The moments are:
  - The **first slide**, then every **5 slides**.
  - The **first embed**.
  - Slides **marked ready**.
  - A **new Design Thinking stage** ("¡Pasaste a Prototipando!").
  - The **first profile photo**.
  - The **first vote**.
  - The **teacher's edits** or a **new note from the teacher** (live, or on the next visit).
- **Confetti** for the real milestones only (first slide, slides ready, new stage), at most one burst every 30 s. The same message never repeats within 30 s, so toggling "Lista" doesn't spam.
- **Once-only moments** (first slide, photo, vote, embed) are stored on the student's profile and never come back. Nothing about points, rankings or comparisons (D56).
- **"Mensajes de ánimo"** switch on `/me` (on by default). Off = the plain messages as before. With the system's **"reduce motion"**: messages yes, confetti and animations no.
- **Interaction animations:**
  - A new slide flies into the list; a deleted one shrinks away.
  - The "Lista" check draws itself.
  - Poll bars grow in.
  - Board cards lift a little on hover.
  - Already there: buttons press, dialogs zoom in, the 🔔 wiggles.

## 2. Done

| Commit    | What                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2658a58` | Model + rules: `users/{uid}.milestones` (known names only) and `cheer` (boolean); rules test                                                                          |
| `901181c` | Logic: moments, once-only milestones, 30 s confetti and repeat cooldowns, three phrasings, new teacher's notes; es / en messages; unit tests                          |
| `b8bb4e0` | Runtime: toast with a popping emoji, lazy confetti burst (own ~80-line canvas, no package), milestones saved once; the switch on `/me`                                |
| `b81c38e` | The moments wired where they happen; the message replaces the plain "saved" toast (no double toasts)                                                                  |
| `c71ca4f` | Interaction animations (CSS `scale` / `translate` so they never fight drag-and-drop or Flip); all off with reduce motion; cheers wait for the profile before counting |
| `543ab08` | E2E for M20                                                                                                                                                           |
| `aac1601` | Older e2e now expect the message where it replaces the plain toast                                                                                                    |
| `bbff692` | The slide canvas gets 15 s to appear in e2e (a busy full run took longer than 5 s)                                                                                    |
| (last)    | Report and plan                                                                                                                                                       |

## 3. Quality gate

`npm run check`: everything green except one browser test on the first run.

| Check                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Unit                           | ✅ **184** (+7: switched off, once-only moments, confetti only for milestones and one burst every 30 s, no repeat within 30 s, first slide then every 5, three phrasings, new teacher's notes)                                                                                                                                                                                                                                                                                  |
| Rules                          | ✅ **111** (+1: the switch is a boolean, milestones are known names only)                                                                                                                                                                                                                                                                                                                                                                                                       |
| Worker                         | ✅ **46**                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| E2E                            | ✅ **95** (+4: first slide celebrated once with confetti and slide-in, ready cheer with the drawn check; the `/me` switch; reduce motion; teacher's notes live and on the next visit, none for teachers). In the full run, 94 passed and 1 failed: the M17 Canva test waited 5 s for the slide canvas on a busy machine. It passed 3 times on its own, and the canvas waits now allow 15 s (`bbff692`). 5 older tests now expect the message where it replaces the plain toast. |
| Worker integration · Admin CLI | ✅ · ✅ (run separately after the e2e step)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Build                          | ✅ (confetti is its own small lazy chunk; main chunk 713 KB, 237 KB gzip, +3 KB)                                                                                                                                                                                                                                                                                                                                                                                                |

## 4. Your turn

```bash
npm run deploy:rules   # required: the profile accepts milestones and the switch
npm run update:web
git push
```

Deploy the rules **before** the web app. Otherwise the first milestone write is refused. The message still shows, but it would come back next time.

## 5. Acceptance test

- [ ] As a student with no slides: **Crear la primera diapositiva** shows a message and confetti. Delete it and create it again: no second celebration.
- [ ] **Mis diapositivas están listas**: a cheer, and the check draws itself. Unmark and mark again right away: no second message.
- [ ] **Editar mi tarjeta** → pick a new stage → "¡Pasaste a …!".
- [ ] As the teacher, add a note on the student's slide. The student sees "Tu docente te dejó una nota" (live, or next time they open their space).
- [ ] `/me` → turn off **Mensajes de ánimo**, mark ready again: only "Marcaste tus diapositivas como listas".
- [ ] With "reduce motion" on in the system settings: messages, no confetti.

## 6. Assumptions (change any of them)

- **Own confetti instead of `canvas-confetti`** (D58 proposed the package): the board styles already draw confetti on a canvas, so a short burst is ~80 lines and needs no new dependency. Same look, same lazy loading.
- **Teachers never get messages.** The moments are about the student's own progress.
- **Which moments burst:** first slide, slides ready and new stage. "Vitrineando" (browsing) is not a stage change worth celebrating, so it gets the plain "Tarjeta guardada".
- **Teacher's notes:** remembered per browser (not on the server). A student who opens their space for the first time on a new device doesn't get a message for old notes.
- **The switch is off = no message and no milestone stored.** Turning it back on later can still celebrate a first photo / vote / embed that happened while it was off.
- **Not done:** a number count-up animation (no screen shows a number that changes often enough to need it).

## 7. Issues / risks

- Tone: three phrasings per moment and the 30 s cooldowns keep it light. If it still feels too much for a diplomado, the per-student switch is there; tell me to make some moments quieter.
- Free tier: at most 4 one-time writes per student (the once-only moments) plus a write when they flip the switch.

## 8. Next loop

The current plan (M17–M21) is complete. What's left:

- **Loop 8 · M10 Class participation:** confirm or change **D12–D17** (format, limits, visibility, teacher powers, backup, where it lives), then say "run loop 8".
- **Before 2026-11-25:** the App Check steps from the [M8 report](loop-07-m8.md#4-your-turn-launch-step-by-step), so the open rules can be closed.
