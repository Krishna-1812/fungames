/**
 * check-spend-art — are the Spend It product drawings actually product drawings?
 *
 * These are the one set of illustrations on the site that exist purely to be
 * looked at: they carry a whole card each, at ~110px, on a near-white shop
 * card. That makes the failure modes specific, and different from the icon
 * set's:
 *
 *   1. Does every item have a drawing, and every drawing an item? A product
 *      with no picture is a blank card; a picture nothing sells is dead weight.
 *   2. Does it use only the colours it declares? The palette is the drawing's
 *      own statement of intent, and a stray hex is either a typo or a colour
 *      nobody checked against the card.
 *   3. Is it visible on a near-white card? A pale product on a pale card is
 *      the one mistake this page cannot afford, and it is invisible in an
 *      editor with a grey backdrop.
 *   4. Is it a PICTURE, not a blob? This is the crux and the reason this
 *      checker exists rather than trusting the palette. A flat silhouette and
 *      a shaded, detailed object both "have ink"; only one of them has
 *      internal edges. The control below is a plain filled rounded rect: it
 *      must fail, or the measure is not measuring anything.
 *   5. Does it stay on its stage? Anything painted in the outer ring is
 *      clipped at render time, silently.
 *   6. Are any two the same picture? Thirty products that read as one blob
 *      each would pass every test above individually.
 *   7. Is it deterministic? A drawing that moves between renders means the
 *      server-rendered card and the client one disagree.
 *
 *   node scripts/check-spend-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { SPEND_ART } = await import('../src/lib/spend-art.ts')
const { ITEMS } = await import('../src/lib/spend-items.ts')

/** The real card colour these sit on — spend-it.astro's `.item` gradient. */
const CARD = '#fdfdfc'
/** The size the card actually renders them at. */
const SIZE = 110

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- colour ------------------------------------------------------------- */

const hex = (h) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

/* ---- rendering ---------------------------------------------------------- */

/**
 * One drawing at its real display size. The card colour goes into the SVG
 * rather than being composited afterwards: resvg returns PREMULTIPLIED alpha,
 * and multiplying by alpha a second time darkens every anti-aliased edge —
 * the exact mistake that once made check-icons report every icon as failing
 * contrast. Letting the renderer composite is both correct and shorter.
 */
function render(markup, px, { onCard = false } = {}) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 120 120">` +
    (onCard ? `<rect width="120" height="120" fill="${CARD}"/>` : '') +
    `${markup}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render()
  // .pixels is an allocating getter on the Rust side — read it exactly once.
  return { px: img.pixels, w: img.width, h: img.height }
}

/** A small RGBA thumbnail, for asking whether two drawings are one picture. */
function signature(img, cells = 12) {
  const out = new Float64Array(cells * cells * 4)
  const s = img.w / cells
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const acc = [0, 0, 0, 0]
      let k = 0
      for (let y = Math.floor(r * s); y < Math.floor((r + 1) * s); y++) {
        for (let x = Math.floor(c * s); x < Math.floor((c + 1) * s); x++) {
          const i = (y * img.w + x) * 4
          for (let ch = 0; ch < 4; ch++) acc[ch] += img.px[i + ch]
          k++
        }
      }
      for (let ch = 0; ch < 4; ch++) out[(r * cells + c) * 4 + ch] = acc[ch] / k / 255
    }
  }
  return out
}

const sigDist = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

/**
 * The share of a drawing's own ink that sits on an internal edge.
 *
 * Measured only under the drawing's own alpha, and only against neighbours
 * that are also ink — otherwise the silhouette's outer boundary alone scores
 * every flat blob as "structured", which is precisely the thing being tested
 * for. A shaded object has tone meeting tone on the inside; a silhouette does
 * not.
 */
function edgeFraction(cut, onCard) {
  const { w, h } = cut
  let inked = 0
  let edged = 0
  const L = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) {
    L[i] = lum(onCard.px[i * 4], onCard.px[i * 4 + 1], onCard.px[i * 4 + 2])
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (cut.px[i * 4 + 3] < 200) continue
      inked++
      let d = 0
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (cut.px[j * 4 + 3] < 200) continue // outer boundary: not internal structure
        d = Math.max(d, Math.abs(L[i] - L[j]))
      }
      if (d > 0.035) edged++
    }
  }
  return { cover: inked / (w * h), edge: inked ? edged / inked : 0 }
}

/* ---- run ---------------------------------------------------------------- */

const names = Object.keys(SPEND_ART)

console.log('\nevery product has a picture, every picture a product')
{
  const itemNames = ITEMS.map((i) => i.name)
  const missing = itemNames.filter((n) => !SPEND_ART[n])
  const orphans = names.filter((n) => !itemNames.includes(n))
  if (missing.length) fail(`no drawing for: ${missing.join(', ')}`)
  if (orphans.length) fail(`drawn but nothing sells it: ${orphans.join(', ')}`)
  check(
    missing.length === 0 && orphans.length === 0,
    `${names.length} drawings for ${itemNames.length} items`,
  )
}

console.log('\nevery colour is one the drawing declares')
{
  let bad = 0
  for (const k of names) {
    const declared = new Set([...SPEND_ART[k].palette, 'none'])
    const m = SPEND_ART[k].draw()
    for (const f of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      if (f[1].startsWith('url(')) continue
      if (!declared.has(f[1])) {
        bad++
        if (bad < 6) fail(`${k}: "${f[1]}" is not in its palette`)
      }
    }
    for (const c of SPEND_ART[k].palette) {
      if (!/^#[0-9a-fA-F]{6}$/.test(c)) {
        bad++
        fail(`${k}: palette entry "${c}" is not a 6-digit hex`)
      }
    }
  }
  check(bad === 0, 'no stray colours')
}

console.log('\nids are prefixed and unique across the whole set')
{
  const seen = new Map()
  let bad = 0
  for (const k of names) {
    const m = SPEND_ART[k].draw()
    const slug = k.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    for (const f of m.matchAll(/id="([^"]+)"/g)) {
      const id = f[1]
      if (!id.startsWith(slug + '-')) {
        bad++
        fail(`${k}: id "${id}" must start with "${slug}-" (all thirty inline into one document)`)
      }
      if (seen.has(id)) {
        bad++
        fail(`${k}: id "${id}" is already used by ${seen.get(id)}`)
      }
      seen.set(id, k)
    }
    for (const f of m.matchAll(/url\(#([^)]+)\)/g)) {
      if (!m.includes(`id="${f[1]}"`)) {
        bad++
        fail(`${k}: refers to #${f[1]}, which it does not define`)
      }
    }
  }
  check(bad === 0, 'every id is prefixed, unique, and resolves')
}

