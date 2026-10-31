# Loop 16 — M18 Students' emails and attendance

2026-10-31 · commits listed in section 2

## 1. Summary

- **"Correos"** (teacher → Administrar → Estudiantes): pick who receives it (everyone · a group · a stage · ready / not ready · **absent on a date**), untick anyone, then **Copiar correos**, **Escribir correo** (opens your mail app with everyone in **BCC**, split into several messages when the list is too long) or **Descargar CSV**. One email per student by default (the one they actually sign in with), or "todos sus correos". The app never sends email.
- **"Asistencia"** (board header and Administrar): pick the date (today by default), an optional topic, **"Todos presentes"**, then one tap per student: **Presente · Tarde · Ausente · Excusa** (tap again to clear), plus an optional note. Nothing is written until **"Guardar asistencia"**, and the page warns before you leave with unsaved changes.
- **Historial:** the class dates (newest first) with their counts. Click one to edit or delete it. A **students × dates table** shows each student's **% attendance**; any cell can be fixed from the table. **CSV** for the university's records (semicolons, opens in columns in Excel with Colombian settings).
- **Students** see **only their own** attendance on their space page ("Mi asistencia · 50 % de asistencia" + dates and states), never the teacher's notes and never a classmate's.
- Attendance goes into the **board backup**, comes back on **restore**, moves to the kept student on **merge**, is deleted when a **student is removed**, and is deleted on **purge** (app and CLI). The privacy notice says so.

## 2. Done

| Commit    | What                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `95598f7` | Model (`attendance/{date}`, `attendanceByStudent/{studentId}`) and rules: teacher-only records; a student reads only their own summary; rules tests     |
| `24f3fa0` | Pure logic: counts, rate, summary changes, "Todos presentes"; preferred email, BCC batches; CSV (no formula injection); unit tests                      |
| `1229fb1` | Data layer: a day + the changed students' summaries in one batch; merge / removal; backup, restore, purge (app + CLI)                                   |
| `4719b43` | UI: Correos dialog, Asistencia page (take + history + table + CSV), the student's own view, board header and Administrar links; es / en; privacy notice |
| `ffc85df` | E2E; menus now close after picking (also fixes the Etapa / Avance filters from earlier today)                                                           |

## 3. Quality gate

All green, after one test fix (see below):

| Check                          | Result                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                            |
| Unit                           | ✅ **162** (+15: counts, rate with excused days, summary changes, unsaved-change detection, local dates, preferred email, BCC batches, CSV escaping / formula injection, backups with and without attendance) |
| Rules                          | ✅ **103** (+4: teacher writes / validation, students and other teachers refused, a student reads only their own summary from either account)                                                                 |
| Worker                         | ✅ **46**                                                                                                                                                                                                     |
| Worker integration · Admin CLI | ✅ · ✅ (purge now also deletes attendance)                                                                                                                                                                   |
| E2E                            | ✅ **85** (+4: take attendance → table → fix → CSV → the student's view; edit / delete a past day; removing a student; emails with filters, copy and BCC)                                                     |
| Build                          | ✅ (the attendance page is its own 14 KB chunk, teachers only; main chunk 666 KB, 222 KB gzip)                                                                                                                |

**Test fix (not a product change):** the teacher-notes e2e test (M13) failed once in the full run. After "Agregar", the new note shows at once from the local cache while the add form still says "Guardando…" until the server confirms. Under load, the test clicked "Editar" during that window and found two note boxes. The app behaves correctly; the test now waits for the add box to close. It existed before this loop (the Loop 14 report mentions occasional timeouts in slow runs).

## 4. Your turn

```bash
npm run deploy:rules   # attendance rules (required: without them the page can't read or save)
npm run update:web     # or `npm run release` for everything with all tests
git push
```

Loop 15 still needs `npm run worker:deploy` (the Canva check) if you haven't run it.

## 5. Acceptance test (in class)

- [ ] Board → **Asistencia** → "Todos presentes" → mark one student **Tarde** with a note and one **Ausente** → **Guardar asistencia**.
- [ ] **Historial**: the day appears with its counts; the table shows the %; change a cell to **Excusa**; **Descargar CSV** and open it in Excel. Check that the columns split and the accents look right.
- [ ] As that student (real account): the space page shows **Mi asistencia** with the date and the state, without your note. A classmate's space doesn't show it.
- [ ] Administrar → **Correos** → filter by **Equipo** or by "Ausentes el …" → **Escribir correo**: Gmail or Outlook opens with them in BCC. Also try **Copiar correos**.

## 6. Assumptions (change any of them)

- **D63–D68 taken as proposed** ("next"): one email per student by default (the account they joined with most recently, else the first on the roster), with a "todos sus correos" switch; copy / mail app / CSV, no sending; four states; teacher-only marking; students see only their own.
- **Rate** = (Presente + Tarde) / (marked days − Excusa). An excused day doesn't count against the student, and an unmarked day doesn't count at all.
- **The teacher's notes stay private:** students see dates and states only.
- **CSV uses semicolons + UTF-8 BOM**, which works in Excel with Spanish (Colombia) settings and in Google Sheets. Tell me if your Excel expects commas.
- Attendance can be taken and edited **on archived boards too**: they are records, not class work.
- The board header gets one more teacher button ("Asistencia", an icon on phones).

## 7. Issues / risks

- `mailto:` links are capped at ~1,800 characters per message (about 40–60 addresses), so bigger lists open several messages. **"Copiar correos" always works** for any size.
- If two teachers edit the same date at the same time, the last save wins. Unlikely with one teacher per board.
- Free tier: one class = 1 + (changed students) writes (≈ 20 for 17 students); the history reads one document per class date.

## 8. Next loop

**Loop 17 · M21 Status, profile decorations and board styles** (Navidad ready before December 1). Before it, please confirm or change D70–D77:

- Can the teacher clear a student's status (D71)?
- Should "Necesito ayuda" show a counter and a filter for you (D72)?
- Which seasonal styles do you want besides Navidad (D74)?
- Should Santa hats on photos be on by default in Navidad (D75)?

Then say "run loop 17" (or "next").
