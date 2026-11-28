/**
 * The walk's ground (build3d.ts): the island's tiles, made into land you
 * could stand on.
 *
 * Each tile is a patch of its own, flat in the middle at the tile's height
 * and running into its neighbours at the edges. Two tiles join as a slope
 * when the step between them is small enough to have weathered into one (a
 * terrace of the mountain, a beach climbing up to the grass, the sea floor
 * everywhere); otherwise the edge is a wall: rock on a cliff or a coast,
 * stone where a road or a building's plot was cut level into the hill. A
 * river runs in a channel carved into its tiles, between banks, stepping down
 * the mountain in little falls; the pond is a bowl. The sea floor shelves
 * away from the beaches, rises into sandbanks and drops into the trench the
 * island's map draws, and the rocks off the coast stand up out of it.
 *
 * Every point on two joined edges is worked out the same way from both
 * sides (the edge's own middle, its corners shared by every tile joined
 * round them), so there is never a crack; and heightAt() is that same
 * surface, so where you stand is where you see the ground.
 *
 * What each piece of ground is made of is photographed (groundset.ts, ground.ts): grass worn through to earth
 * and leaf litter, sand dry and wet, snow, the badlands' dry ground, rock and sea-worn rock, cut stone, worn and
 * fresh asphalt, cobbles in the old town, paving slabs and granite kerbs, a field's tilled soil, a stream's pebbles —
 * laid by hex-tiling where it is natural (so no repeat shows), blended one into another by height (sand into the
 * joints, grass through at the edges), from all three sides on anything steep, with the island's own large-scale
 * variation over it. A road crew's work is in the shape too: the pavements stand a kerb's height (12 cm) above the
 * road behind granite kerbs, dropped flush at each crossing; and in the shader, the gutter's setts and drains, the
 * manholes, the sealed cracks and resurfaced patches, the worn paint, the tyres' polish and the oil. Boulders, pebbles
 * and driftwood lie on the beaches and at the cliffs' feet; footprints and tyre tracks press into sand and snow
 * (foot.ts).
 */
import { BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshStandardMaterial, RGBAFormat, type Texture, Uint32BufferAttribute, Vector2, Vector3, Vector4 } from 'three'
import { wetness, RIPPLES_GLSL } from './wet'
import { PX_H, Y, type WorldData } from './build3d'
import { GROUND } from './groundset'
import { METRE } from './body'

export type Box = { i0: number; j0: number; i1: number; j1: number; z0: number; z1: number }

/** Sea tiles laid round the grid. */
const M = 8
/** Segments along a tile's edge. */
const R = 6
/** The most two tiles of land can differ by (site units; a terrace is 12) and still weather into one slope. */
const SMOOTH = 12
/** How deep a stream and the pond are cut into their tiles. */
const CARVE = 4, BOWL = 7

/** Surfaces, as the shader knows them. */
export const SURF = { land: 0, road: 2, rock: 3, sea: 5, field: 7, bed: 8, stone: 9, wood: 10 } as const

/** A kerb's height (world units: 12 cm), a pavement's width (of a tile), and how far a dropped kerb ramps down (of a tile). */
export const KERB = 0.12 * METRE, PAVE = 0.16, DROP = 0.06
/** Where a road tile's cells break: the pavement's edge, the crossings' bands and the dropped kerbs beside them. */
const CUTS = [0, 0.04, PAVE - DROP, PAVE, 0.5, 1 - PAVE, 1 - PAVE + DROP, 0.96, 1]

/**
 * How far a road tile's ground is lifted at a point (u, v across it, 0 to 1), by its mask (which sides run on as road,
 * which corners, where crossings leave it): a kerb's height under the pavements, none on the carriageway, and down to
 * a lip of 2 cm where a pavement's kerb meets a crossing. Judged at (cu, cv) — a cell's middle — so the two sides of a
 * kerb each keep their own height at the line between them (and the kerb's face stands there).
 */
export function liftAt(m: number, u: number, v: number, cu = u, cv = v) {
  const bit = (b: number) => Math.floor(m / b + 0.01) % 2
  const cN = bit(1), cS = bit(2), cW = bit(4), cE = bit(8), qNW = bit(16), qNE = bit(32), qSW = bit(64), qSE = bit(128)
  const xN = bit(256), xS = bit(512), xW = bit(1024), xE = bit(2048), W = PAVE
  const dN = cv, dS = 1 - cv, dW = cu, dE = 1 - cu
  const inN = dN <= W, inS = dS <= W, inW = dW <= W, inE = dE <= W
  const walk = (!cN && inN) || (!cS && inS) || (!cW && inW) || (!cE && inE) || (inN && inW && !qNW) || (inN && inE && !qNE) || (inS && inW && !qSW) || (inS && inE && !qSE)
  if (!walk) return 0
  const drop = (d: number) => KERB * (0.15 + 0.85 * Math.max(0, Math.min(1, d / DROP)))
  // Beside a crossing (in the road just off the junction's side), the corners' kerbs are dropped.
  if (xN && cv > 0.04 && cv < W) { if (cu < W && cu > W - DROP) return drop(W - u); if (cu > 1 - W && cu < 1 - W + DROP) return drop(u - (1 - W)) }
  if (xS && cv > 1 - W && cv < 0.96) { if (cu < W && cu > W - DROP) return drop(W - u); if (cu > 1 - W && cu < 1 - W + DROP) return drop(u - (1 - W)) }
  if (xW && cu > 0.04 && cu < W) { if (cv < W && cv > W - DROP) return drop(W - v); if (cv > 1 - W && cv < 1 - W + DROP) return drop(v - (1 - W)) }
  if (xE && cu > 1 - W && cu < 0.96) { if (cv < W && cv > W - DROP) return drop(W - v); if (cv > 1 - W && cv < 1 - W + DROP) return drop(v - (1 - W)) }
  return KERB
}

/** A road tile's mask: which sides and corners run on as road, and which roads leave a junction for a plain stretch (a crossing). */
export function roadMask(isRoad: (i: number, j: number) => boolean, i: number, j: number) {
  const R_ = isRoad
  const links = (a: number, b: number) => +R_(a - 1, b) + +R_(a + 1, b) + +R_(a, b - 1) + +R_(a, b + 1)
  const exit = (a: number, b: number) => R_(a, b) && links(i, j) >= 3 && links(a, b) <= 2
  return (R_(i - 1, j) ? 1 : 0) + (R_(i + 1, j) ? 2 : 0) + (R_(i, j - 1) ? 4 : 0) + (R_(i, j + 1) ? 8 : 0)
    + (R_(i - 1, j - 1) ? 16 : 0) + (R_(i - 1, j + 1) ? 32 : 0) + (R_(i + 1, j - 1) ? 64 : 0) + (R_(i + 1, j + 1) ? 128 : 0)
    + (exit(i - 1, j) ? 256 : 0) + (exit(i + 1, j) ? 512 : 0) + (exit(i, j - 1) ? 1024 : 0) + (exit(i, j + 1) ? 2048 : 0)
}

/** The grass of each district (earth in the badlands, which the shader paints). */
const GRASS: Record<string, string> = { peaks: '#4c6a3c', badlands: '#7d7a4e', proving: '#557a35', harbour: '#527a36', funfair: '#567c37', market: '#537936', oldtown: '#517735' }
const ROCK = '#86807a', SANDSTONE = '#b08c6e'
const KERB_TINT = new Color('#8a8a86')
const SAND = new Color('#d9cbb0'), DEEP = new Color('#0c3a55')

/* ---- the shape of a tile ---------------------------------------------------- */
/** How a tile's height runs from its middle out to an edge: flat for its first part, then eased (land), or straight (sand, the sea floor). */
const ease = (P: number) => (s: number) => (s <= P ? 0 : s >= 1 ? 1 : ((t) => t * t * (3 - 2 * t))((s - P) / (1 - P)))
const RUN = [ease(0.3), ease(0.38), (s: number) => s]
const LAND = 0, WET = 1, SOFT = 2

/**
 * A tile's nine heights (site units): its middle, its edges' middles (N, S, W, E) and its corners
 * (NW, NE, SW, SE); how it runs (LAND, WET, SOFT); and how each edge runs along its length.
 * N is towards i - 1 (v = 0), W towards j - 1 (u = 0).
 */
type Tile = { c: Float32Array; run: number; edge: [number, number, number, number]; soft: boolean; flat: boolean }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function shapeAt(T: Tile, u: number, v: number) {
  const sx = Math.abs(u - 0.5) * 2, sz = Math.abs(v - 0.5) * 2
  const east = u >= 0.5, south = v >= 0.5
  const eX = T.c[east ? 4 : 3], eZ = T.c[south ? 2 : 1], k = T.c[south ? (east ? 8 : 7) : (east ? 6 : 5)]
  const f = RUN[T.run], fX = RUN[T.edge[east ? 3 : 2]], fZ = RUN[T.edge[south ? 1 : 0]]
  // Across towards an edge the tile's own easing; along an edge, the edge's (so both sides of it agree).
  const a = lerp(f(sx), fZ(sx), sz), b = lerp(f(sz), fX(sz), sx)
  return lerp(lerp(T.c[0], eX, a), lerp(eZ, k, a), b)
}

/* ---- a little noise, for rock ---------------------------------------------- */
const hash3 = (x: number, y: number, z: number) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s) }
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const L = (a: number, b: number, t: number) => a + (b - a) * t
  const h = (a: number, b: number, c: number) => hash3(xi + a, yi + b, zi + c)
  return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w)
}

/* ---- the mesh, gathered --------------------------------------------------- */
class Geo {
  pos: number[] = []; nor: number[] = []; col: number[] = []; surf: number[] = []; blend: number[] = []; idx: number[] = []
  v(p: Vector3, n: Vector3, c: Color, s: [number, number, number], b: [number, number, number, number]) {
    this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(c.r, c.g, c.b); this.surf.push(...s); this.blend.push(...b)
    return this.pos.length / 3 - 1
  }
  /** A triangle, wound to face the way its vertices' normals do (front faces only, so it must be right). */
  tri(a: number, b: number, c: number) {
    const P = this.pos, N = this.nor
    const ax = P[b * 3] - P[a * 3], ay = P[b * 3 + 1] - P[a * 3 + 1], az = P[b * 3 + 2] - P[a * 3 + 2]
    const bx = P[c * 3] - P[a * 3], by = P[c * 3 + 1] - P[a * 3 + 1], bz = P[c * 3 + 2] - P[a * 3 + 2]
    const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx
    const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]
    if (fx * nx + fy * ny + fz * nz >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b)
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('aSurf', new Float32BufferAttribute(this.surf, 3))
    g.setAttribute('aBlend', new Float32BufferAttribute(this.blend, 4))
    g.setIndex(new Uint32BufferAttribute(this.idx, 1))
    return g
  }
}

