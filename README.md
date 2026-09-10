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
    TileArt.astro       places one drawing on a tile, per lib/tile-art.ts
    AdSlot.astro        AdSense unit; renders nothing until configured
  lib/
    tile-art.ts         eighteen bespoke tile drawings, one per game slug
    scale-things.ts     what Scale draws, how big it is, and the sky behind it
    scale-art.ts        twenty-six of those drawn, with both their real axes
    time-events.ts      Deep Time's forty-four events and when they happened
    time-art.ts         a scene for each, flat colour on one palette
    trolley-scene.ts    the field, the track, the tram and whoever is on it
    fold-paper.ts       Gallivan's equations, and where a real sheet gives up
    fold-scene.ts       that sheet as an object on a desk: projection, one
                        light, and the lip the crease has to turn through
    fold-sky.ts         where you are, given how thick the stack is — a desk
                        at fold zero, intergalactic space at a hundred and
                        three — and the dark palette the console is cut from
    fold-scale.ts       thirty-two real things with real heights, from a grain
                        of sand to the observable universe, and the silhouettes
                        the page stands next to the paper
    progress-time.ts    the fifteen units you are inside of, ordered by span,
                        and the date arithmetic that survives a 23-hour day
    progress-geom.ts    where each of the dial's channels is, which one a
                        point is in, and how dark the readout's ground may be
    progress-dial.ts    that instrument as a fragment shader: milled channels,
                        a knurled bezel, engine turning and a crystal
    progress-panel.ts   the wall it is bolted to, and the one lamp above it
    sky-forecast.ts     Meeus: seasons, moon phases, eclipses, perihelion,
                        the Moon’s distance and how much of it is lit
    robot-scene.ts      the CAPTCHA's street, in perspective, with materials,
                        light direction, haze and grain — and which of its nine
                        squares the traffic light is actually in
    result-card.ts      the 1200x630 card for a *result*, not for a game
    share-card.ts       rasterising it in the browser, and sharing the file
    stats.ts            one key, one version, one shape, for what you finished
    icons.ts            sixty-five drawn icons, shared across the games
    icon-uses.ts        which game asks for which icon, and on what background
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
| `/progress/` | 18.1 KB |
| `/rule-cascade/` | 15.3 KB |
| `/deep-time/` | 16.1 KB |
| `/fusion/` | 16.1 KB |
| `/spend-it/` | 16.6 KB |
| `/from-memory/` | 16.9 KB |
| `/scale/` | 17.9 KB |
| `/overstimulated/` | 19.8 KB |
| `/powder/` | 25.2 KB |
| `/orbit/` | **142.6 KB** |

Orbit is the one outlier: its WebGL renderer is built on three.js, and that
library alone accounts for essentially all of the difference. Every other page
stays under 26 KB total. No images, no audio files, no fonts beyond Google
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
rendered straight into an `ImageData` buffer. Thirty-one materials and
forty-eight named reactions, and everything interesting is emergent. Oil floats
on water because it is lighter. Lava quenched by water becomes stone; lava
touching sand becomes glass; plants drink puddles and take over. Every reaction
is a thing to find, and the log tells you how many are left. On top of that,
eight **scenarios**: a set grid, most of the palette taken away, a budget of
paint, and one number to reach. *`scripts/check-powder.mjs` runs all
forty-eight reactions from both sides, then plays every scenario to completion
headlessly and checks none of them can be passed by waiting. It caught a
material you could draw with that took part in nothing at all, and later that
lava was quietly autocatalytic — eighty cells of it became eighteen hundred and
ate a whole sand bed.*

**Orbit** — an n-body gravity sandbox with softened Newtonian forces and a
symplectic integrator, so orbits stay stable for minutes instead of spiralling
apart. Collisions merge bodies and conserve momentum. Trails come from fading
the canvas, not from stored history. Eight challenges turn it from a toy into
something with an aim: a near-circular orbit, a comet, a grazing pass, a
binary, a real gravity assist. *`scripts/check-orbit.mjs` drives all of them
headlessly and checks the physics underneath first — it caught the presets
launching planets at the textbook Kepler speed, which is 10% too fast in a
softened field, and it threw out a ninth challenge that turned out to be
unwinnable by anything but luck.*

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

