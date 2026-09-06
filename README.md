# funsite

A neal.fun-style site: one lean homepage and eighteen self-contained
interactive pages, each rendered with its own WebGL shader or 2D canvas and
shipping only the script that page actually needs.

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

Game logic lives in module scripts that Astro bundles per page. Three chunks
are shared across every page that uses them — `lib/audio.ts` (the
synthesiser), `lib/fx.ts` (particles, screen shake, floating text) and
`lib/gl.ts` (the WebGL runtime: one shared frame loop across every shader on a
page, context-loss handling, the common GLSL noise/tonemap library). Each
game's actual visual — the shader or canvas work that makes it look like that
specific game rather than a template — lives in its own small file beside
those three, one per game, not one shared renderer.

```
src/
  site.config.ts        rebrand the whole site from here
  data/games.ts         the registry — one entry per game
  layouts/
    Base.astro          <head>, meta, OG tags, favicon, fonts, analytics, ads
    GameLayout.astro    game chrome: home link, title, share button
  components/
    GameTile.astro      homepage tile
    TileArt.astro       eighteen distinct generated tile illustrations
    AdSlot.astro        AdSense unit; renders nothing until configured
  lib/
    audio.ts            the synthesiser: every sound on the site, no audio files
    fx.ts               particles, screen shake, floating text
    gl.ts               the WebGL runtime: shared frame loop, GLSL noise/tonemap library
    <game>-*.ts         one small rendering module per game (e.g. powder-render.ts, orbit-render.ts)
  pages/                one file per game, plus index, 404, sitemap, robots
worker/
  fusion-worker.js      Cloudflare Worker: referer gate, KV, edge cache, LLM
docs/
  neal-fun-research.md  the full game-by-game teardown
```

### Measured output

Gzipped weight of each page: its HTML plus the full transitive import graph of
its own script — the shared `lib/audio.ts`/`lib/fx.ts`/`gl.ts` chunks counted
once each, not per page. Measured from a real `npm run build`, gzip level 9,
fonts excluded (loaded once, cached site-wide, not part of any single page's
cost).

| Page | gzipped |
|---|---|
| `/paper-folds/` | 9.4 KB |
| `/trolley/` | 11.8 KB |
| `/steady-hand/` | 14.4 KB |
| `/ambient-mix/` | 14.5 KB |
| `/life-in-weeks/` | 14.7 KB |
| `/progress/` | 15.3 KB |
| `/rule-cascade/` | 15.3 KB |
| `/deep-time/` | 16.1 KB |
| `/fusion/` | 16.1 KB |
| `/spend-it/` | 16.6 KB |
| `/from-memory/` | 16.9 KB |
| `/scale/` | 17.9 KB |
| `/overstimulated/` | 19.8 KB |
| `/powder/` | 22.6 KB |
| `/orbit/` | **142.6 KB** |

Orbit is the one outlier: its WebGL renderer is built on three.js, and that
library alone accounts for essentially all of the difference. Every other page
stays under 23 KB total. No images, no audio files, no fonts beyond Google
Fonts — every sound on the site is synthesised, and every visual is either
drawn or is one of a handful of small hand-written shaders.

---

## The eighteen games

Four of them carry the site. The rest are one good idea each.

### The big four

**Asteroid Launcher** — pick a rock between 1 m and 20 km, a composition, a
speed and an entry angle, then drop it on any of 4,926 real cities. The model is
Collins, Melosh & Marcus (2005): atmospheric entry with breakup and pancake
dispersion, pi-group crater scaling, fireball radius, blast overpressure, seismic
magnitude and recurrence interval, with casualties from city footprints and a
lethality ladder calibrated on Hiroshima and Chelyabinsk. *`scripts/check-impact.mjs`
reproduces Chelyabinsk, Tunguska, Meteor Crater and Chicxulub — the entry model,
the airburst reflection and a crater-depth unit bug were all caught by it.*

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

