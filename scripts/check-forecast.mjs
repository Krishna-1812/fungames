/**
 * check-forecast — does the sky model agree with the sky?
 *
 * Universe Forecast claims every date on it is computed rather than typed in.
 * That claim is only worth making if the computation reproduces answers
 * somebody else already has, so this checks three independent kinds:
 *
 *   1. Meeus's own worked examples. These are the strongest evidence there is,
 *      because they are exactly what the printed algorithm is supposed to
 *      produce — a mismatch is a transcription error in the coefficient tables
 *      and nothing else.
 *   2. Eclipses people have stood outside and watched, by date and by type.
 *   3. Facts about how eclipses behave that no single wrong coefficient could
 *      fake: every solar eclipse lands on a new moon, every lunar one on a
 *      full moon, they repeat on the Saros, and there are never fewer than two
 *      solar eclipses in a year.
 *
 * The third kind is the one worth having. Checking a handful of dates proves
 * the series is right near those dates; checking that the whole 21st century
 * has between two and five solar eclipses every single year proves it is right
 * everywhere, and would catch a sign error that the spot checks sailed past.
 *
 *   node scripts/check-forecast.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  seasonJde, phaseJde, eclipseAt, apsisJde, apsisJde: _a,
  dateToJulian, tdToUtc, lunationNear, forecast, countdown, formatWhen,
  deltaT, SHOWERS,
} = await import('../src/lib/sky-forecast.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const near = (a, b, tol, m) =>
  check(Math.abs(a - b) <= tol, `${m}  (${a.toFixed(5)} vs ${b.toFixed(5)}, tol ${tol})`)

/** A UTC instant as "YYYY-MM-DD HH:MM". */
const stamp = (d) => d.toISOString().slice(0, 16).replace('T', ' ')
/** Minutes between two instants. */
const mins = (a, b) => Math.abs(+a - +b) / 60000

/* -------------------------------------------------------------------------- */
console.log('\nMeeus’s worked examples\n')
/* -------------------------------------------------------------------------- */

/* Example 27.a — the June solstice of 1962. The book prints the answer to five
   decimal places of a Julian day, which is under a second. */
near(seasonJde(1962, 'june'), 2437837.39245, 0.00002, 'ex 27.a  June solstice 1962')

/* Example 49.a — the new moon of 1977 February.
   Checked against the observed instant, 03:37 UT on the 18th, rather than
   against the book, because the number the book prints most prominently for
   this example (2443192.94102) is the *mean* phase before the corrections are
   applied — seven hours earlier than the answer. It is exactly the value a
   careless reading lands on, so it is worth naming here. */
{
  const jde = phaseJde(-283, 'new')
  near(jde, 2443192.65118, 0.00002, 'ex 49.a  new moon Feb 1977')
  const utc = tdToUtc(jde)
  check(
    utc.getUTCDate() === 18 && utc.getUTCMonth() === 1 && mins(utc, new Date('1977-02-18T03:37:00Z')) < 2,
    `  and it lands where the record says: ${stamp(utc)} UT`,
  )
}

/* Example 49.b — a last quarter, which exercises the other coefficient list
   and the W term that separates first quarter from last. */
near(phaseJde(544, 'last'), 2467636.49186, 0.00002, 'ex 49.b  last quarter Jan 2044')

/* Example 38.a — the Earth at perihelion in 1990, around January 4.65 TD.
   Held to a couple of hours rather than to the minute, and deliberately. The
   series in chapter 38 tracks the Earth–Moon barycentre; the Earth's own
   centre swings around that point on a monthly cycle, which moves the true
   instant of closest approach by hours depending on where the Moon happens to
   be. Demanding minute-level agreement here would be demanding the model be
   more precise than the quantity is well-defined. */
near(
  apsisJde(1990, 'perihelion'),
  dateToJulian(new Date(Date.UTC(1990, 0, 4))) + 0.6547,
  0.05,
  'ex 38.a  perihelion 1990',
)

/* -------------------------------------------------------------------------- */
console.log('\neclipses people have watched\n')
/* -------------------------------------------------------------------------- */

