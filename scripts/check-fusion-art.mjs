/**
 * check-fusion-art — can you tell what a Fusion element is, at the size it
 * actually renders, on both of the backgrounds it actually renders on?
 *
 * A Fusion element appears twice: inline in a light draggable pill on the
 * board, and again in a dark tray chip. That is the whole difficulty. A
 * drawing tuned to look good on one of them can vanish on the other, and
 * nobody notices until they scroll the tray.
 *
 * What it asks:
 *   1. Does every element in the recipe tree have a drawing, and every drawing
 *      belong to the tree? An element with no picture falls back to a blank
 *      space in a pill; a drawing nothing can make is dead weight.
 *   2. Is every colour a PALETTE entry? The palette is mid-tone on purpose so
 *      one drawing works on the light tile and the dark chip both; a colour
 *      outside it is exactly the thing that disappears on one of the two.
 *   3. At 20px, on BOTH backgrounds, is there enough ink to see and enough
 *      hole to read?
 *   4. Are any two the same picture? Thirty-nine drawings of "some stuff" is
 *      the obvious failure mode for a set that includes Dust, Ash, Sand, Mud
 *      and Charcoal.
 *   5. Deterministic, no emoji, no text elements, no hairlines.
 *
 *   node scripts/check-fusion-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { FUSION_ART } = await import('../src/lib/fusion-art.ts')
const { PALETTE } = await import('../src/lib/icons.ts')
const { RECIPES } = await import('../src/lib/fusion-recipes.js')
const { SEED } = await import('../src/lib/fusion-state.js')

/** The two real backgrounds, read off fusion.astro's own CSS. */
const SURFACES = [
  { name: 'board pill', bg: '#f0ebfb', ink: '#1a1533' },
  { name: 'tray chip', bg: '#2b2456', ink: '#ffffff' },
]
/** The size the pill actually renders it at. */
const SIZE = 20

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const hex = (h) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

