# Project context: the whole site, in one file

This is the single place to pick the project up from: what the site is, how it
is built, every game, the analytics behind it, what is finished, what is left,
and the working rules that have held throughout. It summarises; the deep
detail lives in [`README.md`](README.md) (architecture, every game, and the
"Analytics" section), [`PLAN.md`](PLAN.md) (the history of every decision,
items 1–68), [`HANDOFF.md`](HANDOFF.md) (setting up a new machine) and
[`docs/neal-fun-research.md`](docs/neal-fun-research.md) (the teardown of
neal.fun the site was modelled on).

*Updated 6 October 2026, at commit `ef48860` (first written 3 October at `cc3749f`).*

---

## 1. At a glance

| | |
|---|---|
| **What it is** | A neal.fun-style site: an illustrated homepage (Tiny Island) and 32 self-contained interactive games, toys and visualisations, plus a private analytics dashboard for the owner |
| **Live site** | <https://fungames-mu.vercel.app> (Vercel, deploys on every push to `main`) · dashboard at `/admin/` · privacy page at `/privacy/` |
| **Repo** | <https://github.com/Krishna-1812/fungames> |
| **Stack** | Astro 5 + TypeScript, every page prerendered; three.js (Orbit), Leaflet (Asteroid Launcher); resvg + sharp at build time. Only `src/pages/api/` runs on request, as Vercel functions (`@astrojs/vercel` adapter, Node 22), on Neon Postgres |
| **Size** | 32 games (31 on the island + Powder, unlisted but routable), 209 commits, 62 check suites, all passing |
| **Look** | "Paper & Ink" design system for the games; a cool palette only (mint, lagoon, navy, lilac, raspberry; **no orange or yellow**) |
| **Sound** | Every sound is synthesised live in the browser. There is not one audio file on the site |
| **Player data** | Progress lives in each visitor's `localStorage` (passport, scores, bottles, settings). Visits, game events and crowd choices are counted anonymously for `/admin/` (§6) |
| **Built** | 4 September – 6 October 2026 |

### Waiting on the owner (blocking a real launch)

1. **Site name, contact email and domain.** All three are placeholders in
   [`src/site.config.ts`](src/site.config.ts) (`'Your Site Name'`,
   `hi@yoursite.com`, `yoursite.com`). Everything (meta tags, share cards,
   sitemap, the privacy page's contact line, the dashboard's header) reads
   from there, so changing it is one edit. Attaching the domain in Vercel is
   enough for canonical URLs; no commit needed for that.
2. **Live visitors on the island (item D19)**: yes / cheaper version / no. See §9.
3. Optional, when wanted: Plausible analytics domain (no longer needed now the
   site counts its own visits), AdSense id, a real NASA API key (Days Since
   Incident uses the shared `DEMO_KEY`), and the Fusion Cloudflare Worker
   (needs a Cloudflare account).

The analytics need nothing more: the Neon database and `ADMIN_PASSWORD` are
set in Vercel, and `/api/health/` reports both as present.

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
| 3 Oct | This file (`CONTEXT.md`) |
| 5–6 Oct | **Analytics**, in three phases (§6): collection, the consent bar and the privacy page; the full dashboard; then the crowd's choices in every game, island heat-maps, journeys, return-visit groups, error detail, and a 90-day retention policy with daily summaries. The site moved from purely static output to the Vercel adapter for its API |
| 6 Oct | **E. Sound**: surf heard from the real coastline and breaking with the drawn waves; the island turned down and muffled under anything opened over it; a whoosh that follows the camera's speed; a sound for the circle into a game, on both sides of the page change |

Recent commits:

```
ef48860 Analytics: run the nightly summaries from visits, not a Vercel cron
b0205e2 Analytics, phase 3 of 3: the crowd, heat-maps, journeys, cohorts, error detail, and 90 days
ce71de5 Analytics, phase 2 of 3: the full dashboard
dce042d Analytics: judge a request's origin by the host the visitor asked for
3cc6baa Analytics, phase 1 of 3: counting visits, every game, the island, and an admin page
105f8da Add CONTEXT.md: the whole site, every game, what is done and what is left
cc3749f Tiny Island: a ball to throw, pigeons, the water, a parade, and a noticeboard   (D)
e49df25 Tiny Island: bottles, postcards, signposts, a welcome, and wider taps on phones (F, G)
```

---

## 3. Architecture

### The site

- **Astro 5, every page prerendered.** Each page ships only the script it
  uses. Pure logic lives in `src/lib/*.ts` as functions over plain data, so
  the checkers can run it under plain Node without a browser.
