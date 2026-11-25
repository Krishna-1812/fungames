/**
 * The walk — the island built in three.js, from the same facts Unity builds
 * the realistic island from (world.ts, IslandModel; pages/walk/world.json):
 * the ground (terrain.ts: slopes, cliffs, beaches, streets, the stream and
 * the pond, painted with what each is made of); the sea over its floor; every building out of its
 * solids, as unity/Assets/Island/Editor/Buildings.cs builds them (boxes,
 * bands, windows with their frames and sills, doors, awnings, pitched and
 * pyramid roofs, drums, cones, domes, balls, discs, panels and rods), with
 * what makes them real up close (facade.ts: render, tiles and gravel, rooms
 * behind the glass, cornices, parapets and what stands on flat roofs, the
 * lighthouse, boards and posters, a name over each game's door); and what
 * grows where the island planted it (flora.ts: trees, palms, cacti, rocks,
 * grass and wildflowers, all in the wind).
 *
 * Tile i runs along world z, tile j along world x, and the island's heights
 * (P()'s z, in the site's units) go up y at 39.19 to a tile, as in Unity.
 * Everything is gathered into a few meshes coloured by vertex: one for the
 * ground, one for what is built, one for the lit windows (they glow at
 * night), one for what grows.
 */
import { terrain } from './terrain'
import { buildSea, poolMaterial } from './water'
import { flora } from './flora'
import { ACROSS, FACING, GlassBag, Hy, MAT, PrintBag, Px, atlas, facadeMaterial, glassMaterial, type Print } from './facade'
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, Group,
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
  /** The map's pictures (SVG) that boards and posters carry. */
  prints?: Print[]
}

/** Triangles gathered with a colour each — and what each is made of (facade.ts), and where its wall stands — for one mesh. */
class Bag {
  pos: number[] = []; col: number[] = []; mat: number[] = []; base: number[] = []
  /** What the next triangles are made of, and the height (world y) of the foot of their wall. */
  m: number = MAT.paint; b = -99
  private c = new Color()
  tri(a: Vector3, b: Vector3, c: Vector3, hex: string, shade = 1) {
    if (!hex || hex === 'none' || hex === 'transparent') return
    this.c.set(hex); this.c.multiplyScalar(shade)
    for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.col.push(this.c.r, this.c.g, this.c.b); this.mat.push(this.m); this.base.push(this.b) }
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, hex: string, shade = 1) { this.tri(a, b, c, hex, shade); this.tri(a, c, d, hex, shade) }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('aMat', new Float32BufferAttribute(this.mat, 1))
    g.setAttribute('aBase', new Float32BufferAttribute(this.base, 1))
    g.computeVertexNormals()
    return g
  }
}

/** The open ocean's colour, beyond the floor the island stands on. */
const DEEP_SEA = '#0c3a55'

/* ---- what is built ------------------------------------------------------- */
type Num = number
const n = (v: unknown, d = 0) => (typeof v === 'number' ? v : d)
const s = (v: unknown, d = '#ffffff') => (typeof v === 'string' ? v : d)
type BoxR = { x: Num; y: Num; w: Num; d: Num; z0: Num; h: Num }
const hash = (a: number, b: number, c = 0) => { const t = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return t - Math.floor(t) }
const shadeOf = (hex: string, k: number) => '#' + new Color(hex).multiplyScalar(k).getHexString()

