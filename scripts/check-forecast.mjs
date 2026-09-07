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
  deltaT, SHOWERS, moonDistanceKm, sunDistanceAu, discs, moonIllumination,
  shadowGeometry, transitGeometry, immersion,
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
console.log('\nthe Moon’s distance, and how big it looks\n')
/* -------------------------------------------------------------------------- */

/* Everything in this block exists so the page can draw the sky instead of
   labelling it. The hero picture is the actual obscuration, the moon rows are
   the actual terminator, and an annular eclipse is drawn with the ring the
   width it will really be. All of that is only worth doing if the numbers
   underneath are right, so they are checked harder than the drawing is. */

/* The distance range is the strongest single check available here, because
   nothing in the coefficient table mentions it. Perigee and apogee are 356,400
   and 406,700 km; a sign error or a dropped E factor moves an endpoint by
   thousands of kilometres and lands outside. */
{
  let lo = Infinity, hi = -Infinity, loAt = null, hiAt = null
  const start = Date.UTC(2020, 0, 1)
  for (let i = 0; i < 20 * 365 * 8; i++) {
    const d = new Date(start + i * 3 * 3600_000)
    const km = moonDistanceKm(d)
    if (km < lo) { lo = km; loAt = d }
    if (km > hi) { hi = km; hiAt = d }
  }
  check(lo > 356300 && lo < 356900, `closest the Moon gets in 2020–2040: ${lo.toFixed(0)} km on ${stamp(loAt)} (perigee is ~356,400)`)
  check(hi > 406400 && hi < 407000, `furthest: ${hi.toFixed(0)} km on ${stamp(hiAt)} (apogee is ~406,700)`)
}

/* The anomalistic month — perigee to perigee — is 27.55455 days, and is not
   written anywhere in the file. It comes out of the period of the dominant
   term, so recovering it says the term's rate is right. */
{
  const at = (d) => moonDistanceKm(d)
  const perigees = []
  const step = 3600_000
  for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2044, 0, 1); t += step) {
    const a = at(new Date(t - step)), b = at(new Date(t)), c = at(new Date(t + step))
    if (b < a && b < c) perigees.push(t)
  }
  const span = (perigees[perigees.length - 1] - perigees[0]) / (perigees.length - 1) / 86400_000
  near(span, 27.55455, 0.02, `the anomalistic month falls out of the distance series (${perigees.length} perigees)`)
}

/* The apparent size of the two discs. The Sun's semidiameter is 15'46" at
   perihelion and 15'44"... it barely moves; the Moon's swings by a tenth. */
{
  const d = discs(new Date('2026-07-04T00:00:00Z'))
  check(d.sun > 940 && d.sun < 980, `the Sun's semidiameter is ${d.sun.toFixed(1)}" (it is always 944–976")`)
  check(d.moonGeocentric > 880 && d.moonGeocentric < 1010, `the Moon's is ${d.moonGeocentric.toFixed(1)}" (890–1000")`)
  check(d.moonTopocentric > d.moonGeocentric, 'the Moon looks bigger from the ground under it than from the centre of the Earth')
}

/* And the one that matters: at the Moon's mean distance the ratio is under 1,
   which is why annular eclipses outnumber total ones. This is not asserted
   anywhere in the code — it is two distances and two diameters, and it is the
   reason the drawing of an average eclipse has a ring in it. */
{
  const mean = 358473400 / (385000.56 - 6378.14) / 959.63
  check(mean < 1 && mean > 0.97,
    `at mean distance the Moon covers ${(mean * 100).toFixed(1)}% of the Sun — under 1, which is why annulars are the commoner kind`)
}

/* -------------------------------------------------------------------------- */
console.log('\ntwo chapters that have to agree\n')
/* -------------------------------------------------------------------------- */

