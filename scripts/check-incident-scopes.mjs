/**
 * check-incident-scopes — do Days Since Incident's instruments put things
 * where they are?
 *
 *   1. The map: the Pacific is in the middle, longitudes wrap, the coastline
 *      lands exactly where the earthquake dots use for the same place (one
 *      projection, not two that happen to agree), and the frame holds the
 *      latitudes it says.
 *   2. GOES classes: a log flux reads back as NOAA writes it — the letter
 *      for the decade, the number within it, X past 10.
 *   3. Colours: depth and Kp in the page's cool palette, never through
 *      yellow or orange; and a bigger earthquake is always a bigger dot.
 *   4. The feed and the labels: USGS's summary feed parses, oldest first,
 *      junk dropped; place names shorten to the name a reader knows.
 *   5. The page: each bay has its instrument, redrawn on resize, the map's
 *      month read from USGS's own feed.
 *
 *   node scripts/check-incident-scopes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const S = await import('../src/lib/incident-scopes.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t

/* -------------------------------------------------------------------------- */
console.log('\nthe map')
/* -------------------------------------------------------------------------- */
{
  const w = 1000, h = w / S.MAP_ASPECT
  check(near(S.mapXY(0, S.MAP_LON0, w, h)[0], w / 2), 'the middle of the map is the Pacific, at 150°E')
  check(near(S.mapXY(10, -170, w, h)[0], S.mapXY(10, 190, w, h)[0]) && near(S.mapXY(0, -170, w, h)[0], w / 2 + (40 / 360) * w), 'longitudes wrap: 170°W is just east of the middle, as 190°E')
  check(near(S.mapXY(S.MAP_TOP, 0, w, h)[1], 0) && near(S.mapXY(S.MAP_BOTTOM, 0, w, h)[1], h), `the frame runs from ${S.MAP_TOP}°N to ${-S.MAP_BOTTOM}°S`)
  check(near(w / 360, h / (S.MAP_TOP - S.MAP_BOTTOM)), 'and its degrees are square')
  // The coastline path's own coordinates, through the canvas transform, against the dots' projection.
  let worst = 0
  for (const [lat, lon] of [[51.5, -0.1], [-33.9, 151.2], [35.7, 139.7], [-54.8, -68.3], [64.1, -21.9], [1.3, 103.8]]) {
    const X = (lon + 180) / 0.18, Y = (90 - lat) / 0.18
    const [mx, my] = S.mapXY(lat, lon, w, h)
    let best = Infinity
    for (const k of [0, 1]) { const { tx, ty, s } = S.landTransform(w, h, k); best = Math.min(best, Math.hypot(tx + X * s - mx, ty + Y * s - my)) }
    worst = Math.max(worst, best)
  }
  check(worst < 1e-6, `the coast is drawn where the dots say the same places are (worst ${worst.toExponential(1)} px)`)
  const covered = [0, 1].map((k) => S.landTransform(w, h, k).tx)
  check(covered[0] <= 0 && covered[1] <= w && covered[1] + w >= w && covered[0] + w >= covered[1], 'and its two copies cover the whole width with no gap')
}

/* -------------------------------------------------------------------------- */
console.log('\nGOES classes')
/* -------------------------------------------------------------------------- */
{
  const lg = Math.log10
  check(S.goesClass(lg(9.1e-5)) === 'M9.1' && S.goesClass(lg(1e-4)) === 'X1.0' && S.goesClass(lg(2.8e-6)) === 'C2.8', 'M9.1, X1.0 and C2.8 read back as written')
  check(S.goesClass(lg(1.7e-3)) === 'X17.0' && S.goesClass(lg(5e-7)) === 'B5.0' && S.goesClass(lg(3e-9)) === 'A0.3', 'X goes past 10 (X17), and below A it stays an A')
}

/* -------------------------------------------------------------------------- */
console.log('\ncolours and sizes')
/* -------------------------------------------------------------------------- */
{
  const hue = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
    if (!d) return null
    let hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (hh * 60 + 360) % 360
  }
  const all = [...[10, 100, 400].map(S.depthColour), ...[0, 4, 5, 6, 7, 8, 9].map(S.kpColour)]
  const warm = all.filter((c) => { const h = hue(c); return h != null && (h < 140 || h > 330) })
  check(!warm.length, `every depth and storm colour is cool, sea-green through magenta${warm.length ? ' — not ' + warm.join(', ') : ''}`)
  check(new Set([5, 6, 7, 8, 9].map(S.kpColour)).size === 5, 'each G-level has its own colour')
  let grows = true
  for (let m = 4.5; m < 9.5; m += 0.1) if (!(S.quakeRadius(m + 0.1) > S.quakeRadius(m))) grows = false
  check(grows && S.quakeRadius(8.8) < 40, 'a bigger earthquake is always a bigger dot, and an M8.8 still not a continent')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe feed and the names')
/* -------------------------------------------------------------------------- */
{
  const feed = { type: 'FeatureCollection', features: [
    { properties: { mag: 5.1, time: 1795100000000, place: '99 km WSW of Illapel, Chile' }, geometry: { coordinates: [-72.1, -31.9, 35] } },
    { properties: { mag: 4.6, time: 1795000000000, place: 'Tonga' }, geometry: { coordinates: [-174.2, -18.1, 410.2] } },
    { properties: { mag: null, time: 1795050000000, place: 'nowhere' }, geometry: { coordinates: [0, 0, 0] } },
  ] }
  const q = S.parseQuakeFeed(feed)
  check(q.length === 2 && q[0].place === 'Tonga' && q[1].mag === 5.1 && q[0].depth === 410.2 && q[0].lon === -174.2, 'USGS\'s feed: oldest first, longitude first, depth kept, a quake with no magnitude dropped')
  check(S.parseQuakeFeed(null).length === 0 && S.parseQuakeFeed({}).length === 0, 'and a feed that did not come is an empty map, not an error')
  check(S.shortPlace('M 3.3 - 122 km NNE of Punta Cana, Dominican Republic') === 'Punta Cana', '"122 km NNE of Punta Cana, Dominican Republic" is Punta Cana')
  check(S.shortPlace('M 8.8 - 2025 Kamchatka Peninsula, Russia Earthquake') === 'Kamchatka Peninsula', 'a named earthquake loses its year and "Earthquake", and a long name keeps its first part')
  check(S.shortPlace('M 6.0 - Pacific-Antarctic Ridge') === 'Pacific-Antarctic Ridge', 'and an ocean ridge is its own name')
  const ticks = S.dayTicks(Date.UTC(2026, 10, 12, 19), Date.UTC(2026, 10, 19, 19))
  check(ticks.length === 7 && ticks.every((t) => t % 86_400_000 === 0), 'a week has seven UTC midnights')
}

/* -------------------------------------------------------------------------- */
console.log('\nthe page')
/* -------------------------------------------------------------------------- */
{
  const page = fs.readFileSync(path.join(root, 'src/pages/days-since-incident.astro'), 'utf8')
  check(["scope: 'map'", "scope: 'xray'", "scope: 'kp'"].every((s) => page.includes(s)) && /data-scope=\{bay\.scope\}/.test(page), 'three bays, each with its instrument')
  check(page.includes('earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'), 'the map\'s month comes from USGS\'s own summary feed')
  check(/new ResizeObserver\(\(\) => \{ cancelAnimationFrame\(redrawSoon\)/.test(page), 'and every instrument is redrawn when its box changes, at most once a frame')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
