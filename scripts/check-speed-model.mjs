/**
 * check-speed-model — proves the real numbers are real, and the arithmetic
 * built on top of them behaves the way it must regardless of input.
 *
 *   1. Earth's rotation formula reproduces real, independently-known values:
 *      about 1,674 km/h at the equator, exactly 0 at either pole, and
 *      strictly decreasing in between as |latitude| rises.
 *   2. Every cited constant sits in the real, physically-published range
 *      for the thing it claims to measure (not just "positive").
 *   3. cumulativeDistanceKm is monotonic in both time and stage count, and
 *      never negative or non-finite, across a wide random sweep.
 *   4. horizonRecessionSpeedC is genuinely > 1 (faster than light) for both
 *      published Hubble constants — the actual claim the page makes.
 *   5. Every SOURCES entry actually names its real source, not just a
 *      number with no citation attached.
 *
 *   node scripts/check-speed-model.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  earthRotationSpeedKmS, buildStages, cumulativeDistanceKm, horizonRecessionSpeedC,
  EARTH_ORBIT_KM_S, SOLAR_APEX_KM_S, GALACTIC_ORBIT_KM_S, ANDROMEDA_APPROACH_KM_S,
  CMB_DIPOLE_KM_S, TECTONIC_CM_PER_YEAR, HUBBLE_PLANCK_KM_S_MPC, HUBBLE_SH0ES_KM_S_MPC,
  SOURCES,
} = await import('../src/lib/speed-model.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, tol) => Math.abs(a - b) <= tol

/* ---- 1. rotation formula ---------------------------------------------- */

console.log('earth rotation, from real geometry')
{
  const equator = earthRotationSpeedKmS(0)
  const equatorKmH = equator * 3600
  check(close(equatorKmH, 1674.4, 2), `equatorial speed is ~1,674 km/h (got ${equatorKmH.toFixed(1)})`)
  check(close(earthRotationSpeedKmS(90), 0, 1e-9), 'speed at the north pole is exactly 0')
  check(close(earthRotationSpeedKmS(-90), 0, 1e-9), 'speed at the south pole is exactly 0')

  let monotone = true
  let prev = earthRotationSpeedKmS(0)
  for (let lat = 1; lat <= 90; lat++) {
    const v = earthRotationSpeedKmS(lat)
    if (v > prev + 1e-9) monotone = false
    prev = v
  }
  check(monotone, 'speed strictly decreases as |latitude| rises from 0 to 90')
  check(close(earthRotationSpeedKmS(45), earthRotationSpeedKmS(-45), 1e-9), 'symmetric north/south of the equator')
}

/* ---- 2. the constants are physically real ------------------------------ */

console.log('\nevery cited constant is in the real published range')
{
  check(EARTH_ORBIT_KM_S > 29 && EARTH_ORBIT_KM_S < 30, `Earth's orbital speed ~29.78 km/s (got ${EARTH_ORBIT_KM_S})`)
  check(SOLAR_APEX_KM_S > 10 && SOLAR_APEX_KM_S < 25, `solar apex speed in the 10-25 km/s range studies report (got ${SOLAR_APEX_KM_S})`)
  check(GALACTIC_ORBIT_KM_S > 200 && GALACTIC_ORBIT_KM_S < 250, `galactic orbital speed in the 200-250 km/s range (got ${GALACTIC_ORBIT_KM_S})`)
  check(ANDROMEDA_APPROACH_KM_S > 90 && ANDROMEDA_APPROACH_KM_S < 130, `Andromeda approach speed ~110 km/s (got ${ANDROMEDA_APPROACH_KM_S})`)
  check(CMB_DIPOLE_KM_S > 600 && CMB_DIPOLE_KM_S < 650, `CMB dipole speed ~627 km/s (got ${CMB_DIPOLE_KM_S})`)
  check(TECTONIC_CM_PER_YEAR > 1 && TECTONIC_CM_PER_YEAR < 15, `tectonic drift in USGS's 2-15 cm/year range (got ${TECTONIC_CM_PER_YEAR})`)
  check(HUBBLE_PLANCK_KM_S_MPC > 60 && HUBBLE_PLANCK_KM_S_MPC < 70, `Planck H0 ~67.4 km/s/Mpc (got ${HUBBLE_PLANCK_KM_S_MPC})`)
  check(HUBBLE_SH0ES_KM_S_MPC > 70 && HUBBLE_SH0ES_KM_S_MPC < 76, `SH0ES H0 ~73 km/s/Mpc (got ${HUBBLE_SH0ES_KM_S_MPC})`)
  // The two disagree — that is the real "Hubble tension", not a typo.
  check(HUBBLE_SH0ES_KM_S_MPC > HUBBLE_PLANCK_KM_S_MPC, 'the two H0 measurements genuinely disagree (the real Hubble tension)')
}