export function terrain(d: WorldData, boxes: Box[], time: { value: number }) {
  const N = d.grid, seaY = Y(d.sea)
  const key = (i: number, j: number) => `${i},${j}`
  const roads = new Set(d.road.map(([i, j]) => key(i, j)))
  const pond = new Set(d.pond.map(([i, j]) => key(i, j)))
  const wet = new Set([...d.river, ...d.pond].map(([i, j]) => key(i, j)))
  const kind = (i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? '0' : d.ground[i * N + j])
  const district = (i: number, j: number) => d.district[Math.max(0, Math.min(N - 1, i))]?.[Math.max(0, Math.min(N - 1, j))] ?? 'harbour'
  const offshore = (i: number, j: number) => {
    let near = 9
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (kind(i + a, j + b) !== '0') near = Math.min(near, Math.hypot(a, b))
    return near
  }
  /** A tile's own height (site units): land at its height, a beach half-way to the sea, the sea floor deeper the further out. */
  const tops = new Map<number, number>()
  const top = (i: number, j: number) => {
    const id = (i + 64) * 256 + j + 64
    let t = tops.get(id)
    if (t === undefined) {
      const k = kind(i, j)
      t = k === '1' ? d.height[i][j] : k === 'b' ? d.beachZ : d.sea - 3 - Math.min(26, offshore(i, j) * 6)
      tops.set(id, t)
    }
    return t
  }
  const soft = (i: number, j: number) => kind(i, j) !== '1'
  const isWet = (i: number, j: number) => kind(i, j) === '1' && wet.has(key(i, j))
  const carved = (i: number, j: number) => top(i, j) - (isWet(i, j) ? (pond.has(key(i, j)) ? BOWL : CARVE) : 0)

  // A tile whose ground was cut level for something standing on it: a road, or anything built.
  const pinned = new Set<string>(roads)
  for (const b of boxes) {
    for (let i = Math.floor(b.i0); i < b.i1; i++) for (let j = Math.floor(b.j0); j < b.j1; j++) {
      if (kind(i, j) === '1' && Math.abs(b.z0 - Y(top(i, j))) < 0.06) pinned.add(key(i, j))
    }
  }

  /** Whether two side-by-side tiles run into one another as a slope (or meet at a wall). */
  const joined = (i: number, j: number, i2: number, j2: number) => {
    const sa = soft(i, j), sb = soft(i2, j2)
    if (sa && sb) return true
    const ta = top(i, j), tb = top(i2, j2), diff = Math.abs(ta - tb)
    const wa = isWet(i, j), wb = isWet(i2, j2)
    if (wa && wb) return diff === 0
    if (sa || sb) {
      // Land and the shore: a beach climbs to the grass; land meets the sea at a cliff.
      const [li, lj] = sa ? [i2, j2] : [i, j]
      if (kind(sa ? i : i2, sa ? j : j2) !== 'b' || isWet(li, lj)) return false
      return diff <= SMOOTH && !pinned.has(key(li, lj))
    }
    if (wa || wb) {
      // A stream's bank: never lower than the water it holds.
      const [wi, wj, li, lj] = wa ? [i, j, i2, j2] : [i2, j2, i, j]
      const lt = top(li, lj), wt = top(wi, wj)
      return lt >= wt && lt - wt <= SMOOTH && (lt === wt || !pinned.has(key(li, lj)))
    }
    return diff <= SMOOTH && (diff === 0 || (!pinned.has(key(i, j)) && !pinned.has(key(i2, j2))))
  }

  /** The height a corner of tile (i, j) comes to, shared by every tile joined to it round that corner. */
  const corner = (i: number, j: number, ci: number, cj: number) => {
    // The four round the corner, in order round it; joined neighbours are one group.
    const ring: [number, number][] = [[ci - 1, cj - 1], [ci - 1, cj], [ci, cj], [ci, cj - 1]]
    const group = ring.map((_, n) => n)
    const find = (n: number): number => (group[n] === n ? n : (group[n] = find(group[n])))
    for (let n = 0; n < 4; n++) {
      const [a, b] = ring[n], [c, e] = ring[(n + 1) % 4]
      if (joined(a, b, c, e)) group[find(n)] = find((n + 1) % 4)
    }
    const me = find(ring.findIndex(([a, b]) => a === i && b === j))
    const members = ring.filter((_, n) => find(n) === me)
    // Ground levelled for a road or a building keeps its level, and what is joined to it comes to meet it.
    const level = members.filter(([a, b]) => pinned.has(key(a, b)))
    if (level.length) return level.reduce((t, [a, b]) => t + top(a, b), 0) / level.length
    const allWet = ring.every(([a, b]) => isWet(a, b))
    let sum = 0
    for (const [a, b] of members) sum += allWet ? carved(a, b) : top(a, b)
    return sum / members.length
  }
  const edgeMid = (i: number, j: number, i2: number, j2: number) => {
    if (joined(i, j, i2, j2)) return isWet(i, j) && isWet(i2, j2) ? (carved(i, j) + carved(i2, j2)) / 2 : (top(i, j) + top(i2, j2)) / 2
    // A stream's bank holds it, except where it runs on down the stream or off the land into the sea.
    return isWet(i, j) && (isWet(i2, j2) || kind(i2, j2) === '0') ? carved(i, j) : top(i, j)
  }

  // The sea floor's own shapes: banks of sand rising out of it, and the trench.
  const isles = d.isles.map(([i, j, r, z]) => ({ x: j, z: i, r, h: z }))
  const islesAt = (x: number, z: number, h: number) => {
    for (const s of isles) {
      const q = Math.hypot(x - s.x, z - s.z) / s.r
      if (s.h > h) { const t = 1 - smoothstep(0.5, 1.45, q); if (t > 0) h = Math.max(h, lerp(h, s.h, t)) }
      else { const t = 1 - smoothstep(0.3, 1.25, q); if (t > 0) h = Math.min(h, lerp(h, s.h, t)) }
    }
    return h
  }

  const span = N + 2 * M
  const tiles: Tile[] = new Array(span * span)
  const tileAt = (i: number, j: number) => tiles[(Math.max(-M, Math.min(N + M - 1, i)) + M) * span + Math.max(-M, Math.min(N + M - 1, j)) + M]
  for (let i = -M; i < N + M; i++) for (let j = -M; j < N + M; j++) {
    const s = soft(i, j), w = isWet(i, j)
    const c = new Float32Array([
      carved(i, j),
      edgeMid(i, j, i - 1, j), edgeMid(i, j, i + 1, j), edgeMid(i, j, i, j - 1), edgeMid(i, j, i, j + 1),
      corner(i, j, i, j), corner(i, j, i, j + 1), corner(i, j, i + 1, j), corner(i, j, i + 1, j + 1),
    ])
    const along = (i2: number, j2: number) => (s || soft(i2, j2) ? SOFT : LAND)
    const near = isles.some((q) => Math.hypot(j + 0.5 - q.x, i + 0.5 - q.z) < q.r * 1.6 + 1)
    tiles[(i + M) * span + j + M] = { c, run: s ? SOFT : w ? WET : LAND, edge: [along(i - 1, j), along(i + 1, j), along(i, j - 1), along(i, j + 1)], soft: s, flat: s && !near && c.every((v) => v === c[0]) }
  }

  /** The ground's height at a world point, in the site's units. */
  const siteAt = (x: number, z: number) => {
    const i = Math.floor(z), j = Math.floor(x)
    const T = tileAt(i, j)
    const u = Math.max(0, Math.min(1, x - Math.max(-M, Math.min(N + M - 1, j)))), v = Math.max(0, Math.min(1, z - Math.max(-M, Math.min(N + M - 1, i))))
    const h = shapeAt(T, u, v)
    return T.soft ? islesAt(x, z, h) : h
  }
  const masks = new Map<string, number>()
  for (const [i, j] of d.road) masks.set(key(i, j), roadMask((a, b) => roads.has(key(a, b)), i, j))
  /** The ground's height at a world point (world y): on a street, the pavement a kerb's height above the road. */
  const heightAt = (x: number, z: number) => {
    const h = Y(siteAt(x, z)), m = masks.get(key(Math.floor(z), Math.floor(x)))
    return m === undefined ? h : h + liftAt(m, x - Math.floor(x), z - Math.floor(z))
  }

  /* ---- what the ground is, point by point ---- */
  const grassOf = (i: number, j: number) => new Color(GRASS[district(i, j)] ?? '#5a873c')
  const tileGrass = new Map<string, Color>()
  const grassAt = (x: number, z: number, own: [number, number]) => {
    // Shaded across tile middles, so a district's green fades into the next one's.
    const u = x - 0.5, v = z - 0.5, j0 = Math.floor(u), i0 = Math.floor(v), fu = u - j0, fv = v - i0
    const at = (i: number, j: number) => {
      const [ii, jj] = kind(i, j) === '1' ? [i, j] : own
      const k = key(ii, jj); let c = tileGrass.get(k); if (!c) { c = grassOf(ii, jj); tileGrass.set(k, c) }
      return c
    }
    return at(i0, j0).clone().lerp(at(i0, j0 + 1), fu).lerp(at(i0 + 1, j0).clone().lerp(at(i0 + 1, j0 + 1), fu), fv)
  }
  const bilerp = (x: number, z: number, f: (i: number, j: number) => number) => {
    const u = x - 0.5, v = z - 0.5, j0 = Math.floor(u), i0 = Math.floor(v), fu = u - j0, fv = v - i0
    return lerp(lerp(f(i0, j0), f(i0, j0 + 1), fu), lerp(f(i0 + 1, j0), f(i0 + 1, j0 + 1), fu), fv)
  }
  const beachy = (i: number, j: number) => (kind(i, j) === '1' ? 0 : 1)
  const badland = (i: number, j: number) => (kind(i, j) === '1' && district(i, j) === 'badlands' ? 1 : 0)

  // Shade where the ground is hemmed in: at the foot of a wall or a slope, and round what stands on it.
  const boxAt = new Map<string, Box[]>()
  for (const b of boxes) for (let i = Math.floor(b.i0 - 0.3); i <= b.i1 + 0.3; i++) for (let j = Math.floor(b.j0 - 0.3); j <= b.j1 + 0.3; j++) {
    const k = key(i, j); if (!boxAt.has(k)) boxAt.set(k, []); boxAt.get(k)!.push(b)
  }
  const occlusion = (x: number, z: number, y: number) => {
    let occ = 0
    for (const r of [0.14, 0.34]) for (let a = 0; a < 8; a++) {
      const dx = Math.cos((a / 8) * Math.PI * 2) * r, dz = Math.sin((a / 8) * Math.PI * 2) * r
      occ += Math.atan(Math.max(0, heightAt(x + dx, z + dz) - y) / r) / (Math.PI / 2)
    }
    let ao = 1 - 0.85 * (occ / 16)
    let byBox = 0
    for (const b of boxAt.get(key(Math.floor(z), Math.floor(x))) ?? []) {
      if (b.z0 > y + 0.06 || b.z1 < y + 0.1) continue
      const dx = Math.max(b.j0 - x, 0, x - b.j1), dz = Math.max(b.i0 - z, 0, z - b.i1)
      byBox = Math.max(byBox, (1 - smoothstep(0, 0.28, Math.hypot(dx, dz))) * 0.5)
    }
    ao *= 1 - byBox
    return Math.max(0.35, Math.min(1, ao))
  }

  const fieldAt = new Map<string, [number, number]>()
  const CROPS = ['lavender', 'wheat', 'greens']
  for (const [fi, fj, fw, fd, fk] of d.fields) for (let i = fi; i < fi + fw; i++) for (let j = fj; j < fj + fd; j++) fieldAt.set(key(i, j), [Math.max(0, CROPS.indexOf(fk)), fd >= fw ? 0 : 1])

  const geo = new Geo()
  const P = new Vector3(), Nn = new Vector3()

  /** A tile's slope (its normal) at a point inside it. */
  const slopeAt = (T: Tile, i: number, j: number, u: number, v: number) => {
    const e = 0.01, u0 = Math.max(0, u - e), u1 = Math.min(1, u + e), v0 = Math.max(0, v - e), v1 = Math.min(1, v + e)
    const hs = (uu: number, vv: number) => { const q = shapeAt(T, uu, vv); return T.soft ? islesAt(j + uu, i + vv, q) : q }
    return new Vector3(-(Y(hs(u1, v)) - Y(hs(u0, v))) / (u1 - u0), 1, -(Y(hs(u, v1)) - Y(hs(u, v0))) / (v1 - v0)).normalize()
  }
  /**
   * A street's tile: cells broken at the pavement's edge and the crossings, each lifted as liftAt says (the pavements a
   * kerb's height up, the dropped kerbs ramping down), and a face of granite wherever one cell stands above the next —
   * the kerbs — or above the ground next door.
   */
  const roadPatch = (i: number, j: number, T: Tile, surf: [number, number, number]) => {
    const m = surf[1], n = CUTS.length
    const ao = new Map<number, number>()
    const aoAt = (u: number, v: number, y: number) => { const kk = Math.round(u * 1000) * 2000 + Math.round(v * 1000); let a = ao.get(kk); if (a === undefined) { a = occlusion(j + u, i + v, y); ao.set(kk, a) } return a }
    const vert = (u: number, v: number, lift: number, nrm: Vector3) => {
      const x = j + u, z = i + v
      P.set(x, Y(shapeAt(T, u, v)) + lift, z)
      const snow = 0
      return geo.v(P, nrm, grassAt(x, z, [i, j]), surf, [bilerp(x, z, beachy), snow, bilerp(x, z, badland), aoAt(u, v, P.y - lift)])
    }
    const face = (a: Vector3, b: Vector3, c: Vector3, e: Vector3, nrm: Vector3) => {
      const ids = [a, b, c, e].map((q) => geo.v(q, nrm, KERB_TINT, surf, [bilerp(q.x, q.z, beachy), 0, 0, 0.75]))
      geo.tri(ids[0], ids[1], ids[2]); geo.tri(ids[0], ids[2], ids[3])
    }
    const lift = (u: number, v: number, cu: number, cv: number) => liftAt(m, u, v, cu, cv)
    for (let a = 0; a < n - 1; a++) for (let b = 0; b < n - 1; b++) {
      const v0 = CUTS[a], v1 = CUTS[a + 1], u0 = CUTS[b], u1 = CUTS[b + 1], cu = (u0 + u1) / 2, cv = (v0 + v1) / 2
      const ids = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => vert(u, v, lift(u, v, cu, cv), slopeAt(T, i, j, u, v)))
      geo.tri(ids[0], ids[1], ids[2]); geo.tri(ids[0], ids[2], ids[3])
      // The face towards the next cell east (u1) and south (v1), whichever side stands higher; at the tile's own edge,
      // towards the next tile (a street's, judged by its own lift; anything else stands at its plain height).
      const edges: [number, number, number, number, number, number, number, number][] = [
        // [ua, va, ub, vb, next cell's cu, cv, normal x, z] for the edge from (ua, va) to (ub, vb)
        [u1, v0, u1, v1, b + 1 < n - 1 ? (CUTS[b + 1] + CUTS[b + 2]) / 2 : -1, cv, 1, 0],
        [u0, v1, u1, v1, cu, a + 1 < n - 1 ? (CUTS[a + 1] + CUTS[a + 2]) / 2 : -1, 0, 1],
      ]
      if (b === 0) edges.push([u0, v0, u0, v1, -2, cv, -1, 0])
      if (a === 0) edges.push([u0, v0, u1, v0, cu, -2, 0, -1])
      for (const [ua, va, ub, vb, nu, nv, nx, nz] of edges) {
        const mine = [lift(ua, va, cu, cv), lift(ub, vb, cu, cv)]
        let theirs: number[]
        if (nu >= 0 && nv >= 0) theirs = [lift(ua, va, nu, nv), lift(ub, vb, nu, nv)]
        else {
          // Across the tile's edge: the neighbour's own lift there, if it is a street (it makes its own face if higher).
          const ni = i + (nv === -1 ? 1 : nv === -2 ? -1 : 0), nj = j + (nu === -1 ? 1 : nu === -2 ? -1 : 0)
          const mm = masks.get(key(ni, nj))
          const tu = (u: number) => (nj !== j ? 1 - u : u), tv = (v: number) => (ni !== i ? 1 - v : v)
          theirs = mm === undefined ? [0, 0] : [liftAt(mm, tu(ua), tv(va), tu(cu), tv(cv)), liftAt(mm, tu(ub), tv(vb), tu(cu), tv(cv))]
          if (mm !== undefined && (mine[0] < theirs[0] - 1e-6 || mine[1] < theirs[1] - 1e-6)) continue
        }
        const hi = mine[0] + mine[1] >= theirs[0] + theirs[1] ? 1 : -1
        if (Math.abs(mine[0] - theirs[0]) < 1e-6 && Math.abs(mine[1] - theirs[1]) < 1e-6) continue
        const ya = Y(shapeAt(T, ua, va)), yb = Y(shapeAt(T, ub, vb))
        const top = hi > 0 ? mine : theirs, bot = hi > 0 ? theirs : mine
        face(new Vector3(j + ua, ya + bot[0], i + va), new Vector3(j + ub, yb + bot[1], i + vb), new Vector3(j + ub, yb + top[1], i + vb), new Vector3(j + ua, ya + top[0], i + va), new Vector3(nx * hi, 0, nz * hi))
      }
    }
  }

  /* ---- each tile's patch ---- */
  for (let i = -M; i < N + M; i++) for (let j = -M; j < N + M; j++) {
    const T = tileAt(i, j), k = kind(i, j), r = T.flat ? 1 : R
    const isRoad = roads.has(key(i, j)), field = fieldAt.get(key(i, j))
    let surf: [number, number, number]
    if (k === '0') surf = [SURF.sea, 0, 0]
    else if (isRoad) {
      // (Cobbled in the old town.)
      surf = [SURF.road, masks.get(key(i, j))!, district(i, j) === 'oldtown' ? 1 : 0]
      roadPatch(i, j, T, surf)
      continue
    } else if (field) surf = [SURF.field, field[0], field[1]]
    else if (isWet(i, j)) surf = [SURF.bed, 0, 0]
    else surf = [SURF.land, 0, 0]
    const base = new Array<number>((r + 1) * (r + 1))
    for (let a = 0; a <= r; a++) for (let b = 0; b <= r; b++) {
      const u = b / r, v = a / r, x = j + u, z = i + v
      let h = shapeAt(T, u, v); if (T.soft) h = islesAt(x, z, h)
      // Its slope, from inside the tile (an edge on a wall is the top of the wall, not half-way down it).
      const e = 0.01, u0 = Math.max(0, u - e), u1 = Math.min(1, u + e), v0 = Math.max(0, v - e), v1 = Math.min(1, v + e)
      const hs = (uu: number, vv: number) => { const q = shapeAt(T, uu, vv); return T.soft ? islesAt(j + uu, i + vv, q) : q }
      const dx = (Y(hs(u1, v)) - Y(hs(u0, v))) / (u1 - u0), dz = (Y(hs(u, v1)) - Y(hs(u, v0))) / (v1 - v0)
      Nn.set(-dx, 1, -dz).normalize()
      P.set(x, Y(h), z)
      let col: Color
      if (k === '0' || (T.soft && k !== 'b')) col = SAND.clone().lerp(DEEP, Math.pow(Math.max(0, Math.min(1, (seaY - P.y - 0.04) / 0.95)), 0.8))
      else col = grassAt(x, z, [i, j])
      const sand = bilerp(x, z, beachy)
      const snow = district(i, j) === 'peaks' ? Math.max(0, Math.min(1, (h - 40) / 16)) : 0
      const ao = T.flat ? 1 : occlusion(x, z, P.y)
      base[a * (r + 1) + b] = geo.v(P, Nn, col, surf, [sand, snow, bilerp(x, z, badland), ao])
    }
    for (let a = 0; a < r; a++) for (let b = 0; b < r; b++) {
      const p00 = base[a * (r + 1) + b], p01 = base[a * (r + 1) + b + 1], p10 = base[(a + 1) * (r + 1) + b], p11 = base[(a + 1) * (r + 1) + b + 1]
      geo.tri(p00, p01, p11); geo.tri(p00, p11, p10)
    }
  }

  /* ---- the walls where tiles do not join ---- */
  const SIDES: { di: number; dj: number; out: [number, number]; at: (s: number) => [number, number]; there: (s: number) => [number, number] }[] = [
    { di: -1, dj: 0, out: [0, -1], at: (s) => [s, 0], there: (s) => [s, 1] },
    { di: 1, dj: 0, out: [0, 1], at: (s) => [s, 1], there: (s) => [s, 0] },
    { di: 0, dj: -1, out: [-1, 0], at: (s) => [0, s], there: (s) => [1, s] },
    { di: 0, dj: 1, out: [1, 0], at: (s) => [1, s], there: (s) => [0, s] },
  ]
  for (let i = -M; i < N + M; i++) for (let j = -M; j < N + M; j++) {
    if (soft(i, j) && kind(i, j) === '0') continue
    const T = tileAt(i, j)
    for (const S of SIDES) {
      const i2 = i + S.di, j2 = j + S.dj
      if (joined(i, j, i2, j2)) continue
      const U = tileAt(i2, j2)
      // Cut stone where a road or a plot was levelled; rock anywhere else (sandstone in the badlands).
      const cut = pinned.has(key(i, j)) || pinned.has(key(i2, j2))
      const tint = new Color(cut ? '#8a847b' : district(i, j) === 'badlands' ? SANDSTONE : ROCK)
      const surf: [number, number, number] = [cut ? SURF.stone : SURF.rock, 0, 0]
      const tops: number[] = [], bots: number[] = []
      for (let q = 0; q <= R; q++) {
        const s = q / R, [u, v] = S.at(s), [u2, v2] = S.there(s)
        tops.push(Y(shapeAt(T, u, v))); bots.push(Y(U.soft ? islesAt(j2 + u2, i2 + v2, shapeAt(U, u2, v2)) : shapeAt(U, u2, v2)))
      }
      if (tops.every((t, q) => t <= bots[q] + 0.004)) continue
      const tall = Math.max(...tops.map((t, q) => t - bots[q]))
      // (Rock in finer rows, to carry its relief; cut stone stays plain.)
      const rows = Math.max(1, Math.min(cut ? 8 : 18, Math.ceil(tall / (cut ? 0.09 : 0.04))))
      const [ox, oz] = S.out
      // Rock stands out in buttresses and falls back in gullies, more the taller the cliff (half a metre on a sea cliff), with
      // ledges and knobs on that; cut stone stays straight.
      const relief = Math.min(1.2, Math.max(0.3, tall / 0.4))
      const bulge = (wx: number, wy: number, wz: number) => (cut ? 0 : ((noise3(wx * 3.1, wy * 2.2, wz * 3.1) - 0.5) * 0.11 + (noise3(wx * 9, wy * 9, wz * 9) - 0.5) * 0.045) * relief + (noise3(wx * 23, wy * 23, wz * 23) - 0.5) * 0.018)
      const grid: number[][] = []
      for (let q = 0; q <= R; q++) {
        const s = q / R, [u, v] = S.at(s), x0 = j + u, z0 = i + v
        const col: number[] = []
        for (let rr = 0; rr <= rows; rr++) {
          const t = rr / rows, y = lerp(bots[q], tops[q], t)
          const inner = rr > 0 && rr < rows && q > 0 && q < R
          const o = inner ? bulge(x0, y, z0) : 0
          P.set(x0 + ox * o, y, z0 + oz * o)
          // Its normal: straight out, leaning with the bulge.
          const e = 0.01
          const dS = inner ? (bulge(x0 + (oz ? e : 0), y, z0 + (ox ? e : 0)) - bulge(x0 - (oz ? e : 0), y, z0 - (ox ? e : 0))) / (2 * e) : 0
          const dY = inner ? (bulge(x0, y + e, z0) - bulge(x0, y - e, z0)) / (2 * e) : 0
          // (Along the edge is x on a north or south edge, z on a west or east one.)
          Nn.set(ox + (oz ? -dS : 0), -dY, oz + (ox ? -dS : 0)).normalize()
          const ao = 0.55 + 0.45 * smoothstep(0, 0.3, y - bots[q])
          // (A stream's or the pond's wall, wet up to just above its water.)
          const wetTo = isWet(i, j) ? Y(top(i, j) - 1) : isWet(i2, j2) ? Y(top(i2, j2) - 1) : -99
          col.push(geo.v(P, Nn, tint, surf, [1 - smoothstep(wetTo + 0.004, wetTo + 0.02, y), 0, 0, ao]))
        }
        grid.push(col)
      }
      for (let q = 0; q < R; q++) {
        if (tops[q] <= bots[q] + 0.004 && tops[q + 1] <= bots[q + 1] + 0.004) continue
        for (let rr = 0; rr < rows; rr++) { geo.tri(grid[q][rr], grid[q + 1][rr], grid[q + 1][rr + 1]); geo.tri(grid[q][rr], grid[q + 1][rr + 1], grid[q][rr + 1]) }
      }
    }
  }

  /* ---- the rocks off the coast ---- */
  const rockBoxes: Box[] = []
  const rock = (cx: number, cz: number, rx: number, up: number, seed: number) => {
    const floor = heightAt(cx, cz), mid = seaY - 0.06, topY = seaY + up
    const tint = new Color('#6e6a66')
    const LAT = 9, LON = 14
    const at = (la: number, lo: number) => {
      const t = -Math.PI / 2 + (la / LAT) * Math.PI, p = (lo / LON) * Math.PI * 2
      const dx = Math.cos(t) * Math.sin(p), dz = Math.cos(t) * Math.cos(p), dy = Math.sin(t)
      const k = 0.7 + 0.6 * noise3(dx * 1.8 + seed, dy * 1.8, dz * 1.8 - seed) + 0.12 * noise3(dx * 5 + seed, dy * 5, dz * 5)
      // Above the water a craggy dome; below, flaring out to the floor it stands on.
      return dy >= 0 ? new Vector3(cx + dx * rx * k, mid + dy * (topY - mid) * k, cz + dz * rx * k) : new Vector3(cx + dx * rx * k * (1 - dy * 0.5), mid + dy * (mid - floor + 0.05), cz + dz * rx * k * (1 - dy * 0.5))
    }
    for (let la = 0; la < LAT; la++) for (let lo = 0; lo < LON; lo++) {
      const a = at(la, lo), b = at(la, lo + 1), c = at(la + 1, lo + 1), e = at(la + 1, lo)
      for (const [p, q, s] of [[a, b, c], [a, c, e]] as Vector3[][]) {
        const n = new Vector3().subVectors(q, p).cross(new Vector3().subVectors(s, p))
        if (n.lengthSq() < 1e-12) continue
        n.normalize()
        // Outwards, away from the rock's heart.
        if (n.dot(new Vector3((p.x + q.x + s.x) / 3 - cx, (p.y + q.y + s.y) / 3 - mid, (p.z + q.z + s.z) / 3 - cz)) < 0) n.negate()
        const ids = [p, q, s].map((v) => geo.v(v, n, tint, [SURF.rock, 0, 0], [0, 0, 0, 0.7 + 0.3 * smoothstep(seaY - 0.2, topY, v.y)]))
        geo.tri(ids[0], ids[1], ids[2])
      }
    }
    rockBoxes.push({ i0: cz - rx * 0.7, i1: cz + rx * 0.7, j0: cx - rx * 0.7, j1: cx + rx * 0.7, z0: floor, z1: topY * 0.9 + mid * 0.1 })
  }
  d.seaRocks.forEach(([i, j, k], n) => {
    const cx = j + 0.5, cz = i + 0.5
    rock(cx, cz, 0.34 * k, 0.3 * k, n * 3.7)
    rock(cx + 0.32 * k, cz - 0.18 * k, 0.16 * k, 0.12 * k, n * 3.7 + 11)
    rock(cx - 0.22 * k, cz + 0.28 * k, 0.12 * k, 0.07 * k, n * 3.7 + 23)
  })

  /* ---- what lies about: boulders at the cliffs' feet and on the beaches, pebbles, driftwood at the tide line ---- */
  // (Seeded, so the island is the same every visit.)
  let seed = 0x51ed
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const scattered: { x: number; z: number; r: number }[] = []
  const coastRocks: { x: number; z: number; r: number }[] = []
  /** Room for a stone (or a log) at a point: not on a street, not in or against anything built, not in the stream. */
  const room = (x: number, z: number, r: number) => {
    const i = Math.floor(z), j = Math.floor(x)
    for (const [a, b] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const ii = Math.floor(z + b), jj = Math.floor(x + a); if (roads.has(key(ii, jj)) || isWet(ii, jj)) return false }
    // (Nor anywhere on a building's plot: its forecourt is swept.)
    if (d.buildings.some((b) => x > b.j - r && x < b.j + b.d + r && z > b.i - r && z < b.i + b.w + r)) return false
    return !(boxAt.get(key(i, j)) ?? []).some((bx) => x > bx.j0 - r - 0.02 && x < bx.j1 + r + 0.02 && z > bx.i0 - r - 0.02 && z < bx.i1 + r + 0.02)
  }
  /** A stone lying on the ground, sunk a third into it: a lumpy, flattened ball. */
  const stone = (cx: number, cz: number, r: number, flat: number, sd: number) => {
    if (!room(cx, cz, r)) return
    const floor = heightAt(cx, cz), LA = r > 0.02 ? 6 : 4, LO = r > 0.02 ? 9 : 6
    const at = (la: number, lo: number) => {
      const t = -Math.PI / 2 + (la / LA) * Math.PI, ph = (lo / LO) * Math.PI * 2
      const dx = Math.cos(t) * Math.sin(ph), dz = Math.cos(t) * Math.cos(ph), dy = Math.sin(t)
      const k = 0.75 + 0.5 * noise3(dx * 1.7 + sd, dy * 1.7, dz * 1.7 - sd)
      return new Vector3(cx + dx * r * k, floor - r * flat * 0.35 + (dy + 0.35) * r * flat * k, cz + dz * r * k)
    }
    for (let la = 0; la < LA; la++) for (let lo = 0; lo < LO; lo++) {
      const a = at(la, lo), b = at(la, lo + 1), c = at(la + 1, lo + 1), e = at(la + 1, lo)
      for (const [p0, q, w] of [[a, b, c], [a, c, e]] as Vector3[][]) {
        const nn = new Vector3().subVectors(q, p0).cross(new Vector3().subVectors(w, p0))
        if (nn.lengthSq() < 1e-14) continue
        nn.normalize()
        if (nn.dot(new Vector3((p0.x + q.x + w.x) / 3 - cx, (p0.y + q.y + w.y) / 3 - floor, (p0.z + q.z + w.z) / 3 - cz)) < 0) nn.negate()
        const ids = [p0, q, w].map((v) => geo.v(v, nn, new Color(ROCK), [SURF.rock, 0, 0], [0, 0, 0, 0.6 + 0.4 * smoothstep(floor, floor + r * flat, v.y)]))
        geo.tri(ids[0], ids[1], ids[2])
      }
    }
    scattered.push({ x: cx, z: cz, r })
    if (r > 0.05) rockBoxes.push({ i0: cz - r * 0.7, i1: cz + r * 0.7, j0: cx - r * 0.7, j1: cx + r * 0.7, z0: floor - 0.02, z1: floor + r * flat * 0.6 })
  }
  /** A bleached log the sea left: a bent, tapering cylinder lying along the tide line. */
  const driftwood = (cx: number, cz: number, len: number, yaw: number) => {
    if (!room(cx, cz, len / 2)) return
    const SEG = 6, SIDES = 7, ring: number[][] = []
    const dir = new Vector3(Math.cos(yaw), 0, Math.sin(yaw)), side = new Vector3(-Math.sin(yaw), 0, Math.cos(yaw))
    for (let s2 = 0; s2 <= SEG; s2++) {
      const t = s2 / SEG, rr = (0.11 - 0.05 * t) * METRE * (1 + 0.15 * Math.sin(t * 9))
      const c = new Vector3(cx, 0, cz).addScaledVector(dir, (t - 0.5) * len).addScaledVector(side, Math.sin(t * 3.1) * len * 0.06)
      c.y = heightAt(c.x, c.z) + rr * 0.55
      const ids: number[] = []
      for (let q = 0; q <= SIDES; q++) {
        const a = (q / SIDES) * Math.PI * 2, nn = side.clone().multiplyScalar(Math.cos(a)).add(new Vector3(0, Math.sin(a), 0))
        ids.push(geo.v(c.clone().addScaledVector(nn, rr), nn, new Color('#a59d90'), [SURF.wood, 0, 0], [0, 0, 0, 0.75 + 0.25 * Math.max(0, nn.y)]))
      }
      ring.push(ids)
    }
    for (let s2 = 0; s2 < SEG; s2++) for (let q = 0; q < SIDES; q++) { geo.tri(ring[s2][q], ring[s2 + 1][q], ring[s2 + 1][q + 1]); geo.tri(ring[s2][q], ring[s2 + 1][q + 1], ring[s2][q + 1]) }
    scattered.push({ x: cx, z: cz, r: len / 2 })
  }
  for (let i = -1; i <= N; i++) for (let j = -1; j <= N; j++) {
    const k = kind(i, j)
    if (k === 'b') {
      // A beach: pebbles in drifts, now and then a boulder; driftwood at the tide line.
      const nearRock = d.seaRocks.some(([a, b]) => Math.hypot(a - i, b - j) < 3) || [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => kind(i + a, j + b) === '1' && !joined(i, j, i + a, j + b))
      const pebbles = nearRock ? 10 : rnd() < 0.35 ? 4 : 0
      const cx0 = j + rnd(), cz0 = i + rnd()
      for (let q = 0; q < pebbles; q++) stone(cx0 + (rnd() - 0.5) * 0.25, cz0 + (rnd() - 0.5) * 0.25, (0.03 + rnd() * 0.06) * METRE, 0.6 + rnd() * 0.3, rnd() * 40)
      if (nearRock && rnd() < 0.6) stone(j + 0.2 + rnd() * 0.6, i + 0.2 + rnd() * 0.6, (0.35 + rnd() * 0.5) * METRE, 0.55 + rnd() * 0.3, rnd() * 40)
      // (At the tide line: where the sand is only just above the sea.)
      for (let t = 0; t < 4; t++) {
        const x = j + rnd(), z = i + rnd(), h = heightAt(x, z)
        if (h > seaY + 0.01 && h < seaY + 0.05 && rnd() < 0.22) { driftwood(x, z, (1.2 + rnd() * 1.6) * METRE, rnd() * Math.PI); break }
      }
    }
    if (k === '1') {
      // A sea cliff: rocks standing in the sea along its foot, a bigger one off each corner — the coast is not a
      // block's edge (the sea foams round them, and they are solid).
      const sea = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => kind(i + a, j + b) === '0' && !joined(i, j, i + a, j + b))
      for (const [a, b] of sea) {
        const n = 1 + (rnd() < 0.5 ? 1 : 0)
        for (let q = 0; q < n; q++) {
          const along = 0.15 + rnd() * 0.7, out = 0.03 + rnd() * 0.07
          const x = j + (b === 0 ? along : b > 0 ? 1 + out : -out), z = i + (a === 0 ? along : a > 0 ? 1 + out : -out)
          const rx = 0.11 + rnd() * 0.14
          rock(x, z, rx, 0.06 + rnd() * 0.12, rnd() * 50); coastRocks.push({ x, z, r: rx })
        }
      }
      for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        if (!sea.some(([p1, q1]) => p1 === a && q1 === 0) || !sea.some(([p1, q1]) => p1 === 0 && q1 === b)) continue
        const x = j + (b > 0 ? 1.04 : -0.04), z = i + (a > 0 ? 1.04 : -0.04), rx = 0.2 + rnd() * 0.12
        rock(x, z, rx, 0.12 + rnd() * 0.14, rnd() * 50); coastRocks.push({ x, z, r: rx })
      }
    }
    if (k === '1' && !roads.has(key(i, j)) && !isWet(i, j)) {
      // The foot of a cliff or a rock wall: fallen stones.
      for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (joined(i, j, i + a, j + b) || pinned.has(key(i, j)) || pinned.has(key(i + a, j + b))) continue
        if (top(i + a, j + b) <= top(i, j) + 4 || rnd() > 0.45) continue
        // (Along the wall's foot, on this side of it.)
        const along = 0.15 + rnd() * 0.7, off = 0.06 + rnd() * 0.08
        const x = j + (b === 0 ? along : b > 0 ? 1 - off : off), z = i + (a === 0 ? along : a > 0 ? 1 - off : off)
        if (boxAt.get(key(i, j))?.some((bx) => x > bx.j0 - 0.1 && x < bx.j1 + 0.1 && z > bx.i0 - 0.1 && z < bx.i1 + 0.1)) continue
        stone(x, z, (0.25 + rnd() * 0.45) * METRE, 0.6 + rnd() * 0.3, rnd() * 40)
        for (let q = 0; q < 3; q++) stone(x + (rnd() - 0.5) * 0.12, z + (rnd() - 0.5) * 0.12, (0.05 + rnd() * 0.1) * METRE, 0.7, rnd() * 40)
      }
    }
  }

  /* ---- water in the stream and the pond ---- */
  // Each stretch of the stream runs on to the next (the river is listed downstream); where it reaches the
  // sea's edge it pours over the cliff. Each piece of water says which way it runs: [x, z, what it is]
  // (0 still, 1 running, 2 falling).
  const pools: number[] = [], flow: number[] = []
  const quad = (a: Vector3, b: Vector3, c: Vector3, e: Vector3, fl: [number, number, number]) => {
    for (const p of [a, c, b, a, e, c]) { pools.push(p.x, p.y, p.z); flow.push(...fl) }
  }
  const flows = new Map<string, [number, number]>(), levels = new Map<string, number>()
  const falls: { x: number; z: number }[] = []
  const river = d.river.filter(([i, j]) => isWet(i, j))
  river.forEach(([i, j], n) => {
    const next = river[n + 1], prev = river[n - 1]
    const sea = SIDES.find((S) => kind(i + S.di, j + S.dj) === '0')
    let dir: [number, number] = [0, 1]
    if (next && Math.abs(next[0] - i) + Math.abs(next[1] - j) === 1) dir = [next[1] - j, next[0] - i]
    else if (sea) dir = [sea.dj, sea.di]
    else if (prev) dir = [j - prev[1], i - prev[0]]
    flows.set(key(i, j), dir)
  })
  for (const [i, j] of [...river, ...d.pond.filter(([i, j]) => isWet(i, j))]) {
    const y = Y(top(i, j) - 1), dir = flows.get(key(i, j))
    levels.set(key(i, j), y)
    quad(new Vector3(j - 0.01, y, i - 0.01), new Vector3(j + 1.01, y, i - 0.01), new Vector3(j + 1.01, y, i + 1.01), new Vector3(j - 0.01, y, i + 1.01), dir ? [dir[0], dir[1], 1] : [0, 0, 0])
    for (const S of SIDES) {
      const i2 = i + S.di, j2 = j + S.dj
      // Down to the next stretch of the stream, where it is lower: a little fall.
      if (isWet(i2, j2) && top(i2, j2) < top(i, j)) {
        const y2 = Y(top(i2, j2) - 1), [u0, v0] = S.at(0.12), [u1, v1] = S.at(0.88)
        quad(new Vector3(j + u0, y, i + v0), new Vector3(j + u1, y, i + v1), new Vector3(j + u1, y2, i + v1), new Vector3(j + u0, y2, i + v0), [S.dj, S.di, 2])
      }
      // Off the land, over the cliff and into the sea.
      if (kind(i2, j2) === '0' && dir && dir[0] === S.dj && dir[1] === S.di) {
        const [u0, v0] = S.at(0.22), [u1, v1] = S.at(0.78), o = 0.016, [ox, oz] = S.out
        const bottom = seaY - 0.02
        quad(new Vector3(j + u0 + ox * o, y, i + v0 + oz * o), new Vector3(j + u1 + ox * o, y, i + v1 + oz * o), new Vector3(j + u1 + ox * o * 3, bottom, i + v1 + oz * o * 3), new Vector3(j + u0 + ox * o * 3, bottom, i + v0 + oz * o * 3), [S.dj, S.di, 2])
        falls.push({ x: j + (u0 + u1) / 2 + ox * 0.05, z: i + (v0 + v1) / 2 + oz * 0.05 })
      }
    }
  }
  const poolGeo = new BufferGeometry()
  poolGeo.setAttribute('position', new Float32BufferAttribute(pools, 3))
  poolGeo.setAttribute('aFlow', new Float32BufferAttribute(flow, 3))
  poolGeo.computeVertexNormals()
  const tileKey = (x: number, z: number) => key(Math.floor(z), Math.floor(x))
  /** Which way a stream carries you at a point (world x, z per second's push), if it runs there. */
  const flowAt = (x: number, z: number) => flows.get(tileKey(x, z)) ?? null
  /** The stream's or the pond's surface at a point, if there is one. */
  const poolAt = (x: number, z: number) => levels.get(tileKey(x, z)) ?? null
  const rocks = [...d.seaRocks.map(([i, j, k]) => ({ x: j + 0.5, z: i + 0.5, r: 0.34 * k })), ...coastRocks]

  /**
   * Whether grass grows at a point, and its green (flora.ts plants tufts by it): on land, not a street, a field,
   * the stream or the pond; not on sand, the badlands' earth, the peaks' snow, or a slope too steep to hold it.
   */
  const meadow = (x: number, z: number): Color | null => {
    const i = Math.floor(z), j = Math.floor(x)
    if (kind(i, j) !== '1' || roads.has(key(i, j)) || fieldAt.has(key(i, j)) || isWet(i, j)) return null
    if (bilerp(x, z, beachy) > 0.36 || bilerp(x, z, badland) > 0.3) return null
    const h = siteAt(x, z)
    if (district(i, j) === 'peaks' && h > 41) return null
    for (const q of scattered) if (Math.abs(q.x - x) < q.r + 0.01 && Math.abs(q.z - z) < q.r + 0.01) return null
    const e = 0.05, dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e)
    if (Math.hypot(dx, dz) / (2 * e) > 0.75) return null
    return grassAt(x, z, [i, j])
  }
  /*
   * The island's own large-scale variation, one texel to a metre and a half: how light or dark the ground is (red),
   * where grass is worn to earth and lanes were resurfaced (green), leaf litter under the trees (blue, laid once the
   * trees are grown: litter()), and the rock among the sand under the sea (alpha).
   */
  const MAC = 256
  const mac = new Uint8Array(MAC * MAC * 4)
  const fbm = (x: number, z: number, o: number) => (noise3(x, z, o) * 0.5 + noise3(x * 2.03, z * 2.03, o + 3) * 0.25 + noise3(x * 4.1, z * 4.1, o + 7) * 0.125) / 0.875
  for (let y = 0; y < MAC; y++) for (let x = 0; x < MAC; x++) {
    const wx = ((x + 0.5) / MAC) * span - M, wz = ((y + 0.5) / MAC) * span - M, q = (y * MAC + x) * 4
    mac[q] = Math.round(Math.max(0, Math.min(1, fbm(wx * 0.6, wz * 0.6, 1.3))) * 255)
    mac[q + 1] = Math.round(Math.max(0, Math.min(1, fbm(wx * 1.1, wz * 1.1, 9.1))) * 255)
    mac[q + 2] = 0
    mac[q + 3] = Math.round(Math.max(0, Math.min(1, fbm(wx * 0.8, wz * 0.8, 21.7))) * 255)
  }
  const macro = new DataTexture(mac, MAC, MAC, RGBAFormat)
  macro.magFilter = LinearFilter; macro.minFilter = LinearFilter; macro.wrapS = macro.wrapT = ClampToEdgeWrapping; macro.needsUpdate = true
  /** Leaf litter under the trees (flora.ts tells where they stand, and how wide their crowns are). */
  const litter = (trees: { x: number; z: number; r: number }[]) => {
    for (const t of trees) {
      const r = t.r * 1.6, x0 = Math.floor(((t.x - r + M) / span) * MAC), x1 = Math.ceil(((t.x + r + M) / span) * MAC), y0 = Math.floor(((t.z - r + M) / span) * MAC), y1 = Math.ceil(((t.z + r + M) / span) * MAC)
      for (let y = Math.max(0, y0); y <= Math.min(MAC - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(MAC - 1, x1); x++) {
        const wx = ((x + 0.5) / MAC) * span - M, wz = ((y + 0.5) / MAC) * span - M, dd = Math.hypot(wx - t.x, wz - t.z)
        const v = Math.round((1 - smoothstep(r * 0.35, r, dd)) * 255), q = (y * MAC + x) * 4 + 2
        if (v > mac[q]) mac[q] = v
      }
    }
    macro.needsUpdate = true
  }
  /** What the ground's shader is handed from outside: the photographs (ground.ts), how they are laid (the level), the prints (foot.ts). */
  const ground = {
    tGC: { value: null as Texture | null }, tGD: { value: null as Texture | null }, uGQ: { value: 2 },
    tFoot: { value: null as Texture | null }, uFoot: { value: new Vector4(0, 0, 1, 0) },
    tMacro: { value: macro as Texture }, uMacro: { value: new Vector4(M, M, 1 / span, 0) },
    /** The caustics the sea's waves cast on the floor (water.ts hands over its baked net and how its waves drift). */
    tCaus: { value: null as Texture | null }, uCausDet: { value: new Vector2(1, 1) }, uCausDrift: { value: new Vector4() },
  }
  const causticK = { value: 1 }
  const mesh = new Mesh(geo.geometry(), groundMaterial(seaY, time, causticK, ground))
  // It takes the shadows of all that stands on it (its own would only speckle it: the shading at the foot of each wall is its own).
  mesh.receiveShadow = true
  return { mesh, poolGeo, rockBoxes, rocks, falls, flowAt, poolAt, caustics: causticK, meadow, heightAt, siteAt, top, kind, joined, pinned, ground, litter, scattered, masks }
}

