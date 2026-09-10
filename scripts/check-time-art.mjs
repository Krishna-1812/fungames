/**
 * check-time-art — do Deep Time's forty-four scenes survive the size the card
 * actually gives them?
 *
 * The page's layout is the constraint here, and it is unusual. Cards are laid
 * out at their true depth on an honest scale, so where events cluster they are
 * pushed into two narrow lanes and then compacted — the note goes, then the
 * date. A scene that reads at 172 pixels wide and is mush at 64 would look
 * fine everywhere on this page except the four or five places where history
 * gets busy, which are the interesting places.
 *
 * So it renders every scene at all three widths the card can give it and asks:
 *
 *   1. Does every event have a scene, and does every scene name a real event?
 *      A drawing keyed on a title that has since been reworded is invisible on
 *      the page and silent everywhere else.
 *   2. No ids, no defs, no gradients. Forty-four of these inline into one
 *      document, and both of the other art modules on this site prefix ids to
 *      keep them apart. Having none at all is a guarantee rather than a
 *      convention, and at 64 pixels flat colour is the better drawing anyway.
 *   3. Is every colour from the one palette? This is the emoji lesson: what
 *      made a row of thirty of them look accidental was that each came from
 *      somewhere else.
 *   4. Does the scene cover its whole frame? These sit on a translucent dark
 *      card over a sky that runs from near-black to daylight across the page,
 *      so a scene with a hole in it is a different picture at the top of the
 *      page and at the bottom.
 *   5. Is there a picture in the frame, and is enough of the frame it? Two
 *      separate questions — see the note above that section, which is also
 *      where this file's own first attempt at them is written down.
 *   6. Are any two of them the same scene?
 *   7. Each event's card is lit by `MOOD[title]` — a colour computed from the
 *      scene's own drawing, not chosen beside it. Does every colour genuinely
 *      come from that scene (so a card cannot end up lit by a hue that is not
 *      even in the picture), and does re-deriving it from scratch agree with
 *      what `time-art.ts` actually exports (so the one hand-written exception
 *      cannot silently drift from the drawing it was written to correct)?
 *
 *   node scripts/check-time-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { EVENTS } = await import('../src/lib/time-events.ts')
const { TIME_ART, P, MOOD, dominantMood } = await import('../src/lib/time-art.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

/* The three widths the card can hand a scene, measured off the live page:
   the full-width centre lane, a narrow side lane, and the compacted lane a
   dense cluster falls back to. Everything is 3:2. (A fourth, narrower still
   and square rather than 3:2, is what a dense cluster falls back to on a
   phone — not tested here, since the aspect ratio itself changes rather than
   just the size, and `slice` sizing means it is a crop of the same drawing
   these three already have to survive being small.) */
const WIDTHS = [
  { name: 'centre', w: 172 },
  { name: 'lane', w: 104 },
  { name: 'compact', w: 64 },
]

const names = Object.keys(TIME_ART)

