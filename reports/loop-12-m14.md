# Loop 12 — M14 Embeds that work

2026-10-31 · commits listed in section 2

## 1. Summary

- Production showed 50 slides with **1 embed** and **3 links typed as text** (Google Slides, Google Forms, `canva.link`): students didn't know how to embed, and a Google `/edit` link can't play in a frame anyway.
- Editor → **"Insertar contenido"**: paste a link → the service is recognized, the link converted, a **live preview** and that service's **sharing steps**; "Insertar en la diapositiva" places it centered with the right shape (16:9, 4:3 or tall for forms).
- **15 services:** Google Slides / Docs / Sheets / Forms / Drive, YouTube (privacy mode, `youtube-nocookie`), Vimeo, Loom, Figma (design, prototype, FigJam, Slides), Canva, Miro, Notion (published pages), Genially, Prezi, Padlet (its embed links). Anything else stays a link.
- **Old slides fix themselves** when shown (e.g. Google `/edit` → `/embed`); no data changed.
- **Links typed as text:** the editor shows "Esta diapositiva tiene 1 enlace…" with **"Convertir"**; in the viewer / presenter those links are **clickable**.
- **Short links** (`canva.link`, `forms.gle`…) are expanded by the Worker (allow-list, ≤ 5 redirects, only the final address).
- **Loading:** "Cargando diapositiva…" shimmer + fade-in; each embed shows "Cargando Google Slides…" until it loads; after 12 s **"¿No carga?"** with that service's fix + "Abrir" + "Cómo insertarlo"; an **"↗ Abrir"** chip on every embed.
- **Public guide** `/ayuda/insertar` with the steps per service (link it for the class).

## 2. Done

| Area   | What                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core   | `embeds.ts`: provider registry (detect, convert, aspect, sandbox, needs-sharing), `isAllowedEmbed`, short links, box size, links in text          |
| Render | `renderSlideSvg` converts known links, per-service sandbox (`allow-forms` for Forms), `allow` fullscreen / autoplay, text links → `<a>`           |
| UI     | `InsertEmbedDialog`, `EmbedFrame` (editor `renderEmbeddable` + preview), overlays in `SlidePreview`, "Convertir" banner, `EmbedGuidePage` + route |
| Worker | `POST /links/resolve` (signed-in, allow-listed shorteners, https only, ≤ 5 hops, body never read)                                                 |
| Texts  | es / en for every service; privacy notice: embedded services load from their own servers                                                          |

## 3. Quality gate

| Check                   | Result                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, format | ✅                                                                                                                                                                  |
| Unit                    | ✅ **126** (+27: every service, conversions are stable, short links, sizes, wrapped links)                                                                          |
| Rules                   | ✅ **92** (no rule change)                                                                                                                                          |
| Worker (offline)        | ✅ **43** (+2: resolver allow-list, loops, insecure redirects)                                                                                                      |
| Worker integration      | ✅                                                                                                                                                                  |
| Admin CLI               | ✅                                                                                                                                                                  |
| E2E                     | ✅ **72** (+7: insert Google Slides, unknown / non-framable explained, canva.link, text link → Convertir + clickable, old slide fixed + Abrir, "¿No carga?", guide) |
| Build                   | ✅                                                                                                                                                                  |

The existing M5 test now expects YouTube in privacy mode (`youtube-nocookie.com`), and an old unit test used fake ids the stricter check rejects; both updated.

## 4. Your turn

```bash
npm run release   # all tests, then Worker → rules → Hosting (also deploys Loops 10 and 13)
git push
```

## 5. Acceptance test + manual compatibility check

Use **real public files** (share "Anyone with the link"), in the viewer and the presenter, Chrome and Safari:

| Service                             | Chrome | Safari | Notes                                  |
| ----------------------------------- | ------ | ------ | -------------------------------------- |
| Google Slides (`/edit` link pasted) |        |        |                                        |
| Google Docs / Sheets                |        |        |                                        |
| Google Forms (answer it)            |        |        |                                        |
| Google Drive video                  |        |        |                                        |
| YouTube                             |        |        |                                        |
| Vimeo / Loom                        |        |        |                                        |
| Figma (design and Slides)           |        |        | the deck in production: share it first |
| Canva (`canva.link`)                |        |        |                                        |
| Miro                                |        |        |                                        |
| Notion (`notion.site`)              |        |        |                                        |
| Genially / Prezi / Padlet           |        |        |                                        |

- [ ] In the editor: "Insertar contenido" with each link → preview + steps → Insertar.
- [ ] The slide with the Google Slides link typed as text: "Convertir".
- [ ] Share `/ayuda/insertar` with the class.

## 6. Assumptions (change any of them)

- D36–D41 taken as proposed ("go").
- Padlet: only its embed links (`padlet.com/embed/…`); a board address isn't framed (Padlet blocks it).
- Notion: only pages published to the web (`*.notion.site`).
- "¿No carga?" appears when the frame doesn't finish loading in 12 s. A service that loads its own "sign in" page counts as loaded (browsers don't let us look inside), so the "↗ Abrir" chip is always there.
- **Presenter pre-warm not built:** the next slide's frame is created again when you move to it and reloads anyway, so a hidden copy wouldn't make it faster.

## 7. Issues / risks

- Services change their embed URLs: one entry each in `embeds.ts`, with a unit test per service.
- Safari / Brave block third-party cookies: private files never load there (the fallback explains sharing publicly).
- Free tier: the resolver runs only for short links.

## 8. Next loop

**Loop 8 — M10 Class participation.** Confirm or change **D12–D17**, then say **"run loop 8"**.
