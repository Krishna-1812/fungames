/**
 * The walk — the island built in three.js, from the same facts Unity builds
 * the realistic island from (world.ts, IslandModel; pages/walk/world.json):
 * the ground tile by tile, with its terraces and cliffs, beaches, roads, the
 * river and the pond; the sea over its floor; every building out of its
 * solids, as unity/Assets/Island/Editor/Buildings.cs builds them (boxes,
 * bands, windows with their frames and sills, doors, awnings, pitched and
 * pyramid roofs, drums, cones, domes, balls, discs, panels and rods); and the
 * trees and rocks, low-poly, where the island planted them.
 *
 * Tile i runs along world z, tile j along world x, and the island's heights
 * (P()'s z, in the site's units) go up y at 39.19 to a tile, as in Unity.
 * Everything is gathered into a few meshes coloured by vertex: one for the
 * ground, one for what is built, one for the lit windows (they glow at
 * night), one for what grows.
 */
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, Group, MeshPhysicalMaterial,
} from 'three'

export const PX_H = 39.19
export const Y = (z: number) => z / PX_H
/** A tile point (i, j) at the site's height z, in the world. */
export const W = (i: number, j: number, z: number) => new Vector3(j, Y(z), i)

export type Solid = { k: string; [key: string]: unknown }
export type WorldData = {
  grid: number; sea: number; beachZ: number; ground: string; height: number[][]; district: string[][]
  river: [number, number][]; pond: [number, number][]; road: [number, number][]; piers: [number, number][][]
  fields: [number, number, number, number, string][]
  buildings: { slug: string; district: string; i: number; j: number; w: number; d: number; z: number; water: boolean }[]
  solids: { slug: string; runs: Solid[][]; k?: number; at?: [number, number, number] }[]
  plants: [string, number, number, number, number][]
  seaRocks: [number, number, number][]
  isles: [number, number, number, number][]
  games: Record<string, { title: string; href: string }>
}

/** Triangles gathered with a colour each, for one mesh. */
class Bag {
  pos: number[] = []; col: number[] = []
  private c = new Color()
  tri(a: Vector3, b: Vector3, c: Vector3, hex: string, shade = 1) {
    if (!hex || hex === 'none' || hex === 'transparent') return
    this.c.set(hex); this.c.multiplyScalar(shade)
    for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.col.push(this.c.r, this.c.g, this.c.b) }
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, hex: string, shade = 1) { this.tri(a, b, c, hex, shade); this.tri(a, c, d, hex, shade) }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.computeVertexNormals()
    return g
  }
}

const GREEN: Record<string, string> = { peaks: '#5f9e57', badlands: '#cfc4ae', proving: '#67a957', harbour: '#69ad5b', funfair: '#69ad5b', market: '#69ad5b', oldtown: '#69ad5b' }

/** The open ocean's colour, beyond the floor the island stands on. */
const DEEP_SEA = '#0c3a55'

