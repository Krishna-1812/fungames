# funsite

A neal.fun-style site: one lean homepage, twelve self-contained interactive
pages, zero JavaScript bundles.

Built after taking neal.fun apart game by game. The teardown is in
[`docs/neal-fun-research.md`](docs/neal-fun-research.md) — every figure in it is
a measurement from the live site, not a guess.

---

## What neal.fun actually is

Measured 3–4 September 2026 by fetching the site, reading its build artifacts,
and driving all 47 games in a real browser.

| Layer | What it is | How I know |
|---|---|---|
| Framework | **Nuxt 2**, fully static | `data-n-head-ssr`; `/_nuxt/static/1788397388/{state,payload,manifest}.js` |
| CDN | **Cloudflare** | `server: cloudflare`; bot challenge on game routes |
| Game APIs | **Cloudflare Workers** | `asteroid-launcher.neal-api.workers.dev` |
| Stateful services | **DigitalOcean App Platform** | Internet Roadtrip, Wonders of Street View and Wiki Spy each on their own `*.ondigitalocean.app` |
| Ads | **AdSense _and_ Playwire** | `ca-pub-4556406968269041`, `cdn.intergient.com/…/ramp` |
| Analytics | **Plausible** | `data-domain="neal.fun"` |
| Maps / 3D | Apple MapKit, three.js | Asteroid Launcher |
| Anti-abuse | Turnstile + a WASM module | `pawtect_wasm_bg.wasm` on Internet Roadtrip |
| Scale | 180 URLs — ~47 games plus 130 generated `earth-reviews/*` pages | `sitemap.xml` |

An older interview (usesthis.com) says React/Node/MongoDB on Netlify. That is
out of date; the live site today is Nuxt behind Cloudflare.

### The five things the teardown actually teaches

1. **Most games have no server.** Of ~47, only eight talk to a backend. The
   default is a page that runs entirely in the browser.
2. **Weight goes into content, not framework.** The Password Game is 1 MB of
   *rules and word lists*. The Deep Sea is 183,642 pixels of *illustration*.
3. **Two page shapes cover almost everything**: a very long scroll, or a locked
   viewport you swipe through.
4. **Live data is a cheap thrill.** Progress, Speed, Baby Map and Days Since
   Incident are `setInterval` over a clock or a public feed.
5. **Determinism plus caching is what makes an AI game affordable** — see below.

### The one piece of architecture worth copying

Infinite Craft looks like it runs a language model on every combination. It
does not:

```
GET /api/infinite-craft/pair?first=Earth&second=Water
{"result":"Plant","emoji":"🌱","isNew":false}

cache-control: public, max-age=86400, s-maxage=259200
cf-cache-status: HIT     age: 45501
```

Pairs are normalised and sorted, so `Fire+Water` and `Water+Fire` are one key
and everyone on Earth gets the same answer. Once resolved, a pair is stored and
never asked again. The edge caches it for three days. The model is only ever hit
on a genuinely novel pair. The endpoint is also referer-gated — calling it from
a different page on the same origin returns `403 Not allowed`, which I confirmed
both ways.

`worker/fusion-worker.js` here is that architecture, reimplemented.

---

## What this repo is

**Astro 5**, static output. Chosen over Nuxt because Astro ships **zero
JavaScript by default**, so a page only carries what it actually uses. Nuxt 2,
what neal.fun runs, is end-of-life.

Game logic lives in module scripts that Astro bundles per page, with two shared
chunks — `lib/audio.ts` and `lib/fx.ts` — cached across the whole site.

```
src/
  site.config.ts        rebrand the whole site from here
  data/games.ts         the registry — one entry per game
  layouts/
    Base.astro          <head>, meta, OG tags, favicon, fonts, analytics, ads
    GameLayout.astro    game chrome: home link, title, share button
  components/
    GameTile.astro      homepage tile
    TileArt.astro       fifteen distinct generated tile illustrations
    AdSlot.astro        AdSense unit; renders nothing until configured
  lib/
    audio.ts            the synthesiser: every sound on the site, no audio files
    fx.ts               particles, screen shake, floating text
  pages/                one file per game, plus index, 404, sitemap, robots
worker/
  fusion-worker.js      Cloudflare Worker: referer gate, KV, edge cache, LLM
docs/
  neal-fun-research.md  the full game-by-game teardown
```