The forty-four scenes were always well drawn and always shown small — a
116px thumbnail in a flat charcoal box with a plain white hairline, the one
picture the page had reduced to an icon. Each card is now lit by `MOOD`, a
colour computed from that scene's own drawing (an area-weighted walk of its
fills, six backdrop tones excluded so the sky or sea a scene happens under
can never outvote what is actually in it) rather than a palette chosen to
match it after the fact — so the Cambrian explosion's card glows the same
blood-red the animal is drawn in, and cannot drift from it later. The art
itself grew with the frame: 172px at the widest lane, up from 116, with the
eleven major turning points bigger again and a one-shot glow the instant one
first centres in view. *`check-time-art.mjs` walks every scene's own SVG back
out and confirms the colour it computes is the one the page actually shows,
and that colour is really in the drawing — not a plausible guess sitting
next to it.*

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

**Steady Hand** — four shapes, one unbroken stroke each: a line between two
dots, a circle round one, a square through four corners, a two-turn spiral.
Nothing is traced. The circle fixes only its centre and takes its radius from
what you drew, so it measures roundness rather than obedience. A score is
accuracy × coverage × economy — how close, how much of it, and against how far
you travelled — and all four bests average into one rating. *`scripts/check-steady.mjs`
feeds the scorer drawings whose answer is known: a perfect trace scores 100 on
every shape, a sine wobble drifts by exactly 2a/π as the maths says, half a
circle loses half, and scrubbing the line three times over loses most of it
even though every point is in the right place. It also proves the same wobble
scores the same on a phone and a monitor, and at every angle.*

**Fusion** — drag one thing onto another. Playable offline via a local recipe
table; the Cloudflare Worker takes over when deployed.

**Trolley** — twenty-six dilemmas, each authored with what four named ethical
positions actually say about it, so the ending scores your answers against all
four instead of inventing crowd statistics. *`scripts/check-trolley.mjs` plays
the whole game as a strict follower of each position and checks it gets named
correctly, and that no two positions agree often enough to be the same thing
under different names — the closest pair, utilitarian and contractualist, still
part company on six of twenty-three.*

**Paper Folds** — fold a real sheet by dragging its edge over, and it stops
when a sheet of that size and thickness stops: seven times for A4, twelve for
the 1,219-metre roll Britney Gallivan used in 2002. Then a button that says what
it is doing carries the doubling on to 103 without any paper. The sheet is drawn
as an object on a lit desk, and the rounded lip at the crease — the paper that
went round the bend — grows until it is wider than the paper left to feed it.
**The page's backdrop is the altitude**: fold zero is a lamplit desk, by thirty
you are past the Kármán line, and the last fold has nothing behind it but other
galaxies. It is all one dark instrument, so the sheet of paper is the brightest
thing on the screen — which is the point, and which the first version got
backwards. And beside it the page answers "how big is that?" by standing
something real next to it: at fold twenty-one the stack is 64% of the way up
the Eiffel Tower, at twenty-two it is past it and the view pulls back to
Everest. Each of the six sheets is drawn in its own material, so gold leaf
folds as beaten metal and a tissue as a tissue; and the length budget is drawn
as a length — what the folds behind you have spent, what this one is about to
take, and a hard mark at the end of the paper that the failing fold visibly
crosses. *Fold 42 reaches the Moon, fold 103 exceeds the observable universe;
the layer count uses BigInt so it stays exact. The limit is not typed in — it
comes out of Gallivan's two equations, and `check-fold.mjs` holds them to what
people have actually managed. A page whose background travels thirty orders of
magnitude has one catastrophic failure mode — the ink and the surface passing
through the same grey somewhere in the middle — and a dark console with light
ink cannot: `check-fold-scene.mjs` checks the two luminance bands at the stops
rather than sampling the ratio and hoping.*

**Ambient Mix** — twelve soundscape layers, all synthesised live, eight
presets worth arriving at, and the whole mix in the URL: every layer at once is
twenty-six characters. *Analyser tap measured peak 0.34, RMS 0.08 — real
output, not just a running context. `scripts/check-mix.mjs` treats the code as
what it is, a promise to a stranger: it round-trips four thousand random mixes,
throws two dozen kinds of mangled URL at the decoder, and checks a link still
means the same thing after the layer list is reordered, added to and cut down —
which is the failure an index-based format makes silently.*

**Progress** — every unit of time you are inside, draining every frame. Fifteen
of them, ordered by span and drawn as concentric channels milled into one dial:
this second at the rim, the Sun's life dead centre, and each one containing the
one outside it. The fast channels run with hot lume and the slow ones hold cold
mineral, so a still screenshot still says which is which. *`check-progress.mjs`
walks a year of instants through the date model in five timezones — including
Lord Howe Island, whose clocks move by thirty minutes — and found that
`setSeconds(0, 0)` does not survive the autumn change: during the repeated hour
a local wall-clock time names two instants, and the minute came back an hour
away from the instant inside it. `check-progress-dial.mjs` walks the radius and
checks the ring the pointer finds is the ring the shader milled, at fifteen
rings and at the fourteen it will have after January 2038.*

