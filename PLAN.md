# Making this site actually good

A plan written after studying neal.fun properly, game by game, and comparing it
honestly against what we have.

---

## The diagnosis

The instinct was that this is a graphics problem. It isn't. Three findings from
the comparison, in order of how much they matter:

### 1. neal.fun's most viral game is visually plainer than ours

The Password Game — one of the most-shared web games ever made — is a cream
background, a serif heading, and a plain white input box. No gradient, no shader,
no glass, no shadow. Our Rule Cascade, which is the same genre, has a WebGL paper
shader, layered card shadows, and a drawn-on checkmark animation.

Neal's has **35 rules**. Ours has **12**.

His rules include: a chess puzzle you must solve in your password, a Wordle answer
you must include, a fire that starts burning your letters and will delete your
password if you don't keep feeding it, a chicken that eats characters, and being
forced to sacrifice two letters permanently. Ours include: "must contain a number"
and "must contain a prime."

**The gap is writing, not rendering.** We built a beautiful shell around thin
content. That is the whole problem in one sentence.

### 2. Where art *does* matter, ours is emoji

Every neal.fun tile is a bespoke illustration — hand-drawn trolleys and stick
figures, a photographed rock at golden hour, a green cartoon hillside, a real
highway sign, constellation line-art. Each one looks like a different product made
by someone who cared about that specific thing.

Every one of our tiles is the same component: a gradient, an emoji, and a small
generated doodle. Fifteen tiles, one template. **Emoji-as-artwork is the single
loudest "made in an afternoon" signal on the site**, and we use it on every tile,
every Spend It item, every Ambient Mix layer, and every Paper Folds milestone.

### 3. Half our games are sandboxes with nothing to do

Orbit, Powder, Fusion and Ambient Mix are all "here is a toy, goodbye." No goals,
no discovery, no progression, nothing to reach for and nothing to screenshot. A
sandbox with no objective gets about thirty seconds.

---

## Game-by-game verdict

Ruthless, because that's what was asked for.

| Game | Verdict | Ceiling |
|---|---|---|
| **Rule Cascade** | Best bones on the site, badly under-written. 12 rules vs 35. Every added rule is a joke and pure JS — cheapest high-value work available. | **Very high** |
| **Powder** | Real cellular automaton, genuinely good tech. 12 elements vs Sandboxels' 500+. No discovery log, no reason to experiment. | **High** |
| **Orbit** | Best engineering on the site (real n-body, HDR, bloom). Zero game. Nothing to achieve, so nobody stays. | **High** |
| **Overstimulated** | Good joke, real escalation, but ends too early and the upgrades aren't absurd enough. Neal's version has a hamster wheel and a live video. | **High** |
| **From Memory** | Genuinely strong concept and the best "oh no" moment on the site. Only 8 prompts. | **High** |
| **Trolley** | 12 dilemmas vs Neal's 28, and his are hand-drawn per scenario. Ours is an abstract track diagram. | **Medium-high** |
| **Fusion** | ~~Effectively dead without the Cloudflare worker.~~ Thirty-six local recipes, reachable from four seeds, checked in both orders. | **Medium — playable offline** |
| **Spend It** | Competent clone. Emoji instead of product images is the main tell. Receipt endgame is good. | **Medium** |
| **Steady Hand** | ~~A 20-second toy with one challenge.~~ Four shapes and a combined rating. | **Medium — done** |
| **Scale** | ~~Draws *circles* for a proton, a whale and a galaxy.~~ Twenty-six drawn objects, sized on both axes, and the shader keeps the seventeen things that really are spheres and rings. | **Medium — done** |
| **Deep Time** | ~~A Wikipedia list on a gradient.~~ Forty-four events, forty-four scenes, and a layout that no longer spends the picture's budget on the picture. | **Medium — done** |
| **Ambient Mix** | Quietly the most *finished* thing here. Twelve real synthesised layers. Just needs presets and a shareable mix. | **Medium** |
| **Paper Folds** | A fact, not a game. You press one button 42 times. | **Low** |
| **Progress** | A widget. Look once, feel briefly bad, leave. That's the whole design and it's fine. | **Low (fine as-is)** |
| **Life in Weeks** | Same. Look once, feel dread, leave. Legitimately complete. | **Low (fine as-is)** |

