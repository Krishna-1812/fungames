/**
 * check-space-elevator-art — do Space Elevator's twenty-nine markers survive
 * being cut out of their own sky, the same way check-deep-sea-art proves it
 * for the ocean going the other direction?
 *
 * Same shape, same risk, same checks:
 *
 *   1. Every marker has a scene, every scene names a real marker, no two
 *      scenes claim the same subject.
 *   2. Gradients are allowed; every id (gradient, clipPath, anything) has to
 *      be prefixed with its own scene's key, and every url(#…) has to name
 *      an id the same scene actually defines — no filter, at all, since
 *      that one has no id to prefix and would apply to more than itself.
 *      All twenty-nine inline into one document alongside the tile art.
 *   3. Every fill, stroke and gradient stop is one of the palette colours.
 *   4. Every subject is a CUT-OUT that reads against the real sky it will
 *      actually float on at its own altitude — troposphere blue at the
 *      bottom, near-black by the Kármán line.
 *   5. Real structure inside the subject, at the width a card actually gets
 *      and at the width a compacted cluster falls back to.
 *   6. Distinctness — no two scenes are the same picture with the colours
 *      swapped.
 *   7. Every card is lit by MOOD[title], and that colour genuinely appears
 *      in the scene it is supposed to represent.
 *   8. Determinism, and no emoji.
 *
 *   node scripts/check-space-elevator-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { MARKERS, ZONES, TOTAL_ALTITUDE } = await import('../src/data/space-elevator.ts')
const { SPACE_ELEVATOR_ART, P, MOOD, dominantMood, slug } = await import('../src/lib/space-elevator-art.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const hex = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

const WIDTHS = [
  { name: 'centre', w: 172 },
  { name: 'lane', w: 104 },
  { name: 'compact', w: 64 },
]

const names = Object.keys(SPACE_ELEVATOR_ART)

function shot(name, w) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" ` +
    `viewBox="0 0 120 120">${SPACE_ELEVATOR_ART[name].draw()}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render()
  return { px: img.pixels, W: img.width, H: img.height }
}

/* ---- 0. data integrity --------------------------------------------------- */

console.log('data')
{
  const sorted = [...MARKERS].every((m, i, arr) => i === 0 || arr[i - 1].altitude <= m.altitude)
  check(sorted, 'markers are listed in increasing altitude order')
  check(
    MARKERS.every((m) => m.altitude >= ZONES[0].from && m.altitude <= TOTAL_ALTITUDE),
    'every marker sits inside the zoned altitude range',
  )
  check(
    ZONES.every((z, i) => i === 0 || ZONES[i - 1].to === z.from),
    'zones are contiguous, each one starting exactly where the last ended',
  )
  const dupes = MARKERS.map((m) => m.title).filter((t, i, a) => a.indexOf(t) !== i)
  check(dupes.length === 0, `no duplicate marker titles${dupes.length ? ': ' + dupes : ''}`)
  ok(`${MARKERS.length} markers across ${ZONES.length} zones, 0 to ${TOTAL_ALTITUDE.toLocaleString('en-US')}m`)
}

/* ---- 1. coverage ---------------------------------------------------------- */

console.log('\ncoverage')
{
  const missing = MARKERS.filter((m) => !SPACE_ELEVATOR_ART[m.title]).map((m) => m.title)
  const orphan = names.filter((n) => !MARKERS.some((m) => m.title === n))
  check(missing.length === 0, `every marker has a scene${missing.length ? ': missing ' + missing : ''}`)
  check(orphan.length === 0, `every scene names a real marker${orphan.length ? ': ' + orphan : ''}`)
  ok(`${names.length} scenes over ${MARKERS.length} markers`)
  const subjects = new Set(names.map((n) => SPACE_ELEVATOR_ART[n].subject))
  check(subjects.size === names.length, 'no two scenes claim the same subject')
}

/* ---- 2. no ids, no defs, no gradients -------------------------------------- */

