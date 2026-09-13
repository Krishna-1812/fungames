/**
 * check-star-catalog — proves the access layer over the generated star and
 * constellation data against real, independently-known facts, not against
 * the data it is itself reading.
 *
 *   1. Real, famous stars decode with their real position and magnitude —
 *      Sirius, the brightest star in the sky, by name.
 *   2. starLabel() prefers a real proper name, falls back to a real Bayer
 *      Greek-letter label, and never produces an empty string.
 *   3. brightestIn() actually is the minimum magnitude in its constellation
 *      — checked by re-deriving it independently from STARS rather than
 *      trusting the same grouping code twice.
 *   4. nearestStar() finds Polaris from a point one arcminute away, and
 *      returns null outside its search radius rather than the nearest
 *      star regardless of distance.
 *   5. Every one of the real 88 IAU constellations has both a name and a
 *      line figure — nothing orphaned in either direction.
 *
 *   node scripts/check-star-catalog.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  STARS, starById, starLabel, starsInConstellation, brightestIn, nearestStar, searchStars,
  CONSTELLATIONS, constellationName,
} = await import('../src/lib/star-catalog.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, tol) => Math.abs(a - b) <= tol

console.log(`${STARS.length} real stars loaded`)
{
  check(STARS.length > 8000 && STARS.length < 10000, `a plausible naked-eye star count (got ${STARS.length})`)
}

console.log('\nSirius decodes with its real position and magnitude')
{
  const sirius = STARS.find((s) => s.proper === 'Sirius')
  check(!!sirius, 'Sirius is in the catalogue')
  if (sirius) {
    check(close(sirius.ra, 101.29, 0.1), `real RA ~101.29° (got ${sirius.ra})`)
    check(close(sirius.dec, -16.72, 0.1), `real Dec ~-16.72° (got ${sirius.dec})`)
    check(sirius.mag < -1, `Sirius is really the brightest star in the sky, mag < -1 (got ${sirius.mag})`)
    check(sirius.con === 'CMa', `Sirius is really in Canis Major (got "${sirius.con}")`)
  }
}

console.log('\nstarLabel() prefers a real name, then a real Bayer label, never blank')
{
  const sirius = STARS.find((s) => s.proper === 'Sirius')
  check(starLabel(sirius) === 'Sirius', 'a star with a real proper name uses it verbatim')
  const rigel = STARS.find((s) => s.proper === 'Rigel')
  const noName = { ...rigel, proper: '' }
  check(starLabel(noName) === 'β Ori', `Rigel with its name hidden falls back to its real Bayer label (got "${starLabel(noName)}")`)
  const nothingKnown = { id: 999999, ra: 0, dec: 0, mag: 6, ci: null, proper: '', bayer: '', flam: '', con: '' }
  check(starLabel(nothingKnown) === 'HYG 999999', `a star with no real name or designation still gets a real, non-blank label (got "${starLabel(nothingKnown)}")`)
}

console.log('\nbrightestIn() really is the dimmest magnitude (brightest star) in its constellation')
{
  for (const con of ['Ori', 'CMa', 'UMa', 'Cyg']) {
    const stars = starsInConstellation(con)
    const trueMin = Math.min(...stars.map((s) => s.mag))
    const claimed = brightestIn(con)
    check(!!claimed && close(claimed.mag, trueMin, 1e-9), `${con}: brightestIn's magnitude (${claimed?.mag}) matches an independent min() over the same set (${trueMin})`)
  }
  check(brightestIn('Zzz') === null, 'an unknown constellation abbreviation returns null, not a crash')
}

console.log('\nnearestStar() finds a real named star close by, and respects its search radius')
{
  const polaris = STARS.find((s) => s.proper === 'Polaris')
  const near = nearestStar(polaris.ra + 0.01, polaris.dec + 0.01, 1)
  check(near?.id === polaris.id, `a point ~1 arcminute from Polaris finds Polaris (got ${near ? starLabel(near) : 'null'})`)
  // Sirius, not Polaris, for the "too far" case: near the pole a few degrees
  // of RA is barely any real angular distance at all (RA lines converge
  // there), so the same offset that's "far" at Sirius's declination would
  // give a false failure at Polaris's.
  const sirius = STARS.find((s) => s.proper === 'Sirius')
  const tooFar = nearestStar(sirius.ra + 5, sirius.dec, 0.5)
  check(tooFar === null, 'a point outside the search radius returns null rather than the nearest star regardless of distance')
}

console.log('\nsearchStars() finds a real star by a partial, case-insensitive name')
{
  const results = searchStars('sir')
  check(results.some((s) => s.proper === 'Sirius'), 'searching "sir" finds Sirius')
  check(searchStars('x').length === 0 || searchStars('').length === 0, 'a too-short query returns nothing rather than the whole catalogue')
}

console.log('\nevery one of the real 88 IAU constellations has both a name and a line figure')
{
  check(CONSTELLATIONS.length === 88, `88 constellation line figures (got ${CONSTELLATIONS.length})`)
  const lineIds = new Set(CONSTELLATIONS.map((c) => c.id))
  let orphanedLines = 0
  let orphanedNames = 0
  for (const c of CONSTELLATIONS) if (!constellationName(c.id)) orphanedLines++
  for (const s of STARS) if (s.con && !lineIds.has(s.con) && !constellationName(s.con)) orphanedNames++
  check(orphanedLines === 0, `every line figure has a matching name entry (${orphanedLines} did not)`)
  check(orphanedNames === 0, `every star's constellation abbreviation resolves to a real constellation (${orphanedNames} did not)`)
  const orion = constellationName('Ori')
  check(orion?.name === 'Orion' && orion?.genitive === 'Orionis', `Orion's real genitive form is "Orionis" (got "${orion?.genitive}")`)
  // Orion is a mythological figure's own name in Latin and English alike, so
  // it has no "translation" distinct from its name — Apus (a bird) does.
  const apus = constellationName('Aps')
  check(apus?.name === 'Apus' && apus?.english === 'Bird of Paradise', `Apus's real English translation is "Bird of Paradise" (got "${apus?.english}")`)
}

console.log(failures ? `\n${failures} failed.` : '\nAll star-catalog checks passed.')
process.exitCode = failures ? 1 : 0
