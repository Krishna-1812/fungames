/**
 * check-result-card — does the card you share actually fit?
 *
 * The card is built from strings a game hands it at runtime: a verdict, a sum
 * of money, a shape name. None of that is known at build time, and text that
 * does not fit does not error — it runs off the edge of a picture that is by
 * then already in somebody's message.
 *
 * So this renders one for every listed game, with strings chosen to be as
 * awkward as the games can plausibly produce, and measures what comes out.
 *
 *   1. Can every listed game produce a card at all? The card pulls colours
 *      from the registry and its drawing from `tile-art.ts`, and a game
 *      missing from either would throw at the worst possible moment.
 *   2. Does the text stay in its column, and out of the other blocks? The
 *      right of the card belongs to the illustration, and a two-line headline
 *      must not print through the line under it. The first version of this
 *      file measured only the first of those. Both are measured on the
 *      *painted* extent of the ink, which is the point: the layout picks its
 *      font size from an estimate of how wide a string will set, and that
 *      estimate is the thing under test.
 *   3. Is the text readable on the accent it landed on? Measured under the
 *      glyphs, not over the box they sit in — the mistake three checkers on
 *      this site have now made, so it is not made a fourth time.
 *   4. Does a stat row that does not fit get caught? The card drops the chip
 *      rather than throwing, because throwing in a browser kills the share; so
 *      catching it is this file's job.
 *   4b. And does each *wired* game's own worst case fit? The generic samples
 *      are cross-multiplied with every game, which tests the layout but not
 *      the copy. What actually went wrong in practice was a game passing a
 *      real string from its own data — "Contractualist", a position name it
 *      has always had — so `WORST` holds, per game, the longest thing that
 *      game can genuinely produce.
 *   5. Are the ids all prefixed? A card is rasterised alone most of the time
 *      but is also previewed inside a live page, next to tile art with ids of
 *      its own.
 *
 *   node scripts/check-result-card.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

/**
 * Every `new Resvg(...)` call below passes this. Without it, resvg falls back
 * to whatever "Arial, Helvetica, sans-serif" resolves to on the machine
 * actually running the check — real Arial on a dev machine that has it
 * installed, something else (wider, in practice) on a bare CI runner that
 * does not. That made every assertion in this file about whether text fits
 * pass locally and fail in CI, for a reason with nothing to do with any
 * actual layout bug. Arimo is Google's own metric-compatible substitute for
 * Arial — see scripts/fonts/README.md — loaded explicitly and with system
 * font discovery turned off, so the answer is the same everywhere.
 */
const FONT_DIR = fileURLToPath(new URL('./fonts/', import.meta.url))
const FONT = {
  loadSystemFonts: false,
  fontFiles: [`${FONT_DIR}Arimo-Regular.ttf`, `${FONT_DIR}Arimo-Bold.ttf`],
  sansSerifFamily: 'Arimo',
}

