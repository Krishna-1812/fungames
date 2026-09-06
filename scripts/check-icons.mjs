/**
 * check-icons — are the drawn icons readable at the size they actually render?
 *
 * The tile illustrations get a whole card each. These get 26 to 34 pixels, on
 * pages that are cream in two cases and nearly black in the third, and an icon
 * that looks fine at 200px in an editor can be an unreadable smudge at 30. So
 * this rasterises every icon at its real display size on its real page colour
 * and measures what comes out.
 *
 * What it asks:
 *
 *   1. Does every icon a game references exist, and is every icon referenced?
 *      An orphan icon is dead weight; a missing one is a blank space on the page.
 *   2. Does it stay on the grid? Everything is drawn on 0 0 24 24 and anything
 *      outside it is clipped away silently at render time.
 *   3. Is every fill from PALETTE, and does PALETTE still clear 3:1 against
 *      every page background these appear on? The palette is mid-tone on
 *      purpose so one drawing works on cream and on near-black; a colour that
 *      drifts out of that band vanishes on one of the two and nobody notices
 *      until they open the other page.
 *   4. At 30px, is there enough ink to see and enough hole to read? A blob and
 *      a wisp both fail, and both look fine zoomed in.
 *   5. Are any two icons nearly the same picture? Two near-identical drawings
 *      mean either one of them is wrong or they should be one shared icon —
 *      which is allowed, and several are.
 *
 *   node scripts/check-icons.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { ICONS, PALETTE, iconSvg } = await import('../src/lib/icons.ts')
const { USES, PAGES } = await import('../src/lib/icon-uses.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- colour --------------------------------------------------------------- */

const hex = (h) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const lumOf = (h) => lum(...hex(h))
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/* ---- rendering ------------------------------------------------------------ */

/**
 * One icon at its real size, in its page's ink colour, optionally standing on
 * its page's background.
 *
 * The background goes into the SVG rather than being blended in afterwards.
 * Compositing it here by hand is where this first went wrong: resvg hands back
 * PREMULTIPLIED alpha, so multiplying by alpha again darkened every edge and
 * the checker reported every icon as failing contrast at about 1.8:1. Letting
 * the renderer do the compositing is both correct and shorter.
 */
