/**
 * Tiny Island — the ground as one painting (the cartoon island).
 *
 * The map is still decided on a grid of tiles (world.ts: which tile is land,
 * how high, which district), but the ground is not drawn tile by tile. Each
 * height the land rises to is a region, and each region's edge is found as a
 * contour of a soft field: the region's tiles, blurred, with a little slow
 * noise in it, cut at a half. So a coast or a terrace runs in curves and
 * bays where the tiles step in squares, and every one is the same shape from
 * the same field, so terraces nest inside each other the way hills do.
 *
 * Some places are pinned: the middle of every tile that has something on it
 * stays on its own ground, so no tree, building or umbrella ends up over the
 * edge or under a cliff.
 *
 * Each region is painted from the bottom up: its walls (lit by which way
 * they face), a lip of grass over the top of them, its top, and an outline.
 * A wall's face, and a top's colour, come from what the tile just inside it
 * is: sand, grass, the Badlands' dust, rock, snow.
 */
import { N, P, S, INK, mix, shade } from './kit'

export type Pt = [number, number]
/** Samples per tile, and tiles of margin round the grid (the field is empty there, so every contour closes). */
const RES = 8, PAD = 2

const f = (v: number) => Math.round(v * 10) / 10
const f2 = (v: number) => Math.round(v * 100) / 100

/** The ground's colours: natural, and cool where nature lets them be. */
export const LAND = {
  sand: ['#eee6d1', '#e6dcc3', '#d2c4a4'], sandFace: ['#d9ccad', '#c3b391'], sandWet: '#cdbf9e',
  slateSand: ['#d9d6cf', '#cdc9c0'], slateFace: ['#bdb9ae', '#a6a296'],
  grass: '#6cb65c', grassLight: '#8ccb6e', grassSun: '#a5d985', grassShade: '#579f4f', grassDeep: '#468a44', lip: '#4f9748',
  earth: ['#957a68', '#7a6457'], earthDark: '#5d4b43',
  rock: ['#a3a8b0', '#858b95'], rockDark: '#5f6670',
  dust: '#c2b8aa', dustLight: '#d0c8bc', dustShade: '#b1a594', dustFace: ['#a8998a', '#8c7e70'], dustLip: '#a99c8b',
  snow: '#f3f7fb', snowShade: '#dfe7f1', snowFace: ['#c6ccd6', '#aab1bd'],
  alpine: '#62a95b', alpineLight: '#7fbd69',
  paving: '#e4dfd3', pavingEdge: '#c3baa7',
  road: '#e2d9c5', roadEdge: '#c4b597', roadWorn: '#5a7a46',
  water: '#4a96d6', waterLight: '#6fb4e2',
  /** The sea: open water deepening away from the island, and its shallows, palest at the shore. */
  seaNear: '#4a98d8', seaFar: '#2b65ad', shallows: ['#4c9bd9', '#4fb0d9', '#5ec3d6', '#7dd3d4'],
}

/* ---- the field ------------------------------------------------------------ */

export class Field {
  n: number
  v: Float32Array
  constructor(grid: number) { this.n = (grid + PAD * 2) * RES; this.v = new Float32Array(this.n * this.n) }
  /** Sample a (or b) is at this tile coordinate. */
  static u(a: number) { return -PAD + (a + 0.5) / RES }
  /** The field at a point, between samples. */
  at(u: number, v: number): number {
    const a = (u + PAD) * RES - 0.5, b = (v + PAD) * RES - 0.5
    const a0 = Math.max(0, Math.min(this.n - 2, Math.floor(a))), b0 = Math.max(0, Math.min(this.n - 2, Math.floor(b)))
    const ta = Math.max(0, Math.min(1, a - a0)), tb = Math.max(0, Math.min(1, b - b0))
    const g = (x: number, y: number) => this.v[y * this.n + x]
    return (g(a0, b0) * (1 - ta) + g(a0 + 1, b0) * ta) * (1 - tb) + (g(a0, b0 + 1) * (1 - ta) + g(a0 + 1, b0 + 1) * ta) * tb
  }
  /** The way out of the region at a point: down the field's slope. */
  out(u: number, v: number): Pt {
    const e = 0.06, gx = this.at(u + e, v) - this.at(u - e, v), gy = this.at(u, v + e) - this.at(u, v - e)
    const L = Math.hypot(gx, gy) || 1
    return [-gx / L, -gy / L]
  }
}