console.log('\nids are safe to inline twenty-nine at a time')
{
  // Gradients are allowed now — every id just has to be prefixed with the
  // scene's own key, the same convention `earth-reviews-art.ts` and
  // `deep-sea-art.ts` already use, so two scenes sharing an id can never
  // mean one silently renders with the other's gradient.
  const seen = new Map()
  let bad = 0
  for (const n of names) {
    const markup = SPACE_ELEVATOR_ART[n].draw()
    const prefix = slug(n)
    for (const m of markup.matchAll(/\sid="([^"]+)"/g)) {
      const id = m[1]
      if (!id.startsWith(prefix)) { fail(`${n}: id "${id}" is not prefixed with "${prefix}"`); bad++ }
      if (seen.has(id)) { fail(`id "${id}" is defined by both ${seen.get(id)} and ${n}`); bad++ }
      seen.set(id, n)
    }
    for (const m of markup.matchAll(/url\(#([^)]+)\)/g))
      if (!markup.includes(`id="${m[1]}"`)) { fail(`${n}: refers to #${m[1]}, which it does not define`); bad++ }
    if (/<filter/.test(markup)) { fail(`${n} has a <filter> — not part of this contract`); bad++ }
  }
  check(bad === 0, `${seen.size} internal ids, all key-prefixed and unique across the module`)
}

/* ---- 3. one palette --------------------------------------------------------- */

console.log('palette')
{
  const allowed = new Set(Object.values(P).map((c) => c.toLowerCase()))
  const strays = new Map()
  for (const n of names) {
    for (const m of SPACE_ELEVATOR_ART[n].draw().matchAll(/(?:fill|stroke|stop-color)="([^"]+)"/g)) {
      const v = m[1].toLowerCase()
      if (v === 'none' || v === 'currentcolor' || v.startsWith('url(')) continue
      if (!allowed.has(v)) strays.set(v, (strays.get(v) ?? '') + ' ' + n)
    }
  }
  for (const [v, where] of strays) fail(`colour ${v} is not in the palette (${where.trim()})`)
  check(strays.size === 0, `every fill, stroke and gradient stop is one of the ${allowed.size} palette colours`)
}

/* ---- 4. a cut-out, and one you can see on its own sky ----------------------- */

/** The real sky colour at an altitude, interpolated inside its own zone —
 *  same formula `update()` in space-elevator.astro uses for `.sky`. */
function skyAt(altitude) {
  const z = ZONES.find((z) => altitude >= z.from && altitude <= z.to) ?? ZONES[ZONES.length - 1]
  const t = Math.min(1, Math.max(0, (altitude - z.from) / Math.max(1, z.to - z.from)))
  const a = hex(z.sky[0])
  const b = hex(z.sky[1])
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

console.log('\nevery subject is cut out, and visible on its own sky')
{
  let bad = 0
  for (const n of names) {
    const marker = MARKERS.find((m) => m.title === n)
    const sky = skyAt(marker.altitude)
    const skyL = lum(...sky)
    const s0 = shot(n, 120)

    // Coverage: a cut-out that fills the frame is not a cut-out, and one that
    // barely marks it is a speck in open air.
    let inked = 0
    for (let i = 3; i < s0.px.length; i += 4) if (s0.px[i] > 140) inked++
    const cover = inked / (s0.W * s0.H)

    // A real margin: nothing solid may touch the frame, or it reads as
    // cropped rather than as a thing suspended in the sky. The mountain and
    // the stratus deck are allowed the bottom edge — a slope or a cloud base
    // genuinely continues past it.
    const edgePx = []
    for (let x = 0; x < s0.W; x++) edgePx.push(s0.px[(0 * s0.W + x) * 4 + 3])
    for (let y = 0; y < s0.H; y++) {
      edgePx.push(s0.px[(y * s0.W + 0) * 4 + 3])
      edgePx.push(s0.px[(y * s0.W + s0.W - 1) * 4 + 3])
    }
    const touching = edgePx.filter((a) => a > 200).length / edgePx.length

    // Contrast against the real sky. Measured on the subject's own solid
    // pixels — deliberately not the >250 Deep Sea's water uses, because
    // several of these are intentionally soft (a contrail, a cloud edge) at
    // an honest opacity like 0.7-0.9 rather than fully opaque, and grading
    // those against a bar tuned for opaque fills would punish the softness
    // rather than the drawing. Below 140 is anti-aliasing fringe, not ink.
    let best = 1
    for (let i = 0; i < s0.W * s0.H; i++) {
      if (s0.px[i * 4 + 3] < 140) continue
      const l = lum(s0.px[i * 4], s0.px[i * 4 + 1], s0.px[i * 4 + 2])
      const c = (Math.max(l, skyL) + 0.05) / (Math.min(l, skyL) + 0.05)
      if (c > best) best = c
    }

    const notes = []
    if (cover < 0.05) notes.push(`only ${(cover * 100).toFixed(0)}% of the frame is drawn`)
    if (cover > 0.72) notes.push(`${(cover * 100).toFixed(0)}% drawn — that is a backdrop, not a cut-out`)
    if (touching > 0.30) notes.push(`${(touching * 100).toFixed(0)}% of its top and side edges are solid — it reads as cropped`)
    if (best < 2.4) notes.push(`its brightest tone is only ${best.toFixed(1)}:1 on ${marker.altitude}m sky`)
    if (notes.length) { fail(`${n}: ${notes.join('; ')}`); bad++ }
  }
  check(bad === 0, `all ${names.length} read as cut-outs against their own sky`)
}

/* ---- 5. structure, inside the subject itself -------------------------------- */

console.log('\nstructure, inside the subject itself')
{
  const RATIO = 1.25
  const FLOOR = 0.05
  const rows = []
  let bad = 0
  for (const n of names) {
    const s = shot(n, WIDTHS[0].w)
    const A = (x, y) => s.px[(y * s.W + x) * 4 + 3]
    const L = (x, y) => {
      const i = (y * s.W + x) * 4
      return lum(s.px[i], s.px[i + 1], s.px[i + 2])
    }
    let inked = 0
    let edge = 0
    for (let y = 1; y < s.H - 1; y++)
      for (let x = 1; x < s.W - 1; x++) {
        if (A(x, y) < 200) continue
        inked++
        const l = L(x, y)
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (A(x + dx, y + dy) < 200) continue
          const nl = L(x + dx, y + dy)
          if ((Math.max(l, nl) + 0.05) / (Math.min(l, nl) + 0.05) >= RATIO) { edge++; break }
        }
      }
    const d = inked ? edge / inked : 0
    rows.push({ n, d })
    if (d < FLOOR) {
      fail(`${n}: ${(d * 100).toFixed(1)}% of its own ink sits next to a tone it can be told apart from — that is one flat mass, not a drawing`)
      bad++
    }
  }
  check(bad === 0, `all ${names.length} have real modelling inside the subject`)
  rows.sort((x, y) => x.d - y.d)
  ok(
    `flattest ${rows[0].n} ${(rows[0].d * 100).toFixed(1)}%, ` +
      `busiest ${rows[rows.length - 1].n} ${(rows[rows.length - 1].d * 100).toFixed(1)}%`
  )
}
console.log('\nstill there at the width a compacted cluster gives')
{
  const FLOOR = 0.03
  let bad = 0
  for (const n of names) {
    const s = shot(n, 46)
    let inked = 0
    for (let i = 3; i < s.px.length; i += 4) if (s.px[i] > 140) inked++
    const frac = inked / (s.W * s.H)
    if (frac < FLOOR) {
      fail(`${n}: only ${(frac * 100).toFixed(0)}% of the frame survives at 46px`)
      bad++
    }
  }
  check(bad === 0, `all ${names.length} still read when the cluster squeezes them`)
}

/* ---- 6. distinctness ---------------------------------------------------------- */

console.log('\ndistinctness')
{
  const N = 10
  const sig = (n) => {
    const s = shot(n, 120)
    const out = []
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++) {
        const x0 = Math.floor((gx * s.W) / N)
        const x1 = Math.floor(((gx + 1) * s.W) / N)
        const y0 = Math.floor((gy * s.H) / N)
        const y1 = Math.floor(((gy + 1) * s.H) / N)
        let r = 0, g = 0, b = 0, c = 0
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = (y * s.W + x) * 4
            r += s.px[i]; g += s.px[i + 1]; b += s.px[i + 2]; c++
          }
        out.push(r / c / 255, g / c / 255, b / c / 255)
      }
    return out
  }
  const sigs = Object.fromEntries(names.map((n) => [n, sig(n)]))
  const pairs = []
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = sigs[names[i]], b = sigs[names[j]]
      let t = 0
      for (let k = 0; k < a.length; k++) t += Math.abs(a[k] - b[k])
      pairs.push({ a: names[i], b: names[j], d: t / a.length })
    }
  pairs.sort((x, y) => x.d - y.d)
  const pack = pairs[Math.min(9, pairs.length - 1)].d
  check(
    pairs[0].d > pack * 0.55,
    `closest pair (${pairs[0].a} / ${pairs[0].b}, ${pairs[0].d.toFixed(3)}) against the ` +
      `tenth-closest (${pack.toFixed(3)})`,
  )
}