### Measured output

| Page | gzipped |
|---|---|
| `/` | 6.9 KB |
| `/progress/` | 5.0 KB |
| `/paper-folds/` | 5.3 KB |
| `/rule-cascade/` | 5.3 KB |
| `/steady-hand/` | 5.4 KB |
| `/life-in-weeks/` | 5.4 KB |
| `/trolley/` | 5.8 KB |
| `/from-memory/` | 6.5 KB |
| `/fusion/` | 6.6 KB |
| `/ambient-mix/` | 7.2 KB |
| `/spend-it/` | 7.2 KB |
| `/deep-time/` | 7.4 KB |
| `/scale/` | 7.4 KB |

**0 JavaScript bundles.** One 1 KB shared CSS file. No images, no audio files,
no fonts beyond Google Fonts.

---

## The fifteen games

Three of them carry the site. The rest are one good idea each.

### The big three

**Powder** — a falling-sand sandbox: a cellular automaton over typed arrays,
rendered straight into an `ImageData` buffer. Twelve materials and about forty
local rules, and everything interesting is emergent. Oil floats on water because
it is lighter. Lava quenched by water becomes stone; lava touching sand becomes
glass; plants drink puddles and take over. *Verified: dropping lava on ice
produced 124 steam pixels and 66 stone pixels as the reaction cascaded, and sand
settles at a real angle of repose.*

**Orbit** — an n-body gravity sandbox with softened Newtonian forces and a
leapfrog integrator, so orbits stay stable for minutes instead of spiralling
apart. Collisions merge bodies and conserve momentum. Trails come from fading
the canvas, not from stored history. *Verified: the Chaos preset collapsed 90
scattered bodies into 5 survivors through 85 collisions, at a steady 60 fps —
planetary accretion, unscripted.*

**Overstimulated** — a clicker where every upgrade makes the page worse: a
progress bar that measures nothing, a bassline, notifications, a newsletter
popup, nineteen extra cursors, a permanent screen shake, and a slow rotation of
the entire page. All fifteen layers genuinely run at once. There is a "Make it
stop" button, and pressing it removes every layer and leaves you with a count of
what you did.

### The rest

**Deep Time** — 4.54 billion years across five zoom levels, seams shown rather
than hidden. Colliding cards move into side lanes and shed their notes, resolved
at runtime against measured heights. *Zero overlaps at 375, 464 and 1280 px.*

**Scale** — a continuous logarithmic zoom from a proton to the observable
universe. Scroll position sets how wide the screen is in metres; objects are
drawn at their true size relative to that. *No blank stretch across 40 sampled
positions.*

**Rule Cascade** — twelve escalating username rules, none of which ever switch
off, one of which reads the clock. *Verified solvable by construction.*

**Spend It** — one hundred billion dollars, thirty real-priced things. *Balance
cannot go negative by clicking, shift-clicking, or typing a huge quantity.*

**Steady Hand** — one stroke between two dots, scored on arc-length-weighted
perpendicular deviation with an overshoot penalty. *Perfect line 100.0%, 4 px
wobble 86.4%, 30 px wobble 4.0%.*

**Fusion** — drag one thing onto another. Playable offline via a local recipe
table; the Cloudflare Worker takes over when deployed.

**Trolley** — twelve dilemmas scored against four named ethical positions rather
than against invented crowd statistics.

**Paper Folds** — 0.1 mm doubled 103 times, with the pitch climbing on every
fold so the exponential is audible. *Fold 42 reaches the Moon, fold 103 exceeds
the observable universe; the layer count uses BigInt so it stays exact.*

**Ambient Mix** — twelve soundscape layers, all synthesised live. *Analyser tap
measured peak 0.34, RMS 0.08 — real output, not just a running context.*

**Progress** — every unit of time you are inside, draining every frame.
*All thirteen bars checked against hand calculation.*

**From Memory** — draw a bicycle, then see a real one. Deliberately not brand
logos.

**Life in Weeks** — ninety years as 4,680 squares from one typed date.

---