---

## The plan, in phases

Ordered by value per hour, not by what's most fun to build.

### Phase 1 — Content depth (the actual problem) — **done**

All five, each with a checker behind it. Fusion was the last one and it stayed
open longest because the honest version of it needed a Cloudflare Worker that
is not deployed; what closed it was accepting that and building the local tree
as a real game rather than as a stub to fall back to.

What the checkers caught is the argument for writing them: Rule Cascade was
unwinnable for three hours of every day, Powder had a material you could draw
with that did nothing at all, and four of From Memory's eight new references did
not read as the thing they were meant to be until they were rendered and looked
at. None of that is visible in source.

The one that changed shape in the doing: Trolley's "ethical-position scoring"
already existed in name, but it was counting lever-pulls. Making it real meant
authoring what each of four positions says about each of twenty-six cases, which
is the actual content, and the checker now proves the four are far enough apart
to be worth naming.


No new rendering. Just far more, far better *stuff*.

- ~~**Rule Cascade → 30+ rules**~~ **done.** Thirty. The three interactive ones
  are a rule about how many rules are on screen (so satisfying it moves it), a
  moth that eats a character every six seconds until you put a spider in, and a
  sacrifice that takes whichever letter you leaned on hardest.
- ~~**Trolley → 26 dilemmas**~~ **done.** The position scoring was the part that
  needed the work: it was counting lever-pulls. Every case now records what each
  of four positions says about it.
- ~~**Powder → 30+ elements** with a **discovery log**~~ **done.** 31 materials,
  47 reactions, and the log was only possible once the reactions stopped being
  an if-chain and became a table.
- ~~**From Memory → 16 prompts.**~~ **done.** A pool of sixteen, ten a sitting,
  bicycle always first, so a second go is a different set.
- ~~**Fusion → a much larger local recipe tree**~~ **done**, in `dd4ef82`.
  Thirty-six local recipes on ingredient tuples behind a canonical pair
  function, so the game is playable without the worker;
  `scripts/check-fusion.mjs` tries every recipe in both orders and proves the
  whole tree is reachable from the four seeds. That closes Phase 1.

### Phase 2 — Goals for the sandboxes — **done**

- ~~**Orbit: challenge mode.**~~ **done.** Eight challenges, a persistent best
  lap count, and `scripts/check-orbit.mjs` behind them.

  Two of the four ideas sketched here did not survive contact with the
  simulation, and finding that out was most of the work:

  - *"Slingshot a moon out of the system"* survived and is the best one. A
    two-body encounter cannot change a body's energy, so the only way out is
    to take some from a third body that is moving. The checker proves the
    challenge means that by running the identical orbit with the heavy
    companion deleted and requiring it to fail.
  - *"Survive 60 seconds with 50 bodies"* and its smaller cousin *"twelve
    bodies, twenty seconds, no collisions"* were **cut**. Bodies here are
    heavy relative to the star — a moon is 1/433 of it, against Jupiter's
    1/1047 — so neighbouring orbits sit one or two mutual Hill radii apart
    where about ten are wanted. Whether a crowd survives is sharply
    non-monotonic in the body count: twelve held, eleven did not, fourteen
    did not. That is real chaos, but a challenge you pass by luck is not a
    challenge. Replaced with *ten laps on one body*.
  - A *moon orbiting a planet* was cut before it was written: the stable
    satellite zone around any planet this game offers lies entirely inside
    the softening length, where the force has been flattened away.

  Two real bugs fell out of the physics work. The presets launched planets at
  the Kepler speed sqrt(GM/r), which is 10% too fast at the innermost radius
  in a softened field. And the solar preset's evenly spaced radii are not
  evenly spaced in the units that matter — measured in mutual Hill radii the
  gaps shrank from 4.3 to 1.7 going outwards, and it lost a planet within
  seconds, every time. Spacing geometrically holds the separation constant and
  it now runs clean indefinitely.
