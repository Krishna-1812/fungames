# funsite

A neal.fun-style site: one lean homepage and thirty self-contained
interactive pages, each rendered with its own WebGL shader or 2D canvas and
shipping only the script that page actually needs.

Built after taking neal.fun apart game by game. The teardown is in
[`docs/neal-fun-research.md`](docs/neal-fun-research.md) — every figure in it is
a measurement from the live site, not a guess.

## Design system: Paper & Ink

The homepage and every game in the shared shell are built on one editorial
system — cool paper, white cards, colour only as whole blocks with ink on
them, Fraunces for statements and Zalando Sans for information, and a motion
layer that is typographic rather than decorative. The rules are in
[`src/styles/paper/README.md`](src/styles/paper/README.md); the pieces are:

| File | What it is |
|---|---|
| `src/styles/paper/tokens.css` | every colour, type, shape and motion token |
| `src/styles/paper/base.css` | reset, type, layout, components — the finished, still page |
| `src/styles/paper/motion.css` | every `html.play` rule, and the reduced-motion off switch |
| `src/lib/motion.ts` | reveals, springy letters, floods, odometer, ticker, decode, confetti, deck, portal |
| `src/layouts/Paper.astro` | the page, the fonts, the `js`/`play` head script, masthead, colophon |
| `src/layouts/GameShell.astro` + `src/lib/game-shell.ts` + `game-shell.css` | the frame every game sits in |
| `scripts/check-paper.mjs` | holds the system to its own rules |

Games move into the shell two at a time. **Done:** Rule Cascade, The Auction
Game, Dark Patterns, Trolley, I'm Not a Robot, From Memory, Steady Hand, Paper Folds, Constellation Draw, Asteroid Launcher, The Deep Sea, Space Elevator, Deep Time, Scale. Everything else still runs on the previous
`GameLayout` until its turn. The daily challenge rotates through the shell
games only; `dailyTarget` in `game-meta.ts` gives each game the same number
the homepage printed.

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
  data/historical-figures.ts
                        eighty-nine real lives, and the arithmetic over them,
                        including the fact that there is no year zero
  layouts/
    Base.astro          <head>, meta, OG tags, favicon, fonts, analytics, ads
    GameLayout.astro    game chrome: home link, title, share button
  components/
    GameTile.astro      homepage tile
    TileArt.astro       places one drawing on a tile, per lib/tile-art.ts
    AdSlot.astro        AdSense unit; renders nothing until configured
  lib/
    tile-art.ts         thirty bespoke tile drawings, one per game slug
    scale-things.ts     what Scale draws, how big it is, and the sky behind it
    scale-art.ts        twenty-six of those drawn, with both their real axes
    deep-sea-art.ts     twenty-two cut-out subjects, no water of their own
    spend-art.ts        the thirty things you can buy, drawn as products
    earth-reviews-art.ts  thirty-two phenomena drawn as product shots, plus
                        the star row every rating on that page is drawn with
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
    icons.ts            eighty-three drawn icons, shared across the games
    fusion-art.ts       the forty-four elements of Fusion, drawn
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
| `/deep-sea/` | 21.1 KB |
| `/every-second/` | 57.4 KB |
| `/overstimulated/` | 19.8 KB |
| `/powder/` | 25.2 KB |
| `/every-second/` | 57.4 KB |
| `/orbit/` | **142.6 KB** |
| `/asteroid/` | **158.4 KB** |

Orbit and Asteroid Launcher are the two outliers by real third-party library
weight: Orbit's WebGL renderer is built on three.js, Asteroid Launcher's two
maps on Leaflet over free Esri/OpenStreetMap tiles rather than the API-keyed,
billing-account-gated alternative. Every Second, Somewhere is heavier than the
rest for a different reason and carries no library at all: its own real
country geometry — 176 countries' worth of Natural Earth boundary paths — is
generated at build time and inlined straight into the HTML, precisely so the
page needs neither a runtime map library nor a live tile server to draw a real
map. Every other page stays under 26 KB total. No images, no audio files, no
fonts beyond Google Fonts — every sound on the site is synthesised, and every
visual is either drawn, one of a handful of small hand-written shaders, real
map tiles fetched only when a visitor is actually looking at one, or — once —
real map geometry baked in at author time.

---

## The homepage

The grid used to be one flat list, newest first, under one static hero
naming a single game in the markup itself. Three real changes, none of them
decoration:

**A hero that rotates through real data, not a hardcoded favourite.**
`hero = games.slice(0, 3)` — the three most recently added, the same
"newest first" ordering the grid already used. Crossfades on a 5.2s timer,
pauses on hover, focus, or an unfocused tab, and never autoplays at all
under `prefers-reduced-motion` — a carousel that keeps moving on its own is
exactly the motion that preference asks for less of, so it only advances on
a deliberate dot click there.

