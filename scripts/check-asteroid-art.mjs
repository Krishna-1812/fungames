/**
 * check-asteroid-art — is the rock actually a rock, and does it actually turn?
 *
 * asteroid-art.ts adds one claim the rest of the impact model does not make:
 * that the build panel's rock is a real sphere with real craters on it, spun
 * by real orthographic projection rather than a texture that scrolls. None
 * of that is checkable by reading the source — a projection bug and a
 * plausible-looking one both compile. So this renders it.
 *
 *   1. Every composition has a material, every colour in it is a real hex,
 *      and the five bases are not accidentally the same rock twice.
 *   2. craterField places features uniformly *on a sphere*, not uniformly in
 *      latitude — the whole reason it uses asin(2u-1) instead of a plain
 *      linear scale. This is checked statistically, not just for range.
 *   3. projectFeature's foreshortening actually foreshortens: dead-centre is
 *      a circle, the limb is a sliver, the far side is hidden, and a full
 *      turn returns a feature to where it started.
 *   4. Rendered at real size, is it a picture or a blob? Same test
 *      check-scale-art.mjs runs on the Moon — edge density inside the disc,
 *      with a plain lit sphere in the same harness as the control.
 *   5. Can you see it against the stage it sits on?
 *   6. Two frames at the same rotation are pixel-identical; a full rotation
 *      is periodic.
 *
 *   node scripts/check-asteroid-art.mjs [--sheet out.png]
 */
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  ROCK_MATERIAL,
  craterField,
  projectFeature,
  renderRock,
  starField,
  FEATURE_SEED,
  FEATURE_COUNT,
} = await import('../src/lib/asteroid-art.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const COMPS = Object.keys(ROCK_MATERIAL)

/* ---- colour --------------------------------------------------------------- */

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (r, g, b) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255)
const oklab = (r, g, b) => {
  const [R, G, B] = [lin(r / 255), lin(g / 255), lin(b / 255)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ]
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const HEX = /^#[0-9a-f]{6}$/i

/* ---- 1. materials ----------------------------------------------------------- */

console.log('\nmaterials')
{
  let bad = 0
  for (const c of COMPS) {
    const m = ROCK_MATERIAL[c]
    for (const field of ['base', 'fleck', 'glow']) {
      if (!HEX.test(m[field])) { fail(`${c}: ${field} "${m[field]}" is not a hex colour`); bad++ }
    }
    for (const field of ['craterDensity', 'craterDepth', 'fleckDensity', 'metallic']) {
      const v = m[field]
      if (!(v >= 0 && v <= 1)) { fail(`${c}: ${field} ${v} is out of 0..1`); bad++ }
    }
  }
  check(bad === 0, `all ${COMPS.length} materials have valid colours and fractions`)

  let closest = Infinity
  let pair = null
  for (let i = 0; i < COMPS.length; i++)
    for (let j = i + 1; j < COMPS.length; j++) {
      const a = ROCK_MATERIAL[COMPS[i]].base.match(/\w\w/g).map((h) => parseInt(h, 16))
      const b = ROCK_MATERIAL[COMPS[j]].base.match(/\w\w/g).map((h) => parseInt(h, 16))
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      if (d < closest) { closest = d; pair = [COMPS[i], COMPS[j]] }
    }
  check(closest > 40, `closest two materials (${pair.join('/')}) are ${closest.toFixed(0)} apart in RGB — not the same rock twice`)
}

/* ---- 2. uniform on a sphere -------------------------------------------------- */

console.log('\ncraterField — uniform on a sphere, not in latitude')
{
  const f1 = craterField(FEATURE_SEED, FEATURE_COUNT)
  let bad = 0
  for (const f of f1) {
    if (!(f.lon >= 0 && f.lon < Math.PI * 2)) { fail(`lon ${f.lon} out of range`); bad++ }
    if (!(f.lat >= -Math.PI / 2 && f.lat <= Math.PI / 2)) { fail(`lat ${f.lat} out of range`); bad++ }
    if (!(f.r > 0 && f.r < 0.25)) { fail(`r ${f.r} out of range`); bad++ }
    if (!(f.prominence >= 0 && f.prominence <= 1)) { fail(`prominence ${f.prominence} out of range`); bad++ }
  }
  check(bad === 0, `all ${f1.length} features have sane lon/lat/r/prominence`)

  // A large sample: for points uniform on a sphere, E[|sin(lat)|] = 0.5
  // exactly. A naive uniform *latitude* (no asin) instead gives E[|sin(lat)|]
  // = 2/pi ≈ 0.637 — comfortably outside this tolerance — which is exactly
  // the pole-crowding bug this test exists to catch.
  const big = craterField(9, 4000)
  const meanAbsSin = big.reduce((s, f) => s + Math.abs(Math.sin(f.lat)), 0) / big.length
  check(
    Math.abs(meanAbsSin - 0.5) < 0.02,
    `E[|sin(lat)|] over 4000 features is ${meanAbsSin.toFixed(3)}, matching uniform-on-a-sphere's 0.500`,
  )

  const f2 = craterField(FEATURE_SEED, FEATURE_COUNT)
  check(JSON.stringify(f1) === JSON.stringify(f2), 'the same seed draws the same field twice')
}

/* ---- 3. projection ----------------------------------------------------------- */

console.log('\nprojectFeature — real foreshortening')
{
  // A feature at the equator, phased so it faces the camera dead-on.
  const front = { lon: Math.PI / 2, lat: 0, r: 0.1, prominence: 0 }
  const p = projectFeature(front, 0)
  check(p !== null && p.front > 0.999, `dead-centre feature has front ${p?.front.toFixed(4)} ≈ 1`)
  check(Math.abs(p.rx - 1) < 0.01, `dead-centre feature is unforeshortened, rx ${p.rx.toFixed(3)} ≈ 1`)

  // The same feature, rotated a quarter turn to the limb.
  const limb = projectFeature(front, -Math.PI / 2)
  check(limb !== null, 'a feature exactly at the limb is still drawn (not yet past the horizon tolerance)')
  check(limb.rx < 0.2, `at the limb, rx is compressed to ${limb.rx.toFixed(3)}`)

  // Rotated further, onto the far side.
  const back = projectFeature(front, -Math.PI)
  check(back === null, 'a feature on the far side of the sphere is not drawn at all')

  // A full turn returns to the start.
  const again = projectFeature(front, Math.PI * 2)
  check(Math.abs(again.x - p.x) < 1e-9 && Math.abs(again.y - p.y) < 1e-9, 'a full rotation is exactly periodic')
}

/* ---- rendering harness -------------------------------------------------------- */

const STAGE_BG = '#1c0a06' // the .rockStage backdrop in asteroid.astro

function frame(comp, rotation, bg = STAGE_BG) {
  const stars = starField(51, 60)
  const inner = renderRock({ id: 'ck', composition: comp, rotation, stars })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 200 200">` +
    `<rect width="200" height="200" fill="${bg}"/>${inner}</svg>`
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: 240 } }).render()
  const bare = new Resvg(svg.replace(`<rect width="200" height="200" fill="${bg}"/>`, ''), {
    fitTo: { mode: 'width', value: 240 },
  }).render()
  return { px: img.pixels, mask: bare.pixels, W: img.width, H: img.height }
}