/* Each of these is checked by date and by type. The type is the interesting
   half: it comes out of gamma and u, and a model that got the date right and
   the type wrong would be a model that cannot tell a total eclipse from a
   ring, which is the only distinction anybody cares about. */
const WATCHED = [
  { date: '1999-08-11', kind: 'solar', type: 'total', what: 'over Cornwall and central Europe' },
  { date: '2017-08-21', kind: 'solar', type: 'total', what: 'coast to coast across the US' },
  { date: '2023-10-14', kind: 'solar', type: 'annular', what: 'the ring over the American west' },
  { date: '2024-04-08', kind: 'solar', type: 'total', what: 'Mexico, the US and Canada' },
  { date: '2026-08-12', kind: 'solar', type: 'total', what: 'Iceland and northern Spain' },
  { date: '2025-03-14', kind: 'lunar', type: 'total', what: 'the Americas' },
  { date: '2025-09-07', kind: 'lunar', type: 'total', what: 'Asia and the Indian Ocean' },
  { date: '2022-11-08', kind: 'lunar', type: 'total', what: 'the Pacific' },
]

/** Every eclipse of a kind in a window, as { day, type }. */
function eclipsesBetween(fromISO, toISO, kind) {
  const from = new Date(fromISO), to = new Date(toISO)
  const out = []
  for (let k = lunationNear(from) - 2; k <= lunationNear(to) + 2; k++) {
    const e = eclipseAt(k, kind)
    if (!e) continue
    const when = tdToUtc(e.jde)
    if (when < from || when > to) continue
    out.push({ when, day: when.toISOString().slice(0, 10), type: e.type, gamma: e.gamma, k })
  }
  return out
}