const { listedGames } = await import('../src/data/games.ts')
const { resultCardSvg, CARD, emWidth, layout, WIDTH_TOLERANCE } = await import('../src/lib/result-card.ts')
// Imported, not reimplemented. A second copy of the ink rule in here is
// exactly how the card's own copy drifted from what it was writing on.
const { pickInk } = await import('../src/lib/og-card.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const SITE = 'Fun Games'
const AVAIL = CARD.TEXT_RIGHT - 84

/** The ink the card chose, as a triple, straight from the card's own rule. */
const inkFor = (g) => {
  const hex = pickInk(g.accent, g.accent2).ink
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/* Strings as awkward as a game can plausibly hand it: a long verdict, a long
   sum, a decimal score. The point is not that these are the real strings —
   it is that the layout has to survive whatever shape of result a game has. */
const SAMPLES = [
  { headline: 'Utilitarian', sub: 'You pulled the lever 21 times out of 26.', stats: [
    { label: 'Lever', value: '21 / 26' },
    { label: 'Saved', value: '104' },
    { label: 'Runner-up', value: 'Kantian' },
  ] },
  { headline: '$99,999,996,700 spent', sub: 'Out of one hundred billion dollars, in an afternoon.', stats: [
    { label: 'Items', value: '27' },
    { label: 'Left', value: '0.004%' },
  ] },
  { headline: '8.7', sub: undefined, stats: [] },
  { headline: 'Absolutely not a robot', sub: 'Twelve checks, and the mouse never once moved in a straight line.', stats: [
    { label: 'Checks', value: '12' },
  ] },
]

/* The longest strings each wired game can actually hand the card.
 *
 * Taken from the branches in each page rather than invented: the longest
 * verdict name, the largest number that fits the game's own bounds, the
 * wordiest sentence its template can build. A generic sample cannot catch a
 * game whose own vocabulary is too wide for a chip. */
const WORST = {
  /* The longest card Universe Forecast can actually produce. The headline is
     always an eclipse — the lead picker prefers one over everything else, and a
     two-year window always holds several — so this is the longest eclipse name
     over the longest date over the longest of the card's own short lines.
     The first version of this entry used the feed's blurb instead, and this
     check is how I found out it does not fit; the page now writes a separate
     sentence for the card. */
  'universe-forecast': {
    headline: 'Penumbral lunar eclipse',
    sub: '17 September 2027, 07:14 UTC. The Earth’s shadow, half across it.',
    stats: [
      { label: 'From now', value: '22 months' },
      { label: 'Eclipses', value: '8' },
      { label: 'Events', value: '133' },
    ],
  },
  trolley: {
    headline: 'Virtue ethicist',
    sub: '96% of the time, over twenty-six levers. Then contractualist, at 92%.',
    stats: [
      { label: 'Pulled', value: '26 / 26' },
      { label: 'Saved', value: '104' },
      { label: 'Runs', value: '128' },
    ],
  },
  'steady-hand': {
    headline: 'Ordinarily human',
    sub: 'Freehand, one stroke each: square 100, spiral 100, circle 100, line 100.',
    stats: [
      { label: 'Steadiest', value: 'Square' },
      { label: 'Rating', value: '100%' },
      { label: 'Strokes', value: '9999' },
    ],
  },
  'spend-it': {
    headline: '$100,000,000,000 spent',
    sub: 'Mostly on a professional football team. $99,999,999,999 of it is still there.',
    stats: [
      { label: 'Things', value: '9,999,999' },
      { label: 'Kinds', value: '27' },
      { label: 'Left', value: '<0.01%' },
    ],
  },
  'rule-cascade': {
    headline: 'All 30 rules',
    sub: '9,999 keystrokes for a 120-character password that satisfies every rule at once. Attempt 99.',
    stats: [
      { label: 'Keystrokes', value: '9,999' },
      { label: 'Length', value: '120' },
      { label: 'Time', value: '59m 59s' },
    ],
  },
  overstimulated: {
    headline: '9,999,999 clicks',
    sub: '15 of 15 upgrades, in 59m 59s, before deciding that was enough. Session 99.',
    stats: [
      { label: 'Upgrades', value: '15 / 15' },
      { label: 'Minutes', value: '60' },
      { label: 'Per second', value: '99.9' },
    ],
  },
  'not-a-robot': {
    headline: 'Probably human',
    sub: '12 of 12 measurable channels looked like a person. 99 rejections along the way. Attempt 99.',
    stats: [
      { label: 'Human', value: '100%' },
      { label: 'Channels', value: '12 / 12' },
      { label: 'Time', value: '59m 59s' },
    ],
  },
  asteroid: {
    headline: '999 million megatonnes',
    sub: 'Kinshasa, Democratic Republic of the Congo. 8.1 billion people do not survive it.',
    stats: [
      { label: 'Burst at', value: '99.9 km' },
      { label: 'Fireball', value: '1,200 km' },
      { label: 'Quake', value: 'M12.4' },
    ],
  },
}

/** Every generic sample, plus the worst thing this particular game can say. */
const samplesFor = (g) => (WORST[g.slug] ? [...SAMPLES, WORST[g.slug]] : SAMPLES)

/* Half size. Every threshold in this file is in card units and every
   measurement is converted back, so the numbers do not move — and a quarter of
   the pixels is the difference between finishing inside the suite's budget and
   being killed by it. */
const SCALE = 0.5
const cache = new Map()

function render(card) {
  const key = JSON.stringify(card)
  const hit = cache.get(key)
  if (hit) return hit
  const img = new Resvg(resultCardSvg(card), {
    fitTo: { mode: 'width', value: Math.round(CARD.W * SCALE) },
    font: FONT,
  }).render()
  // `.pixels` allocates a fresh buffer on every read.
  const out = { px: img.pixels, W: img.width, H: img.height }
  cache.set(key, out)
  return out
}

/** Pixel column to card unit, and back. */
const toCard = (px) => px / SCALE
const toPx = (u) => u * SCALE

const games = listedGames()

/* ---- 1. every game can produce one --------------------------------------- */

console.log('\nevery listed game can produce a card')
{
  let bad = 0
  for (const g of games) {
    for (const s of samplesFor(g)) {
      try {
        const svg = resultCardSvg({ slug: g.slug, siteName: SITE, ...s })
        if (!svg.startsWith('<svg') || svg.length < 800) {
          fail(`${g.slug}: card is ${svg.length} chars`)
          bad++
        }
      } catch (e) {
        fail(`${g.slug} / "${s.headline.slice(0, 20)}": ${e.message}`)
        bad++
      }
    }
  }
  check(bad === 0, `all ${games.length} games × ${SAMPLES.length} shapes of result`)
}

/* ---- 2. the text stays in its column ------------------------------------- */

/* The layout picks a font size from an estimate of how wide a string sets.
   This renders the card twice — once whole, once with the accent alone — and
   takes the difference, which is exactly the ink. Anything past TEXT_RIGHT is
   text that has run under the illustration. */
console.log('\ntext stays out of the illustration')
{
  let bad = 0
  let worst = { x: 0, who: '' }
  for (const g of games) {
    for (const s of samplesFor(g)) {
      const full = render({ slug: g.slug, siteName: SITE, ...s })
      // The same card with nothing written on it: same background, same art.
      const bare = render({ slug: g.slug, siteName: SITE, headline: '', stats: [] })
      let maxX = 0
      for (let y = 0; y < full.H; y++)
        for (let x = 0; x < full.W; x++) {
          const i = (y * full.W + x) * 4
          const d =
            Math.abs(full.px[i] - bare.px[i]) +
            Math.abs(full.px[i + 1] - bare.px[i + 1]) +
            Math.abs(full.px[i + 2] - bare.px[i + 2])
          if (d > 40 && x > maxX) maxX = x
        }
      const maxU = Math.round(toCard(maxX))
      if (maxU > worst.x) worst = { x: maxU, who: `${g.slug} / ${s.headline.slice(0, 16)}` }
      if (maxU > CARD.TEXT_RIGHT) {
        fail(`${g.slug} / "${s.headline.slice(0, 22)}": ink reaches x=${maxU}, past ${CARD.TEXT_RIGHT}`)
        bad++
      }
    }
  }
  check(bad === 0, `nothing written reaches past x=${CARD.TEXT_RIGHT}`)
  ok(`furthest right is ${worst.who} at x=${worst.x}`)
}

/* ---- 2b. the blocks do not print through each other ---------------------- */

/* The first version of this measured how far right the ink reached and nothing
   about how far down, and passed a card whose two-line headline printed
   through the sub-line beneath it.
 *
 * The second version rendered each block on its own and compared bounding
 * boxes — which does not work, because removing the headline moves everything
 * under it, so the boxes compared were never the boxes the card draws.
 *
 * So the card declares its layout and this holds it to it: the declared boxes
 * must not overlap, and all the ink the card actually paints must land inside
 * their union. The second half is what stops the declaration being fiction. */
console.log('\nheadline, sub and stats keep to their own boxes')
{
  let bad = 0
  for (const g of games) {
    for (const s of samplesFor(g)) {
      const card = { slug: g.slug, siteName: SITE, ...s }
      const boxes = layout(card).boxes
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
            fail(`${g.slug} / "${s.headline.slice(0, 20)}": ${a.name} box overlaps ${b.name}`)
            bad++
          }
        }

      // Now the render, against those boxes plus the two fixed bits of chrome.
      const full = render(card)
      const bare = render({ slug: g.slug, siteName: SITE, headline: '', stats: [] })
      const allowed = [
        ...boxes,
        // The game name above and the site name below are on every card, so
        // they cancel in the difference — but a block that grew into them
        // would not, and this is where it would show.
        { name: 'eyebrow', x: 84, y: 96, w: AVAIL, h: 44 },
        { name: 'footer', x: 84, y: CARD.H - 70, w: AVAIL, h: 40 },
      ]
      const inside = (x, y) =>
        allowed.some(
          (b) =>
            x >= toPx(b.x - 3) &&
            x <= toPx(b.x + b.w + 3) &&
            y >= toPx(b.y - 3) &&
            y <= toPx(b.y + b.h + 3),
        )
      let stray = 0
      for (let y = 0; y < full.H; y++)
        for (let x = 0; x < toPx(CARD.TEXT_RIGHT); x++) {
          const i = (y * full.W + x) * 4
          const d =
            Math.abs(full.px[i] - bare.px[i]) +
            Math.abs(full.px[i + 1] - bare.px[i + 1]) +
            Math.abs(full.px[i + 2] - bare.px[i + 2])
          if (d > 60 && !inside(x, y)) stray++
        }
      // A quarter of the pixels, so a quarter of the tolerance.
      if (stray > 15) {
        fail(`${g.slug} / "${s.headline.slice(0, 20)}": ${stray} ink pixels outside every declared box`)
        bad++
      }
    }
  }
  check(bad === 0, 'the declared layout does not overlap, and the render stays inside it')
}