function solids(d: WorldData, pics: ReturnType<typeof atlas>) {
  const built = new Bag(), bulbs = new Bag(), glass = new GlassBag(), printed = new PrintBag()
  const lamps: Vector3[] = []
  const boxes: { i0: number; j0: number; i1: number; j1: number; z0: number; z1: number }[] = []
  const UP = new Vector3(0, 1, 0)

  // What stands on what: the foot of everything (world x, z footprint, and y), so a roof with nothing on it is known.
  const feet: { x0: number; z0: number; x1: number; z1: number; y: number }[] = []
  for (const rec of d.solids) {
    const k = rec.k ?? 1, at = rec.at ?? [0, 0, 0]
    const w = (i: number, j: number, z: number) => k === 1 ? W(i, j, z) : W(at[0] + (i - at[0]) * k, at[1] + (j - at[1]) * k, at[2] + (z - at[2]) * k)
    const foot = (i0: number, j0: number, i1: number, j1: number, z: number) => { const a = w(i0, j0, z), b = w(i1, j1, z); feet.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), y: a.y }) }
    for (const run of rec.runs) for (const q of run) {
      if (q.k === 'box') foot(n(q.x), n(q.y), n(q.x) + n(q.w), n(q.y) + n(q.d), n(q.z0))
      else if (q.k === 'gable' || q.k === 'pyramid') foot(n(q.x), n(q.y), n(q.x) + n(q.w), n(q.y) + n(q.d), n(q.z))
      else if (q.k === 'cyl' || q.k === 'cone' || q.k === 'dome') foot(n(q.cx) - n(q.r), n(q.cy) - n(q.r), n(q.cx) + n(q.r), n(q.cy) + n(q.r), n(q.z0))
    }
  }
  /** How much of a rectangle (world x, z) at a height has something standing on it, 0 to 1. */
  const coveredAt = (x0: number, z0: number, x1: number, z1: number, y: number) => {
    let a = 0
    for (const f of feet) if (Math.abs(f.y - y) < 0.012) a += Math.max(0, Math.min(x1, f.x1) - Math.max(x0, f.x0)) * Math.max(0, Math.min(z1, f.z1) - Math.max(z0, f.z0))
    return Math.min(1, a / Math.max(1e-6, (x1 - x0) * (z1 - z0)))
  }

  // A box drawn from its corners (world), sides and top, each in what it is made of.
  const cuboidW = (a: Vector3, b: Vector3, col: string, side: number = MAT.paint, top: number = MAT.paint, base = a.y) => {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z)
    const P = (x: number, y: number, z: number) => new Vector3(x, y, z)
    built.m = side; built.b = base
    built.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col)
    built.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col, 0.9)
    built.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col, 0.95)
    built.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col, 0.9)
    built.m = top
    built.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), col)
    built.m = MAT.paint; built.b = -99
  }
  // A box on three directions (half sizes along each): Unity's Cuboid.
  const cuboid = (c: Vector3, X: Vector3, Yv: Vector3, Z: Vector3, hx: number, hy: number, hz: number, col: string) => {
    const P = (i: number, j: number, k: number) => c.clone().addScaledVector(X, hx * i).addScaledVector(Yv, hy * j).addScaledVector(Z, hz * k)
    built.quad(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), col)
    built.quad(P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), col)
    built.quad(P(-1, -1, 1), P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), col, 0.9)
    built.quad(P(1, -1, -1), P(1, -1, 1), P(1, 1, 1), P(1, 1, -1), col, 0.9)
    built.quad(P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1), col)
  }
  const tube = (a: Vector3, c: Vector3, r: number, col: string, sides = 8) => {
    const ax = c.clone().sub(a), len = ax.length(); if (len < 1e-5 || r <= 0) return
    ax.divideScalar(len)
    const u = new Vector3().crossVectors(ax, Math.abs(ax.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize(), v = new Vector3().crossVectors(ax, u)
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
      const o0 = u.clone().multiplyScalar(Math.cos(a0) * r).addScaledVector(v, Math.sin(a0) * r), o1 = u.clone().multiplyScalar(Math.cos(a1) * r).addScaledVector(v, Math.sin(a1) * r)
      built.quad(a.clone().add(o0), a.clone().add(o1), c.clone().add(o1), c.clone().add(o0), col)
    }
  }
  /** Turned round an upright axis: rings at heights (site px above z) of radii (tiles), each band its colour. */
  const lathe = (cx: number, cy: number, z: number, rings: [number, number][], col: (q: number) => string, sides = 40, lid = true) => {
    for (let q = 0; q + 1 < rings.length; q++) for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
      const P = (a: number, i: number) => W(cx + Math.sin(a) * rings[i][1], cy + Math.cos(a) * rings[i][1], z + rings[i][0])
      built.quad(P(a1, q), P(a0, q), P(a0, q + 1), P(a1, q + 1), col(q))
    }
    const top = rings[rings.length - 1]
    if (lid && top[1] > 0) for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
      built.tri(W(cx, cy, z + top[0]), W(cx + Math.sin(a0) * top[1], cy + Math.cos(a0) * top[1], z + top[0]), W(cx + Math.sin(a1) * top[1], cy + Math.cos(a1) * top[1], z + top[0]), col(rings.length - 2))
    }
  }
  const orb = (c: Vector3, r: number, col: string, bag = built) => {
    const lon = 12, lat = 8
    for (let a = 0; a < lat; a++) for (let b = 0; b < lon; b++) {
      const t0 = -Math.PI / 2 + (a / lat) * Math.PI, t1 = -Math.PI / 2 + ((a + 1) / lat) * Math.PI, p0 = (b / lon) * Math.PI * 2, p1 = ((b + 1) / lon) * Math.PI * 2
      const P = (t: number, p: number) => new Vector3(c.x + Math.cos(t) * Math.sin(p) * r, c.y + Math.sin(t) * r, c.z + Math.cos(t) * Math.cos(p) * r)
      bag.quad(P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0), col)
    }
  }
  const frameAt = (foot: Vector3) => (dx: number, h: number, dz: number) => foot.clone().addScaledVector(ACROSS, Px(dx)).add(new Vector3(0, Hy(h), 0)).addScaledVector(FACING, Px(dz))

  const games = d.games ?? {}
  const signed = new Set<string>()
  /** What was made (for the checks): flat roofs, what stands on them, rooms behind glass, pictures, names over doors. */
  const made = { roofs: [] as [number, number, number][], onRoofs: 0, rooms: 0, pictures: 0, lighthouse: false }

  for (const rec of d.solids) {
    const k = rec.k ?? 1, at = rec.at ?? [0, 0, 0]
    // A set piece is built bigger about its plot's front corner.
    const w = (i: number, j: number, z: number) => k === 1 ? W(i, j, z) : W(at[0] + (i - at[0]) * k, at[1] + (j - at[1]) * k, at[2] + (z - at[2]) * k)
    const outOf = (face: string) => (face === 'x' ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0))
    /** A point on a box's face: u along it, z (site units) up from its foot, out from it (tiles). */
    const on = (b: BoxR, face: string, u: number, z: number, out: number) => face === 'x' ? w(b.x + b.w + out, b.y + u * b.d, b.z0 + z) : w(b.x + u * b.w, b.y + b.d + out, b.z0 + z)
    const panel = (b: BoxR, face: string, u0: number, u1: number, z0: number, z1: number, col: string, out = 0.004, bag = built) => {
      bag.quad(on(b, face, u0, z0, out), on(b, face, u1, z0, out), on(b, face, u1, z1, out), on(b, face, u0, z1, out), col)
    }
    /** A block on a face: u0..u1 along it, z0..z1 up it, standing from o0 to o1 out from it — its front, top, bottom and ends. */
    const slab = (b: BoxR, face: string, u0: number, u1: number, z0: number, z1: number, o0: number, o1: number, col: string, mat: number = MAT.trim) => {
      built.m = mat
      const P = (u: number, z: number, o: number) => on(b, face, u, z, o)
      built.quad(P(u0, z0, o1), P(u1, z0, o1), P(u1, z1, o1), P(u0, z1, o1), col)
      built.quad(P(u0, z1, o0), P(u0, z1, o1), P(u1, z1, o1), P(u1, z1, o0), col, 1.05)
      built.quad(P(u0, z0, o1), P(u0, z0, o0), P(u1, z0, o0), P(u1, z0, o1), col, 0.7)
      built.quad(P(u0, z0, o0), P(u0, z0, o1), P(u0, z1, o1), P(u0, z1, o0), col, 0.85)
      built.quad(P(u1, z0, o1), P(u1, z0, o0), P(u1, z1, o0), P(u1, z1, o1), col, 0.85)
      built.m = MAT.paint
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
    /** A box is a building's (as opposed to a step, a post or a crate) when it is big enough to live in. */
    const isBuilding = (b: BoxR) => b.h >= 8 && Math.min(b.w, b.d) >= 0.2

    for (const run of rec.runs) for (const q of run) {
      switch (q.k) {
        case 'box': {
          const i0 = n(q.x), j0 = n(q.y), i1 = i0 + n(q.w), j1 = j0 + n(q.d), z0 = n(q.z0), z1 = z0 + n(q.h), col = s(q.fill)
          const bx: BoxR = { x: i0, y: j0, w: n(q.w), d: n(q.d), z0, h: n(q.h) }
          const lo = w(i0, j0, z0), hi = w(i1, j1, z1)
          const house = isBuilding(bx)
          // Its roof, if nothing stands on its top.
          const x0 = Math.min(lo.x, hi.x), x1 = Math.max(lo.x, hi.x), zz0 = Math.min(lo.z, hi.z), zz1 = Math.max(lo.z, hi.z), top = Math.max(lo.y, hi.y)
          const open = house && coveredAt(x0, zz0, x1, zz1, top) < 0.6
          built.m = house ? MAT.wall : MAT.paint; built.b = Math.min(lo.y, hi.y)
          built.quad(w(i1, j0, z0), w(i1, j1, z0), w(i1, j1, z1), w(i1, j0, z1), col)
          built.quad(w(i1, j1, z0), w(i0, j1, z0), w(i0, j1, z1), w(i1, j1, z1), col, 0.9)
          built.quad(w(i0, j1, z0), w(i0, j0, z0), w(i0, j0, z1), w(i0, j1, z1), col)
          built.quad(w(i0, j0, z0), w(i1, j0, z0), w(i1, j0, z1), w(i0, j0, z1), col, 0.9)
          built.m = open ? MAT.roof : MAT.paint
          built.quad(w(i0, j0, z1), w(i1, j0, z1), w(i1, j1, z1), w(i0, j1, z1), s(q.top, col))
          built.m = MAT.paint; built.b = -99
          if (typeof q.trim === 'string') { panel(bx, 'x', 0, 1, n(q.h) - 3, n(q.h), q.trim, 0.006); panel(bx, 'y', 0, 1, n(q.h) - 3, n(q.h), q.trim, 0.006) }
          boxes.push({ i0: zz0, j0: x0, i1: zz1, j1: x1, z0: Math.min(lo.y, hi.y), z1: top })
          if (house && n(q.h) >= 10) {
            // A cornice round the top and a plinth round the foot, standing a little proud.
            const trim = typeof q.trim === 'string' ? q.trim : shadeOf(col, 1.06), e = 0.012
            cuboidW(new Vector3(x0 - e, top - Y(1.4), zz0 - e), new Vector3(x1 + e, top, zz1 + e), trim, MAT.trim, open ? MAT.trim : MAT.paint)
            cuboidW(new Vector3(x0 - 0.008, Math.min(lo.y, hi.y), zz0 - 0.008), new Vector3(x1 + 0.008, Math.min(lo.y, hi.y) + Y(1.8), zz1 + 0.008), shadeOf(col, 0.74), MAT.trim, MAT.trim)
          }
          if (open && n(q.h) >= 10) {
            // A flat roof: a low parapet round it, and on it what flat roofs have — air conditioning, vents, a tank.
            const t = 0.018, ph = Y(2.4), par = shadeOf(col, 0.96)
            made.roofs.push([(x0 + x1) / 2, top, (zz0 + zz1) / 2])
            cuboidW(new Vector3(x0, top, zz0), new Vector3(x1, top + ph, zz0 + t), par, MAT.wall, MAT.trim, top)
            cuboidW(new Vector3(x0, top, zz1 - t), new Vector3(x1, top + ph, zz1), par, MAT.wall, MAT.trim, top)
            cuboidW(new Vector3(x0, top, zz0), new Vector3(x0 + t, top + ph, zz1), par, MAT.wall, MAT.trim, top)
            cuboidW(new Vector3(x1 - t, top, zz0), new Vector3(x1, top + ph, zz1), par, MAT.wall, MAT.trim, top)
            const area = (x1 - x0) * (zz1 - zz0), placed: [number, number, number, number][] = []
            const free = (a: number, b: number, c: number, e: number) => coveredAt(a, b, c, e, top) < 0.01 && !placed.some(([p, q2, r, s2]) => a < r && c > p && b < s2 && e > q2)
            const tries = Math.min(5, 1 + Math.floor(area * 7))
            for (let m = 0; m < tries; m++) {
              const r1 = hash(x0 * 7 + m, zz0 * 3, top), r2 = hash(zz0 * 5 + m, x1, top * 2), kind = hash(x1 + m, zz1, 9)
              const sx = kind < 0.55 ? 0.1 : kind < 0.8 ? 0.05 : 0.17, sz = kind < 0.55 ? 0.075 : kind < 0.8 ? 0.05 : 0.17
              const cx = x0 + 0.05 + sx / 2 + r1 * Math.max(0, x1 - x0 - 0.1 - sx), cz = zz0 + 0.05 + sz / 2 + r2 * Math.max(0, zz1 - zz0 - 0.1 - sz)
              if (x1 - x0 < sx + 0.1 || zz1 - zz0 < sz + 0.1 || !free(cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2)) continue
              placed.push([cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2]); made.onRoofs++
              built.m = MAT.metal
              if (kind < 0.55) {
                // An air-conditioning unit, its fan in a grille on top.
                cuboidW(new Vector3(cx - sx / 2, top, cz - sz / 2), new Vector3(cx + sx / 2, top + Y(3.6), cz + sz / 2), '#c9cdd6', MAT.metal, MAT.metal)
                built.m = MAT.metal
                orb(new Vector3(cx, top + Y(3.6), cz), 0.026, '#3d4458')
              } else if (kind < 0.8) {
                // A vent: a short pipe with a cap.
                tube(new Vector3(cx, top, cz), new Vector3(cx, top + Y(4), cz), 0.014, '#9aa1ad', 10)
                tube(new Vector3(cx, top + Y(4), cz), new Vector3(cx, top + Y(4.8), cz), 0.022, '#7d8494', 10)
              } else {
                // A water tank on its legs.
                for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) tube(new Vector3(cx + lx * sx * 0.32, top, cz + lz * sz * 0.32), new Vector3(cx + lx * sx * 0.32, top + Y(2.5), cz + lz * sz * 0.32), 0.006, '#5a6170', 5)
                const tb = top + Y(2.5), tr = sx * 0.45
                for (let a = 0; a < 20; a++) {
                  const a0 = (a / 20) * Math.PI * 2, a1 = ((a + 1) / 20) * Math.PI * 2
                  built.quad(new Vector3(cx + Math.sin(a0) * tr, tb, cz + Math.cos(a0) * tr), new Vector3(cx + Math.sin(a1) * tr, tb, cz + Math.cos(a1) * tr), new Vector3(cx + Math.sin(a1) * tr, tb + Y(6), cz + Math.cos(a1) * tr), new Vector3(cx + Math.sin(a0) * tr, tb + Y(6), cz + Math.cos(a0) * tr), '#d8dbe2', a % 2 ? 0.96 : 1)
                  built.tri(new Vector3(cx, tb + Y(7.2), cz), new Vector3(cx + Math.sin(a0) * tr, tb + Y(6), cz + Math.cos(a0) * tr), new Vector3(cx + Math.sin(a1) * tr, tb + Y(6), cz + Math.cos(a1) * tr), '#b9bdc6')
                }
              }
              built.m = MAT.paint
            }
          }
          break
        }
        case 'band': { const b = q.b as BoxR; for (const f of ['x', 'y']) panel(b, f, 0, 1, n(q.z0), n(q.z1), s(q.fill), 0.006); break }
        case 'quad': { const b = q.b as BoxR; panel(b, s(q.face, 'x'), n(q.u0), n(q.u1), n(q.z0), n(q.z1), s(q.fill), 0.005); break }
        case 'win': {
          const b = q.b as BoxR, face = s(q.face, 'x'), rows = n(q.rows, 1), cols = n(q.cols, 2), h = n(q.h, 10), gap = n(q.gap, 8), wide = n(q.wide, 0.5)
          const len = face === 'x' ? b.d : b.w, slot = 1 / cols, ww = slot * wide, fu = 1.6 / (64 * Math.max(len, 0.05))
          const frame = s(q.frame, '#ffffff'), out = outOf(face)
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const u = slot * (c + 0.5), z = n(q.z0, 8) + r * (h + gap), u0 = u - ww / 2, u1 = u + ww / 2
            // The frame, standing proud of the wall; a glazing bar across, and one down a wide window.
            slab(b, face, u0 - fu, u1 + fu, z - 1.2, z, 0, 0.011, frame)
            slab(b, face, u0 - fu, u1 + fu, z + h, z + h + 1.2, 0, 0.011, frame)
            slab(b, face, u0 - fu, u0, z, z + h, 0, 0.011, frame)
            slab(b, face, u1, u1 + fu, z, z + h, 0, 0.011, frame)
            slab(b, face, u0, u1, z + h * 0.64 - 0.45, z + h * 0.64 + 0.45, 0, 0.007, frame)
            if (ww * len > 0.13) slab(b, face, u - fu * 0.35, u + fu * 0.35, z, z + h, 0, 0.007, frame)
            // The sill, of stone, standing out further.
            slab(b, face, u0 - fu * 2.2, u1 + fu * 2.2, z - 2.6, z - 1.2, 0, 0.026, '#d5d9ea')
            // The glass, set back behind its frame, with a room behind it. About two windows in three have someone home.
            const seed = hash(b.x * 12.99 + c * 5.1, b.y * 78.23 + (face === 'x' ? 0 : 3.3), z * 0.37)
            const home = seed < 0.66 ? hash(seed * 91, z, c) : 2
            made.rooms++
            glass.pane(on(b, face, u0, z, 0.002), on(b, face, u1, z, 0.002), on(b, face, u1, z + h, 0.002), on(b, face, u0, z + h, 0.002), out, s(q.pane, '#2b3a55'), seed, home)
          }
          break
        }
        case 'door': {
          const b = q.b as BoxR, face = s(q.face, 'x'), len = face === 'x' ? b.d : b.w, dw = n(q.w, 0.22) / Math.max(len, 0.05), u = n(q.u, 0.5), h = n(q.h, 16)
          const df = 0.02 / len
          // Its frame and the door set in it; a handle; a step up to it.
          slab(b, face, u - dw / 2 - df, u - dw / 2, 0, h + 1.6, 0, 0.012, '#f4f6fc')
          slab(b, face, u + dw / 2, u + dw / 2 + df, 0, h + 1.6, 0, 0.012, '#f4f6fc')
          slab(b, face, u - dw / 2 - df, u + dw / 2 + df, h, h + 1.6, 0, 0.012, '#f4f6fc')
          built.m = MAT.paint
          panel(b, face, u - dw / 2, u + dw / 2, 0, h, s(q.fill, '#5b82ff'), 0.003)
          // (Panels on the door: two recessed rectangles.)
          panel(b, face, u - dw * 0.36, u + dw * 0.36, h * 0.55, h * 0.9, shadeOf(s(q.fill, '#5b82ff'), 0.88), 0.0045)
          panel(b, face, u - dw * 0.36, u + dw * 0.36, h * 0.1, h * 0.45, shadeOf(s(q.fill, '#5b82ff'), 0.88), 0.0045)
          slab(b, face, u + dw * 0.32, u + dw * 0.32 + 0.012 / len, h * 0.47, h * 0.53, 0.003, 0.012, '#d7dbe6', MAT.metal)
          slab(b, face, u - dw / 2 - df * 2, u + dw / 2 + df * 2, 0, 1.1, 0, 0.035, '#c3c8de')
          // Over the door of a game's building, its name.
          if (games[rec.slug] && !signed.has(rec.slug)) {
            const uv = pics.uvOf('name:' + games[rec.slug].title)
            if (uv) {
              signed.add(rec.slug)
              const sw = Math.min(len * 0.9, 0.5), su = sw / len, sh = (sw * 96 / 512) * PX_H
              const c = Math.max(su / 2 + 0.02, Math.min(1 - su / 2 - 0.02, u)), z0 = h + 2.4
              slab(b, face, c - su / 2 - 0.006 / len, c + su / 2 + 0.006 / len, z0 - 0.3, z0 + sh + 0.3, 0, 0.012, '#11182e', MAT.metal)
              // (Read from outside: on an x face u runs to your right, on a y face to your left.)
              const [ul, ur] = face === 'x' ? [c - su / 2, c + su / 2] : [c + su / 2, c - su / 2]
              printed.quad(on(b, face, ul, z0, 0.0125), on(b, face, ur, z0, 0.0125), on(b, face, ur, z0 + sh, 0.0125), on(b, face, ul, z0 + sh, 0.0125), uv, outOf(face))
            }
          }
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
          built.m = MAT.tiles
          if (s(q.axis, 'x') === 'x') {
            const my = y + gd / 2
            built.quad(w(x + gw, y + gd, z), w(x, y + gd, z), w(x, my, z + h), w(x + gw, my, z + h), roof, 0.92)
            built.quad(w(x, y, z), w(x + gw, y, z), w(x + gw, my, z + h), w(x, my, z + h), roof)
            built.m = MAT.wall; built.b = Y(z) - 1
            built.tri(w(x + gw - e, y + e, z), w(x + gw - e, y + gd - e, z), w(x + gw - e, my, z + h - 1), end)
            built.tri(w(x + e, y + gd - e, z), w(x + e, y + e, z), w(x + e, my, z + h - 1), end)
          } else {
            const mx = x + gw / 2
            built.quad(w(x + gw, y, z), w(x + gw, y + gd, z), w(mx, y + gd, z + h), w(mx, y, z + h), roof, 0.92)
            built.quad(w(x, y + gd, z), w(x, y, z), w(mx, y, z + h), w(mx, y + gd, z + h), roof)
            built.m = MAT.wall; built.b = Y(z) - 1
            built.tri(w(x + gw - e, y + gd - e, z), w(x + e, y + gd - e, z), w(mx, y + gd - e, z + h - 1), end)
            built.tri(w(x + e, y + e, z), w(x + gw - e, y + e, z), w(mx, y + e, z + h - 1), end)
          }
          built.m = MAT.paint; built.b = -99
          break
        }
        case 'pyramid': {
          const x = n(q.x), y = n(q.y), pw = n(q.w), pd = n(q.d), z = n(q.z), h = n(q.h), col = s(q.fill)
          const apex = w(x + pw / 2, y + pd / 2, z + h), c0 = w(x, y, z), c1 = w(x + pw, y, z), c2 = w(x + pw, y + pd, z), c3 = w(x, y + pd, z)
          built.m = MAT.tiles
          built.tri(c1, c2, apex, col); built.tri(c2, c3, apex, col, 0.9); built.tri(c3, c0, apex, col); built.tri(c0, c1, apex, col, 0.9)
          built.m = MAT.paint
          break
        }
        case 'cyl': {
          const cx = n(q.cx), cy = n(q.cy), r = n(q.r), z0 = n(q.z0), h = n(q.h), side = s(q.side ?? q.fill)
          built.m = r > 0.15 && h > 8 ? MAT.wall : MAT.paint; built.b = w(cx, cy, z0).y
          ring(cx, cy, r, z0, z0 + h, side)
          built.m = MAT.paint; built.b = -99
          for (const band of (q.bands as [number, number, string][] | undefined) ?? []) ring(cx, cy, r + 0.004, z0 + band[0], z0 + band[1], band[2])
          lid(cx, cy, r, z0 + h, s(q.top ?? q.fill))
          break
        }
        case 'cone': {
          const cx = n(q.cx), cy = n(q.cy), r = n(q.r), z0 = n(q.z0), h = n(q.h), col = s(q.fill)
          built.m = MAT.tiles
          for (let t = 0; t < 20; t++) { const a0 = (t / 20) * Math.PI * 2, a1 = ((t + 1) / 20) * Math.PI * 2; built.tri(w(cx + Math.sin(a1) * r, cy + Math.cos(a1) * r, z0), w(cx + Math.sin(a0) * r, cy + Math.cos(a0) * r, z0), w(cx, cy, z0 + h), col) }
          built.m = MAT.paint
          break
        }
        case 'dome': built.m = MAT.metal; ball(n(q.cx), n(q.cy), n(q.z0), n(q.r), n(q.r) * PX_H, 0, s(q.fill)); built.m = MAT.paint; break
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
          built.m = MAT.metal
          for (let t = 0; t < 6; t++) {
            const a0 = (t / 6) * Math.PI * 2, a1 = ((t + 1) / 6) * Math.PI * 2
            const o0 = u.clone().multiplyScalar(Math.cos(a0)).add(v.clone().multiplyScalar(Math.sin(a0))), o1 = u.clone().multiplyScalar(Math.cos(a1)).add(v.clone().multiplyScalar(Math.sin(a1)))
            built.quad(A.clone().add(o0), A.clone().add(o1), B.clone().add(o1), B.clone().add(o0), col)
          }
          built.m = MAT.paint
          break
        }
        case 'model': {
          const name = q.name as string
          // The island's named models (Unity's Models.cs).
          if (name === 'lamp') {
            const x = n(q.x), y = n(q.y), z = n(q.z), h = n(q.h, 26)
            built.m = MAT.metal
            ring(x, y, 0.025, z, z + h, '#3a4256', 6)
            built.m = MAT.paint
            ball(x, y, z + h + 1, 0.05, 0.05 * PX_H, -1, '#f4f6fc', bulbs)
            lamps.push(w(x, y, z + h + 1))
          } else if (name === 'windowbox') {
            // A timber trough under a cottage window, flowers spilling over it.
            const c = W(n(q.x), n(q.y), n(q.z)), face = s(q.face, 'x')
            const nn = face === 'x' ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0), tt = face === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
            const len = 0.11, dep = 0.035, hh = Hy(1.6)
            cuboid(c.clone().addScaledVector(nn, dep).addScaledVector(UP, hh / 2), tt, UP, nn, len, hh / 2, dep, '#8a6b52')
            for (let m = 0; m < 16; m++) {
              const r1 = hash(n(q.x), n(q.y), m), r2 = hash(n(q.y), m, n(q.x)), r3 = hash(m, n(q.x), 3)
              const o = c.clone().addScaledVector(nn, dep * (1 + r1 * 1.4)).addScaledVector(tt, (r2 - 0.5) * len * 1.9).addScaledVector(UP, hh + Hy(0.4 + r3 * 1.8))
              orb(o, m < 7 ? 0.024 : 0.0075 + r1 * 0.004, m < 7 ? '#4c7a3c' : m % 4 === 3 ? '#f7f6f2' : m % 5 === 4 ? '#b8a1ff' : s(q.fill, '#ff9fb2'))
            }
          } else if (name === 'plaque') {
            // A painted board (on its posts, if it stands up off the ground), its picture — or the game's name — on its face.
            const At = frameAt(W(n(q.x), n(q.y), n(q.z))), depth = n(q.d) > 0 ? n(q.d) : 1.6, pw = n(q.w, 20), ph = n(q.h, 10)
            cuboid(At(0, ph / 2, -depth / 2), ACROSS, UP, FACING, Px(pw / 2), Hy(ph / 2), Px(depth / 2), s(q.side, '#d5d9ea'))
            const print = ((q.prints as string[]) ?? [])[0]
            const blank = print?.startsWith('sign-') && games[rec.slug]
            const uv = blank ? pics.uvOf('name:' + games[rec.slug].title) : print ? pics.uvOf('print:' + print) : null
            if (blank && uv) signed.add(rec.slug)
            if (uv) {
              // (Its right, as you face it, is against the map camera's across: three's world is Unity's mirrored.)
              const mid = At(0, ph / 2, 0.06), x = ACROSS.clone().multiplyScalar(-Px(pw) / 2), y = new Vector3(0, Hy(ph) / 2, 0)
              made.pictures++
              printed.quad(mid.clone().sub(x).sub(y), mid.clone().add(x).sub(y), mid.clone().add(x).add(y), mid.clone().sub(x).add(y), uv, FACING)
            }
            const foot = n(q.foot, NaN)
            if (Number.isFinite(foot) && foot < n(q.z) - 0.5) {
              const inset = Math.min(6, pw * 0.18), down = foot - n(q.z)
              built.m = MAT.metal
              for (const side of [-1, 1]) tube(At(side * (pw / 2 - inset), ph * 0.6, -depth - 0.7), At(side * (pw / 2 - inset), down, -depth - 0.7), Px(0.9), '#3d4458')
              built.m = MAT.paint
            }
          } else if (name === 'decal') {
            // A picture on a box's face: a poster, a mural, a notice.
            const b = q.b as BoxR | undefined, print = ((q.prints as string[]) ?? [])[0]
            const uv = print ? pics.uvOf('print:' + print) : null
            if (b && uv) {
              const face = s(q.face, 'y'), fx = face === 'x', len = fx ? b.d : b.w
              // (Across to the right as you face it: +u on an x face, -u on a y face — mirrored from Unity's left-handed world.)
              const U = (px: number) => n(q.u) + (fx ? px : -px) / (32 * len)
              const uL = U(n(q.dx)), uR = U(n(q.dx) + n(q.w)), zB = n(q.z) - (n(q.dy) + n(q.h)), zT = n(q.z) - n(q.dy)
              made.pictures++
              printed.quad(on(b, face, uL, zB, 0.005), on(b, face, uR, zB, 0.005), on(b, face, uR, zT, 0.005), on(b, face, uL, zT, 0.005), uv, outOf(face))
            }
          } else if (name === 'dish') {
            // A dish aerial: a shallow bowl turned up to the sky on a short neck, its feed arm and receiver.
            const top = W(n(q.x), n(q.y), n(q.z))
            const axis = new Vector3(0, 0.9, 0).addScaledVector(ACROSS, -0.38).addScaledVector(FACING, 0.08).normalize()
            const u = new Vector3().crossVectors(axis, new Vector3(1, 0, 0)).normalize(), v = new Vector3().crossVectors(axis, u)
            const R = Px(n(q.r, 16)), depth = R * 0.32, vertex = top.clone().add(new Vector3(0, Hy(4), 0))
            built.m = MAT.metal
            tube(top, vertex, Px(1.2), '#3d4458')
            const P = (rg: number, kk: number) => { const t = rg / 8, a = (kk / 28) * Math.PI * 2; return vertex.clone().addScaledVector(axis, depth * t * t).addScaledVector(u, Math.cos(a) * R * t).addScaledVector(v, Math.sin(a) * R * t) }
            for (let rg = 0; rg < 8; rg++) for (let kk = 0; kk < 28; kk++) built.quad(P(rg, kk), P(rg, kk + 1), P(rg + 1, kk + 1), P(rg + 1, kk), '#eef0f6', rg === 0 ? 0.8 : 1)
            const focus = vertex.clone().addScaledVector(axis, (R * R) / (4 * depth))
            tube(vertex.clone().addScaledVector(axis, depth * 0.2).addScaledVector(u, R * 0.35), focus, Px(0.5), '#3d4458')
            orb(focus, Px(1.6), '#ff4f6e')
            built.m = MAT.paint
          } else if (name === 'lighthouse') {
            // The lighthouse (Share This Page): banded tower, its door and windows, the gallery on its brackets, the lantern and its cap.
            const x = n(q.x), y = n(q.y), z = n(q.z), red = s(q.fill, '#ff4f6e'), dark = s(q.top, '#2c355e')
            const R = (h: number) => Px(17 - 0.075 * h)
            made.lighthouse = true
            built.m = MAT.trim
            lathe(x, y, z, [[-3, Px(20)], [3, Px(20)]], () => '#c3c8de')
            built.m = MAT.wall; built.b = W(x, y, z).y
            lathe(x, y, z, [0, 24, 44, 66, 86].map((h) => [h, R(h)] as [number, number]), (qq) => (qq % 2 === 0 ? '#ffffff' : red), 48, false)
            built.m = MAT.paint; built.b = -99
            const axis = W(x, y, z), side = new Vector3().crossVectors(UP, FACING).normalize()
            const front = (r: number, wd: number, z0: number, z1: number, col: string) => {
              const f = axis.clone().addScaledVector(FACING, r), sd = side.clone().multiplyScalar(Px(wd) / 2)
              built.quad(f.clone().sub(sd).add(new Vector3(0, Hy(z0), 0)), f.clone().add(sd).add(new Vector3(0, Hy(z0), 0)), f.clone().add(sd).add(new Vector3(0, Hy(z1), 0)), f.clone().sub(sd).add(new Vector3(0, Hy(z1), 0)), col)
            }
            front(R(5) + 0.004, 8, 0, 12, '#2c355e'); front(R(5) + 0.006, 10, 12, 13.5, '#d5d9ea')
            for (const h of [34, 56, 76]) { front(R(h + 3) + 0.004, 6.4, h - 0.8, h + 6.8, '#f4f6fc'); front(R(h + 3) + 0.007, 4.6, h, h + 6, '#9fd4ff') }
            built.m = MAT.metal
            lathe(x, y, z, [[84, Px(13)], [86.5, Px(19)], [89, Px(19.5)]], () => dark, 48)
            for (let kk = 0; kk < 18; kk++) { const a = (kk * Math.PI * 2) / 18, rr = Px(18.6); tube(W(x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + 89), W(x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + 96), Px(0.5), '#3d4458', 5) }
            for (const hz of [96, 92.5]) for (let kk = 0; kk < 36; kk++) {
              const a0 = (kk * Math.PI * 2) / 36, a1 = ((kk + 1) * Math.PI * 2) / 36, rr = Px(18.6)
              tube(W(x + Math.sin(a0) * rr, y + Math.cos(a0) * rr, z + hz), W(x + Math.sin(a1) * rr, y + Math.cos(a1) * rr, z + hz), Px(hz > 95 ? 0.7 : 0.4), '#3d4458', 5)
            }
            lathe(x, y, z, [[89, Px(11.5)], [93, Px(11.5)]], () => dark, 32)
            // The lantern's glass: lit, it is the light.
            built.m = MAT.paint
            lathe(x, y, z, [[93, Px(10.5)], [108, Px(10.5)]], () => '#cfe6ff', 32, false)
            ball(x, y, z + 100, Px(5), Px(5) * PX_H, -1, '#fff6e0', bulbs)
            lamps.push(W(x, y, z + 100))
            built.m = MAT.metal
            for (let kk = 0; kk < 8; kk++) { const a = ((kk + 0.5) * Math.PI * 2) / 8, rr = Px(10.8); tube(W(x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + 93), W(x + Math.sin(a) * rr, y + Math.cos(a) * rr, z + 108), Px(0.6), dark, 5) }
            lathe(x, y, z, [[107.5, Px(12)], [109.5, Px(14.5)], [110, Px(14.5)], [113, Px(13)], [117, Px(10.5)], [121, Px(7)], [125, Px(3.5)], [127.5, Px(1.2)], [128, 0]], () => dark, 40, false)
            orb(W(x, y, z + 129.5), Px(2.2), dark)
            tube(W(x, y, z + 131), W(x, y, z + 141), Px(0.6), '#3d4458', 6)
            built.m = MAT.paint
            const base = W(x, y, z), r0 = Px(17)
            boxes.push({ i0: base.z - r0 * 0.8, i1: base.z + r0 * 0.8, j0: base.x - r0 * 0.8, j1: base.x + r0 * 0.8, z0: base.y, z1: base.y + Hy(110) })
          }
          break
        }
      }
    }
  }
  // A game whose building has no door and no board of its own gets a sign standing at the front of its plot:
  // a stone plinth, two posts, and its name on a board facing the way the map looks at it.
  for (const b of d.buildings) {
    const g = games[b.slug]
    if (!g || b.water || signed.has(b.slug)) continue
    const uv = pics.uvOf('name:' + g.title); if (!uv) continue
    signed.add(b.slug)
    const foot = W(b.i + b.w - 0.16, b.j + b.d - 0.16, b.z)
    const bw = 0.4, bh = bw * 96 / 512, lift = 0.1
    const R = ACROSS.clone().negate()
    cuboid(foot.clone().add(new Vector3(0, 0.012, 0)), R, UP, FACING, bw / 2 + 0.03, 0.012, 0.03, '#c3c8de')
    built.m = MAT.metal
    for (const side of [-1, 1]) tube(foot.clone().addScaledVector(R, side * (bw / 2 - 0.03)), foot.clone().addScaledVector(R, side * (bw / 2 - 0.03)).add(new Vector3(0, lift + bh, 0)), 0.008, '#3d4458', 6)
    built.m = MAT.paint
    const mid = foot.clone().add(new Vector3(0, lift + bh / 2, 0))
    cuboid(mid, R, UP, FACING, bw / 2 + 0.01, bh / 2 + 0.01, 0.008, '#11182e')
    const c0 = mid.clone().addScaledVector(FACING, 0.0085), x = R.clone().multiplyScalar(bw / 2), y = new Vector3(0, bh / 2, 0)
    printed.quad(c0.clone().sub(x).sub(y), c0.clone().add(x).sub(y), c0.clone().add(x).add(y), c0.clone().sub(x).add(y), uv, FACING)
  }
  const facade = facadeMaterial()
  const builtMesh = new Mesh(built.geometry(), facade)
  builtMesh.castShadow = true; builtMesh.receiveShadow = true
  const win = glassMaterial()
  const glassMesh = new Mesh(glass.geometry(), win.material)
  glassMesh.receiveShadow = true
  // The street lamps' globes (and the lighthouse's lamp): they glow at night (and light the street round you; walker.ts).
  const bulbMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: new Color('#e6eeff'), emissiveIntensity: 0 })
  const bulbMesh = new Mesh(bulbs.geometry(), bulbMat)
  const printMesh = new Mesh(printed.geometry(), pics.material)
  printMesh.receiveShadow = true
  return { builtMesh, glassMesh, windows: win, bulbMesh, bulbMat, printMesh, lamps, boxes, made: { ...made, signed: [...signed] } }
}