- **`src/data/games.ts`** is the registry: one entry per game (slug, title,
  blurb, description, accent colours, category, date, `unlisted`). It drives
  the homepage cards, every `<head>`, OG images (`src/pages/og/[slug].png.ts`),
  the sitemap, `llms.txt` and the dashboard's game names.
- **`src/site.config.ts`** is the single place to rebrand.
- **`astro.config.mjs`** works out the site URL from Vercel's
  `VERCEL_PROJECT_PRODUCTION_URL` (or `SITE_URL`), so a custom domain needs
  no commit. `BASE_PATH` supports serving from a subfolder. Trailing slashes
  always (`/game-name/`, like neal.fun). It also sets the Vercel adapter, a
  pass-through image service (sharp stays out of the function) and
  `checkOrigin: false` (the API checks origins itself, see §6).

### Paper & Ink (the games' design system)

| File | Role |
|---|---|
| `src/styles/paper/tokens.css`, `base.css`, `motion.css` | colour, type, shape and motion tokens; components; every `html.play` animation and the reduced-motion off switch |
| `src/styles/paper/README.md` | the rules |
| `src/layouts/Paper.astro` | page, fonts (Fraunces for statements, Zalando Sans for information), masthead, colophon, the circle that opens a game when you arrive from the island; starts the analytics tracker |
| `src/layouts/GameShell.astro` + `src/lib/game-shell.ts` | the frame every game sits in: title, speaker, share, result, passport stamp; and every game's analytics (§6): start, ending, best, level, restart, pause, how-to, sound, `pick()` and `progress()` |
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
| `src/lib/stats.ts` | the hardened `localStorage` store (`siteStore`): one key, versioned, survives full/throwing/garbage stores. `recordPlay` also hands a game's result to the tracker (a `funsite:result` event) |
| `src/lib/passport.ts`, `passport-art.ts` | which games you have visited and on which days; the stamps |
| `src/lib/bottles.ts` | the twelve messages in bottles and the passport covers they earn |
| `src/lib/result-card.ts`, `share-card.ts` | 1200×630 share card for a *result*, made in the browser; native share sheet, then download, then link. Every share is counted, and the shared link carries `?ref=share` |
| `src/lib/icons.ts`, `tile-art.ts` | 83 drawn icons; a drawing per game |
| `src/lib/analytics/`, `src/lib/admin/` | the analytics and the dashboard (§6) |

### Hosting

- **Vercel** (`vercel.json`): `npm ci`, `npm run build`. The build is
  `astro build && node scripts/vercel-headers.mjs`.
- **The adapter's output.** The static site is in `dist/client`, and what
  Vercel deploys is `.vercel/output` (git-ignored). Vercel routes by that
  output's own `config.json` and **ignores `vercel.json`'s headers**, so
  `scripts/vercel-headers.mjs` copies them in after every build: immutable
  caching for `/_astro/*` and `/island/*`, `nosniff`, a referrer policy. It
  would copy any `crons` too, but there are none (§6, "the daily run").
- **One function**, about 1.8 MB: every `src/pages/api/*` route
  (`prerender = false`). PGlite (dev-only, 18 MB) is kept out of it by
  `excludeFiles` in `astro.config.mjs`.
- `npm run preview` serves `dist/client` (`scripts/preview.mjs`, port 4400),
  as `astro preview` has no Vercel mode. The API needs `npm run dev` locally.
- `netlify.toml` and `public/_headers` are still in the repo, but the API
  now needs Vercel functions.
- **CI** (`.github/workflows/check.yml`): `npm ci && npm run check` on Node 24
  for every push and PR.
- **Fusion worker** (`worker/fusion-worker.js`, `wrangler.toml`): the
  Infinite Craft architecture (sorted pair keys, KV, edge cache, an LLM only
  for new pairs, referer gate). **Not deployed.** `wrangler.toml` still has
  `example.com` and a placeholder KV id. Fusion plays fully offline from its
  local recipe table without it.