- ~~**Powder: scenario challenges**~~ **done.** Eight, each with a set grid, a
  cut-down palette and a budget of paint.

  The worry above was right, and it shaped the design. Orbit's challenges are
  statements about one trajectory; a grid has none, and almost every
  interesting sentence about one ("you built a dam") is not decidable. So the
  scenarios do not try: the puzzle lives in the setup and the restriction, and
  the goal is a number a census can answer. One of them needed more than a
  census — "keep the acid in the tank" is false of a global count, because acid
  that has eaten through the floor and run across the world is still acid — so
  goals can also count inside a rectangle.

  The budget is the part that turned chores into puzzles, and the checker is
  why it exists: the first draft of "turn the sand into glass" was solved at
  frame eight, because paint was free and the answer was to scribble lava
  everywhere. The checker now also proves technique matters — the same lava
  spread across the bed makes twice the glass it does in a heap.

  Two real bugs came out of it. Lava was autocatalytic: lava+sand→glass and
  lava+glass→lava together *make* lava, and eighty cells became eighteen
  hundred while eating an entire sand bed. Melting now costs the lava its heat,
  so the count is conserved. And water could not put out embers at all, which
  is wrong — flames are the easy part of a fire — so there is a forty-eighth
  reaction.
- ~~**Ambient Mix: presets** and a shareable mix code in the URL.~~ **done.**
  Eight presets, and the whole mix in twenty-six characters at most.

  The interesting part was the format rather than the presets. A mix code is a
  promise to a stranger — somebody pastes a link and somebody else opens it a
  month later, after the site has changed — so it is keyed on a fixed letter
  per layer rather than on position. Encoding by index would mean that adding
  a thirteenth layer silently rewrites every link already shared, with no error
  anywhere, and `scripts/check-mix.mjs` guards it by decoding a real link
  against a reordered, trimmed and extended copy of the layer table.

  A shared link also sets the controls without starting anything, because no
  browser will begin audio without a gesture and a link arrives without one.
- ~~**Steady Hand → a suite**~~ **done.** Line, circle, square, spiral, and a
  rating that is the mean of the four bests — withheld until all four have one,
  because an average over the two you happen to be good at is not a rating.

  The design question was whether to show the shape and have you trace it. It
  does not: every shape is anchored by dots instead, and the circle fixes only
  its centre, taking its radius from whatever you drew. That way it measures
  roundness rather than how well you guessed a size nobody told you.

  A score is accuracy × coverage × economy, and all three are needed — the
  checker shows it by removing each. Without coverage, half a circle drawn
  beautifully scores full marks, because every point of it was in the right
  place. Without economy, scrubbing back and forth along the line covers
  everything accurately and also scores full marks.

  The scorer is checked against drawings whose answer is known rather than by
  eye: a sine wobble of amplitude a has to drift by 2a/π, and does, to within
  a percent. Working out *why* it comes in slightly under at larger amplitudes
  — the nearest point of the ideal is nearer than the point you were pushed
  away from — was worth more than the assertion.

### Phase 3 — Kill the emoji, build real art — **done**

The credibility fix. This is genuinely laborious, and honest about limits: I can
produce good geometric/line-art SVG, not Neal's hand-drawn charm.

- ~~**18 bespoke tile illustrations**~~ **done.** One drawing per game, keyed on
  the slug so two games sharing one is structurally impossible, and no emoji
  anywhere on the grid.

  The old `art` field named a shape from a shared pool, which is how eighteen
  tiles ended up looking like one template with the silhouette swapped — same
  white ink, same opacity ramp, same corner, every time. Now each drawing
  declares its own composition (seven slots, none used more than three times),
  its own palette, and its own authoring size.

  The interesting part is `scripts/check-art.mjs`, because illustration is the
  one thing on this site with no formula to check against. It rasterises every
  tile with resvg exactly as the page composites it and measures the result,
  and it found more than eyeballing did: Scale's drawing was invisible over its
  own card, Steady Hand took its title from 8:1 to 2.2:1, three pairs of tiles
  were the same colour as each other, and Orbit was drawing twenty-four stars
  outside its own frame — invisible on every page load, and enough to make
  resvg abort at one card width.

  Two measurements were worth more than the assertions they support. Judging
  contrast over the text *box* failed Spend It for banknotes its two-word blurb
  never reaches while missing Overstimulated, whose popup really was under the
  last four letters of its own title; rendering the actual strings and
  measuring under the glyphs fixed both. And judging visibility on mean ink
  rewards solid blobs and punishes line work, which would have pushed all
  eighteen drawings towards the same heavy style — the template problem coming
  back in through a badly chosen metric.

  One change fell out of it that is not about art at all: between roughly 620
  and 660px of viewport the grid is one column, so a tile is 615×150 and the
  blurb was a 420px line running across the middle of the illustration. The
  text column is now capped in pixels as well as percent.

  Deferred, and honest about it: the palette is crowded. The closest two
  gradients are 0.221 apart in oklab against a median of 0.65, and separating
  the remaining near-neighbours would mean re-picking accents across the whole
  registry rather than the three this touched.

