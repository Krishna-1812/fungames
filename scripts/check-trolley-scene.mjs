/**
 * check-trolley-scene — does the picture say what the dilemma says?
 *
 * `check-trolley.mjs` already proves the twenty-six dilemmas are written well
 * enough for the four ethical positions to be worth naming. This is the other
 * half: the scene is the only place the player learns *who is where*, and it
 * is built at runtime from the same data, so nothing about it was ever checked.
 *
 * What it asks:
 *
 *   1. Does every dilemma render, and does anything paint outside the frame?
 *      The svg is `overflow: visible` on the page, so a stroke that overshoots
 *      does not clip — it lands on the card.
 *   2. Are the token kinds distinguishable? Five people, five lobsters and five
 *      chickens are three different answers, and if they read as the same row
 *      of dots the dilemma is unanswerable.
 *   3. Does each token actually appear? A `kind` with no branch in the drawing
 *      silently renders nothing, and the page would just show an empty track
 *      where five people are supposed to be.
 *   4. Do the figures separate from what they stand on? They stand on ballast,
 *      not on the card, and the ballast is a mid brown.
 *   5. Do the three special cases hold? The footbridge has no lever and no
 *      second rail; a dead lever's branch is drawn dashed; a loop puts nobody
 *      on the branch because the branch comes back.
 *   6. Is the tram on the rail at both ends of its run? The page animates it
 *      with geometry from the same module, and the two could drift apart.
 *
 *   node scripts/check-trolley-scene.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { DILEMMAS } = await import('../src/data/dilemmas.ts')
const { sceneSvg, tramMarkup, GEO } = await import('../src/lib/trolley-scene.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const oklab = (r, g, b) => {
  const [R, G, B] = [lin(r / 255), lin(g / 255), lin(b / 255)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/* The scene is 320 units wide and the card gives it about 560 device pixels on
   a desktop, so everything here renders at 560 — the size a player sees. */
const PX = 560
const K = PX / GEO.W