**Games grouped into four sections that describe a real mechanism, not a
vibe** (`CATEGORIES` and `gamesByCategory()` in `data/games.ts`): *Real
science, worked out live* (five games that compute their answer from the
same equations the real thing runs on — Orbit's gravity, Asteroid
Launcher's impact model, Scale, Deep Time, Universe Forecast), *Measures
the actual you* (five games that score real input rather than a
pre-written outcome), *Money, spent unwisely* (exactly two — nobody was
moved in to round the number up), and *Just because*. `check-art.mjs` now
has a `categories` section proving every game's category is real, the four
sections account for all seventeen listed games between them with none
counted twice, and prints the real split so a category that quietly
absorbed everything (or emptied out) is a diff away from being caught.

**A live filter**, typed into a search box styled like the rest of the
site's sticker chrome: matches against each game's title, blurb *and*
description (searching "money" finds Spend It even though only its
description, not its blurb, uses the word), collapses a section to nothing
rather than leaving an empty heading over a blank grid, and the existing
"Surprise me" button now picks only from whatever the current search
actually shows.

Every tile keeps the sticker treatment underneath all of this exactly as
it was — the gloss, the film-grain, the rim light, the pointer-driven tilt
and art parallax — because none of the three changes above touch a tile's
shape or dimensions, which is what lets `check-art.mjs`'s three measured
card shapes stay valid without needing their own rewrite.

---

## The thirty games

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

The impact takes the whole screen, one effect at a time. Drawing all six
damage rings at once told you six circles existed; a radius only means
something framed against the last one. So the result is a stage that flies
the camera through crater, fireball, shockwave, wind, quake and toll in turn
— from street level to a hundred kilometres across — dimming every ring that
is not the one being described, and offsetting each fit so the thing being
described is never behind the card describing it. Building it turned up a
crater and a fireball that had never once rendered: their gradient `<defs>`
were seeded before Leaflet had created the `<svg>` to put them in, and a
missing SVG paint server raises no error anywhere.

The rock you build is a real sphere, not a texture (`lib/asteroid-art.ts`).
Craters sit at genuine points on a unit sphere and are projected with actual
orthographic foreshortening — a crater's radius along the sphere's own radial
direction shrinks by the cosine of its angle from the camera, which is why one
nearing the limb draws as a correctly-oriented sliver rather than a smaller
circle — so the rock visibly tumbles rather than sitting there full-on like a
sticker. The five materials are grounded in real bodies: comet ice is drawn
the pale blue-white of a fresh water-ice surface (Europa, Enceladus); porous
rock is the near-charcoal of Bennu and Ryugu, the two rubble-pile asteroids we
have close-up photographs of; dense rock is an ordinary chondrite's grey-brown;
iron is a Canyon Diablo analogue — the Meteor Crater impactor — with rust
streaks; solid gold is the game's one honest joke entry. Launching plays out as
a real trajectory, too: the entry streak in the impact view is angled from the
same "angle" slider the model itself uses, and the blast rings wait for it to
actually land before they reveal. *`scripts/check-asteroid-art.mjs` proves the
sphere is uniform (not just uniform in latitude — a real, checkable
statistical difference), that the projection is periodic and truly
foreshortens, and — the check the file exists for — that each material reads
as a picture with real surface structure rather than a shaded ball; a plain
lit sphere run through the same harness is kept as the control that fails it.*

Both maps are real, too — Leaflet over free, keyless tiles rather than a
hand-drawn coastline. Esri's public World Imagery service supplies satellite
photography and OpenStreetMap supplies a street map, toggled with a pill
switch styled into the page's own chrome; neither needs an API key or a
billing account, which matters, because Google Maps requires both and there
is no free tier around that. Damage rings are genuine geodesic `L.circle`s
sized in metres from the model's own output, replacing a hand-projected
ellipse and its manual `1/cos(latitude)` stretch factor. Picking the Meteor
Crater or Chicxulub preset flies the target-picker to the real coordinates at
a preset-specific zoom — Meteor Crater's bowl is genuinely visible in the
satellite layer, road and all.

The impact itself is a sequenced event, not four things firing on their own
guessed timers. The entry streak runs on a hand-driven `requestAnimationFrame`
loop rather than an SVG SMIL animation specifically so its own completion can
call `impact()` directly — a screen flash, a camera-punch scale on the map,
two staggered shockwave rings, and a debris burst tinted to the material
actually dropped (iron throws rust-coloured sparks; gold throws its own glow)
plus a heavier dust wave for ground impacts specifically. The blast rings'
reveal is gated on a CSS class `impact()` adds at that same instant, not a
hardcoded `animation-delay` guessing when the streak would land — the two
could drift apart by construction before; now there is exactly one clock.
Every part of this that is genuine motion (the streak, the flash, the camera
punch) checks `prefers-reduced-motion` directly, because it is not the kind
of animation the site's blanket CSS override can reach.

**Powder** — a falling-sand sandbox: a cellular automaton over typed arrays,
rendered straight into an `ImageData` buffer. Thirty-seven materials and
fifty-three named reactions, and everything interesting is emergent. Oil floats
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

**The Deep Sea** — a linear scroll from the sunlit surface to Challenger Deep,
10,935 real metres down, through the five standard oceanographic zones rather
than five invented ones. Every one of the twenty-two markers along the way is a
real, cited depth: Ahmed Gabr's scuba record at 332m, the Titanic at 3,810m,
the Mariana Trench's own deepest fish (a snailfish filmed in 2022, beating the
2017 record by little more than a hundred metres), James Cameron's 2012 solo
dive, and the surveyed 10,935m floor of Challenger Deep itself. Zone density
falls with depth on purpose — the sunlight zone gets a thousand pixels for two
hundred metres because that is where almost everything anyone has ever
personally seen alive actually lives, and the trenches get the most total
height of any zone despite being the emptiest, because they hold the back half
of the real story. A single depth-driven shader carries the water column from
bright surface cyan through a twilight blue-black to hadal black, with god rays
that fade out exactly where the sunlight zone ends and bioluminescent sparks
that only begin once the water is dark enough for them to be the only light
left. Twenty-two hand-drawn scenes, one per marker, follow Deep Time's own
rules: flat palette, no gradients, no ids — checked the same way.
*`scripts/check-deep-sea-art.mjs` is `check-time-art.mjs`'s whole battery
(coverage, palette, structure at 64px, distinctness, mood) plus a data-integrity
pass of its own: markers stay sorted by real depth, zones stay contiguous, and
every marker actually lands inside the zone it claims to.*

