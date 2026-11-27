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
 *   - the water: the stream runs downhill all the way and pours off the land
 *     into the sea; the sea's swell (the one you bob on) dies away to
 *     nothing at the water's edge, so the coast never moves, yet out in
 *     open water it truly lifts;
 *   - the day: the sun comes up in the east before six, crosses the south
 *     high at noon and goes down in the west after six; the windows go out
 *     after midnight;
 *   - the buildings up close: every window has a room behind it, flat roofs
 *     have a parapet and what stands on roofs, the lighthouse stands, the
 *     boards and posters carry their pictures, and every game on land has
 *     its name over its door or at the front of its plot;
 *   - what grows: every tree the map plants is grown, with leaves, and its
 *     trunk is solid; grass grows on the lawns — thousands of tufts — and
 *     never on a street or inside anything built;
 *   - every game's building can be got to from the start — walked, climbed
 *     or swum, by the walker's own rules — close enough for its play prompt;
 *   - the walls you collide with are real boxes, and there are lamps to
 *     light the streets at night;
 *   - the cars (cars.ts, drive.ts): each model built to its real size;
 *     driven on the flat, a car pulls away, tops out, stops, turns and hits a
 *     wall as a real one does (0–50 km/h, its top speed, the distance it
 *     stops in from 50, its turning circle; it never goes into the wall);
 *     deep water floods its engine; cars of your own are parked level and
 *     clear beside a road, facing the way its traffic goes; and the traffic
 *     stops short of whatever stands in its lane.
 *
 *   node scripts/check-walk.mjs
 */
const { register } = await import('node:module')
register('./resolve-ts.mjs', import.meta.url)
const { listedGames } = await import('../src/data/games.ts')
const { buildIsland } = await import('../src/lib/island/world.ts')
const { buildWorld, Y } = await import('../src/lib/walk/build3d.ts')
const { waveAt, WAVES } = await import('../src/lib/walk/water.ts')
const { sunPlace, homesLit } = await import('../src/lib/walk/daylight.ts')
const { carShapes, MODELS, parkingSpots } = await import('../src/lib/walk/cars.ts')
const { vehicle } = await import('../src/lib/walk/drive.ts')
const { createTraffic } = await import('../src/lib/island/traffic.ts')
const { folk } = await import('../src/lib/walk/folk.ts')
const { gulls } = await import('../src/lib/walk/birds.ts')
const { fishes } = await import('../src/lib/walk/fish.ts')
const { boats } = await import('../src/lib/walk/boats.ts')
const { weather } = await import('../src/lib/walk/weather.ts')
const { wetness } = await import('../src/lib/walk/wet.ts')
const { toys } = await import('../src/lib/walk/props.ts')
const { street, lightAt } = await import('../src/lib/walk/street.ts')

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
  seaRocks: m.seaRocks, isles: m.isles, games: Object.fromEntries(games.map((g) => [g.slug, { title: g.title, href: `/${g.slug}/` }])), prints: m.prints,
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

// The water.
{
  const seaY = Y(data.sea), N = data.grid
  let runs = 0, downhill = 0, intoSea = 0
  for (const [i, j] of data.river) {
    const dir = world.flowAt(j + 0.5, i + 0.5)
    if (!dir) continue
    runs++
    const i2 = i + dir[1], j2 = j + dir[0], here = world.poolAt(j + 0.5, i + 0.5), there = world.poolAt(j2 + 0.5, i2 + 0.5)
    if (there !== null ? there <= here + 1e-6 : world.kind(i2, j2) === '0') downhill++
    if (world.kind(i2, j2) === '0') intoSea++
  }
  check(runs >= 6 && downhill === runs, `the stream runs downhill all the way (${downhill} of ${runs} stretches)`)
  check(intoSea >= 1 && world.falls.length >= 1, `and pours off the land into the sea (${world.falls.length} fall)`)
  let edge = 0, still = 0, lift = 0
  for (let x = -6; x < N + 6; x += 0.13) for (let z = -6; z < N + 6; z += 0.17) {
    const dp = world.depthAt(x, z)
    if (dp > 0 && dp < 0.04) { edge++; let w = 0; for (let t = 0; t < 12; t += 0.7) w = Math.max(w, Math.abs(waveAt(x, z, t, dp))); if (w < 0.001) still++ }
    if (dp > 0.8) for (let t = 0; t < 12; t += 1.3) lift = Math.max(lift, waveAt(x, z, t, dp))
  }
  check(edge > 500 && still === edge, `the swell dies away at the water's edge (${still} of ${edge} points there stay still)`)
  check(lift > 0.05, `and lifts the open sea (${(lift * 3.5).toFixed(2)} m at most)`)
}

