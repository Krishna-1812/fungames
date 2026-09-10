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
| **Trolley** | ~~12 dilemmas, and an abstract track diagram.~~ Twenty-six, and a drawn scene that changes with each one. | **Medium-high — done** |
| **Fusion** | ~~Effectively dead without the Cloudflare worker.~~ Thirty-six local recipes, reachable from four seeds, checked in both orders. | **Medium — playable offline** |
| **Spend It** | Competent clone. Emoji instead of product images is the main tell. Receipt endgame is good. | **Medium** |
| **Steady Hand** | ~~A 20-second toy with one challenge.~~ Four shapes and a combined rating. | **Medium — done** |
| **Scale** | ~~Draws *circles* for a proton, a whale and a galaxy.~~ Twenty-six drawn objects, sized on both axes, and the shader keeps the seventeen things that really are spheres and rings. | **Medium — done** |
| **Deep Time** | ~~A Wikipedia list on a gradient.~~ ~~Forty-four events, forty-four scenes, shown at 116px in a flat box.~~ Every card lit by its own scene's colour, and the art large enough to be the picture rather than the icon beside it. | **Medium — done** |
| **Ambient Mix** | Quietly the most *finished* thing here. Twelve real synthesised layers. Just needs presets and a shareable mix. | **Medium** |
| **Paper Folds** | A fact, not a game. You press one button 42 times. | **Low** |
| **Progress** | ~~Thirteen identical bars for thirteen things that are not alike, and are not parallel either.~~ Fifteen concentric channels on one machined dial, ordered by span, plus a date model that survives a 23-hour day. | **Low — done** |
| **Life in Weeks** | ~~The grid got a real shader; the four cards and the form around it stayed the site's original flat template.~~ One instrument, materials pulled from the grid's own palette. | **Low — done** |

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
- ~~**Illustrated scenes for Trolley**~~ **done.** It is a place now: a field
  with scrub, a ballast bed and two rails under each track, and a tram with a
  pole, a driver and a headlight instead of a rectangle with two circles under
  it. The figures are filled silhouettes rather than two-pixel strokes, and the
  lobster and the chicken are drawn as a lobster and a chicken.

  The drawing moved out of the page into `lib/trolley-scene.ts` and now carries
  its own fills. That removes a trap rather than documenting it a sixth time:
  nodes built at runtime do not get Astro's scoped-style attribute, so every
  rule for them had to be written `:global` or it silently matched nothing —
  and the branch rail rendered as a solid black wedge. Colour in the markup is
  also the only way the checker sees what the browser sees. The two rules left
  in CSS are the two that are animation.

  `check-trolley-scene.mjs` is the first checker here that tests a picture
  against a *claim*: the footbridge case must draw no lever because it has
  none, a dead lever must get a dashed branch, a loop must put nobody on the
  branch. It also proves every token kind draws something — a kind the drawing
  does not handle renders an empty track where five people should be — and it
  found three real things: an orange "you" and a gold chicken that both sat
  under the separation bar against the ballast they stand on, and a tram whose
  markup was only ever correct because the page translated it on the very next
  line. Rendered on its own it sat half outside the frame.

  One of its failures was the checker's own: it reported all twenty-six scenes
  as overflowing by an identical 3.9%, which turned out to be one pixel of
  antialiasing around a boundary computed exactly on the frame edge. An
  identical number across every case is the shape of a measurement bug, not of
  a drawing one.

  That closes Phase 3.
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

  Trolley's scenes are the one thing left in this phase.

### Phase 4 — Endings, scores and sharing — **started**

- ~~**Per-result share cards**~~ **the machinery is done.** `lib/result-card.ts`
  builds a 1200×630 card for a *result*; `lib/share-card.ts` rasterises it in
  the browser and offers `navigator.share` with the file, then a download,
  then the link.

  The plan said "the same code can render a result", which turned out to be
  half right. The card cannot be built at build time — a static site has no
  server to render a result on request, and no URL that could point at one — so
  the same *job* runs in the browser instead. What is genuinely reused is the
  game's accent pair from the registry and the game's own tile illustration
  from `tile-art.ts`, so the picture on your result is the picture on the
  homepage.

  It found a live bug in the cards already shipping. Both cards paint a
  diagonal gradient from `accent` to `accent2` and write on the left, and both
  chose their ink from the luminance of `accent2` alone — the corner furthest
  from the text. Eight games have a near-black `accent` and a light
  `accent2`, so eight OG images were going out with dark text on a near-black
  ground: 1.9:1 on Asteroid Launcher.

  The checker's own history is the part worth keeping. It measured how far
  right the ink reached and nothing about how far down, and passed a card whose
  two-line headline printed through the line beneath it. Rendering each block
  alone and comparing boxes does not fix that either — removing the headline
  moves everything under it — so the card now *declares* its layout and the
  checker holds it to it: declared boxes must not overlap, and every pixel of
  ink must land inside their union.

  And one decision reversed on contact with a browser: an over-long stat row
  used to throw. That is right in a checker and wrong in a page — the first
  game wired up passed "Contractualist" as a runner-up, out of its own data,
  and the exception killed the share at the one moment somebody wanted it. The
  card drops the chip now, and `check-result-card.mjs` is what refuses it.

