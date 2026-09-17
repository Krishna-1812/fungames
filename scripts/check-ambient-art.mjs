/**
 * check-ambient-art — do Ambient Mix's twelve layers survive being cut out of
 * their settings row, the same way check-space-elevator-art proves it for the
 * climb and check-deep-sea-art proves it for the water?
 *
 *   1. Every layer has a scene, every scene names a real layer, no two scenes
 *      claim the same subject.
 *   2. No ids, no defs, no gradients, no url(#…), no clipPath, no filter —
 *      all twelve inline into one document alongside the tile art.
 *   3. Every fill and stroke is one of the palette colours.
 *   4. Real coverage at the size a layer card actually gives it, and still
 *      legible shrunk to a phone-width card.
 *   5. Real structure inside the subject — more than one flat mass.
 *   6. Distinctness — no two scenes are the same picture with the colours
 *      swapped.
 *   7. Every card is lit by MOOD[id], and that colour genuinely appears in
 *      the scene it is supposed to represent.
 *   8. Determinism, and no emoji.
 *
 *   node scripts/check-ambient-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { LAYERS } = await import('../src/lib/mix-code.ts')
const { AMBIENT_ART, P, MOOD, dominantMood } = await import('../src/lib/ambient-art.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const hex = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)

// The card's own dark ground, in both its resting and "on" states — same
// values as `.layer` / `.layer.on` in ambient-mix.astro.
const CARD_BG = [0x16, 0x28, 0x3a]
const cardL = lum(...CARD_BG)

const ids = Object.keys(AMBIENT_ART)

function shot(id, w) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" ` +
    `viewBox="0 0 100 100">${AMBIENT_ART[id].draw()}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render()
  return { px: img.pixels, W: img.width, H: img.height }
}

/* ---- 1. coverage ---------------------------------------------------------- */

console.log('coverage')
{
  const missing = LAYERS.filter((l) => !AMBIENT_ART[l.id]).map((l) => l.id)
  const orphan = ids.filter((n) => !LAYERS.some((l) => l.id === n))
  check(missing.length === 0, `every layer has a scene${missing.length ? ': missing ' + missing : ''}`)
  check(orphan.length === 0, `every scene names a real layer${orphan.length ? ': ' + orphan : ''}`)
  ok(`${ids.length} scenes over ${LAYERS.length} layers`)
  const subjects = new Set(ids.map((n) => AMBIENT_ART[n].subject))
  check(subjects.size === ids.length, 'no two scenes claim the same subject')
}

/* ---- 2. nothing that could collide with another drawing -------------------- */

