#!/usr/bin/env node
/**
 * check-walk — the island on foot (/walk/, src/lib/walk): built from the
 * same model the page serves (pages/walk/world.json.ts), and checked for
 * what would break a walk round it:
 *
 *   - it builds, and no vertex anywhere is NaN (a NaN hides a whole mesh);
 *   - you start on land, on a road;
 *   - the ground has no cracks: wherever two tiles run into one another as
 *     a slope, both come to the same height all along the edge between them,
 *     and wherever they do not, a wall stands; the beaches run down under the
 *     sea, and the surface you walk on is the one drawn (terrain.ts);
 *   - every game's building can be got to from the start — walked, climbed
 *     or swum, by the walker's own rules — close enough for its play prompt;
 *   - the walls you collide with are real boxes, and there are lamps to
 *     light the streets at night.
 *
 *   node scripts/check-walk.mjs
 */
const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { buildWorld, Y } = await import('../src/lib/walk/build3d.ts')

let failures = 0
const ok = (m) => console.log(`  ok    ${m}`)
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const check = (c, m) => (c ? ok(m) : fail(m))

const games = listedGames()
const m = buildIsland(games.map((g) => ({ slug: g.slug, title: g.title, blurb: g.blurb, href: `/${g.slug}/` }))).model
// As world.json.ts serves it.
const data = {
  grid: m.grid, sea: m.sea, beachZ: m.beachZ, ground: m.ground, height: m.height, district: m.district,
  river: m.river, pond: m.pond, road: m.road, piers: m.piers, fields: m.fields,
  buildings: m.buildings, solids: m.solids, plants: m.plants.map((p) => [p.name, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(1), +p.k.toFixed(2)]),
  seaRocks: m.seaRocks, isles: m.isles, games: Object.fromEntries(games.map((g) => [g.slug, { title: g.title, href: `/${g.slug}/` }])),
}
const json = JSON.stringify(data)
check(json.length < 3_000_000, `the world the page fetches is ${(json.length / 1024).toFixed(0)} KB (under 3 MB)`)

const world = buildWorld(JSON.parse(json))
let verts = 0, nan = 0
world.root.traverse((o) => {
  const p = o.geometry?.getAttribute?.('position'); if (!p) return
  verts += p.count
  for (const v of p.array) if (!Number.isFinite(v)) { nan++; break }
})
check(verts > 50_000 && nan === 0, `it builds: ${verts.toLocaleString()} vertices, none of them NaN`)

const start = data.road[Math.floor(data.road.length / 2)]
check(start && world.kind(start[0], start[1]) === '1', `you start on land, on a road (${start})`)

// The ground: joined edges meet exactly; the walls are where they are not.
{
  let seams = 0, worst = 0, walls = 0
  const N = data.grid, e = 1e-5
  for (let i = -6; i < N + 6; i++) for (let j = -6; j < N + 6; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
    const i2 = i + di, j2 = j + dj
    for (let s = 0.02; s < 1; s += 0.08) {
      // A point on the edge, from either side.
      const [x, z] = di ? [j + s, i2] : [j2, i + s]
      const a = di ? world.heightAt(x, z - e) : world.heightAt(x - e, z), b = di ? world.heightAt(x, z + e) : world.heightAt(x + e, z)
      if (world.joined(i, j, i2, j2)) { seams++; worst = Math.max(worst, Math.abs(a - b)) } else if (Math.abs(a - b) > 0.01) walls++
    }
  }
  check(worst < 0.002, `the ground has no cracks: ${seams.toLocaleString()} points on joined edges, the worst ${worst.toFixed(5)} apart`)
  check(walls > 400, `and walls where tiles do not join (${walls.toLocaleString()} points on them)`)
  const seaY = Y(data.sea)
  let shelving = 0, beaches = 0
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (world.kind(i, j) !== 'b' || ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => world.kind(i + a, j + b) === '0')) continue
    beaches++
    let lo = Infinity, hi = -Infinity
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) { const h = world.heightAt(j + b / 10, i + a / 10); lo = Math.min(lo, h); hi = Math.max(hi, h) }
    if (lo < seaY && hi > seaY) shelving++
  }
  check(beaches > 10 && shelving === beaches, `every beach on the sea runs down under it (${shelving} of ${beaches})`)
  let flat = 0, total = 0
  for (const [i, j] of data.road) { total++; const h = [0.2, 0.5, 0.8].flatMap((a) => [0.2, 0.5, 0.8].map((b) => world.heightAt(j + b, i + a))); if (Math.max(...h) - Math.min(...h) < 0.002) flat++ }
  check(flat === total, `the streets are level, as the traffic drives them (${flat} of ${total})`)
}

