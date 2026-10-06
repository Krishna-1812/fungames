# Project context: the whole site, in one file

This is the single place to pick the project up from: what the site is, how it
is built, every game, what is finished, what is left, and the working rules
that have held throughout. It summarises; the deep detail lives in
[`README.md`](README.md) (architecture and every game), [`PLAN.md`](PLAN.md)
(the history of every decision, items 1–68), [`HANDOFF.md`](HANDOFF.md)
(setting up a new machine) and
[`docs/neal-fun-research.md`](docs/neal-fun-research.md) (the teardown of
neal.fun the site was modelled on).

*Written 3 October 2026, at commit `cc3749f`.*

---

## 1. At a glance

| | |
|---|---|
| **What it is** | A neal.fun-style site: an illustrated homepage (Tiny Island) and 32 self-contained interactive games, toys and visualisations |
| **Live site** | <https://fungames-mu.vercel.app> (Vercel, deploys on every push to `main`) |
| **Repo** | <https://github.com/Krishna-1812/fungames> |
| **Stack** | Astro 5, static output, TypeScript; three.js (Orbit), Leaflet (Asteroid Launcher); resvg + sharp at build time. Static pages; only the analytics API (`src/pages/api/`) runs as Vercel functions, on Neon Postgres |
| **Size** | 32 games (31 on the island + Powder, unlisted but routable), 201 commits, 61 checker scripts, all passing |
| **Look** | "Paper & Ink" design system for the games; a cool palette only (mint, lagoon, navy, lilac, raspberry; **no orange or yellow**) |
| **Sound** | Every sound is synthesised live in the browser. There is not one audio file on the site |
| **Player data** | Progress lives in each visitor's `localStorage` (passport, scores, bottles, settings). Visits and game events are counted for the admin page at `/admin/` (see README, "Analytics"; `/privacy/` for visitors) |
| **Built** | 4 September – 3 October 2026 |

### Waiting on the owner (blocking a real launch)

1. **Site name, contact email and domain.** All three are placeholders in
   [`src/site.config.ts`](src/site.config.ts) (`'Your Site Name'`,
   `hi@yoursite.com`, `yoursite.com`). Everything (meta tags, share cards,
   sitemap) reads from there, so changing it is one edit. Attaching the
   domain in Vercel is enough for canonical URLs; no commit needed for that.
2. **Live visitors on the island (item D19)**: yes / cheaper version / no. See §8.
3. Optional, when wanted: Plausible analytics domain, AdSense id, a real NASA
   API key (Days Since Incident uses the shared `DEMO_KEY`), and the Fusion
   Cloudflare Worker (needs a Cloudflare account).

---

## 2. How we got here (timeline)