**Space Elevator** — the same linear-scroll instrument as The Deep Sea, but
climbing the way an actual elevator would: ground sits at the very bottom of
the document, the Kármán line at the very top, the page opens pre-scrolled
to the ground, and scrolling *up* is what ascends — the reverse of every
other scroll-driven game on this site, matched deliberately to neal.fun's
own space-elevator page rather than the site's usual top-to-bottom
convention. Sea level to the internationally recognised edge of space,
100,000 real metres up, zoned by the real atmospheric layers (troposphere,
stratosphere, mesosphere, thermosphere) rather than an invented scale. Every
one of its twenty-nine markers is a genuine altitude record — Mount Everest,
the highest bird ever confirmed flying, three real cloud genera at their
real altitudes, Concorde's cruising altitude, the SR-71's speed record,
three real stratospheric skydives (Kittinger, Baumgartner, Eustace), Tsar
Bomba's mushroom cloud, and the Kármán line itself — each one a real
shaded illustration rather than a flat cut-out: gradients are allowed now
(`src/lib/space-elevator-art.ts`, id-prefixed the same way
`earth-reviews-art.ts` and `deep-sea-art.ts` already do, via a `slug()`
helper since a marker's title is a full sentence rather than a plain key),
still composited directly over the real interpolated sky colour of its own
altitude rather than a painted approximation of it. A single cable and
elevator car — carrying a rider whose jacket colour you pick near the start
— climb continuously from a hand-drawn mountain horizon at the ground all
the way to the edge of space; a layered mountain panorama rises behind the
Everest/Mont Blanc/Kilimanjaro cluster; rain falls low in the troposphere; a
deterministic starfield fades in through the upper stratosphere; a real
seven-segment odometer (`src/lib/seven-segment.ts`, the same component
Printing Money and Days Since Incident already use) ticks the altitude up
digit by digit; each zone boundary is a comic-style speech bubble rather
than a plain divider; and a small "elevator music" toggle loops a few notes
through the shared `tone()` synth. The one number computed live rather than
looked up is the outside air temperature, from the real US Standard
Atmosphere 1976 formula — the same seven-layer model aviation uses, faithful
enough that it reproduces the model's own textbook reference points (15°C
at sea level, -56.5°C at the tropopause, -2.5°C at the stratopause) on the
nose, and honest enough to say "no single temperature" once you climb past
its real 86km ceiling rather than fake one. The closing section doesn't
reach for a joke ending: it explains, in real materials-science terms, why
nobody has actually built a space elevator to geostationary orbit yet — not
imagination, a genuine unsolved cable-strength problem. *`scripts/check-
space-elevator.mjs` checks the temperature formula against those textbook
values and for continuity across every layer seam, and checks that all
twenty-nine markers are sorted by real altitude and land inside the zone
their altitude claims; `scripts/check-space-elevator-art.mjs` checks that
every gradient id is prefixed and collision-free, every colour (fills,
strokes and gradient stops alike) comes from one shared palette, and no two
of the twenty-nine scenes render as the same picture.*

