# Loop 20 — M22 Achievements ("Logros")

2026-10-31 · commits listed in section 2 · D84–D86, D88 taken as proposed; run before Loop 22 as D99 proposes ("go")

## 1. Summary

- **🏆 Logros** per board: a **Logros** tab next to Tarjetas and Clases, and a "Logros" button in the board header.
- **14 achievements in 3 groups:**
  - **Proyecto:** first slide, 5 slides, 10 slides, first embed, slides ready, profile photo.
  - **Design Thinking:** first stage chosen, reached Prototipar, reached Evaluar.
  - **Participación:** first vote, first sticky note, first reaction, "Nota destacada" (a note of yours gets 5 reactions), "Constante" (notes in 3 classes).
- **Students** see their list:
  - unlocked ones in color with the date; locked ones in grey with how to get them;
  - on each one, **"12 de 18 lo lograron"** with a bar;
  - a summary, "Desbloqueaste 5 de 14". Never classmates' names.
- **The teacher** sees every achievement with its counter and bar; tapping one shows **who has it and who doesn't yet**.
- **Unlocking:** when it happens, the encouraging message (M20) gets a second line, "🏆 Logro desbloqueado: …" (one toast, not two). With "Mensajes de ánimo" off there's no toast, but it still unlocks.
- **Work done before counts** (D86): opening the board unlocks what's already true (slides, ready, stage, photo), **silently** the first time so nobody gets a flood of toasts.
- **Counts can't be faked:** a student's own record and the counter change together in one write, and the rules check both.

## 2. Done

| Commit    | What                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ba5c296` | Model + rules: each student's record (own, add-only, one key per write) paired with +1 on its counter; members read counts; the teacher reads all and fixes counts; rules tests |
| `ade3c14` | Logic: the 14 achievements, what's already true from a card and profile ("Vitrineando" doesn't count as reaching a stage), counters, "Constante"; unit tests                    |
| `0128dba` | Unlocking at the moments and from existing work, the joined toast, the Logros page, tab and button, removing a student lowers the counters, purge (app + CLI)                   |
| `9ff2708` | E2E                                                                                                                                                                             |
| (last)    | Report and plan                                                                                                                                                                 |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                      |
| Unit                           | ✅ **203** (+5: every achievement in a group, what's already true from a card and profile, "Vitrineando" isn't a stage reached, a teacher's own stage list, missing / counts / shares, "Constante")                                                     |
| Rules                          | ✅ **120** (+2: one key per write, always counted once — twice, uncounted, counted twice, unknown keys, someone else's record and a counter without an unlock are refused; own record only, counts for members, the teacher reads all and fixes counts) |
| Worker                         | ✅ **46**                                                                                                                                                                                                                                               |
| E2E                            | ✅ **104** (+2: first slide unlocks in the cheer's toast, counts without names for students; existing work counts silently, the teacher sees counters and who)                                                                                          |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                                 |
| Build                          | ✅ (main chunk 786 KB, 258 KB gzip, +13 KB)                                                                                                                                                                                                             |

## 4. Your turn

```bash
npm run deploy:rules   # required: achievements and their counters are new collections
npm run update:web
git push
```

## 5. Acceptance test

- [ ] As a student: open the board → **Logros**: what you already did is unlocked (no toasts).
- [ ] Create a slide / vote / write a note on a class wall → the cheer toast says "🏆 Logro desbloqueado: …".
- [ ] As the teacher: **Logros** → each achievement shows "N de 18 lo lograron"; tap one to see who has it and who doesn't yet.
- [ ] Remove a test student (Administrar): their achievements go and the counters go down.

## 6. Assumptions (change any of them)

- **"Foto de perfil" means an uploaded photo** (every Google account already has one).
- **"Llegó a Prototipar / Evaluar"** need those stages in the board's list (the Design Thinking defaults have them); a teacher's own list without them never unlocks them. Being further along also counts (Evaluar unlocks Prototipar too).
- **"Primera reacción"** counts reactions to notes and to class slides.
- **Total in "N de 18"** = students with a card on the board.
- **Not in the backup** (D86): a restored board starts with zero counts; students' existing work unlocks again when they open it (votes, embeds, notes and reactions don't come back).
- **Teachers have no achievements** (it's about the students' own progress).

## 7. Issues / risks

- Free tier: at most 14 small writes per student per board, ever (plus one per new class with notes for "Constante").
- Two browser tabs of the same student may both try to unlock at once; the second is refused by the rules (logged as a warning, nothing breaks).
- The e2e log shows one such refused unlock: a test leaves a second student's browser open while the next test resets the data. It's a test artifact, not something students will see.

## 8. Next loop

**Loop 22 · M23 Recorded classes (YouTube):** the teacher links playlists of unlisted videos in Administrar; students get a "Grabaciones" tab with a study player (±10 s, speed, resume, watched ✓). Confirm or change **D94–D99**, then say "next".
