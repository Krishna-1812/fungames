/**
 * check-money-globe — does Printing Money's strip of bills go where it says?
 *
 * The page lays the government's spending since you opened it as dollar
 * bills from the Capitol, east along a great circle, and draws it on a globe
 * lit for the minute you are looking. Each of those is a claim a sign error
 * would quietly break:
 *
 *   1. The line: it starts at the Capitol, heading due east, and a quarter of
 *      the way round it is at the equator, halfway round as far south as the
 *      Capitol is north, and all the way round back at the Capitol.
 *   2. The rate: twenty minutes of the government's spending, as bills end
 *      to end, is about once round the Earth, as the page says.
 *   3. The camera: the strip's two ends are in the picture for as long as it
 *      fits on the near side, and after that the whole Earth is shown with
 *      the end of the strip facing you.
 *   4. The Sun: overhead at the tropic of Cancer at noon in Greenwich at the
 *      June solstice, at the equator at the equinoxes, at the tropic of
 *      Capricorn in December, and on the far side of the world at midnight.
 *   5. The shader: no loop with a count the compiler can see (a minute's
 *      freeze on Windows, see Universe Forecast), and the page wired to it.
 *
 *   node scripts/check-money-globe.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const G = await import('../src/lib/money-globe.ts')
const PM = await import('../src/lib/printing-money.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const near = (a, b, tol) => Math.abs(a - b) <= tol
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])

/* -------------------------------------------------------------------------- */
console.log('\nthe line')
/* -------------------------------------------------------------------------- */
{
  const at = (s) => G.latLonOf(G.along(s))
  const s0 = at(0)
  check(near(s0.lat, 38.8899, 1e-6) && near(s0.lon, -77.0091, 1e-6), 'it starts at the Capitol')
  check(near(len(G.START), 1, 1e-12) && near(len(G.HEADING), 1, 1e-12) && near(dot(G.START, G.HEADING), 0, 1e-12), 'its start and its heading are unit lengths at right angles: a great circle')
  const a = at(0.001)
  check(near(a.lat, 38.8899, 1e-3) && a.lon > -77.0091, 'and it sets off due east')
  check(near(at(Math.PI / 2).lat, 0, 1e-9), 'a quarter of the way round it crosses the equator')
  check(near(at(Math.PI).lat, -38.8899, 1e-9), 'halfway round it is as far south as the Capitol is north')
  const back = at(2 * Math.PI)
  check(near(back.lat, 38.8899, 1e-9) && near(back.lon, -77.0091, 1e-9), 'and once round it is back at the Capitol')
  check(near(G.angleOf(G.EARTH_CIRCUMFERENCE_KM), 2 * Math.PI, 1e-12), 'once round is the Earth\'s circumference')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe rate')
/* -------------------------------------------------------------------------- */
{
  const spending = PM.TIERS.find((t) => t.id === 'spending')
  const km = (sec) => PM.billStripLengthM(PM.billCount((PM.dollarsPerHour(spending) / 3600) * sec)) / 1000
  const perSecond = km(1)
  check(perSecond > 30 && perSecond < 36, `about 33 km of bills a second (${perSecond.toFixed(2)})`)
  const lap = G.EARTH_CIRCUMFERENCE_KM / perSecond / 60
  check(lap > 18 && lap < 22, `so round the Earth in about twenty minutes, as the page says (${lap.toFixed(1)})`)
  const page = fs.readFileSync(path.join(root, 'src/pages/printing-money.astro'), 'utf8')
  check(page.includes('go round the Earth in about twenty minutes'), 'and the page says twenty')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe camera')
/* -------------------------------------------------------------------------- */
{
  let lost = [], whole = [], close = 0
  for (const aspect of [16 / 9, 4 / 5]) {
    for (let km = 1; km < 120_000; km *= 1.08) {
      const s = G.angleOf(km)
      const v = G.viewFor(s, aspect)
      if (!(v.scale >= G.WHOLE_EARTH - 1e-9)) close++
      const inside = (p) => { const q = G.project(v, p); return q.front && Math.abs(q.x) <= aspect && Math.abs(q.y) <= 1 }
      if (v.scale > G.WHOLE_EARTH + 1e-9) {
        if (!inside(G.START) || !inside(G.along(s))) lost.push(`${Math.round(km)} km at ${aspect.toFixed(2)}`)
      } else if (!inside(G.along(s))) whole.push(`${Math.round(km)} km at ${aspect.toFixed(2)}`)
    }
  }
  check(!close, 'never further out than the whole Earth')
  check(!lost.length, `while the strip fits on the near side, both its ends are in the picture${lost.length ? ' — not at ' + lost.slice(0, 4).join(', ') : ''}`)
  check(!whole.length, `once it does not, the whole Earth, with the end of the strip facing you${whole.length ? ' — not at ' + whole.slice(0, 4).join(', ') : ''}`)
  const first = G.viewFor(G.angleOf(1), 16 / 9)
  check(first.scale > 2 && near(first.lat, 38.9, 1) && near(first.lon, -77, 1), 'at first, close in over the Capitol')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe Sun')
/* -------------------------------------------------------------------------- */
{
  const june = G.subsolar(new Date('2027-06-21T12:00:00Z'))
  const dec = G.subsolar(new Date('2026-12-21T12:00:00Z'))
  const march = G.subsolar(new Date('2027-03-20T12:00:00Z'))
  const sept = G.subsolar(new Date('2027-09-23T12:00:00Z'))
  check(near(june.lat, 23.44, 0.3) && near(dec.lat, -23.44, 0.3), `over the tropics at the solstices (${june.lat.toFixed(2)}, ${dec.lat.toFixed(2)})`)
  check(near(march.lat, 0, 0.6) && near(sept.lat, 0, 0.6), `over the equator at the equinoxes (${march.lat.toFixed(2)}, ${sept.lat.toFixed(2)})`)
  check(near(june.lon, 0, 1.5) && near(dec.lon, 0, 1.5), 'at noon in Greenwich, within the equation of time of Greenwich')
  const nov = G.subsolar(new Date('2026-11-03T12:00:00Z'))
  check(nov.lon < -3.5 && nov.lon > -4.6, `in early November the Sun is 4° west of Greenwich at noon by the clock (${nov.lon.toFixed(2)}°)`)
  const midnight = G.subsolar(new Date('2027-06-21T00:00:00Z'))
  check(Math.abs(Math.abs(midnight.lon) - 180) < 1.5, 'and on the far side of the world at midnight')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe shader and the page')
/* -------------------------------------------------------------------------- */
{
  const src = fs.readFileSync(path.join(root, 'src/lib/money-globe-shader.ts'), 'utf8')
  const glslPart = src.slice(src.indexOf('export const MONEY_GLOBE_FRAG'))
  const loops = [...glslPart.matchAll(/for \(int \w+ = 0; \w+ < ([^;]+);/g)].map((m) => m[1])
  check(loops.length > 0 && loops.every((b) => b.startsWith('UPTO(')), 'every loop runs to a count the compiler cannot see')
  check(!/\bfbm3?\(/.test(glslPart.replace(/\/\/.*$/gm, '')), 'none of the library\'s looping noise')
  const page = fs.readFileSync(path.join(root, 'src/pages/printing-money.astro'), 'utf8')
  check(page.includes("from '../lib/money-globe-shader'") && page.includes('new ShaderSurface(globeHost, MONEY_GLOBE_FRAG'), 'the page draws the globe')
  check(page.includes('requestIdleCallback') && page.includes("toBlob("), 'and builds it after the page has been seen, not before')
  check(/class="pm-bill"/.test(page) && /function billLie\(/.test(page), 'and lays each bill on the table by itself')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