**From Memory** — draw a bicycle, then see a real one. Sixteen prompts, ten a
sitting, deliberately not brand logos. *`scripts/check-memory.mjs` parses every
coordinate of every reference and checks it lands inside the box it is drawn
over, arcs included — a wrong bounding box there is invisible in the source and
obvious on screen.*

**Life in Weeks** — ninety years as 4,680 squares from one typed date. The
grid's own claim — cool at birth, warm as the years go by, and one square that
still breathes — used to sit inside a page of plain flat cards. The stat tiles,
the ask form and the facts list now share one plate each, built from the exact
five colours the shader mixes with rather than a matching palette invented
beside it, and the "weeks lived" / "weeks left" tiles carry a hairline bar each
that always sums to a full width between them. The one thing that reaches
past the grid: a warm horizon at the foot of the page that grows with how much
of ninety years is behind you, nothing before a date is typed.

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
else, built to the real widget's measurements: a 300x74 anchor with a 28px box
and a spinner that pauses before it believes you, a challenge floating over a
dimmed page, a blue instruction header with the target word set large under a
small lead-in, four-pixel gutters, a tick that lands in the corner as the tile
shrinks away from it, and Roboto over the lot. What changes as you go is the
colour of that header, which starts where every verification dialog on the
internet starts and works its way round to red. Underneath it is a behavioural
profiler measuring the same channels real bot detection does: pointer straightness, tremor, velocity profile, click and
keystroke rhythm, hand drift while holding still, and the isoperimetric quotient
of a freehand circle. The report card reads your own numbers back. *The
thresholds are invented for the joke and the page says so; the maths is checked
by `scripts/check-telemetry.mjs` against a ruler-straight path, a unit zigzag, a
square and a 64-gon, all with answers worked out by hand.* The street is a
drawing, and which of its squares hold the traffic light is derived from where
the light is rather than written down beside it: `scripts/check-robot-scene.mjs`
renders the scene with the light and without it, and checks that the squares
whose pixels moved are the squares the arithmetic named. There are two keys,
because the signal head is a fact and the pole under it is a judgement, and
grading a judgement as though it were a fact is the single thing that makes real
CAPTCHAs infuriating. The street is baked to a JPEG at build time by
`pages/street.jpg.ts`, because the tiles are crops of one picture rather than
nine copies of a drawing, and because the artefacts of lossy compression are
themselves part of what a real tile looks like.

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

Ten games carry enough real modelling that the maths is checked separately,
against answers from the literature, worked out by hand, or measured over a
simulation:

```bash
node scripts/check-impact.mjs      # Asteroid Launcher, vs four real impacts
node scripts/check-telemetry.mjs   # I'm Not a Robot, vs known geometry
node scripts/check-robot-scene.mjs # the CAPTCHA street, and its answer key, in pixels
node scripts/check-auction.mjs     # The Auction Game, over 28,000 lots
node scripts/check-cascade.mjs     # Rule Cascade, is it still finishable
node scripts/check-trolley.mjs     # Trolley, are the four positions distinct
node scripts/check-powder.mjs      # Powder, every reaction and every scenario
node scripts/check-memory.mjs      # From Memory, do the references fit the box
node scripts/check-orbit.mjs       # Orbit, the integrator and all eight challenges
node scripts/check-mix.mjs         # Ambient Mix, do shared links survive
node scripts/check-steady.mjs      # Steady Hand, is the scoring fair
node scripts/check-art.mjs         # the tile illustrations, rasterised and measured
node scripts/check-icons.mjs       # the in-game icons, at the size they render
node scripts/check-scale-art.mjs   # Scale's objects, over Scale's own sky
node scripts/check-time-art.mjs    # Deep Time's scenes, at the card's own widths
node scripts/check-trolley-scene.mjs # Trolley's picture, against what it claims
node scripts/check-fold.mjs        # the paper model, against paper
node scripts/check-fold-scene.mjs  # Paper Folds' drawing, and its sky, at every fold
node scripts/check-fold-scale.mjs  # the ladder of real things, and the silhouettes
node scripts/check-progress.mjs    # Progress's date maths, in five timezones
node scripts/check-progress-dial.mjs # the instrument: rings, hit test, readout
node scripts/check-forecast.mjs    # the sky model, against Meeus and real eclipses
node scripts/check-result-card.mjs # the share card, at every game and result shape
node scripts/check-stats.mjs       # what the site remembers, against a hostile store
```