/** Slow, smooth wandering, the same everywhere it is asked. */
export const wander = (u: number, v: number, seed = 0) =>
  0.55 * Math.sin(u * 1.13 + v * 0.71 + 1.3 + seed) * Math.cos(v * 0.97 - u * 0.41 + seed * 0.7) + 0.3 * Math.sin(u * 2.71 - v * 2.33 + 0.7 + seed * 1.3) + 0.15 * Math.sin(u * 5.3 + v * 4.1 + seed)

export type FieldOpts = {
  /** Blur, in samples (a box blur three times over: near enough a gaussian). */
  blur?: number
  /** How far the slow noise moves the edge. */
  noise?: number
  seed?: number
  /** For a tile in the region: how far in from its sides it is kept in the region (-1: not pinned). */
  keepIn?: (i: number, j: number) => number
  /** For a tile outside it: how far in from its sides it is kept out. */
  keepOut?: (i: number, j: number) => number
}

export function field(grid: number, inside: (i: number, j: number) => boolean, o: FieldOpts = {}): Field {
  const F = new Field(grid), n = F.n, v = F.v
  const blur = o.blur ?? 3, noise = o.noise ?? 0.14, seed = o.seed ?? 0
  const cellOf = (a: number) => Math.floor(Field.u(a))
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) v[b * n + a] = inside(cellOf(a), cellOf(b)) ? 1 : 0
  // Three box blurs, across and down.
  const tmp = new Float32Array(n * n)
  for (let pass = 0; pass < 3; pass++) {
    for (let b = 0; b < n; b++) { let s = 0; for (let a = -blur; a <= blur; a++) s += v[b * n + Math.max(0, Math.min(n - 1, a))]; for (let a = 0; a < n; a++) { tmp[b * n + a] = s / (blur * 2 + 1); s += v[b * n + Math.min(n - 1, a + blur + 1)] - v[b * n + Math.max(0, a - blur)] } }
    for (let a = 0; a < n; a++) { let s = 0; for (let b = -blur; b <= blur; b++) s += tmp[Math.max(0, Math.min(n - 1, b)) * n + a]; for (let b = 0; b < n; b++) { v[b * n + a] = s / (blur * 2 + 1); s += tmp[Math.min(n - 1, b + blur + 1) * n + a] - tmp[Math.max(0, b - blur) * n + a] } }
  }
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
    const u = Field.u(a), w = Field.u(b), i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j
    let x = v[b * n + a]
    // Noise only where the edge is: deep inside and far out stay as they are.
    x += noise * wander(u, w, seed) * Math.min(1, 4 * x * (1 - x))
    const inC = inside(i, j)
    const m = inC ? o.keepIn?.(i, j) ?? -1 : o.keepOut?.(i, j) ?? -1
    if (m >= 0 && fu >= m && fu <= 1 - m && fw >= m && fw <= 1 - m) x = inC ? Math.max(x, 0.58) : Math.min(x, 0.42)
    // The margin is never land, so every contour closes.
    if (a < 2 || b < 2 || a >= n - 2 || b >= n - 2) x = 0
    v[b * n + a] = x
  }
  return F
}

/* ---- contours --------------------------------------------------------------- */

