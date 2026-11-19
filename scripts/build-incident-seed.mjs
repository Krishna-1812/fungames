/**
 * build-incident-seed — what Days Since Incident knows before any feed answers.
 *
 * The page's server route (src/pages/api/space-weather.ts) asks the live
 * feeds for recent events and remembers what it has seen. Before it has seen
 * anything, and for the rarest rows (the last X10 flare, the last G5 storm,
 * years back), it starts from this: the most recent event at every flare and
 * storm level, read once from the full records and written to
 * src/data/incident-seed.ts.
 *
 *  - Flares: HEK's copy of NOAA SWPC's GOES flare list (every X-class flare
 *    since 1996, every M-class in the last 400 days, every C in the last 30).
 *  - Storms: GFZ Potsdam's Kp, the whole record since 1932.
 *
 * Nothing is typed in: re-run it and the file is written from the sources.
 *
 *   node scripts/build-incident-seed.mjs [--gfz path/to/saved-kp.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SW = await import('../src/lib/space-weather.ts')

const argv = process.argv.slice(2)
const gfzAt = argv.indexOf('--gfz')
const gfzFile = gfzAt >= 0 ? argv[gfzAt + 1] : null
const now = Date.now()
const iso = (t) => new Date(t).toISOString().slice(0, 19)

async function json(url, ms = 120_000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

const HEK = 'https://www.lmsal.com/hek/her?cosec=2&cmd=search&type=column&event_type=fl&event_coordsys=helioprojective&x1=-5000&x2=5000&y1=-5000&y2=5000' +
  '&param0=FRM_NAME&op0=%3D&value0=SWPC&return=event_peaktime,fl_goescls,ar_noaanum&result_limit=5000'
/** HEK compares classes as text, which orders the letters A < B < C < M < X correctly. */
const hek = (from, above) => json(`${HEK}&event_starttime=${iso(from)}&event_endtime=${iso(now)}&param1=FL_GOESCLS&op1=%3E&value1=${above}`)

console.log('flares, from HEK')
const flareLists = []
for (const [from, above] of [[Date.UTC(1996, 0, 1), 'X'], [now - 400 * 864e5, 'M'], [now - 30 * 864e5, 'C']]) {
  const j = await hek(from, above)
  const ev = (j.result ?? []).map(SW.parseHekFlare).filter(Boolean)
  console.log(`  above ${above} since ${iso(from).slice(0, 10)}: ${ev.length}`)
  flareLists.push(ev)
}

console.log('storms, from GFZ')
const gfz = gfzFile
  ? JSON.parse(fs.readFileSync(gfzFile, 'utf8'))
  : await json(`https://kp.gfz.de/app/json/?start=1932-01-01T00:00:00Z&end=${iso(now)}Z&index=Kp`, 300_000)
const storms = SW.parseGfz(gfz)
console.log(`  ${gfz.Kp.length} readings, ${storms.length} of them at Kp 5 or more`)

const latest = SW.mergeLatest(...flareLists, storms)
const asOf = Math.min(now, Date.parse((gfz.datetime ?? []).at(-1) ?? '') || now)
for (const [id, e] of Object.entries(latest)) console.log(`  ${id.padEnd(7)} ${e ? new Date(e.time).toISOString().slice(0, 16) + '  ' + e.detail : '—'}`)

const body = `/**
 * What Days Since Incident knows before any feed answers: the most recent
 * flare and storm at every level, read from the full records by
 * scripts/build-incident-seed.mjs (HEK's copy of NOAA SWPC's GOES flare list,
 * and GFZ Potsdam's Kp since 1932). Written by that script; not edited by hand.
 */
import type { SourcedEvent } from '../lib/space-weather'

export const SEED_AS_OF = ${asOf}

export const SEED: SourcedEvent[] = ${JSON.stringify(Object.values(latest).filter(Boolean), null, 2)}
`
fs.writeFileSync(path.join(root, 'src/data/incident-seed.ts'), body)
console.log('wrote src/data/incident-seed.ts')