/* ---- the ground ------------------------------------------------------------ */
function ground(d: WorldData) {
  const g = new Bag()
  const N = d.grid
  const road = new Set(d.road.map(([i, j]) => `${i},${j}`)), wet = new Set([...d.river, ...d.pond].map(([i, j]) => `${i},${j}`))
  const kind = (i: number, j: number) => (i < 0 || j < 0 || i >= N || j >= N ? '0' : d.ground[i * N + j])
  /** The top of a tile: land at its height, a beach half-way down to the sea, the sea's floor deeper the further out. */
  const top = (i: number, j: number) => {
    const k = kind(i, j)
    if (k === '1') return d.height[i][j]
    if (k === 'b') return d.beachZ
    return d.sea - 3 - Math.min(26, offshore(i, j) * 6)
  }
  /** How far a sea tile is from the nearest land, in tiles (9 for anywhere further than three). */
  const offshore = (i: number, j: number) => {
    let near = 9
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (kind(i + a, j + b) !== '0') near = Math.min(near, Math.hypot(a, b))
    return near
  }
  // The sea floor: pale sand in the shallows, going to the open ocean's own deep blue, so its edge never shows.
  const SAND = new Color('#d9cfb2'), DEEP = new Color(DEEP_SEA)
  const floor = (i: number, j: number) => '#' + SAND.clone().lerp(DEEP, Math.min(1, Math.max(0, (offshore(i, j) - 1) / 2.6)) ** 0.8).getHexString()
  const colour = (i: number, j: number) => {
    const k = kind(i, j), key = `${i},${j}`
    if (k === '0') return floor(i, j)
    if (k === 'b') return '#eadfc4'
    if (wet.has(key)) return '#3f93b8'
    if (road.has(key)) return '#8a8f99'
    const h = d.height[i][j], dk = d.district[i][j]
    if (dk === 'peaks' && h >= 48) return '#eef2f6'
    return GREEN[dk] ?? '#69ad5b'
  }
  const M = 8
  for (let i = -M; i < N + M; i++) for (let j = -M; j < N + M; j++) {
    const z = top(i, j), c = colour(i, j)
    // A little unevenness in the grass, so a lawn is never one flat colour.
    const shade = 0.94 + 0.08 * Math.sin(i * 1.7 + j * 0.9) * Math.cos(j * 1.3 - i * 0.4)
    g.quad(W(i, j, z), W(i, j + 1, z), W(i + 1, j + 1, z), W(i + 1, j, z), c, kind(i, j) === '1' && !road.has(`${i},${j}`) ? shade : 1)
    // Walls down to each lower neighbour: rock for a terrace or a cliff, sand down a beach.
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const z2 = top(i + a, j + b)
      if (z2 >= z) continue
      const wall = kind(i, j) === '1' && z - z2 > 8 ? (d.district[Math.max(0, Math.min(N - 1, i))]?.[Math.max(0, Math.min(N - 1, j))] === 'badlands' ? '#b9a88f' : '#8d8780') : '#d8cba9'
      const [p, q] = a === 1 ? [[i + 1, j + 1], [i + 1, j]] : a === -1 ? [[i, j], [i, j + 1]] : b === 1 ? [[i + 1, j + 1], [i, j + 1]] : [[i, j], [i + 1, j]]
      g.quad(W(p[0], p[1], z), W(q[0], q[1], z), W(q[0], q[1], z2), W(p[0], p[1], z2), wall, a + b > 0 ? 0.86 : 1)
    }
  }
  const mesh = new Mesh(g.geometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: DoubleSide }))
  mesh.receiveShadow = true
  return { mesh, top, kind }
}

/* ---- what is built ------------------------------------------------------- */
type Num = number
const n = (v: unknown, d = 0) => (typeof v === 'number' ? v : d)
const s = (v: unknown, d = '#ffffff') => (typeof v === 'string' ? v : d)
type BoxR = { x: Num; y: Num; w: Num; d: Num; z0: Num; h: Num }