/* Chapter 54 decides total-or-annular from the sign of u, a quantity in its
   own coefficient table that has nothing to do with distance. Chapter 47 gives
   the Moon's distance, and dividing two apparent diameters decides the same
   question a completely different way.

   They should agree on every central eclipse for a century. Where they do not,
   the eclipse should be within a hair of the boundary — which is the
   definition of a hybrid, and is the interesting part rather than the
   embarrassing one. */
{
  let agree = 0, disagree = [], hybrids = 0
  const k0 = lunationNear(new Date('2000-01-01T00:00:00Z'))
  const k1 = lunationNear(new Date('2100-01-01T00:00:00Z'))
  for (let k = k0; k <= k1; k++) {
    const e = eclipseAt(k, 'solar')
    if (!e || !e.central) continue
    if (e.type === 'hybrid') { hybrids++; continue }
    const r = discs(tdToUtc(e.jde), e.gamma).ratio
    const bySize = r >= 1 ? 'total' : 'annular'
    if (bySize === e.type) agree++
    else disagree.push({ at: stamp(tdToUtc(e.jde)), says: e.type, size: r })
  }
  const total = agree + disagree.length
  const rate = agree / total
  check(rate > 0.93,
    `${agree}/${total} central eclipses 2000–2100 classified the same way by Meeus ch. 54 and by dividing two apparent diameters (${(rate * 100).toFixed(0)}%)`)
  // The near-misses are the point, so they are printed rather than hidden.
  const wide = disagree.filter((d) => Math.abs(d.size - 1) > 0.006)
  check(wide.length === 0,
    `every disagreement is within 0.6% of the total/annular boundary — i.e. is a near-hybrid${wide.length ? ': ' + wide.map((d) => `${d.at} ${d.says} at ${d.size.toFixed(4)}`).join(', ') : ''}`)
  ok(`the ${hybrids} hybrid eclipses of the century are excluded from that count, being neither`)
  for (const d of disagree.slice(0, 4))
    ok(`  borderline: ${d.at}, ch. 54 says ${d.says}, the discs come out ${d.size.toFixed(4)}`)
}

/* -------------------------------------------------------------------------- */
console.log('\nhow much of the Moon is lit\n')
/* -------------------------------------------------------------------------- */

/* Chapter 48 against chapter 49: take two hundred phases the phase series
   picks out, and ask the illumination series what the Moon looks like at each.
   Neither knows about the other. New moons must be dark, full moons lit, and
   the quarters exactly half — and "exactly half" is a strong claim, because a
   quarter phase is defined by elongation, not by illumination, and the two
   coincide only if both series are right. */
{
  const k0 = lunationNear(new Date('2000-01-01T00:00:00Z'))
  const want = { new: 0, first: 0.5, full: 1, last: 0.5 }
  const worst = { new: 0, first: 0, full: 0, last: 0 }
  for (let k = k0; k < k0 + 200; k++) {
    for (const phase of ['new', 'first', 'full', 'last']) {
      const f = moonIllumination(tdToUtc(phaseJde(k, phase))).fraction
      worst[phase] = Math.max(worst[phase], Math.abs(f - want[phase]))
    }
  }
  check(worst.new < 0.005, `200 new moons are dark to within ${(worst.new * 100).toFixed(2)}%`)
  check(worst.full < 0.005, `200 full moons are lit to within ${(worst.full * 100).toFixed(2)}%`)
  check(worst.first < 0.01, `200 first quarters are half lit to within ${(worst.first * 100).toFixed(2)}%`)
  check(worst.last < 0.01, `200 last quarters likewise, to ${(worst.last * 100).toFixed(2)}%`)
}

/* Waxing must mean growing. Sampled across a lunation rather than asserted. */
{
  const k = lunationNear(new Date('2026-06-01T00:00:00Z'))
  const t0 = +tdToUtc(phaseJde(k, 'new'))
  let bad = 0, samples = 0
  for (let h = 1; h < 29 * 24; h++) {
    const a = moonIllumination(new Date(t0 + (h - 1) * 3600_000))
    const b = moonIllumination(new Date(t0 + h * 3600_000))
    if (Math.abs(a.fraction - b.fraction) < 1e-6) continue
    samples++
    if (a.waxing !== (b.fraction > a.fraction)) bad++
  }
  check(bad === 0, `across one lunation, "waxing" agrees with "getting brighter" at all ${samples} sampled hours`)
}

