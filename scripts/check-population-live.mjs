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
const { CONTINENTS, project, nextInterval, rnd, LON_MIN, LON_MAX, LAT_MIN, LAT_MAX, MAP_W, MAP_H } =
  await import('../src/lib/population-map.ts')

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

/* ---- projection ----------------------------------------------------------- */

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

  // A coarse sanity check on continent assignment: catches a sign error on
  // longitude (the single most common way a real place ends up in the wrong
  // hemisphere) far more reliably than staring at a list of numbers does.
  const CONTINENT_OF = {
    China: 'Asia', India: 'Asia', 'United States': 'North America', Indonesia: 'Asia',
    Pakistan: 'Asia', Nigeria: 'Africa', Brazil: 'South America', Bangladesh: 'Asia',
    Russia: 'Asia', Mexico: 'North America', Ethiopia: 'Africa', Japan: 'Asia',
    Philippines: 'Asia', Egypt: 'Africa', 'DR Congo': 'Africa', Vietnam: 'Asia',
    Iran: 'Asia', Turkey: 'Asia', Germany: 'Europe', Thailand: 'Asia',
    'United Kingdom': 'Europe', France: 'Europe', Tanzania: 'Africa', 'South Africa': 'Africa',
    Italy: 'Europe', Kenya: 'Africa', Colombia: 'South America', 'South Korea': 'Asia',
    Sudan: 'Africa', Uganda: 'Africa', Spain: 'Europe', Algeria: 'Africa',
    Argentina: 'South America', Iraq: 'Asia', Afghanistan: 'Asia', Canada: 'North America',
    Poland: 'Europe', Ukraine: 'Europe', Morocco: 'Africa', 'Saudi Arabia': 'Asia',
  }
  const bounds = Object.fromEntries(
    CONTINENTS.map((c) => {
      const lats = c.points.map((p) => p[0])
      const lons = c.points.map((p) => p[1])
      return [c.name, { latMin: Math.min(...lats), latMax: Math.max(...lats), lonMin: Math.min(...lons), lonMax: Math.max(...lons) }]
    }),
  )
  const MARGIN = 14
  let misplaced = 0
  for (const c of COUNTRIES) {
    const want = CONTINENT_OF[c.name]
    if (!want) continue
    const b = bounds[want]
    const inside =
      c.lat >= b.latMin - MARGIN && c.lat <= b.latMax + MARGIN && c.lon >= b.lonMin - MARGIN && c.lon <= b.lonMax + MARGIN
    if (!inside) {
      fail(`${c.name}: (${c.lat}, ${c.lon}) is nowhere near the ${want} outline`)
      misplaced++
    }
  }
  check(misplaced === 0, `all thirty-nine assigned countries land near their own continent's outline (±${MARGIN}°)`)
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
  for (const f of ['src/data/population-live.ts', 'src/lib/population-map.ts', 'src/pages/every-second.astro']) {
    check(!EMOJI.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} has no emoji`)
  }
}

console.log(failures ? `\n${failures} failed.` : '\nAll population-live checks passed.')
process.exitCode = failures ? 1 : 0