function render(markup, surface, px, { onBg = false } = {}) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" ` +
    `color="${surface.ink}">` +
    (onBg ? `<rect width="24" height="24" fill="${surface.bg}"/>` : '') +
    `${markup}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render()
  // Allocating getter on the Rust side — read it once.
  return { px: img.pixels, w: img.width, h: img.height }
}

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

/* ---- the tree this has to cover ----------------------------------------- */

const treeNames = [...new Set([...SEED.map((s) => s.text), ...RECIPES.map((r) => r[2])])]
const names = Object.keys(FUSION_ART)

console.log('\nevery element in the tree has a picture')
{
  const missing = treeNames.filter((n) => !FUSION_ART[n])
  const orphans = names.filter((n) => !treeNames.includes(n))
  if (missing.length) fail(`no drawing for: ${missing.join(', ')}`)
  if (orphans.length) fail(`drawn but unreachable: ${orphans.join(', ')}`)
  check(missing.length === 0 && orphans.length === 0, `${names.length} drawings for ${treeNames.length} elements`)
}

console.log('\nevery colour is a palette entry, nothing is a hairline')
{
  const allowed = new Set([...Object.values(PALETTE), 'currentColor', 'none'])
  let bad = 0
  for (const k of names) {
    const m = FUSION_ART[k].draw()
    for (const f of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      if (f[1].startsWith('url(')) continue
      if (!allowed.has(f[1])) {
        bad++
        if (bad < 6) fail(`${k}: "${f[1]}" is not in PALETTE`)
      }
    }
    for (const w of m.matchAll(/stroke-width="([\d.]+)"/g)) {
      if (Number(w[1]) < 2.2) {
        bad++
        if (bad < 6) fail(`${k}: stroke-width ${w[1]} is a hairline at ${SIZE}px`)
      }
    }
    for (const c of m.matchAll(/\b(?:cx|cy|x|y)="(-?[\d.]+)"/g)) {
      const v = Number(c[1])
      if (v < -3 || v > 27) {
        bad++
        if (bad < 6) fail(`${k}: a coordinate at ${v} is off the 24-unit grid`)
      }
    }
  }
  check(bad === 0, 'every fill is a palette entry and every anchor is on the grid')
}

console.log(`\nreadable at ${SIZE}px, on the light pill AND the dark chip`)
const sigs = {}
for (const k of names) {
  const markup = FUSION_ART[k].draw()
  sigs[k] = signature(render(markup, SURFACES[0], 96))
  const notes = []
  let coverNote = ''
  for (const surface of SURFACES) {
    const cut = render(markup, surface, SIZE)
    const on = render(markup, surface, SIZE, { onBg: true })
    const bgL = lum(...hex(surface.bg))

    let inked = 0
    for (let i = 0; i < cut.px.length / 4; i++) if (cut.px[i * 4 + 3] > 90) inked++
    const cover = inked / (cut.w * cut.h)

    // Judged on 2x2 windows inked right through: an anti-aliased edge is
    // always partway to the background and would grade the rasteriser.
    let worst = Infinity
    for (let y = 0; y < on.h - 1; y++) {
      for (let x = 0; x < on.w - 1; x++) {
        let solid = true
        let sum = 0
        for (let dy = 0; dy <= 1 && solid; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const i = ((y + dy) * on.w + (x + dx)) * 4
            if (cut.px[i + 3] < 235) { solid = false; break }
            sum += lum(on.px[i], on.px[i + 1], on.px[i + 2])
          }
        }
        if (!solid) continue
        const c = contrast(sum / 4, bgL)
        if (c < worst) worst = c
      }
    }
    const allEdge = worst === Infinity
    if (allEdge) worst = 0

    if (cover < 0.1) notes.push(`${surface.name}: only ${(cover * 100).toFixed(0)}% ink`)
    if (cover > 0.66) notes.push(`${surface.name}: ${(cover * 100).toFixed(0)}% ink — a blob`)
    if (allEdge) notes.push(`${surface.name}: nothing in it is solid`)
    else if (worst < 2.4) notes.push(`${surface.name}: faintest ink ${worst.toFixed(2)}:1`)
    if (surface === SURFACES[0]) coverNote = `ink ${(cover * 100).toFixed(0).padStart(2)}%  faintest ${worst.toFixed(1)}:1`
  }
  if (notes.length) fail(`${k.padEnd(12)} ${notes.join('; ')}`)
  else ok(`${k.padEnd(12)} ${coverNote} — ${FUSION_ART[k].subject}`)
}

console.log('\nno two elements are the same picture')
{
  const ks = Object.keys(sigs)
  // The outlier test compares the closest pair with the tenth-closest, so it
  // says nothing at all until there are more than ten pairs to rank.
  if (ks.length < 12) {
    ok(`only ${ks.length} drawings so far — the outlier test needs a set to be an outlier of`)
  } else {
    const pairs = []
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++)
        pairs.push({ d: sigDist(sigs[ks[i]], sigs[ks[j]]), a: ks[i], b: ks[j] })
    pairs.sort((x, y) => x.d - y.d)
    for (const q of pairs.slice(1, 4)) console.log(`        next: ${q.a} / ${q.b} at ${q.d.toFixed(2)}`)
    const pack = pairs[Math.min(9, pairs.length - 1)].d
    console.log(`        tenth-closest ${pack.toFixed(2)}  over ${pairs.length} pairs`)
    // Outlier test, not a fixed floor — see the long note in check-icons.mjs
    // for why a fixed bar becomes a treadmill as a set grows.
    check(
      pairs[0].d > 0.045 && pairs[0].d > pack * 0.66,
      `closest pair is ${pairs[0].a} / ${pairs[0].b} at ${pairs[0].d.toFixed(2)} (needs ${(pack * 0.66).toFixed(2)})`,
    )
  }
}

console.log('\ndeterministic, drawn rather than typed')
{
  let bad = 0
  for (const k of names) {
    if (FUSION_ART[k].draw() !== FUSION_ART[k].draw()) {
      bad++
      fail(`${k}: draw() returns a different string each call`)
    }
  }
  const src = fs.readFileSync(new URL('../src/lib/fusion-art.ts', import.meta.url), 'utf8')
  if (/\p{Extended_Pictographic}/u.test(src)) {
    bad++
    fail('fusion-art.ts contains an emoji — the whole point of this file is that it does not')
  }
  // Scanned on the drawn markup, not the source: the rule stated in this
  // file's own doc comment ("no <text>") otherwise matches itself.
  const drawn = names.map((k) => FUSION_ART[k].draw()).join('')
  if (/<text[\s>]/.test(drawn)) {
    bad++
    fail('a drawing uses <text> — these are pictures, and a font would not be embedded in the pill')
  }
  check(bad === 0, 'every drawing is deterministic and drawn')
}

/* ---- a sheet to look at -------------------------------------------------- */

const sheetArg = process.argv.indexOf('--sheet')
if (sheetArg > -1) {
  const COLS = 8
  const CELL = 64
  const rows = Math.ceil(names.length / COLS)
  const band = (surface, y0) =>
    `<rect y="${y0}" width="${COLS * CELL}" height="${rows * CELL}" fill="${surface.bg}"/>` +
    names
      .map((k, i) => {
        const x = (i % COLS) * CELL + CELL / 2 - 20
        const y = y0 + Math.floor(i / COLS) * CELL + CELL / 2 - 20
        return `<svg x="${x}" y="${y}" width="40" height="40" viewBox="0 0 24 24" color="${surface.ink}">${FUSION_ART[
          k
        ].draw()}</svg>`
      })
      .join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${rows * CELL * 2}">` +
    band(SURFACES[0], 0) +
    band(SURFACES[1], rows * CELL) +
    '</svg>'
  fs.writeFileSync(
    process.argv[sheetArg + 1],
    new Resvg(svg, { fitTo: { mode: 'width', value: COLS * CELL } }).render().asPng(),
  )
  console.log(`\nsheet written to ${process.argv[sheetArg + 1]}`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall fusion-art checks passed\n')
process.exit(failures ? 1 : 0)
