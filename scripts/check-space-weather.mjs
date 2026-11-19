/**
 * check-space-weather — do Days Since Incident's space-weather rows read
 * every source the way the source means it?
 *
 * The rows are answered by whichever of NOAA SWPC, GFZ Potsdam, HEK and
 * NASA DONKI answers (lib/space-weather.ts), merged with a seed read from the
 * full records (data/incident-seed.ts). Each source writes the same facts
 * differently, and each difference is a place a row could quietly be wrong:
 *
 *   1. Flares: SWPC's, HEK's ("X17." with a bare point) and DONKI's rows all
 *      come out as the same GOES class and flux.
 *   2. Storms: Kp in thirds, named the way NOAA names them, and NOAA's
 *      G-levels from them — 9- is G4, only 9 is G5, 5- is not a storm.
 *   3. Shocks: DONKI's log, and SWPC's sudden-impulse summary.
 *   4. Merging: the most recent qualifying event wins, a smaller newer one
 *      over a bigger older one, and a source that is down changes nothing.
 *   5. The traces: the X-ray trace is the long band, the peak of each bin;
 *      the Kp trace lets GFZ's figure stand over SWPC's estimate.
 *   6. The seed and the route: the seed answers every flare and storm row,
 *      and the route never remembers an estimate.
 *
 *   node scripts/check-space-weather.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SW = await import('../src/lib/space-weather.ts')
const M = await import('../src/lib/incident-model.ts')
const { SEED, SEED_AS_OF } = await import('../src/data/incident-seed.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b) => Math.abs(a - b) <= Math.abs(b) * 1e-9

/* -------------------------------------------------------------------------- */
console.log('\nflares, three ways')
/* -------------------------------------------------------------------------- */
{
  // Real rows, as each source wrote them.
  const swpc = SW.parseSwpcFlare({ time_tag: '2026-11-12T20:01:00Z', begin_time: '2026-11-12T20:01:00Z', begin_class: 'B6.0', max_time: '2026-11-12T20:12:00Z', max_class: 'C1.7', end_class: 'C1.0', satellite: 18 })
  const hek = SW.parseHekFlare({ ar_noaanum: 10808, event_peaktime: '2005-09-07T17:40:00', fl_goescls: 'X17.' })
  const donki = SW.parseDonkiFlr({ classType: 'M2.3', beginTime: '2026-11-01T09:10Z', peakTime: '2026-11-01T09:21Z', activeRegionNum: 14570 })
  check(swpc && close(swpc.value, 1.7e-6) && swpc.time === Date.UTC(2026, 10, 12, 20, 12), 'SWPC: the class at the peak, timed at the peak')
  check(hek && close(hek.value, 17e-4) && hek.time === Date.UTC(2005, 8, 7, 17, 40) && /region 10808/.test(hek.detail), 'HEK: "X17." is X17, its time is UTC though it does not say so, and its sunspot region is named')
  check(donki && close(donki.value, 2.3e-5) && donki.time === Date.UTC(2026, 10, 1, 9, 21), 'DONKI: the same class and time')
  check(SW.parseSwpcFlare({ max_class: 'pending', max_time: '2026-11-12T20:12:00Z' }) === null && SW.parseHekFlare({ fl_goescls: 'X5' }) === null, 'and a row with no real class or no time is no flare')
}

/* -------------------------------------------------------------------------- */
console.log('\nstorms, from Kp')
/* -------------------------------------------------------------------------- */
{
  check(SW.kpName(4.667) === '5-' && SW.kpName(5) === '5' && SW.kpName(5.333) === '5+' && SW.kpName(8.667) === '9-' && SW.kpName(9) === '9', 'Kp in thirds: 4.667 is 5-, 5.333 is 5+, 8.667 is 9-')
  check(SW.gLevel(4.667) === 0 && SW.gLevel(5) === 1 && SW.gLevel(6.333) === 2 && SW.gLevel(7.667) === 3 && SW.gLevel(8.667) === 4 && SW.gLevel(9) === 5, 'G-levels as NOAA gives them: 5- is no storm, 9- is G4, only 9 is G5')
  const gfz = { datetime: ['2026-01-19T18:00:00Z', '2026-01-19T21:00:00Z', '2026-01-20T00:00:00Z', '2026-01-20T03:00:00Z'], Kp: [7.333, 8.667, 4.667, 5.0], status: ['def', 'def', 'def', 'def'] }
  const st = SW.parseGfz(gfz)
  check(st.length === 3 && st.every((e) => e.kind === 'storm'), 'every three hours at Kp 5 or more is a storm reading, and 5- is not')
  const g4 = M.mostRecentQualifying(st, M.STORM_CATEGORIES[3]), g1 = M.mostRecentQualifying(st, M.STORM_CATEGORIES[0])
  check(g4 && g4.time === Date.UTC(2026, 0, 19, 21) && /G4 storm, Kp 9-/.test(g4.detail), 'the most recent G4 is the 9- at 21:00')
  check(g1 && g1.time === Date.UTC(2026, 0, 20, 3), 'and the most recent G1 is the later Kp 5, not the bigger earlier storm')
  const objs = SW.swpcKpRows([{ time_tag: '2026-11-12T00:00:00', Kp: 1.0, a_running: 4, station_count: 8 }])
  const arrs = SW.swpcKpRows([['time_tag', 'Kp', 'a_running', 'station_count'], ['2026-11-12 03:00:00.000', '1.67', '6', '8']])
  check(objs[0]?.time === Date.UTC(2026, 10, 12, 0) && arrs.length === 1 && arrs[0].time === Date.UTC(2026, 10, 12, 3) && close(arrs[0].kp, 1.67), 'SWPC\'s Kp read in both the shapes it has been published in, its header row skipped')
}

