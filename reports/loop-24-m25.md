# Loop 24 — M25 Presentaciones (the students' own slides)

2026-11-07 · commits `c34dd16`..(last) · D126 and D127 decided by you; D120–D125 withdrawn

## 1. Summary

**First version (`c34dd16`, `d45eab9`):** you linked Google Slides and Google Forms in two new Administrar tabs, and students saw them embedded.

**Your review, the same day:** "the presentation needs to be only the slides from the student, no extra slides; in these slides they will add the Google Form for evaluation." So the milestone now works like this:

- **Presentaciones = each student's own slides, made in the app** (D126). Nobody links extra slides.
  - A card per student **with slides**: cover or color, name, title, "N diapositivas", **"Lista"** when they marked their slides ready.
  - **Ver** opens their slides. **Presentar** is there for you on every card, and for a student only on their own.
  - Students without slides are only counted: "3 estudiantes aún no tienen diapositivas".
  - **You:** **Presentar todas** and **Presentar listos**.
  - **A student:** "Tu presentación: N diapositivas", **Editar mis diapositivas**, **Presentar**, and the tip: "¿Te van a evaluar? Pon tu formulario de Google en una diapositiva: Editar → Insertar contenido → Google Forms. Tus compañeros lo llenan al ver tu presentación."
- **The evaluation is a Google Form inside the student's slides** (D127). This already worked since M14, and I checked it:
  - in the slides viewer and the presenter, the form is a live frame where filling in is allowed (`allow-forms`);
  - it has the "Cargando…" / "¿No carga?" states and an "↗ Abrir" link that opens it in a new tab;
  - a classmate opens the presentation (Presentaciones → **Ver**) and answers there;
  - the answers go to Google Forms, in whoever owns the form.
- **Removed:** the teacher-linked Google Slides, the **Evaluaciones** section, their two Administrar tabs, and their rules, backup fields and tests.
- **Kept:**
  - **one sections bar on every board page:** Tarjetas · Clases · Grabaciones · Presentaciones · Calendario · Logros;
  - **Administrar only for the board's own teachers;**
  - **tests can run beside your other project's emulators** (see §3).

## 2. Done

| Commit    | What                                                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c34dd16` | First version: teacher-linked Google Slides and Google Forms, sections bar, Administrar guard                                                                                                                                                              |
| `d45eab9` | Its e2e, test ports from the environment, plan and report                                                                                                                                                                                                  |
| `93e89eb` | Revision: Presentaciones lists the students' own slides with the form-in-a-slide guide; teacher-linked Slides / Forms and Evaluaciones removed (model, rules, backup, tabs, pages, tests); new e2e; plan (D126, D127; D120–D125 withdrawn) and this report |

## 3. Quality gate

| Check                   | Result                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | ✅                                                                                                                                                                                                                                                                                       |
| Unit                    | ✅ **239**: back to the M24 count. The Slides / Forms link and backup tests went away with that code                                                                                                                                                                                     |
| Rules                   | ✅ **124**: back to the M24 rules. This loop adds no rules                                                                                                                                                                                                                               |
| Worker                  | ✅ **46** (no Worker change)                                                                                                                                                                                                                                                             |
| E2E                     | ✅ **116** (`m25.spec.ts` rewritten, 4 tests: a classmate sees only presentations with slides and fills in the form inside one; the teacher presents all / ready / one, no Administrar tabs for slides or forms; the bar on every section page; a teacher of another course turned away) |
| Admin CLI               | ✅ (on the first version; the revision only removes from the purge what no longer exists)                                                                                                                                                                                                |
| Build                   | ✅                                                                                                                                                                                                                                                                                       |

**How I ran the emulator tests:** your admin_grades_tool emulator (`demo-grades`) holds ports 8080 / 9099, and its Vite server holds 5174. I didn't stop them. I ran this project's emulators on other ports with a temporary config. The rules tests, the e2e app and Playwright now take the ports from the environment (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `E2E_PORT`). The defaults are unchanged.

## 4. Your turn

```bash
npm run deploy:rules   # only if you deployed the first version's rules; otherwise Loop 23's are current
npm run update:web
git push
```

## 5. Acceptance test

- [ ] As a student: in your slides, **Insertar contenido → Google Forms**, paste your form's link → the form shows in the slide.
- [ ] As a classmate: **Presentaciones** → that student's card → **Ver** → fill in the form inside the slide → the answer arrives in Google Forms.
- [ ] Try the same on a phone, and in Safari. If the form doesn't load there, "↗ Abrir" works.
- [ ] As the teacher: **Presentar listos** presents only the students who marked their slides ready; **Presentar** on a card presents that student.
- [ ] Students without slides don't get a card; the count under the list says how many.

## 6. Assumptions (change any of them)

- **No first-slide preview on the cards:** the card shows the cover or the color, like Tarjetas. A preview would read every student's first slide (up to 1 MB each) whenever the page opens.
- **Classmates can't present someone else's slides.** They use **Ver**, which is where they fill in the form. Only the teacher, or the student themselves, presents.
- **Who owns the form:** each student (or team) makes and shares their own Google Form, so the answers reach them. You can also make the form and give students the link to put in their slides.
- **The app doesn't know who answered** (D127). Use Google Forms' "collect emails" if you need names.

## 7. Issues / risks

- **The form is as big as its box on the slide.** A long form scrolls inside the box, or opens full size with "↗ Abrir". Students should give the form a big box, or a slide of its own.
- **Forms limited to university accounts** may not load inside the app in Safari / Brave (third-party cookies). "↗ Abrir" always works.
- **Sharing:** the form must accept responses. If it's restricted to some accounts, those people must be signed in to Google.

## 8. Next loop

Loop 25 · **M26 Mensajes** (student ↔ teacher DMs). Confirm or change D113–D119 in the plan, then say "next".