/* ---- 7. mood -------------------------------------------------------------------- */

console.log('\nmood')
{
  const paletteHex = new Set(Object.values(P).map((c) => c.toLowerCase()))
  let missing = 0
  let stray = 0
  for (const n of names) {
    const mood = (MOOD[n] || '').toLowerCase()
    if (!paletteHex.has(mood)) { fail(`${n}: MOOD is ${mood || '(empty)'}, not a palette colour`); stray++; continue }
    const svg = SPACE_ELEVATOR_ART[n].draw()
    const used = new Set([...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase()))
    if (!used.has(mood)) { fail(`${n}: card is lit by ${mood}, which is not in its own drawing`); missing++ }
  }
  check(missing === 0, 'every card colour genuinely appears in its own scene')
  check(stray === 0, 'every card colour is one of the palette colours')

  const recomputed = Object.fromEntries(names.map((n) => [n, dominantMood(SPACE_ELEVATOR_ART[n].draw())]))
  const drifted = names.filter((n) => recomputed[n] !== MOOD[n])
  check(drifted.length === 0, `computed mood matches the exported set${drifted.length ? ': ' + drifted.join(', ') : ''}`)
}

/* ---- 8. determinism, and no emoji ------------------------------------------------ */

console.log('\ndeterminism')
{
  let drift = 0
  for (const n of names) if (SPACE_ELEVATOR_ART[n].draw() !== SPACE_ELEVATOR_ART[n].draw()) (fail(`${n} draws differently twice`), drift++)
  check(drift === 0, 'every scene is the same twice')
}

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/space-elevator-art.ts', 'src/data/space-elevator.ts', 'src/pages/space-elevator.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