/** The closed outlines where the field crosses t, in tile units. */
export function contours(F: Field, t = 0.5): Pt[][] {
  const n = F.n, v = F.v
  const val = (a: number, b: number) => v[b * n + a]
  // A crossing on a grid edge: 'h' between (a,b) and (a+1,b), 'v' between (a,b) and (a,b+1).
  const pts = new Map<string, Pt>()
  const cross = (k: string, a0: number, b0: number, a1: number, b1: number): string => {
    if (!pts.has(k)) {
      const x0 = val(a0, b0), x1 = val(a1, b1), s = (t - x0) / (x1 - x0)
      pts.set(k, [Field.u(a0 + (a1 - a0) * s), Field.u(b0 + (b1 - b0) * s)])
    }
    return k
  }
  const next = new Map<string, string>()
  for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) {
    const tl = val(a, b) > t ? 1 : 0, tr = val(a + 1, b) > t ? 1 : 0, br = val(a + 1, b + 1) > t ? 1 : 0, bl = val(a, b + 1) > t ? 1 : 0
    const c = tl * 8 + tr * 4 + br * 2 + bl
    if (c === 0 || c === 15) continue
    const T = () => cross(`h${a},${b}`, a, b, a + 1, b), R = () => cross(`v${a + 1},${b}`, a + 1, b, a + 1, b + 1)
    const B = () => cross(`h${a},${b + 1}`, a, b + 1, a + 1, b + 1), L = () => cross(`v${a},${b}`, a, b, a, b + 1)
    // Each segment runs with the region on its left (in tile units, where +v is "down").
    const seg = (p: string, q: string) => next.set(p, q)
    const mid = (val(a, b) + val(a + 1, b) + val(a + 1, b + 1) + val(a, b + 1)) / 4 > t
    switch (c) {
      case 1: seg(B(), L()); break
      case 2: seg(R(), B()); break
      case 3: seg(R(), L()); break
      case 4: seg(T(), R()); break
      case 5: if (mid) { seg(T(), L()); seg(B(), R()) } else { seg(T(), R()); seg(B(), L()) } break
      case 6: seg(T(), B()); break
      case 7: seg(T(), L()); break
      case 8: seg(L(), T()); break
      case 9: seg(B(), T()); break
      case 10: if (mid) { seg(L(), B()); seg(R(), T()) } else { seg(L(), T()); seg(R(), B()) } break
      case 11: seg(R(), T()); break
      case 12: seg(L(), R()); break
      case 13: seg(B(), R()); break
      case 14: seg(L(), B()); break
    }
  }
  const loops: Pt[][] = []
  const used = new Set<string>()
  for (const start of next.keys()) {
    if (used.has(start)) continue
    const loop: Pt[] = []
    let k: string | undefined = start
    while (k && !used.has(k)) { used.add(k); loop.push(pts.get(k)!); k = next.get(k) }
    if (loop.length >= 4) loops.push(simplify(loop, 0.012))
  }
  return loops
}

/** Fewer points, the same shape (Douglas-Peucker, on a closed loop). */
function simplify(loop: Pt[], eps: number): Pt[] {
  if (loop.length < 8) return loop
  const rdp = (pts: Pt[]): Pt[] => {
    if (pts.length < 3) return pts
    const [a, b] = [pts[0], pts[pts.length - 1]]
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9
    let best = -1, bd = 0
    for (let k = 1; k < pts.length - 1; k++) { const d = Math.abs((pts[k][0] - a[0]) * dy - (pts[k][1] - a[1]) * dx) / L; if (d > bd) { bd = d; best = k } }
    if (bd <= eps) return [a, b]
    const l = rdp(pts.slice(0, best + 1)), r = rdp(pts.slice(best))
    return [...l.slice(0, -1), ...r]
  }
  const h = Math.floor(loop.length / 2)
  const one = rdp(loop.slice(0, h + 1)), two = rdp([...loop.slice(h), loop[0]])
  return [...one.slice(0, -1), ...two.slice(0, -1)]
}

/* ---- drawing them ------------------------------------------------------------ */

/** A loop as path data, at a height, on screen. */
export const screenLoop = (loop: Pt[], z: number) => 'M' + loop.map(([u, v]) => { const [x, y] = P(u, v, z); return `${f(x)} ${f(y)}` }).join('L') + 'Z'
export const screenLoops = (loops: Pt[][], z: number) => loops.map((l) => screenLoop(l, z)).join('')
/** A loop as path data in tile units, for a group laid flat (kit's plane transform). */
export const planeLoops = (loops: Pt[][]) => loops.map((l) => 'M' + l.map(([u, v]) => `${f2(u)} ${f2(v)}`).join('L') + 'Z').join('')