- **GitHub CLI** on this machine is signed in again (`gh auth status`), so
  commit statuses and PR status work.

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
  parade's drum, and a sound for everything you poke. Since section E:
  - **Surf from the coastline (22):** 184 points where the surf breaks, just
    off every land tile's sea edge (`coastline()`, worked out at build time
    in `index.astro`). The surf's level is how much of them is near the
    view (0.8 on a beach, 0.03 in the middle of the island), and it is panned
    from the side they are on, so the harbour's inlet is heard on its side
    too (`shoreOf()`). It **breaks when the drawn waves do**: the timing is
    read from the engine's `isl-surf` loop (5.2 s; outer line, then the inner
    one 1.6 s later), and keeps its own time when nothing moves.
  - **Muffled under what is open (23):** a game's card, the noticeboard, the
    passport or a postcard turn the island down (to 79%, 47% under the
    passport) and close a low-pass "door" on it. Before, a dialog paused the
    island and its sound went silent; now the camera's `heard()` (on screen,
    tab in front) is separate from `awake()` (being drawn).
  - **Air (24):** a whoosh read every frame from how many views a second the
    camera travels (zooming counts a little less). Still or a slow drag:
    silent. A fling or a flight across the island: heard, brighter the
    faster, from the side it is heading. A jump (a resize) is ignored.
  - **Through the circle (25):** each game has its own note, from its address
    (`portalNote`), so both pages agree without being told. On the island:
    air drawn in as the camera dives, a fifth swelling as the circle shuts,
    and a soft thump at 1 s, as the page goes; the island fades out under it.
    On the game's page (`Paper.astro`): the air let out and the same fifth,
    ringing, if the browser lets a page sound before it is touched
    (`mayPlay()`: Chrome does after a click on the page before; Safari and
    Firefox stay quiet). Back with the Back button: the air the other way,
    and the island again. Back by a link: the island starts at once where the
    browser allows it. Without motion there is no circle and no sound for it.
- **Surprise me** dives into a game you have not visited yet.
- **Into a game and back:** the camera dives into the building, a circle in
  the game's colour opens over the window, and the game page opens the same
  circle. Coming back with Back returns you to where you were.
