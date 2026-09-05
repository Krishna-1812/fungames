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

### Phase 1 — Content depth (the actual problem)

No new rendering. Just far more, far better *stuff*.

- **Rule Cascade → 30+ rules**, including at least three *interactive* ones in the
  spirit of Neal's chess puzzle: a rule whose answer changes live (a countdown you
  must keep current), a rule that fights back (something that eats characters), and
  a sacrifice rule that permanently costs you.
- **Trolley → 26 dilemmas**, escalating from earnest to deranged, keeping the
  ethical-position scoring (which is genuinely better than Neal's fake percentages).
- **Powder → 30+ elements** with a **discovery log**: "You've found 14 of 38
  reactions." Every new reaction is a small event. This turns a toy into a game
  with almost no new engine work.
- **From Memory → 16 prompts.**
- **Fusion → a much larger local recipe tree** so it's playable without the worker,
  plus discovery milestones.

### Phase 2 — Goals for the sandboxes

- **Orbit: challenge mode.** "Achieve a stable orbit for 30 seconds." "Build a
  binary system." "Slingshot a moon out of the system without collisions."
  "Survive 60 seconds with 50 bodies." Plus a persistent best.
- **Powder: scenario challenges** on top of the discovery log.
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

1. **Asteroid Launcher** — flagship. Hardest, best, most obviously professional.
2. **I'm Not a Robot** — cheap, funny, the tonal opposite. Proves range.
3. **The Auction Game** — a real game loop, which the site currently lacks entirely.
4. Then reassess against the depth work in Phases 1–2 above.

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
