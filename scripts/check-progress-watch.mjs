/**
 * check-progress-watch — does Progress's watch tell the time it is given?
 *
 * The watch is drawn by the browser and this cannot look at it. What it can
 * check is the arithmetic the hands are set from, and that the drawing has a
 * part for every span the register lists:
 *
 *   1. The hands, at instants worked by hand.
 *   2. The Sun: overhead at Greenwich at noon UTC, on the equator at the
 *      equinoxes and the tropics at the solstices.
 *   3. The Moon: dark when new, round when full, lit on the right while it
 *      waxes.
 *   4. The year's drums: they read the year for nearly all of it and turn
 *      over at the end, the tens only in a year ending in nine.
 *   5. The 32 bits, and the instant they run out.
 *   6. The drawing: a part for every span, two layers, no id used twice.
 *
 *   node scripts/check-progress-watch.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const W = await import('../src/lib/progress-watch.ts')
const T = await import('../src/lib/progress-time.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const near = (a, b, tol) => Math.abs(a - b) <= tol

console.log('\nthe hands')
{
  const a = W.handAngles(new Date(2026, 10, 16, 15, 30, 15, 0))
  check(a.second === 90 && near(a.minute, 181.5, 1e-9) && near(a.hour, 105.125, 1e-9), 'quarter past, half past, and a little after three')
  const m = W.handAngles(new Date(2026, 0, 1, 0, 0, 0, 0))
  check(m.second === 0 && m.minute === 0 && m.hour === 0 && m.date === 0, 'everything at twelve on the stroke of the year')
  const s = W.handAngles(new Date(2026, 0, 1, 0, 0, 0, 500))
  check(s.second === 3, 'the seconds hand sweeps: half a second is three degrees')
  let bad = 0
  for (let day = 1; day <= 31; day++) for (const h of [0, 12, 23]) {
    const d = W.handAngles(new Date(2026, 0, day, h, 30)).date
    if (!(d >= ((day - 1) / 31) * 360 && d < (day / 31) * 360)) bad++
  }
  check(!bad, 'the date pointer is inside its own date all day, for all thirty-one')
}

console.log('\nthe Sun')
{
  const noon = W.subsolar(new Date(Date.UTC(2026, 2, 20, 12)))
  check(near(noon.lon, 0, 0.01) && near(noon.lat, 0, 1.5), `over Greenwich and the equator at noon on the March equinox (${noon.lat.toFixed(2)})`)
  check(near(W.subsolar(new Date(Date.UTC(2026, 5, 21, 12))).lat, 23.44, 0.3), 'on the northern tropic in June')
  check(near(W.subsolar(new Date(Date.UTC(2026, 11, 21, 12))).lat, -23.44, 0.3), 'on the southern tropic in December')
  check(near(W.subsolar(new Date(Date.UTC(2026, 5, 21, 6))).lon, 90, 0.01) && near(W.subsolar(new Date(Date.UTC(2026, 5, 21, 18))).lon, -90, 0.01), 'over India in the UTC morning and the Americas in the evening')
  let bad = 0
  for (let h = 0; h < 24; h += 0.25) { const l = W.subsolar(new Date(Date.UTC(2026, 7, 1, 0, h * 60))).lon; if (!(l > -180 && l <= 180)) bad++ }
  check(!bad, 'and never off the map')
}

console.log('\nthe Moon')
{
  check(W.moonPath(0, 58).lit < 0.001 && near(W.moonPath(0.5, 58).lit, 1, 1e-9) && near(W.moonPath(0.25, 58).lit, 0.5, 1e-9), 'dark when new, half at the quarter, round when full')
  check(!W.moonPath(0.2, 58).flip && W.moonPath(0.8, 58).flip, 'lit on the right while it waxes, on the left while it wanes')
  const paths = [0.01, 0.2, 0.3, 0.49, 0.51, 0.7, 0.99].map((p) => W.moonPath(p, 58).d)
  check(paths.every((d) => /^M0 -58A58 58 0 0 1 0 58A[\d.]+ 58 0 0 [01] 0 -58Z$/.test(d)), 'always a closed shape of two arcs')
  // The register's lunar cycle starts at a new moon, which is what the watch assumes.
  const u = T.UNITS.find((x) => x.id === 'lunation')
  const [start] = u.span(new Date(Date.UTC(2026, 10, 16)))
  const off = (start - Date.UTC(2026, 10, 9, 7, 2)) / 3_600_000
  check(near(off, 0, 18), `and the cycle it reads starts at a real new moon (9 November 2026; ${off.toFixed(1)} hours out)`)
}

console.log('\nthe year')
{
  const mid = W.drums(2026, 0.5)
  check(mid.map((d) => d.digit).join('') === '2026' && mid.every((d) => d.roll < 0.001), 'reads 2026 in July, squarely')
  check(W.drums(2026, 0.875)[3].roll < 0.06, 'and still does in November')
  const end = W.drums(2026, 0.999)
  check(end[3].roll > 0.9 && end[3].next === 7 && end[2].roll === 0, 'the last drum turns to 7 at the very end, and only the last')
  const dec = W.drums(2029, 0.999)
  check(dec[3].next === 0 && dec[2].roll > 0.9 && dec[2].next === 3 && dec[1].roll === 0, 'in 2029 the tens drum turns with it')
  const mil = W.drums(2999, 0.999)
  check(mil.every((d) => d.roll > 0.9) && mil[0].next === 3, 'in 2999 all four go')
}

console.log('\nthe 32 bits')
{
  check(W.bits(new Date(0)) === '0'.repeat(32), 'nothing at the epoch')
  check(W.bits(new Date(1000)) === '0'.repeat(31) + '1', 'one second is the last lamp')
  check(W.bits(new Date((2 ** 31 - 1) * 1000)) === '0' + '1'.repeat(31), 'every lamp but the sign is lit in the last second, 19 January 2038')
  const u = T.UNITS.find((x) => x.id === 'y2038')
  check(u.until === (2 ** 31 - 1) * 1000, 'which is the second the register drops its row at')
}

console.log('\nthe drawing')
{
  const { base, top } = W.watchSvg()
  const all = base + top
  const shown = new Set([...all.matchAll(/data-u="([^"]+)"/g)].flatMap((m) => m[1].split(' ')))
  const missing = T.UNITS.map((u) => u.id).filter((id) => !shown.has(id))
  check(!missing.length, `a part of the watch for every span in the register${missing.length ? ' — missing ' + missing.join(', ') : ''}`)
  const strangers = [...shown].filter((id) => !T.UNITS.some((u) => u.id === id))
  check(!strangers.length, `and no part for a span that is not${strangers.length ? ' — ' + strangers.join(', ') : ''}`)
  const ids = [...all.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
  check(new Set(ids).size === ids.length, 'no id twice across the two layers')
  check(base.startsWith('<svg') && base.endsWith('</svg>') && top.startsWith('<svg') && top.endsWith('</svg>'), 'two whole layers')
  check(/data-hand="second"/.test(top) && !/data-hand=/.test(base), 'the hands are in the layer above the Earth')
  check((all.match(/class="bit"/g) ?? []).length === 32 && (all.match(/class="drum"/g) ?? []).length === 4, 'thirty-two lamps and four drums')
  check(all.length < 60_000, `${(all.length / 1024).toFixed(0)} kB of drawing in the page (limit 59)`)
  const page = fs.readFileSync(path.join(root, 'src/pages/progress.astro'), 'utf8')
  const lost = ['pw-week-hand', 'pw-year-hand', 'pw-moon-lit', 'pw-moon-path', 'pw-sun-arc'].filter((id) => !page.includes('#' + id) || !ids.includes(id))
  check(!lost.length, `every part the page moves is in the drawing${lost.length ? ' — ' + lost.join(', ') : ''}`)
  const earth = fs.readFileSync(path.join(root, 'src/lib/progress-earth.ts'), 'utf8')
  const declared = [...earth.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1]).sort().join()
  check(declared === 'u_here,u_land,u_sun' && page.includes('u_sun: sun, u_here: here') && page.includes("u_land: '/deep-time/land.webp'"), 'the page hands the Earth what its shader asks for')
  check(fs.existsSync(path.join(root, 'public/deep-time/land.webp')), 'and the map it reads is published')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