- ~~**Persistent per-game stats**~~ **done.** `lib/stats.ts`: one key, one
  version, one shape. Six games each had their own key and their own format
  before this, which is fine until a question crosses games.

  Written on the assumption that storage is hostile, because it is:
  `localStorage` throws on *access* in Safari's private mode, is absent in a
  sandboxed iframe, fills up, and holds whatever a previous version or another
  script on the origin left there. The store is an argument rather than an
  assumption, and `check-stats.mjs` runs the real module against six of them —
  working, throws-on-read, throws-on-write, full, full of junk, and absent.

- ~~**Every game ends in something worth screenshotting**~~ **done.** Every
  game with a real ending now has one you can send: Trolley, Steady Hand,
  Spend It, Rule Cascade, Overstimulated, I'm Not a Robot and Asteroid
  Launcher here, and Auction and From Memory in the owner's own commits. From
  Memory's is a postcard of the drawing rather than a stat card, which is
  right — a score card for a drawing would be the wrong object.

  `GameLayout` already turned every `[data-share]` button into a cancelable
  `game:share` event, so `onShare()` in `share-card.ts` is the whole
  integration: a game says what its card is, returns null while there is
  nothing worth a picture, and the button keeps its old link-sharing behaviour
  until then. Eight copies of the same listener is what that replaced.

  Two things the checker could not have caught and a screenshot did. Spend It
  printed "100.00% left" on a receipt for something you had just bought —
  true to two decimal places of a hundred billion, and read as a bug. And
  Asteroid's result came out "…2.4 million…", truncating a casualty count.

  That second one was a layout bug, not copy. `fit()` steps the type down
  until the text fits, and the test it stepped on was `lines.length <=
  maxLines` — which `wrapEm` makes unconditionally true, because it enforces
  the line limit *by* ellipsising. So `fit` could never step down: every
  sentence too long for two lines rendered at the largest size with its tail
  cut off, with room to spare underneath. A cut is now not a fit, and the
  sentences set at 26–30px instead, whole.

  `check-result-card.mjs` gained the two things that would have caught them.
  Its samples were generic and cross-multiplied across every game, which tests
  the layout and not the copy — so `WORST` now holds, per game, the longest
  thing that game can genuinely produce, read off its own branches rather than
  invented. And a card is failed if any of that copy gets ellipsised at all.

  The declared layout boxes also had to become honest. They were built from
  `emWidth`, a five-bucket character-width table that the same file only holds
  to ±20% — so "ink lands inside the declared boxes" was really a second,
  blunter test of the width model, and it failed on "Ordinarily", which sets
  about 5% wider than predicted. The boxes now carry the model's own
  tolerance, exported as `WIDTH_TOLERANCE` and shared with the check that
  measures it, so widening it is visibly a change to what the card promises.

  ~~Not played end to end: Rule Cascade and I'm Not a Robot.~~ **Both now
  are**, and the detour paid for itself. Rule Cascade ended every completed
  run with its own payoff line — "Fine. That is a username." — hidden behind
  the sticky input box, which scrolling cannot free, because the field is
  pinned to the top and the win panel opens underneath it. The field now stops
  being sticky once that panel is up.

  Getting there needed a solver, so `check-cascade.mjs` grew an `--answer`
  flag that prints a playable username instead of a verdict. It prints eight
  of them: rule 23 asks for the number of rules on screen and satisfying it
  puts another one there, so the endgame is a ladder from 23 up to 30 — which
  is nowhere in the checker's pass/fail output.

  I'm Not a Robot came through all twelve checks clean, and its ending is the
  best one on the site: a report card scoring each channel against a human
  range, then a grid of your own traces to pick yourself out of. The one thing
  that looked wrong — a "not measured" tile beside a panel reporting tremor —
  was not: the empty channel was click rhythm, genuinely empty because the run
  was driven with synthetic clicks.

### Phase 5 — Deal with the weak three — **done**