/* -------------------------------------------------------------------------- */
console.log('\nshocks')
/* -------------------------------------------------------------------------- */
{
  const ips = SW.parseDonkiIps({ catalog: 'M2M_CATALOG', activityID: '2024-05-10T16:36:00-IPS-001', location: 'Earth', eventTime: '2024-05-10T16:36Z', instruments: [{ displayName: 'DSCOVR: PLASMAG' }] })
  check(ips && ips.time === Date.UTC(2024, 4, 10, 16, 36) && /by DSCOVR/.test(ips.detail), 'DONKI: the time, and the spacecraft that felt it')
  const msg = 'Space Weather Message Code: SUMSUD\r\nSerial Number: 1234\r\nIssue Time: 2024 May 10 1730 UTC\r\n\r\nSUMMARY: Geomagnetic Sudden Impulse\r\nObserved: 2024 May 10 1705 UTC\r\nDeviation: 47 nT\r\nStation: Boulder'
  const si = SW.parseSuddenImpulse({ product_id: 'SUMSUD', issue_datetime: '2024-05-10 17:30:00.000', message: msg })
  check(si && si.time === Date.UTC(2024, 4, 10, 17, 5) && /47 nT/.test(si.detail), 'SWPC: a sudden impulse, at the minute it was observed, not the minute the summary was issued')
  check(SW.parseSuddenImpulse({ message: 'ALERT: Geomagnetic K-index of 5\r\nThreshold Reached: 2026 Nov 07 1959 UTC' }) === null, 'and any other alert is not a shock')
}

/* -------------------------------------------------------------------------- */
console.log('\nmerging')
/* -------------------------------------------------------------------------- */
{
  const ev = (cls, iso, src = 't') => SW.parseSwpcFlare({ max_class: cls, max_time: iso }) && { ...SW.parseSwpcFlare({ max_class: cls, max_time: iso }), src }
  const old = ev('X9.0', '2024-10-03T12:18:00Z', 'seed'), newer = ev('M1.1', '2026-11-19T13:59:00Z', 'live')
  const l = SW.mergeLatest([old], [], [newer])
  check(l['fl-m'] === newer && l['fl-x'] === old && l['fl-x5'] === old && l['fl-x10'] === null, 'the newer M1.1 answers the M row; the older X9 still answers the X rows; nothing answers X10')
  const again = SW.mergeLatest(SW.latestList(l), [])
  check(JSON.stringify(again) === JSON.stringify(l), 'merging a remembered answer with a source that is down gives the same answer')
  check(Object.keys(l).length === M.FLARE_CATEGORIES.length + M.STORM_CATEGORIES.length + M.SHOCK_CATEGORIES.length, 'and every space-weather row has an answer, if only "none"')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe traces')
/* -------------------------------------------------------------------------- */
{
  const rows = [
    { time_tag: '2026-11-12T19:00:00Z', flux: 1e-6, energy: '0.1-0.8nm' },
    { time_tag: '2026-11-12T19:00:00Z', flux: 9e-4, energy: '0.05-0.4nm' },
    { time_tag: '2026-11-12T19:04:00Z', flux: 3e-6, energy: '0.1-0.8nm' },
    { time_tag: '2026-11-12T19:31:00Z', flux: 2e-6, energy: '0.1-0.8nm' },
  ]
  const x = SW.xrayTrace(rows, 10)
  check(x.t0 === Date.UTC(2026, 10, 12, 19) && x.v.length === 4, 'ten-minute bins from the first reading to the last')
  check(Math.abs(x.v[0] - Math.log10(3e-6)) < 1e-3 && x.v[1] === null && x.v[2] === null && Math.abs(x.v[3] - Math.log10(2e-6)) < 1e-3, 'each bin the peak of the long band (never the short), and a gap left a gap')
  const now = Date.UTC(2026, 10, 20, 0)
  const t = Date.UTC(2026, 10, 19, 18)
  const k = SW.kpTrace([[{ time: t, kp: 5 }], [{ time: t, kp: 4.667 }]], now, 30)
  check(k.v[Math.round((t - k.t0) / k.step)] === 4.667 && k.v.length === 241, 'thirty days of three-hour Kp, the later source (GFZ) standing over the estimate')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe seed and the route')
/* -------------------------------------------------------------------------- */
{
  const ids = new Set()
  for (const c of [...M.FLARE_CATEGORIES, ...M.STORM_CATEGORIES]) if (M.mostRecentQualifying(SEED, c)) ids.add(c.id)
  check(ids.size === M.FLARE_CATEGORIES.length + M.STORM_CATEGORIES.length, `the seed answers every flare and storm row (${ids.size})`)
  check(SEED.every((e) => e.time <= SEED_AS_OF + 864e5 && e.time > Date.UTC(1932, 0, 1) && typeof e.src === 'string'), 'every seeded event is from the records, before the seed was read')
  const g5 = M.mostRecentQualifying(SEED, M.STORM_CATEGORIES[4])
  check(g5 && g5.value >= 9, 'its G5 is a real Kp 9')
  const route = fs.readFileSync(path.join(root, 'src/pages/api/space-weather.ts'), 'utf8')
  check(/const next: Memory = \{ latest: keep,/.test(route) && /'NOAA SWPC, estimated'/.test(route), 'the route shows SWPC\'s estimated Kp but never remembers it')
  check(/s-maxage=600/.test(route), 'and is cached at the edge, so the feeds are asked a few times an hour')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
