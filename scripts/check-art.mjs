/**
 * check-art — does the tile art actually work, or does it only look like it does?
 *
 * Illustration is the one part of this site that cannot be checked by
 * asserting a number against a formula, so this does the next best thing: it
 * rasterises every tile exactly as the page composites it — the same gradient,
 * the same vignette, the same SLOT_BOX geometry — and measures the result.
 *
 * It answers four questions that eyeballing a screenshot answers badly:
 *
 *   1. Is the drawing there at all? A drawing can be beautiful in isolation
 *      and invisible over its own tile, and at 12% opacity nobody notices
 *      until it ships.
 *   2. Does it stay out of the title's way? Measured by rendering each tile
 *      twice, with and without the drawing, and diffing where the type goes.
 *   3. Does white text still clear WCAG on the background under its own
 *      letters? The title and blurb are rendered into the raster for this, so
 *      what is graded is the patch a word actually sits on.
 *   4. Are the eighteen drawings actually different from each other, and are
 *      any two cards the same colour? This is the whole point of the exercise,
 *      and it is the one thing you stop being able to judge after looking at
 *      them for an hour.
 *
 * All of it at the three card shapes the grid can really produce, because they
 * crop the full-bleed drawings differently and a drawing has to survive all
 * three.
 *
 * `--sheet <file.png>` writes a contact sheet of every tile; `--dbg <slugs>
 * <dir>` writes single tiles with their type on. Both go through the same
 * compositor as the checks, deliberately: a preview that renders differently
 * from the checker is worse than no preview.
 *
 *   node scripts/check-art.mjs [--sheet out.png] [--dbg slug,slug dir]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { listedGames } = await import('../src/data/games.ts')
const { ART, PRESERVE, SLOT_BOX, SLOT_FADE, fadeStops } = await import('../src/lib/tile-art.ts')

let failures = 0
const fail = (msg) => {
  failures++
  console.log(`  FAIL  ${msg}`)
}
const ok = (msg) => console.log(`  ok    ${msg}`)
const check = (cond, msg) => (cond ? ok(msg) : fail(msg))

/* ---- colour ------------------------------------------------------------- */

