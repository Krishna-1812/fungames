/**
 * check-who-places — is everybody on Who Was Alive's map where they were?
 *
 * The record gives each person a country ("England", "Germany / USA"); the
 * map needs a point, so lib/who-places.ts gives each one the town they were
 * born in and, if they made their life abroad, where they made it. A sign
 * wrong in a longitude puts Lincoln in the Gobi and the map still looks
 * like a map. So:
 *
 *   1. Everybody in the record has a place, and nobody else does.
 *   2. Each place is on land, by the same coastline the globes here use.
 *   3. Each place is in the country the record says: born in the first one,
 *      and, where it names two, in the second one later (or the other way
 *      round, for somebody born abroad and remembered at home).
 *   4. The view: for every year, on a wide map, everybody alive is in the
 *      frame; on a phone's narrower one, the frame holds as many as any
 *      other frame that wide could; and it never shows past the top or
 *      bottom of the world.
 *
 *   node scripts/check-who-places.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
import sharp from 'sharp'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { PEOPLE, peopleAliveIn, maxYear } = await import('../src/data/historical-figures.ts')
const W = await import('../src/lib/who-places.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/* -------------------------------------------------------------------------- */
console.log('\neverybody has a place')
/* -------------------------------------------------------------------------- */
{
  const names = new Set(PEOPLE.map((p) => p.name))
  const missing = PEOPLE.filter((p) => !W.PLACES[p.name]).map((p) => p.name)
  const extra = Object.keys(W.PLACES).filter((n) => !names.has(n))
  check(!missing.length, `all ${PEOPLE.length} people${missing.length ? ' — not ' + missing.join(', ') : ''}`)
  check(!extra.length, `and no place for anybody not in the record${extra.length ? ': ' + extra.join(', ') : ''}`)
  const bad = Object.entries(W.PLACES).filter(([, w]) => [w.born, w.later].filter(Boolean).some(([la, lo]) => !(la >= -90 && la <= 90 && lo >= -180 && lo <= 180)))
  check(!bad.length, 'every latitude and longitude is one')
  check(Object.values(W.PLACES).every((w) => !!w.later === !!w.laterAt && w.bornAt), 'every place has a name, and every second place too')
}

/* -------------------------------------------------------------------------- */
console.log('\non land')
/* -------------------------------------------------------------------------- */
{
  // The coastline as a distance field: over 0.5 is land (Deep Time's globe, Every Second's map).
  const { data, info } = await sharp(path.join(root, 'public/deep-time/land.webp')).raw().toBuffer({ resolveWithObject: true })
  const field = (la, lo) => {
    const x = Math.min(info.width - 1, Math.floor(((lo + 180) / 360) * info.width))
    const y = Math.min(info.height - 1, Math.floor(((90 - la) / 180) * info.height))
    return data[(y * info.width + x) * info.channels] / 255
  }
  const wet = []
  // Saint Helena is 16 km across, a sixth of one of this map's pixels: it is land, and the map cannot see it.
  const TOO_SMALL = new Set(['Saint Helena'])
  for (const [name, w] of Object.entries(W.PLACES)) {
    for (const [la, lo, what] of [[...w.born, w.bornAt], ...(w.later ? [[...w.later, w.laterAt]] : [])]) {
      if (TOO_SMALL.has(what)) continue
      // A coast town can sit a pixel out to sea on a map this coarse; an inland one cannot.
      if (field(la, lo) < 0.44) wet.push(`${name} (${what}, ${field(la, lo).toFixed(2)})`)
    }
  }
  check(!wet.length, `every birthplace and every later place is on land${wet.length ? ' — not ' + wet.join('; ') : ''}`)
}

/* -------------------------------------------------------------------------- */
console.log('\nin the country the record says')
/* -------------------------------------------------------------------------- */
{
  // Rough boxes, [south, north, west, east]: wide enough for any border of the
  // time, narrow enough that a sign or a digit wrong falls outside.
  const BOX = {
    'China': [18, 54, 73, 135], 'Greece': [34.5, 42, 19, 29], 'Macedon': [39, 42.5, 20, 25], 'Sicily': [36.5, 38.5, 12, 16],
    'Rome': [41, 43, 11, 13.5], 'Egypt': [22, 32, 24.5, 37], 'Persia': [25, 42, 44, 70], 'Francia': [42, 55, -5, 16],
    'Mongolia': [41, 53, 87, 120], 'Venice': [45, 46, 12, 13], 'Italy': [36, 47.5, 6.5, 19], 'England': [49.8, 56, -6.5, 2],
    'France': [41, 51.5, -5, 10], 'Germany': [45.5, 55.5, 5.5, 23], 'Genoa': [44, 45, 8, 10], 'Spain': [35.5, 44, -10, 4.5],
    'Poland': [49, 55, 14, 24.5], 'Ottoman Empire': [30, 46, 18, 46], 'Mughal Empire': [20, 37, 61, 92], 'Netherlands': [50.7, 53.7, 3.2, 7.3],
    'USA': [18, 50, -160, -66], 'Austria': [45.5, 51, 9, 19], 'South America': [-56, 13, -82, -34], 'Russia': [41, 70, 27, 180],
    'Serbia': [42, 47, 13, 23], 'India': [6, 36, 68, 98], 'Mexico': [14, 33, -118, -86], 'South Africa': [-35, -22, 16, 33],
    'Kenya': [-5, 5, 33.5, 42], 'Zanzibar': [-6.6, -4.8, 39, 40], 'Tanzania': [-12, -0.9, 29, 41], 'Pakistan': [23.5, 37.5, 60, 78],
  }
  const inside = (p, b) => p[0] >= b[0] && p[0] <= b[1] && p[1] >= b[2] && p[1] <= b[3]
  const wrong = [], unknown = new Set()
  for (const person of PEOPLE) {
    const w = W.PLACES[person.name]
    if (!w) continue
    const parts = person.place.split(' / ')
    const where = [w.born, w.later].filter(Boolean)
    for (const part of parts) {
      const b = BOX[part]
      if (!b) { unknown.add(part); continue }
      if (!where.some((p) => inside(p, b))) wrong.push(`${person.name} not in ${part}`)
    }
    // Two countries named means two places, one in each.
    if (parts.length === 2 && BOX[parts[0]] && BOX[parts[1]]) {
      const one = where.filter((p) => inside(p, BOX[parts[0]])).length, two = where.filter((p) => inside(p, BOX[parts[1]])).length
      if (!(one && two)) wrong.push(`${person.name} is not in both ${person.place}`)
    }
  }
  check(!unknown.size, `a box for every country the record names${unknown.size ? ' — none for ' + [...unknown].join(', ') : ''}`)
  check(!wrong.length, `everybody is in the country the record says${wrong.length ? ' — ' + wrong.join('; ') : ''}`)
  const moved = Object.values(W.PLACES).filter((w) => w.later)
  check(moved.every((w) => Math.hypot(w.later[0] - w.born[0], w.later[1] - w.born[1]) > 1.5), `the ${moved.length} who moved really went somewhere`)
}