/* ---- 4. picture or blob -------------------------------------------------------- */

console.log('\nstructure — is it a picture or a ball?')
{
  const STEP = 0.04
  const FLOOR = 0.02
  let bad = 0
  const rows = []
  for (const c of COMPS) {
    const f = frame(c, 0.7)
    const L = (x, y) => {
      const i = (y * f.W + x) * 4
      return lum(f.px[i], f.px[i + 1], f.px[i + 2])
    }
    let n = 0
    let edge = 0
    for (let y = 1; y < f.H - 1; y++)
      for (let x = 1; x < f.W - 1; x++) {
        if (f.mask[(y * f.W + x) * 4 + 3] < 153) continue
        const l = L(x, y)
        n++
        const d = Math.max(Math.abs(l - L(x - 1, y)), Math.abs(l - L(x + 1, y)), Math.abs(l - L(x, y - 1)), Math.abs(l - L(x, y + 1)))
        if (d >= STEP) edge++
      }
    const density = n ? edge / n : 0
    rows.push({ c, density })
    if (density < FLOOR) { fail(`${c}: ${(density * 100).toFixed(2)}% edge — reads as a shaded ball, not a rock`); bad++ }
  }
  check(bad === 0, `all ${rows.length} materials have surface structure at ${(FLOOR * 100).toFixed(0)}% edge or better`)
  const sorted = [...rows].sort((a, b) => a.density - b.density)
  ok(`smoothest ${sorted[0].c} ${(sorted[0].density * 100).toFixed(1)}%, roughest ${sorted.at(-1).c} ${(sorted.at(-1).density * 100).toFixed(1)}%`)

  const ball =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 200 200">` +
    `<rect width="200" height="200" fill="${STAGE_BG}"/>` +
    `<defs><radialGradient id="g" cx="34%" cy="28%" r="80%">` +
    `<stop offset="0%" stop-color="#c9a06a"/><stop offset="55%" stop-color="#7d6c59"/>` +
    `<stop offset="100%" stop-color="#2f2820"/></radialGradient></defs>` +
    `<circle cx="100" cy="100" r="86" fill="url(#g)"/></svg>`
  const img = new Resvg(ball, { fitTo: { mode: 'width', value: 240 } }).render()
  const bpx = img.pixels
  const L = (x, y) => {
    const i = (y * img.width + x) * 4
    return lum(bpx[i], bpx[i + 1], bpx[i + 2])
  }
  let n = 0
  let edge = 0
  for (let y = 20; y < img.height - 20; y++)
    for (let x = 20; x < img.width - 20; x++) {
      n++
      if (Math.max(Math.abs(L(x, y) - L(x - 1, y)), Math.abs(L(x, y) - L(x + 1, y)), Math.abs(L(x, y) - L(x, y - 1)), Math.abs(L(x, y) - L(x, y + 1))) >= STEP) edge++
    }
  const ballDensity = edge / n
  check(ballDensity < FLOOR, `a plain lit sphere in the same harness scores ${(ballDensity * 100).toFixed(2)}% and would fail this — the bar bites`)
}