const hex = (h) => {
  const v = parseInt(h.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const unlin = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)

/**
 * oklab mixing, because that is what the tile's CSS does. Mixing the same two
 * colours in sRGB instead lands a visibly different midpoint on the saturated
 * accents, and the midpoint is exactly the region the title sits on.
 */
function mixOklab(a, b, ratioA) {
  const f = (rgb) => {
    const [r, g, bl] = rgb.map((v) => lin(v / 255))
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  const A = f(a)
  const B = f(b)
  const o = A.map((v, i) => v * ratioA + B[i] * (1 - ratioA))
  const l = (o[0] + 0.3963377774 * o[1] + 0.2158037573 * o[2]) ** 3
  const m = (o[0] - 0.1055613458 * o[1] - 0.0638541728 * o[2]) ** 3
  const s = (o[0] - 0.0894841775 * o[1] - 1.291485548 * o[2]) ** 3
  return [
    unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
    unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
  ]
}

/** Straight-line distance between two colours in oklab, where it means something. */
function oklabDist(a, b) {
  const mid = mixOklab(a, b, 0.5)
  // Distance via the midpoint keeps this in the same space the tiles blend in.
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / 255
  return d(a, mid) + d(b, mid)
}

/** Relative luminance of an 8-bit RGB triple, 0..1. */
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

/* ---- the compositor ------------------------------------------------------ */

/**
 * The three card shapes the grid can actually produce, measured off the live
 * page rather than assumed. The homepage grid is three columns, two below
 * 1000px and one below 660px, so a tile is never wider than about 615px and
 * never squarer than about 2:1 — and the one-column case is the demanding one,
 * a 3.9:1 letterbox that crops the full-bleed drawings hardest.
 *
 * Each carries the type metrics that apply at that width, because they change:
 * under 700px the tile pads 18/20 and the text column is 68% of it, above that
 * 22/24 and 62%, and the title is clamp(22px, 2.3vw, 29px) of the viewport the
 * column count implies.
 */
const CARDS = [
  { name: 'one-column', w: 615, h: 158, padY: 18, padX: 20, body: 0.68, title: 22 },
  { name: 'two-column', w: 469, h: 168, padY: 22, padX: 24, body: 0.62, title: 23 },
  { name: 'three-column', w: 366, h: 180, padY: 22, padX: 24, body: 0.62, title: 27 },
].map((c) => ({ ...c, colW: Math.min((c.w - c.padX * 2) * c.body, 268) }))

/* ---- where the letters land ---------------------------------------------- */

/**
 * Approximate glyph widths in em.
 *
 * Calibrated against getClientRects on the live grid for all eighteen titles
 * and blurbs: this model picks the same line breaks in every case and comes out
 * within a few percent on width, erring wide. The constant is the side bearing
 * a short string gets and a long one amortises — without it "Orbit" came out
 * 30% narrow, which is the direction that matters, because a mask that is too
 * small quietly excuses art for sitting under type.
 */
const NARROW = "ijltfrI'\u2019.,;:!|() "
const WIDE = 'mwMW'
const emOf = (str) =>
  [...str].reduce((u, c) => u + (NARROW.includes(c) ? 0.34 : WIDE.includes(c) ? 0.95 : 0.58), 0)

function wrapEm(text, maxEm) {
  const out = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word
    if (emOf(next) > maxEm && line) {
      out.push(line)
      line = word
    } else line = next
  }
  if (line) out.push(line)
  return out
}

/** The title and blurb as positioned lines, in card pixels. */
function textLines(game, card) {
  const colW = card.colW
  const lines = []
  const push = (str, size, weight, top, lead) => {
    const w = Math.min(colW, (emOf(str) + 0.6) * size * 1.06)
    lines.push({ str, size, weight, w, baseline: top + lead })
  }
  const tLines = wrapEm(game.title, colW / card.title)
  const step = card.title * 1.32
  tLines.forEach((l, i) => push(l, card.title, 700, card.padY + i * step, card.title * 1.05))
  const bTop = card.padY + tLines.length * step + 8
  const bStep = 14.5 * 1.4
  wrapEm(game.blurb, colW / 14.5).forEach((l, i) => push(l, 14.5, 400, bTop + i * bStep, 14.5))
  return lines
}

/** CSS gradient-line endpoints for `angle` degrees over a W×H box. */
function gradientLine(angle, w, h) {
  const a = (angle * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const half = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / 2
  return [w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half]
}

/**
 * One tile, composited in the same order the browser does it: gradient, then
 * the ::after vignette, then the illustration, then nothing else — the gloss,
 * grain and rim are hover/blend effects that do not change what is under the
 * text at rest.
 */
function tileSvg(game, { withArt = true, withText = false, card, W, H } = {}) {
  const a = hex(game.accent)
  const b = hex(game.accent2)
  const mid = toHex(mixOklab(a, b, 0.64))
  const hi = toHex(mixOklab(b, [255, 255, 255], 0.2))
  const [x1, y1, x2, y2] = gradientLine(142, W, H)
  const [vx1, vy1, vx2, vy2] = gradientLine(100, W, H)

  let art = ''
  let fadeDef = ''
  if (withArt) {
    const il = ART[game.slug]
    const box = SLOT_BOX[il.slot]
    const inner =
      `<svg x="${(box.l / 100) * W}" y="${(box.t / 100) * H}" ` +
      `width="${(box.w / 100) * W}" height="${(box.h / 100) * H}" ` +
      `viewBox="${il.viewBox}" preserveAspectRatio="${PRESERVE[il.slot]}">${il.draw(1)}</svg>`
    // Run fadeStops the same way the page does — element-relative percentages
    // — and map them back to card coordinates for the mask. A bug in that
    // conversion then shows up here as a fade in the wrong place, which is the
    // point of exercising the real function rather than SLOT_FADE directly.
    const f = fadeStops(il.slot)
    if (f) {
      const cardX = (pct) => ((box.l + (pct / 100) * box.w) / 100) * W
      fadeDef = `<linearGradient id="fadeg" gradientUnits="userSpaceOnUse" x1="${cardX(
        f[0],
      )}" y1="0" x2="${cardX(f[1])}" y2="0">
        <stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <mask id="fade" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="url(#fadeg)"/></mask>`
      art = `<g mask="url(#fade)">${inner}</g>`
    } else {
      art = inner
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0" stop-color="${game.accent}"/>
        <stop offset="0.62" stop-color="${mid}"/>
        <stop offset="1" stop-color="${game.accent2}"/>
      </linearGradient>
      <radialGradient id="hi" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${hi}"/>
        <stop offset="0.64" stop-color="${hi}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="vig" gradientUnits="userSpaceOnUse" x1="${vx1}" y1="${vy1}" x2="${vx2}" y2="${vy2}">
        <stop offset="0" stop-color="#000" stop-opacity="0.46"/>
        <stop offset="0.44" stop-color="#000" stop-opacity="0.2"/>
        <stop offset="0.74" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
      ${fadeDef}
    </defs>
    <g clip-path="url(#card)">
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <ellipse cx="${0.88 * W}" cy="${0.04 * H}" rx="${0.52 * W}" ry="${0.78 * H}" fill="url(#hi)"/>
      <rect width="${W}" height="${H}" fill="url(#vig)"/>
      ${art}
      ${
        withText
          ? textLines(game, card)
              .map(
                (l) =>
                  `<text x="${card.padX}" y="${l.baseline}" font-family="sans-serif" font-size="${
                    l.size
                  }" font-weight="${l.weight}" textLength="${l.w}" lengthAdjust="spacingAndGlyphs"
                    fill="#ffffff">${esc(l.str)}</text>`,
              )
              .join('')
          : ''
      }
    </g>
  </svg>`
}

const esc = (t) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Just the drawing, on nothing, for comparing drawings to drawings. */
function artOnlySvg(game, W, H) {
  const il = ART[game.slug]
  const box = SLOT_BOX[il.slot]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <svg x="${(box.l / 100) * W}" y="${(box.t / 100) * H}" width="${(box.w / 100) * W}"
         height="${(box.h / 100) * H}" viewBox="${il.viewBox}"
         preserveAspectRatio="${PRESERVE[il.slot]}">${il.draw(1)}</svg></svg>`
}

const raster = (svg, W) => {
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render()
  return { px: img.pixels, w: img.width, h: img.height }
}

/* ---- measurement --------------------------------------------------------- */

/**
 * A mask of the pixels the text covers, found by rendering the card with and
 * without its own title and blurb and taking the difference.
 *
 * The reason for going to this trouble: a percentile over the text *box* is
 * the wrong instrument, because most of that box has no letters in it. Judging
 * a drawing on the whole box failed Spend It for banknotes sitting in a corner
 * its two-word blurb never reaches, while missing Overstimulated, whose popup
 * really was under the last four letters of its own title. The letters are
 * where the letters are.
 *
 * Dilated, because the model places lines to a few pixels rather than exactly,
 * and because a glyph needs its immediate surroundings to stay legible.
 */
function glyphMask(withText, without, W, H, grow = 4) {
  const raw = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const j = i * 4
    if (
      Math.abs(withText.px[j] - without.px[j]) +
        Math.abs(withText.px[j + 1] - without.px[j + 1]) +
        Math.abs(withText.px[j + 2] - without.px[j + 2]) >
      40
    )
      raw[i] = 1
  }
  const out = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!raw[y * W + x]) continue
      for (let dy = -grow; dy <= grow; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -grow; dx <= grow; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < W) out[yy * W + xx] = 1
        }
      }
    }
  }
  return out
}

