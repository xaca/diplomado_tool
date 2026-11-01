# Loop 22 — M23 Recorded classes ("Grabaciones")

2026-11-01 · commits `932d9ca`..(last) · D94, D96–D98 taken as proposed; **D95 changed** (your request: "this list will continue growing")

## 1. Summary

- **Administrar → 🎬 Clases grabadas.** Paste a YouTube playlist link (a video link with `&list=…` works too) and a title. **Revisar** shows the classes YouTube has before saving, and warns about any that can't play inside the app. You can add several playlists, reorder them, rename them, give a class your own title, hide a class, or remove a playlist from the app. YouTube itself is never changed.
- **Classes appear on their own (D95, changed).** The app reads the playlist again whenever someone opens it, at most once every 5 minutes per browser. When you add a new class to the playlist on YouTube, it shows up at the end, marked **"Más reciente"**, with no button to press. The saved copy makes the page open instantly; your browser keeps it up to date.
- **A "Grabaciones" tab** (Tarjetas | Clases | Grabaciones | Logros). It lists each playlist's classes in YouTube's order, oldest first and newest last, with thumbnail, length and the student's own progress ("Vas en 23:10" or ✓ Vista). Two buttons: **"Ver la última clase"** and **"Seguir donde quedé"**.
- **Study player.** YouTube's player in privacy-enhanced mode, with a bar under it:
  - controls: ⏮ previous class · ⏪ 10 s · ▶/⏸ · 10 s ⏩ · next class ⏭ · speed 0.75–2× · full screen
  - keyboard: space or K to pause, ← → or J L for 10 s, < > for speed, F for full screen
  - the class list sits beside the player (below it on phones)
  - opening a class resumes where you left off; at 90 % it counts as watched and the next class that plays here is offered
- **The teacher sees who watched:** "12 de 18 la vieron" under each class, with the names on hover. Classmates never see each other's progress.
- **Checked with your playlist** (`PLO2HxDUbp3FU`, "02 - Diplomado UX / UI") against the real YouTube: the 7 unlisted classes from 02 to 23 Octubre were found with their titles and lengths (2:03:47 to 3:48:13), in order, and played with ±10 s, 1.5× and the position saved.

## 2. Done

| Commit    | What                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `932d9ca` | Model + rules: playlists (the board's teacher writes, members read); each member's own progress (the teacher reads all); rules tests             |
| `aa06780` | Logic: playlist links, merging the live playlist with what was known, titles / hidden, times, resume, watched at 90 %, save throttle; unit tests |
| `7c4381c` | YouTube wrapper (hidden reader + player), Grabaciones tab, study player, Administrar panel, Spanish / English texts, privacy notice              |
| `51fcdb8` | Backup / restore (playlists with your titles and hidden classes; not students' progress), purge (app + CLI), removing a student                  |
| `b7e1543` | E2E with a fake YouTube player (the tests never call YouTube)                                                                                    |
| (last)    | Report and plan                                                                                                                                  |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                                                         |
| Unit                           | ✅ **220** (+17: playlist links, merging the live list, titles / hidden, times, resume, watched at 90 %, save throttle, next unwatched, who watched; playlists in the backup)                                                                                                              |
| Rules                          | ✅ **122** (+2: only the board's teacher links, edits and deletes playlists, members read them; each student saves only their own progress, the teacher reads all and removes it)                                                                                                          |
| Worker                         | ✅ **46** (no Worker change)                                                                                                                                                                                                                                                               |
| E2E                            | ✅ **107** (+3: link and review a playlist, a class added on YouTube appears on its own and newest last; ±10 s, speed, resume, watched at 90 % with the next playable class offered, a blocked video explains itself, the teacher sees who watched; the teacher renames and hides classes) |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                                                                    |
| Build                          | ✅ (main chunk 816 KB, 267 KB gzip, +30 KB; YouTube's player script is loaded only on the Grabaciones pages)                                                                                                                                                                               |

## 4. Your turn

```bash
npm run deploy:rules   # required: playlists and progress are new collections
npm run update:web
git push
```

Then, in the app: **Administrar → Clases grabadas → Agregar lista de YouTube**, paste
`https://www.youtube.com/watch?v=VB-lKjtbZk8&list=PLO2HxDUbp3FU`, give it a title, **Revisar**, **Guardar**.

On YouTube, for every class you add, two settings:

- **Visibilidad: No listado.** Not "Privado", or it can't play inside the app.
- **Permitir inserción: on.** It's on by default; the panel warns you about any class where it isn't.

## 5. Acceptance test

- [ ] As the teacher: link the playlist; **Revisar** lists the 7 classes, then **Guardar**.
- [ ] As a student: **Grabaciones** shows 7 classes, newest last; **Ver la última clase** plays 23 Octubre.
- [ ] Use ±10 s, change the speed, pause, go back: the list says "Vas en …"; open the class again and it resumes there.
- [ ] Upload a new class to the playlist on YouTube, then open Grabaciones (as anyone): it appears at the end as "Más reciente", with nothing done in the app.
- [ ] As the teacher: under each class, "N de 18 la vieron"; hover to see who.
- [ ] Hide a class (Editar lista → the eye): students stop seeing it.

## 6. Assumptions (change any of them)

- **Order:** YouTube's order (you add new classes at the end, so the newest is last), and the latest is marked. If you'd rather see the newest first, it's a one-line change.
- **The read happens in the viewer's browser**, at most every 5 min. Only the teacher's browser saves the updated list; students' browsers just show it, because the rules can't check what YouTube says. Students see new classes as soon as they open the tab either way.
- **YouTube's own controls stay on** (captions, quality, its progress bar). The study bar adds ±10 s, previous / next, speed and the keyboard. I didn't build a second progress bar.
- **Watched** is reached at 90 % of the class and never goes back. A student who skips ahead to 90 % also gets it; the app doesn't check what was actually seen.
- **The backup keeps the playlists** (with your titles and hidden classes) but not students' progress, the same as announcement read state.
- Watching a recording doesn't unlock an achievement. One could be added to Logros ("Primera clase grabada vista").

## 7. Issues / risks

- **"Unlisted" isn't private:** anyone with a video's link can watch it. The panel says so; the app doesn't change it.
- **The playlist is read through YouTube's embedded player**, an informal but stable behavior (the player API's `getPlaylist`), because the official Data API needs a key. If YouTube changes it, the saved list keeps working and only new classes would stop appearing on their own; the code is in one small file (`src/features/recordings/youtube.ts`).
- **Free tier:** progress is about 1 write per minute while playing, plus one on pause or leave. Your classes run about 2–4 h, so 18 students watching a whole class is about 3 K writes, well under the 20 K/day limit. Reading the playlist costs nothing on Firebase; YouTube serves the video.

## 8. Next loop

Nothing planned. Deploy this, try it with your playlist, and tell me what's next. M9 (more teachers) is still waiting for when you need it.