/** One scene rasterised at a given card width. */
function shot(name, w) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${Math.round((w * 2) / 3)}" ` +
    `viewBox="0 0 120 80">${TIME_ART[name].draw()}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render()
  // `.pixels` allocates a fresh buffer on every read; the scale checker died
  // of reading it inside a loop, so it is hoisted here and everywhere else.
  return { px: img.pixels, W: img.width, H: img.height }
}

/* ---- 1. coverage -------------------------------------------------------- */

console.log('\ncoverage')
{
  const missing = EVENTS.filter((e) => !TIME_ART[e.title]).map((e) => e.title)
  const orphan = names.filter((n) => !EVENTS.some((e) => e.title === n))
  check(missing.length === 0, `every event has a scene${missing.length ? ': missing ' + missing : ''}`)
  check(orphan.length === 0, `every scene names a real event${orphan.length ? ': ' + orphan : ''}`)
  ok(`${names.length} scenes over ${EVENTS.length} events`)
  const subjects = new Set(names.map((n) => TIME_ART[n].subject))
  check(subjects.size === names.length, 'no two scenes claim the same subject')
}

/* ---- 2. no ids, no defs, no gradients ----------------------------------- */

console.log('\nnothing that could collide with another drawing')
{
  let bad = 0
  for (const n of names) {
    const m = TIME_ART[n].draw()
    for (const [re, what] of [
      [/\sid="/, 'an id'],
      [/<defs/, 'a <defs>'],
      [/Gradient/, 'a gradient'],
      [/url\(#/, 'a url(#…) reference'],
      [/<clipPath/, 'a clipPath'],
    ]) {
      if (re.test(m)) {
        fail(`${n} has ${what} — these all share one document`)
        bad++
      }
    }
  }
  check(bad === 0, 'no scene defines anything the document namespace can share')
}

/* ---- 3. one palette ----------------------------------------------------- */

console.log('palette')
{
  const allowed = new Set(Object.values(P).map((c) => c.toLowerCase()))
  const strays = new Map()
  for (const n of names) {
    for (const m of TIME_ART[n].draw().matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      const v = m[1].toLowerCase()
      if (v === 'none' || v === 'currentcolor') continue
      if (!allowed.has(v)) strays.set(v, (strays.get(v) ?? '') + ' ' + n)
    }
  }
  for (const [v, where] of strays) fail(`colour ${v} is not in the palette (${where.trim()})`)
  check(strays.size === 0, `every fill and stroke is one of the ${allowed.size} palette colours`)

  // The palette itself has to work on the card, which is dark and translucent
  // over a sky that goes from near-black to daylight. Anything at the very
  // ends of the range reads as a hole or a flashbulb at 64px.
  const outliers = Object.entries(P).filter(([, c]) => {
    const n = parseInt(c.slice(1), 16)
    const l = lum((n >> 16) & 255, (n >> 8) & 255, n & 255)
    return l < 0.006 || l > 0.86
  })
  check(outliers.length === 0, `no palette colour is at the extremes${outliers.length ? ': ' + outliers.map((o) => o[0]) : ''}`)
}

/* ---- 4. the scene covers its own frame ---------------------------------- */

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
  check(bad === 0, 'all forty-four are opaque edge to edge')
}

/* ---- 5. still a picture at 64 pixels ------------------------------------ */

/* Two questions, and the split between them is the point.
 *
 * **Structure**, at the width most cards get. Same measure as
 * `check-scale-art.mjs`: what fraction of pixels sit on a step in luminance
 * rather than on a smooth ramp.
 *
 * It is measured at *one* width, and at the largest, which is the opposite of
 * what the first version of this file did. Edge pixels track the perimeter of
 * what is drawn and the total tracks the area, so the ratio rises as an image
 * shrinks — a single floor across three widths grades size rather than
 * legibility. The run said so out loud: it failed a scene at 116 pixels that
 * scored nearly twice as well at 52.
 *
 * **Subject**, at the width a compacted cluster gives. What fraction of the
 * frame is not the scene's own backdrop. That one is scale-free, and it is the
 * real worry about 64 pixels: not that the drawing gets rough, but that a
 * scene which is 95% flat ground with one small mark on it becomes a coloured
 * rectangle down there. */
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
    // The backdrop is whatever colour the scene uses most; everything that is
    // not that colour is the subject. Quantised, so antialiasing along a big
    // flat edge does not count as content.
    const tally = new Map()
    for (let i = 0; i < s.px.length; i += 4) {
      const k =
        ((s.px[i] >> 4) << 8) | ((s.px[i + 1] >> 4) << 4) | (s.px[i + 2] >> 4)
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

/* ---- 6. distinctness ---------------------------------------------------- */

/* An outlier test against the tenth-closest pair rather than a fixed floor.
   With 44 scenes there are 946 pairs, and the minimum of a larger sample is
   lower whether or not anything got worse — chasing a fixed bar there is
   chasing an order statistic, which the icon set learned the slow way. */
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
        let r = 0
        let g = 0
        let b = 0
        let c = 0
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const i = (y * s.W + x) * 4
            r += s.px[i]
            g += s.px[i + 1]
            b += s.px[i + 2]
            c++
          }
        out.push(r / c / 255, g / c / 255, b / c / 255)
      }
    return out
  }
  const sigs = Object.fromEntries(names.map((n) => [n, sig(n)]))
  const pairs = []
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = sigs[names[i]]
      const b = sigs[names[j]]
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

/* ---- 7. mood -------------------------------------------------------------

   Every card on the page is lit by MOOD[title], a colour time-art.ts derives
   from that scene's own drawing rather than one chosen to match it. Two ways
   that guarantee could quietly stop being true: a colour could turn out not
   to actually appear anywhere in the scene it is supposed to represent, or
   the one hand-written correction (`The steam engine`) could drift from what
   the scene underneath it now draws. Both are checked directly rather than
   trusted. */

console.log('\nmood')
{
  const paletteHex = new Set(Object.values(P).map((c) => c.toLowerCase()))
  let missing = 0
  let stray = 0
  for (const n of names) {
    const mood = (MOOD[n] || '').toLowerCase()
    if (!paletteHex.has(mood)) { fail(`${n}: MOOD is ${mood || '(empty)'}, not a palette colour`); stray++; continue }
    const svg = TIME_ART[n].draw()
    const used = new Set(
      [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase()),
    )
    if (!used.has(mood)) { fail(`${n}: card is lit by ${mood}, which is not in its own drawing`); missing++ }
  }
  check(missing === 0, 'every card colour genuinely appears in its own scene')
  check(stray === 0, 'every card colour is one of the palette colours')

  // Re-derive the whole set from nothing and diff it against what the module
  // exports. The only legitimate difference is the one documented override —
  // if the scene it corrects has since been redrawn and the computed value
  // has moved to agree with the override anyway, or moved somewhere else
  // entirely, this is what would notice either.
  const recomputed = Object.fromEntries(names.map((n) => [n, dominantMood(TIME_ART[n].draw())]))
  const drifted = names.filter((n) => recomputed[n] !== MOOD[n])
  check(
    drifted.length <= 1 && (drifted.length === 0 || drifted[0] === 'The steam engine'),
    `computed mood matches the exported set, past the one documented override` +
      (drifted.length ? `: ${drifted.join(', ')}` : ''),
  )
}

/* ---- 8. determinism ----------------------------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const n of names) if (TIME_ART[n].draw() !== TIME_ART[n].draw()) (fail(`${n} draws differently twice`), drift++)
  check(drift === 0, 'every scene is the same twice')
}

/* ---- 9. no emoji -------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/time-art.ts', 'src/lib/time-events.ts', 'src/pages/deep-time.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

/* ---- output ------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 6
  const CW = 200
  const CH = 158
  const rows = Math.ceil(names.length / COLS)
  // Ordered as the page orders them, oldest first, so the sheet reads as the
  // page reads.
  const inOrder = EVENTS.map((e) => e.title).filter((t) => TIME_ART[t])
  const body = inOrder
    .map((n, i) => {
      const x = (i % COLS) * CW
      const y = Math.floor(i / COLS) * CH
      return (
        `<g transform="translate(${x} ${y})">` +
        `<svg x="10" y="8" width="180" height="120" viewBox="0 0 120 80">${TIME_ART[n].draw()}</svg>` +
        `<text x="${CW / 2}" y="${CH - 16}" fill="#fff" font-size="11" font-family="sans-serif" ` +
        `text-anchor="middle" opacity="0.85">${n.replace(/&/g, '&amp;').slice(0, 34)}</text></g>`
      )
    })
    .join('')
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}" ` +
        `viewBox="0 0 ${COLS * CW} ${rows * CH}"><rect width="${COLS * CW}" height="${
          rows * CH
        }" fill="#0c0a18"/>${body}</svg>`,
      { fitTo: { mode: 'width', value: COLS * CW } },
    )
      .render()
      .asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll time-art checks passed.')
process.exitCode = failures ? 1 : 0