/* Age runs 0 to 29.53 and resets at new moon. */
{
  const k = lunationNear(new Date('2026-06-01T00:00:00Z'))
  const atNew = moonIllumination(tdToUtc(phaseJde(k, 'new'))).age
  const atFull = moonIllumination(tdToUtc(phaseJde(k, 'full'))).age
  check(atNew < 0.002, `the Moon is ${(atNew * 24 * 60).toFixed(1)} minutes old at the moment of new moon`)
  near(atFull, 14.765, 0.35, 'and about half a lunation old at full')
  /* Never negative, never past the end of the lunation it is in, on any day of
     a decade. The upper bound is 29.9 and not the 29.53 of the mean synodic
     month, which is the mistake this check was written with: real lunations
     run from about 29.27 to 29.83 days, so a Moon 29.71 days old is not a bug,
     it is a long month. Bounding the answer by the average would have been
     measuring the average. */
  {
    let bad = 0, oldest = 0
    for (let i = 0; i < 3650; i++) {
      const age = moonIllumination(new Date(Date.UTC(2026, 0, 1) + i * 86400_000)).age
      oldest = Math.max(oldest, age)
      if (!(age >= 0 && age < 29.9)) bad++
    }
    check(bad === 0, `between 0 and 29.9 on every day of the next decade (oldest seen: ${oldest.toFixed(2)})`)
  }

  /* And the reason that bound is what it is. The length of a lunation swings
     by more than half a day either side of the average, because both bodies
     are on ellipses; the page's countdowns inherit that and so does the age. */
  {
    const k0 = lunationNear(new Date('2026-01-01T00:00:00Z'))
    let lo = Infinity, hi = -Infinity
    for (let k = k0; k < k0 + 300; k++) {
      const len = phaseJde(k + 1, 'new') - phaseJde(k, 'new')
      lo = Math.min(lo, len); hi = Math.max(hi, len)
    }
    check(lo > 29.2 && lo < 29.35 && hi > 29.75 && hi < 29.9,
      `lunations run ${lo.toFixed(2)}–${hi.toFixed(2)} days, not a constant 29.53`)
  }
}

/* -------------------------------------------------------------------------- */
console.log('\nwhat the page is handed to draw with\n')
/* -------------------------------------------------------------------------- */