- **What the island reports** (§6): dives, cards, pokes, bottles, postcards,
  the passport, searches and filters, the noticeboard, the ball and pigeons,
  every tap on the map (`camera.ts`'s `onTap`, for the heat-map), and a
  summary as the page closes (time, drags, districts seen, and where the
  middle of the screen rested on a 10 × 7 grid), plus its frame rate.

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
   - Output goes to `/island/<hash>/`, about 16 MB in total, loaded lazily.
     The dashboard reuses its small "poster" picture for the heat-maps.
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
- Last full run (cc3749f): 47.1 fps idle, 45.8 fps dragging, 50.6 fps on a
  throttled phone; this was **on battery**, where the laptop throttles. On
  mains power it holds about 60 fps. During the analytics work the bench read
  33–42 fps, and the live build measured the same back to back, so that was
  the laptop throttling (it can on mains too), not a regression.
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
actual you · **money** = money spent unwisely · **fun** = just because. What
each game reports to the dashboard is in §6, "The crowd, game by game".

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
`check-timetable`, `check-analytics` (§6), `check-sound` (no audio files; the
surf heard from the right coast and side, in time with the drawn waves; a note
for every game).

---

## 6. Analytics (built 5–6 October 2026, all three phases live)

The owner asked for an admin page that captures *everything* about how people
use the site, beautiful and extremely detailed. Decisions made with the
owner: **Vercel functions + Neon Postgres** for storage, and an **anonymous
visitor ID** (asked for first where the law requires it). README,
"Analytics", has the long version; this is the map.

### How it fits together

```
every page ── tracker (lib/analytics/client.ts) ── batches ──▶ POST /api/collect/
   │  game shell, island, share card, stats.ts feed it                │
   │                                                                  ▼
   │                                                    ingest.ts → Neon Postgres
   │                                                    (views, events, visitors, …)
   │                                                                  │
/admin/ (static page) ── GET /api/admin/stats/?tab=… (signed-in only) ┘
                         report.ts: one SQL query set per tab
```

- **The tracker** (`src/lib/analytics/client.ts`, started by `Paper.astro`
  and `Base.astro`, so on every page): queues events and sends them in
  batches (the first 1.5 s after load as a `fetch`, then every 15 s while
  anything is waiting, a bare heartbeat a minute, and the rest by
  `sendBeacon` as the page hides). Every batch carries engaged time (visible
  *and* touched in the last two minutes) and scroll depth. Also: Core Web
  Vitals (the `web-vitals` package, loaded after the page), script errors
  with the top three stack frames (at most five a page), links out, 404s,
  and the consent bar.
- **What may be sent** (`shape.ts`): 38 known event names and nothing else;
  at most 40 events a batch, 12 flat props an event, strings cut to 80
  characters, a 16 KB body; timestamps more than a day off become the
  server's. Referrers lose their query strings. The same file is used by the
  server, the tracker and the checker.
- **The server** (`src/pages/api/`): `collect` (turns away bots, other
  sites, the admin's own browser and anything malformed; rate-limits by
  address; answers whether this visitor must be asked before an ID is
  stored), `forget` (the privacy page's Forget me), `health` (database and
  password present, yes or no), `admin/login`, `admin/logout`,
  `admin/stats` (one tab at a time), `admin/export` (raw views or events as
  CSV), and `cron/nightly` (the daily run, on demand).
- **Behind Vercel**, a function's `request.url` names an internal host, so
  every origin check reads `x-forwarded-host` / `x-forwarded-proto`
  (`request.ts`); Astro's own `checkOrigin` is off because it 403'd every
  live POST.

### Visitors, consent and privacy

- **A visitor** is their random ID where they have one (kept in
  `localStorage`, not a cookie), and otherwise a **daily hash** of address
  and browser under a salt that is thrown away the next day. The IP address
  and user agent are read for three things (country, kind of device, the
  hash) and never stored.
- **Consent:** in the EU, the EEA, the UK and Switzerland (and when the
  country is unknown) the ID is made only after the consent bar is answered
  "Fine by me"; elsewhere on the first visit. "No thanks" or Global Privacy
  Control means counted without an ID.
- **`/privacy/`** says what is counted and what is never kept, shows this
  browser's state, and has "Count my visits", "Stop using an ID" and
  "Forget me" (deletes every view, event and visitor row under the ID).
- **Never kept:** anything typed or drawn in a game, IP addresses, user
  agents. Life in Weeks' result is coarsened to an age decade, and its
  score, best and title (the weeks lived and the share of 90 years, i.e. the
  player's age) are cut from **every** event, in the browser and again on
  the server (`scrub()` in `shape.ts`); the daily run cleaned the rows stored
  before that rule. Who Was Alive sends only decades of years.
- **Not counted:** the admin's own browser (signing in marks it), crawlers and
  headless browsers. A test run can ask to be counted
  (`localStorage['funsite:analytics-test'] = '1'`): it is stored as test
  traffic, left out of every number unless `/admin/?test=1`, and deleted
  after two days.

### The events (38)

| Group | Events |
|---|---|
| The page | `vital`, `error`, `outbound`, `notfound`, `consent` |
| Every game, through the shell | `game_start` (first touch, click, key or wheel), `game_end` (win or lose, score, time), `game_result` (the numbers the game keeps), `game_best`, `game_level` (with its step number), `game_restart`, `game_pause`, `game_howto`, `sound`, `share` (and how it went), **`game_pick`** (a choice or discovery: `what`, `v`, optional `of`), **`game_quit`** (the page was left mid-run: where it had got to, how long) |
| The island | `isl_dive`, `isl_card`, `isl_search`, `isl_filter`, `isl_surprise`, `isl_today`, `isl_board`, `isl_board_go`, `isl_poke`, `isl_bottle`, `isl_postcard`, `isl_passport`, `isl_cover`, `isl_time`, `isl_welcome`, `isl_minimap`, `isl_ball`, `isl_pigeons`, `isl_session` (the visit's summary, with the 10 × 7 "where the screen rested" grid), `isl_fps`, **`isl_tap`** (where a tap landed on the map, rounded to ten map units, 80 a visit) |

### The crowd, game by game

A game calls `shell.pick(what, v, of?)` for its choices and discoveries and
`shell.progress(where)` for how far a run has got (a number where it is
ordered). `what` becomes a card title on that game's dashboard page. Picks
never reopen a finished run; only a restart starts a new one. All 32 are
wired:

| Game | What the crowd's choices show | Where a run is (`progress`) |
|---|---|---|
| Trolley | Choice on each dilemma (split per dilemma), same answer to problem 1 twice | problem number |
| Asteroid Launcher | City hit, rock size (m), material, speed (km/s), entry angle (°) | level text |
| Fusion | Element discovered | elements of the tree found |
| Powder | Reaction discovered, scenario opened / solved, material chosen | level text (scenarios beaten) |
| Rule Cascade | Seconds to clear each rule (per rule), the rule that took longest | highest rule unlocked |
| The Auction Game | What people did on each lot, paid vs worth on each lot (%) | lot number |
| I'm Not a Robot | Rejections on each check, squares where people found suffering | check number (1–12) |
| Paper Folds | Sheet chosen, way of folding, folded on past the real limit, furthest fold on each sheet | furthest fold |
| Who Was Alive | Decade looked up, birth decade, life clicked on the chart, category isolated | people met |
| Ambient Mix | Preset picked, layer brought in, layers in a shared mix | level text |
| Orbit | Challenge completed, launch size picked, scene started, bodies launched (milestones) | challenges done |
| Steady Hand | Score kept per shape, shape redrawn, stroke abandoned | level text |
| Constellation Draw | Accuracy and peeked, per figure; mode switched; star looked up; lines in a shared drawing | level text |
| Dark Patterns | Fell for each pattern, seconds to decide per pattern | site number |
| Where Does The Day Go? | Typical day as set (per slider row) | furthest section |
| Days Since Incident | Scale explained, source followed | level text |
| The Deep Sea | Creature reached, zone reached | deepest depth (100 m steps) |
| Deep Time | Event reached, zoom reached | % of the page (5 % steps) |
| Earth Reviews | Product opened, products / reviews sorted by, "also regretted" followed, review marked helpful | products seen |
| Every Second | Speed chosen, country inspected | simulated hours watched |
| From Memory | Likeness and strokes for each thing (never the drawing), comparison view, postcard downloaded | drawing number |
| Internet Artifacts | Artifact reached, era reached, dial-up modem switched on | year reached |
| Life in Weeks | How the grid was shown, how the date was changed (never the date) | level text |
| Overstimulated | Upgrade bought, newsletter popup's first answer, last upgrade before stopping | upgrades owned |
| Printing Money | Seconds to reach the end, entered own wage (yes/no, never the wage) | furthest rate read |
| Progress | First channel read and how, every channel read | channels read |
| Scale | Seconds to the edge | widest power of ten reached |
| Share This Page | First way tried, ways shared / copied / played aloud, wrote own message (yes/no, never the text) | ways sent |
| Space Elevator | Highest altitude (km), jacket picked, turned on the music | km of this climb |
| How Fast Are You Moving? | Location button (used / refused / unavailable), seconds to reach the edge | speed stages passed |
| Spend It | Thing bought, how many per thing, spent it all, fortune spent (%) (sent as the basket stands, not per click) | % of the fortune spent |
| Universe Forecast | Event drawn, months ahead drawn, filter chosen, scrubbed the Moon | kinds drawn |

`check-analytics` fails if a game stops reporting, or if a pick reads an
input's value outside a short allow-list (a slider's number, a yes/no for
"wrote a message").

### The database (Neon Postgres; PGlite locally)

| Table | Holds | Kept |
|---|---|---|
| `views` | one row per page load: path, game, referrer (host and path), shared-link and campaign tags, country/region/city (lat/lon to 0.1°), device/OS/browser, screen and window, language, timezone, dark mode, reduced motion, connection, the passport's first-visit days and games seen, engaged time, scroll, consent state, test flag | 13 months |
| `events` | one row per thing done: page load, time, name, game, props (JSON) | **90 days** |
| `visitors` | each ID's first and last visit (for return-visit groups) | while seen within 13 months |
| `daily_counts` | every event counted per UTC day, game, country and device (plus `game_win` and `postcard_out`) | for good |
| `daily_props` | per day and game: the crowd's picks, where runs stopped, levels, pokes, share outcomes and a few island choices | for good |
| `salts` | today's random salt for the daily hash | one day |
| `meta` | when the daily run last ran, how far it has counted, its claim | — |

Tables make themselves on the first request (`db.ts`, `SCHEMA`).
`DATABASE_URL` or `POSTGRES_URL` is read from Vercel's environment; with
neither, `astro dev` uses PGlite in `node_modules/.cache/funsite-pglite`.

### The daily run (summaries and the 90-day trim)

`src/lib/analytics/rollup.ts`, `nightly()`:

1. Cleans anything a game should never have sent (the Life in Weeks rule).
2. Counts every finished UTC day not yet counted, plus the last three again
   (late beacons), into `daily_counts` and `daily_props`. Each day is
   counted afresh, so running it twice changes nothing.
3. Deletes raw events older than 90 days, but only days already counted, and
   never re-counts a day that has been trimmed (that would empty it).
4. Prunes views and IDs older than 13 months and test runs older than two
   days, and fills `visitors` from any views that predate it.

**Who runs it:** the first visit after a day has gone by (`collect`, checked
at most hourly per function), or the dashboard's Overview if the site is
quiet. `claim()` is a single SQL statement, so when several visits arrive at
once exactly one runs it. **There is no Vercel cron:** the phase 3 deploy
that declared one (`vercel.json` `crons`) failed at Vercel's deploy step, and
the same code without it deployed cleanly. `GET /api/cron/nightly/` still
runs it on demand (anyone, at most once in 20 hours; the admin with
`?force=1`; with a `CRON_SECRET` set, only a bearer of it or the admin). On
the live site it first ran on 6 October and counted 5 October.

**Reading long ranges:** a period that reaches back past 90 days reads the
summaries for the older UTC days and the raw rows after (`split()` in
`report.ts`). Starts, finishes, wins, shares, restarts, how-to opens,
dives, cards, the crowd's choices, where runs stopped, levels and share
outcomes stay complete; anything that needs one visit's events (funnels,
time to finish, score spreads, the island's details, speed, errors,
journeys) starts at the 90-day line, and the dashboard says so in a banner.

### The dashboard (`/admin/`)

- **Sign-in:** one password, `ADMIN_PASSWORD` in Vercel. The session is an
  HMAC-signed, HttpOnly, SameSite=Strict, Secure cookie for 30 days;
  changing the password signs everyone out. Never linked, `noindex`, and
  disallowed in `robots.txt`.
- **One filter row** over everything: 24 h, 7, 30, 90 days, 12 months or a
  custom range; compare with the period before; a country, a kind of
  device, a game. Everything is in the address (`#tab=games&days=30&…`), so
  a view can be bookmarked. Export views or events as CSV. A live "here
  now" count. Light, dark or system theme.
- **Nine tabs:**
  - **Overview:** eight headline numbers against the period before; visitors
    and page views (last period dotted); games started and finished; most
    played; countries; referrers; devices.
  - **Live:** a world map with a dot per page open in the last five minutes,
    events a minute, and a feed of everything as it happens (every 10 s).
  - **Games:** every game in a sortable table with a sparkline, completion,
    time and shares; finish rates; time on page. **A page per game:** its
    funnel, trend, *what the crowd chose* (a split bar per question, a spread
    per row, a distribution or a ranked count), *where people stop* and *how
    far runs get*, every number it reports as a distribution, how long a game
    takes, where players came from, devices, milestones and shares.
  - **Island:** **heat-maps on the island's own picture** (taps, where
    screens rested, games entered as circles), dives, cards, pokes and first
    finds, districts, bottles, searches and empty searches, the noticeboard,
    postcards, the passport, small choices, frame rate by device.
  - **Audience:** world map, regions, cities, the week in visitors' own time,
    devices, systems, browsers, languages, window widths, pixel density,
    connections, timezones, dark mode, reduced motion.
  - **Acquisition:** how visitors arrive (by kind, site, page), campaigns,
    returns through shared links and postcards, first and last pages,
    page-to-page paths, shares, links out.
  - **Journeys:** the island's funnel (saw it → opened a card → went in →
    played → finished → shared) and any visit's; a flow chart of every
    visit's first four pages; the commonest whole visits; pages a visit.
  - **Retention:** came back the next day / within 7 / within 30 days;
    **return visits by the week people first came** (a 12-week grid); new and
    returning; days visited; games a visitor; passports; consent.
  - **Health:** Core Web Vitals at the 75th percentile rated against
    Google's lines (by device and by page); script errors grouped by message
    and file, **each opening into its trend, stack, lines, pages, browsers,
    systems, countries and latest occurrences**; broken links; the island's
    frame rate; **what the database holds**, table by table, with its size
    and when the daily run last ran.