- ~~**Paper Folds**~~ **done**, the second way: a real interaction, with the
  paper resisting. It is not folded into Scale, because it turned out to have
  a subject of its own that Scale has no room for.

  The reason you cannot fold paper eight times is not that it "gets too
  strong", which is the usual answer and is wrong. It is geometric, and
  Britney Gallivan worked it out in 2002 while still at school: every fold has
  to bend the whole accumulated stack through 180°, and the paper that goes
  round that bend is no longer available to be folded. The stack halves in
  length each fold while the length eaten by the bend grows like 4^n, and that
  race is lost quickly.

  So `lib/fold-paper.ts` is her two equations, and the fold limit is a
  property of a sheet rather than a number typed into the page. You pick one —
  A4, a banknote, a tissue, her 1,219-metre roll, a football pitch of tissue,
  gold leaf — and drag its edge over to fold it. It stops where that sheet
  stops. `check-fold.mjs` holds the model to three things people have actually
  done: A4 folds seven times alternating and six in one direction, and the
  roll folded twelve, which was her record.

  The drawing is the argument rather than decoration. The sheet is edge-on
  with both dimensions to the same scale, so A4 starts as a hairline 297 mm
  long and ends, after seven folds, as a bar 1.6 mm across and 13 mm thick —
  it visibly turns on its side. Over it sits a dashed circle: the turn the
  next fold has to make, radius half the stack, growing at exactly the rate
  the paper shrinks. Watching those two cross is the whole answer.

  The first version drew that circle **as** the paper's rounded end, which at
  fold seven came out as a clean coin 13 mm across drawn from a sheet 1.6 mm
  wide — a picture of the fold succeeding, which is the opposite of what
  happens. Solid is now only ever the paper you have, and the requirement is a
  ghost laid over it.

  This also fixed a truthfulness problem that was the page's real weakness.
  The old button folded 103 times with nothing to say that seven is where
  paper gives up, so the imaginary half was presented as something you were
  doing. Both halves are still there — the log axis out to the observable
  universe is the best thing on the page — but reaching the second one now
  takes a button that says **Carry on anyway**, and the readout says so too.

- ~~**Progress / Life in Weeks**~~ left alone, as planned. They are small,
  honest, complete things, and not everything needs to be a game.

  **Progress was reopened anyway** — see item 13 below. The judgement that it
  was complete was about its *content*, and that judgement stands: it still
  says one thing and says it in one screen. What was wrong was the picture.
  Thirteen horizontal bars claimed these units were thirteen separate things,
  and they are not: this minute is inside this hour is inside today. Concentric
  channels say the true thing, and they were never more work than parallel
  ones.

  **Life in Weeks was reopened too, but for a narrower reason.** Its content
  judgement also stands — one date, one grid, one screen, nothing to add. What
  had aged was that the grid had already been given a real shader (a prior
  pass: birth-blue to lived-in amber, a current week that pulses and bleeds
  past its own edges) while the stat tiles, the ask form and the facts list
  around it stayed the site's original flat card — a beautiful grid inside an
  ordinary page. See item 14 below.

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
4. ~~**Universe Forecast**~~ — **done.** Four series out of Meeus running in
   the browser: equinoxes and solstices, phases of the Moon, which of those
   phases are eclipses and of what kind, and the Earth at perihelion and
   aphelion. `scripts/check-forecast.mjs` holds it to Meeus's own worked
   examples and to eight eclipses people have stood outside and watched, by
   date *and* by type — and then to the things no single wrong coefficient
   could fake: every solar eclipse landing on its own new moon, the Saros
   recurrence at 223 lunations, and between two and five solar eclipses in
   every year from 1900 to 2100.

   The pattern held for a fourth time, including the part where the instrument
   contradicts you and you have to ask which of the two is wrong. Three checks
   failed on the first run and none of them was the model: one expected value
   was the *mean* phase Meeus prints before applying corrections rather than
   the answer, one demanded minute-level agreement on a quantity the Moon
   moves by hours, and one set a tolerance tighter than the measurement could
   support. What the checkers did catch was real: a share card whose sentence
   and stat labels both ran off the end, and an eclipse tile that made resvg
   abort outright because a `slice` slot had cropped two of its shapes clean
   out of the frame.

5. ~~**Universe Forecast, drawn properly**~~ — **done.** The page shipped with
   the dates right and the pictures decorative: five hand-drawn eclipse icons
   that were the same five shapes whatever the numbers said. Every drawing on
   it is now generated from the model's own output.

   That needed two more chapters of Meeus. Chapter 47's distance terms give
   how far away the Moon is on the day, and chapter 48 gives how much of it is
   lit — so the hero draws the Moon's disc at the size it will really be
   against the Sun, on the chord it will really take, over a sky dimmed by the
   area actually covered; the lunar ones use the real radius of the Earth's
   shadow at that distance; and every row in the list shows its own geometry
   rather than an icon of its category.

   The distance series bought something better than a picture. Chapter 54
   decides total-or-annular from the sign of a coefficient that knows nothing
   about distance, and dividing two apparent diameters decides the same
   question from chapter 47, which knows nothing about eclipses. **They agree
   on all 135 central eclipses of this century.** That is the strongest single
   piece of evidence in the repository, and it fell out of work that was only
   supposed to make the drawings honest.

   The instrument was wrong twice more, and in both cases it was a mean
   standing in for a real thing: the Moon's age came out a quarter of a day
   off at the moment of new moon, because it was measured against the mean
   elongation rather than against a real new moon; and the check that caught
   that then failed on a Moon 29.71 days old, because it had been bounded by
   the *mean* synodic month when real lunations run 29.27 to 29.83. What the
   measuring caught in the page: a skip link painting white on near-white
   because this page had redefined a global token, a "draw this one" button at
   3.8:1, forty wheel markers with four-pixel hit areas, and the annular
   eclipse's ring glow filling the Moon with gold and turning it olive.

