# Paper & Ink — the design rules

Every page built on `layouts/Paper.astro` (the homepage, and every game in the
shared `layouts/GameShell.astro`) follows these. `scripts/check-paper.mjs`
enforces the ones that can be checked mechanically.

## Principles

1. **Paper ground.** The page is warm off-white `--paper`; cards are white
   `--card` on it. Never a pure-white page, never dark mode by default.
2. **Colour comes in whole blocks.** Orange, amber, sky, red, sun and ink are
   full-card fills with ink text, `--r-lg` (24px) corners and
   `--shadow-block`. No tints, glows, neon or decorative gradients. The one
   exception is the **marker** — the orange-to-coral highlighter — used
   behind one phrase, once per page. (Game cover art keeps its own colours;
   it is a picture, not chrome.)
3. **Pills for action.** Every button and control is a pill. Primary is solid
   ink (`.pill--ink`); the hero action is `.pill--hero` — uppercase, 800,
   with an arrow and `--shadow-pill`; secondary is outlined (`.pill--line`).
4. **Two voices.** Fraunces for every statement or headline
   (`'SOFT' 0, 'WONK' 1, 'opsz' 144`, weight 600, -0.028em, line-height 0.94,
   1.18 when it carries the marker). Italic `.wonk` is the signature emphasis
   for one word. Zalando Sans for everything that is information — including
   every number and score (`.num`: bold 700, -0.04em, proportional figures).
5. **Motion is typographic.** Headlines rise from behind a mask, blocks settle
   as one object, numbers roll like an odometer. **Nothing arrives card by
   card with an index delay** — the only per-index stagger on the site is the
   footer wordmark's letters, because that is type.
6. **Finished without JavaScript.** Every hidden or animated state is armed by
   a class a script adds (`html.js`, `html.play`). base.css alone is the
   finished page.
7. **Reduced motion switches motion off, not down.** `play` is never added,
   and a blanket `@media (prefers-reduced-motion: reduce)` kills every
   animation and transition. Everything still works and looks finished.

## Colour

| Use | Token |
|---|---|
| Page / inset / pressed | `--paper` `--paper2` `--paper3` |
| Card | `--card` |
| Text | `--ink` · `--ink2` (secondary) · `--ink3` (metadata; the contrast floor — never on `--paper2`) |
| Text on ink | `--ink-paper` |
| Block fills **only** | `--orange` `--amber` `--sky` `--red` `--sun` |
| Coloured text on paper/card | `--t-orange` `--t-red` `--t-blue` `--t-amber` `--t-green` |

Text on any block colour is ink — never `--ink2`, never paper. Never put
orange, amber or sky text on paper. Colour is never the only signal: pair it
with a sign (✓ ✗ ↑ ↓) or a label.

## Motion

Easings: `--ease` (arrivals), `--spring` (playful overshoot), `--glide`
(settle), `--ease-io` (exits). Durations 620 / 380 / 200ms. Animate only
transform, opacity, clip-path, background-size and font-variation-settings.

| Effect | How to use it |
|---|---|
| Mask reveal | `data-reveal="lines"` on a headline; each line a `.mask-line` with `--line:n` |
| Rule draw | `<hr class="rule-line" data-reveal>` |
| Wipe | `data-reveal="wipe"` on the wrapper, the clip on its child `.wipe` |
| Marker draw | `<span class="marker" data-draw>` — once per page |
| Springy letters | `data-springy` on the hero headline |
| Pill / card flood | automatic on `.pill` and `.gcard` |
| Odometer | `data-odo="123"`, or `roll(el, text)` from `lib/motion.ts` |
| Blocks settle | `data-settle` on a colour block |
| Decode | `data-decode` on a small uppercase label |
| Confetti | `data-confetti` on a primary CTA, or `confetti(x, y)` |

## The game shell

A game page wraps its board in `<GameShell slug labels initial>` with a
`howto` slot, and talks to the frame only through `createShell()` from
`lib/game-shell.ts`: `setScore/setLevel/setMoves`, `considerBest`,
`pop`/`shake`, `levelUp`, `win`/`lose`. Sound is off by default. `P` pauses;
both panels are native `<dialog>`s, so Esc and the focus trap come free, and
focus returns to whatever opened them.