/* ---- 3. stages --------------------------------------------------------- */

console.log('\nstages')
{
  const stages = buildStages(51.5)
  check(stages.length === 7, `seven stages (got ${stages.length})`)
  check(stages.every((s) => Number.isFinite(s.kmPerSec) && s.kmPerSec > 0), 'every stage has a finite, positive speed')
  check(stages.every((s) => s.source && s.source.length > 20), 'every stage carries a real citation, not a blank string')
  // Later stages really are larger frames moving faster, with one honest
  // exception: rotation (a few hundred m/s) can exceed tectonic drift (a
  // few cm/year) by so many orders of magnitude that this is the only pair
  // guaranteed to hold regardless of latitude.
  check(stages[1].kmPerSec > stages[0].kmPerSec, 'the Earth turning is faster than the ground drifting on its plate')
  for (let i = 2; i < stages.length; i++) {
    check(stages[i].kmPerSec > stages[1].kmPerSec, `${stages[i].key} is faster than the Earth's own rotation`)
  }
}

/* ---- 4. cumulative distance is monotonic -------------------------------- */

console.log('\ncumulative distance never goes backwards')
{
  const stages = buildStages(20)
  let bad = 0
  for (let i = 0; i < 300; i++) {
    const t1 = Math.random() * 1000
    const t2 = t1 + Math.random() * 1000
    const n1 = Math.floor(Math.random() * 8)
    const n2 = Math.min(7, n1 + Math.floor(Math.random() * 4))
    const d1 = cumulativeDistanceKm(stages, n1, t1)
    const d2 = cumulativeDistanceKm(stages, n2, t2)
    if (!(d2 >= d1 - 1e-9) || !Number.isFinite(d1) || !Number.isFinite(d2) || d1 < 0 || d2 < 0) bad++
  }
  check(bad === 0, 'more time and more active stages never produces less distance, across 300 random trials')
}

/* ---- 5. faster than light, for real ------------------------------------- */

console.log('\nthe observable universe really does recede faster than light')
{
  const cPlanck = horizonRecessionSpeedC(HUBBLE_PLANCK_KM_S_MPC)
  const cSH0ES = horizonRecessionSpeedC(HUBBLE_SH0ES_KM_S_MPC)
  check(cPlanck > 1, `Planck H0 gives a horizon receding at ${cPlanck.toFixed(2)}c`)
  check(cSH0ES > 1, `SH0ES H0 gives a horizon receding at ${cSH0ES.toFixed(2)}c`)
  check(cSH0ES > cPlanck, 'the higher H0 gives the higher recession speed, consistently')
}

/* ---- 6. citations name their source ------------------------------------- */

console.log('\ncitations name a real source')
{
  const mustContain = {
    tectonic: /USGS|Geological Survey/,
    rotation: /WGS84|sidereal/,
    orbit: /29\.78/,
    apex: /Hercules|Vega|Wikipedia/,
    galactic: /IAU/,
    andromeda: /van der Marel|Hubble Space Telescope|2012/,
    cmb: /COBE|WMAP|Planck/,
    hubble: /Planck|SH0ES/,
  }
  for (const [key, re] of Object.entries(mustContain)) {
    check(re.test(SOURCES[key]), `${key}: citation names its real source`)
  }
}

console.log(failures ? `\n${failures} failed.` : '\nAll speed-model checks passed.')
process.exitCode = failures ? 1 : 0
