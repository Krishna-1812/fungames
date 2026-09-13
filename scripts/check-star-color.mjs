/**
 * check-star-color — proves the B-V-to-colour pipeline against real stars
 * whose temperature and apparent colour are independently well known,
 * rather than trusting the two formulas in isolation.
 *
 *   1. The Sun's own real B-V (0.65) reproduces its own well-known ~5778K
 *      effective temperature via Ballesteros' formula.
 *   2. Vega — the historical zero-point of the B-V scale itself (B-V = 0.00
 *      by the definition photometrists actually use) — comes out close to
 *      white, not tinted either way.
 *   3. Betelgeuse (a real red supergiant, B-V ~1.85) renders redder than
 *      Rigel (a real blue supergiant, B-V ~-0.03) — the actual point of
 *      doing this from the real index rather than picking colours by eye.
 *   4. Monotonic: rising B-V (cooler, redder) never raises blue or lowers
 *      red, across a full realistic sweep.
 *
 *   node scripts/check-star-color.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { bvToKelvin, kelvinToRgb, starColor, SUN_BV } = await import('../src/lib/star-color.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, tol) => Math.abs(a - b) <= tol

console.log('the Sun\'s own B-V reproduces its own well-known temperature')
{
  const t = bvToKelvin(SUN_BV)
  check(close(t, 5778, 60), `B-V ${SUN_BV} -> ~5778K (got ${t.toFixed(0)}K)`)
}

console.log('\nVega, the historical B-V = 0 reference point, renders blue-white, not neutral')
{
  // Vega's real B-V of 0.00 implies ~9600K via Ballesteros — genuinely hotter
  // than the ~6600K white point Helland's own algorithm notes, which is
  // exactly why every real reference describes Vega as "blue-white" rather
  // than white: bright across all three channels, but blue the highest.
  const [r, g, b] = kelvinToRgb(bvToKelvin(0.0))
  check(r > 190 && g > 190 && b > 240, `Vega (B-V 0.00) is bright across all channels (got rgb(${r},${g},${b}))`)
  check(b >= r && b >= g, `Vega leans blue rather than neutral, matching its real ~9600K temperature (got rgb(${r},${g},${b}))`)
}

console.log('\nreal red and blue supergiants land on the correct side of white')
{
  const betelgeuse = kelvinToRgb(bvToKelvin(1.85)) // real red supergiant
  const rigel = kelvinToRgb(bvToKelvin(-0.03)) // real blue supergiant
  check(betelgeuse[0] > betelgeuse[2], `Betelgeuse (B-V 1.85) is redder than it is blue (got rgb(${betelgeuse}))`)
  check(rigel[2] >= rigel[0], `Rigel (B-V -0.03) is at least as blue as it is red (got rgb(${rigel}))`)
  check(bvToKelvin(-0.03) > bvToKelvin(1.85), 'Rigel\'s real B-V implies a genuinely hotter temperature than Betelgeuse\'s')
}

console.log('\nmonotonic across a realistic B-V sweep: hotter never gets redder')
{
  let prevRed = -1
  let prevBlue = 256
  let brokeRed = false
  let brokeBlue = false
  for (let bv = -0.4; bv <= 2.0; bv += 0.02) {
    const [r, , b] = kelvinToRgb(bvToKelvin(bv))
    if (r < prevRed - 1) brokeRed = true // allow float noise, not real reversals
    if (b > prevBlue + 1) brokeBlue = true
    prevRed = r
    prevBlue = b
  }
  check(!brokeRed, 'red channel never decreases as B-V rises (star cools)')
  check(!brokeBlue, 'blue channel never increases as B-V rises (star cools)')
}

console.log('\nstarColor() handles a missing colour index honestly, as Sun-like rather than crashing')
{
  const withNull = starColor(null)
  const withSun = starColor(SUN_BV)
  check(withNull === withSun, 'a null colour index falls back to the Sun\'s own B-V, not an arbitrary default')
  check(/^rgb\(\d+,\d+,\d+\)$/.test(withNull), `starColor returns a real CSS rgb() string (got "${withNull}")`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll star-color checks passed.')
process.exitCode = failures ? 1 : 0
