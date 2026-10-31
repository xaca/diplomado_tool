# Loop 14 — M16 Teacher's class tools

2026-10-31 · commits listed in section 2

## 1. Summary

- **Class clock:** the teacher clicks **"Reloj"** on the board → activity (name, instructions, 3 · 5 · 10 · 15 · 25 min or custom) or **break** (5 · 10 · 15). Everyone sees a live **countdown banner** on the board, their space page and the **slide editor**; amber in the last minute, **"¡Tiempo!"** at zero. Pause / Reanudar, **+1 min**, Terminar.
- **Focus view** `/b/:boardId/focus` for the projector: huge countdown with a progress ring, the activity and its instructions; optional chime on the teacher's device.
- **Break screen:** big countdown + a **Lottie animation that changes randomly every 20 s** (no repeats until all were shown), crossfaded; still with "reduce motion".
- **Polls in each student's space:** the student (own space) or the teacher (any) creates one: question, 2–6 options, optional anonymous. Classmates **vote once** (both accounts of a person count once), can **change the vote** while open, results **live**. The author sees who voted unless anonymous; the teacher always. Close / reopen / delete. While presenting, the teacher opens the student's polls with live results.
- **"Mis diapositivas están listas":** the student marks it (space page and editor), the card shows **✓ Lista**; teacher filters **Listos · Con diapositivas · Sin diapositivas** (with the stage filter) and **"Presentar listos"**.
- Also: the long-flaky M5 reorder e2e test is fixed (it now waits for the drag library's announcements).

## 2. Done

| Area       | What                                                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model      | `board.clock` (activity / break, duration, start, pause), `PollDoc` (options, `optionIds`, `counts`), `VoteDoc`, `space.readyToPresent`                                                                          |
| Rules      | Clock teacher-only with valid values; ready flag owner-only; polls by owner / teacher; votes one per student, **counts must move with the vote** (no fake totals); voters readable per anonymity                 |
| App        | `ClockControls`, `ClockBanner` (board, space, editor), `FocusPage`, `BreakAnimation` (lazy `lottie-web` light), `PollsSection` / `PollCard`, presenter polls overlay, `ReadyToggle`, filters, "Presentar listos" |
| Animations | 5 **original** Lottie animations (Respira, Sol, Burbujas, Café, Puntos; 2–5 KB each) in `public/lottie/` + `manifest.json` (name, license, source)                                                               |
| Data       | Polls and votes deleted with the student and on purge (app + CLI); not part of backups                                                                                                                           |

## 3. Quality gate

| Check                   | Result                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | ✅ (minified Lottie files excluded from Prettier)                                                                                                                                               |
| Unit                    | ✅ **137** (+11: clock math, pause / +1 min, rotation, tallies, ready filters)                                                                                                                  |
| Rules                   | ✅ **99** (+7: clock, ready flag, poll creation, voting / inflation / other's vote, closed polls, who can see voters)                                                                           |
| Worker                  | ✅ **43**                                                                                                                                                                                       |
| Worker integration      | ✅                                                                                                                                                                                              |
| Admin CLI               | ✅                                                                                                                                                                                              |
| E2E                     | ✅ **77** (+5: live clock in a student's editor with pause / +1 min / stop; "¡Tiempo!"; focus + break with animation; poll vote / change / voters / close; ready → filter → "Presentar listos") |
| Build                   | ✅                                                                                                                                                                                              |

## 4. Your turn

```bash
npm run release   # tests, then Worker → rules → Hosting (Loops 10, 12, 13, 14)
git push
```

**Break animations (D53):** I couldn't verify LottieFiles licenses from here, so the five animations are original (made for this app, no license issue). To add LottieFiles ones: download the **Lottie JSON**, check it's under the **Lottie Simple License**, save it in `public/lottie/` and add `{ file, name, license, source }` to `public/lottie/manifest.json`. Send me the links if you want me to add them.

## 5. Acceptance test (in class)

- [ ] Teacher: **Reloj** → "Lluvia de ideas", 5 min → Iniciar; students see the banner while editing their slides. Pause, +1 min, Terminar.
- [ ] **Vista enfocada** on the projector; turn on "Sonido al terminar"; let a 1-min activity reach "¡Tiempo!".
- [ ] **Descanso** 5 min → the projector shows the break screen; the animation changes every 20 s.
- [ ] A student creates a poll on their space; classmates vote and change their vote; the author opens "Quién votó"; you close it; while presenting that student, open the polls (📊).
- [ ] Students mark **"Mis diapositivas están listas"**; filter **Listos**; **Presentar listos**.

## 6. Assumptions (change any of them)

- D48–D54 taken as proposed ("go").
- Teachers don't vote in students' polls (they moderate and see results).
- "≤ 3 open polls per space" is enforced by the app (the rules can't count documents).
- Anonymous polls hide names everywhere in the app; the database still keys each vote by the student (needed for one vote per student), so a teacher with database access could look it up — stated in the privacy notice terms ("en la app").
- Device clocks can differ by a few seconds; the countdown is computed on each device from the shared start time.
- Deleting an anonymous poll as its student author can't list the votes, so those few vote records stay until the board is purged (they're invisible and harmless).

## 7. Issues / risks

- Free tier: the clock costs 1–4 board writes per activity and no extra reads; each vote = 2 writes; Lottie files ≈ 17 KB total, cached.
- `lottie-web` (MIT) is loaded only on the break screen (its own chunk).

## 8. Next loop

**Loop 8 — M10 Class participation** (whole-class shared slides; also whole-class polls). Confirm or change **D12–D17**, then say **"run loop 8"**.
