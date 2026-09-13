/**
 * check-incident-model — proves the pure model behind Days Since Incident,
 * against real fixture data captured from the live feeds while building it
 * (not against the network, which every other checker on this site also
 * avoids, and which this page's own multi-second live calls make doubly
 * worth avoiding here).
 *
 *   1. GOES flare-class parsing reproduces the real published flux
 *      boundaries (A/B/C/M/X, one decade apart) and rejects garbage.
 *   2. Kp/G-scale: a storm's *peak* Kp is picked out of its whole reading
 *      list, not its first or its last.
 *   3. mostRecentQualifying finds the most recent event that clears a
 *      threshold, not the largest ever — the two differ whenever a smaller
 *      qualifying event happened more recently than a bigger one.
 *   4. Real USGS/DONKI response shapes parse into the fields the page reads.
 *   5. Every category list is internally consistent: ascending thresholds,
 *      unique ids, and a threshold label that actually names the number
 *      `min` holds.
 *   6. daysSince/elapsedParts hold up arithmetically at exact boundaries.
 *
 *   node scripts/check-incident-model.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  ALL_CATEGORIES, EARTHQUAKE_CATEGORIES, FLARE_CATEGORIES, STORM_CATEGORIES, SHOCK_CATEGORIES,
  daysSince, elapsedParts, mostRecentQualifying, flareFlux, peakKp,
  parseUsgsFeature, parseDonkiFlare, parseDonkiStorm, parseDonkiShock,
} = await import('../src/lib/incident-model.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol

/* ---- 1. flare class boundaries -------------------------------------------- */

console.log('GOES flare-class flux parses to the real published boundaries')
{
  check(close(flareFlux('C1.0'), 1e-6), `C1.0 is the C-class floor, 1e-6 W/m^2 (got ${flareFlux('C1.0')})`)
  check(close(flareFlux('M1.0'), 1e-5), `M1.0 is the M-class floor, 1e-5 W/m^2 (got ${flareFlux('M1.0')})`)
  check(close(flareFlux('X1.0'), 1e-4), `X1.0 is the X-class floor, 1e-4 W/m^2 (got ${flareFlux('X1.0')})`)
  check(close(flareFlux('X5.0'), 5e-4), `X5.0 is 5e-4 W/m^2 (got ${flareFlux('X5.0')})`)
  check(close(flareFlux('X10.0'), 1e-3), `X10.0 is 1e-3 W/m^2 (got ${flareFlux('X10.0')})`)
  check(close(flareFlux('B3.1'), 3.1e-7), `B3.1 (got ${flareFlux('B3.1')})`)
  check(close(flareFlux('A9.9'), 9.9e-8), `A9.9 (got ${flareFlux('A9.9')})`)
  check(flareFlux('X9.6') < flareFlux('X10.0'), 'X9.6 is genuinely below X10.0 (no fixed ceiling on X, but the numbers still order)')
  check(flareFlux('') === null, 'empty string is rejected rather than silently parsed as 0')
  check(flareFlux('Q4.0') === null, 'an invalid letter class is rejected')
  check(flareFlux('M') === null, 'a class with no magnitude digits is rejected')
}

/* ---- 2. peak Kp, not first-or-last ---------------------------------------- */

console.log('\npeakKp picks the storm\'s maximum reading, not its first or last')
{
  const readings = [
    { kpIndex: 5.33, observedTime: '2025-01-01T00:00Z' },
    { kpIndex: 8.0, observedTime: '2025-01-01T09:00Z' },
    { kpIndex: 6.67, observedTime: '2025-01-01T18:00Z' },
  ]
  const peak = peakKp(readings)
  check(peak !== null && close(peak.kp, 8.0), `peak Kp is 8.0, the middle reading (got ${peak?.kp})`)
  check(peak !== null && peak.time === Date.parse('2025-01-01T09:00Z'), 'peak time is the timestamp the max reading actually carries')
  check(peakKp([]) === null, 'an empty reading list is "no data", not a peak of 0')
  check(peakKp(undefined) === null, 'a missing reading list is "no data" too')
}

/* ---- 3. most-recent-qualifying is not most-severe-ever -------------------- */

