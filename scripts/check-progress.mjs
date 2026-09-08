/**
 * check-progress — is the date arithmetic right, in a timezone that is not
 * yours, on a day that is not twenty-four hours long?
 *
 * Every number Progress shows comes out of `lib/progress-time.ts`, and until
 * this file existed none of it was reachable: it lived inline in the page, so
 * the one genuinely tricky part of the game was the one part nothing tested.
 *
 * The interesting cases are not the ones anyone writes by hand. They are:
 *
 *   - **A day that is 23 or 25 hours long.** `midnight + 24h` is wrong twice a
 *     year, and wrong all day: the row reads 95.8% or 104.2% at midnight. Lord
 *     Howe Island shifts by *thirty minutes*, which breaks any code that
 *     assumes an offset is a whole hour, so it is in the list.
 *   - **The weekend row, which is two rows.** It has to mean "until Saturday"
 *     on a Wednesday and "the weekend itself" on a Sunday, and the changeover
 *     is the moment it is most likely to be wrong.
 *   - **February.** A lunation is 29.53 days and a calendar month is 28 to 31,
 *     so the ladder's ordering genuinely inverts twice a year. That is a fact
 *     about the Moon rather than a bug, and the tolerance below is sized to it
 *     and to nothing else.
 *
 * So: a year of instants in five timezones, plus dense sampling either side of
 * every clock change and every month boundary.
 *
 *   node scripts/check-progress.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ZONES = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Australia/Lord_Howe']

/* Node resolves the local timezone once and caches it, so each zone is a fresh
   process. Spawning is also the only way to be sure nothing earlier in this
   file has already pinned it. */
if (!process.env.PROGRESS_TZ) {
  const self = fileURLToPath(import.meta.url)
  for (const tz of ZONES) {
    const r = spawnSync(process.execPath, [self], {
      env: { ...process.env, TZ: tz, PROGRESS_TZ: tz },
      encoding: 'utf8', stdio: 'inherit',
    })
    if (r.status !== 0) process.exit(r.status ?? 1)
  }
  console.log(`Progress: date model checked in ${ZONES.length} timezones.`)
  process.exit(0)
}

const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { UNITS, liveUnits, read, human, rateOf, decimals } =
  await import('../src/lib/progress-time.ts')

const TZ = process.env.PROGRESS_TZ
const DAY = 86_400_000
const where = (m) => `[${TZ}] ${m}`

/* -------------------------------------------------------------------------- */
/* The shape of the ladder                                                    */
/* -------------------------------------------------------------------------- */

const ids = UNITS.map((u) => u.id)
assert.equal(new Set(ids).size, ids.length, where('duplicate unit id'))
assert.equal(UNITS.filter((u) => u.fixed).length, 1, where('exactly one unit has no end'))
assert.equal(UNITS.at(-1).id, 'sun', where('the unit with no end is last'))

/* The one inversion the ladder is allowed, and the only one. A lunation is
   longer than February and shorter than March, so no fixed order is right all
   year; 8% is the size of that crossing (31 / 29.53 - 1 = 5%) with a little
   room, and it is permitted between this one pair and nowhere else. */
const CROSSING = new Set(['lunation:month'])

/* Ranges that really do nest. Not every neighbouring pair does — a week
   straddles two months, and a lunation is not inside anything — so the page
   claims ordering by length, not containment, and this is only asserted where
   containment is actually true. */
const NESTS = [
  ['second', 'minute'], ['minute', 'hour'], ['hour', 'day'], ['day', 'week'],
  ['month', 'quarter'], ['quarter', 'year'], ['year', 'decade'],
  ['decade', 'century'], ['century', 'millennium'],
]

/* -------------------------------------------------------------------------- */
/* One instant, fully                                                         */
/* -------------------------------------------------------------------------- */

let checked = 0