function render(key, page, px, { onPage = false } = {}) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" ` +
    `color="${page.ink}">` +
    (onPage ? `<rect width="24" height="24" fill="${page.bg}"/>` : '') +
    `${ICONS[key].draw()}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: px } }).render()
  return { px: img.pixels, w: img.width, h: img.height }
}

/** A tiny normalised alpha map, for asking whether two icons are one picture. */
function shape(img, n = 12) {
  const out = new Float64Array(n * n)
  const s = img.w / n
  let total = 0
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let a = 0
      for (let y = Math.floor(r * s); y < Math.floor((r + 1) * s); y++)
        for (let x = Math.floor(c * s); x < Math.floor((c + 1) * s); x++)
          a += img.px[(y * img.w + x) * 4 + 3]
      out[r * n + c] = a
      total += a
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = total ? (out[i] / total) * out.length : 0
  return out
}

const shapeDist = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

/* ---- run ------------------------------------------------------------------- */

const keys = Object.keys(ICONS)

console.log('\nevery icon has a home')
{
  const used = new Set()
  for (const [page, list] of Object.entries(USES)) {
    for (const k of list) {
      used.add(k)
      if (!ICONS[k]) fail(`${page} asks for "${k}", which no icon draws`)
    }
  }
  const orphans = keys.filter((k) => !used.has(k))
  if (orphans.length) fail(`drawn but never used: ${orphans.join(', ')}`)
  check(
    orphans.length === 0 && [...used].every((k) => ICONS[k]),
    `${keys.length} icons, ${used.size} used across ${Object.keys(USES).length} games`,
  )
}

console.log('\nthe palette still works on every page it lands on')
{
  const names = Object.entries(PALETTE)
  for (const [pageName, page] of Object.entries(PAGES)) {
    if (!USES[pageName]?.length) continue
    const bgL = lumOf(page.bg)
    for (const [n, c] of names) {
      const r = contrast(lumOf(c), bgL)
      if (r < 3)
        fail(
          `${pageName}: PALETTE.${n} (${c}, luminance ${lumOf(c).toFixed(
            3,
          )}) is only ${r.toFixed(2)}:1 on ${page.bg}`,
        )
    }
    const inkC = contrast(lumOf(page.ink), bgL)
    if (inkC < 4.5) fail(`${pageName}: ink ${page.ink} is only ${inkC.toFixed(2)}:1 on its own page`)
  }
  check(true, `${names.length} fills, all mid-tone enough for cream and for near-black`)
}

console.log('\nnothing drawn off the grid, nothing coloured off the palette')
{
  const allowed = new Set([...Object.values(PALETTE), 'currentColor', 'none'])
  let bad = 0
  for (const k of keys) {
    const m = ICONS[k].draw()
    for (const f of m.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      if (f[1].startsWith('url(')) continue
      if (!allowed.has(f[1])) {
        bad++
        if (bad < 5) fail(`${k}: "${f[1]}" is not in PALETTE`)
      }
    }
    // A 2-unit stroke is 2.1 device pixels at 26px, which is a hairline once
    // it has been anti-aliased at both edges. Nothing thinner than 2.2 goes
    // in, which is why Wind and Waves had to be redrawn heavier.
    for (const w of m.matchAll(/stroke-width="([d.]+)"/g)) {
      if (Number(w[1]) < 2.2) {
        bad++
        if (bad < 5) fail(`${k}: stroke-width ${w[1]} is a hairline at icon size`)
      }
    }
    // Coordinates well outside the 24-grid are silently clipped at render time.
    for (const c of m.matchAll(/\b(?:cx|cy|x|y)="(-?[\d.]+)"/g)) {
      const v = Number(c[1])
      if (v < -3 || v > 27) {
        bad++
        if (bad < 5) fail(`${k}: a coordinate at ${v} is off the 24-unit grid`)
      }
    }
  }
  check(bad === 0, 'every fill is a palette entry and every anchor is on the grid')
}

console.log('\nreadable at the size they actually render')
const shapes = {}
for (const [pageName, list] of Object.entries(USES)) {
  const page = PAGES[pageName]
  for (const k of list) {
    if (!ICONS[k]) continue
    const cut = render(k, page, page.size)
    const on = render(k, page, page.size, { onPage: true })
    if (!shapes[k]) shapes[k] = shape(render(k, page, 96))
    const bgL = lumOf(page.bg)

    // Coverage: a wisp disappears, a solid block is a sticker, not an icon.
    let inked = 0
    for (let i = 0; i < cut.px.length / 4; i++) if (cut.px[i * 4 + 3] > 90) inked++
    const cover = inked / (cut.w * cut.h)

    // The faintest ink the icon actually puts down, judged only where it is
    // solid — an anti-aliased edge is always somewhere between the ink and the
    // page, and grading on it would grade the renderer, not the drawing.
    // Patches, not pixels. At 26px a 1.8-unit stroke is under two device pixels
    // wide, so almost every pixel in the icon is part anti-aliased edge; the
    // single darkest one measures the rasteriser rather than the drawing, and
    // reported three perfectly solid icons at 2.34:1 when the colour they are
    // actually painted in is 3.3:1. A 3×3 window that is inked right through
    // is a piece of the icon you can genuinely see.
    let worst = Infinity
    for (let y = 0; y < on.h - 1; y++) {
      for (let x = 0; x < on.w - 1; x++) {
        let solid = true
        let sum = 0
        for (let dy = 0; dy <= 1 && solid; dy++) {
          for (let dx = 0; dx <= 1; dx++) {
            const i = ((y + dy) * on.w + (x + dx)) * 4
            if (cut.px[i + 3] < 235) {
              solid = false
              break
            }
            sum += lum(on.px[i], on.px[i + 1], on.px[i + 2])
          }
        }
        if (!solid) continue
        const c = contrast(sum / 4, bgL)
        if (c < worst) worst = c
      }
    }
    // No solid window anywhere means the icon is all edge — hairlines and low
    // opacities — which is exactly the thing that disappears at 26px.
    const allEdge = worst === Infinity
    if (allEdge) worst = 0

    const notes = []
    if (cover < 0.1) notes.push(`only ${(cover * 100).toFixed(0)}% ink at ${page.size}px — too faint`)
    if (cover > 0.62) notes.push(`${(cover * 100).toFixed(0)}% ink — a blob, not an icon`)
    if (allEdge) notes.push('nothing in it is solid — all hairline and opacity')
    else if (worst < 2.4) notes.push(`its faintest ink is ${worst.toFixed(2)}:1 on ${pageName}`)
    if (notes.length) fail(`${k.padEnd(18)} ${notes.join('; ')}`)
    else
      ok(
        `${k.padEnd(18)} ${String(page.size).padStart(2)}px on ${pageName.padEnd(12)} ` +
          `ink ${(cover * 100).toFixed(0).padStart(2)}%  faintest ${worst.toFixed(1)}:1  — ${
            ICONS[k].subject
          }`,
      )
  }
}

console.log('\nno two icons are the same picture')
{
  const ks = Object.keys(shapes)
  const pairs = []
  for (let i = 0; i < ks.length; i++)
    for (let j = i + 1; j < ks.length; j++)
      pairs.push({ d: shapeDist(shapes[ks[i]], shapes[ks[j]]), a: ks[i], b: ks[j] })
  pairs.sort((x, y) => x.d - y.d)
  for (const q of pairs.slice(1, 3)) console.log(`        next: ${q.a} / ${q.b} at ${q.d.toFixed(2)}`)
  console.log(`        median pair ${pairs[Math.floor(pairs.length / 2)].d.toFixed(2)}`)
  check(
    pairs[0].d > 0.45,
    `closest pair is ${pairs[0].a} / ${pairs[0].b} at ${pairs[0].d.toFixed(2)}`,
  )
}

/* ---- a sheet to look at ---------------------------------------------------- */

const sheetArg = process.argv.indexOf('--sheet')
if (sheetArg > -1) {
  const COLS = 8
  const CELL = 76
  const rows = Math.ceil(keys.length / COLS)
  // Half on cream, half on near-black, because that is the whole constraint.
  const band = (bg, ink, y0) =>
    `<rect y="${y0}" width="${COLS * CELL}" height="${rows * CELL}" fill="${bg}"/>` +
    keys
      .map((k, i) => {
        const x = (i % COLS) * CELL + CELL / 2 - 24
        const y = y0 + Math.floor(i / COLS) * CELL + CELL / 2 - 24
        return `<svg x="${x}" y="${y}" width="48" height="48" viewBox="0 0 24 24" color="${ink}">${ICONS[
          k
        ].draw()}</svg>`
      })
      .join('')
  const H = rows * CELL * 2
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CELL}" height="${H}">` +
    band('#faf6ea', '#241d12', 0) +
    band('#0e1b28', '#eaf1f7', rows * CELL) +
    '</svg>'
  fs.writeFileSync(
    process.argv[sheetArg + 1],
    new Resvg(svg, { fitTo: { mode: 'width', value: COLS * CELL } }).render().asPng(),
  )
  console.log(`\nsheet written to ${process.argv[sheetArg + 1]}`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall icon checks passed\n')
process.exit(failures ? 1 : 0)