/** Each edge of a set of loops that we can see from the front: its ends, which way it faces, and how lit it is (0 shade, 1 sun). */
export type Edge = { a: Pt; b: Pt; n: Pt; lit: number }
export function frontEdges(loops: Pt[][], F: Field): Edge[] {
  const out: Edge[] = []
  for (const loop of loops) for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length]
    const n = F.out((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    // We look along +i +j: a face is seen if it faces that way at all.
    if (n[0] + n[1] <= 0.02) continue
    // Lit as the island is: a face to +i (the right) in the sun, one to +j in shade.
    out.push({ a, b, n, lit: Math.max(0, Math.min(1, 0.5 + (n[0] - n[1]) * 0.62)) })
  }
  return out
}

/** A run of edges' faces between two heights, one path per tone. */
export function walls(edges: Edge[], hi: number, lo: (e: Edge) => number, tone: (e: Edge) => string): Map<string, string> {
  const by = new Map<string, string>()
  for (const e of edges) {
    const l = lo(e)
    if (l >= hi) continue
    const [x1, y1] = P(e.a[0], e.a[1], hi), [x2, y2] = P(e.b[0], e.b[1], hi), [x3, y3] = P(e.b[0], e.b[1], l), [x4, y4] = P(e.a[0], e.a[1], l)
    const c = tone(e)
    by.set(c, (by.get(c) ?? '') + `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}L${f(x4)} ${f(y4)}Z`)
  }
  return by
}

/** The edges as a line at a height (joined where they meet). */
export function edgeLine(edges: Edge[], z: number, dz = 0): string {
  let d = '', last: Pt | null = null
  for (const e of edges) {
    const [x1, y1] = P(e.a[0], e.a[1], z - dz), [x2, y2] = P(e.b[0], e.b[1], z - dz)
    d += last && last[0] === e.a[0] && last[1] === e.a[1] ? `L${f(x2)} ${f(y2)}` : `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`
    last = e.b
  }
  return d
}

/** A colour between two by t, kept to a few steps so faces merge into few paths. */
export const tone = (dark: string, light: string, t: number, steps = 4) => mix(dark, light, Math.round(t * steps) / steps)

/* ---- the painting ------------------------------------------------------------ */

export type GroundCtx = {
  grid: number
  sea: number
  beachZ: number
  isLand: (i: number, j: number) => boolean
  /** A land tile's height (its plaza's, under a building). */
  height: (i: number, j: number) => number
  district: (i: number, j: number) => string
  beach: (i: number, j: number) => boolean
  taken: (i: number, j: number) => boolean
  road: (i: number, j: number) => boolean
  /** Sea tiles something stands in (a pier, a building on stilts): the land keeps off them. */
  busySea: (i: number, j: number) => boolean
  snowy: (i: number, j: number) => boolean
  /** Sea tiles the sea cannot reach: a pool among the dunes. */
  lake: (i: number, j: number) => boolean
  river: [number, number][]
  hz: (a: number, b: number, c: number) => number
}

export type Ground = {
  /** The painted ground, bottom up. */
  g: N
  /** The coastline, in tile units: the shallows, the foam and the surf follow it. */
  coast: string
  /** The falls' moving water: one per step the river goes down. */
  falls: { d: string; b: string }[]
  /** Each height's outline in tile units, for whatever is laid flat on it afterwards. */
  regions: Map<number, Pt[][]>
}

/** What a tile's ground is made of, at a height. */
type Mat = 'sand' | 'slate' | 'grass' | 'dust' | 'alpine' | 'snow'

