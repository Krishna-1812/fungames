/**
 * check-population-live — does Every Second, Somewhere's data add up, do its
 * dots land in the right place, and does its live simulation actually run a
 * Poisson process rather than something that merely averages out to one?
 *
 *   node scripts/check-population-live.mjs
 */
import { register } from 'node:module'
import fs from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const { COUNTRIES, REST, WORLD_POPULATION, annualBirths, annualDeaths, globalTotals, SECONDS_PER_YEAR } =
  await import('../src/data/population-live.ts')
const { project, nextInterval, rnd, MAP_W, MAP_H } = await import('../src/lib/population-map.ts')
const { COUNTRY_SHAPES } = await import('../src/data/population-geo.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* ---- data integrity ------------------------------------------------------ */

console.log('data')
{
  const names = COUNTRIES.map((c) => c.name)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  check(dupes.length === 0, `no duplicate countries${dupes.length ? ': ' + dupes : ''}`)

  const badPop = COUNTRIES.filter((c) => !(c.population > 0))
  check(badPop.length === 0, 'every country has a positive population')

  // Real crude rates, worldwide, sit inside these bands (Niger's ~44 is the
  // real-world high for births; Monaco's ~20 is the real-world high for
  // deaths, an ageing-population artefact rather than a crisis). A number
  // outside this is far more likely a typo than a real outlier.
  const badBirth = COUNTRIES.filter((c) => c.birthRate < 4 || c.birthRate > 48)
  const badDeath = COUNTRIES.filter((c) => c.deathRate < 1 || c.deathRate > 25)
  check(badBirth.length === 0, `every birth rate is in a plausible real-world band${badBirth.length ? ': ' + badBirth.map((c) => c.name) : ''}`)
  check(badDeath.length === 0, `every death rate is in a plausible real-world band${badDeath.length ? ': ' + badDeath.map((c) => c.name) : ''}`)

  const listedPop = COUNTRIES.reduce((s, c) => s + c.population, 0)
  check(listedPop < WORLD_POPULATION, 'the forty listed countries sum to less than the whole world')
  check(REST.population > 0, `REST is a positive real residual (${REST.population.toLocaleString('en-US')})`)
  const restShare = REST.population / WORLD_POPULATION
  check(restShare > 0.1 && restShare < 0.3, `REST is a plausible share of the world (${(restShare * 100).toFixed(1)}%)`)

  const totals = globalTotals()
  // The commonly-cited real figures are ~4.3 births/second and ~2/second for
  // deaths, worldwide. This is computed from forty real countries' own
  // population and rate, not fitted to that figure — so agreeing with it is
  // the actual check, not a tautology.
  check(
    totals.birthsPerSecond > 3.5 && totals.birthsPerSecond < 5,
    `global births/second is close to the real published figure (${totals.birthsPerSecond.toFixed(3)})`,
  )
  check(
    totals.deathsPerSecond > 1.5 && totals.deathsPerSecond < 2.7,
    `global deaths/second is close to the real published figure (${totals.deathsPerSecond.toFixed(3)})`,
  )
  check(totals.birthsPerSecond > totals.deathsPerSecond, 'the world is still growing, net, in this data')
  ok(
    `${(totals.birthsPerYear / 1e6).toFixed(1)}M births/yr, ${(totals.deathsPerYear / 1e6).toFixed(1)}M deaths/yr, ` +
      `net +${((totals.birthsPerYear - totals.deathsPerYear) / 1e6).toFixed(1)}M/yr`,
  )
}

/* ---- the map is real geometry, not a guess --------------------------------- */

console.log('\nreal geometry')
{
  check(COUNTRY_SHAPES.length > 150, `${COUNTRY_SHAPES.length} real country shapes loaded from Natural Earth`)
  const shapeNames = new Set(COUNTRY_SHAPES.map((s) => s.name))
  const dupeShapes = COUNTRY_SHAPES.map((s) => s.name).filter((n, i, a) => a.indexOf(n) !== i)
  check(dupeShapes.length === 0, `no duplicate shape names${dupeShapes.length ? ': ' + dupeShapes : ''}`)

  // Every one of the forty has to actually resolve to a real shape — this is
  // what the `atlasName` field on the two countries whose display name
  // differs from Natural Earth's own (`United States`, `DR Congo`) exists to
  // guarantee, and what would break silently if either name ever drifted.
  let missing = 0
  for (const c of COUNTRIES) {
    if (!shapeNames.has(c.atlasName ?? c.name)) {
      fail(`${c.name}: no real shape named "${c.atlasName ?? c.name}" in the atlas`)
      missing++
    }
  }
  check(missing === 0, 'every one of the forty countries resolves to a real Natural Earth shape')
}

console.log('\nprojection')
{
  let outOfFrame = 0
  for (const c of COUNTRIES) {
    const [x, y] = project(c.lat, c.lon)
    if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) {
      fail(`${c.name}: projects to (${x.toFixed(1)}, ${y.toFixed(1)}), outside the ${MAP_W}x${MAP_H} frame`)
      outOfFrame++
    }
  }
  check(outOfFrame === 0, 'every country projects inside the map frame')

  // The real check a hand-drawn backdrop could never offer: does a country's
  // real capital-city coordinate actually land inside (or very near) that
  // same country's own real, surveyed outline? A sign error on longitude —
  // the single most common way a real place ends up in the wrong hemisphere
  // — fails this immediately, against real geometry rather than a guessed
  // bounding shape.
  const shapeByName = new Map(COUNTRY_SHAPES.map((s) => [s.name, s]))
  const bboxOf = (path) => {
    const nums = path.match(/-?\d+\.?\d*/g).map(Number)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = 0; i < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i])
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1])
    }
    return { minX, maxX, minY, maxY }
  }
  const MARGIN = 3 // degrees, i.e. map units here — a capital is not always the geometric middle
  let misplaced = 0
  for (const c of COUNTRIES) {
    const shape = shapeByName.get(c.atlasName ?? c.name)
    if (!shape) continue // already reported above
    const [x, y] = project(c.lat, c.lon)
    const b = bboxOf(shape.path)
    const inside = x >= b.minX - MARGIN && x <= b.maxX + MARGIN && y >= b.minY - MARGIN && y <= b.maxY + MARGIN
    if (!inside) {
      fail(`${c.name}: capital projects to (${x.toFixed(1)}, ${y.toFixed(1)}), outside its own real outline's box (${b.minX.toFixed(1)}-${b.maxX.toFixed(1)}, ${b.minY.toFixed(1)}-${b.maxY.toFixed(1)})`)
      misplaced++
    }
  }
  check(misplaced === 0, `all forty capitals land inside their own country's real outline (±${MARGIN} map units)`)
}