**Internet Artifacts** — the same linear-scroll instrument again, running
forward this time: the first message ever sent between two computers
(UCLA to Stanford Research Institute, October 29, 1969) at the top, Nyan Cat
(April 5, 2011) at the bottom, twenty-five real internet-history milestones
in between, zoned into five eras — the ARPANET era, before the Web, the Web
goes public, the dot-com years, Web 2.0 and viral video — each with its own
`pxPerYear` density and its own two-tone sky, running the same visual arc
the internet itself did: dim terminal green warming through blue and teal
into the saturated colour of the dot-com and video years. Every date is as
precise as a real source actually allows and no more: a full day where one
is documented (Scott Fahlman's original 11:44am CMU bulletin-board post
proposing `:-)`, recovered from a 2002 backup-tape excavation after twenty
years), a month where that's the limit of what's known (the Trojan Room
coffee pot's move onto the public Web, November 1993), a bare year where not
even the person involved could say more (Ray Tomlinson never recorded which
day in 1971 he sent the first network email) — the `date` string shown on
each card is independent of the `year` float used to position it, so
precision can never accidentally get rounded up for the sake of a tidier
layout. A small "play dial-up modem sound" toggle loops a handshake warble
through the shared `tone()` synth, and a blinking terminal-cursor dot travels
a rail down the left edge in place of Space Elevator's cable car. Twenty-five
scenes were drawn by four parallel agents from one written contract and three
exemplars (a CRT terminal mid-crash, a recovered bulletin-board smiley, Nyan
Cat), each real gradient-shaded rather than a flat cut-out, none reproducing
an actual company trademark — an original search-and-garage motif for
Google's founding, an original bird for the first tweet, no real Twitter or
YouTube wordmark anywhere. *`scripts/check-internet-artifacts.mjs` checks
that every `date` string matches a recognised precision format and that a
handful of headline facts (the Web's public announcement, Google's
incorporation date rather than its earlier domain registration, the first
Wikipedia edit landing the day after launch) are pinned to their real,
sourced values; `scripts/check-internet-artifacts-art.mjs` is
`check-space-elevator-art.mjs`'s whole battery again, and caught the same
class of bug Space Elevator shipped with — raising each scene from a small
fixed-size badge to art that fills its own card made the four densest real
years (1991-1995, six artifacts) too tall for their own zone's pixel
density, silently pushing markers past even the compact fallback into
text-only. Re-tuning each era's `pxPerYear` against its own tightest real
gap, not just its artifact count, fixed it without shrinking anything back
down.*

**Share This Page** — one typed message, thirty ways to send it, in a grid of
tiles rather than a scroll. Seventeen are genuine, checkable encodings run
against whatever the visitor actually types, not a canned example: the real
International Morse alphabet at the real 1:3 dot-to-dash ratio, played as real
beeps through the shared `tone()` synth; real grade-1 English Braille, spot-
checked against the Unicode Braille Patterns block's own codepoints rather than
against the same dot table the encoder itself uses; the real Tap Code
prisoners-of-war have used since the 1960s, C and K sharing one square; the
real ICAO phonetic alphabet ("Alfa", "Juliett", not the common misspellings);
the real DTMF dual-tone pairs behind a phone keypad, ITU-T Q.23, played two
oscillators at once; real note names at their real equal-tempered frequency,
every one of them *derived* from a single 440Hz reference via `440 *
2^(n/12)` rather than typed in twelve times; a binary bitmap laid into a
grid the way the real 1974 Arecibo message was. Ten more are jokes, and their
blurb says so rather than dressing an invented fact up as a real one.
*`scripts/check-share-page.mjs` leans hardest on the checks that need no
external reference at all: ROT13 and the Atbash cipher are proved to be their
own inverse over random strings, not spot-checked against one example, and
binary/hex/base64 are proved to round-trip rather than just to produce
plausible-looking output.* The checker is static and cannot see a page render,
which is exactly how two real bugs shipped past it: the modal, built `hidden`
by default, opened on page load anyway, because `.stp-modal { display: grid }`
outranks the browser's own `[hidden] { display: none }` — the same scoped-
style-adjacent trap this codebase has now hit on four different games, fixed
the same way each time, with an explicit `[hidden]` override. And the
per-letter note badge in the Musical Notes tile was styled under the class
`.stp-note` — the same name three other tiles' plain explanatory paragraphs
already used for unrelated text, since both were named for what they *are*
("a note") rather than for the one thing that actually has to stay unique, so
every one of those captions rendered squeezed into a 30px circle regardless
of which tile opened first. Neither is a fact a data checker can hold
opinions about; both only exist once the thing actually renders.

**How Fast Are You Moving?** — seven real, cited speeds stack live while you
scroll: your tectonic plate drifting, the Earth turning beneath you (computed
from your real latitude via `navigator.geolocation`, with a graceful 40°N
default), its orbit around the Sun, the Sun's own drift toward Vega, its orbit
around the galaxy, the Milky Way falling toward Andromeda, and the Local
Group's real, measured motion against the cosmic microwave background — out
past which the observable universe itself recedes faster than light, a real,
unresolved consequence of the Hubble tension rather than a joke ending.
`src/lib/speed-model.ts` sources every constant (solar apex velocity, the
Andromeda approach speed from a 2012 Hubble Space Telescope proper-motion
study, the 627 km/s CMB dipole) and states plainly that the seven speeds are
summed as plain magnitudes, not true 3D vectors — a disclosed simplification,
not a hidden one. *`scripts/check-speed-model.mjs` checks Earth's rotation
speed against its real equatorial radius and sidereal day at the poles and
equator, confirms every cited constant falls inside its real published range,
and confirms both the Planck and SH0ES Hubble constants put the observable
universe's edge several times past the speed of light.*

**Where Does The Day Go?** — a live instrument, not a runner over stages: three
sliders (work, home, sleep) draw a tidy day-bar, and every slider after that —
morning routine, lunch, dinner, the commute — is carved out of "work" or
"home" rather than added on top, so the bar never grows past the total you
started with; it just gets honest about what was always inside it. The one
number on the page that is not a slider is `REFOCUS_MINUTES`: Gloria Mark
(UC Irvine) tracked real information workers through real interruptions and
found an average of 23 minutes 15 seconds to fully return to a task
afterwards — "The Cost of Interrupted Work: More Speed and Stress," CHI 2008.
A phone-check-frequency slider applies that real cost to however many
interruptions statistically land inside your work block, and "work you think
you're doing" against "work you're actually doing" is the payoff. Each later
section's slider activates to a sensible default the first time it scrolls
into view — pacing, never a gate. *`scripts/check-day-model.mjs` proves the
day-bar's arithmetic rather than trusting it: 500 random inputs confirm the
segments always sum to exactly `workHours + homeHours + sleepHours`, however
they get carved up, and a further sweep confirms more interruptions never
*increase* actual work hours. It caught a real bug before shipping — the
first version of `computeDay` let the day grow past 24 hours whenever a
carved-out slice (say, an implausibly long morning routine) didn't fit inside
the block it was supposed to come from, in 184 of 500 random trials.*

**Printing Money** — nine real rates of earning, from the US federal minimum
wage to the US federal government's own hourly rate of spending, each reduced
to the one thing that makes them comparable: how many one-dollar bills that
buys, laid end to end. Every rate is *derived* — an annual figure divided by a
real hours-per-year, 2,080 for a person's work-year or 8,760 for a continuous
institution — rather than typed in twice. Five tiers are small enough to draw
as an actual tiled strip of a real, drawn bill (6.14 x 2.61 inches, the Bureau
of Engraving and Printing's own spec); the other four would need a scrollbar
from 1,200 metres to 120,000 kilometres long, so they get a named real-world
comparison instead — "82.2% of the Earth's circumference," "31.3% of the
distance to the Moon." The hero is a second-by-second counter of what the
government has spent since the page opened — the same "the hero is a clock,
not a footnote" call Days Since Incident makes. *`scripts/check-printing-money.mjs`
holds the arithmetic to account, not the salaries, which it cannot grade. It
caught a real formatting bug: rounding $999,999,999 within the "million" unit
gave "$1,000.00 million" instead of promoting to "$1.00 billion," because the
formatter never checked whether its own rounding had just pushed the value
into the next unit up.*

**Who Was Alive** — type a year and see who was walking around in it.
Eighty-nine people whose birth and death years are settled fact, and nobody
whose dates a scholar would put a *c.* in front of — which is why the first
millennium is nearly empty here, and why the page states the seven-century
hole between Augustus dying in AD 14 and Charlemagne being born in 742
rather than filling it with guesses. The hero is a brass rolling-digit year
counter bolted to a walnut plate: four drums behind one pane of glass, an
era plate that flips to BC, a knurled thumbwheel you drag, and the same
rivets and recessed screen as Progress and Days Since Incident, re-skinned
off the electronics and onto an object a records office would actually own.
Underneath it, all eighty-nine lifespans are drawn as bars on one shared
linear axis from 551 BC to now, so a long life is drawn long, the overlaps
are visible (Shakespeare and Galileo born the same year; Newton and Louis
XIV sharing seventy-three) and the empty stretches are really empty. The
roster below is a ledger rather than a grid of cards — eleven drawn
category marks in the left margin, name, span, age that year, place and one
cited sentence each, grouped by what somebody was known for.
*`scripts/check-who-was-alive.mjs` cannot grade whether Kepler really died
in 1630, so it grades everything built on top of the years instead, against
five fixed years worked out by hand. It caught two real bugs. `ageIn` was a
subtraction, which is correct for every span in the record except the one
that crosses the era boundary: **there is no year zero**, so Augustus came
out 77 years old against a real 76 calendar years from 63 BC to AD 14, and
the chart drew his bar a year too long for the same reason. And the "go to
a year" parser stripped full stops as separators along with commas, which
silently turned a typed `12.5` into the year 125 — a box that answers a
question nobody asked.*

**Earth Reviews** — a consumer-reviews site for thirty-two real natural
phenomena, physical laws and facts of existence: gravity, the Moon, entropy,
mosquitoes, quicksand, Mondays, photosynthesis, solar eclipses, déjà vu. 133
reviews across them, all written for this page, by reviewers who are all invented — a
storefront grid with a live search over the whole catalogue and three
orderings, a department and a breadcrumb per product, and a product page
carrying a star-distribution bar chart, a review list with a working sort, a
"Verified Experiencer" badge and a helpful button that says out loud it only
changes the number in front of you. It reuses Dark Patterns' browser chrome
down to the address bar and the loading sweep, on a domain under `.example`,
which RFC 2606 reserves so a fictional one can never collide with somebody's
real site. Each product's shot is a drawn cut-out on a dark panel lit by that
drawing's own dominant fill by area (`lib/earth-reviews-art.ts`, the same
`dominantMood` contract as Deep Sea and the Auction), inlined once as an SVG
`<symbol>` that the grid and the product page both point `<use>` at.
*The writing is the one deliberately comic thing on this site; the numbers are
not. An average is the real mean of that product's own ratings, rounded to one
decimal place with halves going up, and `scripts/check-earth-reviews.mjs`
proves every one of them three ways — against sums typed out by hand with the
rating list beside them, against integer arithmetic over the reviews, and
against a mean rebuilt from the five bar counts alone, which never see an
individual review. It found the number that justifies stating the rounding
rule at all: 18 of the 32 averages land on exactly x.x5.* Two
bugs came out of running it rather than reading it, back when there were
twenty-two products: every product shot
rendered as a pale wash, because a radial gradient whose stops are all `rgba`
has nothing behind it but the white card and so composited twenty-two dark
moods against white; and all twenty-two drawings shipped a second time inside
the JavaScript bundle, because a `MOOD` map computed at module scope is a call
Rollup cannot prove side-effect-free, so it kept the call and the call kept
the drawings — 38 KB of script became 8 KB with the same computation behind a
function.

**Dark Patterns** — eleven manipulative UI patterns, rebuilt as working fake
websites rather than described in a bullet list: a basket that sneaks two
pre-checked extras onto whatever you actually bought, a countdown that
silently resets itself instead of ever reaching zero, a subscription
cancellation flow with three stalling screens and a phone-only final step, a
download page where three of four buttons are adverts. Every one is a
documented pattern, not an invented vibe — Harry Brignull's original 2010
taxonomy (he coined the term), the Princeton/CHI 2019 study that scraped
eleven thousand shopping sites for them, or the FTC's 2022 report — cited by
name against each one, in `src/lib/dark-patterns.ts`. The visual grammar is
the same in all eleven on purpose: the trick is always the site's loudest button;
the honest way through is always the small, quiet one. *`scripts/check-dark-
patterns.mjs` proves every pattern cites one of the three real taxonomies,
that no two share a written sentence, and — the cross-file check that
actually matters — that every pattern in the data file has a real, working
mount function in the page and nothing in the page mounts an id the data file
never introduced.*

**Every Second, Somewhere** — a live simulation, not a live feed, on a real
map. Every one of the 176 countries and territories drawn is Natural Earth's
own admin-0 political geometry (`scripts/build-population-geo.mjs`, the same
family of public-domain data `build-world-data.mjs` already draws Asteroid
Launcher's coastline from), projected equirectangular — not a hand-placed
approximation. The first version of this page drew its own continent blobs,
twenty-odd guessed points per landmass; it looked exactly like what it was; it
is gone.

Forty of those real countries are seeded with their own real population and
real published crude birth and death rate (CIA World Factbook and UN/World
Bank, 2023–24), and run as a genuine Poisson process. A birth or a death lights
up that country's own real outline — gold for a birth, violet for a death —
roughly as often as it statistically really would: India and Nigeria almost
constantly, Poland and Saudi Arabia rarely, because the model is the real
rate, not a fixed animation loop. A live-updating world population counter
extrapolates forward from a mid-2026 baseline using the same net rate, clearly
labelled as an estimate rather than a census. Click any lit country for its own
numbers: population, both real rates, and how often a birth or death there
actually happens on average. Everywhere not in the forty is folded into the
running totals at the global average rate and never given a fake coordinate.
*`scripts/check-population-live.mjs` checks the data (every rate in a
plausible real-world band, the global totals close to the commonly-published
~4.3 births and ~2 deaths per second), that all forty countries actually
resolve to a real shape in the atlas, that every one of their real capital
coordinates projects inside that same country's own real outline — not a
guessed bounding shape — and the maths: two hundred thousand simulated draws
confirm the shared `nextInterval` function both the page and the checker call
produces not just the right mean interval but the exponential distribution's
actual signature, P(interval > mean) ≈ 1/e — proof it is really a Poisson
process and not a distribution with a coincidentally correct average.*

**Scale** — a continuous logarithmic zoom from a proton to the observable
universe. Scroll position sets how wide the screen is in metres; objects are
drawn at their true size relative to that. *No blank stretch across 40 sampled
positions.*

**Rule Cascade** — thirty-one escalating username rules, none of which ever switch
off. Three of them do something rather than just checking: a moth eats one
character every six seconds until you put a spider in, a sacrifice takes
whichever letter you have leaned on hardest and never gives it back, and one
rule asks how many rules are on screen — so satisfying it unlocks another and
immediately makes it wrong again. *`scripts/check-cascade.mjs` builds a real
solution for all 24 hours, all 26 possible sacrifices, and every rung of that
counting ladder. It caught a no-repeats rule that made the game unwinnable for
three hours of every day, and a parity trap where the length could never be
prime.*

**Spend It** — one hundred billion dollars, thirty real-priced things, each
with its own drawing (`lib/spend-art.ts`). The reference here uses photographs
of branded goods, which this site will not do, so the answer had to be our own
artwork at the size the card actually wants: a 120-unit stage, three tones on
any solid form, a real ground shadow, and detail that rewards being looked at
— a foam heart on the latte, the tear line on the cinema ticket, grid fins on
the rocket, the halo over the Formula 1 cockpit. The thirty small glyphs that
used to sit on the cards moved to the receipt, which is the dense list they
were drawn for. *`scripts/check-spend-art.mjs` measures the thing that
actually separates a product shot from an icon: the share of a drawing’s own
ink sitting on an internal edge, with a flat filled rectangle as the control
that has to fail. It also caught Smartphone and Skyscraper as the closest pair
in the set — both a lit grid on a dark slab — which is why the tower now has
a street to stand in. Balance still cannot go negative by clicking,
shift-clicking, or typing a huge quantity.*

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

Every element is drawn (`lib/fusion-art.ts`). It used to render an emoji per
piece, grandfathered on the argument that an open-ended tree leaves nothing to
draw in advance — but the tree is a closed set of forty-four elements, all
reachable from the four starters and all known at build time. These follow the
icon conventions rather than the product-art ones, because each renders at
about 20px inline in a light pill and again in a dark tray chip: one drawing,
two backgrounds, which is exactly what the mid-tone palette exists for.
*`scripts/check-fusion-art.mjs` measures ink and contrast on both surfaces,
and treats Dust, Smoke, Ash and Sand as the real test — four ways to draw
“some loose material” that must not collapse into one grey cloud.* The emoji
are gone rather than hidden: out of the tuples, the seed, the saved-state
validation, the wire format and the worker’s own prompt, which had been asking
a model for a character nothing renders.

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
twenty-six characters. Each layer is a cut-out scene now rather than a
settings-row glyph — `src/lib/ambient-art.ts`, the same contract as Deep Sea's
and Space Elevator's own art modules, one palette and a `dominantMood` glow per
drawing, checked by `scripts/check-ambient-art.mjs`. *Analyser tap measured peak 0.34, RMS 0.08 — real
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
own number against each. The lot on the rostrum and the five rivals in the room
are both cut-outs now: the lot bleeds to the card's own edges under a spotlight
of its own dominant colour instead of sitting boxed in one generic gold glow,
and each rival's bust is drawn full size rather than clipped into a 54px avatar
badge — both computed from the drawings themselves in `src/lib/auction-art.ts`
and `src/lib/auction-bidders.ts`, the same `dominantMood` contract as the rest
of the site's art. *The winner's curse is not scripted: every bidder values
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

**Days Since Incident** — the "days since last accident" sign from a
warehouse wall, except the incidents are real and every counter is live.
Sixteen rows across four real feeds: five earthquake magnitude tiers from
USGS's own catalogue search, five GOES flare classes and five NOAA G-scale
storm levels from NASA's DONKI space-weather log, and interplanetary shocks
alongside them. Nothing is precomputed — every number is read from the
visitor's own browser, from the same public instruments scientists use, the
moment the page loads. The hero is the real centrepiece: a full-bleed,
second-by-second "safe for" clock ticking up from the single most recent
incident of any kind. *`scripts/check-incident-model.mjs` checks the pure
arithmetic and parsing against real API shapes captured while building it —
GOES flux boundaries, a storm's peak Kp rather than its first reading, and
that "most recent qualifying" correctly prefers a smaller, newer event over
a bigger, older one.* Two real engineering problems fell out of building it
live rather than assuming: a ten-year DONKI query is 1.5MB and took 27 real
seconds, so a fast 400-day pull renders the page immediately and only a
still-unresolved rare tier (an X10 flare, a G5 storm) pays for one further,
slower pull; and `minmagnitude=2.5&starttime=1950-01-01` — a perfectly good
query for a rare tier — made USGS itself take 20 seconds and return a 503,
because the most common earthquake tier over a 76-year window is an enormous
scan regardless of `limit=1`. Each magnitude tier now searches a window sized
to its own real-world frequency first, and only widens if that comes back
genuinely empty. Hurricanes and tsunamis were tried and dropped: the
cleanest free cyclone feed labels the identical wind speed two different
things depending which agency reported it, and a category built on data that
disagrees with itself would be worse than no row at all.

Requested a hyper-realistic visual pass in the very next turn, the same
words as every prior redo — and neal.fun's own page turned out to render
every count as a real eight-digit car-odometer window, ghosted unlit
segments and all, inside a bolted black plate. `lib/seven-segment.ts` draws
a genuine seven-segment digit rather than a monospace font standing in for
one — the same seven segments a real display lights, unlit ones left in the
DOM at low opacity so a blank position reads as a dim ghost "8".
*`scripts/check-seven-segment.mjs` re-derives the pattern by hand from the
classic digit shapes and separately checks the plain segment count per
digit — an 8 lights all seven, a 1 lights exactly two — so a wrong bit has
to survive two independent proofs.* Every card is a mounted plate now:
corner rivets, a recessed screen with a glass reflection and a faint
scanline texture, and a live/scanning indicator while a rare tier is still
being searched rather than a number that just sits there. Four info buttons
open a real, cited table each — USGS's magnitude-effects table, NOAA's GOES
flare classes with their R-scale radio-blackout severity, and NOAA's
G-scale (the G5 row names the real May 2024 storm that put aurora over
Florida) — colour-graded green to red by mixing two colours in oklab against
each row's own severity tier. Two real bugs, one cause: `digitCellHTML()`
and the info table both build markup Astro never sees at compile time
(`set:html`, a runtime `.innerHTML` write), so every rule meant to reach
either one silently matched nothing until written `:global` — the same trap
`lib/trolley-scene.ts` hit earlier for the same reason, and a build that
passed clean both times before someone actually opened the page and looked.

**Constellation Draw** — almost 9,000 real stars, at their real position and
real brightness, down to magnitude 6.5, the commonly-cited naked-eye limit —
generated once by `scripts/build-star-data.mjs` from HYG v4.4 (CC BY-SA 4.0)
and the real western constellation line figures every planetarium app draws
(d3-celestial, itself derived from Stellarium's sky culture, BSD-3-Clause).
Pan and zoom a real gnomonic tangent-plane projection, recomputed around the
current look direction on every drag — not a flat RA/Dec map, which warps
constellations badly near the poles — and click real star to real star to
draw a shape of your own, named and saved to a link keyed on the stars'
own permanent catalogue ids. Toggle all 88 real IAU constellations on or
off, or hit "Surprise me" for a real one at random with its real English
translation, genitive form and brightest catalogued star. Each star's dot
is coloured from its own real B-V colour index — Ballesteros' 2012
temperature formula, then a real blackbody-to-RGB approximation — so
Betelgeuse actually reads redder than Rigel rather than every star being a
plain white pixel. *`scripts/check-sky-projection.mjs` checks the
projection against the geometry it has to satisfy regardless of formula
(the view centre always projects to the origin, real angular separation
matches projected Cartesian distance, nothing over 90° from the look
direction is visible); `check-star-catalog.mjs` and `check-star-color.mjs`
check the data and the colour pipeline against real, independently-known
facts — Sirius's real position, Vega's historically-defined B-V of
0.00, Betelgeuse rendering redder than Rigel.*

Two facts about the source data only surfaced by actually reading it.
Serpens is the one real exception among the 88 IAU constellations — a
single constellation drawn as two disconnected pieces (Caput and Cauda)
either side of Ophiuchus — and the raw line-figure data correctly gives
both pieces the same id; naively counting rows would have made this "89
constellations," so the build script merges them back into the one real
entry the fact actually is. And Orion's own English name is "Orion," not
"The Hunter" as it's often informally described — a mythological figure's
name doesn't get "translated," which is exactly why Apus ("Bird of
Paradise") does. Both surfaced as checker failures against an assumption
that turned out to be the wrong one, not the data.

Requested the same hyper-realistic pass one turn after shipping, and
neal.fun's own page again turned up specific, structural things the first
build didn't have: its brightest stars bloom a soft coloured halo and the
handful of very brightest throw a real four-point diffraction spike, real
constellation names float directly over their own line figures rather than
waiting for a click, and the toolbar is icon-only, a tooltip per icon,
with the colour picker opening as a floating popover instead of sitting
inline. All four are real now — `drawStar()`'s radial-gradient halo skips
anything dimmer than magnitude 4.2 (sub-pixel anyway, and skipping it keeps
~8,900 stars a frame cheap), `drawConstellationLabels()` finds each visible
constellation's topmost on-screen point every frame and labels it there,
three new drawn icons (undo, trash, a link glyph) replace the old text
buttons, and the coordinate readout now matches the real page's own
precision — seconds of RA, arcminutes of Dec. One bug came out of measuring
rather than reading: the hint text below the toolbar wrapped to two lines
on an ordinary-width screen despite its own `max-width` leaving room, because
an absolutely-positioned box anchored by `left: 50%` with no `right` sizes
itself against the space from that edge to the container's far edge — half
the viewport — regardless of the centring transform layered on top;
`getComputedStyle` plus `offsetWidth`/`scrollWidth` on the live element is
what showed it, and `width: max-content` alongside the existing `max-width`
fixed it. A second, unrelated cascade lesson: giving the colour popover its
own `display: flex` also beat the browser's default `[hidden] { display:
none }` on the same element, since author rules always outrank the
user-agent stylesheet regardless of the `hidden` attribute being present —
fixed with an explicit `.swatches[hidden] { display: none }`, not by
removing the rule that made the popover work in the first place.

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

The games that carry enough real modelling have the maths checked separately,
against answers from the literature, worked out by hand, or measured over a
simulation:

```bash
node scripts/check-impact.mjs      # Asteroid Launcher, vs four real impacts
node scripts/check-asteroid-art.mjs # the rock: uniform on a sphere, a picture not a ball
node scripts/check-constellation-trace.mjs # the memory round: real figures, a fair score, every star clickable
node scripts/check-telemetry.mjs   # I'm Not a Robot, vs known geometry
node scripts/check-robot-scene.mjs # the CAPTCHA street, and its answer key, in pixels
node scripts/check-auction.mjs     # The Auction Game, over 28,000 lots
node scripts/check-cascade.mjs     # Rule Cascade, is it still finishable
node scripts/check-trolley.mjs     # Trolley, are the four positions distinct
node scripts/check-powder.mjs      # Powder, every reaction and every scenario
node scripts/check-memory.mjs      # From Memory, do the references fit the box
node scripts/check-orbit.mjs       # Orbit, the integrator and all eight challenges
node scripts/check-mix.mjs         # Ambient Mix, do shared links survive
node scripts/check-who-was-alive.mjs # Who Was Alive, and the missing year zero
node scripts/check-steady.mjs      # Steady Hand, is the scoring fair
node scripts/check-earth-reviews.mjs # Earth Reviews, do the stars actually add up
node scripts/check-internet-artifacts.mjs # the timeline, dates honest about their own precision
node scripts/check-internet-artifacts-art.mjs # its twenty-five scenes, over their own era-sky
node scripts/check-share-page.mjs  # every encoding, self-inverse, round-tripped, or vs the real standard
node scripts/check-paper.mjs       # the design system held to its own rules: contrast, colour, motion
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
`lib/progress-geom.ts`, `data/historical-figures.ts`, `data/earth-reviews.ts`
and `lib/scale-art.ts` is deliberately pure
functions over plain data so it can be run this way.

`check-art.mjs` is the odd one out and worth explaining, because illustration
is the one thing here with no formula to check against. It rasterises every
tile with resvg exactly as the page composites it — same gradient, same
vignette, same slot geometry, same left-hand fade — and then measures the
result: is the drawing visible at all, does white text still clear WCAG on the
background *under its own letters*, and are the twenty drawings actually
different from each other. It renders the title and blurb too, so contrast is
judged where the type lands rather than over a rectangle that is mostly empty.
Run it with `--sheet out.png` to get a contact sheet of all twenty tiles
from the same compositor.

`check-icons.mjs` does the same job for the eighty-three drawn icons inside
the games. They get 15 to 34 pixels, on pages that are pale — white, cream or
aged paper — in five cases and nearly black in four, so it renders each one at
the size and on the background it actually appears on. `--sheet out.png` writes the whole set on both a cream
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
different from the tile and Scale checkers. Its drawings have **no ids, no defs
and no gradients at all** — the other modules prefix ids to keep forty-four,
twenty-six and twenty drawings from colliding in one document, and having
none is a guarantee rather than a convention — and every colour must come from
one twenty-one-entry palette, which the file enforces rather than asks for.

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

`check-deep-sea-art.mjs` covers the Deep Sea's twenty-two, and follows
`check-time-art.mjs`'s own rules rather than the tile checker's — no ids, no
defs, no gradients, one thirty-one-colour palette, the same `MOOD` treatment,
with no hand-written exception this time. It carries one battery
`check-time-art.mjs` has no reason to: a data-integrity pass over
`data/deep-sea.ts` itself, since every marker's depth is a real, citable fact
rather than a chosen waypoint — it checks the markers stay sorted by real
depth, that the five zones are contiguous with no gap or overlap between them,
and that every marker actually falls inside the zone it claims to be in.

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
those sources change. `scripts/build-population-geo.mjs` does the same job for
Every Second, Somewhere: it fetches Natural Earth's real admin-0 country
boundaries once, projects all 176 of them, and writes `src/data/population-geo.ts` —
so the page ships a real map with no runtime dependency on a tile server, the
same reasoning that keeps the coastline generated rather than fetched live.

`check-population-live.mjs` is not one of these at all — Every Second, Somewhere
has no art to rasterise, only a real map and a simulation, and the thing worth
getting wrong is the geometry and the maths rather than a drawing. It checks
the data first (every one of the forty countries' birth and death rates sits
in a plausible real-world band, the forty sum to under the whole world's
population, the derived global rate lands close to the commonly-published
~4.3 births and ~2 deaths a second), then that the map is genuinely real: all
forty countries resolve to an actual shape in the Natural Earth atlas, and
every one of their real capital-city coordinates projects inside that same
country's own real outline rather than merely near a guessed one. Then the
simulation itself. `nextInterval`, the one function both the page and the
checker call, turns a rate and a random draw into real seconds until the next
event — and a wrong implementation could easily still average out correctly
while being the wrong shape entirely, the way a distribution clustered tightly
around the mean would. So the checker draws two hundred thousand samples with
the site's shared deterministic generator and checks two things a coincidence
could not fake at once: the mean interval is within 1% of the real 1/rate, and
P(interval > mean) is within a hair of 1/e ≈ 0.368 — the exponential
distribution's own signature, and proof this is really memoryless rather than
merely correct on average.

`check-result-card.mjs` — the share card every game's result screen can
generate — found a bug in itself rather than in any game. It renders each
card's text with `resvg` to measure whether the layout's own width estimate
actually holds, and the first version left the font unspecified beyond
`"Arial, Helvetica, sans-serif"`, the same string the real card's SVG uses.
That resolves to whatever font resvg finds installed on the machine running
the check — real Arial on a Windows dev box, something else (wider, in
practice) on a bare Linux CI runner with neither Arial nor Helvetica
installed — so the exact same code passed locally and failed in CI, on every
commit, for a reason with nothing to do with any actual layout bug. The fix
is `scripts/fonts/`: Arimo, Google's own metric-compatible substitute for
Arial, fetched once and committed, loaded explicitly with system font
discovery turned off — so the checker's answer is the same on every machine
that runs it, which is the one property a checker cannot work without.

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

**Currently deployed to GitHub Pages** via `.github/workflows/deploy.yml`,
which builds and publishes straight from Actions on every push to `main` —
no `gh-pages` branch to keep in sync. That is also the one host here that
needed real code to work at all: a repo called `fungames` is not the special
`<user>.github.io` repo GitHub serves at a domain root, so it publishes to
`https://<user>.github.io/fungames/`, a subpath. `astro.config.mjs`'s `base`
carries that; `src/lib/base.ts`'s `withBase()` is what every hand-written
root-relative link in the codebase (a tile's own href, the chrome bar's home
link, a cross-game "related" link, an OG image path, the sitemap) is prefixed
with, because none of that is rewritten automatically — only Astro's own
generated asset tags and `Astro.url` are. Moving to a custom domain, or to a
literal `<user>.github.io` repo, means setting `base` back to `'/'`; nothing
else needs to change, since every one of those links already goes through the
one function.

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

The homepage's "Buy me a coffee" button reads `SITE.buyMeACoffee` the same
way — a Buy Me a Coffee handle, not a full URL, `''` to hide the button
entirely. Buy Me a Coffee is the merchant of record: the button only ever
links out to its hosted checkout, so nothing on this site touches a card
number or needs its own payment backend. The placeholder handle in the
committed config (`'yourhandle'`) needs swapping for a real account before
the button goes anywhere useful — same as `name`/`domain`/`email` above.

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

Every subject is a cut-out. Each scene used to paint its own sea inside a
120x80 box — a flat rect of depth colour, marine snow, a current, sometimes
a light shaft — and draw the animal on top of that; the page renders all of
it for real in the WebGL column, so each scene was imitating, in flat fills
at thumbnail size, the thing running full-screen behind it. The backgrounds
are gone and the animals now hang in the actual water, glowing by
`drop-shadow` (which follows the shape) rather than `box-shadow` (which
would draw a bright rectangle around a transparent SVG).

*`check-deep-sea-art.mjs` inverted with the contract: instead of demanding
each scene be opaque edge to edge, it composites every subject over the true
interpolated colour of its own depth and requires 3:1 against it — which
below a thousand metres is near-black water, and is the honest reason the
deep ones carry their own light. Its structure test is the part worth
reading: it measured an absolute luminance step, which is a fair bar for a
reef and an impossible one for a trench, because abyss, ink and void all sit
inside about 0.01 of relative luminance. It was measuring how deep an animal
lives rather than whether it was drawn. It asks for a contrast ratio now.*