- **Still to do here**: lettering treatments per tile were in the original plan
  and are deliberately not done. Eighteen differently-set titles on one grid
  reads as chaos, not craft; the variety belongs in the drawings.
- ~~**Drawn icons replacing emoji**~~ **done**, and further than planned:
  Spend It's 30 items, Ambient Mix's 12 layers, Paper Folds' 19 milestones,
  Overstimulated's trophy and five runners, the 404 compass and the site
  favicon. Sixty-five drawings in `lib/icons.ts`, one set on one 24-unit grid.

  Emoji were never one set. A burger and a yacht and a ringed planet come from
  different corners of one vendor's library, drawn by different people at
  different times, and they are three other people's drawings again on Android
  and Windows. A row of thirty of them cannot look deliberate.

  The constraint that shaped the set: Ambient Mix and Overstimulated are nearly
  black, Spend It and Paper Folds are cream, and the same drawing has to work
  on both. Ink is `currentColor` and every fill is mid-tone enough to clear
  3:1 against either — a narrow band, and the reason these read muted rather
  than like emoji.

  `check-icons.mjs` renders each at the size it actually gets. Two bugs in the
  checker itself were worth more than the assertions: resvg hands back
  premultiplied alpha, so compositing the page colour by hand multiplied twice
  and failed every icon at 1.8:1; and grading the darkest single pixel at 26px
  grades the rasteriser, not the drawing.

  The distinctness test had to be rebuilt twice. Alpha maps work for the tile
  illustrations because their compositions sit in different parts of the card,
  but every icon is a centred object, so silhouette carries almost no signal —
  a burger and a football were both "a filled blob". Keeping colour fixed that.
  Then the fixed threshold turned into a treadmill: going from 12 icons to 65
  took the pair count from 66 to 2,080, and the minimum of a larger sample is
  lower whether or not anything got worse. It now tests whether the closest
  pair is an **outlier** against the tenth-closest, which is the actual
  question, and it was verified by pointing one icon at another's drawing and
  watching it fail at 0.00.

  **Two emoji are deliberately left.** Fusion's come back from the worker per
  generated element, so there is nothing to draw in advance. Rule Cascade's 🕷
  is not decoration: the rule requires you to type it, and the moth eats every
  character that is not one.
- **Illustrated scenes for Trolley** — the tracks, the trolley, the people, drawn
  with actual character.
- ~~**Illustrated objects for Scale**~~ **done.** Twenty-six drawings in
  `lib/scale-art.ts`, and the page keeps its shader for the seventeen entries
  that genuinely are lit spheres, rings, nebulae and a wave.

  The change that turned out to matter most is not an illustration at all. A
  drawing knows an object's width *and* its height; the registry's `m` is only
  one of them, and the old square disc silently treated it as the width — so
  the Eiffel Tower, quoted at 330 metres of *height*, was being drawn 330
  metres wide, nearly three times its real footprint. Every entry now declares
  which axis `m` measures, and the checker compares that against the registry
  rather than trusting the comment. Two objects proved a single field could not
  carry it: Everest is quoted by height and is nearly twice as wide as it is
  tall, and Manhattan is quoted by a length that runs down the drawing.

  The metric worth keeping is **structure**: what fraction of an object's own
  pixels sit on a step rather than on a smooth ramp. It is the only one of
  these tests a lit sphere fails, and the file renders one as a control to
  prove it — 1.1% against a 3% floor. It found three drawings that were
  gradients pretending to be pictures.

  Two of the tests were wrong first. Grading visibility with a WCAG luminance
  ratio failed the football pitch at 9%, because a green pitch and a pale blue
  sky sit at similar lightness — right about the lightness, useless about
  whether you can see a pitch; it is oklab distance now. And measuring over an
  object's bounding box rather than its own ink failed the Eiffel Tower for
  being a lattice, which is the third time on this site that a metric has been
  caught measuring the container instead of the content.

  What the checker could not see, and the eye could: a whale that was a
  mackerel, a grain of sand that was a bread roll, a canyon that was a plank
  with weeds on it — and, most usefully, an entire polygon that was **never
  drawn at all**, because the loop building the canyon rim took its direction
  from which side of the centreline it was on rather than from the sign of its
  step. Every measurement was green. Two things also only appear once the page
  is running: with real drawings the DOM paints them in registry order, which
  is ascending size, so a football pitch covered the whale standing in front of
  it until they were given a depth order; and a caption clamped to 26% of the
  viewport was fine over a plain ball and lands in the middle of a picture.