function solids(d: WorldData) {
  const built = new Bag(), glass = new Bag(), bulbs = new Bag()
  const lamps: Vector3[] = []
  const boxes: { i0: number; j0: number; i1: number; j1: number; z0: number; z1: number }[] = []
  for (const rec of d.solids) {
    const k = rec.k ?? 1, at = rec.at ?? [0, 0, 0]
    // A set piece is built bigger about its plot's front corner.
    const w = (i: number, j: number, z: number) => k === 1 ? W(i, j, z) : W(at[0] + (i - at[0]) * k, at[1] + (j - at[1]) * k, at[2] + (z - at[2]) * k)
    const panel = (b: BoxR, face: string, u0: number, u1: number, z0: number, z1: number, col: string, out = 0.004, bag = built) => {
      const Z0 = b.z0 + z0, Z1 = b.z0 + z1
      if (face === 'x') { const i = b.x + b.w + out, ja = b.y + u0 * b.d, jb = b.y + u1 * b.d; bag.quad(w(i, ja, Z0), w(i, jb, Z0), w(i, jb, Z1), w(i, ja, Z1), col) }
      else { const j = b.y + b.d + out, ia = b.x + u0 * b.w, ib = b.x + u1 * b.w; bag.quad(w(ib, j, Z0), w(ia, j, Z0), w(ia, j, Z1), w(ib, j, Z1), col) }
    }
    const ring = (cx: number, cy: number, r: number, z0: number, z1: number, col: string, sides = 20) => {
      for (let q = 0; q < sides; q++) {
        const a0 = (q / sides) * Math.PI * 2, a1 = ((q + 1) / sides) * Math.PI * 2
        built.quad(w(cx + Math.sin(a0) * r, cy + Math.cos(a0) * r, z0), w(cx + Math.sin(a1) * r, cy + Math.cos(a1) * r, z0), w(cx + Math.sin(a1) * r, cy + Math.cos(a1) * r, z1), w(cx + Math.sin(a0) * r, cy + Math.cos(a0) * r, z1), col)
      }
    }
    const lid = (cx: number, cy: number, r: number, z: number, col: string, sides = 20) => {
      for (let q = 0; q < sides; q++) { const a0 = (q / sides) * Math.PI * 2, a1 = ((q + 1) / sides) * Math.PI * 2; built.tri(w(cx, cy, z), w(cx + Math.sin(a0) * r, cy + Math.cos(a0) * r, z), w(cx + Math.sin(a1) * r, cy + Math.cos(a1) * r, z), col) }
    }
    const ball = (cx: number, cy: number, cz: number, r: number, rz: number, from: number, col: string, bag = built) => {
      const lon = 16, lat = 8
      for (let y = 0; y < lat; y++) {
        const t0 = (from + (1 - from) * (y / lat)) * Math.PI / 2, t1 = (from + (1 - from) * ((y + 1) / lat)) * Math.PI / 2
        for (let x = 0; x < lon; x++) {
          const a0 = (x / lon) * Math.PI * 2, a1 = ((x + 1) / lon) * Math.PI * 2
          const P = (t: number, a: number) => w(cx + Math.cos(t) * Math.sin(a) * r, cy + Math.cos(t) * Math.cos(a) * r, cz + Math.sin(t) * rz)
          bag.quad(P(t0, a0), P(t0, a1), P(t1, a1), P(t1, a0), col)
        }
      }
    }
    for (const run of rec.runs) for (const q of run) {
      switch (q.k) {
        case 'box': {
          const i0 = n(q.x), j0 = n(q.y), i1 = i0 + n(q.w), j1 = j0 + n(q.d), z0 = n(q.z0), z1 = z0 + n(q.h), col = s(q.fill)
          built.quad(w(i1, j0, z0), w(i1, j1, z0), w(i1, j1, z1), w(i1, j0, z1), col)
          built.quad(w(i1, j1, z0), w(i0, j1, z0), w(i0, j1, z1), w(i1, j1, z1), col, 0.9)
          built.quad(w(i0, j1, z0), w(i0, j0, z0), w(i0, j0, z1), w(i0, j1, z1), col)
          built.quad(w(i0, j0, z0), w(i1, j0, z0), w(i1, j0, z1), w(i0, j0, z1), col, 0.9)
          built.quad(w(i0, j0, z1), w(i1, j0, z1), w(i1, j1, z1), w(i0, j1, z1), s(q.top, col))
          if (typeof q.trim === 'string') { const b = { x: i0, y: j0, w: n(q.w), d: n(q.d), z0, h: n(q.h) }; panel(b, 'x', 0, 1, n(q.h) - 3, n(q.h), q.trim, 0.006); panel(b, 'y', 0, 1, n(q.h) - 3, n(q.h), q.trim, 0.006) }
          if (k === 1 || true) { const a = w(i0, j0, z0), b2 = w(i1, j1, z1); boxes.push({ i0: Math.min(a.z, b2.z), j0: Math.min(a.x, b2.x), i1: Math.max(a.z, b2.z), j1: Math.max(a.x, b2.x), z0: Math.min(a.y, b2.y), z1: Math.max(a.y, b2.y) }) }
          break
        }
        case 'band': { const b = q.b as BoxR; for (const f of ['x', 'y']) panel(b, f, 0, 1, n(q.z0), n(q.z1), s(q.fill), 0.006); break }
        case 'quad': { const b = q.b as BoxR; panel(b, s(q.face, 'x'), n(q.u0), n(q.u1), n(q.z0), n(q.z1), s(q.fill), 0.005); break }
        case 'win': {
          const b = q.b as BoxR, face = s(q.face, 'x'), rows = n(q.rows, 1), cols = n(q.cols, 2), h = n(q.h, 10), gap = n(q.gap, 8), wide = n(q.wide, 0.5)
          const len = face === 'x' ? b.d : b.w, slot = 1 / cols, ww = slot * wide, fu = 1.6 / (64 * Math.max(len, 0.05))
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const u = slot * (c + 0.5), z = n(q.z0, 8) + r * (h + gap)
            panel(b, face, u - ww / 2 - fu, u + ww / 2 + fu, z - 1.5, z + h + 1.5, s(q.frame, '#ffffff'), 0.005)
            // About two windows in three have someone home, the light on after dark.
            const home = Math.abs(Math.sin(b.x * 12.99 + b.y * 78.23 + z * 0.37 + c * 5.1 + (face === 'x' ? 0 : 3.3)) * 43758.5) % 1 < 0.66
            panel(b, face, u - ww / 2, u + ww / 2, z, z + h, '#2b3a55', 0.008, home ? glass : built)
            panel(b, face, u - ww / 2 - fu * 2, u + ww / 2 + fu * 2, z - 2.8, z - 1.2, '#d5d9ea', 0.012)
          }
          break
        }
        case 'door': {
          const b = q.b as BoxR, face = s(q.face, 'x'), len = face === 'x' ? b.d : b.w, dw = n(q.w, 0.22) / Math.max(len, 0.05), u = n(q.u, 0.5), h = n(q.h, 16)
          panel(b, face, u - dw / 2 - 0.02 / len, u + dw / 2 + 0.02 / len, 0, h + 2, '#f4f6fc', 0.005)
          panel(b, face, u - dw / 2, u + dw / 2, 0, h, s(q.fill, '#5b82ff'), 0.008)
          break
        }
        case 'awning': {
          const b = q.b as BoxR, face = s(q.face, 'y'), cs = (q.colours as string[]) ?? ['#ffffff'], u0 = n(q.u0), u1 = n(q.u1, 1), Z = b.z0 + n(q.z), out = n(q.out, 0.16), m = cs.length * 2
          for (let t = 0; t < m; t++) {
            const a = u0 + ((u1 - u0) * t) / m, c = u0 + ((u1 - u0) * (t + 1)) / m, col = cs[t % cs.length]
            if (face === 'y') { const j = b.y + b.d, ia = b.x + a * b.w, ic = b.x + c * b.w; built.quad(w(ic, j + out, Z - 7), w(ia, j + out, Z - 7), w(ia, j, Z), w(ic, j, Z), col) }
            else { const i = b.x + b.w, ja = b.y + a * b.d, jc = b.y + c * b.d; built.quad(w(i + out, ja, Z - 7), w(i + out, jc, Z - 7), w(i, jc, Z), w(i, ja, Z), col) }
          }
          break
        }
        case 'gable': {
          const e = n(q.over, 0.06), x = n(q.x) - e, y = n(q.y) - e, gw = n(q.w) + e * 2, gd = n(q.d) + e * 2, z = n(q.z), h = n(q.h), roof = s(q.fill), end = '#eceef4'
          if (s(q.axis, 'x') === 'x') {
            const my = y + gd / 2
            built.quad(w(x + gw, y + gd, z), w(x, y + gd, z), w(x, my, z + h), w(x + gw, my, z + h), roof, 0.92)
            built.quad(w(x, y, z), w(x + gw, y, z), w(x + gw, my, z + h), w(x, my, z + h), roof)
            built.tri(w(x + gw - e, y + e, z), w(x + gw - e, y + gd - e, z), w(x + gw - e, my, z + h - 1), end)
            built.tri(w(x + e, y + gd - e, z), w(x + e, y + e, z), w(x + e, my, z + h - 1), end)
          } else {
            const mx = x + gw / 2
            built.quad(w(x + gw, y, z), w(x + gw, y + gd, z), w(mx, y + gd, z + h), w(mx, y, z + h), roof, 0.92)
            built.quad(w(x, y + gd, z), w(x, y, z), w(mx, y, z + h), w(mx, y + gd, z + h), roof)
            built.tri(w(x + gw - e, y + gd - e, z), w(x + e, y + gd - e, z), w(mx, y + gd - e, z + h - 1), end)
            built.tri(w(x + e, y + e, z), w(x + gw - e, y + e, z), w(mx, y + e, z + h - 1), end)
          }
          break
        }
        case 'pyramid': {
          const x = n(q.x), y = n(q.y), pw = n(q.w), pd = n(q.d), z = n(q.z), h = n(q.h), col = s(q.fill)
          const apex = w(x + pw / 2, y + pd / 2, z + h), c0 = w(x, y, z), c1 = w(x + pw, y, z), c2 = w(x + pw, y + pd, z), c3 = w(x, y + pd, z)
          built.tri(c1, c2, apex, col); built.tri(c2, c3, apex, col, 0.9); built.tri(c3, c0, apex, col); built.tri(c0, c1, apex, col, 0.9)
          break
        }
        case 'cyl': {
          const cx = n(q.cx), cy = n(q.cy), r = n(q.r), z0 = n(q.z0), h = n(q.h), side = s(q.side ?? q.fill)
          ring(cx, cy, r, z0, z0 + h, side)
          for (const band of (q.bands as [number, number, string][] | undefined) ?? []) ring(cx, cy, r + 0.004, z0 + band[0], z0 + band[1], band[2])
          lid(cx, cy, r, z0 + h, s(q.top ?? q.fill))
          break
        }
        case 'cone': {
          const cx = n(q.cx), cy = n(q.cy), r = n(q.r), z0 = n(q.z0), h = n(q.h), col = s(q.fill)
          for (let t = 0; t < 20; t++) { const a0 = (t / 20) * Math.PI * 2, a1 = ((t + 1) / 20) * Math.PI * 2; built.tri(w(cx + Math.sin(a1) * r, cy + Math.cos(a1) * r, z0), w(cx + Math.sin(a0) * r, cy + Math.cos(a0) * r, z0), w(cx, cy, z0 + h), col) }
          break
        }
        case 'dome': ball(n(q.cx), n(q.cy), n(q.z0), n(q.r), n(q.r) * PX_H, 0, s(q.fill)); break
        case 'sphere': { const r = n(q.r) / 45.25; ball(n(q.cx), n(q.cy), n(q.z), r, r * PX_H, -1, s(q.fill)); break }
        case 'disc': { const cx = n(q.cx), cy = n(q.cy), r = n(q.r), z = n(q.z); ring(cx, cy, r, z - 1.5, z, s(q.fill)); lid(cx, cy, r, z, s(q.fill)); break }
        case 'poly': {
          const p = (q.pts as [number, number, number][]) ?? []
          if (p.length >= 3) for (let t = 1; t + 1 < p.length; t++) built.tri(w(...p[0]), w(...p[t]), w(...p[t + 1]), s(q.fill))
          break
        }
        case 'rod': {
          const [a, b] = (q.pts as [number, number, number][]) ?? []
          if (!a || !b) break
          const A = w(...a), B = w(...b), dir = B.clone().sub(A), r = Math.max(0.006, (n(q.r, 1) / 45.25)), up = Math.abs(dir.y) > 0.9 * dir.length() ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
          const u = new Vector3().crossVectors(dir, up).normalize().multiplyScalar(r), v = new Vector3().crossVectors(dir, u).normalize().multiplyScalar(r)
          const col = s(q.fill, '#1b2340')
          for (let t = 0; t < 6; t++) {
            const a0 = (t / 6) * Math.PI * 2, a1 = ((t + 1) / 6) * Math.PI * 2
            const o0 = u.clone().multiplyScalar(Math.cos(a0)).add(v.clone().multiplyScalar(Math.sin(a0))), o1 = u.clone().multiplyScalar(Math.cos(a1)).add(v.clone().multiplyScalar(Math.sin(a1)))
            built.quad(A.clone().add(o0), A.clone().add(o1), B.clone().add(o1), B.clone().add(o0), col)
          }
          break
        }
        case 'model': {
          // The island's named models (Unity's Models.cs): a street lamp is the one that matters on foot.
          if (q.name === 'lamp') {
            const x = n(q.x), y = n(q.y), z = n(q.z), h = n(q.h, 26)
            ring(x, y, 0.025, z, z + h, '#3a4256', 6)
            ball(x, y, z + h + 1, 0.05, 0.05 * PX_H, -1, '#f4f6fc', bulbs)
            lamps.push(w(x, y, z + h + 1))
          }
          break
        }
      }
    }
  }
  const builtMesh = new Mesh(built.geometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: DoubleSide }))
  builtMesh.castShadow = true; builtMesh.receiveShadow = true
  const glassMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2, emissive: new Color('#ffd9a0'), emissiveIntensity: 0, side: DoubleSide })
  const glassMesh = new Mesh(glass.geometry(), glassMat)
  // The street lamps' globes: they glow at night (and light the street round you; walker.ts).
  const bulbMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#e6eeff'), emissiveIntensity: 0 })
  const bulbMesh = new Mesh(bulbs.geometry(), bulbMat)
  return { builtMesh, glassMesh, glassMat, bulbMesh, bulbMat, lamps, boxes }
}