function instant(d) {
  checked++
  const t = +d
  const us = liveUnits(d)
  const rs = us.map((u) => read(u, d))
  const spans = {}

  assert.ok(us.length >= UNITS.length - 1, where('too many units expired'))

  for (let i = 0; i < us.length; i++) {
    const u = us[i], v = rs[i]
    const at_ = (m) => where(`${u.id} @ ${d.toISOString()}: ${m}`)

    assert.ok(v.name.length > 0, at_('empty name'))
    assert.ok(Number.isFinite(v.frac), at_(`frac ${v.frac}`))
    assert.ok(v.frac >= 0 && v.frac <= 1, at_(`frac out of range: ${v.frac}`))
    assert.ok(Number.isFinite(v.seconds) && v.seconds > 0, at_(`seconds ${v.seconds}`))
    assert.ok(v.rate >= 0 && v.rate <= 1, at_(`rate ${v.rate}`))
    assert.ok(v.pct.endsWith('%'), at_(`pct ${v.pct}`))
    assert.ok(v.left.endsWith('left'), at_(`left ${v.left}`))

    if (u.fixed) {
      assert.equal(v.remaining, null, at_('a fixed unit has no remaining'))
      assert.equal(v.rate, 0, at_('a fixed unit is stopped, not merely slow'))
      continue
    }

    const [s, e] = u.span(d)
    spans[u.id] = [s, e]
    assert.ok(s <= t && t < e, at_(`instant outside its own span ${s}..${e}`))
    assert.ok(e > s, at_('span ends before it starts'))
    assert.ok(v.remaining > 0 && v.remaining <= e - s, at_(`remaining ${v.remaining}`))
    // frac and remaining are two views of the same fact and must agree.
    const implied = 1 - v.remaining / (e - s)
    assert.ok(Math.abs(implied - v.frac) < 1e-9, at_('frac disagrees with remaining'))
    assert.ok(v.rate > 0, at_('a live unit is moving'))
  }

  // Ordered by span length, shortest first — the dial's sort key.
  for (let i = 1; i < us.length; i++) {
    const a = rs[i - 1].seconds, b = rs[i].seconds
    if (b >= a) continue
    const key = `${us[i - 1].id}:${us[i].id}`
    assert.ok(CROSSING.has(key),
      where(`ladder inverted at ${key} @ ${d.toISOString()}`))
    assert.ok(a / b <= 1.08,
      where(`${key} inverted by ${((a / b - 1) * 100).toFixed(1)}%`))
  }

  for (const [inner, outer] of NESTS) {
    const [is, ie] = spans[inner], [os, oe] = spans[outer]
    assert.ok(is >= os && ie <= oe,
      where(`${inner} is not inside ${outer} @ ${d.toISOString()}`))
  }

  // The weekend row says which of its two jobs it is doing, and does that one.
  const wi = us.findIndex((u) => u.id === 'weekend')
  const [ws, we] = us[wi].span(d)
  const weekendNow = d.getDay() === 0 || d.getDay() === 6
  assert.equal(rs[wi].name,
    weekendNow ? 'The weekend itself' : 'Until the weekend',
    where(`weekend name @ ${d.toISOString()} (day ${d.getDay()})`))
  const days = (we - ws) / DAY
  // Two days or five, give or take an hour for a clock change inside it.
  assert.ok(weekendNow ? Math.abs(days - 2) < 0.06 : Math.abs(days - 5) < 0.06,
    where(`weekend span ${days.toFixed(3)} days @ ${d.toISOString()}`))
}

/* -------------------------------------------------------------------------- */
/* A year, then the awkward parts of it densely                               */
/* -------------------------------------------------------------------------- */

// 53 minutes, so the walk is not in phase with hours, days or weeks.
const STEP = 53 * 60_000
for (const year of [2024, 2026]) {           // a leap year and a common one
  const from = +new Date(year, 0, 1, 0, 3)
  const to = +new Date(year + 1, 0, 1)
  for (let t = from; t < to; t += STEP) instant(new Date(t))
}

/* Clock changes. Found rather than tabulated: any local day whose length is
   not 24 hours is one, whatever the rule is in this zone this year. */
const shifts = []
for (const year of [2024, 2025, 2026]) {
  for (let m = 0; m < 12; m++) {
    for (let day = 1; day <= 31; day++) {
      const s = new Date(year, m, day)
      if (s.getMonth() !== m) break
      s.setHours(0, 0, 0, 0)
      const e = new Date(s)
      e.setDate(e.getDate() + 1)
      const hours = (+e - +s) / 3_600_000
      if (Math.abs(hours - 24) > 1e-9) shifts.push({ s, hours })
    }
  }
}
if (TZ !== 'UTC' && TZ !== 'Asia/Kolkata') {
  assert.ok(shifts.length >= 4, where(`expected clock changes, found ${shifts.length}`))
}
for (const { s, hours } of shifts) {
  // A day is short or long, never both and never neither.
  assert.ok(hours > 22 && hours < 26, where(`day of ${hours}h on ${s.toDateString()}`))
  for (let k = -90; k <= 90 * 25; k += 7) instant(new Date(+s + k * 60_000))
}