/**
 * The brightest patch of background that any run of letters sits on.
 *
 * Block means rather than single pixels: a letter is a patch, and one bright
 * pixel between two strokes is not what makes a word hard to read.
 */
function worstUnderMask(img, mask, W, H, rows, block = 12) {
  let worst = 0
  for (let by = rows.y0; by + block <= rows.y1; by += block / 2) {
    for (let bx = 0; bx + block <= W; bx += block / 2) {
      let sum = 0
      let k = 0
      for (let y = by | 0; y < (by | 0) + block; y++) {
        for (let x = bx; x < bx + block; x++) {
          if (!mask[y * W + x]) continue
          const i = (y * W + x) * 4
          sum += lum(img.px[i], img.px[i + 1], img.px[i + 2])
          k++
        }
      }
      // A block that is mostly empty is not carrying a word.
      if (k < block * block * 0.25) continue
      const mean = sum / k
      if (mean > worst) worst = mean
    }
  }
  return worst
}

function boxStats(img, box) {
  const ls = []
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * img.w + x) * 4
      ls.push(lum(img.px[i], img.px[i + 1], img.px[i + 2]))
    }
  }
  ls.sort((p, q) => p - q)
  return { p95: ls[Math.floor(ls.length * 0.95)], mean: ls.reduce((s, v) => s + v, 0) / ls.length }
}