`npm test` runs all of them and reports which suites failed; `npm run check`
adds the production build. Each exits non-zero on its own. None needs a browser — the analysis in
`lib/impact.ts`, `lib/casualties.ts`, `lib/telemetry.ts`, `lib/auction.ts`,
`lib/cascade-rules.ts`, `data/dilemmas.ts`, `lib/powder-rules.ts`,
`data/memory.ts`, `lib/orbit-sim.ts`, `lib/orbit-goals.ts`, `lib/powder-sim.ts`,
`lib/powder-goals.ts`, `lib/mix-code.ts`, `lib/steady-shapes.ts`,
`lib/tile-art.ts`, `lib/icons.ts`, `lib/progress-time.ts`,
`lib/progress-geom.ts` and `lib/scale-art.ts` is deliberately pure
functions over plain data so it can be run this way.

`check-art.mjs` is the odd one out and worth explaining, because illustration
is the one thing here with no formula to check against. It rasterises every
tile with resvg exactly as the page composites it — same gradient, same
vignette, same slot geometry, same left-hand fade — and then measures the
result: is the drawing visible at all, does white text still clear WCAG on the
background *under its own letters*, and are the eighteen drawings actually
different from each other. It renders the title and blurb too, so contrast is
judged where the type lands rather than over a rectangle that is mostly empty.
Run it with `--sheet out.png` to get a contact sheet of all eighteen tiles
from the same compositor.

`check-icons.mjs` does the same job for the sixty-five drawn icons inside the
games. They get 26 to 34 pixels, on pages that are cream in three cases and
nearly black in two, so it renders each one at the size and on the background
it actually appears on. `--sheet out.png` writes the whole set on both a cream
and a near-black ground, which is the only way to see the constraint they are
drawn under.

`check-scale-art.mjs` is the third of these, and the one whose central question
is the hardest to write down: **is this a picture of the thing, or a coloured
ball?** Every other test a drawing can pass — it has ink, it has contrast, it
is inside its frame — a lit sphere passes too, which is how Scale spent a year
rendering a proton, a whale and the Eiffel Tower as the same shape in different
colours. The measure that separates them is *internal structure*: what fraction
of the object's own pixels sit on a step in luminance rather than on a smooth
ramp. A shaded sphere scores about 1% however strong its shading, because a
gradient is not an edge, and the file renders exactly that sphere as a control
so the floor is known to be a bar something can fail.

Two of its other tests were wrong before they were right, and both are on
record in the file. Judging "can you see it" with a WCAG luminance ratio failed
the football pitch at 9% — a green pitch on a pale blue sky, which is about as
visible as two things get — because mid-green and mid-blue sit at similar
lightness; it uses oklab distance now. And measuring over each object's
bounding box rather than its own ink failed the Eiffel Tower for being a
lattice. That is the same mistake `check-art.mjs` made about a text container
and `check-icons.mjs` made about a glyph, which is three times, so it is
written down here rather than in a commit message.

`--sheet out.png` lays all twenty-six out on the sky each one appears over;
`--dbg "name,name" dir` renders single objects nearly full-frame, for the part
no measurement covers, which is whether it looks like the thing.

`check-time-art.mjs` covers Deep Time's forty-four scenes. Two things make it
different from the other two. Its drawings have **no ids, no defs and no
gradients at all** — the other modules prefix ids to keep forty-four, twenty-six
and eighteen drawings from colliding in one document, and having none is a
guarantee rather than a convention — and every colour must come from one
twenty-one-entry palette, which the file enforces rather than asks for.

It also covers `MOOD`, the colour each scene's own card is lit by. Two
things could make that claim quietly stop being true: a computed colour that
does not actually appear anywhere in the scene it is meant to represent, and
the one hand-written correction — `The steam engine`, whose frame really is
more soil-brown by area than iron, but which is the first power in the whole
timeline that is not muscle, water or wind and should not be lit like a barn
— drifting out of step with a scene that has since been redrawn. Both are
checked directly: every `MOOD` value has to be found inside its own scene's
markup, and re-deriving the whole set from nothing has to agree with what
the module exports everywhere except that one documented exception.