| Dates | What happened |
|---|---|
| 4 Sep | First commit, "Playbox": fifteen browser games, zero JS by default. neal.fun measured and taken apart game by game (`docs/neal-fun-research.md`) |
| 5–8 Sep | Reliability pass (`PHASES.md`): Fusion recipes and worker hardened, Orbit made refresh-rate independent, `npm test` / `npm run check` / CI. Depth and goals added to the sandboxes (Powder scenarios, Orbit challenges) |
| 6–13 Sep | Emoji replaced with real drawn art everywhere: tile art, 83 icons, and a raster checker for each art module. Catalogue gap planned (`PLAN.md` "The catalogue gap") |
| 12–21 Sep | New games: Asteroid Launcher, I'm Not a Robot, The Auction Game, Universe Forecast, then the neal.fun picks (Deep Sea, Every Second, Dark Patterns, Day Go, Speed, Space Elevator, Days Since Incident, Constellation Draw). Several "hyper-realistic" passes |
| 20–27 Sep | Staging pass (art made big, cut out of its cards), Printing Money, Who Was Alive, Earth Reviews, Internet Artifacts, Share This Page |
| 26–27 Sep | **Paper & Ink**: one design system and one shared game shell; every game moved in, two at a time, over 16 phases. Cool palette replaces orange/yellow. GitHub Pages retired, Vercel adopted |
| 27 Sep – 1 Oct | **Tiny Island** homepage: an isometric map where every game is a building. Phases 1–7: one scale, land and water, life, night/weather/seasons, things to poke and secrets, a passport and sound, speed and phones |
| 1–3 Oct | Cursor Camp study (neal.fun's multiplayer island) produced a 30-item list in sections A–H. Built since: **A** a canvas engine (drag 8–17 fps → 60), **B** camera feel, **C** the art pass, **F + G** bottles, postcards, signposts, welcome, phone taps, **D20–21** ball, pigeons, parade, noticeboard |

Recent commits:

```
cc3749f Tiny Island: a ball to throw, pigeons, the water, a parade, and a noticeboard   (D)
e49df25 Tiny Island: bottles, postcards, signposts, a welcome, and wider taps on phones (F, G)
0308586 Tiny Island: the art pass (outlines, shadows, ground, water, mini-map, opening) (C)
40bbc9f Tiny Island: a speed check, the camera's feel, and a circle into each game     (A6, B)
29da796 Tiny Island canvas engine, part 2: the homepage draws the island on a canvas    (A)
39844fc Tiny Island canvas engine, part 1: the bake and the engine                      (A)
```

---

## 3. Architecture

### The site

- **Astro 5, static.** Each page ships only the script it uses. Pure logic
  lives in `src/lib/*.ts` as functions over plain data, so the checkers can
  run it under plain Node without a browser.
- **`src/data/games.ts`** is the registry: one entry per game (slug, title,
  blurb, description, accent colours, category, date, `unlisted`). It drives
  the homepage cards, every `<head>`, OG images (`src/pages/og/[slug].png.ts`),
  the sitemap and `llms.txt`.
- **`src/site.config.ts`** is the single place to rebrand.
- **`astro.config.mjs`** works out the site URL from Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL` (or `SITE_URL`), so a custom domain needs
  no commit. `BASE_PATH` supports serving from a subfolder. Trailing slashes
  always (`/game-name/`, like neal.fun).

### Paper & Ink (the games' design system)

| File | Role |
|---|---|
| `src/styles/paper/tokens.css`, `base.css`, `motion.css` | colour, type, shape and motion tokens; components; every `html.play` animation and the reduced-motion off switch |
| `src/styles/paper/README.md` | the rules |
| `src/layouts/Paper.astro` | page, fonts (Fraunces for statements, Zalando Sans for information), masthead, colophon, and the circle that opens a game when you arrive from the island |
| `src/layouts/GameShell.astro` + `src/lib/game-shell.ts` | the frame every game sits in: title, speaker, share, result, passport stamp |
| `src/lib/motion.ts` | reveals, springy letters, odometer, ticker, confetti, etc. |
| `scripts/check-paper.mjs` | holds the system to its own rules (contrast, colour, motion, every game in the shell) |

`SHELL_GAMES` and `dailyTarget` in `src/data/game-meta.ts` drive the **daily
challenge**, which rotates through the games.

### Shared libraries

| File | Role |
|---|---|
| `src/lib/audio.ts` | the synthesiser: every sound on the site; lazy, mute remembered |
| `src/lib/gl.ts` | WebGL runtime: one frame loop for every shader on a page, context loss, shared GLSL |
| `src/lib/fx.ts` | particles, screen shake, floating text |
| `src/lib/stats.ts` | the hardened `localStorage` store (`siteStore`): one key, versioned, survives full/throwing/garbage stores |
| `src/lib/passport.ts`, `passport-art.ts` | which games you have visited and on which days; the stamps |
| `src/lib/bottles.ts` | the twelve messages in bottles and the passport covers they earn |
| `src/lib/result-card.ts`, `share-card.ts` | 1200×630 share card for a *result*, made in the browser; native share sheet, then download, then link |
| `src/lib/icons.ts`, `tile-art.ts` | 83 drawn icons; a drawing per game |

### Hosting

- **Vercel** (`vercel.json`): `npm ci`, `npm run build`, `dist/`; immutable
  caching for `/_astro/*` and `/island/*`; `nosniff` and referrer headers.
- `netlify.toml` and `public/_headers` are kept so Netlify or Cloudflare
  Pages would also work.
- **CI** (`.github/workflows/check.yml`): `npm ci && npm run check` on Node 24
  for every push and PR.
- **Fusion worker** (`worker/fusion-worker.js`, `wrangler.toml`): the
  Infinite Craft architecture (sorted pair keys, KV, edge cache, an LLM only
  for new pairs, referer gate). **Not deployed.** `wrangler.toml` still has
  `example.com` and a placeholder KV id. Fusion plays fully offline from its
  local recipe table without it.

---

## 4. The homepage: Tiny Island

An isometric illustrated island. Every game is a building that *is* its idea
(Deep Time is a cliff of rock layers with a fossil; Trolley is a forking
track; the lighthouse flashes real Morse), standing in a district that fits
its subject. Under the map, every game again as a card with filters and
search.

### Districts and buildings

| District | Games |
|---|---|
| **Sky Peaks** (space) | Space Elevator, Constellation Draw, Universe Forecast, Orbit, Speed, Scale |
| **The Badlands** | Asteroid Launcher, Days Since Incident, Deep Time, Fusion |
| **Proving Grounds** (tests of you) | Trolley, I'm Not a Robot, Steady Hand |
| **The Harbour** (the sea) | Ambient Mix, Share This Page, The Deep Sea, Paper Folds |
| **The Funfair** | Earth Reviews, Overstimulated, Internet Artifacts, Progress |
| **Market Street** (money) | The Auction Game, Printing Money, Dark Patterns, Spend It |
| **Old Town** (people and time) | Who Was Alive, Life in Weeks, Every Second, Where Does The Day Go, Rule Cascade, From Memory |

Placement is in `src/lib/island/landmarks.ts` (`PLACES`); building art is in
`lm-*.ts`, one file per district.

### What is on the island (all built)

- **Life:** walkers who go into buildings and out again, traffic stopping at
  zebra crossings, a ferry on a 48-second crossing with passengers, boats,
  balloons, a plane with a banner, animals (sheep, deer, ducks, crabs,
  dolphins, a whale, gulls), a windmill, a Ferris wheel.
- **Time:** day and night follow the visitor's clock (lit windows, moon,
  stars, fireflies, lighthouse beam); seasons by date (snow, New Year
  fireworks, spring blossom); a rain cloud over Universe Forecast.
- **18 things to poke**, counted in the passport's Sightings page,
  including secrets: a castaway, buried treasure, a hidden 32nd building, a
  whale at dawn, and a UFO at 3 a.m.
- **Passport:** a book that opens from the top bar. Every game stamps it
  once a day in its district's ink and stamp shape; district seals; a rank;
  Sightings and Bottles pages; covers earned from bottles.
- **Messages in bottles (F26):** 12 bottles round the coast, each with a note;
  every three found earns a passport cover (Lagoon, Kelp forest, Nebula,
  Pearl).
- **Postcards (F27):** the camera button (or P) repaints the view at
  1800×1200 with "Greetings from <district>" lettering, a perforated stamp
  of the nearest building and a postmark. Save it, or use the phone's share
  sheet.
- **Signposts (G28):** 6 posts at junctions and district borders, boards in
  each district's ink pointing to all 7 districts; names appear when close.
- **Welcome (G29):** one line for first visits with a "Sound on?" button;
  never blocks the games.
- **Phones (G30):** a tap just off a target still counts (rings out to 24 px);
  two-finger pinch and pan.
- **Things that react (D20):** a beach ball you can grab, throw, bounce and
  float (the tide brings it back); a pigeon square where an old man feeds
  them and the flock takes off when anything comes near; rings on the water
  wherever it is touched.
- **What's on (D21):** a noticeboard (and the Today button) with a live
  timetable: today's challenge, a **parade** every 5 minutes from the town
  square to the day's game (drum major, flag, drummer, trumpet, balloon kids,
  dog), the ferry, the bell on the hour, the lighthouse, **Friday fireworks
  8–10 pm**, the dawn whale, and a classified 3 a.m. entry. Every line has a
  button that flies the camera there.
- **Sound:** placed on the map with the camera as the listener: sea, wind,
  crowds, music box, crickets at night, gulls, the ferry horn, the bell, the
  parade's drum, and a sound for everything you poke.
- **Surprise me** dives into a game you have not visited yet.
- **Into a game and back:** the camera dives into the building, a circle in
  the game's colour opens over the window, and the game page opens the same
  circle. Coming back with Back returns you to where you were.

### How the island is drawn (the canvas engine)

The map is *authored* as SVG (≈10,000 elements, written by code in
`src/lib/island/`), but dragging live SVG ran at 8–17 fps. So it is **baked at
build time** and drawn on **one canvas**:

1. **Bake** (`src/lib/island/bake/`, run by `scripts/bake-island.mjs`, about
   2 min, cached under a hash):
   - What never moves is painted by resvg into 512 px squares at five
     sizes, as near-lossless WebP (plus a night set).
   - What moves becomes sprites in sheets, with one-bit hit masks.
   - Only shapes whose paint changes are drawn live (about 200).
   - Lettering uses the page's own fonts.
   - The bake also records where each layer ends (`ends`), so live things
     can be drawn in the right order.
   - Output goes to `dist/island/<hash>/`, about 16 MB in total, loaded lazily.
2. **Engine** (`engine.ts`):
   - Streams the squares in view at the right size, poses everything from
     one motion table (`moves.ts`), and keeps positions on whole pixels.
   - Answers "what is under this point" from the hit masks.
   - Has `LiveLayer` hooks (after the sea, after the walkers, over
     everything, and inside per-building "front windows") so live things
     like the ball and pigeons hide behind buildings correctly.
   - `snapshot()` paints any view for postcards.
3. **Camera** (`camera.ts`):
   - Movement eases by elapsed time, so it feels the same at 30 and 120 Hz.
   - Throw, wheel, pinch, rubber-band edges, held arrow keys that speed up.
   - Snaps to painted sizes so the art lands 1:1.
   - Hover cards, a mini-map you can click or drag, a hidden link per
     building for keyboard and screen readers, and the dive into a game.
4. **No-JS fallback:** the whole island as one still picture, with real links.

### Performance (guarded by tests)

- `scripts/bench-island.mjs` drags the built island in headless Chrome. It
  **fails below 45 fps**, and fails if any of five views goes over its
  canvas-call budget.
- Last run (cc3749f): 47.1 fps idle, 45.8 fps dragging, 50.6 fps on a
  throttled phone; this was **on battery**, where the laptop throttles. On
  mains power it holds about 60 fps.
- Canvas calls per view: whole island 1447, opening 1350, closer 741,
  closest 194, night 1558, all under budget.
- `?perf` on the homepage shows the same numbers live.
- Debug URL flags: `?hour=3`, `?time=dawn|day|dusk|night`,
  `?season=winter|spring|newyear`, `?perf`.

### Island source files

`kit.ts` (iso drawing kit) · `props.ts`, `nature.ts`, `town.ts`, `sky.ts`
(things on the map) · `lm-*.ts` + `landmarks.ts` (buildings) · `world.ts`
(terrain, roads, beaches, river, layering, signposts, bottles, play data) ·
`moves.ts` (every motion) · `bake/` · `engine.ts`, `scene.ts`, `anim.ts`,
`keyframes.ts`, `raster.ts` · `camera.ts` · `play.ts` (ball, pigeons, ripples,
parade) · `timetable.ts` · `postcard.ts` · `sound.ts` · `perf.ts` · `home.ts`,
`extras.ts` · `src/pages/index.astro` (the page, panels and wiring) ·
`src/pages/island/[...file].ts` (serves the baked files).

---

## 5. All the games

Category: **science** = real science worked out live · **you** = measures the
actual you · **money** = money spent unwisely · **fun** = just because.

| # | Game (`/slug/`) | Category | What it is | Checked by |
|---|---|---|---|---|
| 1 | **Asteroid Launcher** `asteroid` | science | Drop a 1 m–20 km rock on any of 4,926 real cities. Collins/Melosh/Marcus impact model, Leaflet satellite/street maps, a staged impact reel | `check-impact` (Chelyabinsk, Tunguska, Meteor Crater, Chicxulub), `check-asteroid-art` |
| 2 | **Powder** `powder` *(unlisted)* | fun | Falling-sand sandbox: 37 materials, 53 reactions, 8 scenarios | `check-powder`, `check-powder-scene` |
| 3 | **Orbit** `orbit` | science | n-body gravity (three.js), a symplectic integrator, 8 challenges | `check-orbit`, `-input`, `-mission` |
| 4 | **Overstimulated** `overstimulated` | fun | A clicker where every upgrade makes the page worse; 15 layers; "Make it stop" | — |
| 5 | **Deep Time** `deep-time` | science | 4.54 billion years across five zoom levels, 44 drawn scenes | `check-time-art` |
| 6 | **The Deep Sea** `deep-sea` | science | Scroll to Challenger Deep (10,935 m) through real zones; 22 cited markers as cut-outs | `check-deep-sea-art` |
| 7 | **Space Elevator** `space-elevator` | science | Scroll *up* from the ground to the Kármán line; 29 markers | `check-space-elevator`, `-art` |
| 8 | **Internet Artifacts** `internet-artifacts` | fun | 25 dated internet moments, 1969 to Nyan Cat, in five eras | `check-internet-artifacts`, `-art` |
| 9 | **Share This Page** `share-this-page` | fun | One typed message, 30 ways to send it (Morse, Braille, real encodings) | `check-share-page` |
| 10 | **How Fast Are You Moving?** `speed` | science | Seven real speeds stacking live, from your latitude | `check-speed-model` |
| 11 | **Where Does The Day Go?** `day-go` | you | Your day cut into its real pieces; the bar never grows past 24 h | `check-day-model` |
| 12 | **Printing Money** `printing-money` | science | Nine real earning rates as one-dollar bills laid end to end | `check-printing-money` |
| 13 | **Who Was Alive** `who-was-alive` | you | Pick a year and see who was alive: 89 people with settled dates (no year zero) | `check-who-was-alive` |
| 14 | **Earth Reviews** `earth-reviews` | fun | A review site for 32 natural phenomena, 133 reviews | `check-earth-reviews` |
| 15 | **Dark Patterns** `dark-patterns` | you | 11 manipulative UI tricks rebuilt as working fake sites, done to you | `check-dark-patterns` |
| 16 | **Every Second, Somewhere** `every-second` | science | Live birth/death simulation on a real map of 176 countries (Natural Earth) | `check-population-live` |
| 17 | **Universe Forecast** `universe-forecast` | science | Seasons, moon phases, eclipses, perihelion, from Meeus | `check-forecast`, `check-sky-projection` |
| 18 | **Constellation Draw** `constellation-draw` | science | ~9,000 real stars (HYG); draw your own constellation; a memory round | `check-constellation-code`, `-trace`, `check-star-catalog`, `check-star-color` |
| 19 | **Days Since Incident** `days-since-incident` | science | A live "days since" sign: USGS earthquakes, NASA DONKI flares, storms and shocks | `check-incident-model` |
| 20 | **The Auction Game** `auction` | money | 14 lots, 5 rival bidders, £12,000, a real buyer's premium and reserve | `check-auction`, `-art` |
| 21 | **I'm Not a Robot** `not-a-robot` | you | 12 checks that start as a CAPTCHA and get personal; a real behaviour profiler | `check-telemetry`, `check-robot-scene` |
| 22 | **Scale** `scale` | science | Log zoom from a proton to the observable universe; 26 drawn objects | `check-scale-art` |
| 23 | **Rule Cascade** `rule-cascade` | fun | 31 username rules that never switch off (a moth eats letters) | `check-cascade` |
| 24 | **Spend It** `spend-it` | money | Spend $100 billion on 30 real-priced, drawn things | `check-spend-art` |
| 25 | **Steady Hand** `steady-hand` | you | Four shapes in one stroke each; fair scoring | `check-steady` |
| 26 | **Fusion** `fusion` | fun | Combine elements (44, from 4 seeds); offline recipes, optional AI worker | `check-fusion`, `-art` |
| 27 | **Trolley** `trolley` | you | 26 dilemmas scored against four named ethical positions | `check-trolley`, `-scene` |
| 28 | **Paper Folds** `paper-folds` | fun | Fold real paper (Gallivan's limit); the backdrop climbs from a desk to other galaxies | `check-fold`, `-scene`, `-scale` |
| 29 | **Ambient Mix** `ambient-mix` | fun | 12 synthesised soundscape layers; the mix fits in the URL | `check-mix`, `check-ambient-art` |
| 30 | **Progress** `progress` | fun | 15 units of time draining live on one milled dial | `check-progress`, `-dial` |
| 31 | **From Memory** `from-memory` | you | Draw a bicycle, then see a real one; 16 prompts | `check-memory` |
| 32 | **Life in Weeks** `life-in-weeks` | you | 90 years as 4,680 squares from your birth date | — |

Cross-cutting checks: `check-art` (tile art), `check-icons`, `check-paper`,
`check-result-card`, `check-stats`, `check-passport`, `check-scene`,
`check-clock`, `check-seven-segment`, `check-island`, `check-bottles`,
`check-timetable`.

---

## 6. Testing and quality

```bash
npm run dev            # localhost:4321
npm run build          # -> dist/ (bakes the island if it changed)
npm run preview        # serve the real build (QA here, not in dev)
npm test               # every scripts/check-*.mjs suite
npm run bench:island   # drag benchmark + canvas-call budgets
npm run check          # test + build + bench (what CI runs)
```

- **All suites pass** at `cc3749f` (60/60 run by `npm test`).
- The pattern that has caught every serious bug: **build the model as pure
  functions, check it against answers someone else already knows, and keep
  the page a thin layer on top.** Art is checked by rasterising it with resvg
  and measuring it (visible, contrast, real internal structure rather than a
  shaded ball, distinct from its neighbours).
- Bar for every page: WCAG AA contrast, one `<h1>`, named controls, skip
  link, visible focus, `prefers-reduced-motion` honoured everywhere, no
  horizontal overflow at 375 px.
- Each island phase was also verified in a real (headless) browser before
  and after deploying, using scripted CDP tests: clicks, taps, the parade,
  the noticeboard, postcards, bottles, with screenshots.

---

## 7. Status of the Cursor Camp plan (A–H)

From the 1 October study of neal.fun's Cursor Camp. ✅ = built and live.

| Item | | Status |
|---|---|---|
| **A. Smoothness** | 1 baked tiles · 2 real links kept · 3 canvas panning · 4 low-detail stand-in while zooming · 5 no layer churn while moving · 6 drag benchmark + `?perf` | ✅ all |
| **B. Camera feel** | 7 time-based easing · 8 whole pixels · 9 rubber-band edges · 10 circle wipe into games and back · 11 held keys glide | ✅ all |
| **C. Art and scale** | 12 open closer · 13 heavier outlines · 14 shadows and roof tones · 15 ground detail · 16 canopy (done as "front windows": people pass behind trees and in front of buildings) · 17 living water · 18 real mini-map | ✅ all |
| **D. Life and presence** | 19 live visitors | ⏸ **needs owner decision** |
| | 20 things that react (ball, pigeons, ripples) | ✅ |
| | 21 timetable noticeboard, parade, Friday fireworks | ✅ |
| **E. Sound** | 22 surf measured from the coastline · 23 lower ambience while a card/passport is open · 24 a whoosh tied to pan speed · 25 sounds for entering a game and the wipe | ⬜ **not started** (not yet requested) |
| **F. Collecting and sharing** | 26 bottles + passport covers · 27 postcards | ✅ |
| **G. Wayfinding and phones** | 28 signposts · 29 first-visit welcome · 30 wider phone tap areas | ✅ |
| **H. Stay ahead** | accessibility, small download, free audio, time and weather | ✅ held throughout |

---

## 8. What is left

### Analytics (done, 3 phases)

Requested 5 October 2026: an admin analytics page capturing everything.
Decisions: Vercel + Neon Postgres; an anonymous visitor ID (asked first in
the EU, EEA, UK and Switzerland). See README, "Analytics".

- **Phase 1 (done):** collection (tracker, API, database, consent bar,
  privacy page, Forget me), every game through the shell, the island's
  events, admin login and an overview at `/admin/`, `check-analytics.mjs`.
  Needs the owner to connect Neon and set `ADMIN_PASSWORD` in Vercel.
- **Phase 2 (done):** the full dashboard (Overview, Live, Games with a page
  per game, Island, Audience with a world map, Acquisition, Retention,
  Health), one filter row, comparisons, table views, CSV and raw exports,
  light and dark. Nightly summary tables moved to phase 3, where raw events
  start being trimmed (until then every query reads the raw rows, which is
  fast at this size).
- **Phase 3 (done):** every game reports its own choices and discoveries
  (`shell.pick`, wired into all 32) and where a run was when it was left
  (`shell.progress` → `game_quit`); each game's page shows the crowd (Trolley
  per dilemma, Asteroid cities and rock sizes, Fusion discoveries…), where
  people stop and how far runs get. Island heat-maps on the island's own
  picture (taps, where screens rested, dives per building). A Journeys tab
  (two funnels, a page-to-page flow, the commonest visits). Return visits by
  the week of a first visit. Errors with stack frames, each opening into
  detail. Raw events kept 90 days, rolled into daily summaries kept for good
  by a nightly Vercel cron (`/api/cron/nightly/`, with the admin page as a
  fallback). Life in Weeks' score (the player's age) is now cut from every
  event, server-side, and the nightly run cleaned the rows stored before.
  Optional for the owner: a `CRON_SECRET` variable in Vercel.

### Needs a decision from the owner

- **Name, email, domain** (`src/site.config.ts`), described in §1.
- **D19 live visitors.** Showing real people ("12 here · 3 playing Orbit")
  needs a real-time server. Options:
  1. *Live presence:* a small Cloudflare Durable Object with WebSockets,
     anonymous dots and per-game counts, nothing stored. Needs a Cloudflare
     account and, ideally, the domain. Costs little or nothing at this scale.
     (Recommended once the domain is settled.)
  2. *Daily popularity only:* small crowds outside the busiest buildings,
     from anonymous play counts. Still a server, but a much simpler one.
  3. *Skip it:* the island already feels lived in.

### Ready to build when asked

- **E. Sound** (items 22–25 above). Self-contained, no server, no decisions.

### Launch checklist (owner accounts needed)

- Plausible domain (`plausibleDomain`) and/or AdSense id (`adsenseClient`):
  both render nothing until set.
- A real NASA API key for Days Since Incident (`nasaApiKey`; `DEMO_KEY` is
  shared worldwide and rate-limited).
- Fusion worker: `npx wrangler kv namespace create FUSION`, then fill in
  `wrangler.toml` (KV id, route, `ALLOWED_ORIGINS`), `npx wrangler deploy`.
  Add rate limits and a model budget before going public. The Buy Me a
  Coffee handle is set (`krishna18`).

### Known smaller gaps (from `PHASES.md` / `PLAN.md`)

- A keyboard alternative to Fusion's drag.
- `PLAN.md` Phase 4 (endings, scores and sharing) is marked *started*: the
  result-card machinery is done; not every game has a full ending.
- Real-device testing on actual phones; so far everything has been tested
  with headless and emulated phones.
- The honest limits, unchanged: the art is clean code-drawn SVG, not a human
  hand; no multiplayer; no audience yet.

---

## 9. How we work (rules that have held all along)

- **Quality is the default.** Every phase is built to near-perfection the
  first time: real data, real models, checked against known answers. Art is
  staged big, not shrunk into cards. "Done only once, used by every visitor."
- **Cool theme only.** Mint, lagoon, navy, lilac, raspberry, pearl. Never
  orange or yellow.
- **Each phase:**
  1. Build it.
  2. Run every check, the build and the bench.
  3. Verify in a real (headless) browser, desktop and phone.
  4. Commit (message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
  5. Push (Vercel deploys).
  6. Confirm on the live site, polling slowly for a marker that survives
     minification. Fast polling trips Vercel's bot checkpoint, which is
     never bypassed.
  7. Report back in detail.
- **Island motion is tested headless**, not in the app's preview pane: the
  hidden pane has no animation frames.
- **Benchmarks on battery throttle** (~18–45 fps). Compare old and new builds
  in the same session before blaming a change.
- **Known traps** (all in memory and README):
  - Astro scoped CSS doesn't reach `set:html` or runtime-built markup
    (use `:global()`).
  - An author `display` rule beats `[hidden]`.
  - `String.replace` expands `$'` in replacement strings (use a function).
  - Files are CRLF.
  - `requestAnimationFrame` never fires for first paint in a background tab.
  - In the bake: missing defs, double opacity, blurry scaled sprites.
- **Never automate:** payments, identity or financial details, CAPTCHAs, or
  bot protection. Downloads need explicit permission.

---

## 10. Where to look next

| Question | File |
|---|---|
| How a specific game works, in depth | `README.md`, "The thirty games" |
| Why a decision was made | `PLAN.md` (numbered items 1–68) |
| How the island works, in depth | `README.md`, "The homepage" |
| neal.fun measurements | `docs/neal-fun-research.md` |
| New machine set-up | `HANDOFF.md` |
| Design system rules | `src/styles/paper/README.md` |
| Add a game | `README.md`, "Adding a game" (registry entry, tile drawing, page, `check-art`; then a building in `landmarks.ts` + `lm-<district>.ts`) |