/* ---- what grows ---------------------------------------------------------- */
function plants(d: WorldData) {
  const g = new Bag()
  const cone = (x: number, y: number, z: number, r: number, h: number, col: string, sides = 8) => {
    for (let t = 0; t < sides; t++) { const a0 = (t / sides) * Math.PI * 2, a1 = ((t + 1) / sides) * Math.PI * 2; g.tri(W(x + Math.sin(a0) * r, y + Math.cos(a0) * r, z), W(x + Math.sin(a1) * r, y + Math.cos(a1) * r, z), W(x, y, z + h), col, t % 2 ? 0.88 : 1) }
  }
  const trunk = (x: number, y: number, z: number, r: number, h: number, col = '#7a5f4a') => {
    for (let t = 0; t < 6; t++) { const a0 = (t / 6) * Math.PI * 2, a1 = ((t + 1) / 6) * Math.PI * 2; g.quad(W(x + Math.sin(a0) * r, y + Math.cos(a0) * r, z), W(x + Math.sin(a1) * r, y + Math.cos(a1) * r, z), W(x + Math.sin(a1) * r, y + Math.cos(a1) * r, z + h), W(x + Math.sin(a0) * r, y + Math.cos(a0) * r, z + h), col) }
  }
  const blob = (x: number, y: number, z: number, r: number, col: string) => {
    const lon = 8, lat = 5
    for (let a = 0; a < lat; a++) for (let b = 0; b < lon; b++) {
      const t0 = -Math.PI / 2 + (a / lat) * Math.PI, t1 = -Math.PI / 2 + ((a + 1) / lat) * Math.PI, p0 = (b / lon) * Math.PI * 2, p1 = ((b + 1) / lon) * Math.PI * 2
      const P = (t: number, p: number) => W(x + Math.cos(t) * Math.sin(p) * r, y + Math.cos(t) * Math.cos(p) * r, z + (Math.sin(t) + 1) * r * PX_H * 0.85)
      g.quad(P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0), col, a < 2 ? 0.85 : 1)
    }
  }
  for (const [name, x, y, z, k] of d.plants) {
    const kind = name.replace(/[0-9]+$/, '').split('-')[0]
    if (kind === 'pine' || kind === 'snowpine') { trunk(x, y, z, 0.025 * k, 6 * k); cone(x, y, z + 5 * k, 0.17 * k, 22 * k, kind === 'snowpine' ? '#dfe8ee' : '#2f6b43'); cone(x, y, z + 14 * k, 0.12 * k, 18 * k, kind === 'snowpine' ? '#eef3f7' : '#3a7d4f') }
    else if (kind === 'palm') { trunk(x, y, z, 0.022 * k, 22 * k, '#9a8466'); for (let t = 0; t < 6; t++) { const a = (t / 6) * Math.PI * 2; g.tri(W(x, y, z + 22 * k), W(x + Math.sin(a) * 0.26 * k, y + Math.cos(a) * 0.26 * k, z + 15 * k), W(x + Math.sin(a + 0.4) * 0.22 * k, y + Math.cos(a + 0.4) * 0.22 * k, z + 18 * k), '#3f8f4c') } }
    else if (kind === 'cypress') { trunk(x, y, z, 0.02 * k, 4 * k); cone(x, y, z + 3 * k, 0.09 * k, 30 * k, '#2c6845') }
    else if (kind === 'round' || kind === 'blossom' || kind === 'bush') { const r = (kind === 'bush' ? 0.13 : 0.18) * k; if (kind !== 'bush') trunk(x, y, z, 0.025 * k, 8 * k); blob(x, y, z + (kind === 'bush' ? 0 : 7 * k), r, kind === 'blossom' ? '#f3b6c9' : kind === 'bush' ? '#4f9550' : '#4e9a4d') }
    else if (kind === 'rock' || kind === 'boulders') blob(x, y, z - 1, 0.12 * k, '#8d8a85')
    else if (kind === 'cactus' || kind === 'barrel') { trunk(x, y, z, 0.035 * k, (kind === 'barrel' ? 6 : 18) * k, '#4f9a5e') }
    else if (kind === 'hoodoo' || kind === 'butte') trunk(x, y, z, (kind === 'butte' ? 0.32 : 0.09) * k, (kind === 'butte' ? 30 : 34) * k, '#c4a98c')
    else if (kind === 'reeds') cone(x, y, z, 0.05 * k, 10 * k, '#6f9a4e', 5)
    else if (kind === 'snag') trunk(x, y, z, 0.02 * k, 14 * k, '#8d7a66')
  }
  const mesh = new Mesh(g.geometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: DoubleSide }))
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}

