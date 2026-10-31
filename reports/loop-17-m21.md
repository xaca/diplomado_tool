# Loop 17 — M21 Status message, profile decorations and board styles

2026-10-31 · commits listed in section 2

## 1. Summary

- **"Mi estado"** (user menu and `/me`): a short message on your profile, like "🎃 ¡Feliz Halloween!" or "💪 Never quit". An optional emoji plus up to 60 characters, no links, with eight ideas to pick from or your own text. It shows under your name on your cards, in the user menu and, for teachers, next to "Docente:" in the board header. **The board's teacher can remove a student's message** on their board ("Quitar mensaje" on the space page).
- **Card decoration** (`/me`): a color, gradient or pattern **strip** on top of your card and space page (12 to choose from) and a **sticker** next to your name (16 emojis). Shown on every board.
- **Board styles** ("Personalizar" → "Estilo del tablero"), **only when the teacher picks one** (no seasonal default):
  - 8 everyday styles: Pizarra, Cuaderno, Papel kraft, Neón, Minimal, Retro, Acuarela, Blueprint.
  - 6 seasonal styles: **Navidad** (snow, twinkling lights on the header, pine pattern, Santa hats), **Amigo secreto** (hearts and gifts), **Halloween** (bats, pumpkins, witch hats), **Verano** (bubbles, sun and palms, sunglasses), **Feria de las Flores** (falling petals, flower garland and crowns), **Graduación** (confetti and caps tossed once, laurel, birretes, "¡Lo lograron! · Clase de 2026").
  - Each with: **background animation** (switch), **accessories on the students' photos** (switch, the teacher decides), a **line next to the title** (editable), and **optional dates** so a style switches on and back by itself.
- Animations are a lazy chunk, pause in hidden tabs, and **don't run at all with "reduce motion"**. Text stays readable on every style (contrast checked in tests).

## 2. Done

| Commit    | What                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `5c3be31` | Model + rules: `users.status / decor`, card copies `ownerStatus / ownerDecor`, the teacher may only clear a message, look fields `style / ambient / accessories / tagline / schedule`; rules tests |
| `90899c1` | 14 styles as data (colors, inline-SVG patterns, garland, animation, accessory), active style by date, card banners, message ideas; unit tests (contrast, rules list, dates)                        |
| `2a3dd20` | "Mi estado" editor (menu dialog + `/me`), decoration picker, shown on cards / list rows / space page / board header; teacher's "Quitar mensaje"                                                    |
| `285c985` | "Estilo del tablero" picker, board theme, header garland and title line, canvas animations, accessories on photos (board and space page)                                                           |
| (last 2)  | E2E; no canvas with reduced motion; profile tests use exact button names; report and plan                                                                                                          |

## 3. Quality gate

`npm run check`, all green on the first run:

| Check                          | Result                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                                                                                                                      |
| Unit                           | ✅ **170** (+8: every style readable on every color, style list = rules list, no seasonal default, dated styles, theme CSS, old looks still parse, message validation, banners)                                                                         |
| Rules                          | ✅ **107** (+4: message / decoration validation and links refused, owner copies them to the card and a classmate can't, the teacher may only clear a message, style / dates / title line validation)                                                    |
| Worker                         | ✅ **46**                                                                                                                                                                                                                                               |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                                                                                                                 |
| E2E                            | ✅ **88** (+3: message from the menu → classmates see it, banner and sticker → teacher clears; Navidad with garland, line, hats → hats off, own line → no animation with reduced motion; Graduación birretes and line, dated styles switch on and back) |
| Build                          | ✅ (animations are a 3.7 KB lazy chunk; main chunk 694 KB, 231 KB gzip, +28 KB for the styles, profile extras and accessories)                                                                                                                          |

## 4. Your turn

```bash
npm run deploy:rules   # required: messages, decorations and styles are new fields the rules check
npm run update:web
git push
```

Still pending if not done: `npm run worker:deploy` (Loop 15, Canva check). Loop 16's rules go out with the same `deploy:rules`.

## 5. Acceptance test

- [ ] As a student (real account): menu → **Mi estado** → pick "Never quit" → Guardar. A classmate sees it on your card.
- [ ] `/me` → **Decoración**: pick a strip and a sticker. Your card shows them.
- [ ] As the teacher, open that student's space → **Quitar mensaje**.
- [ ] **Personalizar → Navidad** → Guardar: snow, lights on the header, "¡Feliz Navidad!", Santa hats. Turn **Accesorios** off and the hats go. Try **Graduación** too (caps tossed once).
- [ ] **Usar en fechas**: Navidad from Dec 1 to Jan 6, then check the board switches back afterwards (or set yesterday → tomorrow to see it now).
- [ ] On a phone or an old laptop: scrolling stays smooth with the animation. With "reduce motion" on (system setting), no animation.

## 6. Assumptions (change any of them)

- **D71, D73, D76, D78 taken as proposed** ("go"): the teacher can clear a message; decorations never cover the stage or #DOCENTE rings; animations are capped and lazy, with a teacher switch; Graduación as described.
- **Removing a message is per board:** if the student saves their message again, it comes back on their cards. The teacher's removal is moderation, not a ban.
- **Accessories go on students' photos only** (the teacher keeps the #DOCENTE ring and cap badge), on the board and the space page; not in the presenter.
- **While a style is chosen, the "Fondo" and "Patrón" options are hidden** (the style sets them). Layout, order and the sticky header still apply. "Sin estilo" brings back the background you had.
- **Fonts stay the app's own** (no new font downloads); styles change colors, patterns, cards, header and animations.
- **Seasonal dates are typed by the teacher**, not preset (Feria de las Flores and Amigo secreto dates change every year).
- The messages and decorations are not in board backups (they belong to the person), but the board style is.

## 7. Issues / risks

- A message reaches cards on **active boards only**: archived boards keep the old card, like names and photos.
- Patterns are subtle on purpose. If you want them stronger on the projector, tell me which style.
- Free tier: a message or decoration change = 1 write + 1 per board you belong to. Styles are code (≈ 8 KB of SVG); the animation chunk loads only on boards that use one.

## 8. Next loop

**Loop 18 · M19 "Novedades"** (a window announcing new features to students + a 🔔 with summaries until they clear them). It can announce everything from Loops 15–17. Before it, confirm or change **D59–D62**:

- **D59:** app news written in code with each release.
- **D60:** can teachers write board announcements too?
- **D61:** one window per visit, items as pages, a "Probar" button.
- **D62:** the bell keeps summaries until cleared.

Then say "next".