console.log('\nnothing painted outside the stage')
{
  const MARGIN = 0.06
  let bad = 0
  for (const k of names) {
    const img = render(SPEND_ART[k].draw(), 120)
    const edge = Math.round(120 * MARGIN)
    let ring = 0
    let ringPainted = 0
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const inRing = x < edge || y < edge || x >= img.w - edge || y >= img.h - edge
        if (!inRing) continue
        ring++
        if (img.px[(y * img.w + x) * 4 + 3] > 24) ringPainted++
      }
    }
    const frac = ringPainted / ring
    if (frac > 0.06) {
      bad++
      fail(`${k}: ${(frac * 100).toFixed(0)}% of the outer ${(MARGIN * 100).toFixed(0)}% ring is painted — it will clip`)
    }
  }
  check(bad === 0, 'every drawing stays inside its own frame')
}

console.log('\na picture, not a blob — and visible on a white card')
const sigs = {}
for (const k of names) {
  const markup = SPEND_ART[k].draw()
  const cut = render(markup, SIZE)
  const onCard = render(markup, SIZE, { onCard: true })
  sigs[k] = signature(render(markup, 96))

  const { cover, edge } = edgeFraction(cut, onCard)

  // Darkest solid patch against the card, so a pale product on a pale card
  // is caught. Judged on 2x2 windows that are inked right through: an
  // anti-aliased edge pixel is always partway to the card and would grade the
  // rasteriser rather than the drawing.
  const cardL = lum(...hex(CARD))
  let best = 0
  for (let y = 0; y < cut.h - 1; y++) {
    for (let x = 0; x < cut.w - 1; x++) {
      let solid = true
      let sum = 0
      for (let dy = 0; dy <= 1 && solid; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const i = ((y + dy) * cut.w + (x + dx)) * 4
          if (cut.px[i + 3] < 235) { solid = false; break }
          sum += lum(onCard.px[i], onCard.px[i + 1], onCard.px[i + 2])
        }
      }
      if (!solid) continue
      const c = (Math.max(sum / 4, cardL) + 0.05) / (Math.min(sum / 4, cardL) + 0.05)
      if (c > best) best = c
    }
  }

  const notes = []
  if (cover < 0.1) notes.push(`only ${(cover * 100).toFixed(0)}% ink — too small on the card`)
  if (cover > 0.72) notes.push(`${(cover * 100).toFixed(0)}% ink — it fills the whole stage`)
  if (edge < 0.1) notes.push(`only ${(edge * 100).toFixed(0)}% of its ink is on an internal edge — a silhouette, not a drawing`)
  if (best < 2.6) notes.push(`its strongest tone is only ${best.toFixed(2)}:1 on the card`)
  if (notes.length) fail(`${k.padEnd(18)} ${notes.join('; ')}`)
  else
    ok(
      `${k.padEnd(18)} ink ${(cover * 100).toFixed(0).padStart(2)}%  edges ${(edge * 100)
        .toFixed(0)
        .padStart(2)}%  darkest ${best.toFixed(1)}:1 — ${SPEND_ART[k].subject}`,
    )
}

