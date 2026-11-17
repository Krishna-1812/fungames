/**
 * check-forecast-stage — is the light on Universe Forecast's stage the light
 * there would be?
 *
 * check-forecast holds the dates and the geometry to the sky. This holds the
 * picture: the parts of it that are claims about the world and could be
 * wrong without anything looking broken.
 *
 *   1. The Moon's face. Its seas are a table of places, and a sign wrong in
 *      a longitude puts the Sea of Crises on the wrong edge of a Moon that
 *      still looks like a Moon.
 *   2. The light of an eclipse: how bright the corona is, what fraction of
 *      the Sun shows from inside the Earth's shadow, how dark a total
 *      eclipse of the Moon is, and where the last of the Sun is when the
 *      Moon has nearly covered it.
 *   3. Where the Sun is overhead at a solstice, by the clock.
 *   4. The meteor showers: each one's radiant is in the constellation it is
 *      named for, and its speed is one a meteor can have.
 *   5. The shaders, as text. They once took a browser over a minute to
 *      compile, because of things that are easy to write again: a loop with
 *      a count the compiler can see, the library's looping noise. So those
 *      are looked for.
 *
 *   node scripts/check-forecast-stage.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const M = await import('../src/lib/forecast-moon.ts')
const L = await import('../src/lib/forecast-light.ts')
const { SHOWERS } = await import('../src/lib/sky-forecast.ts')
const { STAR_TUPLES } = await import('../src/data/star-catalog.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const D2R = Math.PI / 180

/* -------------------------------------------------------------------------- */
console.log('\nthe Moon’s near side')
/* -------------------------------------------------------------------------- */
{
  // Which way round: Crisium is on the right-hand edge, Plato near the top, Tycho low down.
  const crisium = M.moonDir(17.0, 59.1), plato = M.moonDir(51.6, -9.3), tycho = M.moonDir(-43.3, -11.4)
  check(crisium[0] > 0.75 && plato[1] > 0.75 && tycho[1] < -0.6 && tycho[2] > 0.6,
    'Crisium to the east edge, Plato to the north, Tycho in the south and facing us')

  const middles = M.SEAS.filter((s) => M.seaAt(s[1], s[2]) < s[6] - 0.02)
  check(middles.length === 0, `every one of the ${M.SEAS.length} seas is sea at its own middle${middles.length ? ' — not ' + middles.map((s) => s[0]).join(', ') : ''}`)

  const highlands = [[-60, 20], [-45, 10], [-30, 62], [65, 50], [-70, -40], [40, 60]]
  check(highlands.every(([la, lo]) => M.seaAt(la, lo) < 0.05), 'the southern highlands and the north-east are not')
  check(M.seaAt(17, 45) < 0.1, 'Crisium stands alone: highland between it and Tranquillitatis')

  // Area-weighted over the hemisphere, not over the disc.
  let sea = 0, all = 0
  for (let lat = -89; lat <= 89; lat += 2) for (let lon = -89; lon <= 89; lon += 2) {
    const w = Math.cos(lat * D2R); all += w
    if (M.seaAt(lat, lon) > 0.5) sea += w
  }
  const share = sea / all
  check(share > 0.18 && share < 0.4, `about a third of the near side is sea, as it is (${(share * 100).toFixed(0)}%)`)

  // West has far more of it than east: Procellarum.
  let west = 0, east = 0
  for (let lat = -60; lat <= 60; lat += 3) for (let lon = 30; lon <= 80; lon += 3) {
    east += M.seaAt(lat, lon) > 0.5 ? 1 : 0; west += M.seaAt(lat, -lon) > 0.5 ? 1 : 0
  }
  check(west > east * 1.3, `more sea toward the west edge than the east: the Ocean of Storms (${west} against ${east})`)

  check(M.toneAt(-43.3, -11.4) > M.toneAt(-52, 12) + 0.3, 'Tycho is brighter than the highland round it')
  check(M.toneAt(9.6, -20.1) > 1.2 && M.toneAt(32.8, -15.6) < 0.5, 'Copernicus is a bright patch in a dark sea; the middle of Imbrium reflects under half what highland does')
  // Tycho's rays reach a long way; Kepler's do not.
  const rayed = (lat, lon) => M.toneAt(lat, lon) - (1 - M.SEA_DIM * M.seaAt(lat, lon))
  let far = 0
  for (let a = 0; a < 360; a += 5) far = Math.max(far, rayed(-43.3 + 25 * Math.sin(a * D2R), -11.4 + 25 * Math.cos(a * D2R) / Math.cos(43.3 * D2R)))
  check(far > 0.1, `Tycho’s rays are still there 25° away (${far.toFixed(2)})`)

  const size = 96
  const px = M.moonMap(size)
  const at = (lat, lon) => { const m = M.moonDir(lat, lon); const i = Math.floor((m[0] * 0.5 + 0.5) * size), j = Math.floor((0.5 - m[1] * 0.5) * size); return (j * size + i) * 4 }
  let opaque = true
  for (let k = 3; k < px.length; k += 4) if (px[k] !== 255) opaque = false
  check(px.length === size * size * 4 && opaque, 'the map is the size asked for, and has no holes in it')
  check(px[at(17, 59)] > 200 && px[at(-60, 20)] < 20 && px[at(-43.3, -11.4) + 1] > 60,
    'and says the same: red at Crisium, none in the highlands, green at Tycho')
  // A corner is off the disc. What it should hold is the limb in that direction.
  const c = (1 - 0.5 / size) * 0.999 / Math.hypot(1 - 0.5 / size, 1 - 0.5 / size)
  const limb = M.seaAt(Math.asin(c) / D2R, Math.atan2(-c, Math.sqrt(Math.max(0, 1 - 2 * c * c))) / D2R)
  check(Math.abs(px[0] - Math.round(255 * limb)) <= 2, 'its corners carry the edge of the disc outward, not a blank')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe light of a solar eclipse')
/* -------------------------------------------------------------------------- */
{
  const at1 = L.coronaFall(1)
  check(Math.abs(at1 - 4.0432e-6) < 1e-10, `the corona at the Sun’s edge is four millionths of the Sun’s face (${at1.toExponential(3)})`)
  let falling = true
  for (let r = 1; r < 6; r += 0.1) if (L.coronaFall(r + 0.1) >= L.coronaFall(r)) falling = false
  check(falling && L.coronaFall(2) < at1 / 100 && L.coronaFall(4) > at1 / 1e5, 'and falls away: under a hundredth by two radii, still there at four')
  check(L.CORONA_GLSL.includes('1.4250') && L.CORONA_GLSL.includes('17.0'), 'the shader’s copy of that fit is written from the same numbers')

  let ragged = true, periodic = true
  for (let th = -3.1; th < 3.1; th += 0.01) {
    const r = L.moonLimb(th, 1)
    if (Math.abs(r - 1) > 0.004) ragged = false
    if (Math.abs(r - L.moonLimb(th + 2 * Math.PI, 1)) > 1e-9) periodic = false
  }
  check(ragged && periodic, 'the Moon’s edge wanders by under half a per cent, and joins up after a turn')

  const left = (mx, my, rm) => {
    const r = L.sunLeft(mx, my, rm)
    let sum = 0, away = true, onEdge = true
    for (let i = 0; i < L.GLINTS; i++) {
      const [x, y, o] = [r.glints[i * 3], r.glints[i * 3 + 1], r.glints[i * 3 + 2]]
      sum += o
      if (o > 0 && x * -mx + y * -my <= 0) away = false
      if (o > 0 && (Math.hypot(x, y) > 1 || Math.hypot(x, y) < 0.5)) onEdge = false
    }
    return { open: r.open, sum, away, onEdge }
  }
  const clear = left(5, 0, 1.05), total = left(0, 0, 1.05), ring = left(0, 0, 0.95), sliver = left(0.06, 0, 1.05), half = left(1.0, 0.2, 1.05)
  check(Math.abs(clear.open - 1) < 1e-9, 'with the Moon nowhere near, the whole edge of the Sun is clear')
  check(total.open === 0 && total.sum === 0, 'with a larger Moon dead centre, none of it is: totality')
  check(ring.open > 0.8 && ring.open < 1, `with a smaller Moon dead centre, nearly all of it is: a ring (${ring.open.toFixed(2)})`)
  check(sliver.open > 0 && sliver.open < 0.05 && sliver.away, `six hundredths off centre there is a last sliver, on the side away from the Moon (${sliver.open.toFixed(3)})`)
  check(half.open > sliver.open && half.open < clear.open, 'and a half-covered Sun is in between')
  check([clear, ring, sliver, half].every((r) => Math.abs(r.sum - r.open) < 1e-6 && r.onEdge), 'the places the glare comes from add up to what is left, and are on the Sun')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe light in the Earth’s shadow')
/* -------------------------------------------------------------------------- */
{
  const u = 0.73, p = 1.28
  check(L.sunSeen(u, u, p) === 0 && L.sunSeen(p, u, p) === 1 && L.sunSeen(0.2, u, p) === 0 && L.sunSeen(2, u, p) === 1,
    'no Sun at all from inside the umbra, all of it from outside the penumbra')
  let rising = true
  for (let r = u; r < p; r += 0.005) if (L.sunSeen(r + 0.005, u, p) < L.sunSeen(r, u, p)) rising = false
  const mid = L.sunSeen((u + p) / 2, u, p)
  check(rising && mid > 0.45 && mid < 0.6, `more of it the further out, and about half where the Earth’s edge crosses its middle (${mid.toFixed(2)})`)

  const deep = L.shadowLight(u * 0.5, u, p), centre = L.shadowLight(0, u, p), edge = L.shadowLight(u * 0.95, u, p)
  check(deep[0] > deep[1] * 3 && deep[1] > deep[2], 'inside the umbra the light is red')
  check(edge[0] > centre[0] * 8, 'and several times dimmer at the middle than near the edge')
  check(edge[2] / edge[0] > deep[2] / deep[0] * 3, 'with a bluer rim, where the light has only just cleared the Earth')
  check(deep[0] > 1e-6 && deep[0] < 2e-4, `a ten-thousandth of sunlight or less: ${deep[0].toExponential(1)}`)
  check(L.SHADOW_GLSL.includes(L.UMBRA.glow.toExponential(2)) && L.SHADOW_GLSL.includes('0.920, 0.110, 0.028'), 'the shader’s copy is written from the same numbers')

  const out = L.moonLevel(2, 0, 0.27, u, p), half = L.moonLevel(u, 0, 0.27, u, p), inn = L.moonLevel(0.1, 0.1, 0.27, u, p)
  check(out > 0.99, 'a Moon outside the shadow is as bright as a Moon is')
  check(half > 0.2 && half < 0.6, `one half in is still mostly seen by its lit half (${half.toFixed(2)})`)
  check(inn < 1e-4 && inn > 1e-6, `one wholly inside is ten thousand times dimmer or more (${inn.toExponential(1)})`)
}

/* -------------------------------------------------------------------------- */
console.log('\nwhere the Sun is overhead')
/* -------------------------------------------------------------------------- */
{
  const june = L.sunOverhead('june', new Date('2027-06-21T12:00:00Z'))
  const dec = L.sunOverhead('december', new Date('2026-12-21T00:00:00Z'))
  const sept = L.sunOverhead('september', new Date('2027-09-23T18:00:00Z'))
  const march = L.sunOverhead('march', new Date('2027-03-20T06:00:00Z'))
  check(june.lat === 23.44 && dec.lat === -23.44 && sept.lat === 0 && march.lat === 0, 'over a tropic at a solstice and the equator at an equinox')
  check(Math.abs(june.lon) < 1, `at noon in Greenwich in June, within a degree of Greenwich (${june.lon.toFixed(2)}°)`)
  check(Math.abs(Math.abs(dec.lon) - 180) < 1, 'at midnight there, the far side of the world')
  check(Math.abs(sept.lon + 90) < 2.5 && Math.abs(march.lon - 90) < 2.5, 'six hours after noon, a quarter of the way west; six before, a quarter east')
  check(sept.lon < -90 && march.lon > 90, 'and off by the sundial’s error the right way: ahead of the clock in September, behind it in March')
  let inRange = true
  for (let h = 0; h < 24; h += 0.25) { const o = L.sunOverhead('june', new Date(Date.UTC(2027, 5, 21, 0, h * 60))); if (!(o.lon >= -180 && o.lon < 180)) inRange = false }
  check(inRange, 'a longitude between 180° west and 180° east at every quarter hour of the day')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe meteor showers')
/* -------------------------------------------------------------------------- */
{
  const sep = (a, b, c, d) => Math.acos(Math.min(1, Math.sin(b * D2R) * Math.sin(d * D2R) + Math.cos(b * D2R) * Math.cos(d * D2R) * Math.cos((a - c) * D2R))) / D2R
  for (const s of SHOWERS) {
    let best = 999, who = ''
    for (const t of STAR_TUPLES) {
      if (t[3] > 4.5) break   // brightest first
      if (t[8] !== s.con) continue
      const d = sep(s.radiant[0], s.radiant[1], t[1], t[2])
      if (d < best) { best = d; who = t[5] || `${t[6]} ${t[8]}` }
    }
    check(best < 12, `the ${s.name} come from ${s.con}: ${best.toFixed(1)}° from ${who}`)
  }
  // Nothing bound to the Sun arrives slower than the Earth's escape speed or faster than a head-on meeting at its orbit.
  check(SHOWERS.every((s) => s.speed >= 11.2 && s.speed <= 72.8), 'each at a speed a meteor can have, 11 to 73 km/s')
  const byName = Object.fromEntries(SHOWERS.map((s) => [s.name, s]))
  check(byName.Leonids.speed > byName.Perseids.speed && byName.Perseids.speed > byName.Geminids.speed, 'the Leonids fastest, the Geminids slowest')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe shaders, as written')
/* -------------------------------------------------------------------------- */
{
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
  const stage = read('src/lib/forecast-stage.ts'), moon = read('src/lib/forecast-moon.ts'), light = read('src/lib/forecast-light.ts')
  const page = read('src/pages/universe-forecast.astro')
  const glsl = stage + moon.slice(moon.indexOf('export const MOON_GLSL')) + light

  const scenes = ['solar', 'lunar', 'moon', 'season', 'apsis', 'shower']
  check(scenes.every((s) => new RegExp(`\\b${s}: glsl\\(`).test(stage)), 'a program for each of the six scenes, and not one for all of them')
  check((stage.match(/void main\(\)/g) ?? []).length === scenes.length, 'each with its own main')

  const loops = [...glsl.matchAll(/for \(int \w+ = 0; \w+ < ([^;]+);/g)].map((m) => m[1])
  const seen = loops.filter((b) => !b.startsWith('UPTO('))
  check(loops.length >= 6 && seen.length === 0, `every loop runs to a count the compiler cannot see (${loops.length} loops${seen.length ? ', but not: ' + seen.join(' | ') : ''})`)
  check(!/\bfbm3?\(|\bridge3?\(/.test(glsl.replace(/\/\/.*$/gm, '')), 'none of the library’s looping noise')
  check(!/const (vec3|float) \w+\[\d+\] = /.test(glsl), 'no table for a loop to index: the Moon’s is a picture')

  // The batch holds sixteen.
  const size = Number(/const int NOISES = (\d+);/.exec(stage)?.[1])
  const asked = [...glsl.matchAll(/noises\((\d+)\)/g)].map((m) => +m[1])
  const slots = [
    ...[...glsl.matchAll(/NP\[(\d+)\] = /g)].map((m) => +m[1]),
    ...[...glsl.matchAll(/ask2\((\d+),/g)].map((m) => +m[1] + 1),
    ...[...glsl.matchAll(/ask3\((\d+),/g)].map((m) => +m[1] + 2),
  ]
  check(size === 16 && asked.length >= 4 && Math.max(...asked) <= size && Math.max(...slots) < size,
    `no scene asks for more noise at once than the batch holds (${Math.max(...asked)} of ${size})`)

  check(page.includes("from '../lib/forecast-stage'") && /function surfaceFor\(scene: StageScene\)/.test(page) && page.includes('surface?.dispose()'),
    'the page builds one scene at a time and lets the last one go')
  check(scenes.every((s) => page.includes(`look.scene = '${s}'`)), 'and has a way to every one of the six')
  check(/const near = new IntersectionObserver/.test(page) && page.includes('moonMapUrl()'), 'the Moon’s own panel waits until it is nearly in view, and uses the same map')
  check(/lit \? lightScene\(lead!, t\) : drawScene\(sctx, lead!, t\)/.test(page) && page.includes('return drawScene(sctx, ev, t)'),
    'the flat drawing is still there for a browser that cannot do this, or a scene that will not build')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