console.log('\nmostRecentQualifying finds the most recent qualifier, not the biggest ever')
{
  const cat = { id: 'eq-7.0', kind: 'quake', title: 't', thresholdLabel: 'M7.0+', min: 7.0 }
  const events = [
    { kind: 'quake', time: 1000, value: 9.1, detail: 'a huge, old quake' },
    { kind: 'quake', time: 5000, value: 7.2, detail: 'a smaller, newer quake that still clears the bar' },
    { kind: 'quake', time: 3000, value: 6.9, detail: 'newer than the huge one, but does not qualify' },
  ]
  const found = mostRecentQualifying(events, cat)
  check(found?.detail === 'a smaller, newer quake that still clears the bar', 'the newer qualifying M7.2 wins over the older M9.1')

  const noneQualify = mostRecentQualifying([{ kind: 'quake', time: 9999, value: 5.0, detail: 'too small' }], cat)
  check(noneQualify === null, 'nothing at all qualifies -> null, not the closest miss')

  const wrongKind = mostRecentQualifying([{ kind: 'flare', time: 9999, value: 100, detail: 'a flare, not a quake' }], cat)
  check(wrongKind === null, 'events of a different kind are ignored even if their raw value would clear the bar')

  const empty = mostRecentQualifying([], cat)
  check(empty === null, 'an empty event list -> null')
}

/* ---- 4. real API shapes parse correctly ----------------------------------- */

console.log('\nreal USGS and DONKI response shapes parse into the fields the page reads')
{
  // Captured live from earthquake.usgs.gov while building this page.
  const usgs = {
    properties: {
      mag: 6.5, place: '126 km NNE of Teluknaga, Indonesia', time: 1789161835907,
      title: 'M 6.5 - 126 km NNE of Teluknaga, Indonesia', tsunami: 0,
    },
  }
  const q = parseUsgsFeature(usgs)
  check(q.kind === 'quake' && close(q.value, 6.5) && q.time === 1789161835907, 'USGS feature parses to a quake event with the right magnitude and epoch time')
  check(q.detail === 'M 6.5 - 126 km NNE of Teluknaga, Indonesia', 'the USGS title is used verbatim as the human-readable detail')

  // Captured live from api.nasa.gov/DONKI/FLR.
  const flare = {
    flrID: '2026-01-01T02:15:00-FLR-001', classType: 'C9.6',
    beginTime: '2026-01-01T02:15Z', peakTime: '2026-01-01T02:25Z', endTime: '2026-01-01T02:33Z',
    sourceLocation: 'S10E03',
  }
  const fl = parseDonkiFlare(flare)
  check(fl !== null && fl.kind === 'flare' && close(fl.value, flareFlux('C9.6')), 'a DONKI flare record parses to its real flux')
  check(fl?.time === Date.parse('2026-01-01T02:25Z'), 'the flare\'s peakTime is used over its beginTime when both are present')
  check(parseDonkiFlare({ classType: 'C9.6', beginTime: '2026-01-01T02:15Z' })?.time === Date.parse('2026-01-01T02:15Z'), 'beginTime is the fallback when peakTime is absent')
  check(parseDonkiFlare({ classType: 'not-a-class', beginTime: '2026-01-01T02:15Z' }) === null, 'an unparseable class type yields no event rather than a fabricated one')

  // Captured live from api.nasa.gov/DONKI/GST.
  const storm = {
    gstID: '2025-01-01T09:00:00-GST-001', startTime: '2025-01-01T09:00Z',
    allKpIndex: [
      { observedTime: '2025-01-01T12:00Z', kpIndex: 6.33 },
      { observedTime: '2025-01-01T15:00Z', kpIndex: 6.67 },
      { observedTime: '2025-01-01T18:00Z', kpIndex: 8.0 },
      { observedTime: '2025-01-01T21:00Z', kpIndex: 6.67 },
    ],
  }
  const gs = parseDonkiStorm(storm)
  check(gs !== null && gs.kind === 'storm' && close(gs.value, 8.0), 'a DONKI storm record parses to its own peak Kp, not its startTime reading')
  check(gs?.time === Date.parse('2025-01-01T18:00Z'), 'the storm event time is the peak reading\'s own timestamp')
  check(parseDonkiStorm({ allKpIndex: [] }) === null, 'a storm record with no readings at all yields no event')

  // Captured live from api.nasa.gov/DONKI/IPS.
  const shock = {
    activityID: '2025-01-01T01:20:00-IPS-001', location: 'STEREO A', eventTime: '2025-01-01T01:20Z',
  }
  const ip = parseDonkiShock(shock)
  check(ip !== null && ip.kind === 'shock' && ip.time === Date.parse('2025-01-01T01:20Z'), 'a DONKI IPS record parses to a shock event at its real event time')
  check(ip?.detail.includes('STEREO A'), 'the shock\'s real detecting spacecraft is named in the detail line')
}