## Sound

There is not a single audio file on this site. `lib/audio.ts` is a small
synthesiser: enveloped oscillators and filtered noise, with a pentatonic helper
so rapid or stacked notes never clash. That means sounds take parameters — the
click in Paper Folds rises in pitch with the fold count, and a buying streak in
Spend It plays a rising run rather than the same clip fifty times.

Audio is created lazily on the first gesture, respects a persisted mute
preference, and every game gets the same speaker button in its chrome.

## Quality bar

Checked against the **production build**, not the dev server:

- **Accessibility** — 0 colour-contrast failures on any of the 16 pages (WCAG
  AA, measured by compositing every text node against its real background);
  every page exactly one `<h1>`; every control named; every image has `alt`;
  skip link; visible focus ring; `prefers-reduced-motion` honoured throughout,
  including the particle system and Overstimulated's tilt. Disabled controls
  use their own colour pair rather than dimming. The mute button is a drawn SVG
  rather than an emoji, so it inherits the chrome's ink and can be measured.
- **Responsive** — 0 pixels of horizontal overflow on any page at 375 px.
- **Routing** — every tile 200, unknown paths 404, sitemap and robots.txt live.
- **Performance** — Powder and Orbit both hold 60 fps with thousands of
  particles; Orbit caps at 320 bodies and the particle system at 900.

---

## Running it

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # -> dist/
npm run preview   # serve the real build on :4400
```

QA against `npm run preview`. Astro's dev server caches component CSS
aggressively and will happily serve you a stale stylesheet after an edit; if
styles look wrong in dev, stop the server, `rm -rf node_modules/.vite .astro`,
and start it again.

## Adding a game

1. Add an entry to `src/data/games.ts` (pick one of the twelve `art` values).
2. Create `src/pages/<slug>.astro` wrapped in `<GameLayout slug="<slug>">`.

Tile, `<head>`, favicon, share button and sitemap entry all follow. Pass `fixed`
for games that own the viewport, `bodyClass` for a different page background.

### Two traps worth knowing

- **Runtime-created elements do not get Astro's scoped-style attribute.**
  Anything you build with `document.createElement` needs its rules in a
  `<style is:global>` block or they silently do nothing.
- **Nested template literals containing raw markup break Astro's frontmatter
  parser.** Keep SVG strings at one interpolation level.
- **Do not use `requestAnimationFrame` for first paint.** It is paused in
  background tabs, so a page opened in one and switched to later never
  initialises. Lay out immediately, and fall back to a `ResizeObserver` if the
  element has no size yet. Powder, Orbit and Fusion all do this.
- **A module script cannot take `define:vars`.** Games that need frontmatter
  data emit a `<script type="application/json">` and parse it, which is what
  lets them all import the shared synthesiser.

## Deploying

Static output — any host. `netlify.toml` and `public/_headers` are included;
Cloudflare Pages reads both.

The Fusion backend is optional (the game works without it):

```bash
npx wrangler kv namespace create FUSION   # put the id in wrangler.toml
npx wrangler deploy
```

Then set `fusionApi` in `src/site.config.ts`, and update `ALLOWED_ORIGINS` in
`worker/fusion-worker.js` and the route in `wrangler.toml` to your domain. It
uses Cloudflare Workers AI by default; delete the `[ai]` block and set
`LLM_BASE_URL`, `LLM_MODEL` and the `LLM_API_KEY` secret to use any
OpenAI-compatible endpoint instead.

## Rebranding

Everything user-facing is in `src/site.config.ts` — name, domain, tagline,
contact, socials, Plausible domain, AdSense id. Analytics and ads render nothing
until those are filled in.

## What neal.fun has that this does not

- Hand-drawn tile art. Tiles here are generated so a new game looks deliberate
  immediately; swap `TileArt.astro` for `<img src="/tiles/<slug>.svg">` when you
  draw real ones.
- Multiplayer. Internet Roadtrip is a websocket server on separate infra with
  Turnstile and a WASM anti-cheat in front of it.
- Commissioned illustration. Size of Life credits a named palaeoartist.
- Rate limiting beyond the worker's referer gate. Add Cloudflare rate limiting
  before you get popular.
