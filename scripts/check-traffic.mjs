#!/usr/bin/env node
/**
 * check-traffic — the island's live traffic (src/lib/island/traffic.ts),
 * driven on the island's own roads for three minutes of its time, and
 * checked for what would show on the map as a bug:
 *
 *   - every car stays on a road (its cell, give or take its lane, is road);
 *   - no two cars in the same lane ever drive through each other;
 *   - the traffic never locks: every car gets somewhere in every minute;
 *   - nothing goes faster than its kind likes, or backwards, or NaN.
 *
 *   node scripts/check-traffic.mjs
 */
const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { createTraffic } = await import('../src/lib/island/traffic.ts')

let failures = 0
const ok = (m) => console.log(`  ok    ${m}`)
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const check = (c, m) => (c ? ok(m) : fail(m))

const games = listedGames()
const island = buildIsland(games.map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` })))
const roads = island.play.roads ?? []
check(roads.length > 40, `the island hands the traffic its roads (${roads.length} cells)`)
const road = new Set(roads.map(([i, j]) => `${i},${j}`))

const traffic = createTraffic({ roads, play: true, dark: () => 0 })
const n = traffic.cars()
check(n >= 6, `there is traffic to drive (${n} vehicles)`)

const DT = 1 / 30, STEPS = 30 * 180
let off = 0, overlap = 0, bad = 0
const travelled = new Array(n).fill(0)
let prev = null, stuckMinutes = 0
const perMinute = new Array(n).fill(0)
for (let s = 0; s < STEPS; s++) {
  traffic.step(DT)
  const snap = traffic.state()
  if (prev) snap.forEach((c, k) => { const d = Math.hypot(c.i - prev[k].i, c.j - prev[k].j); travelled[k] += d; perMinute[k] += d; if (d > 0.2) bad++ })
  for (const c of snap) {
    if (!Number.isFinite(c.i) || !Number.isFinite(c.j) || c.v < 0 || c.v > 1.7) bad++
    if (!road.has(`${Math.floor(c.i)},${Math.floor(c.j)}`) && !road.has(`${Math.floor(c.i - c.hi * 0.3)},${Math.floor(c.j - c.hj * 0.3)}`)) off++
  }
  for (let a = 0; a < snap.length; a++) for (let b = a + 1; b < snap.length; b++) {
    const A = snap[a], B = snap[b], di = B.i - A.i, dj = B.j - A.j
    const along = Math.abs(di * A.hi + dj * A.hj), lat = Math.abs(di * A.hj - dj * A.hi)
    if (A.hi * B.hi + A.hj * B.hj > 0.7 && lat < 0.12 && along < 0.22) overlap++
  }
  if ((s + 1) % (30 * 60) === 0) { if (perMinute.some((d) => d < 1)) stuckMinutes++; perMinute.fill(0) }
  prev = snap
}
check(bad === 0, `nothing jumps, runs backwards, speeds or goes NaN (${bad})`)
check(off < STEPS * n * 0.002, `the cars keep to the roads (${off} of ${STEPS * n} moments off one)`)
check(overlap < 30, `no two cars in a lane drive through each other (${overlap} moments touching)`)
check(stuckMinutes === 0, `the traffic never locks: every car gets somewhere every minute (${stuckMinutes} minutes with one stuck)`)
const avg = travelled.reduce((a, b) => a + b, 0) / n / 180
check(avg > 0.35 && avg < 1.6, `it moves at a town's pace (${avg.toFixed(2)} tiles a second on average)`)

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exit(failures ? 1 : 0)
