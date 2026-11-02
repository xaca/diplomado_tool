# Loop 23 — M24 Administrar in tabs, class counter, calendar and emails

2026-11-01 · commits `9d92b36`..(last) · D100 and D107 decided by you; D101–D106 and D108–D112 taken as proposed

## 1. Summary

- **Administrar in six tabs:** Resumen · Estudiantes · Curso · Grabaciones · Comunicación · Ajustes.
  - Each tab has its own link (`/teacher/boards/…/course`), and the tabs scroll sideways on a phone.
  - The old Grabaciones link still opens the right tab.
  - **Resumen** shows the course counter, the next class, the schedule, how many students joined, "Enviar correo", "Resumen de la semana" and the upcoming news.
- **Configuración del curso** (Administrar → Curso). Every field is optional and you fill only what a course needs; with nothing set, the board works as before.
  - **Horario:** turn on the class days (L M X J V S D). Each day gets its own start and end time, and a room or a class link.
  - **Dates:** a start date, and an end date or a number of weeks. The app counts the classes and shows it as you type: "8 clases · la primera el martes 3 de noviembre, la última el sábado 28".
  - **Holidays:** "Cargar festivos de Colombia" (Ley Emiliani and the new Chiquinquirá holiday). Remove any that don't apply.
  - **Days off:** with a reason, e.g. "Receso".
  - **One-off changes:** move a class (it says "Movida del…") or add an extra class.
  - **A topic per week**, if you want one.
  - **A course without dates:** just type the total, e.g. 4.
  - **Ajustar clases dadas:** a ± 1 correction.
  - **"Mostrar «Clase 12 de 32» a los estudiantes":** a switch.
  - **"Copiar configuración de otro curso":** the schedule, times, places and length carry over to the new start date, and the holidays are loaded again for the new dates.
- **The counter, "Clase 4 de 7 · quedan 3 · Semana 2 de 4":**
  - **With dates,** it counts the class days already passed.
  - **Without dates,** it counts the days you took attendance or held a Clase. Your browser saves that number on the board, so students see the same count.
  - **Where it appears:**
    - Administrar → Resumen and Curso;
    - each course's card on your home page ("4 / 7");
    - the attendance page ("Clase 4 de 7", or "No hay clase: festivo…");
    - under the board's title for everyone: "Clase 4 de 7 · Próxima clase: mar 3 nov, 18:00".
  - At the end of the course it shows "Última clase", then "Curso terminado".
- **Students' Calendario.** It appears as a tab and a header button when the course has dates or news. It shows:
  - the counter, the next class (with the room or "Enlace de la clase"), and the schedule;
  - the weeks with their classes and holidays ("No hay clase: festivo (…)"), days off and news;
  - this week highlighted, and past weeks folded.
- **Novedades del curso** (Curso tab): an Entrega, Evento or Aviso on a date or a whole week, with text and a link. Each one can also be posted as an announcement 🔔, or emailed with the ✉ button.
- **Emails from your Gmail.**
  - **Recipients:** one email per student ("Hola, Laura:").
  - **Sender:** the name you set, from your Gmail, with **replies going to the address you set** (your university one).
  - **Before sending:** a preview of exactly what the first student gets.
  - **While sending:** progress ("Enviando 3 de 18…"). Then "Enviado a 17", the ones that failed, and **Reintentar**.
  - **"Correos enviados":** the history.
  - **Where you can send from:**
    - **Comunicación → "Enviar correo"**;
    - **Correos** (filter a group, a stage, absent on a date…) → "Enviar desde la app";
    - **Anuncios** → "También enviar por correo";
    - a news item's ✉;
    - **"Resumen de la semana"**: the week's classes with times and places, days without class, news and "Vamos en la clase 4 de 7". It is about the coming week once this week's classes are over.
  - **Permission:** the first send each hour opens Google's window to allow "Enviar correos en tu nombre". Nothing is stored.

## 2. Done

| Commit    | What                                                                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `9d92b36` | Course module: the class dates as the single source (total, classes given, next class, weeks, state, summary, copy) and Colombian holidays; setup, news, sender and email log in the model; unit tests |
| `d96db1a` | Rules: course setup and sender on the board, news, the email log; rules tests                                                                                                                          |
| `7cdc7ce` | Administrar tabs, Curso tab, counter everywhere, Calendario, news, emails (Gmail permission, one per student, preview, retry, history), texts es / en, privacy notice                                  |
| `1b8296e` | Backup / restore (course setup, sender, news; a template carries the setup), purge (app + CLI)                                                                                                         |
| (last)    | E2E (tabs, a 4-class workshop, a dated course, emails with a fake Gmail; older tests open the right tab), report, plan                                                                                 |

## 3. Quality gate

`npm run check`: all green. The first full run found 2 older e2e tests that expected panels now in other tabs. I fixed them, and **a new board now opens on Estudiantes**, since that's the first thing it needs.