const ring = (x: number, y: number, rx: number, ry: number) => `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0`
const quadAt = (pts: [number, number][]) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`
/** A field of slow noise alone (light on the grass, ripples in the sand). */
function noiseField(grid: number, k: number, seed: number, extra = 0): Field {
  const F = new Field(grid)
  for (let b = 0; b < F.n; b++) for (let a = 0; a < F.n; a++) {
    const u = Field.u(a), v = Field.u(b)
    F.v[b * F.n + a] = wander(u * k, v * k, seed) + (extra ? extra * wander(u * k * 2.6, v * k * 2.6, seed + 5.6) : 0)
  }
  return F
}

export function paintGround(c: GroundCtx): Ground {
  const g = new N('g', { class: 'ground' })
  const H = (i: number, j: number) => (c.isLand(i, j) ? c.height(i, j) : c.sea)
  const all: number[] = []
  for (let i = 0; i < c.grid; i++) for (let j = 0; j < c.grid; j++) if (c.isLand(i, j)) all.push(H(i, j))
  const levels = [...new Set(all)].sort((a, b) => a - b)
  const regions = new Map<number, Pt[][]>()
  const fields = new Map<number, Field>()
  const mat = (i: number, j: number): Mat => {
    const d = c.district(i, j), z = H(i, j)
    if (c.beach(i, j)) return d === 'badlands' ? 'slate' : 'sand'
    if (d === 'peaks' && z > 0) return c.snowy(i, j) ? 'snow' : 'alpine'
    if (d === 'badlands') return 'dust'
    return 'grass'
  }
  const FACES: Record<Mat, string[]> = { sand: LAND.sandFace, slate: LAND.slateFace, grass: LAND.earth, dust: LAND.dustFace, alpine: LAND.rock, snow: LAND.rock }
  const LIPS: Record<Mat, string | null> = { sand: null, slate: null, grass: LAND.lip, dust: LAND.dustLip, alpine: LAND.lip, snow: '#ffffff' }

  // One field per height: every tile at least that high, pinned where things stand.
  for (const L of levels) {
    // (The lowest height takes in the pools, so the coast goes round them and they are painted on the sand.)
    const inside = (i: number, j: number) => (c.isLand(i, j) && H(i, j) >= L) || (L === levels[0] && c.lake(i, j))
    const F = field(c.grid, inside, {
      blur: 3, noise: 0.2, seed: 0,
      keepIn: (i, j) => (c.taken(i, j) ? 0 : 0.13),
      keepOut: (i, j) => (c.isLand(i, j) ? (c.taken(i, j) ? 0 : c.road(i, j) ? 0.08 : 0.27) : c.busySea(i, j) ? 0.04 : -1),
    })
    fields.set(L, F)
    regions.set(L, contours(F))
  }
  // Where the river's middle crosses a height's edge, between two tiles' worth either side of v.
  const crossAt = (L: number, v: number): number => {
    const F = fields.get(L)!, u = c.river[0][0] + 0.5
    let lo = v - 0.6, hi = v + 0.6
    if (F.at(u, lo) < 0.5 || F.at(u, hi) > 0.5) return v
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (F.at(u, m) > 0.5) lo = m; else hi = m }
    return (lo + hi) / 2
  }

  const falls: { d: string; b: string }[] = []
  let splash = ''

  levels.forEach((L, li) => {
    const loops = regions.get(L)!, F = fields.get(L)!
    const below = li ? levels[li - 1] : c.sea
    const edges = frontEdges(loops, F)
    // What the ground just inside each edge is.
    const matOf = (e: { a: Pt; b: Pt; n: Pt }): Mat => {
      const u = (e.a[0] + e.b[0]) / 2 - e.n[0] * 0.3, v = (e.a[1] + e.b[1]) / 2 - e.n[1] * 0.3
      const i = Math.floor(u), j = Math.floor(v)
      for (const [a, b] of [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) if (c.isLand(i + a, j + b) && H(i + a, j + b) >= L) return mat(i + a, j + b)
      return 'grass'
    }
    const em = edges.map((e) => ({ e, m: matOf(e) }))
    const lay = g.add(new N('g', { class: `lvl` }))
    const tall = L - below

    // The faces: lit by the way they turn, one path per tone.
    const faces = walls(edges, L, () => below, (e) => { const fc = FACES[matOf(e)]; return tone(fc[1], fc[0], e.lit) })
    for (const [col, d] of faces) lay.add(new N('path', { d, fill: col, stroke: col, 'stroke-width': 0.6 }))
    // Rock in layers, broken here and there, with a ledge of lighter stone at the top.
    const rocky = em.filter(({ m }) => m === 'alpine' || m === 'snow' || m === 'dust').map(({ e }) => e)
    if (rocky.length && tall >= 8) {
      let strata = '', hi = ''
      for (let z = L - 4; z > below + 2.5; z -= 4) {
        const keep = rocky.filter((e) => c.hz(Math.floor(e.a[0] * 2.5), Math.floor(e.a[1] * 2.5), z) > 0.3)
        strata += edgeLine(keep, z)
        if (z === L - 4) hi += edgeLine(keep, z + 1.1)
      }
      lay.add(new N('path', { d: strata, fill: 'none', stroke: LAND.rockDark, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.4 }))
      lay.add(new N('path', { d: hi, fill: 'none', stroke: '#ffffff', 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.3 }))
    }
    // Earth: stones in the bank.
    const earthy = em.filter(({ m }) => m === 'grass').map(({ e }) => e)
    if (earthy.length && tall >= 6) {
      let pebble = ''
      earthy.forEach((e, k) => {
        if (c.hz(e.a[0] * 7, e.a[1] * 7, L) > 0.3) return
        const t = c.hz(e.a[0], e.a[1], L + 1), u = e.a[0] + (e.b[0] - e.a[0]) * t, v = e.a[1] + (e.b[1] - e.a[1]) * t
        const [x, y] = P(u, v, below + tall * (0.3 + 0.3 * c.hz(e.b[0], e.b[1], k)))
        pebble += ring(x, y, 1.5, 1)
      })
      lay.add(new N('path', { d: pebble, fill: LAND.earthDark, opacity: 0.5 }))
    }
    // Darker at the foot, and wet where it stands in the sea.
    let foot = ''
    const b2 = Math.min(5, tall * 0.4)
    for (const e of edges) foot += quadAt([P(e.a[0], e.a[1], below + b2), P(e.b[0], e.b[1], below + b2), P(e.b[0], e.b[1], below), P(e.a[0], e.a[1], below)])
    lay.add(new N('path', { d: foot, fill: below <= c.sea ? '#1d4f86' : INK, opacity: below <= c.sea ? 0.3 : 0.14 }))
    // The lip of grass (or snow, or dust) hanging over the top of the face.
    const lipBy = new Map<string, Edge[]>()
    for (const { e, m } of em) { const col = LIPS[m]; if (col) lipBy.set(col, [...(lipBy.get(col) ?? []), e]) }
    for (const [col, es] of lipBy) lay.add(new N('path', { d: edgeLine(es, L, 1.6), fill: 'none', stroke: col, 'stroke-width': 3.2, 'stroke-linecap': 'round' }))
    lay.add(new N('path', { d: edgeLine(edges, below), fill: 'none', stroke: INK, 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.8 }))
    // At the foot of a bank on grass, what gathers there: long grass, and stones fallen from it.
    if (below >= 0) {
      let tuft = '', tuftLit = '', stone = ''
      edges.forEach((e, k) => {
        const len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1])
        for (let q = 0; q < Math.max(1, Math.round(len * 3)); q++) {
          const r = c.hz(Math.floor(e.a[0] * 9) + q, Math.floor(e.a[1] * 9), L + 3)
          if (r > 0.5) continue
          const t = (q + 0.5) / Math.max(1, Math.round(len * 3)), out2 = 0.06 + r * 0.16
          const u = e.a[0] + (e.b[0] - e.a[0]) * t + e.n[0] * out2, v = e.a[1] + (e.b[1] - e.a[1]) * t + e.n[1] * out2
          const i = Math.floor(u), j = Math.floor(v)
          if (!c.isLand(i, j) || H(i, j) !== below || c.road(i, j) || c.taken(i, j) || c.beach(i, j) || mat(i, j) === 'dust' || mat(i, j) === 'snow') continue
          const [x, y] = P(u, v, below)
          if (r < 0.07) { stone += `M${f(x - 3.4)} ${f(y + 1)}q0.4 -4 3.4 -4.4q3.2 0.3 3.4 4.4z`; continue }
          const blade = `M${f(x - 3)} ${f(y)}q-0.6 -4.4 -2.6 -6.6M${f(x - 1)} ${f(y)}q-0.2 -5.6 -0.8 -8.2M${f(x + 1)} ${f(y)}q0.4 -5 1.6 -7.4M${f(x + 3)} ${f(y)}q0.8 -3.6 2.8 -5.2`
          if (k % 3) tuft += blade; else tuftLit += blade
        }
      })
      if (tuft) lay.add(new N('path', { d: tuft, fill: 'none', stroke: LAND.grassDeep, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
      if (tuftLit) lay.add(new N('path', { d: tuftLit, fill: 'none', stroke: LAND.lip, 'stroke-width': 1.3, 'stroke-linecap': 'round' }))
      if (stone) lay.add(new N('path', { d: stone, fill: LAND.rock[0], stroke: INK, 'stroke-width': 0.9 }))
    }

    // The top: the height's own ground, then whatever else lies on it, each from a field of its own.
    // (No clipping: the bake paints the map in cells, and resvg cannot paint a clipped shape that falls
    // outside one. A patch is kept on its height by taking the lesser of its field and the height's own.)
    const inTop = (X: Field, t: number, at = 0.5): Pt[][] => { const G = new Field(c.grid); for (let k = 0; k < G.v.length; k++) G.v[k] = Math.min(X.v[k], F.v[k] - at - 0.03 + t); return contours(G, t) }
    const add = (loops2: Pt[][], attrs: Record<string, string | number>) => { if (loops2.length) lay.add(new N('path', { d: screenLoops(loops2, L), ...attrs })) }
    const base: Mat = L === c.beachZ ? 'sand' : L === 0 ? 'grass' : L >= 48 ? 'snow' : 'alpine'
    const TOP: Record<Mat, string> = { sand: LAND.sand[0], slate: LAND.slateSand[0], grass: LAND.grass, dust: LAND.dust, alpine: LAND.alpine, snow: LAND.snow }
    lay.add(new N('path', { d: screenLoops(loops, L), fill: TOP[base] }))
    // Light and shade lying across the open ground in soft patches.
    if (base === 'grass' || base === 'alpine') {
      const lit = noiseField(c.grid, 0.55, 3.1 + L * 0.13, 0.35)
      const top = base === 'grass' ? LAND.grass : LAND.alpine
      const light = base === 'grass' ? LAND.grassLight : LAND.alpineLight
      for (const [t, col, op] of [[0.42, light, 0.8], [0.78, base === 'grass' ? LAND.grassSun : mix(light, '#ffffff', 0.15), 0.55]] as [number, string, number][]) add(inTop(lit, t), { fill: col, opacity: op })
      for (let k = 0; k < lit.v.length; k++) lit.v[k] = -lit.v[k]
      for (const [t, col, op] of [[0.45, shade(top, 0.9), 0.7], [0.8, shade(top, 0.84), 0.5]] as [number, string, number][]) add(inTop(lit, t), { fill: col, opacity: op })
    }
    // Patches of another ground on this height: its own field, soft at the edge.
    const patch = (which: (i: number, j: number) => boolean, soft: string, full: string, seed: number) => {
      const P2 = field(c.grid, (i, j) => c.isLand(i, j) && H(i, j) >= L && which(i, j), { blur: 3, noise: 0.24, seed, keepIn: () => 0.2 })
      add(inTop(P2, 0.28), { fill: soft, opacity: 0.6 })
      add(inTop(P2, 0.5), { fill: full })
      return P2
    }
    if (L === c.beachZ) {
      // Damp sand at the water's edge, dry sand above it, with ripples of drier and damper.
      add(contours(F, 0.5), { fill: LAND.sandWet })
      add(contours(F, 0.64), { fill: LAND.sand[0] })
      add(inTop(noiseField(c.grid, 0.9, 5.5), 0.35, 0.66), { fill: LAND.sand[1], opacity: 0.8 })
      add(contours(F, 0.57), { fill: 'none', stroke: '#ffffff', 'stroke-width': 2.4, opacity: 0.4 })
      patch((i, j) => c.district(i, j) === 'badlands', LAND.slateSand[1], LAND.slateSand[0], 2.2)
      // Pools the sea left behind: a damp rim, clear water, deeper in the middle.
      const PF = field(c.grid, (i, j) => c.lake(i, j), { blur: 3, noise: 0.18, seed: 7.7, keepIn: () => 0.25 })
      const pool = contours(PF, 0.5)
      if (pool.length) {
        add(contours(PF, 0.3), { fill: LAND.sandWet })
        add(pool, { fill: LAND.waterLight, stroke: INK, 'stroke-width': 1.2 })
        add(contours(PF, 0.78), { fill: LAND.water, opacity: 0.55 })
      }
    }
    if (L === 0) {
      const D = patch((i, j) => c.district(i, j) === 'badlands' && !c.beach(i, j), LAND.dustShade, LAND.dust, 4.4)
      // The dust's own lighter drifts.
      const DF = noiseField(c.grid, 0.8, 9.9)
      for (let k = 0; k < DF.v.length; k++) DF.v[k] = Math.min(D.v[k], 0.5 + 0.5 * DF.v[k])
      add(inTop(DF, 0.62), { fill: LAND.dustLight, opacity: 0.85 })
    }
    if (base === 'alpine') patch((i, j) => c.snowy(i, j), LAND.snowShade, LAND.snow, 6.6)
    if (base === 'snow') add(inTop(noiseField(c.grid, 0.9, 1.7), 0.4), { fill: LAND.snowShade, opacity: 0.8 })

    // The river across this height, and its fall down the edge.
    const run = c.river.filter(([i, j]) => H(i, j) === L)
    if (run.length) {
      const i = run[0][0], j0 = run[0][1], j1 = run[run.length - 1][1]
      const first = c.river[0][1] === j0
      const v0 = first ? j0 + 0.3 : crossAt(levels[li + 1] ?? L, j0)
      const end = H(i, j1 + 1)
      const v1 = end < L ? crossAt(L, j1 + 1) : j1 + 1
      const ch = (w0: number, w1: number) => quadAt([P(i + w0, v0, L), P(i + w1, v0, L), P(i + w1, v1, L), P(i + w0, v1, L)])
      lay.add(new N('path', { d: ch(0.25, 0.75), fill: LAND.earth[1], opacity: 0.45 }))
      lay.add(new N('path', { d: ch(0.32, 0.68), fill: LAND.waterLight, stroke: INK, 'stroke-width': 1.1 }))
      lay.add(new N('path', { d: ch(0.4, 0.6), fill: LAND.water, opacity: 0.4 }))
      { const a = P(i + 0.42, v0 + 0.1, L), b = P(i + 0.42, v1 - 0.06, L); lay.add(new N('path', { d: `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`, stroke: '#ffffff', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.75 })) }
      if (first) { const [px, py] = P(i + 0.5, v0, L); lay.add(new N('path', { d: ring(px, py, 14, 7), fill: LAND.waterLight, stroke: INK, 'stroke-width': 1.1 })) }
      if (end < L) {
        const lo = Math.max(end, c.sea)
        const a = P(i + 0.32, v1, L), b = P(i + 0.68, v1, L), b3 = P(i + 0.68, v1, lo), a3 = P(i + 0.32, v1, lo)
        lay.add(new N('path', { d: quadAt([a, b, b3, a3]), fill: '#a9dcf3', stroke: INK, 'stroke-width': 1.1 }))
        let st = ''
        for (const u of [0.41, 0.5, 0.59]) { const p1 = P(i + u, v1, L - 1), p2 = P(i + u, v1, lo + 1); st += `M${f(p1[0])} ${f(p1[1])}L${f(p2[0])} ${f(p2[1])}` }
        falls.push({ d: st, b: `${f(Math.min(a[0], b3[0]))} ${f(Math.min(a[1], b3[1]))} ${f(Math.max(a[0], b3[0]))} ${f(Math.max(a[1], b3[1]))}` })
        const [sx, sy] = P(i + 0.5, v1 + 0.1, lo)
        splash += ring(sx, sy, 9, 3.8) + ring(sx - 9, sy - 2, 3, 2) + ring(sx + 9, sy + 1, 2.6, 1.7)
      }
    }
    // The edge of this height, all round.
    lay.add(new N('path', { d: screenLoops(loops, L), fill: 'none', stroke: INK, 'stroke-width': 1.3 }))
  })
  if (splash) g.add(new N('path', { d: splash, fill: '#ffffff', stroke: INK, 'stroke-width': 1 }))
  return { g, coast: planeLoops(regions.get(levels[0]) ?? []), falls, regions }
}