6. ~~**Universe Forecast, made an instrument**~~ — **done.** The drawings were
   right but you could only watch them. Now the stage stops, and you can drag
   through the event yourself; the list and the ring are two views of the same
   forty-four things and light each other up; the Moon panel scrubs a fortnight
   either way and recomputes every number for the day you land on; the legend
   switches kinds off the ring; and each month on the ring is a button into the
   list.

   The scrubber needed one more piece of chapter 54 — the Moon's motion
   relative to the shadow's axis — which gives every lunar eclipse's contact
   times. They come out within a minute or two of the times people actually
   sat through: the longest totality of the century at 103 minutes, the March
   2025 eclipse first contact at 03:59 UTC. That produced the page's sharpest
   asymmetry, which is now stated rather than papered over: a lunar eclipse
   happens at one instant for everybody who can see the Moon, so it gets a
   clock, and a solar eclipse's contact times are different in every town the
   shadow crosses, so it does not get one.

   Three things the measuring caught. A linked highlight that added and removed
   classes in matched pairs leaked — a row re-rendered under the pointer never
   sends its "out", and its mark on the ring stayed lit for the session; it
   clears wholesale now. The ring's last wedge is a part-month and rendered as
   a 17px target, so each sector is measured after it renders and demoted to
   decoration if it is not a real one. And the contrast auditor was reading
   `color` on SVG text, which is not what paints it — with `fill` read
   properly, two labels were under 4.5:1.

7. ~~**I'm Not a Robot, made authentic**~~ — **done.** The checks were good
   and the shell was ours: a rounded card with a shield, a title, a subtitle
   and a step counter. Nobody has ever seen that object. The whole joke rests
   on the first thirty seconds being indistinguishable from the real thing, and
   it was not.

   So the widget is built to the real one's measurements. A 300 by 74 anchor
   with a 28-pixel box, a spinner that pauses for most of a second before
   anything decides it believes you, and a tick that draws itself in. The
   challenge floats over a dimmed, out-of-focus page, because a verification
   dialog never appears on its own — it appears over something you were trying
   to do, and that dimming is half of why the thing on top reads as a dialog.
   The header is the blue instruction block with the target word set at 25
   bold under a 14-point lead-in. Four-pixel gutters between the tiles. A tick
   that lands in the corner as the tile shrinks away from it. Roboto over the
   lot, loaded for this page alone through a `fonts` prop on the layout so it
   costs one extra family on one URL rather than a second request on
   twenty-one pages. The substitute typeface is the first thing that gives a
   copy away.

   The one measurement I knowingly moved: white on the real `#4a90e2` is 2.9:1.
   The widget everybody in the world trusts does not pass its own contrast
   check. Ours is the same hue at the lightness where white clears 4.5:1 across
   all twelve steps. Being faithful to an illegible header is not a trade worth
   making. What the header does instead is drift — one step at a time, the long
   way round the wheel through violet and magenta to red, because the short way
   passes through the colour that means everything is fine.

   The street is a new thing: `lib/robot-scene.ts`, drawn in one-point
   perspective with converging buildings, a crossing under the camera, haze on
   the far end, occlusion where every surface meets the pavement, a vignette
   and grain — and one light direction obeyed by all ten buildings, which is
   most of what separates a drawing from a photograph. Nine tiles share one
   copy of it through `<use>`, and the nine turbulence filters that grain them
   turned out to cost nothing: 16.7ms median frame time with the selection
   animation running, measured rather than assumed.

   **The answer key is derived, not typed.** The tempting shape was to draw the
   street and then write down which squares the light is in — two facts held in
   step by hand, which is exactly the pair that goes stale the moment the
   drawing moves. Instead the light is kept apart from the rest of the scene
   with its own bounding boxes, and `answerCells` works out which squares hold
   it. `scripts/check-robot-scene.mjs` then asks the same question a completely
   different way: render the street twice, with the light and without, and see
   which squares changed. Pixels do not care what the boxes say. The two agree.

   That framing produced the better idea. There are **two keys, not one.** A
   signal head hanging over the road is in a square or it is not. The pole
   holding it up clips three more squares on the way down, and whether those
   "contain a traffic light" is a judgement rather than a fact. Real CAPTCHAs
   grade that judgement as though it were a fact, and that — not the blurry
   photographs — is the thing that makes them infuriating. So the head is
   required, the pole is optional, and ticking a square the light never reaches
   is the only way to be wrong.

   The three footer buttons everybody recognises are real controls rather than
   decoration: the arrows give you a fresh challenge of the same kind, the
   headphones toggle the site's sound, and the question mark opens what is
   being measured and where it goes. And the anchor is now the way in — you
   tick it, it thinks about you, and then the questions start, which is the
   order it happens in everywhere else. That makes step two, where the same
   widget starts running away, a much better joke than it was when it was the
   first thing you ever saw.

   What the measuring caught, over all twelve steps at 375 and at full width:
   the header colour never moved, because `--rc-blue` is declared on the body
   and a custom property is substituted where it is *declared*, not where it is
   used — setting `--heat` on the widget left every step blue. Two contrast
   failures, both in eight-point grey. The terms checkbox was a 13-pixel target
   and the sign-off link 23 pixels tall. And my own auditor was reading a
   translucent white button as an opaque white background, which is how a
   perfectly legible control on a dark bar reported 1:1.

   The hands were the last part that still looked homemade. Four flat outlines
   four-across in a 400-pixel body, with the thumbs too small to count. They
   are now four image tiles two-by-two — the other shape a real challenge comes
   in — drawn with a studio ground, skin lit from the same side the street is,
   creases where a finger actually bends, nails, and a shadow underneath. The
   digit count comes out of the loop that draws them rather than being typed in
   beside it, so a hand cannot claim four fingers and be drawn with five, and
   the checker renders all four and confirms every pair is visibly different.
   The first attempt drew each thumb out to one side and then rotated it as
   well, which left it floating next to the hand rather than attached to it —
   visible in one render, invisible in the code.

   **The street, made photographic.** The honest note on the first pass was
   that the picture was a good illustration and Neal ships JPEGs. Closing that
   is mostly one idea repeated: nothing in a photograph is even. Every surface
   got a multiply-texture filter — asphalt, concrete, brick, plaster, paving,
   metal, foliage, each its own frequency — plus a slow mottle over the whole
   frame, because each shape still had one colour inside it and no shape in a
   photograph does. A filmic grade with black lifted off zero, since light
   scatters in a lens and a photograph has no true black. A quarter-unit blur
   over everything, since a lens and a sensor put about a pixel of softness on
   the world and a vector render is the only picture with none. Grain over the
   lot. And the content a street actually has: overhead wires, lamp standards,
   parked cars, trees, signs, bollards, a fire escape, roof clutter, people,
   drains, cracks, patched tarmac, worn paint.

   The largest single gain was the cheapest: **a cast shadow.** The sun is off
   the right, so the right-hand buildings throw a diagonal across the road, the
   left row is warm and the right row is cool, and shade is bluer rather than
   merely darker. A street without that reads as an overcast render of a street
   whatever else is done to it.

   It is served as a **build-time JPEG** now. Two reasons, and the second is
   the better one: nine tiles of one filtered drawing meant nine runs of the
   filter stack in the browser, and a real challenge's tiles are crops of one
   photograph. PNG came out at 1.2MB against 86KB of JPEG — texture and grain
   are precisely what lossless compression cannot help with — and JPEG's own
   ringing and softening are part of what a real tile looks like.

   The new checks measure the artefact that ships, decoded, rather than the SVG
   it came from. Two of them found things. **Nothing in the frame was flat**
   passed at 1.4%, but **the road grain did not fall off with distance** failed,
   and it was right to: a filter works in screen space, so one texture painted
   chippings the same size underfoot and a hundred metres away. Fixed with a
   second, finer asphalt masked in by a gradient over the whole road, so there
   is no band edge where two noise frequencies meet. The other failure was mine
   rather than the picture's: the first depth metric compared a band of windows
   against a band of empty road and was measuring how much was going on at each
   height, not how sharp it was. It now samples the same material at two
   distances, and in relative contrast rather than absolute, because the near
   band sits deeper in the shadow and the same texture there produces smaller
   absolute differences.

   **It is still not a photograph.** It is a much more photographic rendering:
   the geometry is regular in a way buildings are not, the silhouettes are
   exact, and the cars are simple. Anyone looking for it will see a render.