/* ---- 3. readable on the accent it landed on ------------------------------ */

/* Under the glyphs. Measuring over the box the text sits in is the mistake
   `check-art.mjs`, `check-icons.mjs` and `check-time-art.mjs` each made in
   turn, and it fails in a way that looks like a real result. */
console.log('\nreadable on whatever accent the registry hands it')
{
  let bad = 0
  let worst = { r: 99, who: '' }
  for (const g of games) {
    const s = SAMPLES[0]
    const full = render({ slug: g.slug, siteName: SITE, ...s })
    const bare = render({ slug: g.slug, siteName: SITE, headline: '', stats: [] })
    // Every pixel the text painted, against what was behind it.
    let sum = 0
    let n = 0
    let low = 99
    for (let y = 0; y < full.H; y++)
      for (let x = 0; x < toPx(CARD.TEXT_RIGHT); x++) {
        const i = (y * full.W + x) * 4
        const d =
          Math.abs(full.px[i] - bare.px[i]) +
          Math.abs(full.px[i + 1] - bare.px[i + 1]) +
          Math.abs(full.px[i + 2] - bare.px[i + 2])
        // Only fully-painted glyph interiors. Selecting them by "how much
        // did this pixel change" needs a delta that dark ink on a mid accent
        // never reaches — that version reported six cards as having no text
        // at all. The ink colour is knowable, so match against it.
        if (d < 24) continue
        const ink = inkFor(g)
        if (
          Math.abs(full.px[i] - ink[0]) + Math.abs(full.px[i + 1] - ink[1]) + Math.abs(full.px[i + 2] - ink[2]) >
          40
        )
          continue
        const c = contrast(
          lum(full.px[i], full.px[i + 1], full.px[i + 2]),
          lum(bare.px[i], bare.px[i + 1], bare.px[i + 2]),
        )
        sum += c
        n++
        if (c < low) low = c
      }
    if (n < 50) {
      fail(`${g.slug}: only ${n} solid text pixels — nothing is being written`)
      bad++
      continue
    }
    const mean = sum / n
    if (mean < worst.r) worst = { r: mean, who: g.slug }
    if (mean < 4.5) {
      fail(`${g.slug}: text averages ${mean.toFixed(1)}:1 against its own background`)
      bad++
    }
  }
  check(bad === 0, 'every card clears 4.5:1 under its own glyphs')
  ok(`weakest is ${worst.who} at ${worst.r.toFixed(1)}:1`)
}