{
  // The control. A plain filled rounded rectangle is exactly what "has plenty
  // of ink and no picture in it" looks like; if it clears the edge bar, the
  // bar is measuring nothing.
  const blob = `<rect x="20" y="24" width="80" height="72" rx="12" fill="#6b4423"/>`
  const { edge } = edgeFraction(render(blob, SIZE), render(blob, SIZE, { onCard: true }))
  check(edge < 0.1, `control: a flat filled rect scores ${(edge * 100).toFixed(1)}% edges and fails, as it must`)
}

console.log('\nno two products are the same picture')
{
  const ks = Object.keys(sigs)
  if (ks.length < 3) {
    ok(`only ${ks.length} drawings so far — distinctness needs a set`)
  } else {
    const pairs = []
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++)
        pairs.push({ d: sigDist(sigs[ks[i]], sigs[ks[j]]), a: ks[i], b: ks[j] })
    pairs.sort((x, y) => x.d - y.d)
    for (const q of pairs.slice(1, 4)) console.log(`        next: ${q.a} / ${q.b} at ${q.d.toFixed(2)}`)
    // An OUTLIER test, not a fixed floor — the same reasoning check-icons
    // writes out at length: the minimum of a larger sample drifts down whether
    // or not anything got worse, so a fixed bar becomes a treadmill as the set
    // grows. What matters is whether one pair stands out as much closer than
    // the general run of near-misses.
    const pack = pairs[Math.min(9, pairs.length - 1)].d
    console.log(`        tenth-closest ${pack.toFixed(2)}  over ${pairs.length} pairs`)
    check(
      pairs[0].d > 0.04 && pairs[0].d > pack * 0.62,
      `closest pair is ${pairs[0].a} / ${pairs[0].b} at ${pairs[0].d.toFixed(2)} (needs ${(pack * 0.62).toFixed(2)})`,
    )
  }
}

console.log('\ndeterministic, and nothing borrowed from a font')
{
  let bad = 0
  for (const k of names) {
    if (SPEND_ART[k].draw() !== SPEND_ART[k].draw()) {
      bad++
      fail(`${k}: draw() returns a different string each call`)
    }
  }
  const src = fs.readFileSync(new URL('../src/lib/spend-art.ts', import.meta.url), 'utf8')
  if (/\p{Extended_Pictographic}/u.test(src)) {
    bad++
    fail('spend-art.ts contains an emoji — everything here is drawn')
  }
  if (/<text[\s>]/.test(src)) {
    bad++
    fail('spend-art.ts uses <text> — these are drawings, and a font would not be embedded in the card')
  }
  check(bad === 0, 'every drawing is deterministic and drawn, not typed')
}

/* ---- a sheet to look at -------------------------------------------------- */

const sheetArg = process.argv.indexOf('--sheet')
if (sheetArg > -1) {
  const COLS = 6
  const CELL = 130
  const rows = Math.ceil(names.length / COLS)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${rows * CELL}">` +
    `<rect width="${COLS * CELL}" height="${rows * CELL}" fill="${CARD}"/>` +
    names
      .map((k, i) => {
        const x = (i % COLS) * CELL + 5
        const y = Math.floor(i / COLS) * CELL + 5
        return `<svg x="${x}" y="${y}" width="${CELL - 10}" height="${CELL - 10}" viewBox="0 0 120 120">${SPEND_ART[
          k
        ].draw()}</svg>`
      })
      .join('') +
    '</svg>'
  fs.writeFileSync(
    process.argv[sheetArg + 1],
    new Resvg(svg, { fitTo: { mode: 'width', value: COLS * CELL } }).render().asPng(),
  )
  console.log(`\nsheet written to ${process.argv[sheetArg + 1]}`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall spend-art checks passed\n')
process.exit(failures ? 1 : 0)
