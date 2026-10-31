# Loop 15 — M17 Canva and the embed options

2026-10-31 · commits listed in section 2

## 1. Summary

- **"Insertar contenido" shows the options first:** 15 service tiles, **Canva on top** ("Presentaciones, infografías, pósters y videos de Canva"). Picking one shows its sharing steps and focuses the paste box; pasting right away still recognizes any service.
- **Canva's embed code works:** Compartir → Insertar → "Código HTML" can be pasted as is. The app reads only the frame's address and its proportions from it, never the HTML itself. The same works for YouTube's and Figma's embed codes.
- **Canva designs keep their real shape:** a poster or an A4 CV is inserted portrait, not squeezed into 16:9. The shape comes from the embed code, or from Canva for plain links.
- **"Not shared yet" before inserting:** the app asks Canva whether the design is public. If not, the student sees "Este diseño de Canva todavía no está compartido…" with the fix. That is the most common reason an embed stays blank. The design's title is shown too ("Reconocimos: Canva · «Currículo…»").
- **Canva websites** (`*.my.canva.site`) are recognized and explained ("insert the design instead"), because Canva doesn't allow them inside other sites.

## 2. Done

| Commit                                  | What                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `58ad0c0` `2f5a5e2` `59baed4` `b651e77` | Session work before the loop: one full-width board header with dropdown filters; the timer closes 15 s after the end; funny LottieFiles animations on the break screen; `update` scripts; M17–M21 plan |
| `7ac153c`                               | `embeds.ts`: `readEmbedInput` (link or embed code → address + shape), Canva websites, `canvaViewUrl`, `aspectOf`; unit tests from real Canva / YouTube / Figma codes                                   |
| `694533b`                               | Worker `POST /links/canva`: asks Canva's public oEmbed (signed-in users, design view links only) → `{ shared, width, height, title }`; tests                                                           |
| `84fc84e`                               | Dialog: tiles, embed codes, Canva check + real shape, insert with that shape; guide page with Canva first and two-way steps; es / en; e2e                                                              |

**What I checked against real Canva before building** (headless Chrome, public designs found on GitHub):

| Link shape                                  | In a frame                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/design/ID/TOKEN/view?embed`               | ✅ plays (also with the app's sandbox)                                                                 |
| an **edit** link converted to `/view?embed` | ✅ plays when the design is shared                                                                     |
| `/view` without `?embed`, `/watch?embed`    | blank, so the app always converts to `/view?embed` (it already did)                                    |
| `*.my.canva.site`                           | ❌ refused (`x-frame-options: SAMEORIGIN`)                                                             |
| Canva oEmbed `/_oembed?url=…`               | public design → 200 with width / height / title; private → 404; no CORS, so it goes through the Worker |

## 3. Quality gate

`npm run check`, all green:

| Check                          | Result                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format        | ✅                                                                                                                                                               |
| Unit                           | ✅ **147** (+10: Canva link shapes, Canva / YouTube / Figma embed codes, credit link with entities, Canva sites, clamped shapes, clock closing)                  |
| Rules                          | ✅ **99** (no rule changes)                                                                                                                                      |
| Worker                         | ✅ **46** (+3: shared design, private / unknown answers, refused links and callers)                                                                              |
| Worker integration · Admin CLI | ✅ · ✅                                                                                                                                                          |
| E2E                            | ✅ **81** (+4: Canva embed code inserted portrait; not-shared warning, Canva site, HTML without an address; without the Worker; focus view returns to the board) |
| Build                          | ✅ (main chunk 653 KB, 218 KB gzip)                                                                                                                              |

## 4. Your turn

```bash
npm run worker:deploy   # the new /links/canva route (the app works without it: no sharing check, 16:9 for plain links)
npm run update:web      # or `npm run release` for everything with all tests
git push
```

Earlier loops still waiting for a deploy (10, 12, 13, 14) go out with `npm run release` or `npm run deploy:all`.

## 5. Acceptance test (with a real Canva account)

- [ ] As a student, editor → **Insertar contenido**: the tiles show, Canva first. Click **Canva**: the steps show both options.
- [ ] In Canva, **Compartir → Insertar → Copiar código HTML** of a **vertical** design (poster, A4) → paste it. You should see "Reconocimos: Canva · «title»", a portrait preview, and a portrait box in the slide after inserting.
- [ ] Paste the **edit link** of a design that is **not shared**. You should see the "todavía no está compartido" warning. Share it ("Cualquier persona con el enlace"), paste again, and the warning goes away.
- [ ] Paste a `canva.link` short link. It is expanded and recognized.
- [ ] Paste a Canva **website** (`…my.canva.site`). You should see the explanation, and Insertar stays off.
- [ ] Open the slide as a classmate and in the presenter: the design shows in its shape.

## 6. Assumptions (change any of them)

- D55 taken as proposed, with two changes from what I found: **no special "edit link" warning**, because edit links play fine once shared, and the sharing check covers the real problem. Canva **websites can't be embedded** at all, so they are explained instead.
- The plan mentioned **screenshots of Canva's menus** in the steps. I wrote clear text steps instead, because Canva's screens need a logged-in account and change often. Send me screenshots if you want them in the guide.
- A design that isn't shared can **still be inserted** (with the warning): the student may share it right after.
- Only Canva's "not found" (404) counts as "not shared". Any other answer (Canva busy, bot check) is treated as "don't know", and the dialog behaves like before.
- Tiles use a colored letter per service, not brand logos (no third-party images or trademarks in the app).
- The other D56–D77 decisions are untouched (they belong to Loops 16–19).

## 7. Issues / risks

- **Canva may block the Worker:** Canva sits behind bot protection. From Cloudflare's servers the oEmbed call could get a 403. If so, the app falls back silently (no check, 16:9 for plain links; embed codes still carry their shape). Try one plain link after `worker:deploy`: if the title doesn't appear, tell me and I'll look into it.
- Links already inserted before this loop keep their 16:9 box; the student can resize it in the editor.
- "Convertir" (a link typed as text, M14) still inserts 16:9; it doesn't ask Canva for the shape yet.
- Free tier: one Worker request per Canva link pasted (cached by Canva for 15 min); no database reads or writes.

## 8. Next loop

**Loop 16 · M18 Student emails and attendance.** Before it, please confirm or change:

- **D63:** one email per student, or all their emails?
- **D64:** copy, mail app (BCC) and CSV, with no sending from the app. OK?
- **D65–D68:** attendance states (Presente · Tarde · Ausente · Excusa), teacher-only marking in v1, and students seeing only their own attendance.

Then say "run loop 16".