- ~~**Illustrated objects for Deep Time**~~ **done.** Forty-four scenes in
  `lib/time-art.ts`, one per event, flat colour on one twenty-one-entry
  palette with no gradients and no ids anywhere in the set.

  The layout was the real constraint and it is an unusual one. Cards sit at
  their true depth on an honest scale, so where events cluster they are pushed
  into two narrow lanes and then compacted — the note goes, then the date. Add
  a picture and the cards get taller, taller cards collide, and colliding cards
  compact. On a phone that took the count from three cards to twelve, and the
  tier it pushed them into is the one that **drops the picture**. The art was
  spending its own budget.

  Measuring it was what fixed it: almost none of the extra height was the
  picture, it was the *text column* getting narrower and wrapping the titles
  onto more lines. A 34-pixel square crop instead of a 50-pixel 3:2 one, plus
  slightly tighter padding, gives that width back and the count returns to
  exactly what it is with no art at all — three — with every card keeping its
  scene.

  The checker's own error is the one worth keeping. It began with a single
  edge-density floor at all three card widths and called the narrowest the hard
  case; that is backwards, because edge pixels track perimeter and the total
  tracks area, so the ratio rises as an image shrinks. One floor across three
  sizes grades size, not legibility, and it failed a scene at 116 pixels that
  scored nearly twice as well at 52. It is two questions now: structure at the
  width most cards get, and how much of the frame is subject rather than
  backdrop at the width a cluster gives.

  Distinctness found three real collisions in a row and then stopped, which is
  what it is supposed to do and not the treadmill the icon set fell into: the
  closest pair went 0.033, 0.041, 0.047, 0.049 while the tenth-closest went
  0.053 to 0.081, so the set was genuinely spreading rather than the bar
  sliding. The finds were honest ones — two shore scenes eighty million years
  apart that were the same picture, and two pairs whose backgrounds were the
  *identical* call to the same helper.

  Thirteen scenes were redrawn on eyesight alone, which no measurement covered.
  Archaeopteryx read as a centipede, a handaxe as a folded envelope and then as
  a cut gemstone and then as a fern, and a horse's head in profile as a duck
  and then as a whale. The two that took three attempts were both fixed by
  changing the subject rather than the drawing: a whole four-legged animal and
  a flat excavation-report diagram read at any size, where a head in profile
  and a hand-held object need detail the card cannot resolve.

  That closes Phase 3.

### Phase 4 — Endings, scores and sharing

- Every game ends in something worth screenshotting.
- Extend the existing OG-image generator into **per-result share cards** (we already
  render PNGs at build time; the same code can render a result).
- Persistent per-game stats.

### Phase 5 — Deal with the weak three

- **Paper Folds**: fold it into Scale as a chapter, or give it a real interaction
  (fold *manually*, with the paper visibly resisting after fold 7 — the actual
  physical fact that makes it interesting).
- **Progress / Life in Weeks**: leave them. They're small, honest, complete things,
  and not everything needs to be a game.

---

## The catalogue gap