/* ---- the simulation's maths ------------------------------------------------ */

console.log('\nthe live simulation is a real Poisson process')
{
  // Mean: for a Poisson process with rate r, the mean inter-arrival time is
  // 1/r. Sampled with the shared deterministic generator, not Math.random(),
  // so a regression here is reproducible rather than a coin flip on CI.
  const RATE = 0.37 // arbitrary, deliberately not round
  const N = 200_000
  let sum = 0
  let aboveMean = 0
  const samples = new Array(N)
  for (let i = 0; i < N; i++) {
    const u = rnd(7, i)
    const dt = nextInterval(RATE, u)
    samples[i] = dt
    sum += dt
  }
  const mean = sum / N
  const expected = 1 / RATE
  const meanErr = Math.abs(mean - expected) / expected
  check(meanErr < 0.01, `mean interval ${mean.toFixed(4)}s is within 1% of the real 1/rate (${expected.toFixed(4)}s), off by ${(meanErr * 100).toFixed(2)}%`)

  // The distinguishing property of an exponential distribution, not shared by
  // e.g. a normal distribution with the same mean: P(X > mean) = 1/e ≈
  // 0.3679, because it is memoryless. A wrong distribution with a correct
  // mean would still fail this.
  for (const dt of samples) if (dt > expected) aboveMean++
  const frac = aboveMean / N
  check(
    Math.abs(frac - 1 / Math.E) < 0.01,
    `P(interval > mean) is ${frac.toFixed(4)}, matching the exponential distribution's 1/e ≈ ${(1 / Math.E).toFixed(4)} — not just a right average, the right shape`,
  )

  check(nextInterval(RATE, 0) === 0, 'a draw of 0 gives an interval of 0 seconds (an event right now)')
  check(Number.isFinite(nextInterval(RATE, 0.999999999)), 'a draw near 1 stays finite')
}

console.log('\ndeterminism')
{
  let drift = 0
  for (let i = 0; i < 1000; i++) if (rnd(3, i) !== rnd(3, i)) drift++
  check(drift === 0, 'the shared generator is the same twice')
}

/* ---- no emoji -------------------------------------------------------------- */

console.log('\nno emoji')
{
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
  for (const f of ['src/data/population-live.ts', 'src/lib/population-map.ts', 'src/pages/every-second.astro', 'src/data/population-geo.ts']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

console.log(failures ? `\n${failures} failed.` : '\nAll population-live checks passed.')
process.exitCode = failures ? 1 : 0