console.log('\nnothing that could collide with another drawing')
{
  let bad = 0
  for (const n of ids) {
    const m = AMBIENT_ART[n].draw()
    for (const [re, what] of [
      [/\sid="/, 'an id'],
      [/<defs/, 'a <defs>'],
      [/Gradient/, 'a gradient'],
      [/url\(#/, 'a url(#…) reference'],
      [/<clipPath/, 'a clipPath'],
      [/<filter/, 'a <filter>'],
    ]) {
      if (re.test(m)) { fail(`${n} has ${what} — these all share one document`); bad++ }
    }
  }
  check(bad === 0, 'no scene defines anything the document namespace can share')
}

/* ---- 3. one palette --------------------------------------------------------- */

console.log('\npalette')
{
  const allowed = new Set(Object.values(P).map((c) => c.toLowerCase()))
  const strays = new Map()
  for (const n of ids) {
    for (const m of AMBIENT_ART[n].draw().matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      const v = m[1].toLowerCase()
      if (v === 'none' || v === 'currentcolor') continue
      if (!allowed.has(v)) strays.set(v, (strays.get(v) ?? '') + ' ' + n)
    }
  }
  for (const [v, where] of strays) fail(`colour ${v} is not in the palette (${where.trim()})`)
  check(strays.size === 0, `every fill and stroke is one of the ${allowed.size} palette colours`)
}

/* ---- 4. coverage, at full size and at a small card ------------------------- */

console.log('\ncoverage, and still there when the card shrinks')
{
  let bad = 0
  for (const n of ids) {
    const s0 = shot(n, 100)
    let inked = 0
    for (let i = 3; i < s0.px.length; i += 4) if (s0.px[i] > 140) inked++
    const cover = inked / (s0.W * s0.H)

    const small = shot(n, 44)
    let inkedSmall = 0
    for (let i = 3; i < small.px.length; i += 4) if (small.px[i] > 140) inkedSmall++
    const coverSmall = inkedSmall / (small.W * small.H)

    const notes = []
    if (cover < 0.06) notes.push(`only ${(cover * 100).toFixed(0)}% of the frame is drawn`)
    if (cover > 0.72) notes.push(`${(cover * 100).toFixed(0)}% drawn — that is a backdrop, not a cut-out`)
    if (coverSmall < 0.03) notes.push(`only ${(coverSmall * 100).toFixed(1)}% survives at 44px`)
    if (notes.length) { fail(`${n}: ${notes.join('; ')}`); bad++ }
  }
  check(bad === 0, `all ${ids.length} draw a real amount at both sizes`)
}

/* ---- 5. contrast against the card's own ground ------------------------------ */

console.log('\ncontrast against the card it actually sits on')
{
  let bad = 0
  for (const n of ids) {
    const s = shot(n, 100)
    let best = 1
    for (let i = 0; i < s.W * s.H; i++) {
      if (s.px[i * 4 + 3] < 140) continue
      const l = lum(s.px[i * 4], s.px[i * 4 + 1], s.px[i * 4 + 2])
      const c = (Math.max(l, cardL) + 0.05) / (Math.min(l, cardL) + 0.05)
      if (c > best) best = c
    }
    if (best < 2.2) { fail(`${n}: its brightest tone is only ${best.toFixed(1)}:1 on the card`); bad++ }
  }
  check(bad === 0, `all ${ids.length} read clearly on the card's own dark ground`)
}

/* ---- 6. structure, inside the subject itself -------------------------------- */

console.log('\nstructure, inside the subject itself')
{
  const RATIO = 1.25
  const FLOOR = 0.05
  const rows = []
  let bad = 0
  for (const n of ids) {
    const s = shot(n, 100)
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
    if (d < FLOOR) { fail(`${n}: ${(d * 100).toFixed(1)}% of its own ink sits next to a tone it can be told apart from — that is one flat mass, not a drawing`); bad++ }
  }
  check(bad === 0, `all ${ids.length} have real modelling inside the subject`)
  rows.sort((x, y) => x.d - y.d)
  ok(`flattest ${rows[0].n} ${(rows[0].d * 100).toFixed(1)}%, busiest ${rows[rows.length - 1].n} ${(rows[rows.length - 1].d * 100).toFixed(1)}%`)
}

/* ---- 7. distinctness -------------------------------------------------------- */

console.log('\ndistinctness')
{
  const N = 10
  const sig = (n) => {
    const s = shot(n, 100)
    const out = []
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++) {
        const x0 = Math.floor((gx * s.W) / N), x1 = Math.floor(((gx + 1) * s.W) / N)
        const y0 = Math.floor((gy * s.H) / N), y1 = Math.floor(((gy + 1) * s.H) / N)
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
  const sigs = Object.fromEntries(ids.map((n) => [n, sig(n)]))
  const pairs = []
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = sigs[ids[i]], b = sigs[ids[j]]
      let t = 0
      for (let k = 0; k < a.length; k++) t += Math.abs(a[k] - b[k])
      pairs.push({ a: ids[i], b: ids[j], d: t / a.length })
    }
  pairs.sort((x, y) => x.d - y.d)
  const pack = pairs[Math.min(9, pairs.length - 1)].d
  check(pairs[0].d > pack * 0.55, `closest pair (${pairs[0].a} / ${pairs[0].b}, ${pairs[0].d.toFixed(3)}) against the tenth-closest (${pack.toFixed(3)})`)
}

/* ---- 8. mood ------------------------------------------------------------------ */

console.log('\nmood')
{
  const paletteHex = new Set(Object.values(P).map((c) => c.toLowerCase()))
  let missing = 0, stray = 0
  for (const n of ids) {
    const mood = (MOOD[n] || '').toLowerCase()
    if (!paletteHex.has(mood)) { fail(`${n}: MOOD is ${mood || '(empty)'}, not a palette colour`); stray++; continue }
    const svg = AMBIENT_ART[n].draw()
    const used = new Set([...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1].toLowerCase()))
    if (!used.has(mood)) { fail(`${n}: card is lit by ${mood}, which is not in its own drawing`); missing++ }
  }
  check(missing === 0, 'every card colour genuinely appears in its own scene')
  check(stray === 0, 'every card colour is one of the palette colours')

  const recomputed = Object.fromEntries(ids.map((n) => [n, dominantMood(AMBIENT_ART[n].draw())]))
  const drifted = ids.filter((n) => recomputed[n] !== MOOD[n])
  check(drifted.length === 0, `computed mood matches the exported set${drifted.length ? ': ' + drifted.join(', ') : ''}`)
}

/* ---- 9. determinism, and no emoji ---------------------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const n of ids) if (AMBIENT_ART[n].draw() !== AMBIENT_ART[n].draw()) (fail(`${n} draws differently twice`), drift++)
  check(drift === 0, 'every scene is the same twice')
}

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/ambient-art.ts', 'src/pages/ambient-mix.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

/* ---- output ---------------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 4
  const CW = 200
  const CH = 200
  const rows = Math.ceil(ids.length / COLS)
  const inOrder = LAYERS.map((l) => l.id).filter((id) => AMBIENT_ART[id])
  const body = inOrder
    .map((n, i) => {
      const x = (i % COLS) * CW
      const y = Math.floor(i / COLS) * CH
      return (
        `<g transform="translate(${x} ${y})">` +
        `<rect x="10" y="8" width="180" height="160" rx="12" fill="#16283a"/>` +
        `<svg x="40" y="18" width="120" height="120" viewBox="0 0 100 100">${AMBIENT_ART[n].draw()}</svg>` +
        `<text x="${CW / 2}" y="${CH - 18}" fill="#fff" font-size="13" font-family="sans-serif" text-anchor="middle" opacity="0.9">${n}</text></g>`
      )
    })
    .join('')
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}" viewBox="0 0 ${COLS * CW} ${rows * CH}">` +
      `<rect width="${COLS * CW}" height="${rows * CH}" fill="#0d1a2e"/>${body}</svg>`,
      { fitTo: { mode: 'width', value: COLS * CW } },
    ).render().asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll ambient-art checks passed.')
process.exitCode = failures ? 1 : 0