function smoothstep(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/* ---- what the ground is made of: photographed, laid where it is ---------- */
// (The layers' numbers, as the shader knows them.)
const LAYER_DEFS = GROUND.map((g, k) => `#define L_${g.key.toUpperCase().replace(/-/g, '_')} ${k}.0`).join('\n')

const GROUND_HEAD = /* glsl */ `
${LAYER_DEFS}
#define NL ${GROUND.length}
uniform float uSeaY;
uniform float uWet;
uniform float uRain;
uniform float uTime;
uniform float uCaustic;
uniform sampler2D tCaus;
uniform vec2 uCausDet;
uniform vec4 uCausDrift;
uniform sampler2DArray tGC, tGD;
uniform float uGS[NL];
uniform float uGH[NL];
uniform float uGQ;
uniform sampler2D tMacro;
uniform vec4 uMacro;
uniform sampler2D tFoot;
uniform vec4 uFoot;
uniform vec3 uGrassRef;
varying vec3 vTW;
varying vec3 vTN;
varying vec3 vTSurf;
varying vec4 vTBlend;
float tRough;
float tMetal;
float tBump;
float tAO;
vec3 tNW;
float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tFbm(vec2 p) { return (tNoise(p) * 0.5 + tNoise(p * 2.03 + 7.1) * 0.25 + tNoise(p * 4.01 + 3.7) * 0.125) / 0.875; }
// How far a point is from the nearest crack between irregular cells (dried mud, crazed asphalt, the light under water).
float tCells(vec2 p) {
  vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    float d = length(g + vec2(tHash(i + g), tHash(i + g + 17.3)) - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1;
}
float tBit(float m, float b) { return mod(floor(m / b + 0.01), 2.0); }
vec3 tPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
#define SRGB(r, g, b) pow(vec3(r, g, b), vec3(2.2))

// A surface, sampled: its colour, height, normal (x, y in its plane), roughness and occlusion.
struct G { vec3 c; float h; vec2 n; float r; float ao; };
G gFetch(float L, vec2 uv, vec2 dx, vec2 dy) {
  vec4 a = textureGrad(tGC, vec3(uv, L), dx, dy), b = textureGrad(tGD, vec3(uv, L), dx, dy);
  G g; g.c = a.rgb; g.h = a.a; g.n = b.xy * 2.0 - 1.0; g.r = b.z; g.ao = b.w; return g;
}
vec2 gHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
// One of hex-tiling's three copies: the photograph turned and shifted by a vertex of a triangular grid.
G gHexTap(float L, vec2 uv, vec2 dx, vec2 dy, vec2 v) {
  vec2 cen = vec2(v.x + 0.5 * v.y, 0.8660254 * v.y) / 3.4641016;
  vec2 hv = gHash2(v);
  float a = hv.x * 6.2831853, ca = cos(a), sa = sin(a);
  mat2 R = mat2(ca, sa, -sa, ca);
  G g = gFetch(L, R * (uv - cen) + cen + hv * 7.31, R * dx, R * dy);
  g.n = transpose(R) * g.n;
  return g;
}
// Hex-tiling (Mikkelsen 2022): three turned copies over a triangular grid, blended by nearness and by height, so the
// photograph never repeats where it can be seen and its detail stays sharp (the proudest copy wins, not an average).
G gHex(float L, vec2 uv, vec2 dx, vec2 dy) {
  vec2 st = uv * 3.4641016;
  vec2 sk = vec2(st.x - 0.57735027 * st.y, 1.15470054 * st.y);
  vec2 base = floor(sk); vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  float s = step(0.0, -t.z), s2 = 2.0 * s - 1.0;
  vec3 w = vec3(-t.z * s2, s - t.y * s2, s - t.x * s2);
  G a = gHexTap(L, uv, dx, dy, base + vec2(s, s));
  G b = gHexTap(L, uv, dx, dy, base + vec2(s, 1.0 - s));
  G c = gHexTap(L, uv, dx, dy, base + vec2(1.0 - s, s));
  vec3 W = pow(max(w * (vec3(a.h, b.h, c.h) * 0.8 + 0.6), 1e-4), vec3(7.0));
  W /= W.x + W.y + W.z;
  G g; g.c = a.c * W.x + b.c * W.y + c.c * W.z; g.h = a.h * W.x + b.h * W.y + c.h * W.z; g.n = a.n * W.x + b.n * W.y + c.n * W.z;
  g.r = a.r * W.x + b.r * W.y + c.r * W.z; g.ao = a.ao * W.x + b.ao * W.y + c.ao * W.z;
  return g;
}
// A layer laid flat over a plane's coordinates: hex-tiled at the top level if it is natural; at the middle level,
// once, with a second, larger and turned copy's colour under it (so the eye finds no grid); plain at the lowest.
G gLayH(float L, vec2 q, vec2 qx, vec2 qy, bool hex) {
  int k = int(L + 0.5);
  float sc = uGS[k];
  vec2 uv = q * sc, dx = qx * sc, dy = qy * sc;
  if (hex && uGQ > 1.5 && uGH[k] > 0.5) return gHex(L, uv, dx, dy);
  G g = gFetch(L, uv, dx, dy);
  if (hex && uGQ > 0.5 && uGH[k] > 0.5) {
    const mat2 R = mat2(0.809, 0.588, -0.588, 0.809);
    vec3 big = textureGrad(tGC, vec3(R * uv * 0.27 + 0.37, L), R * dx * 0.27, R * dy * 0.27).rgb;
    g.c *= mix(vec3(1.0), big / max(dot(big, vec3(0.333)), 1e-3) * dot(g.c, vec3(0.333)) / max(dot(g.c, vec3(0.333)), 1e-3), 0.5);
  }
  return g;
}
G gLay(float L, vec2 q, vec2 qx, vec2 qy) { return gLayH(L, q, qx, qy, true); }
// Parallax: the photograph's height looked into along the line of sight, so cobbles stand up out of their joints
// close to (and only close to) the camera. View: towards the eye, in the plane's own coordinates (x, y; up is z).
vec2 gPom(float L, vec2 q, vec2 qx, vec2 qy, vec3 view, float depth) {
  int k = int(L + 0.5);
  float sc = uGS[k];
  vec2 uv = q * sc, dx = qx * sc, dy = qy * sc;
  // (More steps the more the surface is seen edge-on; their number known only as it runs, so it is not unrolled.)
  int steps = int(mix(6.0, 14.0, 1.0 - clamp(view.z, 0.0, 1.0)));
  vec2 stepUV = -view.xy / max(view.z, 0.25) * depth * sc / float(steps);
  float lay = 1.0 / float(steps), d = 0.0, h = 1.0 - textureGrad(tGC, vec3(uv, L), dx, dy).a, hp = h;
  vec2 o = vec2(0.0), op = o;
  for (int i = 0; i < steps; i++) {
    if (d >= h) break;
    op = o; hp = h; d += lay; o += stepUV;
    h = 1.0 - textureGrad(tGC, vec3(uv + o, L), dx, dy).a;
  }
  float a = h - d, b = hp - (d - lay), t = a / min(a - b, -1e-4);
  return mix(o, op, clamp(t, 0.0, 1.0)) / sc;
}
// One surface laid over another, by height: where the second is called for, its proud parts come through first (sand
// settles into the joints, grass breaks through at the edges), not a fade. inv: the second fills the first's hollows.
void gMix(inout G a, G b, float m, float inv) {
  if (m <= 0.0) return;
  float hb = mix(b.h, 1.0 - a.h, inv);
  float ha = a.h + (1.0 - m), hx = hb + m, mx = max(ha, hx) - 0.22;
  float wa = max(ha - mx, 0.0), wb = max(hx - mx, 0.0), t = m >= 1.0 ? 1.0 : wb / (wa + wb);
  a.c = mix(a.c, b.c, t); a.h = mix(a.h, b.h, t); a.n = mix(a.n, b.n, t); a.r = mix(a.r, b.r, t); a.ao = mix(a.ao, b.ao, t);
}
// A surface on anything steep (rock, earth banks): from all three sides at once, each by how squarely it faces it
// (plainly: three directions blended already hide any repeat on rock, and hex-tiling each would cost nine looks).
G gTri(float L, vec3 P, vec3 N, vec3 Px, vec3 Py, out vec3 nW) {
  vec3 w = pow(abs(N), vec3(4.0)); w /= w.x + w.y + w.z;
  G g; g.c = vec3(0.0); g.h = 0.0; g.n = vec2(0.0); g.r = 0.0; g.ao = 0.0; nW = vec3(0.0);
  // (Under each, the same photograph six times larger, for the light and dark of a whole cliff face.)
  float meanL = max(dot(textureLod(tGC, vec3(0.5, 0.5, L), 12.0).rgb, vec3(0.333)), 0.01);
  #define BIG(q, qx, qy) mix(1.0, dot(textureGrad(tGC, vec3((q) * uGS[int(L + 0.5)] * 0.17 + 0.31, L), (qx) * uGS[int(L + 0.5)] * 0.17, (qy) * uGS[int(L + 0.5)] * 0.17).rgb, vec3(0.333)) / meanL, 0.6)
  if (w.x > 0.02) { G s = gLayH(L, P.zy, Px.zy, Py.zy, false); s.c *= BIG(P.zy, Px.zy, Py.zy); g.c += s.c * w.x; g.h += s.h * w.x; g.r += s.r * w.x; g.ao += s.ao * w.x; nW += vec3(0.0, s.n.y, s.n.x * sign(N.x)) * w.x; }
  if (w.y > 0.02) { G s = gLayH(L, P.xz, Px.xz, Py.xz, false); s.c *= BIG(P.xz, Px.xz, Py.xz); g.c += s.c * w.y; g.h += s.h * w.y; g.r += s.r * w.y; g.ao += s.ao * w.y; nW += vec3(s.n.x, 0.0, -s.n.y) * w.y; }
  if (w.z > 0.02) { G s = gLayH(L, P.xy, Px.xy, Py.xy, false); s.c *= BIG(P.xy, Px.xy, Py.xy); g.c += s.c * w.z; g.h += s.h * w.z; g.r += s.r * w.z; g.ao += s.ao * w.z; nW += vec3(s.n.x * sign(N.z), s.n.y, 0.0) * w.z; }
  return g;
}
${'' /* rock strata: the cliffs' layering, laid over the photograph */}
float gStrata(float y, vec2 q) { float b = sin(y * 58.0 + tFbm(q * 2.4) * 5.0); return 0.84 + 0.16 * b * abs(b) + 0.06 * sin(y * 163.0 + tFbm(q * 5.0) * 3.0); }
`

const GROUND_BODY = /* glsl */ `
{
  vec2 p = vTW.xz, px = dFdx(p), py = dFdy(p);
  vec3 Px = dFdx(vTW), Py = dFdy(vTW);
  vec3 wn = normalize(vTN), an = abs(wn);
  float id = floor(vTSurf.x + 0.5);
  float dist = length(vTW - cameraPosition);
  float fade = 1.0 - smoothstep(4.0, 24.0, dist);
  vec4 mac = texture2D(tMacro, (p + uMacro.xy) * uMacro.z);
  float n1 = tFbm(p * 0.9), n2 = tNoise(p * 7.0);
  float slope = 1.0 - clamp(wn.y, 0.0, 1.0);
  vec3 base = diffuseColor.rgb;
  float wetY = vTW.y - uSeaY;
  // What is drawn: the surface sampled, its normal in the world, and anything painted or cast on top.
  G g; vec3 nW = vec3(0.0); bool tri = false;
  float bh = 0.0, metal = 0.0, gloss = 0.0;
  vec3 V = normalize(cameraPosition - vTW);
  if (id > 9.5) {
    // Driftwood: bleached grey, split along its grain.
    float along = dot(p, vec2(0.7, 0.7)) * 140.0;
    g.c = base * (0.75 + 0.3 * tNoise(vec2(along * 0.05, p.y * 300.0))) * (0.85 + 0.15 * sin(along + tNoise(p * 90.0) * 6.0));
    g.h = 0.5; g.n = vec2(0.0); g.r = 0.88; g.ao = 1.0; nW = vec3(0.0);
  } else if (id < 0.5 || (id > 7.5 && id < 8.5)) {
    // Land: grass (its district's green), worn through to earth in patches and under the trees' leaves; sand towards
    // the shore, the badlands' dry ground, snow on the heights, rock wherever it is too steep to hold anything.
    // (What lies over the base, listed first and then laid in one loop whose length is only known as it runs: the
    // graphics driver cannot unroll it, so the hex-tiling is compiled once, not once a layer — a big shader can
    // otherwise stall the page for seconds while Windows' shader compiler inlines every copy.)
    float OL[8], OM[8], OI[8]; int on = 0;
    #define OVER(L, m, inv) { float mk_ = (m); if (mk_ > 0.0 && on < 8) { OL[on] = L; OM[on] = mk_; OI[on] = inv; on++; } }
    float bl = L_GRASS;
    if (id > 7.5) {
      // A stream's bed: pebbles, silted with mud where the water slows.
      bl = L_PEBBLES;
      OVER(L_MUD, smoothstep(0.45, 0.75, n1), 1.0)
    } else {
      OVER(L_SOIL, smoothstep(0.62, 0.8, mac.g + (n1 - 0.5) * 0.25) * (1.0 - vTBlend.z), 0.0)
      OVER(L_LEAVES, smoothstep(0.15, 0.6, mac.b + (n2 - 0.5) * 0.2), 0.0)
      OVER(L_BADLAND, smoothstep(0.38, 0.62, vTBlend.z + (n1 - 0.5) * 0.4), 0.0)
      // Sand towards the shore, wet and dark where the sea reaches it.
      float sw = smoothstep(0.42, 0.58, vTBlend.x + (n1 - 0.5) * 0.36);
      OVER(L_SAND, sw, 1.0)
      OVER(L_SAND_WET, sw * (1.0 - smoothstep(0.0, 0.06 + 0.04 * n2, wetY)), 0.0)
      OVER(L_SNOW, smoothstep(0.46, 0.52, vTBlend.y + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.16) * (1.0 - smoothstep(0.34, 0.46, slope)), 1.0)
      // Scree: gravel and stones gathered where the ground steepens towards rock.
      OVER(L_GRAVEL, smoothstep(0.18, 0.3, slope + (n1 - 0.5) * 0.2) * (1.0 - smoothstep(0.42, 0.5, slope)), 1.0)
    }
    for (int k = -1; k < on; k++) {
      G b = gLay(k < 0 ? bl : OL[k], p, px, py);
      if (k < 0) { g = b; if (id < 0.5) g.c *= base / uGrassRef; } else gMix(g, b, OM[k], OI[k]);
    }
    nW = vec3(g.n.x, 0.0, -g.n.y);
    float rk = smoothstep(0.3, 0.48, slope + (n2 - 0.5) * 0.18);
    if (rk > 0.0) {
      vec3 rn; G r = gTri(L_ROCK, vTW, wn, Px, Py, rn);
      r.c *= gStrata(vTW.y, p);
      float t = rk >= 1.0 ? 1.0 : smoothstep(0.0, 1.0, rk + (r.h - 0.5) * 0.6);
      g.c = mix(g.c, r.c, t); g.h = mix(g.h, r.h, t); g.r = mix(g.r, r.r, t); g.ao = mix(g.ao, r.ao, t); nW = mix(nW, rn, t);
    }
    // Footprints and tracks in the sand and the snow round you, settling as the wind and the sea smooth them.
    vec2 fq = (p - uFoot.xy) * uFoot.z + 0.5;
    if (uFoot.w > 0.0 && fq.x > 0.0 && fq.x < 1.0 && fq.y > 0.0 && fq.y < 1.0) {
      float soft = max(smoothstep(0.42, 0.58, vTBlend.x + (n1 - 0.5) * 0.36), smoothstep(0.46, 0.52, vTBlend.y)) * (1.0 - smoothstep(0.2, 0.4, slope));
      float e = 1.0 / 256.0;
      float f0 = texture2D(tFoot, fq).r, fx = texture2D(tFoot, fq + vec2(e, 0.0)).r, fz = texture2D(tFoot, fq + vec2(0.0, e)).r;
      float edge = smoothstep(0.0, 0.08, min(min(fq.x, 1.0 - fq.x), min(fq.y, 1.0 - fq.y)));
      // (Washed away where the sea runs up the sand.)
      float k = soft * edge * uFoot.w * smoothstep(0.01, 0.05, wetY);
      nW += vec3(fx - f0, 0.0, fz - f0) * 9.0 * k;
      g.c *= 1.0 - 0.18 * f0 * k; g.h -= f0 * k;
    }
  } else if (id < 2.5) {
    // A street, as a road crew left it: worn asphalt with resurfaced patches and sealed cracks (cobbles in the old
    // town), painted lines worn through in the wheel paths, a gutter by each kerb with its drain, a manhole here and
    // there, oil where cars stand; raised pavements of slabs behind granite kerbs, dropped at the crossings.
    float m = vTSurf.y;
    float cN = tBit(m, 1.0), cS = tBit(m, 2.0), cW = tBit(m, 4.0), cE = tBit(m, 8.0);
    float qNW = tBit(m, 16.0), qNE = tBit(m, 32.0), qSW = tBit(m, 64.0), qSE = tBit(m, 128.0);
    float xN = tBit(m, 256.0), xS = tBit(m, 512.0), xW = tBit(m, 1024.0), xE = tBit(m, 2048.0);
    vec2 l = fract(p);
    float W = 0.16, KW = 0.0165;
    float dN = l.y, dS = 1.0 - l.y, dW = l.x, dE = 1.0 - l.x;
    float inN = step(dN, W), inS = step(dS, W), inW = step(dW, W), inE = step(dE, W);
    float walk = max(max((1.0 - cN) * inN, (1.0 - cS) * inS), max((1.0 - cW) * inW, (1.0 - cE) * inE));
    walk = max(walk, max(max(inN * inW * (1.0 - qNW), inN * inE * (1.0 - qNE)), max(inS * inW * (1.0 - qSW), inS * inE * (1.0 - qSE))));
    // How far into the road from the nearest kerb (negative on the pavement), along the sides that have one.
    float kd = 9.0;
    if (cN < 0.5) kd = min(kd, dN - W); if (cS < 0.5) kd = min(kd, dS - W); if (cW < 0.5) kd = min(kd, dW - W); if (cE < 0.5) kd = min(kd, dE - W);
    // (At a junction, the pavement's corners: the road beside one, and the road round its corner.)
    float c1 = 9.0;
    if (qNW < 0.5) c1 = min(c1, dN < W ? dW - W : dW < W ? dN - W : length(vec2(dN, dW) - W));
    if (qNE < 0.5) c1 = min(c1, dN < W ? dE - W : dE < W ? dN - W : length(vec2(dN, dE) - W));
    if (qSW < 0.5) c1 = min(c1, dS < W ? dW - W : dW < W ? dS - W : length(vec2(dS, dW) - W));
    if (qSE < 0.5) c1 = min(c1, dS < W ? dE - W : dE < W ? dS - W : length(vec2(dS, dE) - W));
    kd = min(kd, c1);
    bool face = an.y < 0.6;
    bool cobbled = vTSurf.z > 0.5;
    // What this point is (the kerb's face, the kerb's top, the pavement, the gutter, the carriageway), and so which
    // photograph, over which coordinates, with how much parallax — then one look at it (one copy of the sampling in
    // the compiled shader, whatever the case).
    float ek = 9.0;
    if (cN < 0.5 && dN <= W) ek = min(ek, W - dN); if (cS < 0.5 && dS <= W) ek = min(ek, W - dS);
    if (cW < 0.5 && dW <= W) ek = min(ek, W - dW); if (cE < 0.5 && dE <= W) ek = min(ek, W - dE);
    if (qNW < 0.5 && dN <= W && dW <= W) ek = min(ek, min(W - dN, W - dW));
    if (qNE < 0.5 && dN <= W && dE <= W) ek = min(ek, min(W - dN, W - dE));
    if (qSW < 0.5 && dS <= W && dW <= W) ek = min(ek, min(W - dS, W - dW));
    if (qSE < 0.5 && dS <= W && dE <= W) ek = min(ek, min(W - dS, W - dE));
    bool kerb = walk > 0.5 && ek < KW;
    float gut = walk > 0.5 ? 0.0 : 1.0 - step(0.03, kd);
    float RL = L_ASPHALT_WORN, pomD = 0.0, rs = 1.0, tint = 1.0;
    vec2 rq = p, rqx = px, rqy = py;
    if (face) {
      // The kerb's face: granite, laid along it.
      RL = L_GRANITE; tint = 0.82;
      rq = an.x > an.z ? vTW.zy : vTW.xy; rqx = an.x > an.z ? Px.zy : Px.xy; rqy = an.x > an.z ? Py.zy : Py.xy;
    } else if (kerb) RL = L_GRANITE;
    else if (walk > 0.5) { RL = L_PAVING; pomD = 0.004; }
    else if (gut > 0.5) { RL = L_GRANITE; rs = 1.7; tint = 0.62; }
    else if (cobbled) { RL = L_COBBLES; pomD = 0.013; }
    vec2 off = uGQ > 1.5 && fade > 0.0 && pomD > 0.0 ? gPom(RL, rq, rqx, rqy, V.xzy * vec3(1.0, -1.0, 1.0), pomD * fade) : vec2(0.0);
    g = gLay(RL, (rq + off) * rs, rqx * rs, rqy * rs);
    g.c *= tint;
    if (kerb) g.r *= 0.85;
    if (face) nW = vec3(0.0);
    else {
      float OL[2], OM[2], OI[2]; int on = 0;
      float fresh = 0.0, seam = 0.0, crack = 0.0;
      if (walk > 0.5 && !kerb) {
        // Grime gathers along the building line and at the kerb; sand blows onto it near the beach.
        g.c *= 0.9 + 0.2 * mac.r;
        float mk = smoothstep(0.25, 0.7, vTBlend.x) * 0.8;
        if (mk > 0.0) { OL[on] = L_SAND; OM[on] = mk; OI[on] = 1.0; on++; }
      } else if (walk < 0.5 && gut < 0.5 && !cobbled) {
        // Resurfaced: whole lanes and patches laid fresh, darker and finer, with a sealed seam round them.
        // (A patch: a few to a tile at most, each its own size, cut square to the road.)
        vec2 cell = floor(p * 3.0), pl = fract(p * 3.0);
        float patchy = tHash(cell + 0.37);
        vec2 lo = 0.08 + 0.3 * vec2(tHash(cell + 1.1), tHash(cell + 2.3)), hi = 0.92 - 0.3 * vec2(tHash(cell + 3.7), tHash(cell + 4.1));
        float edgeD = min(min(pl.x - lo.x, hi.x - pl.x), min(pl.y - lo.y, hi.y - pl.y));
        fresh = max(step(0.86, patchy) * step(0.0, edgeD), smoothstep(0.7, 0.8, mac.g));
        if (fresh > 0.0) { OL[on] = L_ASPHALT; OM[on] = fresh; OI[on] = 0.0; on++; }
        seam = step(0.86, patchy) * (1.0 - smoothstep(0.0, 0.03, abs(edgeD)));
        // Cracks, sealed with tar in places: a network over the old surface.
        crack = (1.0 - fresh) * (1.0 - smoothstep(0.0, 0.025, tCells(p * 9.0 + n1))) * smoothstep(0.55, 0.75, tNoise(p * 1.3 + 4.0));
      }
      for (int k = 0; k < on; k++) gMix(g, gLay(OL[k], p, px, py), OM[k], OI[k]);
      float sealed = max(seam, crack * step(0.5, tNoise(p * 3.1)));
      g.c = mix(g.c, g.c * 0.6, max(crack * 0.8, sealed)); g.r = mix(g.r, 0.45, sealed);
      bh -= crack * 0.6;
      nW = vec3(g.n.x, 0.0, -g.n.y);
    }
    if (!face && walk < 0.5) {
      // Tyres polish the wheel paths and leave their rubber; oil drips where cars wait.
      float straightEW = cW * cE * (1.0 - cN) * (1.0 - cS), straightNS = cN * cS * (1.0 - cW) * (1.0 - cE);
      float across = straightEW > 0.5 ? l.y : straightNS > 0.5 ? l.x : -1.0;
      float wheel = across > 0.0 ? smoothstep(0.08, 0.0, min(min(abs(across - 0.28), abs(across - 0.39)), min(abs(across - 0.61), abs(across - 0.72)))) : 0.0;
      g.c *= 1.0 - 0.12 * wheel; g.r = mix(g.r, g.r * 0.8, wheel);
      float laneMid = across > 0.0 ? smoothstep(0.06, 0.0, min(abs(across - 0.335), abs(across - 0.665))) : 0.0;
      float oil = laneMid * smoothstep(0.7, 0.9, tFbm(p * 3.0 + 11.0));
      g.c = mix(g.c, g.c * 0.55, oil); g.r = mix(g.r, 0.35, oil); gloss = max(gloss, oil * 0.3);
      // Paint: the centre line, and at a junction a zebra over each road leaving it — worn through where wheels run
      // and on the aggregate's high points first.
      float paint = 0.0;
      // (No centre line on the old town's cobbles.)
      if (!cobbled && cW * cE > 0.5 && cN + cS < 0.5) paint = step(abs(l.y - 0.5), 0.011) * step(fract(p.x * 2.0), 0.5);
      if (!cobbled && cN * cS > 0.5 && cW + cE < 0.5) paint = step(abs(l.x - 0.5), 0.011) * step(fract(p.y * 2.0), 0.5);
      float zb = 0.0, acr = step(W, min(dW, dE)), dwn = step(W, min(dN, dS));
      zb = max(zb, xN * step(0.04, dN) * step(dN, W - 0.0) * step(0.5, fract(l.x * 10.0)) * acr);
      zb = max(zb, xS * step(0.04, dS) * step(dS, W - 0.0) * step(0.5, fract(l.x * 10.0)) * acr);
      zb = max(zb, xW * step(0.04, dW) * step(dW, W - 0.0) * step(0.5, fract(l.y * 10.0)) * dwn);
      zb = max(zb, xE * step(0.04, dE) * step(dE, W - 0.0) * step(0.5, fract(l.y * 10.0)) * dwn);
      paint = max(paint, zb) * (1.0 - gut);
      paint *= smoothstep(0.15, 0.45, tNoise(p * 31.0) * 0.6 + n2 * 0.4) * smoothstep(0.92, 0.6, g.h + wheel * 0.3);
      g.c = mix(g.c, SRGB(0.86, 0.87, 0.86), paint); g.r = mix(g.r, 0.6, paint); nW *= 1.0 - 0.6 * paint;
      // A drain in the gutter of each tile, and now and then a manhole in the lane: cast iron, set flush.
      if (gut > 0.5) {
        float along = cN < 0.5 && dN < W + 0.03 || cS < 0.5 && dS < W + 0.03 ? l.x : l.y;
        float ga = abs(along - 0.5), gw = kd;
        if (ga < 0.027 && gw > 0.003) {
          float slot = step(0.5, fract(along * 300.0));
          // (Weathered cast iron: dark grey, rough, only partly metallic — a metal's colour is what it reflects, and
          // a fully metallic dark one draws black.)
          g.c = mix(vec3(0.1, 0.1, 0.105), vec3(0.008), slot); g.r = 0.6; metal = 0.35 * (1.0 - slot); g.ao = mix(1.0, 0.2, slot); nW = vec3(0.0);
        }
      }
      vec2 mc = vec2(0.5, 0.5 + (tHash(floor(p) + 3.3) - 0.5) * 0.4);
      float mr = length(l - mc);
      if (tHash(floor(p) + 9.1) > 0.7 && !cobbled && mr < 0.042) {
        float ring = smoothstep(0.036, 0.038, mr);
        // (Its cast pattern in the colour only, and smooth: a hard-edged pattern this fine would alias, and as a bump
        // it turned the surface's normal under itself and drew the cover black.)
        vec2 gq = (l - mc) * 6.2832 * 80.0;
        float grid = mix(0.5, 0.5 + 0.5 * sin(gq.x) * sin(gq.y), fade);
        g.c = mix(vec3(0.1, 0.095, 0.09) * (0.8 + 0.4 * grid), vec3(0.14, 0.135, 0.13), ring); g.r = 0.62 - 0.17 * ring; metal = 0.4; nW = vec3(0.0);
      }
    }
  } else if (id < 3.5 || id > 8.5) {
    if (id > 8.5) {
      // Cut stone: the retaining walls where a road or a plot was levelled into the hill, darker at the foot.
      vec2 fc = an.x > an.z ? vTW.zy : vTW.xy, fx = an.x > an.z ? Px.zy : Px.xy, fy = an.x > an.z ? Py.zy : Py.xy;
      g = gLay(L_STONE, fc, fx, fy);
      g.c *= base / SRGB(0.54, 0.518, 0.482) * (0.85 + 0.15 * smoothstep(0.0, 0.2, mac.r));
      g.c *= 1.0 - 0.45 * vTBlend.x; g.r = mix(g.r, 0.18, vTBlend.x);
      nW = an.x > an.z ? vec3(0.0, g.n.y, g.n.x * sign(wn.x)) : vec3(g.n.x * sign(wn.z), g.n.y, 0.0);
    } else {
      // Rock: the cliffs and crags, from every side, layered; sea-worn and darker where the sea reaches.
      g = gTri(L_ROCK, vTW, wn, Px, Py, nW);
      g.c *= gStrata(vTW.y, p) * base / SRGB(0.525, 0.502, 0.478);
      // (Wet where a stream or the pond runs along it.)
      g.c *= 1.0 - 0.45 * vTBlend.x; g.r = mix(g.r, 0.18, vTBlend.x);
      float sea = 1.0 - smoothstep(0.05, 0.35, wetY);
      if (sea > 0.0) { vec3 sn; G s = gTri(L_ROCK_SEA, vTW, wn, Px, Py, sn); g.c = mix(g.c, s.c, sea); g.h = mix(g.h, s.h, sea); g.r = mix(g.r, s.r, sea); nW = mix(nW, sn, sea); }
    }
  } else if (id < 5.5) {
    // The sea floor: wet sand at the water's edge, rippled sand under the shallows with rock and weed in patches,
    // going down to the deep sea's own blue.
    g = gLay(L_SAND, p, px, py);
    { float mk = 1.0 - smoothstep(0.0, 0.05 + 0.03 * n2, wetY); if (mk > 0.0) gMix(g, gLay(L_SAND_WET, p, px, py), mk, 0.0); }
    float rip = sin(dot(p, vec2(0.6, 0.8)) * 28.0 + n2 * 5.0 + n1 * 3.0);
    float under = smoothstep(0.0, -0.06, wetY);
    bh += rip * 0.5 * under;
    { float mk = smoothstep(0.8, 0.9, mac.a + (n1 - 0.5) * 0.1) * smoothstep(0.08, 0.3, -wetY); if (mk > 0.0) gMix(g, gLay(L_ROCK_SEA, p, px, py), mk, 0.0); }
    float depth = clamp((-wetY - 0.02) / 0.6, 0.0, 1.0);
    g.c = mix(g.c, SRGB(0.047, 0.227, 0.333), pow(depth, 0.8));
    g.c = mix(g.c, g.c * SRGB(0.6, 0.75, 0.55), smoothstep(0.62, 0.8, n1) * under * (1.0 - depth) * 0.6);
    nW = vec3(g.n.x, 0.0, -g.n.y) * (1.0 - depth);
  } else {
    // A field: crops in rows on tilled earth.
    float kind = vTSurf.y, r = vTSurf.z < 0.5 ? p.y : p.x;
    float row = sin(r * 6.2832 * 6.0 + n2 * 0.5 + (tNoise(p * 1.3) - 0.5) * 1.2);
    g = gLay(L_FIELD, p, px, py);
    vec3 crop = kind < 0.5 ? mix(SRGB(0.4, 0.47, 0.36), SRGB(0.6, 0.5, 0.86), smoothstep(0.2, 0.95, row + (tNoise(p * 97.0) - 0.5) * 0.6))
      : kind < 1.5 ? mix(SRGB(0.8, 0.68, 0.46), SRGB(0.7, 0.66, 0.42), n1) * (0.85 + 0.3 * tNoise(p * 55.0)) : SRGB(0.33, 0.55, 0.27);
    crop *= (0.8 + 0.4 * tNoise(p * 31.0)) * (0.9 + 0.2 * n1);
    float cov = kind > 0.5 && kind < 1.5 ? smoothstep(-0.98, -0.75, row) : smoothstep(-0.5, 0.1, row);
    g.c = mix(g.c, crop, cov); g.r = mix(g.r, 0.85, cov);
    nW = vec3(g.n.x, 0.0, -g.n.y) * (1.0 - cov);
    bh += row * 0.9 * fade;
  }
  // The island's own large-scale variation: no two stretches of the same ground quite alike.
  g.c *= 0.9 + 0.2 * mac.r;
  // Under the water, the sun's light comes through the waves above in a moving net of bright lines: the caustics the
  // sea's own small waves cast (seatex.ts: traced through them, so the net is the one those waves make), drifting as
  // they drift. They only move the light about (their mean is one), sharpest a metre or two down, gone in the deep.
  if (wetY < 0.0 && uCaustic > 0.0) {
    float cA = texture2D(tCaus, p * uCausDet.x + uCausDrift.xy).r * 4.0, cB = texture2D(tCaus, p * uCausDet.y + uCausDrift.zw).g * 4.0;
    // (Barely focused in the first hand's breadth of water, sharpest a metre or two down, gone in the deep.)
    float focus = smoothstep(0.0, 0.18, -wetY) * (1.0 - smoothstep(0.3, 1.0, -wetY));
    // (Only the bright lines are laid over the floor: between them the light is much as it would be anyway.)
    float lines = max(cA * 0.6 + cB * 0.4 - 1.15, 0.0);
    float k = smoothstep(0.0, 0.02, -wetY) * uCaustic * max(wn.y, 0.0) * (1.0 - 0.6 * smoothstep(5.0, 25.0, dist));
    g.c *= 1.0 + min(lines, 2.0) * 0.9 * focus * k;
  }
  // Rain: what is porous darkens as it soaks it up, everything shines; puddles gather in the low places of the
  // street, the paving and the rock (the photograph's own hollows first), mirrors with rings in them while it rains.
  if (uWet > 0.001 && wetY > 0.0) {
    float hard = (id > 1.5 && id < 3.5) || id > 8.5 ? 1.0 : 0.4;
    float soak = uWet * hard;
    g.c *= 1.0 - 0.38 * soak; g.r = mix(g.r, g.r * 0.32, soak);
    if (hard > 0.5 && wn.y > 0.97) {
      float lowness = (1.0 - g.h) * 0.35 + tFbm(p * 1.6 + 3.3) * 0.5 + tNoise(p * 6.0) * 0.15;
      float pud = smoothstep(0.62 - 0.2 * uWet, 0.68 - 0.2 * uWet, lowness) * smoothstep(0.3, 0.8, uWet);
      g.c = mix(g.c, g.c * 0.5, pud); g.r = mix(g.r, 0.025, pud);
      nW *= 1.0 - pud; bh *= 1.0 - pud;
      bh += rRipples(p * 0.6, uTime, uRain * 0.9).z * 0.18 * pud * fade;
    }
  }
  // Wet where the sea reaches: darker, and shining.
  float wet = (1.0 - smoothstep(0.0, 0.05 + 0.03 * n2, wetY)) * step(id, 4.5 + step(8.5, id) * 9.0);
  g.c = mix(g.c, g.c * vec3(0.5, 0.52, 0.56), wet); g.r = mix(g.r, 0.25, wet);
  // (Where the ground is hemmed in — a wall's foot, under a ledge — the sun's light is a little less too.)
  diffuseColor.rgb = g.c * (0.65 + 0.35 * vTBlend.w);
  tRough = clamp(g.r, 0.04, 1.0);
  tMetal = metal;
  tAO = g.ao * vTBlend.w;
  tNW = nW * (0.9 + 0.4 * fade);
  tBump = bh * fade * 0.02;
}
`

/** The grass's own mean green (linear), which each district's grass colour is set against. */
const GRASS_REF = (() => { const c = new Color(0, 0, 0), all = Object.values(GRASS).filter((_, k) => Object.keys(GRASS)[k] !== 'badlands'); for (const h of all) c.add(new Color(h)); return c.multiplyScalar(1 / all.length) })()

type GroundUniforms = { tGC: { value: Texture | null }; tGD: { value: Texture | null }; uGQ: { value: number }; tFoot: { value: Texture | null }; uFoot: { value: Vector4 }; tMacro: { value: Texture }; uMacro: { value: Vector4 }; tCaus: { value: Texture | null }; uCausDet: { value: Vector2 }; uCausDrift: { value: Vector4 } }
function groundMaterial(seaY: number, time: { value: number }, caustics: { value: number }, gu: GroundUniforms) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeaY = { value: seaY }
    sh.uniforms.uTime = time
    sh.uniforms.uCaustic = caustics
    sh.uniforms.uWet = wetness.wet; sh.uniforms.uRain = wetness.rain
    Object.assign(sh.uniforms, gu)
    sh.uniforms.uGS = { value: GROUND.map((g) => 1 / (g.metres * METRE)) }
    sh.uniforms.uGH = { value: GROUND.map((g) => (g.hex ? 1 : 0)) }
    sh.uniforms.uGrassRef = { value: GRASS_REF }
    sh.vertexShader = 'attribute vec3 aSurf;\nattribute vec4 aBlend;\nvarying vec3 vTW;\nvarying vec3 vTN;\nvarying vec3 vTSurf;\nvarying vec4 vTBlend;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vTN = normalize(mat3(modelMatrix) * objectNormal);\n  vTSurf = aSurf;\n  vTBlend = aBlend;',
    )
    sh.fragmentShader = GROUND_HEAD + RIPPLES_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', () => '#include <color_fragment>\n' + GROUND_BODY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = tRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = tMetal;')
      // The photographs' normal over the ground's own (in the world), then any bumps the shader adds on top.
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize((viewMatrix * vec4(normalize(normalize(vTN) + tNW), 0.0)).xyz);\n  normal = tPerturb(-vViewPosition, normal, vec2(dFdx(tBump), dFdy(tBump)), faceDirection);')
      // The occlusion (the photograph's crevices, and where the ground is hemmed in) dims the light from the sky, not the sun's.
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n  reflectedLight.indirectDiffuse *= tAO;\n  reflectedLight.indirectSpecular *= mix(1.0, tAO, 0.7);')
  }
  m.customProgramCacheKey = () => 'walk-ground-2'
  return m
}

export { PX_H }
