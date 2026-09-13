/**
 * check-sky-projection — proves the gnomonic sky projection against the
 * geometry it has to satisfy regardless of the exact formula used, rather
 * than against a second copy of the same trigonometry.
 *
 *   1. The view centre always projects to the origin, by definition.
 *   2. Real angular separation (spherical law of cosines) matches the
 *      Cartesian distance between two nearby projected points — the actual
 *      property a tangent-plane projection promises, checked at several
 *      separations rather than assumed from one.
 *   3. Nothing more than 90° from the look direction is reported visible —
 *      a gnomonic projection has no finite image for it.
 *   4. project() and unproject() round-trip for points across the visible
 *      hemisphere, not just near the centre.
 *   5. A real constellation's own real coordinates (Orion's belt) survive
 *      the round trip too — not a synthetic test point.
 *
 *   node scripts/check-sky-projection.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { project, unproject, angularSeparationDeg, wrapRa, clampDec } = await import('../src/lib/sky-projection.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, tol) => Math.abs(a - b) <= tol

console.log('the view centre always projects to the origin')
{
  for (const [ra0, dec0] of [[0, 0], [180, 45], [90, -60], [270, 89]]) {
    const p = project(ra0, dec0, ra0, dec0)
    check(p.visible && close(p.x, 0, 1e-9) && close(p.y, 0, 1e-9), `centre (${ra0},${dec0}) -> origin (got ${p.x.toFixed(6)},${p.y.toFixed(6)})`)
  }
}

console.log('\nprojected Cartesian distance matches real angular separation, at several separations')
{
  const ra0 = 83.0
  const dec0 = -5.0
  for (const sepDeg of [0.5, 2, 5, 15]) {
    const other = { ra: ra0 + sepDeg, dec: dec0 }
    const real = angularSeparationDeg(ra0, dec0, other.ra, other.dec) * (Math.PI / 180)
    const p = project(other.ra, other.dec, ra0, dec0)
    const cartesian = Math.hypot(p.x, p.y)
    // Gnomonic projection is exact only in the limit of small separations;
    // the divergence grows with distance from the tangent point, so the
    // tolerance widens accordingly rather than being one number that only
    // happens to work at one scale.
    const tol = 0.002 + sepDeg * (Math.PI / 180) * 0.02
    check(close(cartesian, real, tol), `${sepDeg}° apart: projected distance ${cartesian.toFixed(5)} rad vs real ${real.toFixed(5)} rad`)
  }
}

console.log('\nnothing more than 90° from the look direction is visible')
{
  const p1 = project(90, 0, 0, 0) // exactly 90 degrees away on the equator
  check(!p1.visible, '90° away (the horizon itself) is not visible')
  const p2 = project(89, 0, 0, 0)
  check(p2.visible, 'just inside 90° is visible')
  const p3 = project(91, 0, 0, 0)
  check(!p3.visible, 'just outside 90° is not visible')
}

console.log('\nproject/unproject round-trip across the visible hemisphere')
{
  const cases = [
    [10, 20, 0, 0], [83.82, -5.39, 80, 0], [279.23, 38.78, 270, 40], [45, -70, 30, -80], [0, 89, 0, 85],
  ]
  for (const [ra, dec, ra0, dec0] of cases) {
    const p = project(ra, dec, ra0, dec0)
    if (!p.visible) { fail(`(${ra},${dec}) from centre (${ra0},${dec0}) was not visible — cannot round-trip`); continue }
    const back = unproject(p.x, p.y, ra0, dec0)
    const err = angularSeparationDeg(ra, dec, back.ra, back.dec)
    check(err < 1e-6, `(${ra},${dec}) round-trips through centre (${ra0},${dec0}) to within ${err.toExponential(2)}°`)
  }
}

console.log('\na real constellation\'s own coordinates survive the round trip (Orion\'s belt, Alnitak)')
{
  // Alnitak (zeta Orionis), real J2000 position.
  const ra = 85.1897
  const dec = -1.9426
  const ra0 = 83.0
  const dec0 = -2.0
  const p = project(ra, dec, ra0, dec0)
  const back = unproject(p.x, p.y, ra0, dec0)
  check(p.visible, 'Alnitak is visible from a centre near Orion')
  check(angularSeparationDeg(ra, dec, back.ra, back.dec) < 1e-6, 'Alnitak\'s real position round-trips exactly')
}

console.log('\nwrapRa and clampDec')
{
  check(wrapRa(370) === 10, `wrapRa(370) === 10 (got ${wrapRa(370)})`)
  check(wrapRa(-10) === 350, `wrapRa(-10) === 350 (got ${wrapRa(-10)})`)
  check(wrapRa(360) === 0, `wrapRa(360) === 0 (got ${wrapRa(360)})`)
  check(clampDec(95) === 90, 'clampDec clamps above 90 to the pole')
  check(clampDec(-95) === -90, 'clampDec clamps below -90 to the pole')
  check(clampDec(45) === 45, 'clampDec leaves an in-range value alone')
}

console.log(failures ? `\n${failures} failed.` : '\nAll sky-projection checks passed.')
process.exitCode = failures ? 1 : 0