/* ---- 5. visible against the stage --------------------------------------------- */

console.log('\nvisible against the stage')
{
  let bad = 0
  const bgOk = oklab(...STAGE_BG.match(/\w\w/g).map((h) => parseInt(h, 16)))
  for (const c of COMPS) {
    const f = frame(c, 0.7)
    let n = 0
    let seen = 0
    for (let y = 0; y < f.H; y++)
      for (let x = 0; x < f.W; x++) {
        if (f.mask[(y * f.W + x) * 4 + 3] < 153) continue
        const i = (y * f.W + x) * 4
        n++
        if (dE(oklab(f.px[i], f.px[i + 1], f.px[i + 2]), bgOk) >= 0.1) seen++
      }
    const frac = n ? seen / n : 0
    if (n < 40) { fail(`${c}: only ${n} opaque pixels`); bad++; continue }
    if (frac < 0.7) { fail(`${c}: only ${(frac * 100).toFixed(0)}% separates from the stage background`); bad++ }
  }
  check(bad === 0, `all ${COMPS.length} materials read clearly against the stage`)
}

/* ---- 6. determinism and periodicity, rendered -------------------------------- */

console.log('\ndeterminism')
{
  let drift = 0
  for (const c of COMPS) {
    const a = renderRock({ id: 'x', composition: c, rotation: 1.3, stars: [] })
    const b = renderRock({ id: 'x', composition: c, rotation: 1.3, stars: [] })
    if (a !== b) { fail(`${c}: renders differently twice at the same rotation`); drift++ }
  }
  check(drift === 0, 'every material draws identically twice at a fixed rotation')

  const a = renderRock({ id: 'x', composition: 'rock', rotation: 0.9, stars: [] })
  const b = renderRock({ id: 'x', composition: 'rock', rotation: 0.9 + Math.PI * 2, stars: [] })
  check(a === b, 'a full rotation renders byte-identical markup')
}

/* ---- 7. no emoji --------------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/lib/asteroid-art.ts', 'src/pages/asteroid.astro']) {
    const body = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
    check(!EMOJI.test(body), `${f} has no emoji in it`)
  }
}

/* ---- output --------------------------------------------------------------------- */

const args = process.argv.slice(2)
const sheetAt = args.indexOf('--sheet')
if (sheetAt >= 0) {
  const CELL = 260
  let body = ''
  COMPS.forEach((c, i) => {
    const x = i * CELL
    const stars = starField(51, 60)
    const inner = renderRock({ id: `sheet${i}`, composition: c, rotation: 0.7, stars })
    body +=
      `<g transform="translate(${x} 0)">` +
      `<rect width="${CELL}" height="${CELL}" fill="${STAGE_BG}"/>` +
      `<svg x="20" y="10" width="${CELL - 40}" height="${CELL - 60}" viewBox="0 0 200 200">${inner}</svg>` +
      `<text x="${CELL / 2}" y="${CELL - 16}" fill="#fff" font-size="14" font-family="sans-serif" text-anchor="middle">${ROCK_MATERIAL[c].name}</text></g>`
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL * COMPS.length}" height="${CELL}" viewBox="0 0 ${CELL * COMPS.length} ${CELL}">${body}</svg>`
  fs.writeFileSync(args[sheetAt + 1], new Resvg(svg, { fitTo: { mode: 'width', value: CELL * COMPS.length } }).render().asPng())
  console.log(`\nwrote ${args[sheetAt + 1]}`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll asteroid-art checks passed.')
process.exitCode = failures ? 1 : 0
