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
 * What each piece of ground is made of — grass, earth, sand (dark and shiny
 * where the sea wets it), snow, rock, cut stone, asphalt with its kerbs,
 * pavements and lines, the rows of a field, a stream's pebbles — is painted
 * in the shader from the world position, so it is as fine up close as the
 * screen is, and never tiles.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Uint32BufferAttribute, Vector3 } from 'three'
import { wetness, RIPPLES_GLSL } from './wet'
import { PX_H, Y, type WorldData } from './build3d'

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
export const SURF = { land: 0, road: 2, rock: 3, sea: 5, field: 7, bed: 8, stone: 9 } as const

/** The grass of each district (earth in the badlands, which the shader paints). */
const GRASS: Record<string, string> = { peaks: '#4c6a3c', badlands: '#7d7a4e', proving: '#557a35', harbour: '#527a36', funfair: '#567c37', market: '#537936', oldtown: '#517735' }
const ROCK = '#86807a', SANDSTONE = '#b08c6e'
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
  /** The ground's height at a world point (world y). */
  const heightAt = (x: number, z: number) => Y(siteAt(x, z))

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

  /* ---- each tile's patch ---- */
  for (let i = -M; i < N + M; i++) for (let j = -M; j < N + M; j++) {
    const T = tileAt(i, j), k = kind(i, j), r = T.flat ? 1 : R
    const isRoad = roads.has(key(i, j)), field = fieldAt.get(key(i, j))
    let surf: [number, number, number]
    if (k === '0') surf = [SURF.sea, 0, 0]
    else if (isRoad) {
      const R_ = (a: number, b: number) => roads.has(key(a, b))
      const links = (a: number, b: number) => +R_(a - 1, b) + +R_(a + 1, b) + +R_(a, b - 1) + +R_(a, b + 1)
      // A crossing where a road leaves a junction for a plain stretch.
      const exit = (a: number, b: number) => R_(a, b) && links(i, j) >= 3 && links(a, b) <= 2
      const m = (R_(i - 1, j) ? 1 : 0) + (R_(i + 1, j) ? 2 : 0) + (R_(i, j - 1) ? 4 : 0) + (R_(i, j + 1) ? 8 : 0)
        + (R_(i - 1, j - 1) ? 16 : 0) + (R_(i - 1, j + 1) ? 32 : 0) + (R_(i + 1, j - 1) ? 64 : 0) + (R_(i + 1, j + 1) ? 128 : 0)
        + (exit(i - 1, j) ? 256 : 0) + (exit(i + 1, j) ? 512 : 0) + (exit(i, j - 1) ? 1024 : 0) + (exit(i, j + 1) ? 2048 : 0)
      surf = [SURF.road, m, 0]
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
      const rows = Math.max(1, Math.min(8, Math.ceil(Math.max(...tops.map((t, q) => t - bots[q])) / 0.09)))
      const [ox, oz] = S.out
      // Rock bulges out a little, a hand's breadth here and there; cut stone stays straight.
      const bulge = (wx: number, wy: number, wz: number) => (cut ? 0 : (noise3(wx * 9, wy * 9, wz * 9) - 0.5) * 0.05 + (noise3(wx * 23, wy * 23, wz * 23) - 0.5) * 0.02)
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
          col.push(geo.v(P, Nn, tint, surf, [0, 0, 0, ao]))
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
  const rocks = d.seaRocks.map(([i, j, k]) => ({ x: j + 0.5, z: i + 0.5, r: 0.34 * k }))

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
    const e = 0.05, dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e)
    if (Math.hypot(dx, dz) / (2 * e) > 0.75) return null
    return grassAt(x, z, [i, j])
  }
  const causticK = { value: 1 }
  const mesh = new Mesh(geo.geometry(), groundMaterial(seaY, time, causticK))
  // It takes the shadows of all that stands on it (its own would only speckle it: the shading at the foot of each wall is its own).
  mesh.receiveShadow = true
  return { mesh, poolGeo, rockBoxes, rocks, falls, flowAt, poolAt, caustics: causticK, meadow, heightAt, siteAt, top, kind, joined, pinned }
}