/** The sea's slope at a point: seven waves, long swells to short ripples, each running at deep water's speed for its length. */
const WAVES = /* glsl */ `#include <normal_fragment_maps>
  {
    vec2 p = vWPos.xz, g = vec2(0.0);
    vec4 W[7];
    W[0] = vec4(normalize(vec2(1.0, 0.35)), 1.9, 0.11);
    W[1] = vec4(normalize(vec2(0.6, 1.0)), 2.7, 0.08);
    W[2] = vec4(normalize(vec2(-0.8, 0.5)), 4.3, 0.06);
    W[3] = vec4(normalize(vec2(0.2, -1.0)), 7.9, 0.05);
    W[4] = vec4(normalize(vec2(1.0, -0.6)), 13.0, 0.04);
    W[5] = vec4(normalize(vec2(-0.3, -1.0)), 21.0, 0.03);
    W[6] = vec4(normalize(vec2(0.9, 0.9)), 33.0, 0.025);
    for (int k = 0; k < 7; k++) {
      float kn = W[k].z, ph = dot(W[k].xy, p) * kn - uTime * sqrt(9.8 * kn * 0.29);
      g += W[k].xy * W[k].w * cos(ph);
    }
    // Calmer far off, so the horizon reads as a line, not noise.
    g *= 1.0 - 0.75 * clamp(length(vWPos - cameraPosition) / 60.0, 0.0, 1.0);
    normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);
  }`

