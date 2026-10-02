/**
 * Tiny Island — the whole map, built once at build time.
 *
 * The ground is a grid of tiles: which ones are land is the union of the
 * seven districts (each a wobbly disc), plus every building's footprint.
 * Only Sky Peaks rises; everything else sits one step above the sea. Roads
 * are found, not drawn: a path search from every district to the middle of
 * Old Town that walks round the buildings, so a road never runs under one.
 * People walk those roads; boats sail round the coast; clouds and birds go
 * over the top. Everything is painted back to front.
 */
import { C, INK, N, OUT, P, Pen, render, rng, shade, mix, S, Bounds, motionCss, motionPath } from './kit'
import { tree, person, lamp, bench, flowers, walkerFigure, sailboat, birds, cloudShape, type TreeKind } from './props'
import { LANDMARKS, DISTRICTS, PLACES, type DistrictKey, type District } from './landmarks'
import { hotAirBalloon, plane as skyPlane } from './sky'
import { cottage, postbox, signpost, crossing, busStop, fountain, sitter, picnic, kiteFlyer, playground, umbrella, towel, sandcastle, lifeguard, surfboard, pier, rowboat, buoy, tent, campfire, shuttle } from './town'
import { snowPine, cactus, barrelCactus, reeds, hedge, topiary, toadstools, arch, butte, hoodoo, boulders, field as cropField, bale, windmill, sheep, duck, crab, dolphin, whale, gullStanding, gullsCircling, butterfly, deer, tumbleweed } from './nature'

export const GRID = 30
const SEA = -12
const BEACH = -6
/** Piers: a run of ground points from a beach out over the water. */
const PIERS: [number, number][][] = [[[5.5, 17.2], [5.5, 14.3]], [[14.5, 29.4], [14.5, 31.7]]]
const f = (v: number) => Math.round(v * 10) / 10
const f2 = (v: number) => Math.round(v * 100) / 100
/** Sand: two tones for the tops, the wet edge, and the two faces of a step. */
const SAND = ['#f6f0e1', '#efe7d3', '#d9ccad', '#e3d7ba', '#cbbb98']
const key = (i: number, j: number) => `${i},${j}`

export type Anchor = { slug: string; district: DistrictKey; x0: number; y0: number; x1: number; y1: number; bx: number; by: number; foot: string }
export type Layer = { kind: 'sea' | 'surf' | 'boats' | 'ground' | 'walkers' | 'things' | 'landmark' | 'night' | 'banners' | 'sky'; slug?: string; body: string }
export type Island = { land: [number, number, number, number]; hiddenLights: number; svg: string; layers: Layer[]; css: string; viewBox: [number, number, number, number]; anchors: Record<string, Anchor>; lights: [number, number][]; banners: Record<string, [number, number]>; mini: string }
export type GameLink = { slug: string; title: string; blurb: string; href: string }

/**
 * Draws an SVG document into RGBA pixels at a given width: resvg at build
 * time. Given one, the island works out which of its lights something in
 * front hides, so no window glows through a sign at night.
 */
export type Raster = (svg: string, width: number) => { width: number; height: number; pixels: Uint8Array }