/**
 * How much the drawing changed a region, between renders with and without it.
 *
 * `seen` and `peak` rather than the mean, for visibility: a mean rewards big
 * filled shapes and punishes line work, so grading on it would quietly push
 * all eighteen drawings towards solid blobs — the template problem again,
 * arriving through the back door of a badly chosen metric. A pen line covers
 * little area but is perfectly visible, and `seen` (share of pixels moved at
 * all) plus `peak` (how hard the strongest ones moved) says so.
 */
function diffStats(a, b, box) {
  const ds = []
  let sum = 0
  let hard = 0
  let seen = 0
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * a.w + x) * 4
      const d = Math.abs(
        lum(a.px[i], a.px[i + 1], a.px[i + 2]) - lum(b.px[i], b.px[i + 1], b.px[i + 2]),
      )
      sum += d
      if (d > 0.25) hard++
      if (d > 0.05) seen++
      ds.push(d)
    }
  }
  ds.sort((p, q) => p - q)
  return {
    mean: sum / ds.length,
    hard: hard / ds.length,
    seen: seen / ds.length,
    peak: ds[Math.floor(ds.length * 0.99)],
  }
}

/**
 * Where a drawing puts its ink, as a normalised map.
 *
 * Alpha, not colour, and normalised to unit total. Comparing the rendered
 * pixels instead would mostly compare how much empty space each drawing has,
 * and two sparse line drawings in completely different corners would come out
 * "similar" because most of both is nothing. What actually distinguishes two
 * designs is where the ink lands and in what proportion.
 */
function inkMap(img, cols = 20, rows = 10) {
  const out = new Float64Array(cols * rows)
  const cw = img.w / cols
  const ch = img.h / rows
  let total = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let a = 0
      for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) {
        for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) {
          a += img.px[(y * img.w + x) * 4 + 3]
        }
      }
      out[r * cols + c] = a
      total += a
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = total ? (out[i] / total) * out.length : 0
  return out
}

/** Mean absolute difference between two normalised ink maps. */
const thumbDist = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

/* ---- run ------------------------------------------------------------------ */

const games = listedGames()

console.log('\ncoverage')
{
  const slugs = games.map((g) => g.slug).sort()
  const drawn = Object.keys(ART).sort()
  check(
    slugs.join() === drawn.join(),
    `every listed game has its own drawing and no drawing is orphaned (${drawn.length})`,
  )
  const missing = slugs.filter((s) => !ART[s])
  if (missing.length) fail(`no drawing for: ${missing.join(', ')}`)
  const orphan = drawn.filter((s) => !slugs.includes(s))
  if (orphan.length) fail(`drawing with no game: ${orphan.join(', ')}`)
}

console.log('\nno shared template')
{
  // A slot is a composition. If most tiles share one, the grid has a template
  // again whatever the silhouettes do.
  const bySlot = {}
  for (const s of Object.keys(ART)) (bySlot[ART[s].slot] ??= []).push(s)
  const worst = Object.entries(bySlot).sort((a, b) => b[1].length - a[1].length)[0]
  check(
    worst[1].length <= 3,
    `no composition used more than three times (worst: ${worst[0]} × ${worst[1].length})`,
  )
  check(Object.keys(bySlot).length >= 6, `at least six distinct compositions (${Object.keys(bySlot).length})`)
  const boxes = new Set(Object.keys(ART).map((s) => ART[s].viewBox))
  check(boxes.size >= 5, `drawings are authored at ${boxes.size} different sizes, not one`)
}

