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
import { C, INK, N, OUT, P, Pen, render, rng, shade, S, Bounds, motionCss, motionPath } from './kit'
import { tree, person, lamp, bench, flowers, walkerFigure, sailboat, birds, cloudShape, type TreeKind } from './props'
import { LANDMARKS, DISTRICTS, PLACES, type DistrictKey, type District } from './landmarks'

export const GRID = 30
const SEA = -12
const f = (v: number) => Math.round(v * 10) / 10
const key = (i: number, j: number) => `${i},${j}`

export type Anchor = { slug: string; district: DistrictKey; x0: number; y0: number; x1: number; y1: number; bx: number; by: number; foot: string }
export type Layer = { kind: 'sea' | 'boats' | 'ground' | 'walkers' | 'things' | 'landmark' | 'banners' | 'sky'; slug?: string; body: string }
export type Island = { svg: string; layers: Layer[]; css: string; viewBox: [number, number, number, number]; anchors: Record<string, Anchor>; lights: [number, number][]; banners: Record<string, [number, number]>; mini: string }
export type GameLink = { slug: string; title: string; blurb: string; href: string }

export function buildIsland(games: GameLink[]): Island {
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

  /* ---- roads: found by searching round the buildings -------------------- */
  const road = new Set<string>()
  const walkable = (i: number, j: number) => isLand(i, j) && height[i][j] === 0 && !taken.has(key(i, j)) && !coast(i, j)
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

  /* ---- the painting ------------------------------------------------------ */
  // The island is painted in layers, each its own SVG, so an animation only
  // makes the browser rework the small layer it is in rather than the lot.
  const made: { kind: Layer['kind']; slug?: string; node: N }[] = []
  const open = (kind: Layer['kind'], slug?: string) => { const node = new N('g', { class: `layer-${kind}` }); made.push({ kind, slug, node }); return node }
  let root = open('sea')
  const lights: [number, number][] = []

  // The sea, its shallows, and the surf round the coast.
  const [sx0, sy0] = P(-8, GRID + 8), [sx1] = P(GRID + 8, -8), [, sy1] = P(-8, -8), [, sy2] = P(GRID + 8, GRID + 8)
  root.add(new N('rect', { x: sx0 - 400, y: sy1 - 1400, width: sx1 - sx0 + 800, height: sy2 - sy1 + 2000, fill: C.water }))
  const shallows = new Map<string, string>()
  for (let i = -4; i < GRID + 4; i++) for (let j = -4; j < GRID + 4; j++) {
    if (isLand(i, j)) continue
    let near = 9
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (isLand(i + a, j + b)) near = Math.min(near, Math.max(Math.abs(a), Math.abs(b)))
    if (near > 3) continue
    const col = near === 1 ? '#b8e2ff' : near === 2 ? '#a6d9ff' : '#98d2ff'
    const pts = [P(i, j, SEA), P(i + 1, j, SEA), P(i + 1, j + 1, SEA), P(i, j + 1, SEA)]
    shallows.set(col, (shallows.get(col) ?? '') + `M${pts.map((p) => p.map(f).join(' ')).join('L')}Z`)
  }
  for (const [col, d] of shallows) root.add(new N('path', { d, fill: col }))
  const waves = root.add(new N('g', { class: 'waves' }))
  for (let g = 0; g < 4; g++) {
    let d = ''
    for (let k = 0; k < 45; k++) {
      const [x, y] = P(R() * (GRID + 16) - 8, R() * (GRID + 16) - 8, SEA)
      d += `M${f(x)} ${f(y)}q7 -5 14 0q7 -5 14 0`
    }
    waves.add(new N('path', { d, fill: 'none', stroke: '#ffffff', 'stroke-width': 2.2, 'stroke-linecap': 'round', class: `wave w${g}` }))
  }
  let foam = ''
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j)) continue
    const e = (a: [number, number], b: [number, number]) => { const p1 = P(a[0], a[1], SEA), p2 = P(b[0], b[1], SEA); foam += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
    if (!isLand(i + 1, j)) e([i + 1.08, j], [i + 1.08, j + 1])
    if (!isLand(i - 1, j)) e([i - 0.08, j], [i - 0.08, j + 1])
    if (!isLand(i, j + 1)) e([i, j + 1.08], [i + 1, j + 1.08])
    if (!isLand(i, j - 1)) e([i, j - 0.08], [i + 1, j - 0.08])
  }
  root.add(new N('path', { d: foam, fill: 'none', stroke: '#ffffff', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: 0.9 }))
  root.add(new N('path', { d: foam, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-dasharray': '5 9', class: 'surf', opacity: 0.7 }))

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

  // The ground, a diagonal row at a time: tops merged by colour, then cliffs.
  root = open('ground')
  const ground = root.add(new N('g', { class: 'ground' }))
  let mini = ''
  const quad = (pts: [number, number][]) => `M${pts.map((p) => p.map(f).join(' ')).join('L')}Z`
  for (let s = 0; s < GRID * 2; s++) {
    const tops = new Map<string, string>(), cliffs = new Map<string, string>()
    for (let i = 0; i < GRID; i++) {
      const j = s - i
      if (!isLand(i, j)) continue
      const h = height[i][j], d = dist[i][j]
      let top = (i + j) % 2 ? d.ground[0] : d.ground[1]
      if (coast(i, j) && h === 0 && d.key !== 'badlands') top = (i + j) % 2 ? '#eef1f8' : '#e7ebf5'
      if (taken.has(key(i, j))) top = (i + j) % 2 ? '#eef0f8' : '#e6e9f4'
      if (d.key === 'peaks' && h >= 48) top = (i + j) % 2 ? '#f4f7ff' : '#eaf0fd'
      tops.set(top, (tops.get(top) ?? '') + quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i, j + 1, h)]))
      mini += quad([P(i, j, h), P(i + 1, j, h), P(i + 1, j + 1, h), P(i, j + 1, h)])
      const rock = d.key === 'badlands' || d.key === 'peaks'
      const cr = rock ? ['#a9a1d6', '#8a80c2'] : ['#c9cfe6', '#a3add6']
      const hr = H(i + 1, j), hd = H(i, j + 1)
      if (hr < h) cliffs.set(cr[0], (cliffs.get(cr[0]) ?? '') + quad([P(i + 1, j, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hr), P(i + 1, j, hr)]))
      if (hd < h) cliffs.set(cr[1], (cliffs.get(cr[1]) ?? '') + quad([P(i, j + 1, h), P(i + 1, j + 1, h), P(i + 1, j + 1, hd), P(i, j + 1, hd)]))
    }
    for (const [c, d] of tops) ground.add(new N('path', { d, fill: c, stroke: shade(c, 0.93), 'stroke-width': 0.8 }))
    for (const [c, d] of cliffs) ground.add(new N('path', { d, fill: c, stroke: INK, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }))
  }
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

  // Grass tufts and flower dots, merged into a handful of paths.
  const tufts = new Map<string, string>()
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j) || taken.has(key(i, j)) || road.has(key(i, j)) || height[i][j] !== 0 || coast(i, j)) continue
    const d = dist[i][j]
    if (d.key === 'badlands') continue
    for (let k = 0; k < 2; k++) {
      const [x, y] = P(i + 0.15 + R() * 0.7, j + 0.15 + R() * 0.7)
      const col = R() < 0.18 ? (R() < 0.5 ? '#ffffff' : '#ffb3c2') : shade(d.ground[0], 0.8)
      tufts.set(col, (tufts.get(col) ?? '') + (col.startsWith('#ff') ? `M${f(x)} ${f(y)}m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0` : `M${f(x - 3)} ${f(y)}l1.5 -3.5l1.5 3.5l1.5 -4l1.5 4`))
    }
  }
  const tuftG = root.add(new N('g', { class: 'tufts' }))
  for (const [c, d] of tufts) tuftG.add(new N('path', c.startsWith('#ff') ? { d, fill: c, stroke: INK, 'stroke-width': 0.5 } : { d, fill: 'none', stroke: c, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))

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
  // Trees, rocks and the odd lamp or bench, on the land left over.
  const treeKind = (d: District, coastal: boolean): TreeKind => {
    if (coastal) return d.key === 'badlands' ? 'rock' : 'palm'
    const r = R()
    if (d.key === 'peaks') return r < 0.8 ? 'pine' : 'rock'
    if (d.key === 'badlands') return r < 0.55 ? 'rock' : r < 0.8 ? 'snag' : 'bush'
    if (d.key === 'oldtown') return r < 0.4 ? 'blossom' : r < 0.75 ? 'round' : 'cypress'
    if (d.key === 'market') return r < 0.5 ? 'cypress' : 'round'
    return r < 0.55 ? 'round' : r < 0.8 ? 'bush' : 'blossom'
  }
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (!isLand(i, j) || taken.has(key(i, j))) continue
    const d = dist[i][j], z = height[i][j], coastal = coast(i, j)
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
    const kind = treeKind(d, coastal)
    const n = kind === 'pine' && R() < 0.6 ? 2 : 1
    for (let k = 0; k < n; k++) {
      const x = i + 0.3 + R() * 0.4, y = j + 0.3 + R() * 0.4
      const c = kind === 'blossom' ? C.leaf : R() < 0.22 ? C.bloom : R() < 0.5 ? C.leaf : '#35c9a6'
      const sz = 0.85 + R() * 0.35
      things.push({ depth: x + y, draw: (layer) => tree(new Pen(layer, 0, 0, z), x, y, kind, c, sz) })
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
    g.add(new N('ellipse', { cx: f(x + 20), cy: f(y + 190), rx: f(70 * k), ry: f(24 * k), fill: INK, opacity: 0.08 }))
    g.add(new N('g', { transform: `translate(${f(x)} ${f(y)})` })).add(cloudShape(k))
  })
  for (const [n, d] of [[0, 0], [1, 18]]) {
    const g = sky.add(new N('g', { class: `flock flock${n}`, style: `animation-delay:${-d}s` }))
    g.add(birds())
  }

  const [vx0] = P(0, GRID), [vx1] = P(GRID, 0), [, vy0] = P(0, 0, 220), [, vy1] = P(GRID, GRID, SEA)
  const viewBox: [number, number, number, number] = [f(vx0 - 120), f(vy0 - 60), f(vx1 - vx0 + 240), f(vy1 - vy0 + 180)]
  const layers: Layer[] = made.map((m) => ({ kind: m.kind, slug: m.slug, body: render(m.node) }))
  const css = motionCss.join('')
  return { svg: `<style>${css}</style>` + layers.map((l) => l.body).join(''), layers, css, viewBox, anchors, lights, banners, mini }
}

export { OUT, bench }