for (const w of WATCHED) {
  const day = new Date(w.date + 'T00:00:00Z')
  const found = eclipsesBetween(
    new Date(+day - 36e5 * 36).toISOString(),
    new Date(+day + 36e5 * 60).toISOString(),
    w.kind,
  ).find((e) => e.day === w.date)
  if (!found) { fail(`${w.date} ${w.type} ${w.kind} eclipse, ${w.what} — not found at all`); continue }
  check(found.type === w.type,
    `${w.date} ${w.kind} eclipse, ${w.what} — ${found.type}${found.type === w.type ? '' : `, expected ${w.type}`}`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthings a wrong coefficient could not fake\n')
/* -------------------------------------------------------------------------- */

/* A solar eclipse is a new moon that lines up, so its moment of greatest
   eclipse has to sit within an hour or so of the new moon it belongs to. This
   is the check that ties chapter 54 back to chapter 49; they are separate
   series and nothing but the astronomy makes them agree. */
{
  let worstSolar = 0, worstLunar = 0, n = 0
  for (let k = -1200; k < 1200; k++) {
    const s = eclipseAt(k, 'solar')
    if (s) { worstSolar = Math.max(worstSolar, mins(tdToUtc(s.jde), tdToUtc(phaseJde(k, 'new')))); n++ }
    const l = eclipseAt(k, 'lunar')
    if (l) { worstLunar = Math.max(worstLunar, mins(tdToUtc(l.jde), tdToUtc(phaseJde(k, 'full')))); n++ }
  }
  check(worstSolar < 70, `every solar eclipse sits on its new moon (worst gap ${worstSolar.toFixed(0)} min)`)
  check(worstLunar < 70, `every lunar eclipse sits on its full moon (worst gap ${worstLunar.toFixed(0)} min)`)
  ok(`${n} eclipses examined across two centuries either side of 2000`)
}

/* Between two and five solar eclipses every year, and four to seven eclipses
   of both kinds together. This has been true of every year in recorded history
   and is a consequence of the geometry rather than of any one number. */
{
  let bad = []
  for (let y = 1900; y <= 2100; y++) {
    const from = `${y}-01-01T00:00:00Z`, to = `${y}-12-31T23:59:59Z`
    const s = eclipsesBetween(from, to, 'solar').length
    const l = eclipsesBetween(from, to, 'lunar').length
    if (s < 2 || s > 5) bad.push(`${y}: ${s} solar`)
    if (s + l < 4 || s + l > 7) bad.push(`${y}: ${s + l} in total`)
  }
  check(bad.length === 0, `1900–2100: 2–5 solar eclipses a year, 4–7 altogether${bad.length ? ' — ' + bad.slice(0, 4).join(', ') : ''}`)
}

/* The Saros. An eclipse repeats 223 lunations later — 18 years and 11 days —
   because that interval is very nearly a whole number of all three months the
   geometry depends on. If the model has this, it has the geometry. */
{
  let held = 0, broke = 0
  for (let k = -600; k < 600; k++) {
    const a = eclipseAt(k, 'solar')
    if (!a) continue
    const b = eclipseAt(k + 223, 'solar')
    if (b) held++
    else broke++
  }
  check(broke / (held + broke) < 0.04,
    `solar eclipses recur one Saros later (${held} held, ${broke} lapsed — series do end, so a few must)`)
}

/* The gate itself: nothing outside the eclipse limits, everything inside. */
{
  const gammas = []
  for (let k = -600; k < 600; k++) {
    const e = eclipseAt(k, 'solar')
    if (e) gammas.push(Math.abs(e.gamma))
  }
  check(Math.max(...gammas) <= 1.62, `no solar eclipse further off-axis than the limit (max |gamma| ${Math.max(...gammas).toFixed(3)})`)
  check(gammas.some((g) => g < 0.1), 'some eclipses pass almost exactly through the centre')
}

/* Total solar eclipses are the minority, and roughly a quarter of the whole. */
{
  const all = []
  for (let k = -1200; k < 1200; k++) { const e = eclipseAt(k, 'solar'); if (e) all.push(e.type) }
  const frac = (t) => all.filter((x) => x === t).length / all.length
  check(frac('total') > 0.2 && frac('total') < 0.32, `totals are 20–32% of solar eclipses (${(frac('total') * 100).toFixed(0)}%)`)
  check(frac('annular') > 0.2 && frac('annular') < 0.4, `annulars are 20–40% (${(frac('annular') * 100).toFixed(0)}%)`)
  check(frac('partial') > 0.25 && frac('partial') < 0.4, `partials are 25–40% (${(frac('partial') * 100).toFixed(0)}%)`)
  check(frac('hybrid') > 0 && frac('hybrid') < 0.06, `hybrids are rare but real (${(frac('hybrid') * 100).toFixed(1)}%)`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe rest of the sky\n')
/* -------------------------------------------------------------------------- */

/* The tropical year. Averaged over two centuries the March equinox has to
   recur every 365.2422 days, which is the number the Gregorian calendar was
   built to chase and is not written down anywhere in this file. */
{
  const span = (seasonJde(2100, 'march') - seasonJde(1900, 'march')) / 200
  near(span, 365.2422, 0.0004, 'the tropical year falls out of the season series')
}

/* The synodic month, likewise, out of the phase series.
   The tolerance is a couple of ten-thousandths of a day rather than the
   millionth the constant is quoted to, and that is a property of the
   measurement rather than of the series: the two endpoints carry their own
   periodic corrections, worth up to half a day each, and dividing a leftover
   of that size by 2,400 lunations leaves exactly this much behind. A tighter
   bound here would be measuring the endpoints, not the month. */
{
  const span = (phaseJde(1200, 'new') - phaseJde(-1200, 'new')) / 2400
  near(span, 29.530589, 0.0004, 'the synodic month falls out of the phase series')
}

/* The four seasons come in order and roughly a quarter of a year apart. */
{
  let bad = 0
  for (let y = 1950; y <= 2100; y++) {
    const s = ['march', 'june', 'september', 'december'].map((w) => seasonJde(y, w))
    for (let i = 1; i < 4; i++) {
      const gap = s[i] - s[i - 1]
      if (gap < 88 || gap > 95) bad++
    }
  }
  check(bad === 0, '1950–2100: the seasons arrive in order, 88–95 days apart')
}

/* Perihelion is in the first week of January and aphelion in the first week of
   July — the fact on the page most likely to be disbelieved, so it is checked. */
{
  let bad = []
  for (let y = 1950; y <= 2100; y++) {
    const p = tdToUtc(apsisJde(y, 'perihelion'))
    const a = tdToUtc(apsisJde(y, 'aphelion'))
    if (p.getUTCMonth() !== 0 || p.getUTCDate() > 7) bad.push(`perihelion ${y} ${stamp(p)}`)
    if (a.getUTCMonth() !== 6 || a.getUTCDate() > 7) bad.push(`aphelion ${y} ${stamp(a)}`)
  }
  check(bad.length === 0, `1950–2100: perihelion in early January, aphelion in early July${bad.length ? ' — ' + bad.slice(0, 3).join(', ') : ''}`)
}

/* ΔT is not a formula and should not pretend to be one outside its fit. */
{
  check(deltaT(2026) > 60 && deltaT(2026) < 90, `ΔT in 2026 is ${deltaT(2026).toFixed(0)} s, in the right decade`)
  check(deltaT(1500) === deltaT(2005), 'ΔT is held flat outside the range it was fitted over, rather than extrapolated')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe page’s own list\n')
/* -------------------------------------------------------------------------- */

{
  const from = new Date('2026-01-01T00:00:00Z')
  const to = new Date('2027-01-01T00:00:00Z')
  const list = forecast(from, to)

  check(list.length > 60, `a year of sky has ${list.length} events in it`)
  check(list.every((e, i) => i === 0 || +list[i - 1].when <= +e.when), 'the forecast comes out in order')
  check(list.every((e) => e.when >= from && e.when <= to), 'nothing outside the window')
  check(list.every((e) => e.detail.length > 30), 'every event says something')
  check(list.every((e) => !/undefined|NaN|Invalid/.test(e.title + e.detail + e.when)), 'no holes in any line')

  const phases = list.filter((e) => e.kind === 'phase')
  check(phases.length >= 48 && phases.length <= 54, `${phases.length} lunar phases in the year (expect ~49)`)

  const showers = list.filter((e) => e.kind === 'shower')
  check(showers.length === SHOWERS.length, `${showers.length} meteor showers, one for each in the table`)

  const seasons = list.filter((e) => e.kind === 'season')
  check(seasons.length === 4, 'four seasons')

  const eclipses = list.filter((e) => e.kind === 'eclipse')
  ok(`eclipses in 2026: ${eclipses.map((e) => `${e.title} on ${stamp(e.when)}`).join('; ') || 'none'}`)

  // The countdown is the one piece of copy that changes every second.
  const t0 = new Date('2026-01-01T00:00:00Z')
  const cd = (mins) => countdown(t0, new Date(+t0 + mins * 60000))
  check(cd(0.2) === 'any minute', `under a minute reads "${cd(0.2)}"`)
  check(cd(11) === 'in 11 minutes', `eleven minutes reads "${cd(11)}"`)
  check(cd(60 * 5) === 'in 5 hours', `five hours reads "${cd(60 * 5)}"`)
  check(cd(60 * 24 * 3) === 'in 3 days', `three days reads "${cd(60 * 24 * 3)}"`)
  check(/^in \d+ months$/.test(cd(60 * 24 * 200)), `two hundred days reads "${cd(60 * 24 * 200)}"`)
  check(/years$/.test(cd(60 * 24 * 900)), `nine hundred days reads "${cd(60 * 24 * 900)}"`)
  check(countdown(t0, new Date(+t0 - 5000)) === 'now', 'something already happening reads "now"')

  const one = list[0]
  check(/UTC$/.test(formatWhen(one.when, true)), `timed events name their timezone: "${formatWhen(one.when, true)}"`)
  check(/^the night of /.test(formatWhen(one.when, false)),
    `untimed ones do not pretend to a clock: "${formatWhen(one.when, false)}"`)
}

/* -------------------------------------------------------------------------- */
console.log(failures ? `\n${failures} failed\n` : '\nall good\n')
process.exitCode = failures ? 1 : 0