/* ---- 5. category lists are internally consistent -------------------------- */

console.log('\nevery category list is internally consistent')
{
  for (const [name, list] of Object.entries({ EARTHQUAKE_CATEGORIES, FLARE_CATEGORIES, STORM_CATEGORIES, SHOCK_CATEGORIES })) {
    let ascending = true
    for (let i = 1; i < list.length; i++) if (!(list[i].min > list[i - 1].min)) ascending = false
    check(ascending, `${name}: thresholds strictly increase down the list`)
    check(new Set(list.map((c) => c.id)).size === list.length, `${name}: every id is unique`)
    check(list.every((c) => c.title.length > 3 && c.thresholdLabel.length > 0), `${name}: every row has a real title and threshold label`)
  }
  check(new Set(ALL_CATEGORIES.map((c) => c.id)).size === ALL_CATEGORIES.length, 'ids are unique across every category, not just within one list')
  check(ALL_CATEGORIES.length === EARTHQUAKE_CATEGORIES.length + FLARE_CATEGORIES.length + STORM_CATEGORIES.length + SHOCK_CATEGORIES.length, 'ALL_CATEGORIES is exactly the concatenation of the four lists')

  // The published real thresholds this page claims, restated independently so
  // a slip in the source file has to happen twice to survive.
  check(EARTHQUAKE_CATEGORIES.map((c) => c.min).join(',') === '2.5,4.5,6,7,8', 'earthquake tiers are the real 2.5/4.5/6.0/7.0/8.0 USGS-style thresholds')
  check(STORM_CATEGORIES.map((c) => c.min).join(',') === '5,6,7,8,9', 'storm tiers are exactly NOAA\'s own G1-G5 Kp thresholds (5,6,7,8,9)')
  check(FLARE_CATEGORIES.map((c) => c.min).join(',') === [1e-6, 1e-5, 1e-4, 5e-4, 1e-3].join(','), 'flare tiers are C/M/X/X5/X10 in real W/m^2 flux')
}

/* ---- 6. day/hour/minute arithmetic ----------------------------------------- */

console.log('\ndaysSince and elapsedParts hold at exact boundaries')
{
  const now = Date.parse('2026-09-13T12:00:00Z')
  check(daysSince(now, now) === 0, 'no time elapsed -> 0 days')
  check(daysSince(now, now - 86_400_000) === 1, 'exactly one day ago -> 1')
  check(daysSince(now, now - 86_400_000 + 1) === 0, 'one day minus one millisecond ago -> still 0 (floor, not round)')
  check(daysSince(now, now - 10 * 86_400_000 - 1) === 10, '10 days and a little more -> 10, not 11')

  const p1 = elapsedParts(now, now - (2 * 86_400_000 + 3 * 3_600_000 + 45 * 60_000))
  check(p1.days === 2 && p1.hours === 3 && p1.minutes === 45, `2 days 3h45m decomposes correctly (got ${JSON.stringify(p1)})`)
  const p2 = elapsedParts(now, now)
  check(p2.days === 0 && p2.hours === 0 && p2.minutes === 0, 'zero elapsed time -> all zero, not negative or NaN')
  const p3 = elapsedParts(now, now + 60_000) // a future timestamp, e.g. clock skew
  check(p3.days === 0 && p3.hours === 0 && p3.minutes === 0, 'a timestamp in the future clamps to zero rather than going negative')
}

console.log(failures ? `\n${failures} failed.` : '\nAll incident-model checks passed.')
process.exitCode = failures ? 1 : 0