// Walked, climbed and swum out from the start, as walker.ts lets you (its
// numbers): a flood over the island a fifth of a tile at a time.
const STEP = 0.14, CLIMB = 0.36, CLIMB_WET = 0.62, TALL = 0.5, RADIUS = 0.11, REACH = 0.45, seaY = Y(data.sea)
const H = 0.2, M = 4, N = Math.round((data.grid + 2 * M) / H)
const level = new Float32Array(N * N).fill(NaN)
const at = (x, z) => {
  const g = world.heightAt(x, z)
  return g < seaY - 0.32 ? { y: seaY - 0.36, wet: true } : { y: g, wet: false }
}
const reachable = (x, z, from, wet) => {
  const here = at(x, z), reach = wet ? CLIMB_WET : CLIMB
  let y = here.y
  for (const b of world.boxes) if (x > b.j0 && x < b.j1 && z > b.i0 && z < b.i1 && b.z1 <= from + reach && b.z1 > y) y = b.z1
  if (y > from + reach) return null
  for (const b of world.boxes) if (b.z1 > Math.max(y, from) + STEP && b.z0 < y + TALL && x > b.j0 - RADIUS && x < b.j1 + RADIUS && z > b.i0 - RADIUS && z < b.i1 + RADIUS) return null
  return { y, wet: y < seaY }
}
const wetAt = new Uint8Array(N * N)
const toCell = (x, z) => Math.floor((z + M) / H) * N + Math.floor((x + M) / H)
const sx = start[1] + 0.5, sz = start[0] + 0.5, s0 = toCell(sx, sz)
level[s0] = at(sx, sz).y
const queue = [s0]
while (queue.length) {
  const c = queue.pop(), ci = Math.floor(c / N), cj = c % N
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = ci + di, nj = cj + dj
    if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
    const n2 = ni * N + nj
    if (!Number.isNaN(level[n2])) continue
    const r = reachable((nj + 0.5) * H - M, (ni + 0.5) * H - M, level[c], wetAt[c] === 1)
    if (!r) continue
    level[n2] = r.y; wetAt[n2] = r.wet ? 1 : 0; queue.push(n2)
  }
}
const unreachable = []
let placed = 0
for (const slug of Object.keys(data.games)) {
  const b = data.buildings.find((q) => q.slug === slug)
  if (!b) continue
  placed++
  // Anywhere reached within the play prompt's reach of its footprint.
  let found = false
  for (let z = b.i - REACH; z <= b.i + b.w + REACH && !found; z += H / 2) for (let x = b.j - REACH; x <= b.j + b.d + REACH && !found; x += H / 2) {
    const dx = x - Math.max(b.j, Math.min(b.j + b.d, x)), dz = z - Math.max(b.i, Math.min(b.i + b.w, z))
    if (Math.hypot(dx, dz) < REACH - 0.05 && !Number.isNaN(level[toCell(x, z)])) found = true
  }
  if (!found) unreachable.push(slug)
}
check(placed >= Object.keys(data.games).length - 2, `the games have their buildings (${placed} of ${Object.keys(data.games).length})`)
check(unreachable.length === 0, `every game's building can be walked (or climbed, or swum) up to from the start${unreachable.length ? ` — not: ${unreachable.join(', ')}` : ''}`)

const badBox = world.boxes.filter((b) => !(b.i1 > b.i0 && b.j1 > b.j0 && b.z1 > b.z0) || ![b.i0, b.i1, b.j0, b.j1, b.z0, b.z1].every(Number.isFinite))
check(world.boxes.length > 100 && badBox.length === 0, `${world.boxes.length} walls to collide with, all real boxes`)
check(world.lamps.length >= 12, `${world.lamps.length} street lamps to light the night`)

console.log(failures ? `\n${failures} check(s) failed.` : '\nThe walk checks out.')
process.exit(failures ? 1 : 0)
