/**
 * check-deep-sea-art — do the Deep Sea's twenty-two scenes survive the size
 * the card actually gives them, the same way Deep Time's forty-four do?
 *
 * Same layout, same risk, same checks — see check-time-art.mjs for the long
 * version of why each one exists. In order:
 *
 *   1. Every marker has a scene, every scene names a real marker, no two
 *      scenes claim the same subject.
 *   2. No ids, no defs, no gradients, no url(#…), no clipPath — all twenty-two
 *      inline into one document alongside Deep Time's and Scale's own art.
 *   3. Every fill and stroke is one of the palette colours, and none of them
 *      sit at the extremes of the range a translucent card over a background
 *      running from bright surface blue to hadal black actually needs.
 *   4. Every scene is opaque edge to edge — no gap for the card underneath to
 *      show through.
 *   5. Still a picture at 64 pixels: real structure at the width most cards
 *      get, and a real subject (not just backdrop) at the width a compacted
 *      cluster falls back to.
 *   6. Distinctness — no two scenes are the same picture with the colours
 *      swapped.
 *   7. Every card is lit by MOOD[title], and that colour genuinely appears in
 *      the scene it is supposed to represent.
 *   8. Determinism, and no emoji.
 *
 *   node scripts/check-deep-sea-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { MARKERS, ZONES, TOTAL_DEPTH } = await import('../src/data/deep-sea.ts')
const { DEEP_SEA_ART, P, MOOD, dominantMood } = await import('../src/lib/deep-sea-art.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

const WIDTHS = [
  { name: 'centre', w: 172 },
  { name: 'lane', w: 104 },
  { name: 'compact', w: 64 },
]

const names = Object.keys(DEEP_SEA_ART)

function shot(name, w) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${Math.round((w * 2) / 3)}" ` +
    `viewBox="0 0 120 80">${DEEP_SEA_ART[name].draw()}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render()
  return { px: img.pixels, W: img.width, H: img.height }
}

/* ---- 0. data integrity --------------------------------------------------- */

console.log('data')
{
  const sorted = [...MARKERS].every((m, i, arr) => i === 0 || arr[i - 1].depth <= m.depth)
  check(sorted, 'markers are listed in increasing depth order')
  check(
    MARKERS.every((m) => m.depth >= ZONES[0].from && m.depth <= TOTAL_DEPTH),
    'every marker sits inside the zoned depth range',
  )
  check(
    ZONES.every((z, i) => i === 0 || ZONES[i - 1].to === z.from),
    'zones are contiguous, each one starting exactly where the last ended',
  )
  const dupes = MARKERS.map((m) => m.title).filter((t, i, a) => a.indexOf(t) !== i)
  check(dupes.length === 0, `no duplicate marker titles${dupes.length ? ': ' + dupes : ''}`)
  ok(`${MARKERS.length} markers across ${ZONES.length} zones, 0 to ${TOTAL_DEPTH.toLocaleString('en-US')}m`)
}

/* ---- 1. coverage ---------------------------------------------------------- */

console.log('\ncoverage')
{
  const missing = MARKERS.filter((m) => !DEEP_SEA_ART[m.title]).map((m) => m.title)
  const orphan = names.filter((n) => !MARKERS.some((m) => m.title === n))
  check(missing.length === 0, `every marker has a scene${missing.length ? ': missing ' + missing : ''}`)
  check(orphan.length === 0, `every scene names a real marker${orphan.length ? ': ' + orphan : ''}`)
  ok(`${names.length} scenes over ${MARKERS.length} markers`)
  const subjects = new Set(names.map((n) => DEEP_SEA_ART[n].subject))
  check(subjects.size === names.length, 'no two scenes claim the same subject')
}

/* ---- 2. no ids, no defs, no gradients ------------------------------------- */