// Month and quarter boundaries, where an off-by-one lands on the wrong month.
for (const year of [2024, 2026]) {
  for (let m = 0; m < 12; m++) {
    const b = +new Date(year, m, 1)
    for (let k = -3; k <= 3; k++) instant(new Date(b + k * 1000))
  }
}
// New year, and the last second of a decade, a century and a millennium.
for (const y of [2000, 2024, 2025, 2030, 2100, 3000]) {
  for (const k of [-2000, -1, 0, 1, 2000]) instant(new Date(+new Date(y, 0, 1) + k))
}

/* -------------------------------------------------------------------------- */
/* The prose                                                                  */
/* -------------------------------------------------------------------------- */

assert.equal(human(0), '0 ms left')
assert.equal(human(-5), '0 ms left', 'a span that has just ended does not go negative')
assert.equal(human(940), '940 ms left')
assert.equal(human(20_400), '20.4 seconds left')
assert.equal(human(DAY + 3600_000 * 9), '1 day, 9h left', 'never "1 days"')
assert.equal(human(DAY * 2 + 3600_000), '2 days, 1h left')
for (let ms = 0; ms < DAY * 800; ms = ms * 1.7 + 137) {
  const s = human(ms)
  assert.ok(s.endsWith('left'), `human(${ms}) = ${s}`)
  assert.ok(!s.includes('NaN') && !s.includes('-'), `human(${ms}) = ${s}`)
  assert.ok(!/\b1 days\b/.test(s), `human(${ms}) = ${s}`)
}

/* -------------------------------------------------------------------------- */
/* Rate                                                                       */
/* -------------------------------------------------------------------------- */

assert.equal(rateOf(0), 0)
assert.equal(rateOf(-1), 0)
assert.equal(rateOf(Infinity), 0)
assert.equal(rateOf(NaN), 0)
// Strictly ordered, and the whole point: the slowest live unit is not stopped.
const sample = UNITS.filter((u) => !u.fixed).map((u) => read(u, new Date()))
for (let i = 1; i < sample.length; i++) {
  assert.ok(sample[i].rate < sample[i - 1].rate,
    where(`rate not strictly decreasing at ${i}: ${sample[i - 1].rate} -> ${sample[i].rate}`))
}
assert.ok(sample.at(-1).rate > 0.05,
  where(`the millennium reads ${sample.at(-1).rate} — indistinguishable from stopped`))
assert.equal(rateOf(1), 1, 'the fastest unit saturates the scale')

/* -------------------------------------------------------------------------- */
/* The one unit that ends                                                     */
/* -------------------------------------------------------------------------- */

const OVERFLOW = 2_147_483_647_000
assert.equal(liveUnits(new Date(OVERFLOW - 1)).length, UNITS.length,
  where('the 32-bit row is live until the last millisecond'))
assert.equal(liveUnits(new Date(OVERFLOW)).length, UNITS.length - 1,
  where('the 32-bit row is gone the instant it overflows'))
assert.ok(!liveUnits(new Date(OVERFLOW)).some((u) => u.id === 'y2038'),
  where('and it is that row that went'))
// Nothing else may quietly acquire an expiry: a row that vanishes is a big
// change to the instrument, and it should never be a side effect.
assert.deepEqual(UNITS.filter((u) => u.until !== undefined).map((u) => u.id), ['y2038'])

/* -------------------------------------------------------------------------- */
/* Decimals                                                                   */
/* -------------------------------------------------------------------------- */

assert.equal(decimals(0.5, 60_000, false), 2)
assert.equal(decimals(0.5, DAY * 900, false), 4, 'a century needs more than two places')
assert.equal(decimals(0.99995, 1000, false), 4, 'the last seconds of a week are not "100%"')
assert.equal(decimals(0.46, null, true), 1)

console.log(`  ok    ${TZ}: ${checked.toLocaleString('en-US')} instants, ${UNITS.length} units each`)