`check-trolley-scene.mjs` is the fourth, and the only one that checks a
picture against a *claim*. Trolley's scene is the one place the player learns
who is standing where, so the file asks whether the drawing agrees with the
dilemma: the footbridge case must draw no lever, because it has none; a lever
wired to nothing must draw a dashed branch; a looping branch must put nobody on
it. It also proves every token kind draws something — a `kind` the drawing does
not handle renders an empty track where five people are supposed to be — and
that five people, five lobsters and five chickens are three different pictures
rather than three rows of dots.

Its own mistake is worth reading. It first ran one edge-density floor at all
three card widths and called the narrowest the hard case. That is backwards:
edge pixels track the *perimeter* of what is drawn and the total tracks the
*area*, so the ratio rises as an image shrinks, and one floor across three
sizes grades size rather than legibility. The run proved it by failing a scene
at 116 pixels that scored nearly twice as well at 52. It now asks two
questions instead — structure at the width most cards get, and what fraction of
the frame is subject rather than backdrop at the width a dense cluster gives.

It has earned its keep. It caught a "puzzle" whose illustration was invisible
over its own card, three pairs of tiles that were the same colour as each
other, an illustration that took its title's contrast from 8:1 to 2.2:1, and
twenty-four stars Orbit was drawing entirely outside its own frame — which were
not only invisible on every page load but enough to make resvg abort outright
at one card width. The
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

1. Add an entry to `src/data/games.ts`.
2. Add a drawing to `src/lib/tile-art.ts` under the same slug — pick a `slot`
   that is not already used three times, and give every gradient id inside it
   the slug as a prefix.
3. Create `src/pages/<slug>.astro` wrapped in `<GameLayout slug="<slug>">`.
4. Run `node scripts/check-art.mjs`. It fails if the game has no drawing, if
   the drawing is invisible on its own card, if it sits on the title, or if
   another tile is already that colour.

Tile, `<head>`, favicon, share button and sitemap entry all follow. Pass `fixed`
for games that own the viewport, `bodyClass` for a different page background.

### Two traps worth knowing

- **Content passed with `set:html` does not get Astro's scoped-style
  attribute either** — same trap as below, different door. The tile drawings
  carry their own fills for exactly this reason.
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

Run `npm run check` before release (Node 24). `npm test` discovers and runs all
`scripts/check-*.mjs` suites; `npm run check` also builds the static site.
The GitHub Actions workflow runs the same command on pushes and pull requests.

Fusion uses versioned, unambiguous pair keys. Existing browser discoveries are
preserved; legacy recipe caches are rebuilt as pairs are tried again. The
worker's v2 KV namespace prefix intentionally does not read old ambiguous keys.
Its response contains `result` and `emoji`; discovery celebrations are personal
to the browser, not a claim to be the first player globally.

KV is eventually consistent: concurrent misses may generate more than once.
Exact-origin checks are browser hotlink protection, not authentication or a
spending limit. Configure rate limits and a model budget before enabling the
optional API for a public audience.

Static output — any host. `netlify.toml` and `public/_headers` are included;
Cloudflare Pages reads both.

The Fusion backend is optional (the game works without it):

```bash
npx wrangler kv namespace create FUSION   # put the id in wrangler.toml
npx wrangler deploy
```

Then set `fusionApi` in `src/site.config.ts`, and update `ALLOWED_ORIGINS` in
`wrangler.toml` and the route in `wrangler.toml` to your domain. It
uses Cloudflare Workers AI by default; delete the `[ai]` block and set
`LLM_BASE_URL`, `LLM_MODEL` and the `LLM_API_KEY` secret to use any
OpenAI-compatible endpoint instead.

## Rebranding

Everything user-facing is in `src/site.config.ts` — name, domain, tagline,
contact, socials, Plausible domain, AdSense id. Analytics and ads render nothing
until those are filled in.

## What neal.fun has that this does not

- Hand-drawn tile art. Every tile here has its own illustration rather than a
  shape from a shared pool, and none of them is an emoji, but they are
  geometric line-and-fill drawings — good ones, checked for legibility, but not
  somebody's hand. Swap the entries in `lib/tile-art.ts` for real drawings when
  you have them; the slot, palette and fade machinery does not care where the
  markup comes from.
- Multiplayer. Internet Roadtrip is a websocket server on separate infra with
  Turnstile and a WASM anti-cheat in front of it.
- Commissioned illustration. Size of Life credits a named palaeoartist.
- Rate limiting beyond the worker's referer gate. Add Cloudflare rate limiting
  before you get popular.