8. ~~**Paper Folds, made a place**~~ — **done.** The model was the best on
   the site and the page was the plainest: a cream column of cards, and a
   hero interaction that at fold zero was a 1.5-pixel hairline in an empty
   rectangle. The hairline was the thing you were supposed to want to touch.

   Two new libraries. `fold-scene.ts` puts the sheet on a desk — a small
   perspective projection, one light obeyed by every face, laminations down
   the cut edge, a contact shadow that follows the footprint, and the rounded
   lip at the crease drawn at half the stack, which is the radius the length
   accounting charges for. `fold-sky.ts` is the other half of the idea: **the
   page's own backdrop is the altitude.** Nine stops from a warm desk to
   intergalactic space, with the ground, the clouds, the limb of the Earth,
   the stars and the galaxies fading in and out along the way, and the whole
   climb also drawn as a single gradient strip beside the sheet so you can see
   where on it you are. Folding alternately now turns the sheet a real quarter
   turn between folds, which says what "alternate" means better than the label
   on the button does.

   The rule that made it tractable: **the panels stay light.** The obvious
   version darkens the cards along with the sky, and somewhere around fold
   forty-eight the surface and the ink pass through the same grey. Keeping the
   surfaces light and letting only the world behind them travel means there is
   no crossing to get wrong — and nothing on the page sits directly on the sky,
   because a big title floating over deep space looks wonderful at exactly two
   of the hundred and four altitudes.

   `check-fold-scene.mjs` earned itself several times over. It found the
   projection had the camera *underneath* the desk looking up — which renders,
   and renders wrong, and is invisible until something asks whether the far
   edge is narrower than the near one. It found back-face culling done by
   screen winding, which depends on the projection's handedness and was
   therefore backwards. It found fourteen sub-pixel quads per frame whose
   winding was whatever the rounding decided.

   And it found the real one. The check that the lip outgrows the sheet at the
   fold the sheet gives up **passed, and passed for the wrong reason**: the
   page was computing the remaining width as `have/2^n`, which is the answer
   for folding the same way every time, and under alternate folding it is off
   by a factor of sixteen at fold seven. The right footprint is now in
   `fold-paper.ts`, derived rather than accumulated, and the honest
   relationship is recorded instead of the flattering one: this fold's bend
   alone would allow nine folds of A4, and charging for all the earlier bends
   too allows seven. Gallivan's bound is the stricter one, and it has to be,
   because paper that went round fold three is still going round it at fold
   seven.

   Two of the four failures were the metric's rather than the picture's, which
   is worth writing down: one compared the topmost pixel of the scene against a
   point on the centre line, on a sheet whose far corners sit six times higher
   than the height being measured; the other compared a band of windows against
   a band of empty road. Both were measuring how much was going on rather than
   what they claimed to measure.