/** The whole island: its meshes, the sea, and what the walker needs to know of it (heights, walls, the games). */
export function buildWorld(d: WorldData) {
  const root = new Group()
  const gr = ground(d)
  root.add(gr.mesh)
  const sol = solids(d)
  root.add(sol.builtMesh, sol.glassMesh, sol.bulbMesh)
  root.add(plants(d))
  // The sea: clear water over its sandy floor, deepening off the coast, and
  // beyond the floor the open ocean, dark and deep, out to the horizon.
  const deep = new Mesh(new PlaneGeometry(6000, 6000, 1, 1), new MeshStandardMaterial({ color: DEEP_SEA, roughness: 1 }))
  deep.rotation.x = -Math.PI / 2
  deep.position.set(d.grid / 2, Y(d.sea) - 1.6, d.grid / 2)
  root.add(deep)
  const time = { value: 0 }
  const water = new MeshPhysicalMaterial({ color: '#14688f', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.84 })
  // Its surface moves: a few long swells and many short ripples, summed as a
  // slope the light then sees (the sun's glitter, the sky's reflection) — the
  // sheet itself stays flat, so the coast never shifts under you.
  water.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', WAVES)
  }
  const sea = new Mesh(new PlaneGeometry(6000, 6000, 1, 1), water)
  sea.rotation.x = -Math.PI / 2
  sea.position.set(d.grid / 2, Y(d.sea), d.grid / 2)
  sea.receiveShadow = true
  root.add(sea)
  return { root, top: gr.top, kind: gr.kind, boxes: sol.boxes, glass: sol.glassMat, bulbs: sol.bulbMat, lamps: sol.lamps, sea, time }
}
