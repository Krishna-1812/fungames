/**
 * check-sky-milkyway — is the Milky Way in Constellation Draw's sky where the
 * Milky Way is?
 *
 * The band is a model and its mottling is invented, but where it lies is
 * not: that comes from the standard conversion between the sky's
 * coordinates and the galaxy's, and a sign wrong in it puts the band through
 * the Big Dipper and nothing complains. So:
 *
 *   1. The conversion, against places whose galactic coordinates anyone can
 *      look up: the centre of the galaxy, its pole, Deneb, the anticentre.
 *   2. The band: bright at the centre, bright along the plane, nothing at
 *      the poles, fainter away from the centre than toward it, warm only
 *      round the middle, and the Great Rift darker than the band beside it.
 *   3. The two Magellanic Clouds, where they are.
 *   4. Never out of range, anywhere on the sky.
 *
 *   node scripts/check-sky-milkyway.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const M = await import('../src/lib/sky-milkyway.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const near = (a, b, tol) => Math.abs(a - b) <= tol

console.log('\nwhere the galaxy is')
{
  const c = M.toGalactic(266.417, -29.008)
  check(near(c.l, 0, 0.2) && near(c.b, 0, 0.2), `its centre is at longitude 0, latitude 0 (${c.l.toFixed(2)}, ${c.b.toFixed(2)})`)
  check(near(M.toGalactic(192.859, 27.128).b, 90, 0.05), 'its north pole is at latitude 90')
  const d = M.toGalactic(310.358, 45.280)
  check(near(d.l, 84.28, 0.2) && near(d.b, 2.0, 0.2), `Deneb is at 84.3, +2.0 (${d.l.toFixed(2)}, ${d.b.toFixed(2)})`)
  const a = M.toGalactic(86.405, 28.936)
  check(near(Math.abs(a.l), 180, 0.3) && near(a.b, 0, 0.3), 'the anticentre is opposite the centre, in the plane')
  const s = M.toGalactic(101.287, -16.716)
  check(near(s.l, -132.76, 0.3) && near(s.b, -8.89, 0.3), `Sirius is at 227.2 (that is -132.8), -8.9 (${s.l.toFixed(2)}, ${s.b.toFixed(2)})`)
}

console.log('\nthe band')
{
  const g = (ra, dec) => M.milkyWay(ra, dec)
  const centre = g(266.417, -29.008), pole = g(192.859, 27.128), south = g(12.86, -27.13)
  check(centre.glow > 0.5, `bright at the centre (${centre.glow.toFixed(2)})`)
  check(pole.glow < 0.02 && south.glow < 0.02, 'nothing at either pole of the galaxy')
  const cyg = g(305, 40), anti = g(86.4, 28.9)
  check(cyg.glow > anti.glow && anti.glow > 0.08 && anti.glow > pole.glow * 4, `fainter away from the centre than toward it, but still there (${cyg.glow.toFixed(2)} in Cygnus, ${anti.glow.toFixed(2)} opposite)`)
  check(centre.warm > 0.8 && cyg.warm < 0.1 && anti.warm < 0.05, 'warm round the middle, blue-white along the arms')
  // Along the plane it is brighter than fifteen degrees off it, all the way round.
  let wrong = 0
  for (let l = -170; l <= 180; l += 10) {
    // Walk the plane: find a sky position at this longitude by searching the conversion.
    let on = 0, off = 0, n = 0
    for (let ra = 0; ra < 360; ra += 3) for (let dec = -88; dec <= 88; dec += 3) {
      const q = M.toGalactic(ra, dec)
      if (Math.abs(q.l - l) > 4) continue
      if (Math.abs(q.b) < 3) { on += M.milkyWay(ra, dec).glow; n++ } else if (Math.abs(Math.abs(q.b) - 25) < 3) off = Math.max(off, M.milkyWay(ra, dec).glow)
    }
    if (n && on / n <= off) wrong++
  }
  check(wrong === 0, 'brighter in the plane than well off it, at every longitude')
  // The Great Rift: averaged over its length, the lane is darker than the band a few degrees to the side.
  let lane = 0, beside = 0, n = 0
  for (let ra = 0; ra < 360; ra += 1.5) for (let dec = -70; dec <= 60; dec += 1.5) {
    const q = M.toGalactic(ra, dec)
    if (q.l < 10 || q.l > 60) continue
    if (Math.abs(q.b - 1.5) < 1) { lane += M.milkyWay(ra, dec).glow; n++ } else if (Math.abs(q.b + 5) < 1) beside += M.milkyWay(ra, dec).glow
  }
  check(n > 20 && lane < beside * 0.9, `a dark lane down the middle of the bright part (${(lane / n).toFixed(2)} in it)`)
}

console.log('\nthe Magellanic Clouds')
{
  const lmc = M.milkyWay(80.9, -69.8).glow, smc = M.milkyWay(13.2, -72.8).glow, between = M.milkyWay(45, -72).glow
  check(lmc > 0.4 && smc > 0.3 && between < 0.1, `both there, with dark sky between them (${lmc.toFixed(2)}, ${smc.toFixed(2)}, ${between.toFixed(2)})`)
}

console.log('\neverywhere')
{
  let bad = 0
  for (let ra = 0; ra < 360; ra += 5) for (let dec = -90; dec <= 90; dec += 5) {
    const m = M.milkyWay(ra, dec)
    if (!(m.glow >= 0 && m.glow <= 1 && m.warm >= 0 && m.warm <= 1)) bad++
  }
  check(bad === 0, 'a brightness between nothing and full, in every direction')
  const page = fs.readFileSync(path.join(root, 'src/pages/constellation-draw.astro'), 'utf8')
  check(page.includes("import { milkyWay } from '../lib/sky-milkyway'") && page.includes('const mw = milkyWayLayer()'), 'and the page draws it under the stars')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
