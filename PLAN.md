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
| **Fusion** | Effectively dead without the Cloudflare worker deployed — the local recipe tree is tiny and runs out in a minute. | **Medium (blocked)** |
| **Spend It** | Competent clone. Emoji instead of product images is the main tell. Receipt endgame is good. | **Medium** |
| **Steady Hand** | A 20-second toy with one challenge. The genre works (Draw a Perfect Circle) but needs a suite. | **Medium** |
| **Scale** | Draws *circles* for a proton, a whale and a galaxy. The whole genre depends on illustration; without it the page means nothing. | **Medium (art-gated)** |
| **Deep Time** | Same problem. Currently a Wikipedia list on a gradient. The events deserve pictures. | **Medium (art-gated)** |
| **Ambient Mix** | Quietly the most *finished* thing here. Twelve real synthesised layers. Just needs presets and a shareable mix. | **Medium** |
| **Paper Folds** | A fact, not a game. You press one button 42 times. | **Low** |
| **Progress** | A widget. Look once, feel briefly bad, leave. That's the whole design and it's fine. | **Low (fine as-is)** |
| **Life in Weeks** | Same. Look once, feel dread, leave. Legitimately complete. | **Low (fine as-is)** |

---

## The plan, in phases

Ordered by value per hour, not by what's most fun to build.

### Phase 1 — Content depth (the actual problem) — **four of five done**

Rule Cascade, Trolley, Powder and From Memory are done, each with a checker
behind it. **Fusion is not**, and is still blocked on the same thing it was
blocked on before: the local recipe tree is the fallback for a Cloudflare Worker
that is not deployed, so the work is worth doing but it is a different job.

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
- **Fusion → a much larger local recipe tree** so it's playable without the worker,
  plus discovery milestones. **Still outstanding** — the only Phase 1 item not done.

### Phase 2 — Goals for the sandboxes — **two of four done**

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
- **Ambient Mix: presets** ("Thunderstorm", "3am office", "Unbearable") and a
  shareable mix code in the URL.
- **Steady Hand → a suite**: straight line, perfect circle, square, spiral, with a
  combined "steadiness rating."

### Phase 3 — Kill the emoji, build real art

The credibility fix. This is genuinely laborious, and honest about limits: I can
produce good geometric/line-art SVG, not Neal's hand-drawn charm.

- **15 bespoke tile illustrations** — each with its own composition and its own
  lettering treatment. No shared template.
- **Drawn icons replacing emoji** in Spend It (30 items), Ambient Mix (12 layers),
  Paper Folds (19 milestones).
- **Illustrated scenes for Trolley** — the tracks, the trolley, the people, drawn
  with actual character.
- **Illustrated objects for Scale and Deep Time** — this is what unlocks both of
  those games' entire ceiling.

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