/* The page draws each row from the model's own output rather than from the
   title string, so the numbers have to actually be attached. A row that lost
   its payload would silently fall back to a generic shape, which is the exact
   failure this whole file exists to prevent. */
{
  const list = forecast(new Date('2026-01-01T00:00:00Z'), new Date('2028-01-01T00:00:00Z'))
  const missing = list.filter((e) =>
    (e.kind === 'eclipse' && !e.eclipse) ||
    (e.kind === 'phase' && !e.phase) ||
    (e.kind === 'season' && !e.season) ||
    (e.kind === 'apsis' && !e.apsis) ||
    (e.kind === 'shower' && !e.shower))
  check(missing.length === 0, `all ${list.length} events over two years carry the numbers behind them`)

  const ecl = list.filter((e) => e.kind === 'eclipse')
  check(ecl.every((e) => e.eclipse.magnitude > 0 && e.eclipse.magnitude < 2),
    `${ecl.length} eclipses all report a drawable magnitude`)
  check(ecl.every((e) => Math.abs(e.eclipse.gamma) < 1.6), 'and a gamma inside the range an eclipse can have')
  check(ecl.every((e) => e.title.toLowerCase().includes(e.eclipse.type)),
    'the type in the payload is the type in the sentence — the picture cannot contradict the words')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe geometry the pictures are drawn from\n')
/* -------------------------------------------------------------------------- */

/* This block exists because of a bug it would have caught on the first run.
   The page draws a lunar eclipse as the Moon crossing the Earth's shadow, and
   it took chapter 54's printed constants at face value: umbra 1.0128, Moon
   0.545. Both are wrong as radii. 0.545 is the Moon's *diameter* — the
   magnitude formula runs from 0 to 1 over two Moon radii — and 1.0128 is the
   umbra plus the Moon, because magnitude 0 is first contact. Read straight,
   they make the shadow and the Moon each about twice their real size, and the
   Moon twice as big relative to the shadow as it should be.

   Nothing failed. The dates stayed right, the classifications stayed right,
   and the only symptom was a penumbral eclipse drawn sitting deep inside the
   umbra — which is a contradiction you can only see by looking at the picture
   and knowing what the word means.

   So the geometry now has to reproduce the magnitude the model already
   reports, independently. If the radii are wrong, the immersion comes out
   wrong, and this fails. */
{
  const list = forecast(new Date('2026-01-01T00:00:00Z'), new Date('2046-01-01T00:00:00Z'))
    .filter((e) => e.kind === 'eclipse')
  const lunar = list.filter((e) => e.eclipse.kind === 'lunar')
  const solar = list.filter((e) => e.eclipse.kind === 'solar')

  let worst = 0, worstAt = ''
  for (const e of lunar) {
    const s = shadowGeometry(e.eclipse)
    const r = e.eclipse.type === 'penumbral' ? s.penumbra : s.umbra
    const d = Math.abs(immersion(s, r) - e.eclipse.magnitude)
    if (d > worst) { worst = d; worstAt = `${e.title} ${stamp(e.when)}` }
  }
  check(worst < 1e-9,
    `${lunar.length} lunar eclipses over 20 years: the shadow drawn round the Moon holds exactly the magnitude the model reports (worst ${worst.toExponential(1)}${worst > 1e-9 ? ' at ' + worstAt : ''})`)

  /* And the shadow is the size the shadow is. The Earth's umbra at the Moon's
     distance is about 2.6-2.8 Moon widths across and the penumbra about 4.7 —
     numbers from observation, not from this file. Reading the constants at
     face value gave 1.9 and 2.9. */
  {
    const s = shadowGeometry(lunar[0].eclipse)
    const um = s.umbra / s.moon, pen = s.penumbra / s.moon
    check(um > 2.55 && um < 2.85, `the umbra is ${um.toFixed(2)} Moon widths across (observed: about 2.7)`)
    check(pen > 4.5 && pen < 4.9, `the penumbra is ${pen.toFixed(2)} (about 4.7)`)
    check(Math.abs(s.moon - 1737.4 / 6378.14) < 0.001,
      `and the Moon itself is ${s.moon} Earth radii, which is 1737 km over 6378`)
  }

  /* A penumbral eclipse is defined by missing the umbra. The drawing has to
     agree, which is the specific thing that was wrong. */
  {
    const bad = lunar.filter((e) => {
      const s = shadowGeometry(e.eclipse)
      const touches = s.gamma < s.umbra + s.moon
      return e.eclipse.type === 'penumbral' ? touches : !touches
    })
    check(bad.length === 0,
      `every penumbral eclipse clears the umbra in the drawing, and every partial and total one reaches it${bad.length ? ' — ' + bad.slice(0, 3).map((e) => `${e.title} ${stamp(e.when)}`).join(', ') : ''}`)
  }

  /* A totally eclipsed Moon is inside the umbra; the geometry has to put it
     there rather than merely report a magnitude above 1. */
  {
    const bad = lunar.filter((e) => {
      if (e.eclipse.type !== 'total') return false
      const s = shadowGeometry(e.eclipse)
      return s.gamma + s.moon > s.umbra
    })
    check(bad.length === 0, 'and every total one fits inside the umbra with room to spare')
  }

  /* The solar side. The Moon has to actually overlap the Sun at greatest
     eclipse, and by exactly the magnitude claimed. */
  {
    let worstS = 0
    let apart = 0
    for (const e of solar) {
      const t = transitGeometry(e.eclipse, e.when)
      if (t.sMin >= 1 + t.ratio) apart++
      if (!e.eclipse.central) {
        const m = (1 + t.ratio - t.sMin) / 2
        worstS = Math.max(worstS, Math.abs(m - e.eclipse.magnitude))
      }
    }
    check(apart === 0, `${solar.length} solar eclipses: the two discs overlap in every one of them`)
    check(worstS < 1e-9, `and every partial covers exactly the fraction of the Sun's diameter it claims (worst ${worstS.toExponential(1)})`)
    const central = solar.filter((e) => e.eclipse.central)
    check(central.every((e) => transitGeometry(e.eclipse, e.when).sMin === 0),
      `the ${central.length} central ones are drawn dead concentric, which is what central means`)
  }
}

/* -------------------------------------------------------------------------- */
console.log(failures ? `\n${failures} failed\n` : '\nall good\n')
process.exitCode = failures ? 1 : 0
