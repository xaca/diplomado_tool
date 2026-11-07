# Loop 25 — M26 Mensajes (student ↔ teacher)

2026-11-07 · commits (last) · D114–D116, D118, D119 decided by you; D113 and D117 taken as proposed (you said "go")

## 1. Summary

- **One private conversation per student and course**, shared by the course's teachers. Classmates never see it. Text up to 1 000 characters; `https://` links can be clicked (other links stay text).
- **Students:**
  - **💬 next to the 🔔** on the board, on every section page and on the space / editor pages, with a badge when you've written.
  - **"Mensajes con tu docente":** the conversation, a day line ("Hoy", "Ayer", "12 oct."), and your messages with a **"Docente"** label.
  - **Writing:** Enter sends and Shift + Enter makes a new line. A draft is kept on the device.
  - **"Visto"** under their last message once you've opened it.
  - **The hint:** "Solo tú y tu docente ven estos mensajes. Se guardan con el curso."
  - **They can't edit or delete** what they sent.
  - **When you write while they're elsewhere in the app:** a toast "Tu docente te escribió" with "Abrir mensajes", and the chime from Novedades (same "Silenciar" switch).
- **You:**
  - **Your home page:** "1 mensaje nuevo" on the course's card.
  - **💬 on the board** with the count of conversations that have something new, plus a toast and the chime when one arrives.
  - **Mensajes** (`/b/…/mensajes`):
    - the conversations, new ones first, then "Sin responder", then the newest;
    - a search by name;
    - "Tú: …" when your message was the last one.
  - **Start one:** "Escribir a…" on the Mensajes page, the 💬 button on a student's row in **Estudiantes**, or **Mensaje** on their space page.
  - **Delete** a message (gone for both; the preview moves back to the one before), or **Eliminar conversación**.
  - **Marcar como no leído**, to come back to it later.
  - **Ver su espacio**, to open the student's space from the conversation.
  - **Administrar → Comunicación:** "Mensajes: 2 nuevos · 3 sin responder · Abrir mensajes".
  - **Removing a student** has "También eliminar sus mensajes", ticked by default. Unticked, the conversation stays as "Antiguo estudiante".
- **An archived course:** messages can be read, not sent.
- **Backup:** conversations go into the backup, not into a template. On restore they come back marked as restored, and nothing shows as new. Purge (app and CLI) deletes them.
- **Privacy notice:** a new section, "Mensajes con tu docente".

## 2. Done

| Commit | What                                                                                                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (last) | Model, rules and rules tests; pure logic and unit tests; API, hooks and UI (💬 in three headers, Mensajes page, thread, composer, home badges, Comunicación line, "Mensaje" on the row and space page, remove-with-messages); backup / restore / purge (app + CLI); privacy notice; texts es / en; e2e; plan and this report |

## 3. Quality gate

| Check                   | Result                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck, lint, format | ✅                                                                                                                                                                                                                                                                             |
| Unit                    | ✅ **250** (+11: unread and waiting, order, preview, `https`-only links, cooldown, day labels, "Visto"; the backup keeps conversations of students on the roster, not in a template)                                                                                           |
| Rules                   | ✅ **130** (+6: start and answer; classmates, strangers and other teachers can't read or write; only as yourself, with a real message, at most one every 2 s; no edits, only the teacher deletes, the preview can't point at a missing message; a restore; an archived course) |
| Worker                  | ✅ **46** (no Worker change)                                                                                                                                                                                                                                                   |
| E2E                     | E2E_RESULT                                                                                                                                                                                                                                                                     |
| Admin CLI               | ✅                                                                                                                                                                                                                                                                             |
| Build                   | ✅ main chunk 857 KB, 277 KB gzip (+17 KB)                                                                                                                                                                                                                                     |

The e2e runs found **three real bugs**, all fixed and covered:

1. **"Marcar como no leído" was undone right away:** the still-open conversation saw "unread" and marked it read again. Now opening marks it read once, and after that only a new message does.
2. **A message sent right after opening the page could be lost:** before the conversation had loaded, the app took it for a new one, the rules (correctly) refused that, and the message vanished. Now the composer waits for the conversation, and a message typed before that is sent as soon as it's ready.
3. **A delete could undo a newer reply.** If you deleted a message and closed the tab before it reached the server, the app's offline cache replayed it later, and the preview went back to your old message even if the student had answered since. Deleting is now a transaction: it isn't queued offline, and it only moves the preview back if the deleted message is still the newest.

After the fixes, `m26.spec.ts` passed 24 / 24 times in a row (6 repeats).

The emulator tests ran on separate ports because your admin_grades_tool emulator and dev server were running (as in Loop 24).

## 4. Your turn

```bash
npm run deploy:rules   # required: conversations and messages are new
npm run update:web
git push
```

## 5. Acceptance test

- [ ] As a student (another account or a student's): 💬 → write "Hola profe" → it shows with the time.
- [ ] As you: "1 mensaje nuevo" on the course's card, and the 💬 badge on the board. Open it → the badge goes; reply with a link.
- [ ] As the student: the badge and "Tu docente te escribió"; the link opens in a new tab; "Visto" under "Hola profe".
- [ ] From **Estudiantes**, the 💬 on another student's row → write to them first.
- [ ] Delete a message, "Marcar como no leído", "Eliminar conversación".
- [ ] On a phone: the list, then the conversation, and "Volver".

## 6. Assumptions (change any of them)

- **The badge counts conversations with something new**, not the ones waiting for a reply. "Sin responder" is shown in the list and in Comunicación. A reply you've read but not answered no longer shouts.
- **Names, not photos**, in the conversation, with a "Docente" label on yours.
- **The toast and chime** only come when something arrives while you're on another page of the app, never on the Mensajes page itself, and not for what was already there when you opened the app.
- **One read time for all the course's teachers.** If a co-teacher opens it, it's read for you too.
- **Drafts** stay in the browser on that device, per conversation.
- **Restored conversations** show the original names and times. They can't be told apart from new ones, except in the database (`restored`).

## 7. Issues / risks

- **An intermittent sign-in warning in tests:** twice during the e2e runs, the browser logged "[membership] auto-join / my boards failed" right after the tests switched accounts without signing out. Every test still passed, and it didn't show up in the final full run or in 6 more M26 runs. It also never appeared in the two earlier full runs. I couldn't pin it down. If a student ever doesn't see their course right after signing in, reloading the page runs the join again; tell me and I'll dig in.

- **No notifications outside the app** (your choice). If you don't open the app, messages wait. The badges on your home page are the safeguard; a daily email summary through Google Apps Script is the simplest add-on if needed.
- **The 2 s limit** stops floods, not rude messages. You delete them; removing the student from the course is the last resort.
- **Deleting is permanent** (for both sides), except in an earlier backup file.
- **Free tier:** a message is 2 writes. A class of 40 writing a few messages a week is a few hundred writes, far from the 20 000 a day.

## 8. Next loop

Nothing planned. Deploy Loops 23–25 and run the three acceptance tests. M9 (more teachers) is still waiting.