/* ---- 4. an over-long stat row --------------------------------------------- */

/* The card drops what does not fit rather than throwing. Throwing was right
   while this was only ever rendered here, and wrong the moment a browser used
   it: the first game wired up passed "Contractualist" as a runner-up — a real
   name out of its own data — and the exception killed the share silently at
   exactly the moment somebody wanted it. So the card degrades, and refusing an
   over-long row is this file's job instead. */
console.log('\nan over-long stat row is dropped, and that is a failure here')
{
  const over = layout({
    slug: games[0].slug,
    siteName: SITE,
    headline: 'x',
    stats: [
      { label: 'Closest rival', value: 'Contractualist' },
      { label: 'Second closest', value: 'Utilitarian' },
      { label: 'Third', value: 'Virtue ethics' },
    ],
  })
  check(over.dropped > 0, 'a row wider than the column loses chips rather than overflowing')

  const fine = layout({
    slug: games[0].slug,
    siteName: SITE,
    headline: 'x',
    stats: [
      { label: 'Lever', value: '21 / 26' },
      { label: 'Saved', value: '104' },
      { label: 'Runs', value: '3' },
    ],
  })
  check(fine.dropped === 0, 'three ordinary stats still fit — the bar is not simply "no stats"')

  let bad = 0
  for (const g of games)
    for (const s of samplesFor(g)) {
      const L = layout({ slug: g.slug, siteName: SITE, ...s })
      if (L.dropped) {
        fail(`${g.slug} / "${s.headline.slice(0, 20)}": ${L.dropped} stat(s) would not fit`)
        bad++
      }
    }
  check(bad === 0, 'and nothing a game actually passes gets dropped')
}

/* ---- 5. ids --------------------------------------------------------------- */

