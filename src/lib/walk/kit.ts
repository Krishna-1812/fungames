/**
 * Small tools the walk's living things are built with (folk.ts, birds.ts,
 * fish.ts, boats.ts): a bag of triangles that takes whole shapes placed and
 * coloured, merged into one geometry in metres and scaled to the world at the
 * end; a lofted hull or body from a list of cross-sections; and a few
 * placements.
 */
import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three'
import { METRE } from './body'

/** Triangles gathered from shapes (in metres): positions, normals and a colour at each corner. */
export class Bag {
  p: number[] = []; n: number[] = []; c: number[] = []
  /** A whole geometry, placed by m, in one colour (white if none: an instance's own colour then shows as it is). */
  add(g: BufferGeometry, m?: Matrix4, c?: Color | string) {
    const ng = g.index ? g.toNonIndexed() : g
    if (m) ng.applyMatrix4(m)
    if (!ng.getAttribute('normal')) ng.computeVertexNormals()
    const P = ng.getAttribute('position'), N = ng.getAttribute('normal')
    const col = typeof c === 'string' ? new Color(c) : c ?? new Color(1, 1, 1)
    for (let i = 0; i < P.count; i++) {
      this.p.push(P.getX(i), P.getY(i), P.getZ(i)); this.n.push(N.getX(i), N.getY(i), N.getZ(i)); this.c.push(col.r, col.g, col.b)
    }
    g.dispose(); if (ng !== g) ng.dispose()
    return this
  }
  /** One triangle, its normal worked out from its corners (or given). */
  tri(a: Vector3, b: Vector3, c: Vector3, col: Color, n?: Vector3) {
    const nn = n ?? new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()
    for (const p of [a, b, c]) { this.p.push(p.x, p.y, p.z); this.n.push(nn.x, nn.y, nn.z); this.c.push(col.r, col.g, col.b) }
  }
  get empty() { return this.p.length === 0 }
  /** The geometry, scaled from metres to the world (or by the scale given). */
  geometry(scale = METRE) {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3))
    g.scale(scale, scale, scale)
    g.computeBoundingSphere()
    return g
  }
}

const E = new Euler(), Q = new Quaternion(), V = new Vector3(), S = new Vector3()
/** A placement: moved to (x, y, z), turned (about y, then x, then z), scaled. */
export const place = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S.set(sx, sy, sz))

/**
 * A loft: a surface through cross-sections, each a ring of points (closed, or open down the middle of a
 * symmetric shape), stations along x. section(t) gives the ring at t (0 to 1); n stations, k points a ring.
 * Each ring point may carry its own colour (cols(t, r) for ring point r) — a waterline, a stripe, a rubbing strake.
 */
export function loft(bag: Bag, n: number, section: (t: number) => Vector3[], cols: (t: number, r: number) => Color, opts: { closed?: boolean; capStart?: boolean; capEnd?: boolean; smooth?: boolean } = {}) {
  const rings: Vector3[][] = []
  for (let s = 0; s <= n; s++) rings.push(section(s / n))
  const k = rings[0].length, wrap = opts.closed ? k : k - 1
  // Smooth normals: averaged across each ring and along the loft.
  const nrm = rings.map((ring, s) => ring.map((p, r) => {
    const a = rings[Math.max(0, s - 1)][r], b = rings[Math.min(n, s + 1)][r]
    const c = ring[opts.closed ? (r - 1 + k) % k : Math.max(0, r - 1)], d = ring[opts.closed ? (r + 1) % k : Math.min(k - 1, r + 1)]
    const along = new Vector3().subVectors(b, a), round = new Vector3().subVectors(d, c)
    const nn = new Vector3().crossVectors(along, round)
    if (nn.lengthSq() < 1e-12) nn.copy(p).setX(0)
    return nn.normalize()
  }))
  for (let s = 0; s < n; s++) for (let r = 0; r < wrap; r++) {
    const r2 = (r + 1) % k
    const a = rings[s][r], b = rings[s + 1][r], c = rings[s + 1][r2], d = rings[s][r2]
    const col = cols((s + 0.5) / n, r)
    if (opts.smooth === false) { bag.tri(a, b, c, col); bag.tri(a, c, d, col); continue }
    const na = nrm[s][r], nb = nrm[s + 1][r], nc = nrm[s + 1][r2], nd = nrm[s][r2]
    for (const [p, q] of [[a, na], [b, nb], [c, nc], [a, na], [c, nc], [d, nd]] as const) { bag.p.push(p.x, p.y, p.z); bag.n.push(q.x, q.y, q.z); bag.c.push(col.r, col.g, col.b) }
  }
  // End caps: fans from each ring's middle, facing out of the end.
  const mid = (ring: Vector3[]) => ring.reduce((m, p) => m.add(p), new Vector3()).divideScalar(ring.length)
  const cap = (ring: Vector3[], next: Vector3[], t: number) => {
    const m = mid(ring), out = m.clone().sub(mid(next)).normalize()
    for (let r = 0; r < k; r++) {
      const a = ring[r], b = ring[(r + 1) % k]
      const face = new Vector3().subVectors(a, m).cross(new Vector3().subVectors(b, m))
      if (face.dot(out) >= 0) bag.tri(m, a, b, cols(t, r), out); else bag.tri(m, b, a, cols(t, r), out)
    }
  }
  if (opts.capStart) cap(rings[0], rings[1], 0)
  if (opts.capEnd) cap(rings[n], rings[n - 1], 1)
  return rings
}

/** A strip of quads between two lines along t (n of them), each quad wound to face the way hint(t) says. */
export function strip(bag: Bag, n: number, A: (t: number) => Vector3, B: (t: number) => Vector3, col: Color | ((t: number) => Color), hint: (t: number) => Vector3) {
  for (let s = 0; s < n; s++) {
    const t0 = s / n, t1 = (s + 1) / n, tm = (t0 + t1) / 2
    const a = A(t0), b = A(t1), c = B(t1), d = B(t0), h = hint(tm), cc = typeof col === 'function' ? col(tm) : col
    const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
    if (face.dot(h) >= 0) { bag.tri(a, b, c, cc); bag.tri(a, c, d, cc) } else { bag.tri(a, c, b, cc); bag.tri(a, d, c, cc) }
  }
}

/** A curve through a few points [t, value], straight between them. */
export const curve = (k: [number, number][]) => (t: number) => {
  if (t <= k[0][0]) return k[0][1]
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1] = k[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) }
  return k[k.length - 1][1]
}

/** A seeded random number generator (mulberry32): the same island, the same people, every time. */
export const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