function render(inner, pad = 0) {
  const vb = `${-pad} ${-pad} ${GEO.W + pad * 2} ${GEO.H + pad * 2}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: Math.round((GEO.W + pad * 2) * K) } }).render()
  // `.pixels` allocates a fresh buffer per read — the scale checker died of
  // reading it inside a loop.
  return { px: img.pixels, W: img.width, H: img.height }
}
const at = (s, x, y) => {
  const i = (Math.round(y) * s.W + Math.round(x)) * 4
  return [s.px[i], s.px[i + 1], s.px[i + 2], s.px[i + 3]]
}

/* ---- 1. every dilemma renders, inside its frame ------------------------- */

console.log('\nevery dilemma, inside its own frame')
{
  let bad = 0
  for (const d of DILEMMAS) {
    let inner
    try {
      inner = sceneSvg(d.scene)
    } catch (e) {
      fail(`${d.title}: sceneSvg threw — ${e.message}`)
      bad++
      continue
    }
    if (!inner || inner.length < 400) {
      fail(`${d.title}: drew almost nothing (${inner.length} chars)`)
      bad++
      continue
    }
    // A margin ring around the viewBox. The page does not clip this svg, so
    // anything out here lands on the white card behind it.
    const pad = 14
    const s = render(inner, pad)
    // Two pixels of slack at the boundary. The ground rect *is* the frame, so
    // its antialiased edge lands half a pixel outside a boundary computed
    // exactly — which reported all twenty-six as overflowing by an identical
    // 3.9%, a number that turned out to be one pixel around the rim.
    const bx = Math.round(pad * K) - 2
    let ring = 0
    let painted = 0
    for (let y = 0; y < s.H; y++)
      for (let x = 0; x < s.W; x++) {
        if (x >= bx && x < s.W - bx && y >= bx && y < s.H - bx) continue
        ring++
        if (s.px[(y * s.W + x) * 4 + 3] > 24) painted++
      }
    const f = painted / ring
    if (f > 0.02) {
      fail(`${d.title}: ${(f * 100).toFixed(1)}% of the margin outside the frame is painted`)
      bad++
    }
  }
  check(bad === 0, `all ${DILEMMAS.length} render and stay inside 0 0 ${GEO.W} ${GEO.H}`)
}

/* ---- 2. the token kinds are three different answers --------------------- */

console.log('\nfive people, five lobsters and five chickens are different pictures')
{
  const kinds = ['people', 'lobsters', 'chickens', 'box']
  const sig = (kind) => {
    const s = render(sceneSvg({ straight: { kind, n: kind === 'box' ? 1 : 5 } }))
    // Only the patch the tokens occupy, at the size they render.
    const x0 = Math.round((GEO.STOP - 34) * K)
    const x1 = Math.round((GEO.STOP + 34) * K)
    const y0 = Math.round((GEO.Y_STRAIGHT - 22) * K)
    const y1 = Math.round((GEO.Y_STRAIGHT + 4) * K)
    const N = 12
    const out = []
    for (let gy = 0; gy < N; gy++)
      for (let gx = 0; gx < N; gx++) {
        let r = 0
        let g = 0
        let b = 0
        let c = 0
        for (let y = y0 + Math.floor(((y1 - y0) * gy) / N); y < y0 + Math.floor(((y1 - y0) * (gy + 1)) / N); y++)
          for (let x = x0 + Math.floor(((x1 - x0) * gx) / N); x < x0 + Math.floor(((x1 - x0) * (gx + 1)) / N); x++) {
            const p = at(s, x, y)
            r += p[0]
            g += p[1]
            b += p[2]
            c++
          }
        if (c) out.push(r / c / 255, g / c / 255, b / c / 255)
      }
    return out
  }
  const sigs = Object.fromEntries(kinds.map((k) => [k, sig(k)]))
  let worst = { d: Infinity, a: '', b: '' }
  for (let i = 0; i < kinds.length; i++)
    for (let j = i + 1; j < kinds.length; j++) {
      const a = sigs[kinds[i]]
      const b = sigs[kinds[j]]
      let t = 0
      for (let k = 0; k < a.length; k++) t += Math.abs(a[k] - b[k])
      const d = t / a.length
      if (d < worst.d) worst = { d, a: kinds[i], b: kinds[j] }
    }
  // Four kinds is six pairs, which is too few for the outlier test the icon
  // and scene sets use — with a sample this small the minimum is not an order
  // statistic worth reasoning about, so this is a plain floor.
  check(worst.d > 0.02, `closest kinds are ${worst.a} and ${worst.b} at ${worst.d.toFixed(3)}`)
}

/* ---- 3. every token kind actually draws something ----------------------- */

console.log('\nnothing silently renders nothing')
{
  const used = new Set()
  for (const d of DILEMMAS) {
    for (const t of [d.scene.straight, d.scene.branch]) if (t && t.kind) used.add(t.kind)
  }
  const bare = render(sceneSvg({}))
  let bad = 0
  for (const kind of used) {
    if (kind === 'empty') continue
    const s = render(sceneSvg({ straight: { kind, n: kind === 'box' ? 1 : 3 } }))
    // Count pixels in the token patch that differ from the same patch with no
    // token in it. A kind the drawing does not handle scores zero.
    const x0 = Math.round((GEO.STOP - 30) * K)
    const x1 = Math.round((GEO.STOP + 30) * K)
    const y0 = Math.round((GEO.Y_STRAIGHT - 34) * K)
    const y1 = Math.round((GEO.Y_STRAIGHT + 2) * K)
    let diff = 0
    let n = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        n++
        const a = at(s, x, y)
        const b = at(bare, x, y)
        if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 24) diff++
      }
    const f = diff / n
    if (f < 0.04) {
      fail(`token kind "${kind}" changes ${(f * 100).toFixed(1)}% of its patch — it draws nothing`)
      bad++
    }
  }
  check(bad === 0, `all ${used.size} token kinds used by the dilemmas draw something`)
}

/* ---- 4. the figures separate from what they stand on -------------------- */

console.log('\nfigures against the ballast they stand on')
{
  let bad = 0
  for (const [kind, colour] of [
    ['people', 'people'],
    ['you', 'you'],
    ['friend', 'friend'],
    ['lobsters', 'lobsters'],
    ['chickens', 'chickens'],
  ]) {
    const s = render(sceneSvg({ straight: { kind, n: 5 } }))
    // The ballast is what is behind them; sample it away from the group.
    const ground = oklab(...at(s, Math.round(60 * K), Math.round(GEO.Y_STRAIGHT * K)).slice(0, 3))
    const x0 = Math.round((GEO.STOP - 32) * K)
    const x1 = Math.round((GEO.STOP + 32) * K)
    const y0 = Math.round((GEO.Y_STRAIGHT - 20) * K)
    const y1 = Math.round(GEO.Y_STRAIGHT * K)
    let peak = 0
    let seen = 0
    let n = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const d = dE(oklab(...at(s, x, y).slice(0, 3)), ground)
        n++
        if (d >= 0.1) seen++
        if (d > peak) peak = d
      }
    if (peak < 0.3 || seen / n < 0.1) {
      fail(`${colour}: peak dE ${peak.toFixed(2)}, ${((seen / n) * 100).toFixed(0)}% of the patch differs`)
      bad++
    }
  }
  check(bad === 0, 'every figure colour reads against the ballast')
}

/* ---- 5. the three special cases ----------------------------------------- */

console.log('\nthe scene tells the truth about the setup')
{
  const has = (sc, re) => re.test(sceneSvg(sc))
  check(!has({ bridge: true }, /class="switch"/), 'the footbridge case draws no lever, because it has none')
  check(has({}, /class="switch"/), 'every other case does draw one')
  check(has({ dead: true }, /stroke-dasharray="6 6"/), 'a lever wired to nothing gets a dashed branch')
  check(!has({}, /stroke-dasharray="6 6"/), 'a live branch is solid')
  check(
    sceneSvg({ loop: true, branch: { kind: 'people', n: 5 } }) ===
      sceneSvg({ loop: true, branch: { kind: 'people', n: 1 } }),
    'a looping branch draws nobody on it, because the branch comes back',
  )
  const bridged = DILEMMAS.filter((d) => d.scene.bridge)
  check(bridged.length > 0, `${bridged.length} dilemma(s) use the footbridge`)
  const dead = DILEMMAS.filter((d) => d.scene.dead)
  check(dead.length > 0, `${dead.length} dilemma(s) use a dead lever`)
}

/* ---- 6. the tram is on the rail ----------------------------------------- */

/* The page animates the tram with GEO's own numbers, so if the drawing and the
   geometry ever disagree the tram floats beside the track and nothing says so. */
console.log('\nthe tram runs on the rail')
{
  const railBand = (s, cx, cy) => {
    // The tram's wheels sit at y = cy - 2.2 in its own frame; the rail centre
    // is cy. Look for the iron of the bogies within a few units of the rail.
    let found = 0
    for (let y = Math.round((cy - 8) * K); y < Math.round((cy + 3) * K); y++)
      for (let x = Math.round((cx - 16) * K); x < Math.round((cx + 18) * K); x++) {
        const p = at(s, x, y)
        // #3d1f14 iron, allowing for antialiasing.
        if (p[0] < 90 && p[1] < 60 && p[2] < 50) found++
      }
    return found
  }
  for (const [where, x, y] of [
    ['the start', GEO.START, GEO.Y_STRAIGHT],
    ['the straight end', GEO.STOP - 30, GEO.Y_STRAIGHT],
    ['the branch end', GEO.STOP - 30, GEO.Y_BRANCH],
  ]) {
    const s = render(sceneSvg({}, [x, y]))
    check(railBand(s, x, y) > 40, `the tram's bogies land on the rail at ${where}`)
  }
  check(/id="trolley"/.test(tramMarkup()), 'the tram keeps the id the page translates')
}