neal.fun ships **41** things. We have equivalents for 15 of them (and one, Orbit,
that he doesn't have at all). Twenty-six are missing.

Sorted by whether we can actually build them *well* — which is the only sort that
matters, because shipping twenty shallow clones would repeat the exact mistake
diagnosed above.

### Build these — real depth, no backend needed

| Missing game | Why it's worth building | Real substance underneath |
|---|---|---|
| **Asteroid Launcher** | The most technically impressive thing he's made, and it plays to our strengths (physics + WebGL) rather than our weakness (illustration). | Published impact-scaling laws — crater π-scaling, fireball radius, thermal exposure thresholds, blast overpressure, Rankine-Hugoniot wind, seismic magnitude, recurrence interval. All verifiable against Chicxulub, Tunguska, Chelyabinsk. |
| **I'm Not a Robot** | Escalating absurd CAPTCHAs. Pure content and JS, extremely cheap, extremely funny, perfectly shaped for sharing. | Nothing but writing — which is exactly the muscle this site needs to build. |
| **The Auction Game** | Bid against AI bidders with real personalities and budgets. Genuine tension, no backend. | Bidding strategy per character, budget tracking, sniping behaviour. |
| **Dark Patterns** | A guided tour of manipulative UI, where each one is actually done *to you*. | Pure interaction design; the content is the point. |
| **Universe Forecast** | A weather forecast for cosmic events. | Real orbital mechanics — next eclipse, next perihelion, Betelgeuse. Computable exactly. |
| **Constellation Draw** | Draw your own constellations on a real star field. | A real star catalogue (HYG), and it reuses our shader work. |
| **Earth Reviews** / **Rocks** | One-star reviews of natural phenomena. | Pure comic writing. Cheap, and the site badly needs proof it can be funny. |
| **The Deep Sea** | His most-loved scroll piece. Our Deep Time engine already does this shape. | Structure is trivial; it lives or dies on ~60 illustrated creatures. Art-gated. |
| **Who Was Alive** / **Speed** / **Printing Money** / **Where Does the Day Go** | Small, honest, computable pieces. | Real data, no fakery. |

### Skip — needs infrastructure we don't have

Cursor Camp and Internet Roadtrip are multiplayer servers. Wonders of Street View
needs Google's API. Let's Settle This and Baby Map need live vote/data aggregation.
Wiki Spy is *possible* (Wikipedia's API is free) but is a different kind of project.

### Build order

1. ~~**Asteroid Launcher**~~ — **done.** Collins/Melosh/Marcus, 4,926 cities,
   checked against four real impacts by `scripts/check-impact.mjs`.
2. ~~**I'm Not a Robot**~~ — **done.** Twelve checks over a real behavioural
   profiler; maths checked by `scripts/check-telemetry.mjs`. It turned out not to
   be cheap: the writing was, but the measurement underneath it was not, and the
   measurement is the only reason the joke has anything to stand on.
3. ~~**The Auction Game**~~ — **done.** Fourteen lots, five rivals, real
   increments, a real buyer's premium, a reserve and chandelier bidding. The
   site now has a game loop. `scripts/check-auction.mjs` measures the winner's
   curse emerging from the model over 28,000 lots, and guards the balance.
4. Then reassess against the depth work in Phases 1–2 above.

**Where that leaves it.** Three new games, three checkers. The pattern that
worked all three times: build the model as pure functions over plain data, run
it headlessly against answers somebody else already knows, and let the page be a
thin layer on top. Every serious bug in all three — the entry model, the
Mach-stem approximation, the crater-depth unit, the dodging checkbox, the
premium inverse, the one rival winning 70% of the room — was found by running
the thing and reading the output, not by re-reading the code.

Next is the depth work in Phases 1–2, which is a different muscle: Rule Cascade
12 → 30 rules, Trolley 12 → 26 dilemmas, Powder 12 → 30 elements with a
discovery log, From Memory 8 → 16 prompts. No new engines, a great deal of
writing.

The rule for all of them: **one built properly beats five built quickly.** That is
the entire lesson of the diagnosis and it applies to new games hardest of all.

---

## What this does not fix

Stated plainly so it isn't a surprise later:

- **I can't draw like Neal.** His charm comes from a human hand. My SVG will be
  clean and consistent, and it will not be charming in the same way.
- **Fusion needs your Cloudflare account** to be what it wants to be.
- **None of this makes the site *popular*.** Neal's reach comes from years of
  audience-building. This plan gets the work to a standard where it would deserve
  attention, which is the only part that's in our control.