console.log("\nno game's own worst sentence gets cut off")
{
  /* `wrapEm` ellipsises a sub-line that will not fit, which is right in
     general — a sentence that loses its last clause is still a sentence. It is
     not right for the copy a game actually writes, and the way it fails is
     ugly: Asteroid's worst case ended "2.4 million…", truncating a number,
     which the card's own rules call a lie. So the sentences are held to a
     length they survive rather than the ellipsis being trusted to be tidy. */
  let bad = 0
  for (const [slug, s] of Object.entries(WORST)) {
    const L = layout({ slug, siteName: SITE, ...s })
    const last = L.sub?.lines[L.sub.lines.length - 1] ?? ''
    if (last.endsWith('…')) {
      fail(`${slug}: "…${last.slice(-34)}" — the sentence is longer than the card`)
      bad++
    }
  }
  check(bad === 0, 'every wired game says the whole of what it means to say')
}

console.log('\nids')
{
  let bad = 0
  for (const g of games) {
    const svg = resultCardSvg({ slug: g.slug, siteName: SITE, ...SAMPLES[0] })
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    const seen = new Set()
    for (const id of ids) {
      // Either the card's own, or the tile drawing's, which prefixes by slug.
      if (!id.startsWith('rc-') && !id.startsWith(g.slug + '-')) {
        fail(`${g.slug}: id "${id}" is prefixed by neither "rc-" nor the slug`)
        bad++
      }
      if (seen.has(id)) {
        fail(`${g.slug}: id "${id}" appears twice in one card`)
        bad++
      }
      seen.add(id)
    }
    for (const m of svg.matchAll(/url\(#([^)]+)\)/g))
      if (!ids.includes(m[1])) {
        fail(`${g.slug}: url(#${m[1]}) points at nothing the card defines`)
        bad++
      }
  }
  check(bad === 0, 'every id is unique within its card and carries a prefix')
}

/* ---- 6. the width model ---------------------------------------------------- */

/* `emWidth` is the estimate the layout trusts. Rather than assert numbers at
   it, this renders single words and compares the painted width against what
   the model predicted — if the model drifts, the layout silently starts
   choosing sizes that do not fit. */
console.log('\nthe width estimate against what actually sets')
{
  const SIZE = 92
  let worstErr = 0
  let who = ''
  for (const word of ['Utilitarian', 'MMMM', 'illili', '$1,000,000', 'Absolutely']) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="200">` +
      `<rect width="1400" height="200" fill="#fff"/>` +
      `<text x="20" y="140" font-family="Arial, Helvetica, sans-serif" font-size="${SIZE}" ` +
      `font-weight="700" fill="#000">${word.replace(/&/g, '&amp;')}</text></svg>`
    const img = new Resvg(svg, { fitTo: { mode: 'width', value: 1400 }, font: FONT }).render()
    const px = img.pixels
    let maxX = 20
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) if (px[(y * img.width + x) * 4] < 128 && x > maxX) maxX = x
    const actual = (maxX - 20) / SIZE
    const est = emWidth(word)
    const err = Math.abs(actual - est) / actual
    if (err > worstErr) {
      worstErr = err
      who = `${word} — model ${est.toFixed(2)}em, actual ${actual.toFixed(2)}em`
    }
  }
  // A quarter is loose, deliberately: the model is a cheap approximation of a
  // font the renderer picks for itself, and the layout only needs it to be
  // right enough to choose a size. Test 2 is what proves the result fits.
  check(
    worstErr < WIDTH_TOLERANCE,
    `the width model is within ${(worstErr * 100).toFixed(0)}% of what sets, against a ` +
      `${(WIDTH_TOLERANCE * 100).toFixed(0)}% bar — worst: ${who}`,
  )
}

/* ---- output --------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const shown = games.slice(0, 8)
  const parts = shown.map((g, i) =>
    new Resvg(resultCardSvg({ slug: g.slug, siteName: SITE, ...SAMPLES[i % SAMPLES.length] }), {
      fitTo: { mode: 'width', value: 600 },
      font: FONT,
    }).render(),
  )
  const strip = parts
    .map(
      (p, i) =>
        `<image x="${(i % 2) * 600}" y="${Math.floor(i / 2) * p.height}" width="600" height="${p.height}" ` +
        `href="data:image/png;base64,${p.asPng().toString('base64')}"/>`,
    )
    .join('')
  const H = Math.ceil(shown.length / 2) * parts[0].height
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${H}">${strip}</svg>`, {
      fitTo: { mode: 'width', value: 1200 },
    })
      .render()
      .asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll result-card checks passed.')
process.exitCode = failures ? 1 : 0