- Every chart has a table view and a CSV. Charts are hand-built SVG/canvas
  (`src/lib/admin/charts.ts`) in a validated cool palette: series blue, aqua,
  violet, pink; a one-hue blue ramp for magnitude; good / needs work / poor
  always with a mark and a word. Checked at desktop and 390 px, light and
  dark, with no horizontal overflow.

### Files

| File | What it is |
|---|---|
| `src/lib/analytics/shape.ts` | events, limits, cleaning, `gameResult`, `scrub`, stack frames, bots, devices, referrers, consent countries |
| `src/lib/analytics/client.ts` | the tracker, consent bar, Forget me, privacy-page helpers |
| `src/lib/analytics/db.ts` | connection (Neon / PGlite), schema, the daily hash |
| `src/lib/analytics/ingest.ts` | writing a batch, `visitors`, Forget me, pruning |
| `src/lib/analytics/rollup.ts` | the daily run, `claim`, `storage` |
| `src/lib/analytics/report.ts` | every number on the dashboard, as SQL (bound parameters only) |
| `src/lib/analytics/auth.ts`, `request.ts`, `csv.ts` | the admin session; request helpers (forwarded host, geo headers, rate limit); safe CSV |
| `src/lib/admin/ui.ts`, `charts.ts`, `tabs.ts` | the dashboard's toolkit, charts and tab layouts |
| `src/pages/admin/index.astro` | the dashboard page (also builds the country-code map and the island heat-map frame at build time) |
| `src/pages/api/**` | the endpoints listed above |
| `src/pages/privacy.astro`, `src/styles/consent.css` | the privacy page and the consent bar |
| `scripts/check-analytics.mjs` | the rules, proved, with the real SQL on an in-memory Postgres |
| `scripts/seed-analytics.mjs` | four months of made-up traffic for the dev database (refuses to run against a real one) |