**Rule Cascade** — thirty escalating username rules, none of which ever switch
off. Three of them do something rather than just checking: a moth eats one
character every six seconds until you put a spider in, a sacrifice takes
whichever letter you have leaned on hardest and never gives it back, and one
rule asks how many rules are on screen — so satisfying it unlocks another and
immediately makes it wrong again. *`scripts/check-cascade.mjs` builds a real
solution for all 24 hours, all 26 possible sacrifices, and every rung of that
counting ladder. It caught a no-repeats rule that made the game unwinnable for
three hours of every day, and a parity trap where the length could never be
prime.*

**Spend It** — one hundred billion dollars, thirty real-priced things. *Balance
cannot go negative by clicking, shift-clicking, or typing a huge quantity.*

**Steady Hand** — one stroke between two dots, scored on arc-length-weighted
perpendicular deviation with an overshoot penalty. *Perfect line 100.0%, 4 px
wobble 86.4%, 30 px wobble 4.0%.*

**Fusion** — drag one thing onto another. Playable offline via a local recipe
table; the Cloudflare Worker takes over when deployed.

**Trolley** — twenty-six dilemmas, each authored with what four named ethical
positions actually say about it, so the ending scores your answers against all
four instead of inventing crowd statistics. *`scripts/check-trolley.mjs` plays
the whole game as a strict follower of each position and checks it gets named
correctly, and that no two positions agree often enough to be the same thing
under different names — the closest pair, utilitarian and contractualist, still
part company on six of twenty-three.*

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

**The Auction Game** — fourteen lots, five rivals with their own money and their
own bad habits, and £12,000. Real bidding increments, a real 25% buyer's premium,
a secret reserve, and bids the auctioneer takes off the wall below it. At the end
it names the four mechanisms that separated you from your money and puts your
own number against each. *The winner's curse is not scripted: every bidder values
a lot as the truth times their own taste, so the winner is disproportionately
whoever most overrated it. `scripts/check-auction.mjs` runs 28,000 lots and
measures that winners really do pay about 31% over the appraisal — and it caught
a premium/affordability pair that was not an exact inverse, and a room where one
rival won 70% of everything.*

**I'm Not a Robot** — twelve checks that start like a CAPTCHA and end somewhere
else, over a behavioural profiler that measures the same channels real bot
detection does: pointer straightness, tremor, velocity profile, click and
keystroke rhythm, hand drift while holding still, and the isoperimetric quotient
of a freehand circle. The report card reads your own numbers back. *The
thresholds are invented for the joke and the page says so; the maths is checked
by `scripts/check-telemetry.mjs` against a ruler-straight path, a unit zigzag, a
square and a 64-gon, all with answers worked out by hand.*

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

- **Accessibility** — 0 colour-contrast failures on any of the 20 pages (WCAG
  AA, every text node measured against the background actually painted behind
  it; the homepage tile text sits on a gradient, so it is checked against both
  gradient endpoints instead);
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

Five games carry enough real modelling that the maths is checked separately,
against answers from the literature, worked out by hand, or measured over a
simulation:

```bash
node scripts/check-impact.mjs      # Asteroid Launcher, vs four real impacts
node scripts/check-telemetry.mjs   # I'm Not a Robot, vs known geometry
node scripts/check-auction.mjs     # The Auction Game, over 28,000 lots
node scripts/check-cascade.mjs     # Rule Cascade, is it still finishable
node scripts/check-trolley.mjs     # Trolley, are the four positions distinct
```

All five exit non-zero on failure. None needs a browser — the analysis in
`lib/impact.ts`, `lib/casualties.ts`, `lib/telemetry.ts`, `lib/auction.ts` and
`lib/cascade-rules.ts` and `data/dilemmas.ts` is
deliberately pure functions over plain data so it can be run this way. The
auction checker also guards the *balance*: it fails if any one rival wins more
than 45% of the room or less than 5%, so tuning a bidder cannot quietly wreck
the game. `scripts/build-world-data.mjs`
regenerates `src/data/world.ts` (coastline and cities) and only needs running if
those sources change.

QA against `npm run preview`. Astro's dev server caches component CSS
aggressively and will happily serve you a stale stylesheet after an edit; if
styles look wrong in dev, stop the server, `rm -rf node_modules/.vite .astro`,
and start it again.

## Adding a game

1. Add an entry to `src/data/games.ts` (pick one of the `TileArt` values, or
   add a new one to both the type and `TileArt.astro`).
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