// The day.
{
  let rise = null, set = null
  for (let h = 0; h < 24; h += 0.01) { const a = sunPlace(h).el, b = sunPlace(h + 0.01).el; if (a < 0 && b >= 0) rise = h; if (a >= 0 && b < 0) set = h }
  const hm = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
  const noon = sunPlace(12), up = sunPlace(rise + 0.02), down = sunPlace(set)
  check(rise > 5 && rise < 6 && up.az > 60 && up.az < 120, `the sun comes up in the east at ${hm(rise)} (bearing ${up.az.toFixed(0)}°)`)
  check(noon.el > 60 && Math.abs(noon.az - 180) < 1, `stands ${noon.el.toFixed(0)}° up in the south at noon`)
  check(set > 18 && set < 19 && down.az > 240 && down.az < 300, `and goes down in the west at ${hm(set)} (bearing ${down.az.toFixed(0)}°)`)
  check(homesLit(20) === 1 && homesLit(3) < 0.4 && homesLit(5.5) > homesLit(3), `every home's window lit at eight, ${Math.round(homesLit(3) * 100)}% at three in the morning, more by half past five`)
}

// Walked, climbed and swum out from the start, as walker.ts lets you (its
// numbers): a flood over the island a fifth of a tile at a time.
const METRE = 0.11, STEP = 0.35 * METRE, CLIMB = 3 * METRE, CLIMB_WET = 3.6 * METRE, TALL = 1.75 * METRE, RADIUS = 0.25 * METRE, CHEST = 1.3 * METRE, AFLOAT = 1.05 * METRE, REACH = 0.45, seaY = Y(data.sea)
const H = 0.2, M = 4, N = Math.round((data.grid + 2 * M) / H)
const level = new Float32Array(N * N).fill(NaN)
const at = (x, z) => {
  const g = world.heightAt(x, z)
  return g < seaY - CHEST ? { y: seaY - AFLOAT, wet: true } : { y: g, wet: false }
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

{
  const mk = world.made, wins = data.solids.flatMap((r) => r.runs.flat()).filter((q) => q.k === 'win').reduce((t, q) => t + (q.rows ?? 1) * (q.cols ?? 2), 0)
  check(mk.rooms === wins && wins > 100, `every window has a room behind it (${mk.rooms} of ${wins})`)
  check(mk.roofs.length >= 8 && mk.onRoofs >= mk.roofs.length, `${mk.roofs.length} flat roofs with parapets, ${mk.onRoofs} things standing on them`)
  check(mk.lighthouse, 'the lighthouse stands')
  const want = data.solids.flatMap((r) => r.runs.flat()).filter((q) => q.k === 'model' && (q.name === 'plaque' || q.name === 'decal') && (q.prints ?? []).length).length
  check(mk.pictures === want && want > 10, `the boards and posters carry their pictures (${mk.pictures} of ${want})`)
  const onLand = data.buildings.filter((b) => data.games[b.slug] && !b.water).map((b) => b.slug)
  const missing = onLand.filter((sl) => !mk.signed.includes(sl))
  check(missing.length === 0, `every game on land has its name up (${onLand.length - missing.length} of ${onLand.length})${missing.length ? ' — not: ' + missing.join(', ') : ''}`)
}

{
  const fl = world.flora, trees = data.plants.filter(([n]) => /^(round|blossom|pine|snowpine|palm|cypress)/.test(n)).length
  check(fl.grown.leaves > trees * 30 && fl.solids.length >= trees, `${trees} trees grown, ${fl.grown.leaves.toLocaleString()} leaf sprays among them, ${fl.solids.length} trunks and rocks solid`)
  const feet = fl.lawn.feet(), road = new Set(data.road.map(([i, j]) => i + ',' + j))
  const onRoad = feet.filter(([x, z]) => road.has(Math.floor(z) + ',' + Math.floor(x))).length
  const growing = new Set(fl.solids)
  const inside = feet.filter(([x, z]) => world.boxes.some((b) => !growing.has(b) && b.z1 - b.z0 > 0.15 && x > b.j0 + 0.01 && x < b.j1 - 0.01 && z > b.i0 + 0.01 && z < b.i1 - 0.01 && Math.abs(b.z0 - world.heightAt(x, z)) < 0.1 && b.z0 > -0.5 && b.j1 - b.j0 > 0.1)).length
  check(feet.length > 10000 && onRoad === 0 && inside === 0, `${feet.length.toLocaleString()} tufts of grass, none on a street (${onRoad}) or inside a building (${inside})`)
}

const badBox = world.boxes.filter((b) => !(b.i1 > b.i0 && b.j1 > b.j0 && b.z1 > b.z0) || ![b.i0, b.i1, b.j0, b.j1, b.z0, b.z1].every(Number.isFinite))
check(world.boxes.length > 100 && badBox.length === 0, `${world.boxes.length} walls to collide with, all real boxes`)
check(world.lamps.length >= 12, `${world.lamps.length} street lamps to light the night`)

// The cars.
{
  const wrong = []
  for (const name of Object.keys(MODELS)) {
    const S = MODELS[name], sh = carShapes(name)
    let nan = 0
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
    for (const g of Object.values(sh)) { const a = g.getAttribute('position').array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) nan++ }
    const a = sh.paint.getAttribute('position').array
    for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[i + k] / METRE); hi[k] = Math.max(hi[k], a[i + k] / METRE) }
    const len = hi[0] - lo[0], tall = hi[1], wid = 2 * Math.max(...(() => { const w = []; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] / METRE) < S.len * 0.3 && a[i + 1] / METRE < S.tall * 0.6) w.push(Math.abs(a[i + 2] / METRE)); return w })())
    if (nan || Math.abs(len - S.len) > 0.03 * S.len || Math.abs(tall - S.tall) > 0.04 * S.tall || Math.abs(wid - S.wid) > 0.03 * S.wid) wrong.push(`${name} ${len.toFixed(2)}×${wid.toFixed(2)}×${tall.toFixed(2)} m${nan ? ' NaN' : ''}`)
  }
  check(!wrong.length, `the hatchback, saloon, SUV and bus are built to their real size (${Object.values(MODELS).map((S) => S.len + ' m').join(', ')} long)${wrong.length ? ' — not: ' + wrong.join('; ') : ''}`)

  const spec = MODELS.hatch.spec, flat = { heightAt: () => 0, boxes: [], waterAt: () => null, others: () => [], grid: 1e4 }
  const dt = 1 / 60
  let v = vehicle(spec, 500, 500, 0); v.place(500, 500, 0, flat)
  let t = 0, t50 = null
  while (t < 40) { v.step(dt, { throttle: 1, steer: 0, handbrake: false }, flat); t += dt; if (t50 === null && v.s.u >= 50 / 3.6) t50 = t }
  const top = v.s.u * 3.6
  v = vehicle(spec, 500, 500, 0); v.place(500, 500, 0, flat); v.s.u = 50 / 3.6
  let x0 = v.s.x
  for (let k = 0; k < 600 && v.s.u > 0.01; k++) v.step(dt, { throttle: -1, steer: 0, handbrake: false }, flat)
  const stop = (v.s.x - x0) / METRE
  v = vehicle(spec, 500, 500, 0); v.place(500, 500, 0, flat)
  const box = [1e9, -1e9]
  for (let k = 0; k < 60 * 30; k++) { v.step(dt, { throttle: v.s.u < 3 ? 0.35 : 0, steer: -1, handbrake: false }, flat); if (k > 300) { box[0] = Math.min(box[0], v.s.x); box[1] = Math.max(box[1], v.s.x) } }
  const circle = (box[1] - box[0]) / METRE + spec.wid
  check(t50 > 3 && t50 < 6.5 && top > spec.top * 3.6 - 3 && top < spec.top * 3.6 + 1 && stop > 10 && stop < 16 && circle > 9 && circle < 12.5,
    `driven on the flat, a hatchback does 0–50 km/h in ${t50?.toFixed(1)} s, tops out at ${top.toFixed(0)} km/h, stops from 50 in ${stop.toFixed(1)} m and turns in a ${circle.toFixed(1)} m circle`)

  const wallAt = 500 + 20 * METRE, wall = { ...flat, boxes: [{ j0: wallAt, j1: wallAt + 5 * METRE, i0: 490, i1: 510, z0: 0, z1: 1 }] }
  v = vehicle(spec, 500, 500, 0); v.place(500, 500, 0, wall); v.s.u = 15
  let into = 0
  for (let k = 0; k < 180; k++) { v.step(dt, { throttle: 1, steer: 0, handbrake: false }, wall); into = Math.max(into, v.s.x + (spec.len / 2) * METRE - wallAt) }
  check(into / METRE < 0.01 && v.s.u < 1.5, `driven into a wall at 54 km/h it stops there (${Math.max(0, into / METRE * 100).toFixed(1)} cm into it at most)`)

  const sea = { ...flat, heightAt: (x) => -Math.max(0, (x - 500) * 0.08), waterAt: (x, z, g) => (g < 0 ? 0 : null) }
  v = vehicle(spec, 500, 500, 0); v.place(500, 500, 0, sea)
  let drowned = null
  for (let k = 0; k < 60 * 20; k++) { v.step(dt, { throttle: 1, steer: 0, handbrake: false }, sea); if (drowned === null && v.s.flooded) drowned = v.s.depth }
  check(drowned !== null && drowned < 0.8 && Math.abs(v.s.u) < 0.3, `driven down a slipway into the sea, the engine floods ${drowned?.toFixed(2)} m deep and the car comes to a stop`)

  const start = data.road[Math.floor(data.road.length / 2)]
  const spots = parkingSpots(world, data.road, { x: start[1] + 0.5, z: start[0] + 0.5 }, 3)
  const bad = spots.filter((sp) => {
    const [ri, rj] = sp.road, rx = rj + 0.5, rz = ri + 0.5
    // The road is on its left: facing the way that side's traffic goes.
    const rightX = Math.sin(sp.yaw), rightZ = Math.cos(sp.yaw)
    if ((sp.x - rx) * rightX + (sp.z - rz) * rightZ < 0.1) return true
    const c = Math.cos(sp.yaw), n = Math.sin(sp.yaw), L = 2.4 * METRE, W = 1.0 * METRE
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]]) {
      const px = sp.x + a * L * c + b * W * n, pz = sp.z - a * L * n + b * W * c
      if (Math.abs(world.heightAt(px, pz) - world.heightAt(rx, rz)) > 0.01) return true
      if (world.boxes.some((B) => B.z1 > world.heightAt(px, pz) + 0.01 && px > B.j0 && px < B.j1 && pz > B.i0 && pz < B.i1)) return true
    }
    return false
  })
  check(spots.length === 3 && !bad.length, `${spots.length} cars of your own parked level and clear beside a road, facing its traffic${bad.length ? ' — not ' + bad.length : ''}`)

  // Something standing in a lane: the car coming up to it stops short.
  const tr = createTraffic({ roads: data.road, play: true, dark: () => 0, others: () => obs })
  const c0 = tr.state()[0], obs = [{ i: c0.i + c0.hi * 0.7, j: c0.j + c0.hj * 0.7, r: 0.03, w: 0.03 }]
  let closest = 9
  for (let k = 0; k < 30 * 12; k++) { tr.step(1 / 30); const c = tr.state()[0]; closest = Math.min(closest, Math.hypot(c.i - obs[0].i, c.j - obs[0].j)) }
  check(closest > 0.22, `the traffic stops short of someone standing in its lane (${(closest / METRE).toFixed(1)} m away at the closest)`)
}