| Check                          | Result                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                                                    |
| Unit                           | ✅ **239** (+19: class dates from schedule / dates / weeks, holidays, days off, moved and extra classes, total, classes given, next class, weeks, state, weekly summary, copy to another course; Colombian holidays; the MIME message and email content; backup)                      |
| Rules                          | ✅ **124** (+2: course setup and sender on the board, only the teacher writes; news and the teacher-only email log)                                                                                                                                                                   |
| Worker                         | ✅ **46** (no Worker change)                                                                                                                                                                                                                                                          |
| E2E                            | ✅ **112** (+5: tabs and old links; a 4-class workshop counted from attendance, seen by students; a dated course with holidays, a day off, a moved class, weeks, Calendario and attendance; emails with a fake Gmail; the composer from Correos, Anuncios, Novedades and the summary) |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                                                               |
| Build                          | ✅ main chunk 833 KB, 271 KB gzip (+17 KB). The holiday data (1.4 MB, 238 KB gzip) is its own chunk, downloaded only when you press "Cargar festivos"; students never download it                                                                                                     |

## 4. Your turn

```bash
npm run deploy:rules   # required: course setup, news and the email log are new
npm run update:web
git push
```

Then:

1. **Administrar → Curso** on each course: the schedule (days and times, room or link), start and end, then **Cargar festivos de Colombia**. For a short course, just the total.
2. **Comunicación → Configuración de envío:** your name as students should see it, and your university address under "Las respuestas llegan a".
3. **Send yourself a test email:** add yourself as a student (or untick everyone else) and press **Enviar correo**. The first time, Google says "Google no ha verificado esta app": choose **Avanzado → Ir a diplomado-fc679**, then allow **"Enviar correos en tu nombre"**.

## 5. Acceptance test

- [ ] Administrar opens on **Resumen**; each tab changes the address; the Grabaciones page's "Administrar" opens the Grabaciones tab.
- [ ] Diplomado: set the schedule and dates; the summary says how many classes; load the holidays; **Guardar** → "Clase N de M" with "quedan" and the week.
- [ ] Your home page shows "N / M" on the course's card; the attendance page says "Clase N de M".
- [ ] As a student: "Clase N de M · Próxima clase…" under the title; **Calendario** shows the weeks, this week highlighted, holidays and days off.
- [ ] A short course: only "Total de clases: 4"; take attendance → "Clase 1 de 4" for you and the students.
- [ ] Add a news item (Entrega) → students see it in Calendario; ✉ fills an email.
- [ ] **Enviar correo** to yourself: it arrives from your Gmail with your sender name; **reply** → the reply goes to your university address.
- [ ] **Resumen de la semana**: check the text and send it, or cancel.

## 6. Assumptions (change any of them)

- **Where students see the counter:** under the board's title by default; turn it off per course. The teacher always sees it.
- **Today's class counts as given** from the start of the day ("Clase 4" all day on the day of class 4).
- **A moved class** is two entries: a day off on the old date ("Movida al…") and an extra class on the new one ("Movida del…"). Delete either one to undo.
- **Holidays apply only to class days.** A Monday holiday shows in the calendar, but it changes nothing if there's no class on Mondays.
- **A typed total is used only when the dates can't give one.** With start, end and schedule, the dates decide; correct with ± 1.
- **The email log keeps the subject, who it went to and who failed**, not the message text. The backup leaves it out.
- **The weekly summary doesn't list new recordings:** the app doesn't know when a video was added to the playlist.
- **Libraries:**
  - `date-fns` 4.4.0 and `date-holidays` 3.37.0. I used 3.37.0 because 3.38.0 was only 8 days old, and 3.37 already has Chiquinquirá.
  - **mimetext was dropped:** it doesn't encode accented sender names like "Prof. García" the standard way (RFC 2047). The app builds the message itself.
  - `react-day-picker` and `@react-email` weren't needed: the form uses native date and time inputs, and the email template is hand-written HTML with inline styles that work in Gmail, Outlook and phones.

## 7. Issues / risks

- **Google's permission lasts about an hour.** A send after that opens Google's window again (one click, no password). If it expires in the middle of a send, the remaining students are listed as failed with **Reintentar**.
- **"Google no ha verificado esta app"** shows only to you, the first time. Students never see it: they are never asked for this permission.
- **Gmail's limit:** about 500 recipients a day on a personal account. The app sends at most 300 per press.
- **Holiday data** comes from a community library. Check the list before saving and remove anything that doesn't apply. The May "Ascensión" is renamed correctly (the library calls it "La Asunción"), and Easter Sunday is left out.
- **The counter without dates** depends on your browser saving "classes given" when you open Administrar, the board or Calendario. Students see the last saved number.
- **Not covered by e2e:** copying the setup from another course (unit-tested), and the real Google window (it can't run against the emulators). Test the latter by sending yourself an email.

## 8. Next loop

Nothing planned. Deploy, set up your courses and send the test email. Automatic weekly emails (e.g. every Monday at 7) could come later with Google Apps Script, as noted in the plan. M9 (more teachers) is still waiting.