export function buildIsland(games: GameLink[], opts: { raster?: Raster } = {}): Island {
  const R = rng(20260930)
  motionCss.length = 0
  const D = (k: DistrictKey) => DISTRICTS.find((d) => d.key === k)!

  /* ---- land, height, district ------------------------------------------ */
  const land: boolean[][] = [], height: number[][] = [], dist: District[][] = []
  for (let i = 0; i < GRID; i++) { land[i] = []; height[i] = []; dist[i] = []; for (let j = 0; j < GRID; j++) {
    const c = [i + 0.5, j + 0.5]
    let best = DISTRICTS[0], bd = Infinity, inside = false
    for (const d of DISTRICTS) {
      const r = Math.hypot(c[0] - d.at[0], c[1] - d.at[1])
      const wob = 0.55 * Math.sin(i * 1.27 + j * 0.71) + 0.4 * Math.cos(j * 1.93 - i * 0.43)
      if (r < d.r + wob) inside = true
      if (r / d.r < bd) { bd = r / d.r; best = d }
    }
    land[i][j] = inside; dist[i][j] = best
    const sd = Math.hypot(c[0] - 5.2, c[1] - 5.2)
    height[i][j] = inside && best.key === 'peaks' ? Math.max(0, Math.round(5.2 - sd * 0.62)) * 12 : 0
  } }
  const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID
  const isLand = (i: number, j: number) => inGrid(i, j) && land[i][j]

  // Every building stands on its own flat plaza; water buildings stay in the sea.
  const taken = new Map<string, string>()
  const placed = PLACES.map(([slug, district, i, j]) => {
    const lm = LANDMARKS[slug], [w, d] = lm.size
    const cells: [number, number][] = []
    for (let a = Math.floor(i); a < Math.ceil(i + w); a++) for (let b = Math.floor(j); b < Math.ceil(j + d); b++) cells.push([a, b])
    const own = cells.filter(([a, b]) => inGrid(a, b))
    const z = lm.water ? SEA : Math.max(0, ...own.map(([a, b]) => height[a][b]))
    for (const [a, b] of own) { if (!lm.water) { land[a][b] = true; height[a][b] = z; dist[a][b] = D(district) } else land[a][b] = false; taken.set(key(a, b), slug) }
    return { slug, district, i, j, w, d, z, lm, cells: own }
  })
  const coast = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !isLand(i + a, j + b))
  const H = (i: number, j: number) => (isLand(i, j) ? height[i][j] : SEA)

  // The low coast steps down to a beach, half-way to the sea.
  const beach = new Set<string>()
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (isLand(i, j) && height[i][j] === 0 && !taken.has(key(i, j)) && coast(i, j)) beach.add(key(i, j))
  for (const k of beach) { const [i, j] = k.split(',').map(Number); height[i][j] = BEACH }

  // A river: a spring high on Sky Peaks, falling down the terraces to the sea.
  const river: [number, number][] = []
  for (let j = 4; j < GRID && isLand(7, j); j++) river.push([7, j])
  const wet = new Set(river.map((c) => key(...c)))
  // A pond in the park in Old Town.
  const pond = new Set<string>()
  for (const [i, j] of [[14, 9], [14, 10], [14, 11], [15, 9], [15, 10], [15, 11]]) if (isLand(i, j) && !taken.has(key(i, j))) pond.add(key(i, j))
  // Ground kept for fields, the windmill and the rock formations, so no tree
  // or tuft lands on them. Each is only used if its ground really is free.
  const reserved = new Set<string>()
  const FIELDS: [number, number, number, number, 'lavender' | 'wheat' | 'greens'][] = [[9, 13, 1, 3, 'lavender'], [19, 15, 2, 3, 'wheat'], [22, 19, 2, 3, 'greens']]
  const SPOTS: { mill: [number, number]; bale: [number, number][]; arch: [number, number]; buttes: [number, number, number][]; hoodoos: [number, number][]; boulders: [number, number][] } = { mill: [8, 15], bale: [[8, 16], [9, 12], [21, 15], [21, 16]], arch: [20, 7], buttes: [[22, 3, 34], [25, 6, 26], [18, 5, 20]], hoodoos: [[18, 4], [20, 9], [24, 3]], boulders: [[19, 6], [26, 6], [23, 4], [20, 10]] }

  /* ---- roads: found by searching round the buildings -------------------- */
  const road = new Set<string>()
  const walkable = (i: number, j: number) => isLand(i, j) && height[i][j] === 0 && !taken.has(key(i, j)) && !coast(i, j) && !wet.has(key(i, j)) && !pond.has(key(i, j))
  const nearestFree = (x: number, y: number) => {
    let best: [number, number] = [Math.floor(x), Math.floor(y)], bd = Infinity
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (walkable(i, j)) { const d = Math.hypot(i + 0.5 - x, j + 0.5 - y); if (d < bd) { bd = d; best = [i, j] } }
    return best
  }
  function search(from: [number, number], to: [number, number]): [number, number][] {
    const open = new Map<string, { c: [number, number]; g: number; f: number; dir: number; prev?: string }>()
    const done = new Map<string, { c: [number, number]; prev?: string }>()
    const hf = (c: [number, number]) => Math.abs(c[0] - to[0]) + Math.abs(c[1] - to[1])
    open.set(key(...from), { c: from, g: 0, f: hf(from), dir: -1 })
    const steps: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    while (open.size) {
      let bk = '', bn: { c: [number, number]; g: number; f: number; dir: number; prev?: string } | null = null
      for (const [k, n] of open) if (!bn || n.f < bn.f) { bk = k; bn = n }
      open.delete(bk); done.set(bk, bn!)
      if (bn!.c[0] === to[0] && bn!.c[1] === to[1]) break
      steps.forEach(([a, b], dir) => {
        const c: [number, number] = [bn!.c[0] + a, bn!.c[1] + b], k = key(...c)
        if (done.has(k) || !walkable(...c)) return
        const g = bn!.g + (road.has(k) ? 0.35 : 1) + (bn!.dir >= 0 && bn!.dir !== dir ? 0.6 : 0)
        const cur = open.get(k)
        if (!cur || g < cur.g) open.set(k, { c, g, f: g + hf(c), dir, prev: bk })
      })
    }
    const out: [number, number][] = []
    let k: string | undefined = key(...to)
    if (!done.has(k)) return out
    while (k) { const n = done.get(k)!; out.unshift(n.c); k = n.prev }
    return out
  }
  const hub = nearestFree(14.8, 12.9)
  const gates = Object.fromEntries(DISTRICTS.map((d) => [d.key, nearestFree(d.at[0] + (d.key === 'peaks' ? 3.6 : 0), d.at[1] + (d.key === 'peaks' ? 3.6 : 0))])) as Record<DistrictKey, [number, number]>
  const routes: [number, number][][] = []
  for (const d of DISTRICTS) if (d.key !== 'oldtown') { const r = search(gates[d.key], hub); if (r.length > 1) { routes.push(r); r.forEach((c) => road.add(key(...c))) } }
  for (const [a, b] of [['market', 'funfair'], ['funfair', 'harbour'], ['harbour', 'proving'], ['proving', 'badlands']] as [DistrictKey, DistrictKey][]) { const r = search(gates[a], gates[b]); if (r.length > 1) { routes.push(r); r.forEach((c) => road.add(key(...c))) } }

  const free = (i: number, j: number) => { const k = key(i, j); return isLand(i, j) && !taken.has(k) && !road.has(k) && !wet.has(k) && !pond.has(k) && !beach.has(k) && !reserved.has(k) }
  const claim = (cells: [number, number][]) => { if (!cells.every(([i, j]) => free(i, j))) return false; cells.forEach(([i, j]) => reserved.add(key(i, j))); return true }
  const fields = FIELDS.filter(([i, j, w, d]) => { const c: [number, number][] = []; for (let a = i; a < i + w; a++) for (let b = j; b < j + d; b++) c.push([a, b]); return claim(c) })
  const mill = claim([SPOTS.mill]) ? SPOTS.mill : null
  const bales = SPOTS.bale.filter((c) => claim([c]))
  const archAt = claim([SPOTS.arch]) ? SPOTS.arch : null
  const buttes = SPOTS.buttes.filter(([i, j]) => claim([[i, j]]))
  const hoodoos = SPOTS.hoodoos.filter((c) => claim([c]))
  const boulderAt = SPOTS.boulders.filter((c) => claim([c]))
  // A dry wash across the Badlands: a riverbed that only runs once a year,
  // winding down to the western beach. Its cells are kept clear.
  const WASH: [number, number][] = [[25.5, 8.7], [24.7, 7.6], [23.6, 7.4], [22.7, 6.4], [22.4, 5.0], [22.0, 4.1], [21.4, 3.3], [21.0, 2.4], [20.5, 2.05]]
  const washCells = [...new Set(WASH.map(([u, v]) => key(Math.floor(u), Math.floor(v))))].map((k) => k.split(',').map(Number) as [number, number])
  const wash = claim(washCells) ? WASH : null

  if (process.env.ISLAND_ASCII) {
    const rows = ['    ' + [...Array(GRID).keys()].map((j) => j % 10).join('')]
    for (let i = 0; i < GRID; i++) { let out = String(i).padStart(3) + ' '; for (let j = 0; j < GRID; j++) { const k = key(i, j); out += !isLand(i, j) ? '.' : taken.has(k) ? '#' : road.has(k) ? '=' : wet.has(k) ? '~' : pond.has(k) ? 'o' : beach.has(k) ? ',' : height[i][j] > 0 ? String(height[i][j] / 12) : dist[i][j].key[0] } rows.push(out) }
    const out = rows.join(String.fromCharCode(10))
    console.log(out)
  }
  /* ---- the painting ------------------------------------------------------ */
  // A fixed hash, for choices that must line up from one tile to the next.
  const hz = (a: number, b: number, c: number) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 3.71) * 43758.5453; return v - Math.floor(v) }
  // The island is painted in layers, each its own SVG, so an animation only
  // makes the browser rework the small layer it is in rather than the lot.
  const made: { kind: Layer['kind']; slug?: string; node: N }[] = []
  const open = (kind: Layer['kind'], slug?: string) => { const node = new N('g', { class: `layer-${kind}` }); made.push({ kind, slug, node }); return node }
  let root = open('sea')
  const lights: [number, number][] = []

  // The sea, its shallows, and the surf round the coast.
  const [sx0, sy0] = P(-8, GRID + 8), [sx1] = P(GRID + 8, -8), [, sy1] = P(-8, -8), [, sy2] = P(GRID + 8, GRID + 8)
  // The open sea is a touch deeper the further it is from the island.
  const [mx, my] = P(GRID / 2, GRID / 2, SEA)
  const defs = root.add(new N('defs'))
  const grad = defs.add(new N('radialGradient', { id: 'isl-sea', cx: f(mx), cy: f(my), r: 1500, gradientUnits: 'userSpaceOnUse', gradientTransform: `translate(${f(mx)} ${f(my)}) scale(1 0.55) translate(${f(-mx)} ${f(-my)})` }))
  grad.add(new N('stop', { offset: 0.3, 'stop-color': '#a3dbff' }))
  grad.add(new N('stop', { offset: 1, 'stop-color': C.water }))
  root.add(new N('rect', { x: sx0 - 400, y: sy1 - 1400, width: sx1 - sx0 + 800, height: sy2 - sy1 + 2000, fill: 'url(#isl-sea)' }))

  // The shallows: the whole coast's outline, stroked wider and wider with
  // round joins, which is the same as growing it outwards by that much. Drawn
  // flat on the sea in tile units, so the bands curve round the coast the way
  // shallow water does, rather than stepping tile by tile. A thin lighter
  // ring marks each band's edge, like the line a wave leaves.
  const [sox, soy] = P(0, 0, SEA)
  const flat = (cls?: string) => root.add(new N('g', { class: cls, transform: `translate(${f(sox)} ${f(soy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
  let landSq = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if (isLand(i, j)) landSq += `M${i} ${j}h1v1h-1z`
  const sh = flat('shallows')
  // One outline, drawn eight times: each band and its lighter edge.
  sh.add(new N('defs')).add(new N('path', { id: 'isl-coast', d: landSq }))
  ;([[7.2, '#98d4fc'], [4.6, '#a7ddf9'], [2.6, '#b8e7f6'], [1.2, '#cdf1f4']] as [number, string][]).forEach(([w, c]) => {
    sh.add(new N('use', { href: '#isl-coast', fill: c, stroke: mix(c, '#ffffff', 0.45), 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
    sh.add(new N('use', { href: '#isl-coast', fill: c, stroke: c, 'stroke-width': f2(w - 0.09), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
  })
  // Sand and pebbles seen through the clearest water, right by the shore.
  let seabed = ''
  for (let i = -2; i < GRID + 2; i++) for (let j = -2; j < GRID + 2; j++) {
    if (isLand(i, j)) continue
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => isLand(i + a, j + b))) continue
    for (let k = 0; k < 2; k++) { const u = i + 0.2 + R() * 0.6, v = j + 0.2 + R() * 0.6, r = 0.035 + R() * 0.05; seabed += `M${f2(u - r)} ${f2(v)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(r * 2)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-r * 2)} 0` }
  }
  sh.add(new N('path', { d: seabed, fill: '#ffffff', opacity: 0.45 }))

  const waves = root.add(new N('g', { class: 'waves' }))
  // Wave marks out in open water only, where they will not sit on the shallows.
  const nearLand = (u: number, v: number, r: number) => { for (let a = Math.floor(u - r); a <= u + r; a++) for (let b = Math.floor(v - r); b <= v + r; b++) if (isLand(a, b)) return true; return false }
  for (let g = 0; g < 4; g++) {
    let d = ''
    for (let k = 0; k < 45; k++) {
      const u = R() * (GRID + 16) - 8, v = R() * (GRID + 16) - 8
      if (nearLand(u, v, 3.5)) continue
      const [x, y] = P(u, v, SEA)
      d += `M${f(x)} ${f(y)}q7 -5 14 0q7 -5 14 0`
    }
    waves.add(new N('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', class: `wave w${g}` }))
  }
  // Rocks standing in the shallows, each with a ring of foam, and a little
  // sandbar off the harbour with one palm on it.
  const waterSlug = new Set(placed.filter((p) => p.lm.water).flatMap((p) => p.cells.map((c) => key(...c))))
  const clearOf = (i: number, j: number, r: number) => { for (let a = i - r; a <= i + r; a++) for (let b = j - r; b <= j + r; b++) if (isLand(a, b) || waterSlug.has(key(a, b))) return false; return true }
  const seaRocks: [number, number, number][] = []
  for (const [i, j, k] of [[-2, 12, 1], [12, 31, 1.2], [31, 6, 0.9], [29, 28, 1.1], [-2, 8, 0.8], [13, -2, 0.9], [18, -2, 1], [9, 30, 0.9]] as [number, number, number][]) {
    if (!clearOf(Math.floor(i), Math.floor(j), 1)) continue
    seaRocks.push([i, j, k])
  }
  for (const rk of seaRocks) {
    const [i, j, k] = rk
    const [x, y] = P(i + 0.5, j + 0.5, SEA)
    root.add(new N('ellipse', { cx: f(x + 2), cy: f(y + 3), rx: f(26 * k), ry: f(11 * k), fill: '#ffffff', opacity: 0.55 }))
    root.add(new N('ellipse', { cx: f(x + 2), cy: f(y + 3), rx: f(19 * k), ry: f(8 * k), fill: '#cdf1f4' }))
    root.add(new N('path', { d: `M${f(x - 12 * k)} ${f(y + 4)}L${f(x - 1 * k)} ${f(y + 16 * k)}L${f(x + 11 * k)} ${f(y + 4)}Z`, fill: C.rockDark, opacity: 0.22 }))
    root.add(new N('path', { d: `M${f(x - 14 * k)} ${f(y + 4)}L${f(x - 10 * k)} ${f(y - 8 * k)}L${f(x - 1 * k)} ${f(y - 14 * k)}L${f(x + 9 * k)} ${f(y - 7 * k)}L${f(x + 13 * k)} ${f(y + 4)}Z`, fill: C.rock, stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    root.add(new N('path', { d: `M${f(x - 1 * k)} ${f(y - 14 * k)}L${f(x + 9 * k)} ${f(y - 7 * k)}L${f(x + 13 * k)} ${f(y + 4)}L${f(x + 1 * k)} ${f(y + 4)}Z`, fill: C.rockDark, opacity: 0.55 }))
    root.add(new N('path', { d: `M${f(x - 9 * k)} ${f(y - 8 * k)}l5 -3`, stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.7 }))
    root.add(new N('path', { d: `M${f(x - 18 * k)} ${f(y + 5)}q${f(18 * k)} ${f(7 * k)} ${f(36 * k)} 0`, fill: 'none', stroke: '#ffffff', 'stroke-width': 2, 'stroke-linecap': 'round' }))
    // A gull on every other rock.
    if (seaRocks.indexOf(rk) % 2 === 0) root.add(gullStanding(x - 1 * k, y - 13.5 * k, seaRocks.indexOf(rk) % 4 === 0))
  }
  const sandbar = [30.2, 24.4]
  if (clearOf(30, 24, 1)) {
    const [x, y] = P(sandbar[0], sandbar[1], SEA)
    root.add(new N('ellipse', { cx: f(x), cy: f(y + 4), rx: 54, ry: 21, fill: '#ffffff', opacity: 0.6 }))
    root.add(new N('ellipse', { cx: f(x), cy: f(y + 4), rx: 46, ry: 17, fill: '#cdf1f4' }))
    root.add(new N('path', { d: `M${f(x - 34)} ${f(y + 3)}q34 -16 68 0q-34 14 -68 0z`, fill: SAND[0], stroke: INK, 'stroke-width': OUT, 'stroke-linejoin': 'round' }))
    root.add(new N('path', { d: `M${f(x - 34)} ${f(y + 3)}q34 14 68 0`, fill: 'none', stroke: SAND[2], 'stroke-width': 2.4, 'stroke-linecap': 'round' }))
    for (const [dx, dy] of [[-14, 1], [10, 4], [20, 0]]) root.add(new N('circle', { cx: f(x + dx), cy: f(y + dy), r: 1.3, fill: '#ffffff', stroke: INK, 'stroke-width': 0.6 }))
  }
  // Shimmer: short streaks of light lying flat on the water, a few at a
  // time catching the sun, thickest just off the shore.
  const shim = root.add(new N('g', { class: 'shimmer' }))
  for (let k = 0; k < 40; k++) {
    const u = hz(k, 1, 21) * (GRID + 10) - 5, v = hz(k, 2, 22) * (GRID + 10) - 5
    if (nearLand(u, v, 0.8) || !nearLand(u, v, 4.5)) continue
    const [x, y] = P(u, v, SEA), w = 6 + hz(k, 3, 23) * 10
    shim.add(new N('path', { d: `M${f(x - w)} ${f(y)}h${f(w * 2)}M${f(x - w * 0.5)} ${f(y + 3)}h${f(w)}`, stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', class: 'shim amb', 'data-b': `${f(x - w)} ${f(y - 2)} ${f(x + w)} ${f(y + 5)}`, style: `animation-delay:${f(-hz(k, 4, 24) * 6)}s` }))
  }
  // Glints of sun on the water, here and there.
  const glints = root.add(new N('g', { class: 'glints' }))
  for (let k = 0; k < 26; k++) {
    const u = R() * (GRID + 14) - 7, v = R() * (GRID + 14) - 7
    if (nearLand(u, v, 1.5)) continue
    const [x, y] = P(u, v, SEA), r = 3 + R() * 3
    glints.add(new N('path', { d: `M${f(x)} ${f(y - r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + r)}Q${f(x)} ${f(y)} ${f(x - r)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - r)}Z`, fill: '#ffffff', class: 'glint amb', 'data-b': `${f(x - r)} ${f(y - r)} ${f(x + r)} ${f(y + r)}`, style: `animation-delay:${f(-R() * 4)}s` }))
  }
  // Foam where the water meets the land: the coast's outline once more,
  // stroked narrow and white, so it hugs every beach and cliff foot.
  const coastT = `translate(${f(sox)} ${f(soy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)`
  const foamG = root.add(new N('g', { transform: coastT }))
  foamG.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 0.86, 'stroke-linejoin': 'round', opacity: 0.35 }))
  foamG.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': 0.42, 'stroke-linejoin': 'round', opacity: 0.9 }))
  // Rocks at the waterline, here and there along the sides we can see: a
  // few stones in a ring of their own foam, never in front of a pier or a
  // building that stands in the sea.
  const pierCells = new Set(PIERS.flatMap((pts) => pts.map(([u, v]) => key(Math.floor(u), Math.floor(v)))))
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j)) continue
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const ni = i + di, nj = j + dj
      if (isLand(ni, nj) || waterSlug.has(key(ni, nj)) || pierCells.has(key(ni, nj)) || hz(i * 3 + di, j * 5 + dj, 7) > 0.16) continue
      const u = di ? i + 1.16 : i + 0.25 + hz(i, j, 1) * 0.5, v = dj ? j + 1.16 : j + 0.25 + hz(j, i, 2) * 0.5
      const [x, y] = P(u, v, SEA)
      const big = 0.55 + hz(i, j, 3) * 0.35
      root.add(new N('ellipse', { cx: f(x + 3), cy: f(y + 2), rx: f(19 * big), ry: f(7 * big), fill: '#ffffff', opacity: 0.6 }))
      for (const [dx, dy, k] of [[0, 0, big], [10 * big, 3, big * 0.6], [-9 * big, 3.5, big * 0.45]] as [number, number, number][]) {
        const X = x + dx, Y = y + dy
        root.add(new N('path', { d: `M${f(X - 11 * k)} ${f(Y + 3)}L${f(X - 8 * k)} ${f(Y - 6 * k)}L${f(X + 1 * k)} ${f(Y - 10 * k)}L${f(X + 9 * k)} ${f(Y - 4 * k)}L${f(X + 10 * k)} ${f(Y + 3)}Z`, fill: C.rock, stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
        root.add(new N('path', { d: `M${f(X + 1 * k)} ${f(Y - 10 * k)}L${f(X + 9 * k)} ${f(Y - 4 * k)}L${f(X + 10 * k)} ${f(Y + 3)}L${f(X + 1 * k)} ${f(Y + 3)}Z`, fill: C.rockDark, opacity: 0.5 }))
      }
      root.add(new N('path', { d: `M${f(x - 15 * big)} ${f(y + 4)}q${f(15 * big)} ${f(5 * big)} ${f(30 * big)} 0`, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }))
    }
  }

  // The surf: two lines of breaking wave, a little way out, each in a layer
  // of its own whose opacity rises and falls in turn, so the waves seem to
  // roll in to the shore. Fading a whole layer costs the browser nothing;
  // moving a line round the whole coast would cost it every frame.
  for (const [k, w0, w1] of [['out', 1.66, 1.82], ['in', 1.1, 1.24]] as [string, number, number][]) {
    root = open('surf', k)
    const id = `isl-surf-${k}`
    const m = root.add(new N('mask', { id, maskUnits: 'userSpaceOnUse', x: f(sx0 - 400), y: f(sy1 - 1400), width: f(sx1 - sx0 + 800), height: f(sy2 - sy1 + 2000) }))
    const mg = m.add(new N('g', { transform: coastT }))
    mg.add(new N('use', { href: '#isl-coast', fill: '#ffffff', stroke: '#ffffff', 'stroke-width': w1, 'stroke-linejoin': 'round' }))
    mg.add(new N('use', { href: '#isl-coast', fill: '#000000', stroke: '#000000', 'stroke-width': w0, 'stroke-linejoin': 'round' }))
    root.add(new N('rect', { x: f(sx0 - 400), y: f(sy1 - 1400), width: f(sx1 - sx0 + 800), height: f(sy2 - sy1 + 2000), fill: '#ffffff', mask: `url(#${id})` }))
  }
  root = open('sea')

  // Boats sailing round the island, and fish that jump.
  root = open('boats')
  const boats = root.add(new N('g', { class: 'boats' }))
  ;[[C.rasp, 7.2, 60, 0], [C.cobalt, 5.8, 80, -25], [C.lilac, 6.6, 70, -50], [C.mint, 5.4, 95, -10]].forEach(([hull, rad, dur, begin]) => {
    const rr = GRID / 2 + (rad as number), c = GRID / 2
    const pts: [number, number][] = []
    for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push(P(c + Math.cos(a) * rr, c + Math.sin(a) * rr * 0.96, SEA)) }
    const name = `boat${boats.kids.length}`
    motionPath(name, pts, { closed: true })
    const g = boats.add(new N('g', { class: 'mover', style: `animation:${name} ${dur}s linear infinite ${begin}s` }))
    g.add(sailboat(hull as string, '#ffffff', 1.1))
  })
  for (const [i, j, d] of [[27, 26, 0], [2, 26, 3.5], [29, 10, 6]]) {
    const [x, y] = P(i, j, SEA)
    root.add(new N('path', { d: `M${f(x - 7)} ${f(y)}q7 -5 14 0q-7 5 -14 0zM${f(x + 7)} ${f(y)}l5 -3v6z`, fill: C.sky, stroke: INK, 'stroke-width': 1.2, class: 'fish', style: `animation-delay:${d}s` }))
  }
  // Dolphins leaping, and a whale further out, now and then blowing.
  ;[[33, 13, 0, false], [16, 34, 2.6, true], [-3, 16, 5.1, false]].forEach(([i, j, d, flip]) => {
    const [x, y] = P(i as number, j as number, SEA)
    root.add(dolphin(x, y, d as number, flip as boolean))
  })
  { const [x, y] = P(3, 29.5, SEA); root.add(whale(x, y)) }
  // Rowing boats tied up at the piers, and buoys off the harbour.
  for (const [n, pts] of PIERS.entries()) { const [ei, ej] = pts[pts.length - 1], [si, sj] = pts[0]; const di = Math.sign(ei - si), dj = Math.sign(ej - sj); const [x, y] = P(ei - di * 0.6 + (dj ? 0.42 : 0), ej - dj * 0.6 + (di ? 0.42 : 0), SEA); root.add(rowboat(x, y, n ? C.cobalt : C.mint)) }
  ;[[30, 21], [26.5, 29.2], [31, 16.5]].forEach(([i, j], n) => { const [x, y] = P(i, j, SEA); root.add(buoy(x, y, n * 1.4)) })

  // The ground, a diagonal row at a time: tops merged by colour, then cliffs.
  root = open('ground')
  const ground = root.add(new N('g', { class: 'ground' }))
  let mini = ''
  const quad = (pts: [number, number][]) => `M${pts.map((p) => p.map(f).join(' ')).join('L')}Z`
  const seg = (a: [number, number], b: [number, number]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`
  const ring = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
  // A smooth, low-frequency field, so the grass falls into soft patches of
  // lighter and darker green rather than a chessboard.
  const field = (i: number, j: number) => 0.5 + 0.22 * Math.sin(i * 0.55 + j * 0.31 + 1.7) + 0.2 * Math.cos(j * 0.62 - i * 0.23) + 0.08 * Math.sin(i * 2.1 + j * 1.7)
  const grassTones = (d: District) => [shade(d.ground[0], 0.95), d.ground[0], mix(d.ground[0], d.ground[1], 0.5), d.ground[1], mix(d.ground[1], '#ffffff', 0.14)]
  const FACE = { soil: ['#c9cfe6', '#a3add6'], rock: ['#a9a1d6', '#8a80c2'], sand: [SAND[3], SAND[4]], slate: ['#c2bde3', '#a59ed2'] }
  // The Badlands' dust: soft patches of five tones, one with a little rose in it.
  const DUST = ['#c6bce0', '#cec4e5', '#d6cdea', '#d5c5e3', '#ddd5ee']
  // Tops that should read as one surface, with no seam between tiles.
  const seamless = new Set<string>()
  const drip = (along: (u: number, z: number) => [number, number], h: number, seed: number) => {
    const pts: [number, number][] = [along(0, h + 0.5), along(1, h + 0.5)]
    for (let k = 8; k >= 0; k--) { const u = k / 8, deep = 2.5 + 3.2 * Math.abs(Math.sin(seed * 1.7 + k * 1.9)) * (k % 2 ? 1 : 0.45); pts.push(along(u, h - deep)) }
    return quad(pts)
  }
  // Wet sand along every edge of a beach that meets the sea.
  let wetSand = ''
  const fallStreaks: { d: string; b: string }[] = []
  let splash = ''
  for (let s = 0; s < GRID * 2; s++) {
    const tops = new Map<string, string>(), cliffs = new Map<string, string>(), lips = new Map<string, string>()
    let strata = '', wetTop = '', wetFall = '', wetHi = '', ink = '', foot = '', wetFoot = '', ledge = '', ledgeHi = ''
    const add = (m: Map<string, string>, c: string, d: string) => m.set(c, (m.get(c) ?? '') + d)
    for (let i = 0; i < GRID; i++) {
      const j = s - i
      if (!isLand(i, j)) continue
      const h = height[i][j], d = dist[i][j], k = key(i, j), n = field(i, j)
      const isBeach = beach.has(k), snowy = d.key === 'peaks' && (h >= 48 || (h === 36 && n > 0.62))
      let top: string, lip: string | null = null, face: string[]
      if (taken.has(k)) { top = (i + j) % 2 ? '#eef0f8' : '#e6e9f4'; face = FACE.soil }
      else if (isBeach && d.key === 'badlands') { top = n > 0.5 ? '#ddd8ef' : '#d5cfe9'; face = FACE.slate; seamless.add(top) }
      else if (isBeach) { top = n > 0.5 ? SAND[0] : SAND[1]; face = FACE.sand; seamless.add(top) }
      else if (snowy) { top = n > 0.55 ? '#f7faff' : '#e9f0ff'; lip = '#ffffff'; face = FACE.rock; seamless.add(top) }
      else {
        const t = d.key === 'badlands' ? DUST : grassTones(d)
        if (d.key === 'badlands') seamless.add(t[Math.max(0, Math.min(t.length - 1, Math.floor(n * t.length)))])
        top = t[Math.max(0, Math.min(t.length - 1, Math.floor(n * t.length)))]
        lip = shade(d.ground[0], d.key === 'badlands' ? 0.86 : 0.8)
        face = d.key === 'badlands' || d.key === 'peaks' ? FACE.rock : FACE.soil
      }
      const tq = quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i, j + 1, h)])
      add(tops, top, tq); mini += tq
      if (isBeach) {
        const w = 0.26
        if (!isLand(i + 1, j)) wetSand += quad([P(i + 1 - w, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1 - w, j + 1, h)])
        if (!isLand(i, j + 1)) wetSand += quad([P(i, j + 1 - w, h), P(i + 1, j + 1 - w, h), P(i + 1, j + 1, h), P(i, j + 1, h)])
        if (!isLand(i - 1, j)) wetSand += quad([P(i, j, h), P(i + w, j, h), P(i + w, j + 1, h), P(i, j + 1, h)])
        if (!isLand(i, j - 1)) wetSand += quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + w, h), P(i, j + w, h)])
      }
      const hr = H(i + 1, j), hd = H(i, j + 1)
      const rocky = face === FACE.rock, sandy = face === FACE.sand
      // The two faces we can see, with a lip of grass (or snow) along the top.
      // A run of faces reads as one wall: ink only along its top and foot and
      // up the corners that stick out, not at every tile; the rock's layers
      // sit at the same heights everywhere, so each runs on from tile to tile,
      // with a ledge at every terrace; and the foot is darker, wet at the sea.
      const detail = (hi: number, lo: number, along: (u: number, z: number) => [number, number]) => {
        const tall = hi - lo
        ink += seg(along(0, hi), along(1, hi)) + seg(along(0, lo), along(1, lo))
        const b = Math.min(6, tall * 0.42)
        foot += quad([along(0, lo + b), along(1, lo + b), along(1, lo), along(0, lo)])
        if (lo <= SEA) wetFoot += quad([along(0, SEA + 2.6), along(1, SEA + 2.6), along(1, SEA), along(0, SEA)])
        if (sandy) return
        for (let z = Math.ceil((lo + 2) / 2) * 2; z < hi - 2.5; z += 2) {
          const m = ((z % 12) + 12) % 12
          if (m === 0 && rocky) { ledge += seg(along(0, z - 1.2), along(1, z - 1.2)); ledgeHi += seg(along(0, z), along(1, z)); continue }
          if (rocky ? m % 4 !== 0 : m !== 6) continue
          // Gaps in a layer, so it weathers rather than ruling a line.
          const g0 = hz(i, j, z), g1 = hz(j, i, z + 1)
          if (g0 < 0.18) continue
          strata += g1 < 0.3 ? seg(along(0, z), along(0.55, z)) : g1 > 0.8 ? seg(along(0.4, z), along(1, z)) : seg(along(0, z), along(1, z))
        }
        if (rocky && tall >= 10 && R() < 0.7) { const p = along(0.2 + R() * 0.6, lo + tall * (0.25 + R() * 0.4)); strata += `M${f(p[0])} ${f(p[1])}l1.5 -4l-1 -3` }
      }
      // A corner's ink, less whatever part of it the next face along shares.
      const corner = (pt: (z: number) => [number, number], lo: number, hi: number, ni: number, nj: number, ai: number, aj: number) => {
        const shared = isLand(ni, nj) && H(ai, aj) < H(ni, nj) ? [Math.max(lo, H(ai, aj)), Math.min(hi, H(ni, nj))] : null
        const parts: [number, number][] = shared && shared[0] < shared[1] ? [[lo, shared[0]], [shared[1], hi]] : [[lo, hi]]
        for (const [a, b] of parts) if (b - a > 0.3) ink += seg(pt(a), pt(b))
      }
      if (hr < h) {
        add(cliffs, face[0], quad([P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hr), P(i + 1, j, hr)]))
        if (lip) add(lips, lip, snowy ? drip((u, z) => P(i + 1, j + u, z), h, i * 7 + j) : quad([P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1, j + 1, h - 2.6), P(i + 1, j, h - 2.6)]))
        detail(h, hr, (u, z) => P(i + 1, j + u, z))
        corner((z) => P(i + 1, j + 1, z), hr, h, i, j + 1, i + 1, j + 1)
        corner((z) => P(i + 1, j, z), hr, h, i, j - 1, i + 1, j - 1)
      }
      if (hd < h) {
        add(cliffs, face[1], quad([P(i, j + 1, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hd), P(i, j + 1, hd)]))
        if (lip) add(lips, lip, snowy ? drip((u, z) => P(i + u, j + 1, z), h, i + j * 5) : quad([P(i, j + 1, h), P(i + 1, j + 1, h), P(i + 1, j + 1, h - 2.6), P(i, j + 1, h - 2.6)]))
        detail(h, hd, (u, z) => P(i + u, j + 1, z))
        corner((z) => P(i + 1, j + 1, z), hd, h, i + 1, j, i + 1, j + 1)
        corner((z) => P(i, j + 1, z), hd, h, i - 1, j, i - 1, j + 1)
      }
      // The river: a channel across the top, and a fall down every step.
      if (wet.has(k)) {
        const first = river[0][0] === i && river[0][1] === j, j0 = first ? 0.3 : 0
        wetTop += quad([P(i + 0.32, j + j0, h), P(i + 0.68, j + j0, h), P(i + 0.68, j + 1, h), P(i + 0.32, j + 1, h)])
        wetHi += seg(P(i + 0.42, j + j0 + 0.08, h), P(i + 0.42, j + 0.95, h))
        if (first) { const [px, py] = P(i + 0.5, j + 0.32, h); wetTop += ring(px, py, 14, 7) }
        if (hd < h) {
          wetFall += quad([P(i + 0.32, j + 1, h), P(i + 0.68, j + 1, h), P(i + 0.68, j + 1, hd), P(i + 0.32, j + 1, hd)])
          let st = ''
          for (const u of [0.41, 0.5, 0.59]) st += seg(P(i + u, j + 1, h - 1), P(i + u, j + 1, hd + 1))
          const [ax, ay] = P(i + 0.32, j + 1, h), [bx2, by2] = P(i + 0.68, j + 1, hd)
          fallStreaks.push({ d: st, b: `${f(Math.min(ax, bx2))} ${f(Math.min(ay, by2))} ${f(Math.max(ax, bx2))} ${f(Math.max(ay, by2))}` })
          const [sx, sy] = P(i + 0.5, j + 1.1, hd)
          splash += ring(sx, sy, 9, 3.8) + ring(sx - 9, sy - 2, 3, 2) + ring(sx + 9, sy + 1, 2.6, 1.7)
        }
      }
    }
    for (const [c, d] of tops) ground.add(new N('path', { d, fill: c, stroke: seamless.has(c) ? c : shade(c, 0.95), 'stroke-width': 0.7 }))
    if (wetSand) { ground.add(new N('path', { d: wetSand, fill: '#dccfae' })); wetSand = '' }
    for (const [c, d] of cliffs) ground.add(new N('path', { d, fill: c, stroke: c, 'stroke-width': 0.7, 'stroke-linejoin': 'round' }))
    if (foot) ground.add(new N('path', { d: foot, fill: INK, opacity: 0.13 }))
    if (wetFoot) ground.add(new N('path', { d: wetFoot, fill: '#3b4f9e', opacity: 0.3 }))
    for (const [c, d] of lips) ground.add(new N('path', { d, fill: c }))
    if (strata) ground.add(new N('path', { d: strata, fill: 'none', stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.22 }))
    if (ledge) ground.add(new N('path', { d: ledge, fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.22 }))
    if (ledgeHi) ground.add(new N('path', { d: ledgeHi, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0.45 }))
    if (ink) ground.add(new N('path', { d: ink, fill: 'none', stroke: INK, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
    if (wetTop) ground.add(new N('path', { d: wetTop, fill: '#8fd3ff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
    if (wetHi) ground.add(new N('path', { d: wetHi, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.75 }))
    if (wetFall) ground.add(new N('path', { d: wetFall, fill: '#b9e6ff', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }))
  }
  // Where each fall lands, after the step below it is down.
  ground.add(new N('path', { d: splash, fill: '#ffffff', stroke: INK, 'stroke-width': 1 }))
  // The falls' white water, running down: only these few strokes move.
  for (const st of fallStreaks) ground.add(new N('path', { d: st.d, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': '4 5', class: 'fall amb', 'data-b': st.b }))
  // The outline of the whole island's edge, drawn once, so the coast reads.
  let edge = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j)) continue
    const h = height[i][j]
    const seg = (a: [number, number, number], b: [number, number, number]) => { const p1 = P(...a), p2 = P(...b); edge += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
    if (!isLand(i - 1, j)) seg([i, j, h], [i, j + 1, h])
    if (!isLand(i, j - 1)) seg([i, j, h], [i + 1, j, h])
  }
  ground.add(new N('path', { d: edge, fill: 'none', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' }))

  // Roads: a verge, a surface, a dashed middle line.
  const roads = root.add(new N('g', { class: 'roads' }))
  const toPlane = (r: [number, number][]) => `M${r.map(([i, j]) => `${i + 0.5} ${j + 0.5}`).join('L')}`
  const [ox, oy] = P(0, 0)
  const plane = roads.add(new N('g', { transform: `translate(${f(ox)} ${f(oy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
  const rd = routes.map(toPlane).join('')
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#c9cfe6', 'stroke-width': 0.66, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#f3f5fb', 'stroke-width': 0.56, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
  plane.add(new N('path', { d: rd, fill: 'none', stroke: '#c9cfe6', 'stroke-width': 0.035, 'stroke-dasharray': '0.14 0.16' }))

  // The pond, laid flat in the park: a sandy rim, deep middle, lily pads.
  if (pond.size) {
    const cells = [...pond].map((k) => k.split(',').map(Number))
    const i0 = Math.min(...cells.map((c) => c[0])), i1 = Math.max(...cells.map((c) => c[0])) + 1
    const j0 = Math.min(...cells.map((c) => c[1])), j1 = Math.max(...cells.map((c) => c[1])) + 1
    const po = plane.add(new N('g', { class: 'pond' }))
    const rr = (x0: number, y0: number, x1: number, y1: number, r: number, a: Record<string, string | number>) => po.add(new N('rect', { x: f2(x0), y: f2(y0), width: f2(x1 - x0), height: f2(y1 - y0), rx: r, ...a }))
    rr(i0 + 0.08, j0 + 0.1, i1 - 0.08, j1 - 0.1, 0.62, { fill: SAND[1], stroke: INK, 'stroke-width': 0.035 })
    rr(i0 + 0.2, j0 + 0.22, i1 - 0.2, j1 - 0.22, 0.52, { fill: '#9fdcff', stroke: INK, 'stroke-width': 0.03 })
    rr(i0 + 0.42, j0 + 0.5, i1 - 0.4, j1 - 0.55, 0.36, { fill: '#7cc8fb' })
    po.add(new N('path', { d: `M${f2(i0 + 0.3)} ${f2(j0 + 0.9)}q0 -0.5 0.5 -0.58`, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.06, 'stroke-linecap': 'round', opacity: 0.8 }))
    for (const [u, v, r] of [[0.3, 0.55, 0.13], [0.62, 0.32, 0.1], [0.75, 0.7, 0.12], [0.38, 0.82, 0.09]]) {
      const x = i0 + 0.2 + (i1 - i0 - 0.4) * u, y = j0 + 0.22 + (j1 - j0 - 0.44) * v
      po.add(new N('path', { d: `M${f2(x)} ${f2(y)}L${f2(x + r)} ${f2(y - r * 0.3)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(x + r)} ${f2(y + r * 0.3)}Z`, fill: '#3fcf9f', stroke: INK, 'stroke-width': 0.025 }))
    }
    const [fx2, fy2] = [i0 + 0.2 + (i1 - i0 - 0.4) * 0.62, j0 + 0.22 + (j1 - j0 - 0.44) * 0.32]
    po.add(new N('circle', { cx: f2(fx2 + 0.03), cy: f2(fy2), r: 0.045, fill: '#ffc4d4', stroke: INK, 'stroke-width': 0.02 }))
  }

  // The dry wash: dark banks, a pale bed of dried mud cracked into plates,
  // and a scatter of pebbles the last flood left behind.
  if (wash) {
    const wg = plane.add(new N('g', { class: 'wash' }))
    let d = `M${wash[0][0]} ${wash[0][1]}`
    for (let k = 1; k < wash.length; k++) { const [a, b] = wash[k - 1], [c, e] = wash[k]; d += `Q${f2(a)} ${f2(b)} ${f2((a + c) / 2)} ${f2((b + e) / 2)}` }
    d += `L${wash[wash.length - 1][0]} ${wash[wash.length - 1][1]}`
    wg.add(new N('path', { d, fill: 'none', stroke: '#a99cd2', 'stroke-width': 0.56, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d, fill: 'none', stroke: '#e6e0f2', 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d, fill: 'none', stroke: '#d9d1ec', 'stroke-width': 0.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    let cr = '', pb = ''
    for (let k = 0; k < wash.length - 1; k++) {
      const [a, b] = wash[k], [c, e] = wash[k + 1]
      for (let q = 0; q < 3; q++) {
        const t = (q + 0.5) / 3, u = a + (c - a) * t, v = b + (e - b) * t, o = (hz(k, q, 4) - 0.5) * 0.24
        const nx = -(e - b), ny = c - a, L = Math.hypot(nx, ny) || 1, px = u + (nx / L) * o, py = v + (ny / L) * o
        cr += `M${f2(px - 0.07)} ${f2(py)}l0.05 -0.06l0.08 0.02l0.04 0.07`
        pb += `M${f2(px + 0.1)} ${f2(py + 0.05)}a0.025 0.025 0 1 0 0.05 0a0.025 0.025 0 1 0 -0.05 0`
      }
    }
    wg.add(new N('path', { d: cr, fill: 'none', stroke: '#b7aada', 'stroke-width': 0.022, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
    wg.add(new N('path', { d: pb, fill: '#a59ad3', stroke: INK, 'stroke-width': 0.012 }))
  }

  // Zebra crossings on the roads into the busiest junctions.
  {
    let n = 0
    for (let i = 0; i < GRID && n < 9; i++) for (let j = 0; j < GRID && n < 9; j++) {
      if (!road.has(key(i, j)) || !['oldtown', 'market', 'funfair', 'harbour'].includes(dist[i][j].key)) continue
      const out = [[1, 0], [0, 1], [-1, 0], [0, -1]].filter(([a, b]) => road.has(key(i + a, j + b)))
      if (out.length < 3) continue
      const [a, b] = out[(i + j) % out.length]
      // The crossing sits on the arm, its stripes along the road.
      crossing(new Pen(root), i + a * 0.95 + 0.5, j + b * 0.95 + 0.5, a !== 0 ? 'y' : 'x')
      n++
    }
  }

  // Every building throws a soft shadow the way everything else does: the
  // sun is behind the island on the right, so shadows fall towards the
  // front left, on the side of each building that is in shade. Longer the
  // taller it is, measured by drawing the building once into nothing.
  {
    const keep = motionCss.length
    const sg = root.add(new N('g', { class: 'shadows', transform: `translate(${f(ox)} ${f(oy)}) matrix(${S / 2} ${S / 4} ${-S / 2} ${S / 4} 0 0)` }))
    for (const pl of placed) {
      if (pl.lm.water) continue
      const b = new Bounds()
      pl.lm.draw(new Pen(new N('g'), pl.i, pl.j, pl.z, b, []))
      const [, footY] = P(pl.i + pl.w / 2, pl.j + pl.d / 2, pl.z)
      const L = Math.min(2.4, Math.max(0.3, (footY - b.y0) / 80))
      const x0 = pl.i + 0.06, y0 = pl.j + 0.06, x1 = pl.i + pl.w - 0.06, y1 = pl.j + pl.d - 0.06
      for (const [k, op] of [[1, 0.07], [0.55, 0.07]]) {
        const a = L * k * 0.5
        const d = `M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y0)}L${f2(x1)} ${f2(y1)}L${f2(x1 - a)} ${f2(y1 + a)}L${f2(x0 - a)} ${f2(y1 + a)}L${f2(x0 - a)} ${f2(y0 + a)}Z`
        sg.add(new N('path', { d, fill: INK, stroke: INK, 'stroke-width': 0.14, 'stroke-linejoin': 'round', opacity: op }))
      }
    }
    motionCss.length = keep
  }

  // Grass tufts and flower dots, merged into a handful of paths.
  const tufts = new Map<string, string>()
  const filled = (c: string) => c.startsWith('#ff') || c === '#c6b6ff' || c === '#b3acd8'
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const k0 = key(i, j)
    if (!isLand(i, j) || taken.has(k0) || road.has(k0) || wet.has(k0) || pond.has(k0) || reserved.has(k0)) continue
    const d = dist[i][j], h = height[i][j]
    // Shells and pebbles on the beaches.
    if (beach.has(k0)) {
      for (let k = 0; k < 2; k++) {
        const [x, y] = P(i + 0.15 + R() * 0.7, j + 0.15 + R() * 0.7, h)
        const col = R() < 0.5 ? '#ffffff' : d.key === 'badlands' ? '#b3acd8' : '#ffc9d6'
        tufts.set(col, (tufts.get(col) ?? '') + (R() < 0.5 ? `M${f(x - 1.8)} ${f(y)}a1.8 1.2 0 1 0 3.6 0a1.8 1.2 0 1 0 -3.6 0` : `M${f(x - 2)} ${f(y)}q2 -3.5 4 0z`))
      }
      continue
    }
    // The Badlands are dry: the ground is cracked into plates.
    if (d.key === 'badlands') {
      if (h === 0 && R() < 0.75) {
        const u = i + 0.2 + R() * 0.5, v = j + 0.2 + R() * 0.5
        const pts = [[u, v], [u + 0.12, v + 0.1], [u + 0.1, v + 0.24], [u + 0.26, v + 0.3]].map(([a, b]) => P(a, b, h))
        const [bx2, by2] = P(u + 0.12, v + 0.1, h), [cx2, cy2] = P(u + 0.22, v + 0.02, h)
        const crack = `M${pts.map((p) => p.map(f).join(' ')).join('L')}M${f(bx2)} ${f(by2)}L${f(cx2)} ${f(cy2)}`
        tufts.set('crack', (tufts.get('crack') ?? '') + crack)
      }
      if (h === 0 && hz(i, j, 11) < 0.5) {
        const u = i + 0.15 + hz(i, j, 12) * 0.45, v = j + 0.2 + hz(j, i, 13) * 0.5
        let rp = ''
        for (let q = 0; q < 3; q++) { const [a1, b1] = P(u + q * 0.08, v - q * 0.05, h), [a2, b2] = P(u + q * 0.08 + 0.3, v - q * 0.05 + 0.06, h); rp += `M${f(a1)} ${f(b1)}Q${f((a1 + a2) / 2)} ${f((b1 + b2) / 2 - 2)} ${f(a2)} ${f(b2)}` }
        tufts.set('ripple', (tufts.get('ripple') ?? '') + rp)
      }
      continue
    }
    if (h < 0) continue
    // Tufts of three kinds, and flowers where the meadow is lightest.
    const bright = field(i, j) > 0.62
    for (let k = 0; k < (bright ? 3 : 2); k++) {
      const [x, y] = P(i + 0.15 + R() * 0.7, j + 0.15 + R() * 0.7, h)
      const r = R()
      const col = bright && r < 0.45 ? (R() < 0.35 ? '#ffffff' : R() < 0.6 ? '#ffb3c2' : '#c6b6ff') : r < 0.12 ? '#ffffff' : shade(d.ground[0], 0.78)
      const isFlower = filled(col)
      const kind = R()
      tufts.set(col, (tufts.get(col) ?? '') + (isFlower ? `M${f(x - 1.6)} ${f(y)}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0` : kind < 0.45 ? `M${f(x - 3)} ${f(y)}l1.5 -3.5l1.5 3.5l1.5 -4l1.5 4` : kind < 0.8 ? `M${f(x - 2)} ${f(y)}q-0.5 -4 -2 -6M${f(x)} ${f(y)}v-7M${f(x + 2)} ${f(y)}q0.5 -4 2 -6` : `M${f(x - 2.5)} ${f(y)}q2.5 -4 5 0`))
    }
  }
  const tuftG = root.add(new N('g', { class: 'tufts' }))
  for (const [c, d] of tufts) tuftG.add(new N('path', c === 'crack' ? { d, fill: 'none', stroke: '#9d95c9', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : c === 'ripple' ? { d, fill: 'none', stroke: '#ebe5f6', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.9 } : filled(c) ? { d, fill: c, stroke: INK, 'stroke-width': 0.5 } : { d, fill: 'none', stroke: c, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))

  // Fields, laid flat: lavender under Sky Peaks, wheat on the Proving
  // Grounds, an allotment by the harbour.
  for (const [i, j, w, d, kind] of fields) cropField(new Pen(root), i, j, w, d, kind)

  // People walking the roads, there and back.
  root = open('walkers')
  const walkers = root.add(new N('g', { class: 'walkers' }))
  const shirts = [C.rasp, C.cobalt, C.lilac, C.mint, C.sky, '#ffffff', C.slate]
  routes.forEach((r, n) => {
    if (r.length < 4) return
    for (let k = 0; k < 2; k++) {
      const side = k ? 0.14 : -0.14
      const pts = r.map(([i, j]) => P(i + 0.5 + side, j + 0.5 - side))
      const name = `walk${walkers.kids.length}`
      motionPath(name, k ? [...pts].reverse() : pts, { back: true })
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
      const g = walkers.add(new N('g', { class: 'walker mover', 'data-b': `${f(Math.min(...xs))} ${f(Math.min(...ys))} ${f(Math.max(...xs))} ${f(Math.max(...ys))}`, style: `animation:${name} ${f(r.length * 2.6 + R() * 8)}s linear infinite ${f(-R() * 30)}s` }))
      g.add(walkerFigure(shirts[(n * 2 + k) % shirts.length]))
    }
  })

  // Traffic: cars, a bus and bikes up and down the longest straight roads.
  {
    const runs: [number, number][][] = []
    for (const r of routes) {
      let cur: [number, number][] = [r[0]]
      for (let n = 1; n < r.length; n++) {
        const d0 = cur.length > 1 ? [cur[1][0] - cur[0][0], cur[1][1] - cur[0][1]] : null
        const d1 = [r[n][0] - r[n - 1][0], r[n][1] - r[n - 1][1]]
        if (d0 && (d0[0] !== d1[0] || d0[1] !== d1[1])) { runs.push(cur); cur = [r[n - 1]] }
        cur.push(r[n])
      }
      runs.push(cur)
    }
    const seen = new Set<string>()
    const long = runs.filter((r) => r.length >= 5).sort((a, b) => b.length - a.length).filter((r) => { const k = r.map((c) => key(...c)); if (k.some((x) => seen.has(x))) return false; k.forEach((x) => seen.add(x)); return true }).slice(0, 6)
    const kinds: ['car' | 'bus' | 'bike', string][] = [['car', C.rasp], ['bus', C.cobalt], ['car', C.mint], ['bike', C.rasp], ['car', '#ffffff'], ['bike', C.cobalt]]
    long.forEach((r, n) => {
      const [kind, body] = kinds[n % kinds.length]
      const a0 = r[0], b0 = r[r.length - 1]
      const axis: 'x' | 'y' = a0[0] !== b0[0] ? 'x' : 'y'
      walkers.add(shuttle(kind, body, P(a0[0] + 0.5, a0[1] + 0.5), P(b0[0] + 0.5, b0[1] + 0.5), axis, `drive${n}`, r.length * (kind === 'bike' ? 3.2 : 2) + 4, n * 3.3))
    })
  }

  // Two ducks going round the pond.
  if (pond.size) {
    const loop = (ri: number, rj: number): [number, number][] => Array.from({ length: 20 }, (_, k) => { const a = (k / 20) * Math.PI * 2; return P(15 + Math.cos(a) * ri, 10.5 + Math.sin(a) * rj) })
    walkers.add(duck(loop(0.42, 0.85), 'duck0', 26, 0))
    walkers.add(duck(loop(0.3, 0.6).reverse(), 'duck1', 19, 7, '#b9a6ff'))
  }

  /* ---- everything standing up, back to front ---------------------------- */
  type Thing = { depth: number; slug?: string; draw: (g: N) => void }
  const things: Thing[] = []
  const anchors: Record<string, Anchor> = {}
  const link = new Map(games.map((g) => [g.slug, g]))
  const cx = GRID / 2
  for (const pl of placed) {
    const g = link.get(pl.slug)
    things.push({ depth: pl.i + pl.j + (pl.w + pl.d) / 2 + 0.01, slug: pl.slug, draw: (layer) => {
      const a = layer.add(new N('a', { class: 'lm', href: g?.href ?? `/${pl.slug}/`, 'data-slug': pl.slug, 'aria-label': g ? `${g.title}: ${g.blurb}` : pl.slug, style: `--d:${Math.round(Math.hypot(pl.i + pl.w / 2 - cx, pl.j + pl.d / 2 - cx) * 45)}ms` }))
      // The ring that shows under a building when it is picked.
      const [rx, ry] = P(pl.i, pl.j, pl.z)
      a.add(new N('path', { class: 'lm-ring', d: quad([P(pl.i - 0.08, pl.j - 0.08, pl.z), P(pl.i + pl.w + 0.08, pl.j - 0.08, pl.z), P(pl.i + pl.w + 0.08, pl.j + pl.d + 0.08, pl.z), P(pl.i - 0.08, pl.j + pl.d + 0.08, pl.z)]), fill: '#ffffff', 'fill-opacity': 0.35, stroke: '#ffffff', 'stroke-width': 3, 'stroke-dasharray': '6 6' }))
      void rx; void ry
      const art = a.add(new N('g', { class: 'lm-art', id: `lm-${pl.slug}` }))
      const b = new Bounds()
      const lp = new Pen(art, pl.i, pl.j, pl.z, b, lights)
      pl.lm.draw(lp)
      const [bx, by] = P(pl.i + pl.w / 2, pl.j + pl.d / 2, pl.z)
      anchors[pl.slug] = { slug: pl.slug, district: pl.district, x0: f(b.x0), y0: f(b.y0), x1: f(b.x1), y1: f(b.y1), bx: f(bx), by: f(by), foot: [P(pl.i, pl.j, pl.z), P(pl.i + pl.w, pl.j, pl.z), P(pl.i + pl.w, pl.j + pl.d, pl.z), P(pl.i, pl.j + pl.d, pl.z)].map((q) => q.map(f).join(',')).join(' ') }
    } })
  }
  /* ---- the wild things and the farm ---------------------------------------- */
  const at = (i: number, j: number, depth: number, fn: (p: Pen) => void, z = height[Math.floor(i)]?.[Math.floor(j)] ?? 0) => things.push({ depth, draw: (layer) => fn(new Pen(layer, 0, 0, z, new Bounds(), lights)) })
  if (mill) at(mill[0] + 0.5, mill[1] + 0.5, mill[0] + mill[1] + 1, (p) => windmill(p, mill[0] + 0.5, mill[1] + 0.5))
  for (const [i, j] of bales) for (const [u, v] of [[0.35, 0.4], [0.65, 0.62]]) at(i + u, j + v, i + j + u + v, (p) => bale(p, i + u, j + v))
  if (archAt) at(archAt[0] + 0.5, archAt[1] + 0.5, archAt[0] + archAt[1] + 1, (p) => arch(p, archAt[0] + 0.5, archAt[1] + 0.5))
  for (const [i, j, h] of buttes) at(i + 0.5, j + 0.5, i + j + 1, (p) => butte(p, i + 0.5, j + 0.5, h))
  for (const [n, [i, j]] of hoodoos.entries()) for (const [u, v, h, k] of [[0.38, 0.4, 44 - n * 6, 1], [0.66, 0.56, 30, 0.8], [0.4, 0.74, 22, 0.7]] as [number, number, number, number][]) at(i + u, j + v, i + j + u + v, (p) => hoodoo(p, i + u, j + v, h, k))
  for (const [n, [i, j]] of boulderAt.entries()) at(i + 0.5, j + 0.5, i + j + 1, (p) => boulders(p, i + 0.5, j + 0.5, 0.85 + (n % 2) * 0.25))
  // Sheep graze the low slopes of Sky Peaks; deer stand at the forest edge.
  ;[[10.5, 3.4, false], [10.35, 5.3, true], [11.45, 6.6, false], [9.55, 9.55, true], [10.6, 7.7, false]].forEach(([i, j, flip], n) => {
    if (!free(Math.floor(i as number), Math.floor(j as number))) return
    at(i as number, j as number, (i as number) + (j as number), (p) => sheep(p, i as number, j as number, flip as boolean, n * 1.7))
  })
  ;[[8.5, 9.45, false], [6.45, 1.5, true]].forEach(([i, j, flip], n) => {
    if (!free(Math.floor(i as number), Math.floor(j as number))) return
    at(i as number, j as number, (i as number) + (j as number), (p) => deer(p, i as number, j as number, flip as boolean, n * 3))
  })
  for (const [i, j] of [[10.5, 2.5], [12.5, 7.5], [4.6, 1.5]]) if (free(Math.floor(i), Math.floor(j))) at(i, j, i + j, (p) => toadstools(p, i, j))
  // Reeds round the pond and along the river's banks.
  for (const [i, j] of [[14.22, 9.25], [15.8, 11.72], [14.2, 11.75], [15.82, 9.3], [7.12, 6.5], [7.86, 9.4], [7.85, 5.3], [7.14, 10.6]]) at(i, j, i + j, (p) => reeds(p, i, j, 0.85))
  // Crabs on the beaches, a tumbleweed in the Badlands.
  ;[[8.5, 13.5], [24.5, 24.6], [13.5, 27.5], [3.5, 17.4]].forEach(([i, j], n) => { if (beach.has(key(Math.floor(i), Math.floor(j)))) at(i, j, i + j, (p) => crab(p, i, j, n * 2.3)) })
  if (free(23, 7) || isLand(23, 7)) at(23.5, 6.5, 30, (p) => tumbleweed(p, 23.5, 6.5, 2))
  // Butterflies over the brightest meadows.
  {
    let made = 0
    const cols = ['#ff9fb2', C.lilac, '#ffffff', C.sky, '#ffd1da']
    for (let i = 0; i < GRID && made < 9; i++) for (let j = 0; j < GRID && made < 9; j++) {
      const d = dist[i][j]
      if (!free(i, j) || height[i][j] !== 0 || coast(i, j) || field(i, j) < 0.66 || !['oldtown', 'funfair', 'market', 'proving'].includes(d.key)) continue
      if ((i * 13 + j * 7) % 5) continue
      const c = cols[made % cols.length], n = made++
      at(i + 0.5, j + 0.5, i + j + 1.5, (p) => butterfly(p, i + 0.5, j + 0.5, 18, c, n * 1.3))
    }
  }
  // Hedges along Old Town's roads, and a topiary or two.
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!road.has(key(i, j)) || dist[i][j].key !== 'oldtown') continue
    for (const [a, b] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const ni = i + a, nj = j + b
      if (!free(ni, nj) || height[ni][nj] !== 0 || coast(ni, nj) || (i * 5 + j * 3 + a * 7 + b * 11) % 3) continue
      // A hedge on the free side of the shared edge, a little in from it.
      const e = 0.12
      if (a === 1) at(ni + e, nj + 0.5, ni + nj + 0.6, (p) => hedge(p, ni + e, nj + 0.12, ni + e, nj + 0.88))
      else if (a === -1) at(ni + 1 - e, nj + 0.5, ni + nj + 1.4, (p) => hedge(p, ni + 1 - e, nj + 0.12, ni + 1 - e, nj + 0.88))
      else if (b === 1) at(ni + 0.5, nj + e, ni + nj + 0.6, (p) => hedge(p, ni + 0.12, nj + e, ni + 0.88, nj + e))
      else at(ni + 0.5, nj + 1 - e, ni + nj + 1.4, (p) => hedge(p, ni + 0.12, nj + 1 - e, ni + 0.88, nj + 1 - e))
      reserved.add(key(ni, nj))
    }
  }
  for (const [i, j] of [[12.3, 12.4], [12.7, 12.6], [17.3, 13.3], [10.4, 13.6]]) if (free(Math.floor(i), Math.floor(j)) && height[Math.floor(i)][Math.floor(j)] === 0) at(i, j, i + j, (p) => topiary(p, i, j, 0.9))

  /* ---- town life ------------------------------------------------------------ */
  // Filler is quieter than the games: paler roofs, no raspberry, so the
  // buildings you can play stand out from the houses between them.
  const ROOFS = ['#9fb5f2', '#c3b3f3', '#8fd9c4', '#a9cdf5', '#d6b9e6', '#b3c4e8']
  const WALLS = ['#ffffff', '#f6f8fd', '#f2f6fd', '#f6f3fd']
  // Little houses between the big ones, each with its door to a road we can
  // see (the +x or +y side), kept a tile clear of every building.
  {
    let made = 0
    const nearLm = (i: number, j: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => taken.has(key(i + a, j + b)))
    const homes = new Set<string>()
    const nearHome = (i: number, j: number) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (homes.has(key(i + a, j + b))) return true; return false }
    for (let s = 0; s < GRID * 2 && made < 16; s++) for (let i = 0; i < GRID && made < 16; i++) {
      const j = s - i
      if (j < 0 || j >= GRID || !free(i, j) || height[i][j] !== 0 || coast(i, j) || nearLm(i, j) || nearHome(i, j)) continue
      if (!['oldtown', 'market', 'harbour', 'funfair', 'proving'].includes(dist[i][j].key)) continue
      const door: 'x' | 'y' | null = road.has(key(i + 1, j)) ? 'x' : road.has(key(i, j + 1)) ? 'y' : null
      if (!door) continue
      reserved.add(key(i, j)); homes.add(key(i, j))
      const n = made++
      const roof = ROOFS[n % ROOFS.length], wall = WALLS[n % WALLS.length]
      at(i + 0.5, j + 0.5, i + j + 1, (p) => cottage(p, i + 0.45, j + 0.45, { wall, roof, door, smoke: n % 3 === 0 }))
      if (n % 2 === 0) at(i + 0.9, j + 0.88, i + j + 1.8, (p) => (door === 'x' ? postbox(p, i + 0.9, j + 0.85) : postbox(p, i + 0.85, j + 0.9)))
      else at(i + 0.82, j + 0.14, i + j + 0.96, (p) => flowers(p, i + 0.82, j + 0.16))
    }
  }
  // Signposts at the busiest crossroads, a bus stop, and a fountain.
  {
    const tint = (k: DistrictKey) => shade(D(k).tint, 0.85)
    let posts = 0
    for (let i = 0; i < GRID && posts < 4; i++) for (let j = 0; j < GRID && posts < 4; j++) {
      if (!road.has(key(i, j))) continue
      const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => road.has(key(i + a, j + b)))
      if (out.length < 3) continue
      // The free corner beside the junction.
      const corner = [[1, 1], [-1, 1], [1, -1], [-1, -1]].find(([a, b]) => free(i + a, j + b) && height[i + a][j + b] === 0 && !coast(i + a, j + b))
      if (!corner) continue
      const [ci, cj] = [i + corner[0], j + corner[1]]
      const arms = out.slice(0, 3).map(([a, b]) => ({ dx: a, dy: b, c: tint(dist[i + a * 3]?.[j + b * 3]?.key ?? dist[i][j].key) }))
      posts++
      at(ci + 0.5 - corner[0] * 0.3, cj + 0.5 - corner[1] * 0.3, ci + cj + 1 - (corner[0] + corner[1]) * 0.3, (p) => signpost(p, ci + 0.5 - corner[0] * 0.3, cj + 0.5 - corner[1] * 0.3, arms))
      reserved.add(key(ci, cj))
    }
  }
  const spot = (cands: [number, number][], fn: (i: number, j: number) => void, ok = (i: number, j: number) => height[i][j] === 0 && !coast(i, j)) => {
    for (const [i, j] of cands) if (free(i, j) && ok(i, j)) { reserved.add(key(i, j)); fn(i, j); return true }
    return false
  }
  spot([[13, 16], [16, 13], [12, 13], [11, 17], [13, 11]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => fountain(p, i + 0.5, j + 0.5)))
  spot([[16, 16], [16, 15], [16, 17], [12, 14], [9, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => busStop(p, i + 0.5, j + 0.45)), (i, j) => height[i][j] === 0 && [[1, 0], [0, 1], [-1, 0], [0, -1]].some(([a, b]) => road.has(key(i + a, j + b))))
  // The park: a picnic, someone flying a kite, a playground.
  spot([[16, 18], [16, 14], [12, 15], [11, 13]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => picnic(p, i + 0.5, j + 0.5, [C.cobalt, C.rasp])))
  spot([[16, 17], [17, 17], [13, 19], [12, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => kiteFlyer(p, i + 0.5, j + 0.5, C.lilac, C.rasp, 1)))
  spot([[11, 18], [12, 19], [13, 15], [17, 16]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => playground(p, i + 0.5, j + 0.5)))
  spot([[13, 22], [12, 21], [10, 23], [16, 23]], (i, j) => at(i + 0.5, j + 0.5, i + j + 1, (p) => kiteFlyer(p, i + 0.5, j + 0.5, C.mint, C.cobalt, 4)))
  // A campsite high on the peaks: two tents round a fire.
  {
    const cells: [number, number][] = [[3, 4], [3, 5], [2, 5]]
    const ok = cells.filter(([i, j]) => free(i, j))
    if (ok.length === cells.length) {
      ok.forEach(([i, j]) => reserved.add(key(i, j)))
      at(3.35, 4.4, 7.75, (p) => tent(p, 3.35, 4.4, C.rasp))
      at(2.6, 5.5, 8.1, (p) => tent(p, 2.6, 5.5, '#35c9a6'))
      at(3.5, 5.5, 9.0, (p) => campfire(p, 3.5, 5.45))
      at(3.75, 5.85, 9.6, (p) => sitter(p, 3.75, 5.85, C.cobalt, '#e0b899'))
    }
  }
  // The beaches: umbrellas and towels, a sandcastle, surfboards, the lifeguard.
  {
    const sandy = [...beach].map((k) => k.split(',').map(Number) as [number, number]).filter(([i, j]) => dist[i][j].key !== 'badlands' && dist[i][j].key !== 'peaks')
    sandy.sort((a, b) => (a[0] * 31 + a[1] * 17) % 11 - (b[0] * 31 + b[1] * 17) % 11)
    let n = 0
    const towels = ['#ff9fb2', C.cobalt, C.mint, C.lilac, C.sky]
    for (const [i, j] of sandy) {
      if (n >= 11 || reserved.has(key(i, j))) continue
      const z = height[i][j], kind = n % 4
      reserved.add(key(i, j))
      const m = n++
      if (kind === 0 || kind === 2) { at(i + 0.4, j + 0.45, i + j + 0.85, (p) => umbrella(p, i + 0.4, j + 0.45, ROOFS[m % ROOFS.length]), z); at(i + 0.62, j + 0.6, i + j + 1.0, (p) => towel(p, i + 0.62, j + 0.6, towels[m % towels.length], m % 2 ? 'x' : 'y'), z) }
      else if (kind === 1) at(i + 0.5, j + 0.5, i + j + 1, (p) => (m === 1 ? lifeguard(p, i + 0.5, j + 0.5) : sandcastle(p, i + 0.5, j + 0.5)), z)
      else { at(i + 0.4, j + 0.4, i + j + 0.8, (p) => surfboard(p, i + 0.4, j + 0.4, ROOFS[(m + 2) % ROOFS.length]), z); at(i + 0.6, j + 0.55, i + j + 1.15, (p) => towel(p, i + 0.6, j + 0.55, towels[(m + 1) % towels.length]), z); at(i + 0.62, j + 0.58, i + j + 1.2, (p) => sitter(p, i + 0.62, j + 0.58, '#ffffff', '#c99a78'), z) }
    }
  }
  // Piers out from the beaches, each with someone fishing off the end.
  for (const pts of PIERS) things.push({ depth: pts[0][0] + pts[0][1] + 0.4, draw: (layer) => pier(new Pen(layer), pts, BEACH + 1, C.rasp) })

  // Trees, rocks and the odd lamp or bench, on the land left over.
  const treeKind = (d: District, coastal: boolean): TreeKind => {
    if (coastal && d.key === 'peaks') return R() < 0.7 ? 'pine' : 'rock'
    if (coastal) return d.key === 'badlands' ? 'rock' : 'palm'
    const r = R()
    if (d.key === 'peaks') return r < 0.8 ? 'pine' : 'rock'
    if (d.key === 'badlands') return r < 0.55 ? 'rock' : r < 0.8 ? 'snag' : 'bush'
    if (d.key === 'oldtown') return r < 0.4 ? 'blossom' : r < 0.75 ? 'round' : 'cypress'
    if (d.key === 'market') return r < 0.5 ? 'cypress' : 'round'
    return r < 0.55 ? 'round' : r < 0.8 ? 'bush' : 'blossom'
  }
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j) || taken.has(key(i, j)) || pond.has(key(i, j)) || reserved.has(key(i, j))) continue
    const d = dist[i][j], z = height[i][j], coastal = coast(i, j)
    // Nothing grows in the river; the odd rock stands beside it.
    if (wet.has(key(i, j))) continue
    if (road.has(key(i, j))) {
      if ((i * 7 + j * 3) % 5 === 0) things.push({ depth: i + j + 0.9, draw: (layer) => lamp(new Pen(layer, 0, 0, z, new Bounds(), lights), i + 0.12, j + 0.12, 24) })
      continue
    }
    const density = { peaks: 0.55, badlands: 0.3, proving: 0.28, harbour: 0.16, funfair: 0.24, market: 0.2, oldtown: 0.22 }[d.key]
    const cluster = 0.5 + 0.5 * Math.sin(i * 0.9 + 1.3) * Math.cos(j * 0.8 - 0.4)
    if (R() > density * (0.5 + cluster)) {
      if (R() < 0.04 && !coastal && z === 0) things.push({ depth: i + j + 1, draw: (layer) => flowers(new Pen(layer), i + 0.5, j + 0.5) })
      else if (R() < 0.03 && !coastal && z === 0) things.push({ depth: i + j + 1, draw: (layer) => person(new Pen(layer), i + 0.5, j + 0.5, shirts[(i + j) % shirts.length], { pose: R() < 0.3 ? 'wave' : 'stand' }) })
      continue
    }
    // The Badlands grow cacti as often as anything.
    if (d.key === 'badlands' && !coastal && R() < 0.45) {
      const x = i + 0.3 + R() * 0.4, y = j + 0.3 + R() * 0.4, big = R() < 0.6, flower = R() < 0.3, k = 0.85 + R() * 0.3
      things.push({ depth: x + y, draw: (layer) => (big ? cactus(new Pen(layer, 0, 0, z), x, y, k, flower) : barrelCactus(new Pen(layer, 0, 0, z), x, y, k)) })
      continue
    }
    const kind = treeKind(d, coastal)
    const snowy = d.key === 'peaks' && (z >= 48 || (z === 36 && field(i, j) > 0.62))
    const n = kind === 'pine' && R() < 0.6 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const x = i + 0.3 + R() * 0.4, y = j + 0.3 + R() * 0.4
      const c = kind === 'blossom' ? C.leaf : R() < 0.22 ? C.bloom : R() < 0.5 ? C.leaf : '#35c9a6'
      const sz = 0.85 + R() * 0.35
      things.push({ depth: x + y, draw: (layer) => (snowy && kind === 'pine' ? snowPine(new Pen(layer, 0, 0, z), x, y, c === C.bloom ? C.leaf : c, sz) : tree(new Pen(layer, 0, 0, z), x, y, kind, c, sz)) })
    }
  }
  things.sort((a, b) => a.depth - b.depth)
  // Every building gets a layer of its own; whatever stands between two
  // buildings shares one still layer.
  let bundle: N | null = null
  for (const t of things) {
    if (t.slug) { t.draw(open('landmark', t.slug)); bundle = null }
    else { bundle ??= open('things'); t.draw(bundle) }
  }

  const [vx0] = P(0, GRID), [vx1] = P(GRID, 0), [, vy0] = P(0, 0, 220), [, vy1] = P(GRID, GRID, SEA)
  const viewBox: [number, number, number, number] = [f(vx0 - 120), f(vy0 - 60), f(vx1 - vx0 + 240), f(vy1 - vy0 + 180)]

  let hiddenLights = 0
  /* ---- night ------------------------------------------------------------- */
  // Which lights can be seen: everything that stands up is drawn once more,
  // with each light's pane or bulb painted a colour of its own, and the
  // pixels of each colour counted. Then the same again with every light also
  // drawn on top of everything, which is how much of it there would be with
  // nothing in front. A light that keeps less than a fifth of itself glows
  // no more. (Things that move, such as clouds, are not in these pictures;
  // they pass over a glow, which is how light behaves anyway.)
  function occlusion(raster: Raster): boolean[] {
    const code = (n: number) => [(n + 1) & 255, (((n + 1) >> 8) & 15) * 16 + 3, 251]
    const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
    const body = made.filter((m) => m.kind === 'landmark' || m.kind === 'things').map((m) => render(m.node)).join('')
      .replace(/<(\w+)([^>]*?) data-l="(\d+)"/g, (_, tag: string, attrs: string, n: string) => `<${tag}${attrs.replace(/ (fill|opacity|class)="[^"]*"/g, '')} fill="${hex(code(Number(n)))}" data-l="${n}"`)
    const onTop = (body.match(/<(?:polygon|circle|rect|path)[^>]*data-l="\d+"[^>]*\/>/g) ?? []).join('')
    const [vx, vy, vw, vh] = viewBox, W = 3200, k = W / vw
    const doc = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${W}" height="${Math.round(vh * k)}">${inner}</svg>`
    const tally = (inner: string) => {
      const px = raster(doc(inner), W).pixels, count = new Uint32Array(lights.length)
      for (let o = 0; o < px.length; o += 4) {
        if (px[o + 2] < 249 || px[o + 3] < 250 || (px[o + 1] & 15) !== 3) continue
        const n = ((px[o + 1] >> 4) << 8) + px[o] - 1
        if (n >= 0 && n < lights.length) count[n]++
      }
      return count
    }
    const shown = tally(body), whole = tally(body + onTop)
    return lights.map((_, n) => whole[n] === 0 || shown[n] >= whole[n] * 0.2)
  }

  // Hidden by day. At dusk and at night the page fades in a veil over the
  // whole map and, above it, a glow at every lit window and lamp, and
  // fireflies over the parks.
  const night = open('night')
  // Hidden in the markup itself, so a still render (or a page whose styles
  // have not loaded) shows day; island.css shows it when data-time asks.
  night.attrs.visibility = 'hidden'
  night.add(new N('rect', { class: 'night-veil', x: sx0 - 400, y: sy1 - 1400, width: sx1 - sx0 + 800, height: sy2 - sy1 + 2000, fill: '#0d1a4d', opacity: 0.56 }))
  {
    const nd = night.add(new N('defs'))
    const glow = nd.add(new N('radialGradient', { id: 'isl-glow' }))
    glow.add(new N('stop', { offset: 0, 'stop-color': '#fff4cf', 'stop-opacity': 0.95 }))
    glow.add(new N('stop', { offset: 0.35, 'stop-color': '#ffe7a8', 'stop-opacity': 0.45 }))
    glow.add(new N('stop', { offset: 1, 'stop-color': '#ffe7a8', 'stop-opacity': 0 }))
    let cores = ''
    const halos = night.add(new N('g', { class: 'night-halos' }))
    const seen = opts.raster ? occlusion(opts.raster) : lights.map(() => true)
    hiddenLights = seen.filter((v) => !v).length
    for (const [x, y] of lights.filter((_, n) => seen[n])) { halos.add(new N('circle', { cx: f(x), cy: f(y), r: 13, fill: 'url(#isl-glow)' })); cores += `M${f(x - 1.2)} ${f(y)}a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0` }
    night.add(new N('path', { d: cores, fill: '#fff8de', opacity: 0.8 }))
    // Fireflies over the meadows.
    let made = 0
    for (let i = 0; i < GRID && made < 10; i++) for (let j = 0; j < GRID && made < 10; j++) {
      if (!isLand(i, j) || taken.has(key(i, j)) || road.has(key(i, j)) || height[i][j] !== 0 || (i * 11 + j * 7) % 7 || !['oldtown', 'funfair', 'harbour', 'market', 'proving'].includes(dist[i][j].key)) continue
      const [x, y] = P(i + 0.5, j + 0.5, 10 + (made % 3) * 6)
      night.add(new N('circle', { cx: f(x), cy: f(y), r: 2.2, fill: '#d9ffb0', class: 'firefly amb', 'data-b': `${f(x - 14)} ${f(y - 14)} ${f(x + 14)} ${f(y + 14)}`, style: `animation-delay:${f(-made * 0.9)}s` }))
      made++
    }
  }

  /* ---- labels and sky ---------------------------------------------------- */
  const banners: Record<string, [number, number]> = {}
  const bannerG = open('banners')
  for (const d of DISTRICTS) {
    const [x, y] = P(d.at[0], d.at[1], d.key === 'peaks' ? 150 : 90)
    banners[d.key] = [f(x), f(y)]
    const w = d.name.length * 9.5 + 34
    const g = bannerG.add(new N('g', { class: 'banner' }))
    g.add(new N('path', { d: `M${f(x - w / 2 - 12)} ${f(y - 14)}h14v26h-14l7 -13z M${f(x + w / 2 + 12)} ${f(y - 14)}h-14v26h14l-7 -13z`, fill: shade(d.tint, 0.8), stroke: INK, 'stroke-width': 2 }))
    g.add(new N('rect', { x: x - w / 2, y: y - 19, width: w, height: 29, rx: 8, fill: '#ffffff', stroke: INK, 'stroke-width': 2.4 }))
    g.add(new N('text', { x, y: y + 1, 'text-anchor': 'middle', 'font-family': 'Fredoka, system-ui, sans-serif', 'font-weight': 700, 'font-size': 16, fill: INK }).text(d.name))
  }
  const sky = open('sky')
  ;[[-0.2, 0.1, 1.2], [0.25, 0.45, 1], [0.6, 0.2, 1.3], [0.05, 0.7, 0.9], [0.8, 0.6, 1.1]].forEach(([u, v, k], n) => {
    const [x, y] = P(u * GRID * 1.3, v * GRID, 170)
    const g = sky.add(new N('g', { class: 'cloud', style: `animation-delay:${-n * 23}s;animation-duration:${150 + n * 20}s` }))
    g.add(new N('ellipse', { cx: f(x + 14), cy: f(y + 120), rx: f(56 * k), ry: f(17 * k), fill: INK, opacity: 0.06, class: 'cloud-shadow' }))
    g.add(new N('g', { transform: `translate(${f(x)} ${f(y)})` })).add(cloudShape(k))
  })
  // Hot-air balloons drifting slowly over, and a little plane towing a banner.
  ;([[9, 26, 230, C.rasp, '#ffffff', 0], [26, 10, 260, C.cobalt, C.mint, 40]] as [number, number, number, string, string, number][]).forEach(([i, j, z, a, b, d], n) => {
    const [x, y] = P(i, j, z)
    sky.add(hotAirBalloon(x, y, a, b, `hab${n}`, 90 + n * 30, d))
  })
  sky.add(skyPlane('isl-plane'))
  { const [x, y] = P(24, 23, 150); sky.add(gullsCircling(x, y, 70, 26, 'gulls0', 14)) }
  { const [x, y] = P(5, 20, 130); sky.add(gullsCircling(x, y, 50, 20, 'gulls1', 11)) }
  for (const [n, d] of [[0, 0], [1, 18]]) {
    const g = sky.add(new N('g', { class: `flock flock${n}`, style: `animation-delay:${-d}s` }))
    g.add(birds())
  }

  const layers: Layer[] = made.map((m) => ({ kind: m.kind, slug: m.slug, body: render(m.node) }))
  const css = motionCss.join('')
  // The island's own extent, without the sea round it: the camera keeps this in view.
  const landBox: [number, number, number, number] = [f(P(0, GRID)[0]), f(P(0, 0, 60)[1]), f(P(GRID, 0)[0]), f(P(GRID, GRID)[1])]
  return { land: landBox, hiddenLights, svg: `<style>${css}</style>` + layers.map((l) => l.body).join(''), layers, css, viewBox, anchors, lights, banners, mini }
}

export { OUT, bench }