// Life: people on the pavements, gulls, fish, boats.
{
  const { Scene, Vector3 } = await import('three')
  const scene = new Scene()
  const key = (i, j) => i * 1000 + j
  const roads = new Set(data.road.map(([i, j]) => key(i, j)))
  const linkN = (i, j) => [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => roads.has(key(i + a, j + b))).length
  // People: a minute and a half of them walking about the island, the traffic driving round them.
  const people = folk(scene, { roads: data.road, heightAt: world.heightAt, boxes: world.boxes, count: 40 })
  const tr = createTraffic({ roads: data.road, play: true, dark: () => 0, others: () => people.crossing() })
  const cam = new Vector3(15, 1, 15)
  let inLane = 0, inside = 0, hit = 0, samples = 0, moved = 0, crossings = 0
  const before = people.state().map((p) => [p.x, p.z])
  for (let k = 0; k < 30 * 90; k++) {
    tr.step(1 / 30)
    const cars = tr.state().map((c) => ({ x: c.j, z: c.i, hx: c.hj, hz: c.hi, v: c.v, hl: 0.25, hw: 0.1, yaw: Math.atan2(-c.hi, c.hj) }))
    // (Drawn from wherever they are: the camera goes with the first of them.)
    const p0 = people.state()[0]; cam.set(p0.x, 1, p0.z)
    people.update(1 / 30, { cam, you: null, cars, day: 1 })
    if (k % 15) continue
    for (const p of people.state()) {
      if (p.mode === 'talk') continue
      samples++
      const i = Math.floor(p.z), j = Math.floor(p.x), fx = p.x - j - 0.5, fz = p.z - i - 0.5
      // Off the pavement, and in a lane (not on a junction's crossing, nor along the gutter past something built over the pavement).
      if (!p.onFoot && linkN(i, j) < 3 && Math.max(Math.abs(fx), Math.abs(fz)) < 0.27) inLane++
      if (!p.onFoot) crossings++
      if (world.boxes.some((b) => b.z1 > p.y + 0.05 && b.z0 < p.y + 0.15 && p.x > b.j0 + 0.005 && p.x < b.j1 - 0.005 && p.z > b.i0 + 0.005 && p.z < b.i1 - 0.005)) inside++
      for (const c of cars) { const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw); if (Math.abs(dx * cs - dz * sn) < 0.22 && Math.abs(dx * sn + dz * cs) < 0.09) hit++ }
    }
  }
  people.state().forEach((p, n) => { if (before[n] && Math.hypot(p.x - before[n][0], p.z - before[n][1]) > 1) moved++ })
  const walkers = people.state().filter((p) => p.mode !== 'talk').length
  check(walkers >= 36 && moved > walkers * 0.7, `${walkers} people walk the pavements (${moved} of them got more than a tile in 90 s), and a few more stand talking`)
  check(inLane === 0 && crossings > 0, `they keep to the pavements, crossing at the junctions (${crossings} of ${samples} looks were mid-crossing, ${inLane} in a lane)`)
  check(inside <= samples * 0.002, `they step round lamp posts and bins (inside something ${inside} of ${samples} times)`)
  check(hit === 0, `the traffic never runs into anyone (${hit} times)`)
  people.dispose()

  // Gulls: those standing, on something; those flying, clear of everything; one standing takes off when you walk up.
  const flock = gulls(scene, { seaY, grid: data.grid, heightAt: world.heightAt, seaAt: world.seaAt, depthAt: world.depthAt, kind: world.kind, boxes: world.boxes, lamps: world.lamps, piers: data.piers, rocks: data.seaRocks, rings: [[24, 23], [13, 4], [3, 23]], count: 18 })
  const you = { x: -99, y: 0, z: -99 }
  let low = 0, flown = 0
  for (let k = 0; k < 30 * 120; k++) {
    flock.update(1 / 30, { cam, you, driving: false, day: 1, time: k / 30, still: false })
    if (k % 30 === 0) for (const g of flock.state()) if (g.mode === 'soar') { flown++; if (g.y < world.heightAt(g.x, g.z) + 0.6) low++ }
  }
  const st = flock.state(), standing = st.filter((g) => g.mode === 'stand')
  check(flock.perches() >= 18 && standing.length > 0 && st.some((g) => g.mode === 'soar'), `the gulls: ${flock.perches()} places to stand (rocks, piers, lamps, sand, water), ${standing.length} standing, ${st.length - standing.length} in the air`)
  check(low === 0, `those circling stay well up (${low} of ${flown} looks under 5 m over the ground)`)
  const g0 = standing.find((g) => !g.water)
  if (g0) {
    you.x = g0.x + 0.2; you.y = g0.y; you.z = g0.z
    for (let k = 0; k < 15; k++) flock.update(1 / 30, { cam, you, driving: false, day: 1, time: 200 + k / 30, still: false })
    const after = flock.state().find((g) => Math.abs(g.x - g0.x) < 0.3 && Math.abs(g.z - g0.z) < 0.3)
    check(after && after.mode !== 'stand', `walk up to a gull and it takes off (${after?.mode})`)
  }
  flock.dispose()

  // Fish: schools where the water is clear and shallow enough to see them; they scatter from a swimmer.
  const fsh = fishes(scene, { seaY, grid: data.grid, depthAt: world.depthAt, seaAt: world.seaAt, splash: () => {}, ring: () => {}, schools: 8 })
  for (let k = 0; k < 30 * 60; k++) fsh.update(1 / 30, { cam, you: { x: -99, y: 0, z: -99 }, inWater: false, time: k / 30 })
  const sc = fsh.state().schools
  check(sc.length >= 6 && sc.every((s) => s.depth > 0.04 && s.depth < 0.4), `${sc.length} schools (${fsh.state().fish} fish) keep to clear water 0.4–3.6 m deep after a minute (${sc.map((s) => (s.depth / METRE).toFixed(1)).join(', ')} m)`)
  const s0 = sc[0], swimmer = { x: s0.x + 0.1, y: seaY, z: s0.z }
  for (let k = 0; k < 45; k++) fsh.update(1 / 30, { cam, you: swimmer, inWater: true, time: 100 + k / 30 })
  const s1 = fsh.state().schools[0]
  check(Math.hypot(s1.x - swimmer.x, s1.z - swimmer.z) > 0.2 && s1.scared, `swim up to a school and it darts away (${(Math.hypot(s1.x - swimmer.x, s1.z - swimmer.z) / METRE).toFixed(1)} m off after 1.5 s)`)
  fsh.dispose()

  // Boats: afloat, in the sea (never over land), the ferry alongside the harbour pier on its timetable.
  const port = boats(scene, { seaAt: world.seaAt, piers: data.piers, wind: [WAVES[0].x, WAVES[0].z], splash: () => {} })
  let aground = [], afloat = 0, looks = 0, nanB = 0
  scene.traverse((o) => { const p = o.geometry?.getAttribute?.('position'); if (p) for (const v of p.array) if (!Number.isFinite(v)) { nanB++; break } })
  for (let k = 0; k <= 30 * 130; k++) {
    port.update(1 / 30, { time: k / 30, glow: 0, cam })
    if (k % 90) continue
    for (const b of port.state()) {
      if (!b.visible) continue
      looks++
      // (Riding the swell: at the sea's surface where it is, give or take half a metre as a big hull lags it.)
      if (Math.abs(b.y - world.seaAt(b.x, b.z)) < 0.06) afloat++
      const L = { rowboat: 1.8, fishing: 5.5, ferry: 12, speed: 3.2, yacht: 4.8 }[b.kind] * METRE, Wd = { rowboat: 0.7, fishing: 1.9, ferry: 3.5, speed: 1.2, yacht: 1.5 }[b.kind] * METRE
      const s = Math.sin(b.yaw), c = Math.cos(b.yaw)
      for (const [a, w] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0, 0]]) {
        const x = b.x + s * a * L + c * w * Wd, z = b.z + c * a * L - s * w * Wd
        if (world.heightAt(x, z) > seaY - 0.02) { aground.push(`${b.kind} at ${x.toFixed(1)},${z.toFixed(1)}`); break }
      }
    }
  }
  const fer = port.state().find((b) => b.kind === 'ferry')
  aground = [...new Set(aground)]
  check(nanB === 0 && port.state().length >= 10 && afloat === looks, `${port.state().length} boats afloat (${afloat} of ${looks} looks at the sea's surface): rowing boats at the piers, fishing boats at anchor, the ferry, a speedboat, two yachts`)
  check(aground.length === 0, `every hull stays in the water, never over the sand${aground.length ? ' — not: ' + aground.slice(0, 4).join('; ') : ''}`)
  check(fer.visible && Math.abs(fer.z - (26.05 + 12 * METRE + 0.06)) < 0.02 && fer.v < 0.01, `the ferry comes in and lies alongside the harbour pier (at ${fer.z.toFixed(2)}, still)`)
  port.dispose()
}