/* ---- output ---------------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 6
  const CW = 200
  const CH = 190
  const rows = Math.ceil(names.length / COLS)
  const inOrder = MARKERS.map((m) => m.title).filter((t) => SPACE_ELEVATOR_ART[t])
  const body = inOrder
    .map((n, i) => {
      const x = (i % COLS) * CW
      const y = Math.floor(i / COLS) * CH
      return (
        `<g transform="translate(${x} ${y})">` +
        `<svg x="20" y="8" width="160" height="160" viewBox="0 0 120 120">${SPACE_ELEVATOR_ART[n].draw()}</svg>` +
        `<text x="${CW / 2}" y="${CH - 14}" fill="#fff" font-size="11" font-family="sans-serif" ` +
        `text-anchor="middle" opacity="0.85">${n.replace(/&/g, '&amp;').slice(0, 34)}</text></g>`
      )
    })
    .join('')
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}" ` +
        `viewBox="0 0 ${COLS * CW} ${rows * CH}"><rect width="${COLS * CW}" height="${rows * CH}" fill="#0d1a2e"/>${body}</svg>`,
      { fitTo: { mode: 'width', value: COLS * CW } },
    )
      .render()
      .asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll space-elevator-art checks passed.')
process.exitCode = failures ? 1 : 0