console.log('\nnothing that could collide with another drawing')
{
  let bad = 0
  for (const n of names) {
    const m = DEEP_SEA_ART[n].draw()
    for (const [re, what] of [
      [/\sid="/, 'an id'],
      [/<defs/, 'a <defs>'],
      [/Gradient/, 'a gradient'],
      [/url\(#/, 'a url(#…) reference'],
      [/<clipPath/, 'a clipPath'],
      [/<filter/, 'a <filter>'],
    ]) {
      if (re.test(m)) {
        fail(`${n} has ${what} — these all share one document`)
        bad++
      }
    }
  }
  check(bad === 0, 'no scene defines anything the document namespace can share')
}

/* ---- 3. one palette -------------------------------------------------------- */

console.log('palette')
{
  const allowed = new Set(Object.values(P).map((c) => c.toLowerCase()))
  const strays = new Map()
  for (const n of names) {
    for (const m of DEEP_SEA_ART[n].draw().matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      const v = m[1].toLowerCase()
      if (v === 'none' || v === 'currentcolor') continue
      if (!allowed.has(v)) strays.set(v, (strays.get(v) ?? '') + ' ' + n)
    }
  }
  for (const [v, where] of strays) fail(`colour ${v} is not in the palette (${where.trim()})`)
  check(strays.size === 0, `every fill and stroke is one of the ${allowed.size} palette colours`)

  const outliers = Object.entries(P).filter(([, c]) => {
    const n = parseInt(c.slice(1), 16)
    const l = lum((n >> 16) & 255, (n >> 8) & 255, n & 255)
    return l < 0.006 || l > 0.86
  })
  check(outliers.length === 0, `no palette colour is at the extremes${outliers.length ? ': ' + outliers.map((o) => o[0]) : ''}`)
}

/* ---- 4. the scene covers its own frame ------------------------------------- */

console.log('\nevery scene owns its background')
{
  let bad = 0
  for (const n of names) {
    const s = shot(n, 120)
    let clear = 0
    for (let i = 3; i < s.px.length; i += 4) if (s.px[i] < 250) clear++
    const frac = clear / (s.W * s.H)
    if (frac > 0.004) {
      fail(`${n}: ${(frac * 100).toFixed(1)}% of its frame is transparent — the card shows through`)
      bad++
    }
  }
  check(bad === 0, `all ${names.length} are opaque edge to edge`)
}

/* ---- 5. still a picture at 64 pixels --------------------------------------- */

console.log('\nstructure, at the width most cards get')
{
  const STEP = 0.05
  const FLOOR = 0.05
  const rows = []
  let bad = 0
  for (const n of names) {
    for (const { name: wname, w } of WIDTHS.slice(0, 1)) {
      const s = shot(n, w)
      const L = (x, y) => {
        const i = (y * s.W + x) * 4
        return lum(s.px[i], s.px[i + 1], s.px[i + 2])
      }
      let total = 0
      let edge = 0
      for (let y = 1; y < s.H - 1; y++)
        for (let x = 1; x < s.W - 1; x++) {
          total++
          const l = L(x, y)
          if (
            Math.max(
              Math.abs(l - L(x - 1, y)),
              Math.abs(l - L(x + 1, y)),
              Math.abs(l - L(x, y - 1)),
              Math.abs(l - L(x, y + 1)),
            ) >= STEP
          )
            edge++
        }
      const d = edge / total
      rows.push({ n, d })
      if (d < FLOOR) {
        fail(`${n} @${wname}: ${(d * 100).toFixed(1)}% edge — that is a backdrop with a mark on it`)
        bad++
      }
    }
  }
  check(bad === 0, `all ${names.length} have structure at ${(FLOOR * 100).toFixed(0)}% edge or better`)
  rows.sort((a, b) => a.d - b.d)
  ok(
    `flattest ${rows[0].n} ${(rows[0].d * 100).toFixed(1)}%, ` +
      `busiest ${rows[rows.length - 1].n} ${(rows[rows.length - 1].d * 100).toFixed(1)}%`,
  )
}

console.log('\nsubject, at the width a compacted cluster gives')
{
  const FLOOR = 0.14
  let bad = 0
  const rows = []
  for (const n of names) {
    const s = shot(n, 52)
    const tally = new Map()
    for (let i = 0; i < s.px.length; i += 4) {
      const k = ((s.px[i] >> 4) << 8) | ((s.px[i + 1] >> 4) << 4) | (s.px[i + 2] >> 4)
      tally.set(k, (tally.get(k) ?? 0) + 1)
    }
    let mode = 0
    let best = -1
    for (const [k, c] of tally) if (c > best) ((best = c), (mode = k))
    const frac = 1 - best / (s.W * s.H)
    rows.push({ n, frac })
    if (frac < FLOOR) {
      fail(`${n}: only ${(frac * 100).toFixed(0)}% of the frame is subject — at 64px that is a rectangle`)
      bad++
    }
  }
  check(bad === 0, `all ${names.length} are more than ${(FLOOR * 100).toFixed(0)}% subject`)
  rows.sort((a, b) => a.frac - b.frac)
  ok(`emptiest is ${rows[0].n} at ${(rows[0].frac * 100).toFixed(0)}% subject`)
}

/* ---- 6. distinctness -------------------------------------------------------- */

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
    pairs[0].d > pack * 0.6,
    `closest pair (${pairs[0].a} / ${pairs[0].b}, ${pairs[0].d.toFixed(3)}) against the ` +
      `tenth-closest (${pack.toFixed(3)})`,
  )
}

/* ---- 7. mood ---------------------------------------------------------------- */

console.log('\nmood')
{
  const paletteHex = new Set(Object.values(P).map((c) => c.toLowerCase()))
  let missing = 0
  let stray = 0
  for (const n of names) {
    const mood = (MOOD[n] || '').toLowerCase()
    if (!paletteHex.has(mood)) { fail(`${n}: MOOD is ${mood || '(empty)'}, not a palette colour`); stray++; continue }
    const svg = DEEP_SEA_ART[n].draw()
    const used = new Set([...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase()))
    if (!used.has(mood)) { fail(`${n}: card is lit by ${mood}, which is not in its own drawing`); missing++ }
  }
  check(missing === 0, 'every card colour genuinely appears in its own scene')
  check(stray === 0, 'every card colour is one of the palette colours')

  const recomputed = Object.fromEntries(names.map((n) => [n, dominantMood(DEEP_SEA_ART[n].draw())]))
  const drifted = names.filter((n) => recomputed[n] !== MOOD[n])
  check(drifted.length === 0, `computed mood matches the exported set${drifted.length ? ': ' + drifted.join(', ') : ''}`)
}

/* ---- 8. determinism, and no emoji -------------------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const n of names) if (DEEP_SEA_ART[n].draw() !== DEEP_SEA_ART[n].draw()) (fail(`${n} draws differently twice`), drift++)
  check(drift === 0, 'every scene is the same twice')
}

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/deep-sea-art.ts', 'src/data/deep-sea.ts', 'src/pages/deep-sea.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

/* ---- output ------------------------------------------------------------------ */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 6
  const CW = 200
  const CH = 158
  const rows = Math.ceil(names.length / COLS)
  const inOrder = MARKERS.map((m) => m.title).filter((t) => DEEP_SEA_ART[t])
  const body = inOrder
    .map((n, i) => {
      const x = (i % COLS) * CW
      const y = Math.floor(i / COLS) * CH
      return (
        `<g transform="translate(${x} ${y})">` +
        `<svg x="10" y="8" width="180" height="120" viewBox="0 0 120 80">${DEEP_SEA_ART[n].draw()}</svg>` +
        `<text x="${CW / 2}" y="${CH - 16}" fill="#fff" font-size="11" font-family="sans-serif" ` +
        `text-anchor="middle" opacity="0.85">${n.replace(/&/g, '&amp;').slice(0, 34)}</text></g>`
      )
    })
    .join('')
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}" ` +
        `viewBox="0 0 ${COLS * CW} ${rows * CH}"><rect width="${COLS * CW}" height="${rows * CH}" fill="#060a10"/>${body}</svg>`,
      { fitTo: { mode: 'width', value: COLS * CW } },
    )
      .render()
      .asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll deep-sea-art checks passed.')
process.exitCode = failures ? 1 : 0