### Working on it locally

1. Stop any dev server (PGlite allows one process), then
   `node scripts/seed-analytics.mjs`. It writes ~1,700 views and ~18,000
   events, with crowd picks, taps on the real map, errors with stacks, and
   days past 90 already summarised and trimmed.
2. Start `astro dev` with an `ADMIN_PASSWORD` in its environment (a local test
   value, never a real password) and sign in at `localhost:4321/admin/`.
3. `node scripts/check-analytics.mjs` after any change to the analytics.

---

## 7. Testing and quality

```bash
npm run dev            # localhost:4321 (the API and /admin/ work here)
npm run build          # -> dist/client and .vercel/output (bakes the island if it changed)
npm run preview        # serve the static build on 4400 (QA the pages here)
npm test               # every scripts/check-*.mjs suite
npm run bench:island   # drag benchmark + canvas-call budgets
npm run check          # test + build + bench (what CI runs)
```

- **All 62 suites pass** (section E). `check-analytics` alone has 115
  checks: what may be sent, Life in Weeks' scrub, stack frames, devices and
  bots, referrers, consent countries, that every event the code sends is
  known and every known one is sent, that no tracking call or pick reads
  what was typed, that every game reports its crowd, and then every
  dashboard tab's SQL, the crowd, where runs stop, the heat-maps, journeys,
  return visits, error detail, the daily run (count, trim, idempotence, the
  one-winner claim), long ranges reading the summaries, Forget me, pruning,
  the daily hash, forwarded hosts and the admin session.