function smoothstep(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/* ---- what the ground is made of: painted where it is ---------------------- */
const GROUND_HEAD = /* glsl */ `
uniform float uSeaY;
uniform float uWet;
uniform float uRain;
uniform float uTime;
uniform float uCaustic;
varying vec3 vTW;
varying vec3 vTN;
varying vec3 vTSurf;
varying vec4 vTBlend;
float tRough;
float tBump;
float tHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tFbm(vec2 p) { return (tNoise(p) * 0.5 + tNoise(p * 2.03 + 7.1) * 0.25 + tNoise(p * 4.01 + 3.7) * 0.125) / 0.875; }
// How far a point is from the nearest crack between irregular cells (dried mud, crazed paving).
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
// Colours as written (sRGB), in the linear light the shader works in.
#define SRGB(r, g, b) pow(vec3(r, g, b), vec3(2.2))
// Rock: layered, creviced, with lichen; q runs across the face, y up it.
vec3 tRock(vec3 tint, vec2 q, float y, float fade, out float bh) {
  float s = tFbm(q * 2.4 + vec2(0.0, y * 1.5));
  float fine = mix(0.5, tFbm(q * 9.0 + 4.0), fade);
  float strata = sin(y * 58.0 + s * 5.0);
  float crev = smoothstep(0.3, 0.56, tFbm(q * 5.5 + vec2(y * 2.0, 0.0)));
  vec3 c = tint * (0.7 + 0.55 * s) * (0.88 + 0.12 * strata) * mix(0.5, 1.0, crev) * (0.85 + 0.3 * fine);
  c = mix(c, SRGB(0.45, 0.5, 0.42), smoothstep(0.68, 0.84, tNoise(q * 3.0 + 11.0)) * 0.5);
  bh = s * 1.6 + crev * 1.0 + strata * 0.3 + fine * 0.6;
  return c;
}
`

const GROUND_BODY = /* glsl */ `
{
  vec2 p = vTW.xz;
  vec3 wn = normalize(vTN), an = abs(wn);
  float id = floor(vTSurf.x + 0.5);
  float dist = length(vTW - cameraPosition);
  float fade = 1.0 - smoothstep(4.0, 24.0, dist);
  float n0 = tFbm(p * 0.22 + 17.0), n1 = tFbm(p * 0.9), n2 = tNoise(p * 7.0);
  float n3 = mix(0.5, tNoise(p * 31.0), fade), n4 = mix(0.5, tNoise(p * 97.0), fade);
  float slope = 1.0 - clamp(wn.y, 0.0, 1.0);
  vec2 face = an.x > an.z ? vTW.zy : vTW.xy;
  vec3 base = diffuseColor.rgb;
  vec3 col = base; float rough = 0.95, bh = 0.0, bumpK = 0.6;
  float wetY = vTW.y - uSeaY;
  if (id < 0.5 || (id > 7.5 && id < 8.5)) {
    // Grass: greens that wander, dry straw-coloured patches, clumps, blades; now and then a clover flower.
    vec3 g = base * (0.7 + 0.6 * n0) * (0.82 + 0.36 * n1);
    g = mix(g, g * vec3(0.9, 1.05, 1.1), smoothstep(0.4, 0.7, tFbm(p * 1.7 + 9.0)) * 0.5);
    g = mix(g, g * vec3(1.25, 1.12, 0.62), smoothstep(0.55, 0.85, tFbm(p * 0.45 + 3.0)) * 0.6);
    float clump = tNoise(p * 13.0);
    g *= (0.78 + 0.44 * clump) * (0.84 + 0.32 * n3) * (0.9 + 0.2 * n4);
    vec2 fc = p * 40.0, fi = floor(fc);
    float fl = tHash(fi + 0.37), fd = length(fract(fc) - 0.5 - (vec2(tHash(fi + 1.3), tHash(fi + 2.9)) - 0.5) * 0.5);
    float flower = step(0.994, fl) * smoothstep(0.2, 0.12, fd) * step(0.45, n1) * fade;
    g = mix(g, fl > 0.997 ? SRGB(0.93, 0.94, 0.96) : SRGB(0.62, 0.55, 0.88), flower);
    bh = clump * 0.9 + n3 * 0.8 + n4 * 0.6;
    // Earth, dry and cracked, in the badlands.
    float dw = smoothstep(0.4, 0.6, vTBlend.z + (n1 - 0.5) * 0.4);
    vec3 dirt = SRGB(0.64, 0.5, 0.37) * (0.78 + 0.44 * n0) * (0.86 + 0.28 * n2) * (0.9 + 0.2 * n4);
    float plates = dw > 0.01 ? smoothstep(0.0, 0.09, tCells(p * 5.0 + (n2 - 0.5) * 0.3)) : 1.0;
    plates = mix(1.0, plates, fade);
    dirt *= mix(0.5, 1.0, plates);
    g = mix(g, dirt, dw); bh = mix(bh, plates * 0.9 + n3 * 0.4, dw);
    // Sand: grains and the wind's ripples.
    float sw = smoothstep(0.45, 0.55, vTBlend.x + (n1 - 0.5) * 0.36 + (n3 - 0.5) * 0.14);
    float rip = sin(dot(p, vec2(0.8, 0.6)) * 34.0 + n2 * 6.0 + n1 * 4.0);
    vec3 sand = SRGB(0.78, 0.7, 0.55) * (0.88 + 0.24 * n0) * (0.9 + 0.2 * n4) * (0.96 + 0.04 * rip);
    g = mix(g, sand, sw); bh = mix(bh, rip * 0.4 + n4 * 0.4, sw);
    // A stream's bed: pebbles.
    if (id > 7.5) { float pb = tNoise(p * 26.0); g = SRGB(0.5, 0.47, 0.41) * (0.6 + 0.7 * pb) * (0.85 + 0.3 * n2); bh = pb * 1.4; }
    // Snow on the heights, not on what is too steep to hold it.
    float snow = smoothstep(0.46, 0.52, vTBlend.y + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.16) * (1.0 - smoothstep(0.34, 0.46, slope));
    g = mix(g, SRGB(0.93, 0.95, 0.98) * (0.93 + 0.07 * n3), snow); bh = mix(bh, n2 * 0.4, snow);
    rough = mix(0.96, 0.6, snow);
    // Rock where it is too steep for anything to grow.
    float rk = smoothstep(0.3, 0.48, slope + (n2 - 0.5) * 0.18);
    float rbh; vec3 r = tRock(SRGB(0.55, 0.52, 0.49), an.y > 0.75 ? p : face, vTW.y, fade, rbh);
    col = mix(g, r, rk); bh = mix(bh, rbh, rk);
  } else if (id < 2.5) {
    // A street: asphalt; a pavement and kerb along any side with no road off it; a line down the middle
    // of a straight; at a junction, the pavement's corners and a zebra crossing over each road leaving it.
    float m = vTSurf.y;
    float cN = tBit(m, 1.0), cS = tBit(m, 2.0), cW = tBit(m, 4.0), cE = tBit(m, 8.0);
    float qNW = tBit(m, 16.0), qNE = tBit(m, 32.0), qSW = tBit(m, 64.0), qSE = tBit(m, 128.0);
    float xN = tBit(m, 256.0), xS = tBit(m, 512.0), xW = tBit(m, 1024.0), xE = tBit(m, 2048.0);
    vec2 l = fract(p);
    float W = 0.16;
    float dN = l.y, dS = 1.0 - l.y, dW = l.x, dE = 1.0 - l.x;
    float inN = step(dN, W), inS = step(dS, W), inW = step(dW, W), inE = step(dE, W);
    float walk = max(max((1.0 - cN) * inN, (1.0 - cS) * inS), max((1.0 - cW) * inW, (1.0 - cE) * inE));
    walk = max(walk, max(max(inN * inW * (1.0 - qNW), inN * inE * (1.0 - qNE)), max(inS * inW * (1.0 - qSW), inS * inE * (1.0 - qSE))));
    vec3 asphalt = SRGB(0.31, 0.315, 0.33) * (0.8 + 0.4 * n1) * (0.86 + 0.28 * n4) * (0.92 + 0.16 * n3);
    // Patches where it was mended, darker, and the paler wear of tyres in each lane.
    asphalt = mix(asphalt, SRGB(0.2, 0.205, 0.22), smoothstep(0.64, 0.7, tNoise(p * 2.3 + 5.0)) * 0.7);
    float lane = cW * cE * (1.0 - cN) * (1.0 - cS) > 0.5 ? l.y : cN * cS * (1.0 - cW) * (1.0 - cE) > 0.5 ? l.x : -1.0;
    if (lane > 0.0) asphalt *= 1.0 + 0.1 * smoothstep(0.09, 0.0, min(abs(lane - 0.33), abs(lane - 0.67)));
    float paint = 0.0;
    if (cW * cE > 0.5 && cN + cS < 0.5) paint = step(abs(l.y - 0.5), 0.011) * step(fract(p.x * 2.0), 0.5);
    if (cN * cS > 0.5 && cW + cE < 0.5) paint = step(abs(l.x - 0.5), 0.011) * step(fract(p.y * 2.0), 0.5);
    float zb = 0.0, across = step(W, min(dW, dE)), down = step(W, min(dN, dS));
    zb = max(zb, xN * step(0.02, dN) * step(dN, W - 0.02) * step(0.5, fract(l.x * 10.0)) * across);
    zb = max(zb, xS * step(0.02, dS) * step(dS, W - 0.02) * step(0.5, fract(l.x * 10.0)) * across);
    zb = max(zb, xW * step(0.02, dW) * step(dW, W - 0.02) * step(0.5, fract(l.y * 10.0)) * down);
    zb = max(zb, xE * step(0.02, dE) * step(dE, W - 0.02) * step(0.5, fract(l.y * 10.0)) * down);
    paint = max(paint, zb);
    // Paint wears through in places.
    paint *= smoothstep(0.15, 0.45, n3 + n2 * 0.3);
    vec3 road = mix(asphalt, SRGB(0.88, 0.89, 0.88) * (0.88 + 0.12 * n4), paint);
    // Pavement: square slabs, each a shade of its own, a kerb of long stones at its edge.
    vec2 slab = fract(p / 0.16);
    float joint = smoothstep(0.0, 0.045, min(min(slab.x, 1.0 - slab.x), min(slab.y, 1.0 - slab.y)));
    vec3 pave = SRGB(0.6, 0.6, 0.585) * (0.86 + 0.18 * n2) * (0.92 + 0.16 * tHash(floor(p / 0.16))) * (0.94 + 0.12 * n4) * mix(0.72, 1.0, joint);
    float edge = min(min(mix(1.0, abs(dN - W), 1.0 - cN), mix(1.0, abs(dS - W), 1.0 - cS)), min(mix(1.0, abs(dW - W), 1.0 - cW), mix(1.0, abs(dE - W), 1.0 - cE)));
    pave = mix(SRGB(0.64, 0.64, 0.63) * (0.9 + 0.1 * n3), pave, smoothstep(0.014, 0.022, edge));
    col = mix(road, pave, walk);
    // The gutter by the kerb holds a little grime.
    col *= 1.0 - (1.0 - walk) * 0.25 * smoothstep(0.05, 0.0, edge - 0.0);
    rough = mix(mix(0.86, 0.62, paint), 0.9, walk);
    bh = mix(n4 * 0.7 + n3 * 0.4 + n1 * 0.3, joint * 0.9 + n4 * 0.2, walk); bumpK = 0.4;
  } else if (id < 3.5 || id > 8.5) {
    if (id > 8.5) {
      // Cut stone: courses of blocks, each its own shade, mortar sunk between them, weathered darker low down.
      float row = floor(face.y / 0.07), off = mod(row, 2.0) * 0.5;
      vec2 cell = vec2(floor(face.x / 0.17 + off), row);
      vec2 b = vec2(fract(face.x / 0.17 + off), fract(face.y / 0.07));
      float mortar = smoothstep(0.0, 0.07, min(min(b.x, 1.0 - b.x) * 2.4, min(b.y, 1.0 - b.y)));
      vec3 stone = base * (0.8 + 0.36 * tHash(cell)) * (0.84 + 0.3 * n3) * (0.9 + 0.2 * tFbm(face * 9.0));
      // Rain has streaked it down from the top.
      stone *= 0.86 + 0.18 * tNoise(vec2(face.x * 40.0, face.y * 2.0));
      col = mix(base * 0.5, stone, mortar); bh = mortar * 1.0 + n3 * 0.3; rough = 0.9; bumpK = 0.8;
    } else {
      col = tRock(base, an.y > 0.75 ? p : face, vTW.y, fade, bh); rough = 0.88; bumpK = 1.0;
    }
  } else if (id < 5.5) {
    // The sea floor: sand under the water, in ripples, with weed in the deeper patches.
    float rip = sin(dot(p, vec2(0.6, 0.8)) * 28.0 + n2 * 5.0 + n1 * 3.0);
    // Wet sand at the water's edge, going down through the shallows to the deep sea's own blue.
    float depth = clamp((-wetY - 0.02) / 0.6, 0.0, 1.0);
    vec3 sand = SRGB(0.86, 0.78, 0.62) * (0.86 + 0.28 * n0) * (0.9 + 0.2 * n4) * (0.96 + 0.04 * rip);
    sand *= mix(1.0, 0.55, 1.0 - smoothstep(0.0, 0.05 + 0.03 * n2, wetY));
    col = mix(sand, SRGB(0.047, 0.227, 0.333), pow(depth, 0.8));
    col = mix(col, col * SRGB(0.6, 0.75, 0.55), smoothstep(0.62, 0.8, n1) * smoothstep(0.02, -0.2, wetY) * (1.0 - depth) * 0.6);
    bh = rip * 0.4 + n2 * 0.3; rough = 0.9;
  } else {
    // A field: crops in rows, earth between them.
    float kind = vTSurf.y, r = vTSurf.z < 0.5 ? p.y : p.x;
    float row = sin(r * 6.2832 * 6.0 + n2 * 0.5 + (tNoise(p * 1.3) - 0.5) * 1.2);
    vec3 soil = SRGB(0.4, 0.31, 0.24) * (0.8 + 0.4 * n3);
    vec3 crop = kind < 0.5 ? mix(SRGB(0.4, 0.47, 0.36), SRGB(0.6, 0.5, 0.86), smoothstep(0.2, 0.95, row + (n4 - 0.5) * 0.6))
      : kind < 1.5 ? mix(SRGB(0.8, 0.68, 0.46), SRGB(0.7, 0.66, 0.42), n1) * (0.85 + 0.3 * tNoise(p * 55.0)) : SRGB(0.33, 0.55, 0.27);
    crop *= (0.8 + 0.4 * n3) * (0.9 + 0.2 * n1);
    float cov = kind > 0.5 && kind < 1.5 ? smoothstep(-0.98, -0.75, row) : smoothstep(-0.5, 0.1, row);
    col = mix(soil, crop, cov); bh = row * 0.9 + n3 * 0.5;
  }
  // Under the water, the sun's light comes through its ripples in a moving net of bright lines.
  if (wetY < 0.0 && uCaustic > 0.0) {
    // (Two nets drifting different ways, each bent by the swell, so no line stays straight.)
    vec2 cp = p * 4.2 + vec2(tNoise(p * 1.6 + uTime * 0.21), tNoise(p * 1.6 - uTime * 0.17 + 5.0)) * 1.1;
    float c1 = tCells(cp + vec2(uTime * 0.12, uTime * 0.08));
    float c2 = tCells(cp * 1.63 + vec2(-uTime * 0.1, uTime * 0.14) + 7.3);
    float caus = pow(1.0 - smoothstep(0.0, 0.075, c1), 2.0) * 0.55 + pow(1.0 - smoothstep(0.0, 0.055, c2), 2.0) * 0.4;
    caus *= smoothstep(0.0, 0.04, -wetY) * (1.0 - smoothstep(0.12, 0.7, -wetY)) * uCaustic * wn.y * (1.0 - 0.6 * smoothstep(5.0, 18.0, dist));
    col += col * caus * 0.85;
  }
  // Rain: everything darkens and shines as it soaks in — the streets, the paving and the rock most, grass and earth less;
  // puddles gather on the level street and paving, mirrors with rings in them while it rains.
  if (uWet > 0.001 && wetY > 0.0) {
    float hard = (id > 1.5 && id < 3.5) || id > 8.5 ? 1.0 : 0.4;
    float soak = uWet * hard;
    col *= 1.0 - 0.38 * soak; rough = mix(rough, rough * 0.32, soak);
    if (hard > 0.5 && wn.y > 0.97) {
      float pud = smoothstep(0.66 - 0.2 * uWet, 0.7 - 0.2 * uWet, tFbm(p * 1.6 + 3.3) * 0.7 + tNoise(p * 6.0) * 0.3) * smoothstep(0.3, 0.8, uWet);
      col = mix(col, col * 0.5, pud); rough = mix(rough, 0.025, pud);
      bh *= 1.0 - pud;
      // (The rings: a bump of their own, flattened away from the puddles.)
      bh += rRipples(p * 0.6, uTime, uRain * 0.9).z * 0.18 * pud * fade / max(bumpK, 0.1);
    }
  }
  // Wet where the sea reaches: darker, and shining.
  float wet = (1.0 - smoothstep(0.0, 0.05 + 0.03 * n2, wetY)) * step(id, 4.5 + step(8.5, id) * 9.0);
  col = mix(col, col * vec3(0.5, 0.52, 0.56), wet); rough = mix(rough, 0.25, wet);
  col *= vTBlend.w;
  diffuseColor.rgb = col;
  tRough = rough;
  tBump = bh * bumpK * fade * 0.06;
}
`

function groundMaterial(seaY: number, time: { value: number }, caustics: { value: number }) {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeaY = { value: seaY }
    sh.uniforms.uTime = time
    sh.uniforms.uCaustic = caustics
    sh.uniforms.uWet = wetness.wet; sh.uniforms.uRain = wetness.rain
    sh.vertexShader = 'attribute vec3 aSurf;\nattribute vec4 aBlend;\nvarying vec3 vTW;\nvarying vec3 vTN;\nvarying vec3 vTSurf;\nvarying vec4 vTBlend;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vTN = normalize(mat3(modelMatrix) * objectNormal);\n  vTSurf = aSurf;\n  vTBlend = aBlend;',
    )
    sh.fragmentShader = GROUND_HEAD + RIPPLES_GLSL + sh.fragmentShader
      .replace('#include <color_fragment>', () => '#include <color_fragment>\n' + GROUND_BODY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = tPerturb(-vViewPosition, normal, vec2(dFdx(tBump), dFdy(tBump)), faceDirection);')
  }
  m.customProgramCacheKey = () => 'walk-ground'
  return m
}

export { PX_H }