// The weather: spells that follow one another, clouds as much of the sky as each says, rain only from a heavy sky, wet that soaks in and dries.
{
  const { Scene, Vector3, DirectionalLight, Color } = await import('three')
  const scene = new Scene(), light = new DirectionalLight()
  const wx = weather(scene, { light, phone: false, still: false, start: 'clear' })
  const cam = new Vector3(15, 0.5, 15), up = new Vector3(), col = new Color()
  const ctx = { cam, groundAt: (x, z) => world.heightAt(x, z), sunDir: new Vector3(0.3, 0.8, 0.2).normalize(), lightDir: new Vector3(0.3, 0.8, 0.2).normalize(), lightTarget: new Vector3(15, 0, 15), litColor: col, shadeColor: col, haze: col, day: 1, lampGlow: 0 }
  // How much of the sky overhead is cloud, for a spell (looking up at 300 points of the sky).
  const sky = () => { let n = 0, c = 0; for (let a = 0; a < 20; a++) for (let b = 0; b < 15; b++) { const el = 0.35 + (b / 15) * 1.1, az = (a / 20) * Math.PI * 2; up.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)); c += wx.cloudToward(cam, up); n++ } return c / n }
  const settle = (kind, s) => { wx.set(kind); for (let k = 0; k < 30 * s; k++) wx.update(1 / 30, ctx) }
  settle('clear', 60); const clear = sky()
  settle('cloudy', 60); const cloudy = sky()
  settle('rain', 60); const rainy = sky(), raining = wx.state.rain, soaked = wetness.wet.value
  check(clear < 0.2 && cloudy > 0.2 && cloudy < 0.75 && rainy > 0.9, `the sky is as cloudy as the weather says: clear ${(clear * 100).toFixed(0)}%, cloudy ${(cloudy * 100).toFixed(0)}%, rain ${(rainy * 100).toFixed(0)}% cloud`)
  check(raining > 0.5 && soaked > 0.6, `choose rain and it rains within a minute (${raining.toFixed(2)}), and the streets are soaked (${soaked.toFixed(2)})`)
  settle('clear', 60); const after1 = wetness.wet.value
  settle('clear', 300); const after6 = wetness.wet.value
  check(wx.state.rain < 0.02 && after1 > 0.3 && after6 < after1 - 0.3, `once it stops, the wet dries slowly (${after1.toFixed(2)} a minute on, ${after6.toFixed(2)} after six)`)
  // Left to itself, an hour of it: the spells change, and it only rains from a heavy sky.
  wx.set('auto'); const seen = new Set(); let badRain = 0
  for (let k = 0; k < 2 * 3600; k++) { wx.update(0.5, ctx); if (k % 20 === 0) { seen.add(wx.state.kind); if (wx.state.rain > 0.05 && wx.state.cover < 0.8) badRain++ } }
  check(seen.size >= 3 && badRain === 0, `left to itself for an hour the weather goes through ${seen.size} spells (${[...seen].join(', ')}), raining only from a heavy sky`)
  wx.dispose()
}