/* ---- 7. determinism ----------------------------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const d of DILEMMAS) if (sceneSvg(d.scene) !== sceneSvg(d.scene)) drift++
  check(drift === 0, 'every scene is the same twice — the scatter is seeded')
}

/* ---- output ------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const COLS = 3
  const CW = GEO.W + 8
  const CH = GEO.H + 26
  const rows = Math.ceil(DILEMMAS.length / COLS)
  const body = DILEMMAS.map((d, i) => {
    const x = (i % COLS) * CW
    const y = Math.floor(i / COLS) * CH
    return (
      `<g transform="translate(${x} ${y})">` +
      `<svg x="4" y="4" width="${GEO.W}" height="${GEO.H}" viewBox="0 0 ${GEO.W} ${GEO.H}">${sceneSvg(
        d.scene,
      )}</svg>` +
      `<text x="${CW / 2}" y="${CH - 6}" fill="#4b4038" font-size="11" font-family="sans-serif" ` +
      `text-anchor="middle">${d.title.replace(/&/g, '&amp;')}</text></g>`
    )
  }).join('')
  fs.writeFileSync(
    args[sheetAt + 1],
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rows * CH}" ` +
        `viewBox="0 0 ${COLS * CW} ${rows * CH}"><rect width="${COLS * CW}" height="${
          rows * CH
        }" fill="#fbf3ec"/>${body}</svg>`,
      { fitTo: { mode: 'width', value: COLS * CW } },
    )
      .render()
      .asPng(),
  )
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll trolley-scene checks passed.')
process.exitCode = failures ? 1 : 0