console.log('\nids are safe to inline eighteen at a time')
{
  const seen = new Map()
  for (const slug of Object.keys(ART)) {
    const markup = ART[slug].draw(1)
    for (const m of markup.matchAll(/\sid="([^"]+)"/g)) {
      const id = m[1]
      if (!id.startsWith(slug)) fail(`${slug}: id "${id}" is not prefixed with its slug`)
      if (seen.has(id)) fail(`id "${id}" is used by both ${seen.get(id)} and ${slug}`)
      seen.set(id, slug)
    }
    // A url(#…) that names an id this drawing does not define would silently
    // pick up another tile's gradient on the homepage.
    for (const m of markup.matchAll(/url\(#([^)]+)\)/g)) {
      if (!markup.includes(`id="${m[1]}"`)) fail(`${slug}: refers to #${m[1]}, which it does not define`)
    }
  }
  check(true, `${seen.size} gradient and pattern ids, all slug-prefixed and unique`)
}

console.log('\nnothing is drawn outside the frame')
{
  // Shapes wholly outside the viewBox are dead weight on every page load, and
  // resvg aborts the whole process on enough of them rather than raising
  // anything catchable — so this cannot be left to the render pass to notice.
  // Orbit shipped twenty-four such stars before this check existed.
  let stray = 0
  for (const slug of Object.keys(ART)) {
    const [vx, vy, vw, vh] = ART[slug].viewBox.split(/\s+/).map(Number)
    const markup = ART[slug].draw(1)
    const outside = (x0, y0, x1, y1) => x1 < vx || y1 < vy || x0 > vx + vw || y0 > vy + vh
    for (const m of markup.matchAll(/<circle ([^>]*)\/>/g)) {
      const at = (k) => Number(/\b${k}="([-\d.]+)"/.exec(m[1])?.[1] ?? NaN)
      const [cx, cy, r] = [at('cx'), at('cy'), at('r')]
      if (Number.isNaN(cx + cy + r)) continue
      if (outside(cx - r, cy - r, cx + r, cy + r)) {
        stray++
        if (stray < 4) fail(`${slug}: a circle at ${cx},${cy} is entirely outside its viewBox`)
      }
    }
    for (const m of markup.matchAll(/<rect ([^>]*)\/>/g)) {
      const at = (k) => Number(/\b${k}="([-\d.]+)"/.exec(m[1])?.[1] ?? NaN)
      const [x, y, w, h] = [at('x'), at('y'), at('width'), at('height')]
      if (Number.isNaN(x + y + w + h)) continue
      if (outside(x, y, x + w, y + h)) {
        stray++
        if (stray < 4) fail(`${slug}: a rect at ${x},${y} is entirely outside its viewBox`)
      }
    }
  }
  check(stray === 0, 'every circle and rect lands somewhere the frame can show it')
}

console.log('\ndeterminism')
{
  let stable = true
  for (const slug of Object.keys(ART)) {
    if (ART[slug].draw(1) !== ART[slug].draw(1)) stable = false
  }
  check(stable, 'same seed draws the same markup twice')
  const varies = Object.keys(ART).filter((s) => ART[s].draw(1) !== ART[s].draw(2))
  check(varies.length > 0, `${varies.length} drawings respond to the seed at all`)
}

console.log('\nno emoji left on the grid')
{
  const emoji = /\p{Extended_Pictographic}/u
  for (const f of ['src/data/games.ts', 'src/components/GameTile.astro', 'src/lib/tile-art.ts']) {
    const body = fs.readFileSync(f, 'utf8')
    // The word "emoji" appears in the comments explaining its removal; an
    // actual pictograph does not.
    if (emoji.test(body)) fail(`${f} still contains an emoji`)
  }
  check(true, 'registry, tile and drawings are emoji-free')
}

console.log('\nrendered on their own tiles')
const thumbs = {}
for (const g of games) {
  const worst = { notes: [], line: '' }
  for (const card of CARDS) {
    const { w: W, h: H } = card
    const withArt = raster(tileSvg(g, { card, W, H }), W)
    const bare = raster(tileSvg(g, { withArt: false, card, W, H }), W)
    const typed = raster(tileSvg(g, { withArt: false, withText: true, card, W, H }), W)
    if (card.name === 'three-column') thumbs[g.slug] = inkMap(raster(artOnlySvg(g, W, H), W))

    const mask = glyphMask(typed, bare, W, H)
    const lines = textLines(g, card)
    const titleEnd = lines.find((l) => l.size < 20)
      ? lines.find((l) => l.size < 20).baseline - 14
      : H
    const TEXT = {
      x0: Math.round(card.padX * 0.8),
      y0: Math.round(card.padY * 0.6),
      x1: Math.round(card.padX + card.colW + 6),
      y1: Math.min(H, Math.round(lines[lines.length - 1].baseline + 8)),
    }
    // Visibility is judged inside the drawing's own slot, not across the whole
    // card. A corner motif covers a fifth of the tile, so averaging it over the
    // other four fifths would call every small composition invisible and push
    // every drawing towards full-bleed — the template problem again.
    const sb = SLOT_BOX[ART[g.slug].slot]
    const slotBox = {
      x0: Math.max(0, Math.round((sb.l / 100) * W)),
      y0: Math.max(0, Math.round((sb.t / 100) * H)),
      x1: Math.min(W, Math.round(((sb.l + sb.w) / 100) * W)),
      y1: Math.min(H, Math.round(((sb.t + sb.h) / 100) * H)),
    }
    // Judged from where the fade finishes, not from the card's left edge.
    // The faded part is ghosted on purpose; counting it would mark a drawing
    // invisible for obeying the rule that keeps it off the title.
    const fadeEnd = SLOT_FADE[ART[g.slug].slot]?.[1] ?? 0
    slotBox.x0 = Math.max(slotBox.x0, Math.round(fadeEnd * W))
    const ink = diffStats(withArt, bare, slotBox)
    const text = diffStats(withArt, bare, TEXT)

    // Split the way WCAG splits: the title is large text and needs 3:1, the
    // blurb is not and needs 4.5:1. Both judged on the background under the
    // letters themselves.
    const titleRows = { y0: 0, y1: Math.min(H, Math.round(titleEnd)) }
    const blurbRows = { y0: Math.min(H, Math.round(titleEnd)), y1: H }
    const titleWorst = contrast(1, worstUnderMask(withArt, mask, W, H, titleRows))
    const blurbWorst = contrast(1, worstUnderMask(withArt, mask, W, H, blurbRows))
    const bareTitle = contrast(1, worstUnderMask(bare, mask, W, H, titleRows))
    const bareBlurb = contrast(1, worstUnderMask(bare, mask, W, H, blurbRows))

    const notes = []
    if (ink.seen < 0.1 || ink.peak < 0.2)
      notes.push(
        `barely there on ${card.name} (${(ink.seen * 100).toFixed(0)}% of its slot moved, peak ${ink.peak.toFixed(
          2,
        )})`,
      )
    if (text.mean > 0.05) notes.push(`crowds the title on ${card.name} (ΔL ${text.mean.toFixed(3)})`)
    // The real page also gives the type a shadow, which this render does not,
    // so passing here is the conservative case. Failures are attributed to the
    // drawing or the accent by re-measuring the bare card: the gradient under
    // the text is not the illustration's fault.
    if (titleWorst < 3)
      notes.push(
        `title on ${card.name} sits at ${titleWorst.toFixed(2)}:1${
          bareTitle < 3 ? ` (bare card already ${bareTitle.toFixed(2)}:1 — the accent, not the drawing)` : ''
        }`,
      )
    if (blurbWorst < 4.5)
      notes.push(
        `blurb on ${card.name} sits at ${blurbWorst.toFixed(2)}:1${
          bareBlurb < 4.5 ? ` (bare card already ${bareBlurb.toFixed(2)}:1 — the accent, not the drawing)` : ''
        }`,
      )
    worst.notes.push(...notes)
    if (card.name === 'three-column')
      worst.line =
        `${g.slug.padEnd(15)} seen ${(ink.seen * 100).toFixed(0).padStart(3)}%  peak ${ink.peak
          .toFixed(2)}  under the type ${titleWorst.toFixed(1).padStart(4)}:1 / ${blurbWorst
          .toFixed(1)
          .padStart(4)}:1`
  }

  if (worst.notes.length) fail(`${g.slug.padEnd(15)} ${worst.notes.join('; ')}`)
  else ok(`${worst.line}  — ${ART[g.slug].subject}`)
}

console.log('\nno two cards are the same card')
{
  // Distinct drawings are not enough if two tiles are the same colour: on a
  // grid you read the gradient before you read anything on it.
  const pairs = []
  for (let i = 0; i < games.length; i++) {
    for (let j = i + 1; j < games.length; j++) {
      pairs.push({
        d:
          oklabDist(hex(games[i].accent), hex(games[j].accent)) +
          oklabDist(hex(games[i].accent2), hex(games[j].accent2)),
        a: games[i].slug,
        b: games[j].slug,
      })
    }
  }
  pairs.sort((x, y) => x.d - y.d)
  const closest = pairs[0]
  for (const q of pairs.slice(1, 3)) console.log(`        next: ${q.a} / ${q.b} at ${q.d.toFixed(3)}`)
  console.log(`        median pair ${pairs[Math.floor(pairs.length / 2)].d.toFixed(3)}`)
  check(
    closest.d > 0.22,
    `closest gradients are ${closest.a} / ${closest.b} at ${closest.d.toFixed(3)} oklab apart`,
  )
}

console.log('\nall eighteen are different drawings')
{
  const slugs = Object.keys(thumbs)
  const pairs = []
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      pairs.push({ d: thumbDist(thumbs[slugs[i]], thumbs[slugs[j]]), a: slugs[i], b: slugs[j] })
    }
  }
  pairs.sort((x, y) => x.d - y.d)
  const closest = pairs[0]
  // The three closest, always — a single number tells you nothing about
  // whether it is an outlier or the whole grid drifting together.
  for (const q of pairs.slice(1, 3)) console.log(`        next: ${q.a} / ${q.b} at ${q.d.toFixed(2)}`)
  console.log(`        median pair ${pairs[Math.floor(pairs.length / 2)].d.toFixed(2)}`)
  check(
    closest.d > 0.5,
    `closest pair is ${closest.a} / ${closest.b}, ink laid out ${closest.d.toFixed(
      2,
    )} apart (0 would be the same design)`,
  )
}