// Things to kick and push: they stand where they are put, a ball goes when kicked, a crate pushes along, a car knocks a cone flying, a ball floats.
{
  const { Scene } = await import('three')
  const start = data.road[Math.floor(data.road.length / 2)]
  const waterAt = (x, z) => world.poolAt(x, z) ?? (world.heightAt(x, z) < Y(data.sea) + 0.06 ? world.seaAt(x, z) : null)
  const T = toys(new Scene(), { heightAt: world.heightAt, boxes: world.boxes, seaY: Y(data.sea), waterAt, kind: world.kind, roads: data.road, start: { x: start[1] + 0.5, z: start[0] + 0.5 }, piers: data.piers })
  const kinds = T.state().map((b) => b.kind), count = (k) => kinds.filter((x) => x === k).length
  const s0 = T.state()
  for (const b of T.bodies) b.c.wakeUp()
  for (let k = 0; k < 300; k++) T.step(1 / 60, { you: null, cars: [] })
  const s1 = T.state(), drift = Math.max(...s1.map((b, i) => Math.hypot(b.x - s0[i].x, b.y - s0[i].y, b.z - s0[i].z) / METRE))
  check(count('football') >= 2 && count('beachball') >= 2 && count('crate') >= 3 && count('fishbox') >= 3 && count('cone') >= 3, `things lie about: ${count('football')} footballs, ${count('beachball')} beach balls, ${count('crate')} crates, ${count('fishbox')} fish boxes, ${count('cone')} cones`)
  check(drift < 0.03 && s1.every((b) => b.up > 0.99), `left alone, every stack stands (the most anything settled: ${(drift * 100).toFixed(1)} cm)`)
  // A football, run at (5.5 m/s): it goes on twenty or thirty metres, rolling.
  const ball = T.bodies.find((b) => b.kind === 'football'), b0 = ball.p.clone()
  let you = { x: ball.p.x - 0.1, y: world.heightAt(ball.p.x, ball.p.z), z: ball.p.z, vx: 5.5 * METRE, vz: 0, running: true }
  for (let k = 0; k < 60; k++) { you.x += you.vx / 60; T.step(1 / 60, { you, cars: [] }) }
  for (let k = 0; k < 600; k++) T.step(1 / 60, { you: null, cars: [] })
  const kick = Math.hypot(ball.p.x - b0.x, ball.p.z - b0.z) / METRE
  check(kick > 12 && kick < 60, `run into a football and it is kicked on ${kick.toFixed(0)} m`)
  // A crate, walked into at 1.5 m/s for three seconds: it slides along, and holds you back.
  const cr = T.bodies.filter((b) => b.kind === 'crate').at(-1), c0 = cr.p.clone()
  you = { x: cr.p.x - 0.07, y: world.heightAt(cr.p.x, cr.p.z), z: cr.p.z, vx: 1.5 * METRE, vz: 0, running: false }
  let went = 0
  for (let k = 0; k < 180; k++) { const r = T.step(1 / 60, { you, cars: [] }); const vx = r ? r.vx : you.vx; you.x += vx / 60; went += vx / 60 }
  const pushed = Math.hypot(cr.p.x - c0.x, cr.p.z - c0.z) / METRE
  check(pushed > 0.8 && went / METRE < 4.4, `walk into a crate and it slides along (${pushed.toFixed(1)} m) while you go slower than a walk (${(went / METRE).toFixed(1)} m in 3 s)`)
  // A car at 30 km/h into a cone: it flies and falls over.
  const cn = T.bodies.find((b) => b.kind === 'cone'), k0 = cn.p.clone()
  const car = { x: cn.p.x - 0.4, y: world.heightAt(cn.p.x, cn.p.z), z: cn.p.z, yaw: 0, hl: 0.22, hw: 0.1, tall: 0.16, vx: 8.3 * METRE, vz: 0 }
  for (let k = 0; k < 90; k++) { car.x += car.vx / 60; T.step(1 / 60, { you: null, cars: [car] }) }
  for (let k = 0; k < 300; k++) T.step(1 / 60, { you: null, cars: [] })
  const flew = Math.hypot(cn.p.x - k0.x, cn.p.z - k0.z) / METRE, cs = T.state()[T.bodies.indexOf(cn)]
  check(flew > 3 && cs.up < 0.9, `drive into a cone at 30 km/h and it is knocked ${flew.toFixed(0)} m, and over`)
  T.dispose()
}