- There is no `astro check` (`@astrojs/check` is not installed). `.ts` files
  are type-checked with `npx tsc --noEmit -p .`; its remaining errors are
  old ones in the island bake and a few art modules, none in the analytics.
- The pattern that has caught every serious bug: **build the model as pure
  functions, check it against answers someone else already knows, and keep
  the page a thin layer on top.** Art is checked by rasterising it with resvg
  and measuring it (visible, contrast, real internal structure rather than a
  shaded ball, distinct from its neighbours).
- Bar for every page: WCAG AA contrast, one `<h1>`, named controls, skip
  link, visible focus, `prefers-reduced-motion` honoured everywhere, no
  horizontal overflow at 375 px.
- Each island phase and each analytics phase was also verified in a real
  (headless) browser before and after deploying, using scripted CDP tests
  with screenshots (for analytics: a test visitor plays Trolley and taps the
  island, and the dashboard's numbers are read back).

---

## 8. Status of the Cursor Camp plan (A–H)

From the 1 October study of neal.fun's Cursor Camp. ✅ = built and live.

| Item | | Status |
|---|---|---|
| **A. Smoothness** | 1 baked tiles · 2 real links kept · 3 canvas panning · 4 low-detail stand-in while zooming · 5 no layer churn while moving · 6 drag benchmark + `?perf` | ✅ all |
| **B. Camera feel** | 7 time-based easing · 8 whole pixels · 9 rubber-band edges · 10 circle wipe into games and back · 11 held keys glide | ✅ all |
| **C. Art and scale** | 12 open closer · 13 heavier outlines · 14 shadows and roof tones · 15 ground detail · 16 canopy (done as "front windows": people pass behind trees and in front of buildings) · 17 living water · 18 real mini-map | ✅ all |
| **D. Life and presence** | 19 live visitors | ⏸ **needs owner decision** |
| | 20 things that react (ball, pigeons, ripples) | ✅ |
| | 21 timetable noticeboard, parade, Friday fireworks | ✅ |
| **E. Sound** | 22 surf measured from the coastline · 23 lower ambience while a card/passport is open · 24 a whoosh tied to pan speed · 25 sounds for entering a game and the wipe | ✅ all (6 Oct) |
| **F. Collecting and sharing** | 26 bottles + passport covers · 27 postcards | ✅ |
| **G. Wayfinding and phones** | 28 signposts · 29 first-visit welcome · 30 wider phone tap areas | ✅ |
| **H. Stay ahead** | accessibility, small download, free audio, time and weather | ✅ held throughout |

---

## 9. What is left

### Analytics: done

All three phases are live and nothing is waiting on the owner. Things worth
knowing as real traffic arrives:

- Several Phase 3 views (crowd choices, heat-maps, return-visit groups,
  error detail) start empty and fill as visitors play; the return-visit grid
  needs weeks.
- If the site is ever expected to be quiet for long stretches, an outside
  scheduler can call `/api/cron/nightly/` (set `CRON_SECRET` first). Not
  needed now.
- Ideas not built: per-question ordering on split charts (they sort by
  answers, not by the game's own order), a "compare two games" view, email
  digests, alerting on error spikes.

### Needs a decision from the owner

- **Name, email, domain** (`src/site.config.ts`), described in §1.
- **D19 live visitors.** Showing real people ("12 here · 3 playing Orbit")
  needs a real-time server. Options:
  1. *Live presence:* a small Cloudflare Durable Object with WebSockets,
     anonymous dots and per-game counts, nothing stored. Needs a Cloudflare
     account and, ideally, the domain. Costs little or nothing at this scale.
     (Recommended once the domain is settled.)
  2. *Daily popularity only:* small crowds outside the busiest buildings,
     from the play counts the analytics already keep. Now cheap: the data
     is in Neon, so it needs one small public endpoint and no new server.
  3. *Skip it:* the island already feels lived in.

### Ready to build when asked

- Nothing from the Cursor Camp list: A–H are built, and D19 waits on the
  decision above.

### Launch checklist (owner accounts needed)

- AdSense id (`adsenseClient`) renders nothing until set. Note Vercel's free
  plan is for non-commercial sites; ads would mean the Pro plan.
- A real NASA API key for Days Since Incident (`nasaApiKey`; `DEMO_KEY` is
  shared worldwide and rate-limited).
- Fusion worker: `npx wrangler kv namespace create FUSION`, then fill in
  `wrangler.toml` (KV id, route, `ALLOWED_ORIGINS`), `npx wrangler deploy`.
  Add rate limits and a model budget before going public. The Buy Me a
  Coffee handle is set (`krishna18`), and clicks on it are counted as links
  out.

### Known smaller gaps (from `PHASES.md` / `PLAN.md`)

- A keyboard alternative to Fusion's drag.
- `PLAN.md` Phase 4 (endings, scores and sharing) is marked *started*: the
  result-card machinery is done; not every game has a full ending.
- Real-device testing on actual phones; so far everything has been tested
  with headless and emulated phones.
- The honest limits, unchanged: the art is clean code-drawn SVG, not a human
  hand; no multiplayer; no audience yet (the dashboard will now show when
  there is one).

---

## 10. How we work (rules that have held all along)

- **Quality is the default.** Every phase is built to near-perfection the
  first time: real data, real models, checked against known answers. Art is
  staged big, not shrunk into cards. "Done only once, used by every visitor."
- **Cool theme only.** Mint, lagoon, navy, lilac, raspberry, pearl. Never
  orange or yellow (the dashboard included).
- **Large work in phases.** Plan it, split it into phases, and start each
  only when the owner says so ("start phase 2").
- **Each phase:**
  1. Build it.
  2. Run every check, the build and the bench.
  3. Verify in a real (headless) browser, desktop and phone, light and dark.
  4. Commit (message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
  5. Push (Vercel deploys). Confirm the deploy through the commit's status
     (`gh api repos/Krishna-1812/fungames/commits/<sha>/status`) and then on
     the live site, polling slowly (a minute apart) for a marker that
     survives minification. Fast polling trips Vercel's bot checkpoint,
     which is never bypassed.
  6. Report back in detail.
- **Account steps are the owner's:** Vercel storage and environment
  variables, logins (`gh auth login`), anything with a password. Local tests
  use generated test passwords, never real ones, and never repeated in chat.
- **Island motion is tested headless**, not in the app's preview pane: the
  hidden pane has no animation frames.
- **Benchmarks throttle** on battery, and sometimes on mains (~18–45 fps).
  Compare old and new builds in the same session before blaming a change.
- **Known traps** (all in memory and README):
  - Astro scoped CSS doesn't reach `set:html` or runtime-built markup
    (use `:global()` or `is:global`; the dashboard's styles are global).
  - An author `display` rule beats `[hidden]`.
  - `String.replace` expands `$'` in replacement strings (use a function).
  - Files are CRLF; edit scripts keep the endings. Shell heredocs and
    `node -e` mangle backslashes and backticks: write such scripts as files.
  - `requestAnimationFrame` never fires for first paint in a background tab.
  - In the bake: missing defs, double opacity, blurry scaled sprites.
  - With the Vercel adapter, `vercel.json` headers are ignored (copied in by
    `scripts/vercel-headers.mjs`), a function's `request.url` is an internal
    host (use `x-forwarded-host`), and a `crons` entry broke the deploy.
  - Scripted `.click()` sends no pointerdown, so the game shell never
    counts it as a start; tests use real mouse events.
- **Never automate:** payments, identity or financial details, CAPTCHAs, or
  bot protection. Downloads need explicit permission.

---

## 11. Where to look next

| Question | File |
|---|---|
| How a specific game works, in depth | `README.md`, "The thirty games" |
| How the analytics work, in depth | `README.md`, "Analytics"; §6 here |
| What a number on the dashboard means | `src/lib/analytics/report.ts` (each query has its comment) |
| Why a decision was made | `PLAN.md` (numbered items 1–68) |
| How the island works, in depth | `README.md`, "The homepage" |
| neal.fun measurements | `docs/neal-fun-research.md` |
| New machine set-up | `HANDOFF.md` |
| Design system rules | `src/styles/paper/README.md` |
| Add a game | `README.md`, "Adding a game" (registry entry, tile drawing, page, `check-art`; then a building in `landmarks.ts` + `lm-<district>.ts`; then `shell.pick` / `shell.progress` for its crowd statistics, or `check-analytics` fails) |