/** The whole island: its meshes, the sea, and what the walker needs to know of it (heights, walls, water, the games). */
export function buildWorld(d: WorldData, opts: { phone?: boolean } = {}) {
  const root = new Group()
  const time = { value: 0 }
  // The pictures boards and posters carry, and the games' names for their boards.
  const pics = atlas(d.prints ?? [], [...new Set(Object.values(d.games ?? {}).map((g) => g.title))])
  const sol = solids(d, pics)
  const gr = terrain(d, sol.boxes, time)
  root.add(gr.mesh)
  root.add(sol.builtMesh, sol.glassMesh, sol.bulbMesh, sol.printMesh)
  // What grows (flora.ts): trees, palms, cacti, rocks, the grass and its flowers, in the wind.
  const fl = flora(d, { siteAt: gr.siteAt, heightAt: gr.heightAt, meadow: gr.meadow, boxes: sol.boxes, time, phone: !!opts.phone })
  root.add(fl.group)
  // The sea (water.ts): it knows its depth everywhere, so it is clear in the shallows and deep blue
  // beyond, breaks in foam on every shore, and lifts in a long swell that calms to nothing at the edge.
  // Under it, far out past the floor the island stands on, the open ocean's dark.
  const deep = new Mesh(new PlaneGeometry(6000, 6000, 1, 1), new MeshStandardMaterial({ color: DEEP_SEA, roughness: 1 }))
  deep.rotation.x = -Math.PI / 2
  deep.position.set(d.grid / 2, Y(d.sea) - 1.6, d.grid / 2)
  root.add(deep)
  const sea = buildSea({ grid: d.grid, margin: 8, seaY: Y(d.sea), heightAt: gr.heightAt, rocks: gr.rocks, falls: gr.falls, time })
  root.add(...sea.meshes)
  // The stream and the pond: running water, its falls, and the still pond.
  root.add(new Mesh(gr.poolGeo, poolMaterial(time)))
  return {
    root, top: gr.top, kind: gr.kind, heightAt: gr.heightAt, siteAt: gr.siteAt, joined: gr.joined, boxes: [...sol.boxes, ...gr.rockBoxes, ...fl.solids], flora: fl,
    windows: sol.windows, bulbs: sol.bulbMat, boards: pics.material, made: sol.made, lamps: sol.lamps, time,
    /** Water: the sea's surface (swell and all) and depth, the stream's surface and which way it runs, and how bright the light under it is. */
    seaAt: sea.surfaceAt, depthAt: sea.depthAt, poolAt: gr.poolAt, flowAt: gr.flowAt, caustics: gr.caustics, falls: gr.falls, swell: sea.uniforms.uLift,
  }
}
