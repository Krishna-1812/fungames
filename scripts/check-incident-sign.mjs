/**
 * check-incident-sign — does Days Since Incident's sign behave like the thing
 * it is drawn as?
 *
 *   1. The drums: a card let go past upright falls under gravity, strikes
 *      the stack, bounces back a little and settles, in the fraction of a
 *      second a real split-flap takes; never through the stack, never
 *      settling short of it.
 *   2. Turning: a drum steps through every card between where it is and
 *      where it is asked to be, 9 round to 0, and a blank drum being set
 *      turns up from 0.
 *   3. The wall: its shader has no loop a compiler can count (a minute's
 *      freeze on Windows, see Universe Forecast), and the page tells it
 *      where the sign is, in its own pixels.
 *
 *   node scripts/check-incident-sign.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const F = await import('../src/lib/split-flap.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* -------------------------------------------------------------------------- */
console.log('\nthe fall')
/* -------------------------------------------------------------------------- */
{
  for (const fps of [30, 60, 144]) {
    let f = F.startFall(), first = null, maxTheta = 0, minAfter = Infinity
    while (!f.done && f.t < 2) {
      const h = f.hits
      f = F.stepFall(f, 1 / fps)
      maxTheta = Math.max(maxTheta, f.theta)
      if (f.hits && !h) first = f.t
      if (f.hits) minAfter = Math.min(minAfter, f.theta)
    }
    check(f.done && f.theta === Math.PI, `at ${fps} fps the card comes to rest on the stack`)
    check(maxTheta <= Math.PI + 1e-9, `and never passes through it (${fps} fps)`)
    check(first > 0.08 && first < 0.25 && f.t < 0.45, `it strikes after ${(first * 1000).toFixed(0)} ms and rests by ${(f.t * 1000).toFixed(0)} ms, a split-flap's clack (${fps} fps)`)
    check(f.hits >= 2 && minAfter < Math.PI - 0.02 && minAfter > Math.PI / 2, `and bounces back off the stack, a little (${f.hits} strikes)`)
  }
  // Gravity, not a tween: the second half of the fall is quicker than the first.
  let f = F.startFall(), half = null
  while (!f.hits) { f = F.stepFall(f, 1 / 1000); if (half === null && f.theta >= Math.PI / 2) half = f.t }
  check(half > (f.t - half), `it falls faster as it goes: ${(half * 1000).toFixed(0)} ms to level, ${((f.t - half) * 1000).toFixed(0)} ms from there down`)
}

/* -------------------------------------------------------------------------- */
console.log('\nturning the drum')
/* -------------------------------------------------------------------------- */
{
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  check(eq(F.cardsBetween('3', '7'), ['4', '5', '6', '7']), '3 to 7 turns through 4, 5 and 6')
  check(eq(F.cardsBetween('9', '0'), ['0']), '9 to 0 is one card: the drum goes round')
  check(eq(F.cardsBetween('7', '2'), ['8', '9', '0', '1', '2']), '7 to 2 goes forward round the drum, never backward')
  check(eq(F.cardsBetween(' ', '2'), ['0', '1', '2']) && eq(F.cardsBetween('5', ' '), [' ']) && eq(F.cardsBetween('4', '4'), []), 'a blank drum turns up from 0; blanking is one card; staying put is none')
  const cell = F.flapCellHTML()
  check((cell.match(/<i>/g) || []).length === 4 && /sf-flap/.test(cell) && /sf-axle/.test(cell), 'each cell has the two still halves, a falling card with a face and a back, and the axle')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe wall')
/* -------------------------------------------------------------------------- */
{
  const src = fs.readFileSync(path.join(root, 'src/lib/incident-wall-shader.ts'), 'utf8')
  const loops = [...src.matchAll(/for \(int \w+ = 0; \w+ < ([^;]+);/g)].map((m) => m[1])
  check(loops.length > 0 && loops.every((b) => b.startsWith('UPTO(')), 'every loop runs to a count the compiler cannot see')
  check(!/\bfbm3?\(/.test(src.replace(/\/\/.*$/gm, '')) && !/\bhalf\b/.test(src.slice(src.indexOf('glsl(`')).replace(/\/\/.*$/gm, '')), 'none of the library\'s looping noise, and no GLSL reserved word as a name')
  const page = fs.readFileSync(path.join(root, 'src/pages/days-since-incident.astro'), 'utf8')
  check(page.includes('new ShaderSurface(scene, INCIDENT_WALL_FRAG') && /still: true/.test(page), 'the page draws the wall once, still')
  check(/pxPerMm = \(\(r\.right - r\.left\) \* k\) \/ 900/.test(page) && /H - \(r\.bottom - s\.top\) \* k/.test(page), 'and tells it where the 900 mm sign is, in the canvas\'s own pixels, y up')
  check(/new FlapBoard\(/.test(page) && /prefersReducedMotion, clack/.test(page), 'the counters are drums, which simply change when motion is reduced')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