9. ~~**Paper Folds, made beautiful**~~ — **done.** The page above was correct
   and plain: six cream cards of identical radius, fill and shadow, floating on
   the sky. Two things were wrong with it and they turned out to be the same
   thing. Six identical panels read as a form rather than as an object, so
   nothing on the page was the subject. And light panels put the one thing the
   game is about — a white sheet of paper — on a white background, so at fold
   sixty you were between the stars looking at two white index cards with the
   galaxies hidden behind them.

   So: **one dark instrument, and a sheet of paper that is the brightest thing
   on the screen.** The head, the sheet picker, the stage, the altimeter, the
   readout and the buttons are now one console with hairlines between its
   parts; the stage and the altimeter are recesses cut into it rather than
   cards laid on it; and the console is dark at every altitude. Everything else
   followed from that. The paper glows because it is the only light thing, and
   it got a bloom, a lit edge and two shadows to prove it. The accent could
   become a real amber — the old one was the darkest gold still legible on
   cream, which is to say mud. The stage well became a window with its own
   sky in it rather than a hole. And the altimeter became an instrument: a lit
   track, ten-fold ticks, dimmed above where you have got to.

   The part worth writing down is that inverting it made the **contrast
   argument stronger, not weaker**, and that is the tell that it was the right
   way round. The old rule was "the panels stay light", held all the way up so
   the ink never had to cross the surface — safe, sampled at a hundred and four
   points, and paid for with the entire visual payoff of the journey. A dark
   console with light ink cannot cross at all: `surfaceMax` and `inkMin` in
   `fold-sky.ts` declare two luminance bands, every stop is checked against
   them, and a linear mix of two values in one band stays in that band — so the
   ratio holds at every fold rather than at the ones a checker happened to
   look at.

   What a dark console costs is the other separation, and this is the honest
   half: a dark panel on a sky travelling from daylight to black **must**, at
   some altitude, pass through the panel's own value. Around fold thirty it
   does, to within a hundredth. The old check for that ("the panel stays off
   the sky by 1.12:1") was not failing, it was *unsatisfiable*, and replacing
   it with a looser number would have been the checker agreeing with the
   design. What actually keeps the panel findable is its edge: a lit rim over a
   dark face, two tones 2.2:1 apart, which one sky value cannot match at once.
   That is now the test, and unlike the old one it is a statement about how the
   thing is drawn rather than a hope about where the colours landed.

10. ~~**Paper Folds, given a ruler**~~ — **done.** The altimeter was the worst
    thing left on the page: a gradient rail with seven words beside it —
    PAPER, A HOUSE, SPACE, THE MOON. Words are not a measurement. "Nearest
    star" written next to a coloured strip tells you something you already knew
    and nothing whatever about size, which is the exact failure the game exists
    to fix, sitting in the game's own furniture.

    So `fold-scale.ts` holds thirty-two real things with their real heights,
    from a grain of sand at half a millimetre to the observable universe at
    8.8e26 metres, and the panel draws the smallest one the paper has not yet
    passed — to scale, standing on the same ground, with the paper beside it
    and the things it has already outgrown receding behind. Fold twenty-one and
    the stack is 64% of the way up the Eiffel Tower. Fold twenty-two and it is
    past it, the frame pulls back by a factor of twenty-seven, and Everest is
    standing there instead. The zoom is eased in log space, so an overtake
    takes the same time whether the next rung is three times bigger or a
    thousand.

    Above about ten kilometres nothing stands on the ground any more, so the
    drawing changes rather than pretending: a curved limb at the foot of the
    frame and a marker at the top for a distance, a body whose own diameter is
    the measure for a size. That change of character *is* the altitude
    readout — the thing the rail was gesturing at.

    Two honesty notes are in the code where they belong. The paper's column is
    to scale in height and not in width, because the true width is 26 cm at
    fold ten and narrower than an atom at fold forty; the edge-on inset on the
    stage is where both axes share one scale, and that is the drawing that
    answers the question the game actually asks. And the silhouettes are
    backlit — nearly black, with a warm contour and whatever light is inside
    them — because they are between you and the same left-hand lamp the sheet
    is lit by.

    `check-fold-scale.mjs` paid for itself immediately. Eighteen heights are
    typed in again, independently, so a slip has to happen twice to survive;
    the ladder is held to being sorted with no gap wider than 7.2 folds; and
    every silhouette's path is *walked*, cubic extrema solved rather than
    approximated by control points, to prove it stands on y=100 and reaches the
    top of its box. That last one found six real defects a screenshot had not:
    the coffee mug's rim was in the lit detail and not in the silhouette, so
    the shape stopped a fifth below the top of the mug; Everest was drawn 8%
    shorter than the 8,849 m the caption claims for it; the grain of sand 7%
    short; and the pencil and the Burj Khalifa each declared a box a third
    wider than the shape inside it, which reserves layout space and then leaves
    it empty. Every one of those looks almost right in any single frame.

    The seventh was found by eye and is worth recording as the kind a checker
    cannot catch: Everest's snow cap was painted with the same warm colour as
    the windows of the house, and read as a gold hat. Lit and pale are now
    different materials.

11. ~~**Paper Folds, element by element**~~ — **done.** A pass over every
    piece of the page asking what it could be rather than whether it worked.

    **The sheet is made of something.** Six sheets were being drawn as the same
    cream rectangle, which threw away the best thing in the picker: gold leaf
    is *gold*. Each material now carries its own faces, gloss, tooth and bloom,
    so beaten metal gets a tight specular and no fibre, a tissue is white and
    soft with almost no highlight, and a banknote is green-grey cotton. The
    comparison column and the true-scale inset draw from the same material, so
    the whole page changes when you change the sheet.

    **The length budget is drawn as a length.** It was a progress bar reading
    have/need — a number about the game rather than a picture of it. What is
    actually happening is that each fold takes a bite out of the strip and the
    bites grow like 4^n, so the bar is now the strip: what the folds behind you
    have spent, what this one is about to take, striped because it has not
    happened yet, and a hard mark at the end of the paper. The fold that fails
    is the one whose bite crosses the mark, and you can see it coming two folds
    out. Refusing now flashes the gauge as well as shaking the stage — the
    shake says no and the gauge says why, and they should be one event.

    **Overtaking something is now an event.** Passing the Eiffel Tower is the
    best thing that happens in this game and the page used to let it go by in
    silence: the name simply became a different name. The thing you have just
    left keeps its light for a second and a half while the view pulls back off
    it, and it is named.

    **The numbers roll.** Each character of the thickness and the layer count
    is its own inline-block, and the ones that changed slide up, staggered left
    to right. A game about doubling should let you watch the doubling happen.

    Also: icons on the sheet picker, so six buttons are a rack of materials
    rather than a list to parse; a pulsing hand at the sheet's right edge until
    the first fold, because nothing said the thing was draggable; the Milky Way
    as a real band with a dust lane and its own denser star field rather than
    evenly scattered dots; a sun while there is still air to shine through; and
    dust in the lamplight, which is the whole difference between a gradient and
    an evening.

    One bug worth recording, because it is the kind eyes are bad at: after the
    rolling digits went in, the big readout looked *slightly* wrong and I could
    not say why. Measuring it said why — `.fig span` was styling every span in
    the figure, and the digits are spans, so a thirty-eight-pixel number was
    being drawn at ten-pixel uppercase mono. A descendant selector where a
    child selector was meant. It is now `.fig > span`.

13. ~~**Progress, as one instrument**~~ — **done.** Thirteen horizontal bars
    became fifteen concentric channels milled into a single machined dial, one
    unit each, ordered by span: this second at the rim, the Sun's life dead
    centre. The ordering *is* the argument — each unit contains the one outside
    it — and parallel bars had been quietly denying it. The channels carry the
    same rate-coloured material the bars did, hot lume at the rim and cold
    mineral at the middle, so a still screenshot still says which is which. The
    backdrop's rock strata went with the bars: a chronometer in front of a core
    sample was two metaphors arguing, and the page is now one object — a wall
    panel, an instrument bolted to it, a data plate under that.

    The real work was making any of it testable. Nothing on this site has ever
    had a test for a shader, because every shader module imports `lib/gl.ts`
    and Node's TypeScript loader refuses that file — parameter properties it
    will not parse, and a `matchMedia` call at import time. So the geometry and
    the palette moved into `progress-geom.ts`, which imports nothing, and the
    shader interpolates them into its own source. `check-progress-dial.mjs`
    walks the radius and asserts the ring the pointer finds is the ring the
    shader milled — the failure being two plausible-looking statements of where
    a channel is, silently drifting — and reads the shader back as text to
    confirm no second copy of a dimension has appeared.

    Three things it caught that looking could not. **A day is not always
    twenty-four hours.** `setSeconds(0, 0)` decomposes an instant into local
    wall-clock fields and recomposes it, and during the autumn repeated hour
    that names two instants: at 2024-11-03T06:42:00Z in New York the minute
    containing that instant came back a full hour earlier than the instant. Two
    rows would have read 0% or 100% for an hour, once a year, in every zone
    that changes its clocks. Flooring in offset-shifted epoch space has no such
    step, and it survives the half-hour offsets that make plain epoch flooring
    wrong for the hour. **The 32-bit row dies in 2038** — it is the one unit
    here that happens once rather than recurring, and after 19 January 2038 it
    sits at 100% with negative time left, which is precisely the fault the
    weekend row was fixed for. It now drops out, and the dial becomes a
    fourteen-ring dial. **The readout did not fit its own recess** on a phone:
    "100.0000%" wanted 117 pixels in 92.

    And the CSS lesson, which cost three separate bugs: a custom property
    holding `min(100%, …)` looks reusable and is a trap. A percentage means the
    container's width in `width`, the parent's *font size* in `font-size`, and
    the element's own height in `translateY`. In one afternoon it collapsed the
    dial to zero height, stacked all four bezel numerals on top of each other,
    and rendered the hero number at 0.688 pixels. The dial's width is written
    once now and everything inside it sizes in `cqw` or a percentage of that
    box.

14. ~~**Life in Weeks, one instrument instead of a grid in a template**~~ —
    **done.** The grid was already good — a prior pass gave it a real shader,
    a birth-to-now gradient and a current week that visibly breathes — and
    that was exactly the problem: the four stat tiles, the date form and the
    facts list below it were still the site's original flat card, unrelated
    in colour and material to the picture they were reporting on.

    Every accent added is a colour the shader already uses, not a matching
    palette invented beside it — the same discipline Progress's register took
    from its dial. `--wk-young` and `--wk-old` are the exact sRGB values
    `weeks-grid.ts` mixes a lived week's colour from; `--wk-now` is the
    pulsing current week's own colour. The stat tiles became one seamed plate,
    the same move the Progress register made; "weeks lived" and "weeks left"
    each carry a hairline bar that always sums to a full width between them,
    even though the two live in separate tiles; the submit button and the
    Share button both carry the birth-to-now gradient as a fill rather than a
    flat colour; the facts list gets a small lit dot per line instead of a
    browser bullet.

    One addition reaches past the cards entirely: the page's own backdrop
    now carries a warm horizon at its foot that grows with how much of ninety
    years is behind the visitor, and is exactly zero before a date is typed —
    the grid's single claim, cool at birth and warm near now, made ambient
    rather than confined to 4,680 squares.

    The one real bug this pass found: the "weeks left" bar's fill and its own
    empty track were both close enough to the plate's own colour that the two
    measured as visually the same line — a bar that could not show where it
    ended. Decorative, so no contrast checker was ever going to catch it;
    caught by screenshotting it at a mid-life date and actually looking. Fixed
    with a lifted fill colour and the same inset top highlight the fill
    already carried, rather than by inventing a new hue.

15. ~~**Deep Time, lit by its own scenes**~~ — **done.** The gap here was
    the same shape as Life in Weeks': the good work had already happened —
    forty-four careful drawings, a five-world shader keyed to real geology,
    a layout that measures its own cards and re-lanes them — and it was all
    sitting behind a 116px thumbnail in a flat charcoal box with one plain
    white hairline, regardless of what was actually drawn inside it.

    `MOOD[title]` is a colour computed from each scene's own SVG rather than
    a palette chosen beside it: an area-weighted walk of every fill, six
    backdrop tones (`night`, `dusk`, `sky`, `deep`, `void`, and `pale` once
    it turned up doing the same job under a different name) excluded so a
    sky or a sea a scene merely happens under can never outvote the thing it
    is actually about. Printing all forty-four and reading them by eye found
    the two places the heuristic needed a hand: `pale` joining the exclusion
    list after it beat both the Wright Flyer and the first apes, and one
    documented override — the steam engine's frame really is more wooden by
    area than its own iron, but iron is the entire reason it has a scene.
    `check-time-art.mjs` now holds both guarantees directly rather than
    trusting them: every mood colour has to be found inside its own scene's
    markup, and re-deriving the set from nothing has to agree with what the
    module exports everywhere except that one named exception.

    The art itself grew from 116px to 172 at its widest, with the eleven
    major turning points larger again and a one-shot glow the instant one
    first centres in view, reusing the chime's own scroll observer rather
    than adding a second one. Two real bugs came out of building that:
    a `transform: scale()` step inside the glow's keyframes was overriding
    the card's own `translateX(-50%)` centring rather than combining with
    it — CSS animations replace the whole property, not just the part they
    mention — and the Great Oxidation Event sat 220px off-centre until the
    animation was rewritten to touch only `box-shadow`. And the bigger art
    narrowed the text column enough to hit a grid track that had always been
    a bare `1fr`: without `minmax(0, 1fr)` its implicit minimum is its own
    content's width, so a phone's side lane took one long word as licence to
    grow the whole page eight to sixty pixels past its own edge instead of
    wrapping. Neither was visible in a screenshot of the card that triggered
    it — one only showed up after the animation had already finished and
    settled somewhere else, the other only at exactly the viewport width
    that ran out of room.

16. Then reassess against the depth work in Phases 1–2 above.

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