// The street: traffic lights at the junctions, which the traffic obeys; benches, bins, signs; all of it solid.
{
  const { Scene } = await import('three')
  const w2 = buildWorld(JSON.parse(json))
  const st = street(new Scene(), { roads: data.road, kind: w2.kind, heightAt: w2.heightAt, boxes: w2.boxes, district: data.district })
  const n = st.counts()
  check(n.junctions >= 8 && n.heads >= n.junctions * 3 && n.benches >= 12 && n.bins >= 8 && n.signs >= 4 && n.solids >= n.benches + n.bins + n.poles, `the street: ${n.junctions} junctions with ${n.heads} signal heads on ${n.poles} poles, ${n.benches} benches, ${n.bins} bins, ${n.signs} road signs, all solid`)
  // The cycle: never green both ways at once, every way green a while each minute.
  let both = 0, greens = { ns: 0, ew: 0 }
  for (let t = 0; t < 76; t += 0.25) { const a = lightAt(t, 3, 'ns'), b = lightAt(t, 3, 'ew'); if (a !== 'red' && b !== 'red') both++; if (a === 'green') greens.ns += 0.25; if (b === 'green') greens.ew += 0.25 }
  check(both === 0 && greens.ns >= 25 && greens.ew >= 25, `the lights never let both ways go at once (${both} moments), each way green ${greens.ns} s and ${greens.ew} s in 76`)
  // Three minutes of traffic: nobody drives into a junction on red, and the traffic still flows.
  const tr = createTraffic({ roads: data.road, play: true, dark: () => 0, signal: st.signal })
  const cell = (c) => [Math.floor(c.i), Math.floor(c.j)]
  let prev = tr.state().map(cell), runs = 0, entries = 0, moved = 0
  const jset = new Set(st.junctions.map(([i, j]) => `${i},${j}`))
  for (let k = 0; k < 30 * 180; k++) {
    tr.step(1 / 30); st.update(1 / 30, 0)
    const now = tr.state()
    now.forEach((c, m) => {
      const a = prev[m], b = cell(c)
      // (Not a U-turn at a dead end beside a junction, whose curve cuts its corner at the line.)
      const uturn = c.path.split(' ')[0] === c.path.split(' ')[2]
      if ((a[0] !== b[0] || a[1] !== b[1]) && jset.has(`${b[0]},${b[1]}`) && !jset.has(`${a[0]},${a[1]}`) && !uturn) { entries++; if (st.signal(b, a) === 'red') runs++ }
      prev[m] = b
      moved += c.v / 30
    })
  }
  check(entries > 40 && runs <= entries * 0.02, `in three minutes the traffic goes into the junctions ${entries} times, ${runs} of them on red (a car already at the line as it changes)`)
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nThe walk checks out.')
process.exit(failures ? 1 : 0)
