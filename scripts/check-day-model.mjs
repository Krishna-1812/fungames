/**
 * check-day-model — proves the day-bar's arithmetic rather than trusting it.
 *
 *   1. The segments always sum to workHours + homeHours + sleepHours —
 *      carving out morning/lunch/dinner/commute must never grow the day.
 *   2. Interruptions never help: actual work hours <= perceived work hours,
 *      always, and more distractions (a shorter phone interval, or a higher
 *      extra-distractions count) never *increases* actual work hours.
 *   3. Nothing goes negative or NaN across a sweep of edge cases (zero
 *      sleep, zero everything, a huge distraction count, a phone interval
 *      of a single minute).
 *   4. The cited constant is the real one, not a rounded-off stand-in, and
 *      the source strings actually name the source.
 *
 *   node scripts/check-day-model.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { computeDay, hoursLeftToday, REFOCUS_MINUTES, SOURCES } = await import('../src/lib/day-model.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const BASE = {
  workHours: 8, homeHours: 8, sleepHours: 8,
  morningMin: 30, lunchMin: 30, dinnerMin: 30, commuteMin: 20,
  phoneIntervalMin: 15, extraDistractionsPerDay: 4,
}

/* ---- 1. the pie never grows -------------------------------------------- */

console.log('the day never gets longer than it started')
{
  let bad = 0
  const rand = (lo, hi) => lo + Math.random() * (hi - lo)
  for (let i = 0; i < 500; i++) {
    const input = {
      workHours: rand(0, 16), homeHours: rand(0, 16), sleepHours: rand(0, 12),
      morningMin: rand(0, 180), lunchMin: rand(0, 120), dinnerMin: rand(0, 120), commuteMin: rand(0, 150),
      phoneIntervalMin: rand(1, 120), extraDistractionsPerDay: rand(0, 40),
    }
    const m = computeDay(input)
    const expected = input.workHours + input.homeHours + input.sleepHours
    if (Math.abs(m.totalHours - expected) > 1e-6) {
      fail(`segments summed to ${m.totalHours.toFixed(4)}, expected ${expected.toFixed(4)}`)
      bad++
    }
  }
  check(bad === 0, '500 random inputs: segments always sum to workHours + homeHours + sleepHours')
}

/* ---- 2. interruptions never help --------------------------------------- */

console.log('\ninterruptions never help')
{
  let bad = 0
  for (let i = 0; i < 200; i++) {
    const input = { ...BASE, workHours: 4 + Math.random() * 8 }
    const m = computeDay(input)
    if (m.actualWorkHours > m.perceivedWorkHours + 1e-9) {
      fail(`actual work (${m.actualWorkHours}) exceeded perceived work (${m.perceivedWorkHours})`)
      bad++
    }
  }
  check(bad === 0, 'actual work hours never exceed the work segment they were carved from')

  // Monotonicity: a shorter phone-check interval (checking more often) must
  // never leave you with *more* actual work hours than a longer one.
  let nonMonotone = 0
  for (let i = 0; i < 200; i++) {
    const workHours = 4 + Math.random() * 8
    const longer = computeDay({ ...BASE, workHours, phoneIntervalMin: 30 })
    const shorter = computeDay({ ...BASE, workHours, phoneIntervalMin: 5 })
    if (shorter.actualWorkHours > longer.actualWorkHours + 1e-9) nonMonotone++
  }
  check(nonMonotone === 0, 'checking your phone more often never increases actual work hours')

  let nonMonotone2 = 0
  for (let i = 0; i < 200; i++) {
    const workHours = 4 + Math.random() * 8
    const fewer = computeDay({ ...BASE, workHours, extraDistractionsPerDay: 0 })
    const more = computeDay({ ...BASE, workHours, extraDistractionsPerDay: 20 })
    if (more.actualWorkHours > fewer.actualWorkHours + 1e-9) nonMonotone2++
  }
  check(nonMonotone2 === 0, 'more non-phone distractions never increase actual work hours')
}

/* ---- 3. edge cases ------------------------------------------------------ */

console.log('\nedge cases stay finite and non-negative')
{
  const cases = [
    { ...BASE, sleepHours: 0 },
    { ...BASE, sleepHours: 24 },
    { workHours: 0, homeHours: 0, sleepHours: 0, morningMin: 0, lunchMin: 0, dinnerMin: 0, commuteMin: 0, phoneIntervalMin: 15, extraDistractionsPerDay: 0 },
    { ...BASE, phoneIntervalMin: 1 },
    { ...BASE, phoneIntervalMin: 0 },
    { ...BASE, extraDistractionsPerDay: 500 },
    { ...BASE, morningMin: 10_000 }, // an ill-advised slider drag, not a crash
  ]
  let bad = 0
  for (const c of cases) {
    const m = computeDay(c)
    const nums = [m.totalHours, m.wakingHours, m.actualWorkHours, m.perceivedWorkHours, m.lostWorkMinutes, ...m.segments.map((s) => s.hours)]
    if (nums.some((n) => !Number.isFinite(n) || n < -1e-9)) {
      fail(`case ${JSON.stringify(c)} produced a negative or non-finite value`)
      bad++
    }
    if (m.cuts.length !== m.totalInterruptions) {
      fail(`case ${JSON.stringify(c)}: ${m.cuts.length} cuts rendered for ${m.totalInterruptions} interruptions`)
      bad++
    }
    if (m.cuts.some((c2) => c2 < 0 || c2 > 1)) {
      fail(`case ${JSON.stringify(c)}: a cut fell outside the 0..1 span`)
      bad++
    }
  }
  check(bad === 0, `${cases.length} edge cases all stayed finite, non-negative, and internally consistent`)
}

/* ---- 4. the citation is the real one ------------------------------------ */

console.log('\nthe cited figure is real')
{
  check(Math.abs(REFOCUS_MINUTES - 23.25) < 1e-9, `REFOCUS_MINUTES is 23.25 (23m15s), not a rounded stand-in (got ${REFOCUS_MINUTES})`)
  check(/Gloria Mark/.test(SOURCES.refocus) && /UC Irvine/.test(SOURCES.refocus), 'the refocus source names the actual researcher and institution')
  check(/23 minutes 15 seconds|23m15s/.test(SOURCES.refocus), 'the refocus source states the real figure in the visible text, not just the constant')
}

console.log('\nreal-clock helper')
{
  const noon = new Date(2026, 0, 1, 12, 0, 0)
  check(Math.abs(hoursLeftToday(noon) - 12) < 1e-9, 'hoursLeftToday at noon is 12')
  const almostMidnight = new Date(2026, 0, 1, 23, 45, 0)
  check(Math.abs(hoursLeftToday(almostMidnight) - 0.25) < 1e-9, 'hoursLeftToday at 23:45 is a quarter hour')
}

console.log(failures ? `\n${failures} failed.` : '\nAll day-model checks passed.')
process.exitCode = failures ? 1 : 0