/* ---- looking at what it measured ------------------------------------------ */

/**
 * `--dbg <slug,slug> <dir>` writes each named tile at all three card shapes
 * WITH its own title and blurb on it, at 2× so the type is legible.
 *
 * This is how a failure gets diagnosed rather than guessed at. "Steady Hand's
 * title sits at 1.6:1" is a number; the picture shows the dot anchoring the
 * line landing squarely on the "d", which is the thing you actually move.
 */
const dbgArg = process.argv.indexOf('--dbg')
if (dbgArg > -1) {
  const want = process.argv[dbgArg + 1].split(',')
  for (const g of games.filter((x) => want.includes(x.slug))) {
    for (const card of CARDS) {
      const svg = tileSvg(g, { card, W: card.w, H: card.h, withText: true })
      fs.writeFileSync(
        `${process.argv[dbgArg + 2]}/${g.slug}-${card.name}.png`,
        new Resvg(svg, { fitTo: { mode: 'width', value: card.w * 2 } }).render().asPng(),
      )
    }
  }
}

const sheetArg = process.argv.indexOf('--sheet')
if (sheetArg > -1) {
  const out = process.argv[sheetArg + 1]
  const COLS = 3
  const GAP = 16
  const SW = 460
  const SH = 192
  const rows = Math.ceil(games.length / COLS)
  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * (SW + GAP) + GAP}" height="${
      rows * (SH + GAP) + GAP
    }"><rect width="100%" height="100%" fill="#15131a"/>` +
    games
      .map((g, i) => {
        const inner = tileSvg(g, { card: CARDS[2], W: SW, H: SH })
          .replace(/^<svg[^>]*>/, '')
          .replace(/<\/svg>$/, '')
        return `<svg x="${GAP + (i % COLS) * (SW + GAP)}" y="${
          GAP + Math.floor(i / COLS) * (SH + GAP)
        }" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">${inner
          .replace(/id="/g, `id="s${i}-`)
          .replace(/url\(#/g, `url(#s${i}-`)}</svg>`
      })
      .join('') +
    '</svg>'
  const img = new Resvg(sheet, { fitTo: { mode: 'width', value: COLS * (SW + GAP) + GAP } }).render()
  fs.writeFileSync(out, img.asPng())
  console.log(`\ncontact sheet written to ${out}`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall art checks passed\n')
process.exit(failures ? 1 : 0)