/* -------------------------------------------------------------------------- */
console.log('\nthe view')
/* -------------------------------------------------------------------------- */
{
  const pointsIn = (y) => peopleAliveIn(y).flatMap((p) => { const w = W.PLACES[p.name]; return w ? [w.born, ...(w.later ? [w.later] : [])] : [] })
  const seen = (v, aspect, [la, lo]) => Math.abs(la - v.lat) <= v.span / 2 + 1e-6 && Math.abs(W.nearLon(lo, v.lon) - v.lon) <= (v.span * aspect) / 2 + 1e-6

  let wideMiss = [], tooTall = 0, tooClose = 0, worse = []
  for (let y = -600; y <= maxYear(); y++) {
    const pts = pointsIn(y)
    if (!pts.length) continue
    for (const aspect of [2, 1.25]) {
      const v = W.fitView(pts, aspect, 30)
      if (v.lat + v.span / 2 > W.WORLD.north + 1e-6 || v.lat - v.span / 2 < W.WORLD.south - 1e-6) tooTall++
      if (v.span < 30 - 1e-9) tooClose++
      const n = pts.filter((p) => seen(v, aspect, p)).length
      if (aspect === 2 && n < pts.length) wideMiss.push(y)
      // On the narrow one, nobody could do better by sliding the same frame
      // sideways, keeping the eight degrees the map keeps clear at each edge.
      if (aspect === 1.25) {
        let best = 0
        const inner = (v.span * aspect - 16) / v.span
        for (let lon = -180; lon < 180; lon += 1) best = Math.max(best, pts.filter((p) => seen({ ...v, lon }, inner, p)).length)
        if (n < best) worse.push(`${y}: ${n} of a possible ${best}`)
      }
    }
  }
  check(!wideMiss.length || wideMiss.every((y) => peopleAliveIn(y).some((p) => p.name === 'James Cook')),
    `on a wide map everybody alive is in the frame, every year${wideMiss.length ? ' but those with Cook in the Pacific (' + wideMiss.length + ', counted at the edge)' : ''}`)
  check(!tooTall, 'never past the top or bottom of the world')
  check(!tooClose, 'never closer in than thirty degrees, so one person is not a map of one town')
  check(!worse.length, `on a phone, as many people in the frame as any frame that wide could hold${worse.length ? ' — ' + worse.slice(0, 4).join('; ') : ''}`)

  // The short way round: Hawaii and London share a frame across the Pacific's edge and America, not across Asia.
  const v = W.fitView([[19.5, -155.9], [51.5, -0.1], [40.7, -74]], 2, 30)
  check(v.lon < -40 && v.lon > -120, `Hawaii, New York and London are framed across America (centre ${v.lon.toFixed(0)}°)`)
  const one = W.fitView([[41.9, 12.5]], 2, 30)
  check(Math.abs(one.lon - 12.5) < 1e-6 && one.span === 30, 'one person alone is in the middle, thirty degrees of world round them')

  const [x, y] = W.toScreen({ lon: 170, lat: 0, span: 40 }, 800, 400, 0, -175)
  check(Math.abs(x - (400 + 15 * 10)) < 1e-6 && y === 200, 'a place across the date line is drawn on the near side of it, not a world away')
  const c = Array.from({ length: 12 }, (_, i) => W.crowdOffset(i, 10))
  let close = 0
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]) < 7) close++
  check(c[0][0] === 0 && c[0][1] === 0 && !close, 'a crowd at one place spreads out round it, first on the place, none on top of another')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe page')
/* -------------------------------------------------------------------------- */
{
  const page = fs.readFileSync(path.join(root, 'src/pages/who-was-alive.astro'), 'utf8')
  check(page.includes("from '../lib/who-map'") && page.includes('id="waMap"') && page.includes('new WhoMap('), 'the page draws the map')
  check(page.includes('id="waLives"') && /function paintLives\(y: number\)/.test(page), 'and the lives of the people alive, side by side')
  check(/catch \{ map = null \}/.test(page), 'and goes on without the map if it cannot draw one')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
