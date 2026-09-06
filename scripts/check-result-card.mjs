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
 *      has to not print through the line under it. The first version of this
 *      file measured only the first of those.
 *
 *      Also: the right of the card belongs to the
 *      illustration. This measures the *painted* extent of the ink, which is
 *      the point: the layout picks its font size from an estimate of how wide
 *      a string will set, and the estimate is the thing under test.
 *   3. Is the text readable on the accent it landed on? Measured under the
 *      glyphs, not over the box they sit in — the mistake three checkers on
 *      this site have now made, so it is not made a fourth time.
 *   4. Does a stat row that does not fit get refused? A card that silently
 *      slides a stat under the illustration looks like a rendering bug.
 *   5. Are the ids all prefixed? A card is rasterised alone most of the time
 *      but is also previewed inside a live page, next to tile art with ids of
 *      its own.
 *
 *   node scripts/check-result-card.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { listedGames } = await import('../src/data/games.ts')
const { resultCardSvg, CARD, emWidth, layout } = await import('../src/lib/result-card.ts')
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

function render(card, scale = 1) {
  const img = new Resvg(resultCardSvg(card), {
    fitTo: { mode: 'width', value: Math.round(CARD.W * scale) },
  }).render()
  // `.pixels` allocates a fresh buffer on every read.
  return { px: img.pixels, W: img.width, H: img.height }
}

const games = listedGames()

/* ---- 1. every game can produce one --------------------------------------- */

console.log('\nevery listed game can produce a card')
{
  let bad = 0
  for (const g of games) {
    for (const s of SAMPLES) {
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
    for (const s of SAMPLES) {
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
      if (maxX > worst.x) worst = { x: maxX, who: `${g.slug} / ${s.headline.slice(0, 16)}` }
      if (maxX > CARD.TEXT_RIGHT) {
        fail(`${g.slug} / "${s.headline.slice(0, 22)}": ink reaches x=${maxX}, past ${CARD.TEXT_RIGHT}`)
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
    for (const s of SAMPLES) {
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
        allowed.some((b) => x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3)
      let stray = 0
      for (let y = 0; y < full.H; y++)
        for (let x = 0; x < CARD.TEXT_RIGHT; x++) {
          const i = (y * full.W + x) * 4
          const d =
            Math.abs(full.px[i] - bare.px[i]) +
            Math.abs(full.px[i + 1] - bare.px[i + 1]) +
            Math.abs(full.px[i + 2] - bare.px[i + 2])
          if (d > 60 && !inside(x, y)) stray++
        }
      if (stray > 60) {
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
      for (let x = 0; x < CARD.TEXT_RIGHT; x++) {
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
    if (n < 200) {
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

/* ---- 4. a stat row that does not fit is refused -------------------------- */

console.log('\nan over-long stat row is refused, not hidden')
{
  let threw = false
  try {
    resultCardSvg({
      slug: games[0].slug,
      siteName: SITE,
      headline: 'x',
      stats: [
        { label: 'Closest rival', value: 'Contractualist' },
        { label: 'Second closest', value: 'Utilitarian' },
        { label: 'Third', value: 'Virtue ethics' },
      ],
    })
  } catch {
    threw = true
  }
  check(threw, 'a stat row wider than the column throws rather than sliding under the art')
  // …and the bar is one real results can clear.
  let fits = true
  try {
    resultCardSvg({
      slug: games[0].slug,
      siteName: SITE,
      headline: 'x',
      stats: [
        { label: 'Lever', value: '21 / 26' },
        { label: 'Saved', value: '104' },
        { label: 'Runner-up', value: 'Kantian' },
      ],
    })
  } catch {
    fits = false
  }
  check(fits, 'three ordinary stats still fit — the bar is not simply "no stats"')
}

/* ---- 5. ids --------------------------------------------------------------- */

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
    const img = new Resvg(svg, { fitTo: { mode: 'width', value: 1400 } }).render()
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
  check(worstErr < 0.25, `the width model is within ${(worstErr * 100).toFixed(0)}% — worst: ${who}`)
}

/* ---- output --------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const shown = games.slice(0, 8)
  const parts = shown.map((g, i) =>
    new Resvg(resultCardSvg({ slug: g.slug, siteName: SITE, ...SAMPLES[i % SAMPLES.length] }), {
      fitTo: { mode: 'width', value: 600 },
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
