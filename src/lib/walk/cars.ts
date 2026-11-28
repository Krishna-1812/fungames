/**
 * The island's cars and its bus, made to measure (walker.ts drives them).
 *
 * Each body is lofted: a cross-section — rocker, flank, the crease at the
 * shoulder, the glasshouse leaning in to the roof — worked out at ninety
 * stations from the tail to the nose from a few curves a designer would draw
 * (the sill, the beltline, the roofline, the width in plan and at the roof),
 * with its wheel arches cut round the tyres. Where the roofline rises off the
 * beltline there is a cabin: its windscreen and rear window, side windows
 * between the pillars (gloss black, as most are now), the window seals; ahead
 * and behind, a bonnet and a boot with a crown to them. The paint is a
 * clear-coated one that carries the sky; panel gaps, door handles and the
 * fuel flap are drawn on it. Glass reflects the sky as real glass does, more
 * at a glancing angle, and lets you see the cabin behind: seats, dashboard,
 * the steering wheel. Lamps front and back, the grille and intakes, mirrors,
 * wipers, an aerial, number plates; alloy wheels on tyres, brake discs and
 * callipers behind their spokes.
 *
 * Four of them: a hatchback, a saloon, an SUV and a single-deck bus, each at
 * its real size (a metre is 0.11 of a world unit; body.ts). All the cars of a
 * model are drawn together as instances (a handful of draw calls for the
 * whole traffic); their lamps glow per car — headlights after dark, tail
 * lights, brighter as each one brakes — and after dark each throws a pool of
 * light on the road ahead. A soft shadow lies under each.
 */
import {
  AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, Color, CustomBlending, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  Group, InstancedMesh, LatheGeometry, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, OneFactor, OneMinusSrcAlphaFactor,
  Path, PlaneGeometry, Quaternion, SRGBColorSpace, Shape, ShaderChunk, TorusGeometry, Vector2, Vector3, Euler, type Material, type Scene,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { METRE } from './body'
import type { Spec } from './drive'

type Keys = [number, number][]
/** A curve drawn through a few points (t from the tail, 0, to the nose, 1). */
const lin = (k: Keys) => (t: number) => {
  if (t <= k[0][0]) return k[0][1]
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const [t0, v0] = k[i - 1], [t1, v1] = k[i]; return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) }
  return NaN
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export type ModelName = 'hatch' | 'saloon' | 'suv' | 'bus'

type Body = {
  len: number; wid: number; tall: number; wheel: number; arch: number
  /** The axles (metres from the middle, + forward) and the track. */
  rear: number; front: number; track: number
  bottom: Keys; belt: Keys; roof: Keys; half: Keys; roofHalf: Keys
  /** Where (t) the windscreen, the rear window and the side windows are; the pillars between side windows. */
  screen: [number, number]; back: [number, number] | null; side: [number, number]; pillars: number[]; pw: number
  /** How far up the glasshouse its side windows reach (the bus's stop short of the roof). */
  split: number; upper: boolean
  /** The driver's hips (height), the seats. */
  seat: number
  /** Lamps: height, how far out, width, height of each. */
  head: [number, number, number, number]; tail: [number, number, number, number]
  plate: string; plateF: number; plateR: number
  doors: number[]; handles: number[]; clad?: boolean; rails?: boolean
  spec: Spec
}

export const MODELS: Record<ModelName, Body> = {
  hatch: {
    len: 4.05, wid: 1.79, tall: 1.46, wheel: 0.315, arch: 0.075, rear: -1.405, front: 1.215, track: 1.54,
    bottom: [[0, 0.46], [0.025, 0.34], [0.07, 0.27], [0.2, 0.21], [0.75, 0.21], [0.9, 0.24], [0.96, 0.28], [0.99, 0.34], [1, 0.4]],
    belt: [[0, 0.92], [0.03, 0.98], [0.12, 1.0], [0.4, 0.975], [0.62, 0.94], [0.72, 0.91], [0.85, 0.85], [0.94, 0.8], [0.985, 0.74], [1, 0.68]],
    roof: [[0, 0.92], [0.02, 1.03], [0.05, 1.22], [0.1, 1.37], [0.18, 1.44], [0.45, 1.46], [0.58, 1.44], [0.635, 1.39], [0.74, 0.93], [0.75, 0.9]],
    half: [[0, 0.79], [0.012, 0.845], [0.035, 0.88], [0.1, 0.895], [0.85, 0.895], [0.94, 0.88], [0.98, 0.845], [1, 0.77]],
    roofHalf: [[0, 0.6], [0.08, 0.65], [0.25, 0.69], [0.55, 0.685], [0.68, 0.64], [1, 0.6]],
    screen: [0.636, 0.742], back: [0.022, 0.098], side: [0.16, 0.628], pillars: [0.4], pw: 0.011, split: 0.5, upper: true,
    seat: 0.52, head: [0.66, 0.6, 0.3, 0.075], tail: [0.86, 0.62, 0.32, 0.11], plate: 'TI 482 KD', plateF: 0.36, plateR: 0.62,
    doors: [0.175, 0.398, 0.655], handles: [0.21, 0.43],
    spec: { len: 4.05, wid: 1.79, tall: 1.46, front: 1.215, rear: -1.405, track: 1.54, wheel: 0.315, mass: 1250, power: 70000, pull: 4300, top: 20, lock: 0.6 },
  },
  saloon: {
    len: 4.68, wid: 1.83, tall: 1.44, wheel: 0.325, arch: 0.075, rear: -1.36, front: 1.44, track: 1.57,
    bottom: [[0, 0.48], [0.03, 0.34], [0.08, 0.27], [0.2, 0.2], [0.78, 0.2], [0.92, 0.24], [0.97, 0.29], [0.995, 0.35], [1, 0.4]],
    belt: [[0, 0.97], [0.03, 1.02], [0.1, 1.035], [0.4, 0.98], [0.62, 0.94], [0.72, 0.9], [0.86, 0.82], [0.95, 0.77], [0.99, 0.71], [1, 0.65]],
    roof: [[0, 0.97], [0.05, 1.045], [0.17, 1.06], [0.205, 1.1], [0.3, 1.36], [0.38, 1.425], [0.55, 1.44], [0.62, 1.41], [0.66, 1.35], [0.765, 0.93], [0.775, 0.9]],
    half: [[0, 0.8], [0.012, 0.865], [0.04, 0.9], [0.1, 0.915], [0.85, 0.915], [0.94, 0.9], [0.98, 0.86], [1, 0.79]],
    roofHalf: [[0, 0.62], [0.2, 0.66], [0.4, 0.7], [0.6, 0.69], [0.7, 0.65], [1, 0.62]],
    screen: [0.66, 0.768], back: [0.207, 0.36], side: [0.372, 0.655], pillars: [0.515], pw: 0.01, split: 0.5, upper: true,
    seat: 0.5, head: [0.66, 0.62, 0.34, 0.07], tail: [0.88, 0.6, 0.42, 0.1], plate: 'TI 719 MV', plateF: 0.36, plateR: 0.62,
    doors: [0.33, 0.514, 0.678], handles: [0.36, 0.54],
    spec: { len: 4.68, wid: 1.83, tall: 1.44, front: 1.44, rear: -1.36, track: 1.57, wheel: 0.325, mass: 1450, power: 110000, pull: 5200, top: 20, lock: 0.58 },
  },
  suv: {
    len: 4.45, wid: 1.86, tall: 1.66, wheel: 0.36, arch: 0.08, rear: -1.425, front: 1.245, track: 1.6,
    bottom: [[0, 0.56], [0.03, 0.42], [0.08, 0.33], [0.2, 0.26], [0.78, 0.26], [0.92, 0.31], [0.97, 0.37], [1, 0.48]],
    belt: [[0, 1.04], [0.03, 1.08], [0.15, 1.11], [0.45, 1.08], [0.65, 1.04], [0.74, 1.01], [0.87, 0.97], [0.95, 0.92], [0.99, 0.86], [1, 0.8]],
    roof: [[0, 1.04], [0.012, 1.2], [0.03, 1.52], [0.06, 1.62], [0.15, 1.65], [0.5, 1.66], [0.62, 1.63], [0.67, 1.57], [0.765, 1.08], [0.775, 1.03]],
    half: [[0, 0.84], [0.012, 0.89], [0.035, 0.92], [0.1, 0.93], [0.85, 0.93], [0.94, 0.915], [0.98, 0.88], [1, 0.8]],
    roofHalf: [[0, 0.66], [0.08, 0.72], [0.3, 0.74], [0.58, 0.73], [0.7, 0.68], [1, 0.64]],
    screen: [0.668, 0.77], back: [0.014, 0.058], side: [0.075, 0.66], pillars: [0.205, 0.43], pw: 0.011, split: 0.5, upper: true,
    seat: 0.72, head: [0.8, 0.64, 0.34, 0.085], tail: [1.0, 0.7, 0.22, 0.16], plate: 'TI 305 QF', plateF: 0.42, plateR: 0.72,
    doors: [0.21, 0.428, 0.672], handles: [0.245, 0.46], clad: true, rails: true,
    spec: { len: 4.45, wid: 1.86, tall: 1.66, front: 1.245, rear: -1.425, track: 1.6, wheel: 0.36, mass: 1750, power: 120000, pull: 6200, top: 20, lock: 0.58 },
  },
  bus: {
    len: 7.1, wid: 2.3, tall: 2.95, wheel: 0.46, arch: 0.08, rear: -2.05, front: 1.85, track: 1.95,
    bottom: [[0, 0.5], [0.02, 0.36], [0.05, 0.33], [0.95, 0.33], [0.985, 0.36], [1, 0.42]],
    belt: [[0, 1.12], [0.9, 1.1], [0.95, 1.05], [0.975, 0.98], [0.99, 0.95], [1, 0.92]],
    roof: [[0, 2.6], [0.008, 2.86], [0.025, 2.93], [0.95, 2.93], [0.968, 2.84], [0.99, 1.0], [0.995, 0.95]],
    half: [[0, 1.1], [0.008, 1.135], [0.025, 1.15], [0.975, 1.15], [0.992, 1.13], [1, 1.09]],
    roofHalf: [[0, 1.04], [0.03, 1.1], [0.97, 1.1], [1, 1.06]],
    screen: [0.952, 0.99], back: null, side: [0.04, 0.94], pillars: [0.17, 0.31, 0.45, 0.59, 0.73, 0.86], pw: 0.006, split: 0.74, upper: false,
    seat: 1.0, head: [0.62, 0.9, 0.32, 0.12], tail: [0.75, 0.95, 0.2, 0.3], plate: 'TI BUS 12', plateF: 0.45, plateR: 0.65,
    doors: [0.83, 0.88, 0.93, 0.47, 0.53], handles: [],
    spec: { len: 7.1, wid: 2.3, tall: 2.95, front: 1.85, rear: -2.05, track: 1.95, wheel: 0.46, mass: 9000, power: 160000, pull: 26000, top: 14, lock: 0.6 },
  },
}

/* ---------------------------------------------------------------- building the shapes ---- */

/** Triangles gathered for one material: positions and normals, and texture coordinates or colours (in metres, scaled at the end). */
class Bag {
  p: number[] = []; n: number[] = []; uv: number[] = []; c: number[] = []
  readonly uvs: boolean; readonly cols: boolean
  constructor(uvs: boolean, cols: boolean) { this.uvs = uvs; this.cols = cols }
  vert(p: Vector3, n: Vector3, uv?: [number, number], c?: Color) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z)
    if (this.uvs) this.uv.push(uv?.[0] ?? 0.5, uv?.[1] ?? 0.5)
    if (this.cols) this.c.push(c?.r ?? 1, c?.g ?? 1, c?.b ?? 1)
  }
  /** A whole geometry, placed by m, in one colour (or with its own texture coordinates, or one fixed spot of the texture). */
  add(g: BufferGeometry, m?: Matrix4, c?: Color, uv?: [number, number]) {
    const ng = g.index ? g.toNonIndexed() : g
    if (m) ng.applyMatrix4(m)
    if (!ng.getAttribute('normal')) ng.computeVertexNormals()
    const P = ng.getAttribute('position'), N = ng.getAttribute('normal'), U = ng.getAttribute('uv')
    const p = new Vector3(), n = new Vector3()
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i)
      this.vert(p, n, uv ?? (U ? [U.getX(i), U.getY(i)] : undefined), c)
    }
    g.dispose(); if (ng !== g) ng.dispose()
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    if (this.uvs) g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    if (this.cols) g.setAttribute('color', new Float32BufferAttribute(this.c, 3))
    g.scale(METRE, METRE, METRE)
    g.computeBoundingSphere()
    return g
  }
}

const place = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'YXZ')), new Vector3(sx, sy, sz))
const rbox = (w: number, h: number, d: number, r = 0.02, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))

/** How many cross-section points down one side, from the middle underneath round to the middle of the roof. */
const RING = 13
/** The cross-section at t: [out from the middle, height] for each point, and how much cabin there is. */
function section(S: Body, t: number) {
  const f = { bottom: lin(S.bottom), belt: lin(S.belt), roof: lin(S.roof), half: lin(S.half), roofHalf: lin(S.roofHalf) }
  const x = (t - 0.5) * S.len
  const W = f.half(t), sill = f.bottom(t), belt0 = f.belt(t)
  // The wheel arches, cut round the tyres.
  let zb = sill
  for (const ax of [S.rear, S.front]) { const dx = Math.abs(x - ax), R = S.wheel + S.arch; if (dx < R) zb = Math.max(zb, S.wheel + Math.sqrt(R * R - dx * dx)) }
  const belt = Math.max(belt0, zb + 0.1)
  const r0 = f.roof(t), roof = Math.max(Number.isNaN(r0) ? belt : r0, belt)
  const g = roof - belt, cab = clamp01(g / 0.35)
  const zs = Math.max(sill + (belt0 - sill) * 0.45, zb + 0.03)
  const wR = Math.min(f.roofHalf(t), W - 0.1)
  const n: [number, number][] = []
  n[0] = [0, zb + 0.02]
  n[1] = [W * 0.82, zb]
  n[2] = [W - 0.035, zb + 0.03]
  const h3 = zb + Math.min(0.12, (zs - zb) * 0.5)
  n[3] = [W - 0.004, h3]
  const h4 = Math.max(zs, h3 + 0.01); n[4] = [W, h4]
  const h5 = Math.max(belt - 0.05, h4 + 0.01); n[5] = [W - 0.012, h5]
  const h6 = Math.max(belt, h5 + 0.008); n[6] = [W - 0.035, h6]
  const base = h6 + 0.012, latBase = W - 0.07, latTop = mix(W - 0.09, wR, cab), top = base + Math.max(0, g - 0.05)
  n[7] = [latBase, base]
  n[8] = [mix(latBase, latTop, S.split) + 0.014 * cab * (S.split === 0.5 ? 1 : 0.2), mix(base, top, S.split)]
  n[9] = [latTop, top]
  const rim = top + 0.012 + 0.03 * cab
  n[10] = [latTop - 0.03 - 0.03 * cab, rim]
  const crown = 0.03 - 0.01 * cab
  n[11] = [(latTop - 0.06) * 0.5, rim + crown * 0.8]
  n[12] = [0, rim + crown]
  return { n, g, x }
}

const PAINT = 0, GLASS = 1, TRIM = 2
/** Which material a piece of the loft is: segment k of the cross-section (between points k and k+1), at t. */
function material(S: Body, k: number, t: number, g: number) {
  const inR = (r: [number, number] | null) => !!r && t > r[0] && t < r[1]
  const glass = inR(S.screen) || inR(S.back)
  const pillar = S.pillars.some((p) => Math.abs(t - p) < S.pw)
  const side = inR(S.side) && g > 0.2
  if (k <= 5) return PAINT
  if (k === 6) return g > 0.12 ? TRIM : PAINT
  if (k === 7 || k === 8) {
    if (glass) return TRIM
    if (!side) return PAINT
    if (pillar) return TRIM
    return k === 8 && !S.upper ? PAINT : GLASS
  }
  if (k === 9) return glass ? TRIM : PAINT
  return glass ? GLASS : PAINT
}

export type CarShapes = { paint: BufferGeometry; glass: BufferGeometry; trim: BufferGeometry; inner: BufferGeometry; head: BufferGeometry; tail: BufferGeometry; plate: BufferGeometry }

/** Every piece of one model, in world units, its middle on the ground under it (forward +x, right +z). */
export function carShapes(name: ModelName): CarShapes {
  const S = MODELS[name]
  const bags = [new Bag(true, false), new Bag(true, false), new Bag(true, false)]
  const inner = new Bag(false, true), head = new Bag(false, false), tail = new Bag(false, false), plate = new Bag(true, false)

  /* ---- the loft ---- */
  // Stations: close together at the ends, where the body rounds off, and exactly at every edge of glass and pillar.
  const ts = new Set<number>()
  const NS = 90
  for (let i = 0; i < NS; i++) ts.add(0.5 - 0.5 * Math.cos((Math.PI * i) / (NS - 1)))
  const edges = [...S.screen, ...(S.back ?? []), ...S.side, ...S.pillars.flatMap((p) => [p - S.pw, p + S.pw])]
  for (const e of edges) ts.add(e)
  const T = [...ts].sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.0015)
  // The ring all the way round: down the right side (z +) from underneath to the roof, back down the left.
  const ringOf = (t: number) => {
    const { n, g, x } = section(S, t)
    const pts: Vector3[] = []
    for (let k = 0; k < RING; k++) pts.push(new Vector3(x, n[k][1], n[k][0]))
    for (let k = RING - 2; k >= 0; k--) pts.push(new Vector3(x, n[k][1], -n[k][0]))
    return { pts, g }
  }
  const rings = T.map(ringOf)
  const R = rings[0].pts.length // 25: the last is the first again (underneath), so the texture wraps cleanly
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  T.forEach((t, s) => rings[s].pts.forEach((p, k) => { pos.push(p.x, p.y, p.z); uv.push(t, k / (R - 1)) }))
  for (let s = 0; s < T.length - 1; s++) for (let k = 0; k < R - 1; k++) {
    const a = s * R + k, b = s * R + k + 1, c = (s + 1) * R + k, d = (s + 1) * R + k + 1
    idx.push(a, c, b, b, c, d)
  }
  const loft = new BufferGeometry()
  loft.setAttribute('position', new Float32BufferAttribute(pos, 3)); loft.setIndex(idx); loft.computeVertexNormals()
  const LN = loft.getAttribute('normal')
  const vp = new Vector3(), vn = new Vector3()
  for (let s = 0; s < T.length - 1; s++) {
    const tm = (T[s] + T[s + 1]) / 2, g = Math.min(rings[s].g, rings[s + 1].g)
    for (let k = 0; k < R - 1; k++) {
      const seg = k < RING - 1 ? k : R - 2 - k
      const bag = bags[material(S, seg, tm, g)]
      const a = s * R + k, b = s * R + k + 1, c = (s + 1) * R + k, d = (s + 1) * R + k + 1
      for (const v of [a, c, b, b, c, d]) { vp.fromArray(pos, v * 3); vn.fromBufferAttribute(LN, v); bag.vert(vp, vn, [uv[v * 2], uv[v * 2 + 1]]) }
    }
  }
  loft.dispose()
  // The ends closed: the tail and the nose, flat.
  for (const [s, dir] of [[0, -1], [T.length - 1, 1]] as const) {
    const pts = rings[s].pts, c = pts.slice(0, -1).reduce((m, p) => m.add(p), new Vector3()).divideScalar(pts.length - 1)
    const nrm = new Vector3(dir, 0, 0)
    for (let k = 0; k < pts.length - 1; k++) {
      const [p, q] = dir > 0 ? [pts[k], pts[k + 1]] : [pts[k + 1], pts[k]]
      for (const v of [c, q, p]) bags[PAINT].vert(v, nrm, [T[s], 0.5])
    }
  }

  const f = { belt: lin(S.belt), half: lin(S.half), roofHalf: lin(S.roofHalf), roof: lin(S.roof), bottom: lin(S.bottom) }
  const xt = (t: number) => (t - 0.5) * S.len
  const P = bags[PAINT], TR = bags[TRIM], dark = new Color('#16181c')
  const cowl = xt(S.screen[1]), front = S.len / 2, back = -S.len / 2

  /* ---- outside: mirrors, grille and intakes, wipers, aerial, rails ---- */
  for (const sd of [-1, 1]) {
    const mx = cowl - 0.14, my = f.belt(S.screen[1] - 0.02) + (name === 'bus' ? 0.9 : 0.09), mz = sd * (f.half(S.screen[1]) + (name === 'bus' ? 0.16 : 0.07))
    P.add(rbox(0.12, name === 'bus' ? 0.32 : 0.12, name === 'bus' ? 0.16 : 0.2, 0.04), place(mx, my, mz, 0, sd * 0.12, 0), undefined, [0.5, 0.5])
    TR.add(rbox(0.012, name === 'bus' ? 0.29 : 0.1, name === 'bus' ? 0.14 : 0.17, 0.004), place(mx - 0.062, my, mz, 0, sd * 0.12, 0))
    TR.add(rbox(0.06, 0.03, 0.1, 0.01), place(mx + 0.01, my - 0.04, mz - sd * 0.1, 0, 0, 0))
  }
  const noseH = f.belt(0.995), bot1 = f.bottom(0.999)
  if (name === 'bus') {
    TR.add(rbox(0.05, 0.16, 1.6, 0.02), place(front - 0.005, 0.62, 0))
    TR.add(rbox(0.04, 0.1, 2.1, 0.02), place(front + 0.002, 0.42, 0))
  } else {
    // The grille between the headlamps, the intake under the bumper.
    TR.add(rbox(0.07, Math.max(0.09, (noseH - bot1) * 0.34), S.wid * (name === 'suv' ? 0.5 : 0.4), 0.03), place(front - 0.022, bot1 + (noseH - bot1) * 0.6, 0))
    TR.add(rbox(0.06, 0.11, S.wid * 0.6, 0.035), place(front - 0.016, bot1 + 0.1, 0))
    // Fog lamps either side of the intake.
    for (const sd of [-1, 1]) TR.add(rbox(0.05, 0.07, 0.16, 0.025), place(front - 0.03, bot1 + 0.12, sd * S.wid * 0.36))
    TR.add(rbox(0.05, 0.07, S.wid * 0.7, 0.02), place(back + 0.02, f.bottom(0.001) + 0.06, 0))
    // Wipers lying at the foot of the windscreen.
    for (const z of [-0.32, 0.12]) TR.add(rbox(0.018, 0.012, 0.55, 0.004), place(cowl - 0.07, f.belt(S.screen[1]) + 0.035, z, 0.12, 0.18, 0))
    // A shark-fin aerial on the roof.
    const ta = S.back ? S.back[1] + 0.05 : 0.2
    TR.add(rbox(0.16, 0.06, 0.05, 0.02), place(xt(ta), f.roof(ta) + 0.06, 0))
  }
  if (S.rails) for (const sd of [-1, 1]) {
    const t0 = 0.12, t1 = 0.6, y = 1.69
    TR.add(rbox((t1 - t0) * S.len, 0.03, 0.035, 0.012), place(xt((t0 + t1) / 2), y + 0.03, sd * 0.6))
    for (const t of [t0 + 0.01, t1 - 0.01]) TR.add(rbox(0.05, 0.04, 0.04, 0.01), place(xt(t), y + 0.005, sd * 0.6))
  }

  /* ---- lamps, plates ---- */
  for (const sd of [-1, 1]) {
    const [hh, hz, hw, hy] = S.head, [th, tz, tw, ty] = S.tail
    head.add(rbox(0.14, hy, hw, 0.03), place(front - (name === 'bus' ? 0.04 : 0.05), hh, sd * hz, 0, name === 'bus' ? 0 : -sd * 0.3, 0))
    // A dark housing round each lamp, so it reads as a lamp set into the body.
    if (name !== 'bus') TR.add(rbox(0.12, hy + 0.03, hw + 0.04, 0.03), place(front - 0.065, hh, sd * hz, 0, -sd * 0.3, 0))
    tail.add(rbox(0.12, ty, tw, 0.03), place(back + (name === 'bus' ? 0.03 : 0.035), th, sd * tz, 0, name === 'bus' ? 0 : sd * 0.3, 0))
    // Reflectors low on the bumper.
    if (name !== 'bus') tail.add(rbox(0.03, 0.03, 0.12, 0.01), place(back - 0.005, f.bottom(0.002) + 0.12, sd * (S.wid / 2 - 0.2)))
  }
  // A light bar across the tail (the saloon and the SUV), a dark garnish (the hatch).
  if (name === 'saloon' || name === 'suv') tail.add(rbox(0.04, 0.03, 2 * S.tail[1] - S.tail[2] * 0.7, 0.012), place(back - 0.004, S.tail[0] + (name === 'suv' ? 0.05 : 0), 0))
  if (name === 'hatch') TR.add(rbox(0.04, 0.06, 2 * S.tail[1] - S.tail[2] * 0.8, 0.02), place(back - 0.004, S.tail[0] - 0.02, 0))
  plate.add(new PlaneGeometry(0.52, 0.11), place(front + 0.014, S.plateF, 0, 0, Math.PI / 2, 0))
  plate.add(new PlaneGeometry(0.52, 0.11), place(back - 0.014, S.plateR, 0, 0, -Math.PI / 2, 0))

  /* ---- inside: the floor and the arches, the cabin ---- */
  const liner = new Color('#0b0c0e'), floor = new Color('#1c1e22'), seatC = new Color('#2c3038'), insert = new Color('#3a404b'), dash = new Color('#16181b'), metal = new Color('#6b7079'), calliper = new Color('#2f5fb8')
  const inW = S.track / 2 - 0.16
  const under = Math.min(...S.bottom.map((k) => k[1]))
  inner.add(rbox(S.len - 0.5, 0.2, inW * 2, 0.05), place(0, under + 0.11, 0), floor)
  for (const ax of [S.rear, S.front]) {
    const arch = new CylinderGeometry(S.wheel + S.arch - 0.01, S.wheel + S.arch - 0.01, S.wid - 0.06, 18, 1, true, -Math.PI / 2, Math.PI)
    inner.add(arch, place(ax, S.wheel, 0, -Math.PI / 2, 0, 0), liner)
    // Brake discs and callipers behind the spokes.
    for (const sd of [-1, 1]) {
      inner.add(new CylinderGeometry(S.wheel * 0.62, S.wheel * 0.62, 0.03, 20), place(ax, S.wheel, sd * (S.track / 2 - 0.05), Math.PI / 2, 0, 0), metal)
      inner.add(rbox(0.1, 0.12, 0.06, 0.02), place(ax + S.wheel * 0.42, S.wheel + S.wheel * 0.25, sd * (S.track / 2 - 0.03)), calliper)
    }
  }
  const seat = (x: number, z: number, w: number, hip: number, plain = false) => {
    // (The bus's rows of seats, too small through its windows to need more than a cushion and a back.)
    if (plain) {
      inner.add(new BoxGeometry(0.44, 0.1, w), place(x + 0.04, hip - 0.08, z), seatC)
      inner.add(new BoxGeometry(0.08, 0.6, w), place(x - 0.2, hip + 0.22, z, 0, 0, 0.15), seatC)
      return
    }
    inner.add(rbox(0.5, 0.13, w, 0.05), place(x + 0.06, hip - 0.09, z, 0, 0, 0.06), seatC)
    inner.add(rbox(0.46, 0.04, w * 0.6, 0.015), place(x + 0.06, hip - 0.02, z, 0, 0, 0.06), insert)
    inner.add(rbox(0.12, 0.62, w, 0.05), place(x - 0.2, hip + 0.24, z, 0, 0, 0.22), seatC)
    inner.add(rbox(0.1, 0.16, w * 0.55, 0.04), place(x - 0.28, hip + 0.62, z, 0, 0, 0.12), seatC)
  }
  const hip = S.seat
  if (name === 'bus') {
    const dx = cowl - 0.95
    seat(dx, -0.72, 0.5, hip)
    inner.add(rbox(0.5, 0.22, S.wid - 0.3, 0.04), place(cowl - 0.35, 0.98, 0), dash)
    inner.add(new TorusGeometry(0.22, 0.025, 8, 24), place(dx + 0.55, hip + 0.3, -0.72, -0.95, -Math.PI / 2, 0), dash)
    for (let x = back + 0.8; x < dx - 0.9; x += 0.82) for (const z of [-0.78, -0.33, 0.33, 0.78]) if (!(x > xt(0.46) && x < xt(0.54) && z > 0)) seat(x, z, 0.42, 0.88, true)
    inner.add(rbox(S.len - 0.4, 0.06, S.wid - 0.3, 0.02), place(0, 0.6, 0), floor)
  } else {
    const fx = cowl - 1.2, rx = cowl - 2.05
    for (const z of [-0.37, 0.37]) seat(fx, z, 0.5, hip)
    seat(rx, 0, 1.25, hip + 0.04)
    // The dashboard under the windscreen, the steering wheel on the driver's side (they drive on the right: the wheel is on the left).
    const dh = f.belt(S.screen[1] - 0.02)
    inner.add(rbox(0.55, 0.22, S.wid - 0.28, 0.06), place(cowl - 0.3, dh - 0.06, 0), dash)
    inner.add(rbox(0.32, 0.18, 0.2, 0.04), place(cowl - 0.55, dh - 0.25, 0), dash)
    inner.add(new TorusGeometry(0.185, 0.022, 8, 28), place(fx + 0.58, hip + 0.36, -0.37, -0.42, -Math.PI / 2, 0), dash)
    inner.add(new CylinderGeometry(0.03, 0.03, 0.3, 8), place(fx + 0.7, hip + 0.3, -0.37, 0, 0, Math.PI / 2 - 0.42), dash)
  }
  const out = { paint: bags[PAINT].geometry(), glass: bags[GLASS].geometry(), trim: bags[TRIM].geometry(), inner: inner.geometry(), head: head.geometry(), tail: tail.geometry(), plate: plate.geometry() }
  return out
}

/** A wheel: the tyre (with its sidewall rounded), and the alloy (five spokes, a rim, the hub). Radius 1 m; the alloy faces +z. */
export function wheelShapes() {
  const R = 0.315, w = 0.205, rin = 0.215
  const prof = [new Vector2(rin, -w / 2 + 0.012), new Vector2(R - 0.05, -w / 2), new Vector2(R - 0.012, -w / 2 + 0.015), new Vector2(R, -w / 2 + 0.04), new Vector2(R + 0.002, 0), new Vector2(R, w / 2 - 0.04), new Vector2(R - 0.012, w / 2 - 0.015), new Vector2(R - 0.05, w / 2), new Vector2(rin, w / 2 - 0.012)]
  const tyre = new Bag(false, false)
  const lathe = new LatheGeometry(prof, 28)
  tyre.add(lathe, place(0, 0, 0, Math.PI / 2, 0, 0))
  // The inner side of the wheel, dark.
  tyre.add(new CylinderGeometry(rin, rin, 0.01, 16, 1), place(0, 0, -w / 2 + 0.03, Math.PI / 2, 0, 0))
  const rim = new Bag(false, false)
  // Five spokes: a disc with five windows cut between them.
  const face = new Shape(); face.absarc(0, 0, rin, 0, Math.PI * 2, false)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, h = new Path(), r0 = 0.075, r1 = rin - 0.025, da = 0.36, db = 0.25
    h.moveTo(Math.cos(a - db) * r0, Math.sin(a - db) * r0)
    h.lineTo(Math.cos(a - da) * r1, Math.sin(a - da) * r1)
    h.absarc(0, 0, r1, a - da, a + da, false)
    h.lineTo(Math.cos(a + db) * r0, Math.sin(a + db) * r0)
    h.absarc(0, 0, r0, a + db, a - db, true)
    face.holes.push(h)
  }
  rim.add(new ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: false, curveSegments: 6 }), place(0, 0, w / 2 - 0.05))
  // The rim's lip and barrel, and the hub with its cap.
  rim.add(new CylinderGeometry(rin + 0.004, rin + 0.004, w - 0.02, 28, 1, true), place(0, 0, 0, Math.PI / 2, 0, 0))
  rim.add(new TorusGeometry(rin, 0.008, 4, 28), place(0, 0, w / 2 - 0.02))
  rim.add(new CylinderGeometry(0.05, 0.055, 0.04, 10, 1), place(0, 0, w / 2 - 0.02, Math.PI / 2, 0, 0))
  const t = tyre.geometry(), r = rim.geometry()
  return { tyre: t, rim: r }
}

/**
 * Where cars of your own stand parked: on a level patch of ground beside a straight stretch of road, clear
 * all round (room to open the doors) of anything built or grown, with nothing — a fence, a wall — between it and the
 * road; side-on to the kerb and facing the way the traffic on that side goes (the island drives on the right). The
 * first is the one nearest a point (where you start), the others at least seven tiles from it and each other.
 */
export function parkingSpots(world: { kind(i: number, j: number): string; heightAt(x: number, z: number): number; poolAt(x: number, z: number): number | null; boxes: { i0: number; i1: number; j0: number; j1: number; z1: number }[] }, roads: [number, number][], from: { x: number; z: number }, n: number, gap = 7) {
  const road = new Set(roads.map(([i, j]) => `${i},${j}`))
  const out: { x: number; z: number; yaw: number; d: number; road: [number, number] }[] = []
  for (const [i, j] of roads) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ti = i + di, tj = j + dj
    if (road.has(`${ti},${tj}`) || world.kind(ti, tj) !== '1') continue
    // (Along a straight: the road runs on past it both ways.)
    if (!road.has(`${i + dj},${j + di}`) || !road.has(`${i - dj},${j - di}`)) continue
    const x = tj + 0.5 - dj * 0.24, z = ti + 0.5 - di * 0.24, yaw = di !== 0 ? (di > 0 ? 0 : Math.PI) : dj > 0 ? Math.PI / 2 : -Math.PI / 2
    const hl = 2.6 * METRE, hw = 1.25 * METRE, hx = di !== 0 ? hl : hw, hz = di !== 0 ? hw : hl
    const level = world.heightAt(j + 0.5, i + 0.5)
    let ok = true
    for (let a = -1; a <= 1 && ok; a += 0.5) for (let b = -1; b <= 1 && ok; b += 0.5) {
      const px = x + a * hx, pz = z + b * hz
      if (Math.abs(world.heightAt(px, pz) - level) > 0.01 || world.poolAt(px, pz) !== null) ok = false
    }
    const x0 = Math.min(x - hx, j + 0.5 * (1 + dj)) - 0.06, x1 = Math.max(x + hx, j + 0.5 * (1 + dj)) + 0.06
    const z0 = Math.min(z - hz, i + 0.5 * (1 + di)) - 0.06, z1 = Math.max(z + hz, i + 0.5 * (1 + di)) + 0.06
    for (const B of world.boxes) if (ok && B.z1 > level + 0.01 && B.j1 > x0 && B.j0 < x1 && B.i1 > z0 && B.i0 < z1) ok = false
    if (ok) out.push({ x, z, yaw, d: Math.hypot(x - from.x, z - from.z), road: [i, j] })
  }
  out.sort((a, b) => a.d - b.d)
  const chosen: typeof out = []
  for (const s of out) if (chosen.length < n && chosen.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > gap)) chosen.push(s)
  return chosen
}

/* ---------------------------------------------------------------- drawing them ---- */

/** Painted on the body: the panel gaps, the door handles, the fuel flap (and the bus's livery). */
function panelMap(name: ModelName) {
  const S = MODELS[name], cv = document.createElement('canvas'); cv.width = 2048; cv.height = 512
  const c = cv.getContext('2d')!
  const X = (t: number) => t * cv.width, Yv = (v: number) => (1 - v) * cv.height
  const right = (k: number) => k / 24, left = (k: number) => 1 - k / 24
  if (name === 'bus') {
    // The livery: deep blue below the windows, white above, a teal line at the waist.
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height)
    c.fillStyle = '#2350c4'
    c.fillRect(0, Yv(right(6.1)), cv.width, Yv(0) - Yv(right(6.1))); c.fillRect(0, 0, cv.width, Yv(left(6.1)))
    c.fillStyle = '#1fb3a4'
    for (const v of [right(6.25), left(6.75)]) c.fillRect(0, Yv(v) - 5, cv.width, 10)
  } else {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height)
    // Plastic cladding round the bottom of an SUV.
    if (S.clad) { c.fillStyle = '#4a4d52'; c.fillRect(0, Yv(right(2.4)), cv.width, Yv(0) - Yv(right(2.4))); c.fillRect(0, 0, cv.width, Yv(left(2.4))) }
  }
  c.strokeStyle = 'rgba(10,12,16,0.8)'; c.lineWidth = 3; c.lineCap = 'round'
  const seam = (x0: number, y0: number, x1: number, y1: number) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke() }
  for (const side of [right, left]) {
    for (const t of S.doors) seam(X(t), Yv(side(1.3)), X(t), Yv(side(6.4)))
    if (name !== 'bus') {
      // The bonnet's edges and its front, the bumpers' seams, the boot's.
      const hood = S.screen[1] + 0.012
      seam(X(hood), Yv(side(6.7)), X(0.965), Yv(side(6.7)))
      seam(X(0.955), Yv(side(1.2)), X(0.955), Yv(side(6.4)))
      seam(X(0.045), Yv(side(1.2)), X(0.045), Yv(side(6.4)))
      if (S.back) seam(X(0.03), Yv(side(6.7)), X(S.back[0]), Yv(side(6.7)))
      // The sills under the doors.
      seam(X(S.doors[0]), Yv(side(1.6)), X(S.doors[S.doors.length - 1]), Yv(side(1.6)))
    }
    for (const t of S.handles) {
      c.fillStyle = 'rgba(14,16,20,0.85)'; c.beginPath(); c.roundRect(X(t) - 22, Yv(side(4.65)) - 4, 44, 8, 4); c.fill()
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(X(t) - 18, Yv(side(4.65)) - 4, 36, 2)
    }
  }
  if (name !== 'bus') {
    seam(X(S.screen[1] + 0.012), Yv(right(6.7)), X(S.screen[1] + 0.012), Yv(left(6.7)))
    c.beginPath(); c.arc(X(0.115), Yv(right(4.3)), 11, 0, Math.PI * 2); c.stroke()
  }
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 8
  return tex
}

function plateMap(name: ModelName) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112
  const c = cv.getContext('2d')!
  c.fillStyle = '#f4f5f2'; c.fillRect(0, 0, 512, 112)
  c.fillStyle = '#244aa8'; c.fillRect(0, 0, 56, 112)
  c.fillStyle = '#f4f5f2'; c.font = '700 26px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('TI', 28, 92)
  c.strokeStyle = '#1a1c20'; c.lineWidth = 5; c.strokeRect(3, 3, 506, 106)
  c.fillStyle = '#16181c'; c.font = '700 76px "DIN Alternate", "Arial Narrow", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(MODELS[name].plate.replace(/^TI /, ''), 290, 60)
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4
  return tex
}

/** The bus's destination, lit. */
function signMap() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64
  const c = cv.getContext('2d')!
  c.fillStyle = '#05070a'; c.fillRect(0, 0, 512, 64)
  c.fillStyle = '#cfe6ff'; c.font = '700 44px ui-monospace, monospace'; c.textBaseline = 'middle'
  c.fillText('12', 18, 34); c.font = '600 40px system-ui, sans-serif'; c.fillText('Harbour  ·  Peaks', 92, 34)
  // The dots of the display.
  c.fillStyle = 'rgba(5,7,10,0.55)'
  for (let x = 0; x < 512; x += 4) c.fillRect(x, 0, 1, 64)
  for (let y = 0; y < 64; y += 4) c.fillRect(0, y, 512, 1)
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace
  return tex
}

/** A soft pool of light: two headlamps' beams on the road ahead, merging. */
function beamMap() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128
  const c = cv.getContext('2d')!
  // (Forward is along the picture's width: the lamps side by side down its height.)
  // (Each falls to nothing well inside the square, so the pool has no edge.)
  c.globalCompositeOperation = 'lighter'
  for (const y of [48, 80]) {
    const g = c.createRadialGradient(14, y, 1, 44, y, 42)
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.45, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g; c.fillRect(0, 0, 128, 128)
  }
  return new CanvasTexture(cv)
}
/** The soft dark under a car where the sky cannot reach. */
function blobMap() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64
  const c = cv.getContext('2d')!
  c.filter = 'blur(8px)'; c.fillStyle = 'rgba(0,0,0,0.85)'; c.beginPath(); c.roundRect(12, 12, 104, 40, 14); c.fill()
  return new CanvasTexture(cv)
}

/**
 * Reflections that know where the ground is: the sky map has only sky in it, so a body's underside (which
 * sees the road) would shine with it. What a surface reflects from below the horizon is darkened to the road's.
 */
const GROUNDED = ShaderChunk.envmap_physical_pars_fragment.replace('return envMapColor.rgb * envMapIntensity;', 'return envMapColor.rgb * envMapIntensity * mix( 0.14, 1.0, smoothstep( -0.3, 0.04, reflectVec.y ) );')
function grounded<T extends MeshStandardMaterial>(m: T) {
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>', GROUNDED) }
  m.customProgramCacheKey = () => 'grounded'
  return m
}

/** A lamp lens that lights as its own instance colour says (the colour of the light, times how bright). */
function lampMaterial(color: string) {
  const m = new MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.3 })
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance += vColor;\n#endif')
  }
  // (The fragment stage knows an instance colour only as USE_COLOR.)
  m.customProgramCacheKey = () => 'car-lamp'
  return m
}

export type Pose = {
  x: number; y: number; z: number; yaw: number; pitch: number; roll: number
  /** The body on its springs: nose up (+) or down, leaning right (+), bouncing (world units). */
  dive: number; lean: number; bob: number
  /** The wheels' turn (radians rolled) and the front wheels' steering (+ left). */
  spin: number; steer: number
  /** Lamps: running (the engine on: its daytime lamps), headlights (0–1), tail lights (0–1), brake lights (0–1), reversing (0–1). */
  on: number; head: number; tail: number; brake: number; reverse: number
}

export type Fleet = ReturnType<typeof fleet>

/** Every car and the bus, drawn: list gives each one's model and paint. */
export function fleet(scene: Scene, list: { model: ModelName; paint: string }[]) {
  const group = new Group(); group.name = 'cars'
  scene.add(group)
  const shapes = new Map<ModelName, CarShapes>()
  const slot: number[] = []
  const byModel = new Map<ModelName, number[]>()
  list.forEach((c, k) => { const a = byModel.get(c.model) ?? []; slot[k] = a.length; a.push(k); byModel.set(c.model, a) })

  const glass = grounded(new MeshStandardMaterial({ color: '#0a0f14', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.8, envMapIntensity: 2.2 }))
  // Glass adds what it reflects to what shows through it (rather than fading the reflection with the tint).
  glass.blending = CustomBlending; glass.blendSrc = OneFactor; glass.blendDst = OneMinusSrcAlphaFactor
  const trim = grounded(new MeshStandardMaterial({ color: '#0d0e10', roughness: 0.18, metalness: 0.2, envMapIntensity: 1.6 }))
  const inner = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: DoubleSide })
  const head = lampMaterial('#a7b0bc'), tail = lampMaterial('#5a0a10')
  const tyreMat = new MeshStandardMaterial({ color: '#17181b', roughness: 0.93 }), rimMat = grounded(new MeshStandardMaterial({ color: '#c6ccd4', roughness: 0.28, metalness: 0.9, envMapIntensity: 1.8 }))
  const plateMat = new Map<ModelName, Material>()

  type Set = { model: ModelName; paint: InstancedMesh; rest: InstancedMesh[]; head: InstancedMesh; tail: InstancedMesh }
  const sets = new Map<ModelName, Set>()
  const mk = (g: BufferGeometry, m: Material, n: number, shadow = true) => {
    const im = new InstancedMesh(g, m, n); im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true; group.add(im); return im
  }
  for (const [model, ks] of byModel) {
    const sh = carShapes(model); shapes.set(model, sh)
    const paintMat = grounded(new MeshPhysicalMaterial({ color: '#ffffff', roughness: model === 'bus' ? 0.45 : 0.34, metalness: model === 'bus' ? 0.05 : 0.42, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5, map: panelMap(model) }))
    const plm = new MeshStandardMaterial({ map: plateMap(model), roughness: 0.4, metalness: 0.2 }); plateMat.set(model, plm)
    const paint = mk(sh.paint, paintMat, ks.length)
    ks.forEach((k, i) => paint.setColorAt(i, new Color(model === 'bus' ? '#ffffff' : list[k].paint)))
    // (Only the body casts a shadow: what is under it or inside it would only darken what its shadow already has.)
    const rest = [mk(sh.glass, glass, ks.length, false), mk(sh.trim, trim, ks.length, false), mk(sh.inner, inner, ks.length, false), mk(sh.plate, plm, ks.length, false)]
    for (const im of [rest[0], rest[2], rest[3]]) im.userData.noAO = true
    rest[0].renderOrder = 2
    const hd = mk(sh.head, head, ks.length, false), tl = mk(sh.tail, tail, ks.length, false)
    hd.userData.noAO = tl.userData.noAO = true
    for (let i = 0; i < ks.length; i++) { hd.setColorAt(i, new Color(0, 0, 0)); tl.setColorAt(i, new Color(0, 0, 0)) }
    if (model === 'bus') {
      // The destination over the windscreen.
      const sign = new Mesh2(new PlaneGeometry(1.5 * METRE, 0.2 * METRE), new MeshBasicMaterial({ map: signMap(), toneMapped: true }))
      sign.geometry.rotateY(Math.PI / 2); sign.geometry.translate((MODELS.bus.len / 2 - 0.1) * METRE, 2.68 * METRE, 0)
      const im = mk(sign.geometry, sign.material, ks.length, false); rest.push(im)
    }
    sets.set(model, { model, paint, rest, head: hd, tail: tl })
  }
  const wheels = wheelShapes()
  const tyres = mk(wheels.tyre, tyreMat, list.length * 4, false), rims = mk(wheels.rim, rimMat, list.length * 4, false)
  rims.userData.noAO = true
  // Pools of headlight on the road, and the dark under each car.
  const poolGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const pools = new InstancedMesh(poolGeo, new MeshBasicMaterial({ map: beamMap(), transparent: true, blending: AdditiveBlending, depthWrite: false, color: '#ffffff' }), list.length)
  pools.frustumCulled = false; pools.userData.noAO = true; pools.renderOrder = 1
  const blobs = new InstancedMesh(poolGeo, new MeshBasicMaterial({ map: blobMap(), color: '#000000', transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), list.length)
  blobs.frustumCulled = false; blobs.userData.noAO = true
  for (let k = 0; k < list.length; k++) pools.setColorAt(k, new Color(0, 0, 0))
  group.add(pools, blobs)

  const base = new Matrix4(), bodyM = new Matrix4(), tmp = new Matrix4(), q = new Quaternion(), e = new Euler(0, 0, 0, 'YZX'), v = new Vector3(), one = new Vector3(1, 1, 1)
  const col = new Color(), none = new Matrix4().makeScale(0, 0, 0)
  let lit = false
  const bodies: Matrix4[] = list.map(() => new Matrix4())
  return {
    group,
    /** Each car's body, as placed last (for anything riding in it). */
    body: (k: number) => bodies[k],
    /** A car placed this frame; near (the camera), its cabin and plates too (further off nobody could make them out). */
    set(k: number, p: Pose, near = true) {
      const model = list[k].model, S = MODELS[model], st = sets.get(model)!, i = slot[k]
      e.set(p.roll, p.yaw, p.pitch, 'YZX'); q.setFromEuler(e)
      base.compose(v.set(p.x, p.y, p.z), q, one)
      // The body on its springs, rocking about a point at about its middle's height.
      const cgY = S.tall * 0.38 * METRE
      e.set(p.lean, 0, p.dive, 'YZX'); q.setFromEuler(e)
      tmp.compose(v.set(0, p.bob + cgY, 0), q, one)
      bodyM.multiplyMatrices(base, tmp).multiply(tmp.makeTranslation(0, -cgY, 0))
      bodies[k].copy(bodyM)
      st.paint.setMatrixAt(i, bodyM); st.rest.forEach((r, n) => r.setMatrixAt(i, near || n === 0 || n === 1 ? bodyM : none))
      st.head.setMatrixAt(i, bodyM); st.tail.setMatrixAt(i, bodyM)
      // Lamps: headlights white, tail lights red, brighter braking; reversing lamps whiten the tail.
      st.head.setColorAt(i, col.setRGB(1, 1.02, 1.06).multiplyScalar(0.12 * p.on + 1.9 * p.head))
      st.tail.setColorAt(i, col.setRGB(1, 0.06, 0.08).multiplyScalar(1.1 * p.tail + 4.5 * p.brake).add(new Color(1, 1, 1).multiplyScalar(2.5 * p.reverse)))
      // The wheels: at the axles, turned by the steering in front, rolling.
      const sc = S.wheel / 0.315
      for (let w = 0; w < 4; w++) {
        const ax = w < 2 ? S.front : S.rear, sd = w % 2 ? 1 : -1
        e.set(0, (w < 2 ? p.steer : 0) + (sd < 0 ? Math.PI : 0), sd < 0 ? p.spin : -p.spin, 'YXZ'); q.setFromEuler(e)
        tmp.compose(v.set(ax * METRE, S.wheel * METRE, (sd * S.track * METRE) / 2), q, v.clone().set(sc, sc, sc))
        tmp.premultiply(base)
        tyres.setMatrixAt(k * 4 + w, tmp); rims.setMatrixAt(k * 4 + w, tmp)
      }
      // The pool of light ahead, and the shadow under it.
      tmp.compose(v.set((S.len / 2 + 5) * METRE, 0.04 * METRE, 0), q.identity(), v.clone().set(10 * METRE, 1, 7 * METRE)).premultiply(base)
      pools.setMatrixAt(k, p.head > 0.01 ? tmp : none); pools.setColorAt(k, col.setRGB(0.9, 0.93, 1).multiplyScalar(0.07 * p.head))
      if (p.head > 0.01) lit = true
      tmp.compose(v.set(0, 0.03 * METRE, 0), q.identity(), v.clone().set((S.len + 0.7) * METRE, 1, (S.wid + 0.6) * METRE)).premultiply(base)
      blobs.setMatrixAt(k, tmp)
    },
    /** After setting every car this frame: send them to the graphics card. */
    done() {
      for (const st of sets.values()) {
        for (const im of [st.paint, ...st.rest, st.head, st.tail]) im.instanceMatrix.needsUpdate = true
        st.head.instanceColor!.needsUpdate = true; st.tail.instanceColor!.needsUpdate = true
      }
      tyres.instanceMatrix.needsUpdate = true; rims.instanceMatrix.needsUpdate = true
      pools.instanceMatrix.needsUpdate = true; pools.instanceColor!.needsUpdate = true; blobs.instanceMatrix.needsUpdate = true
      // (By day no headlight is on: the pools are not drawn at all.)
      pools.visible = lit; lit = false
    },
    /** Shown at all (a car you have not got yet is hidden by a zero scale). */
    hide(k: number) {
      const model = list[k].model, st = sets.get(model)!, i = slot[k], z = new Matrix4().makeScale(0, 0, 0)
      for (const im of [st.paint, ...st.rest, st.head, st.tail]) im.setMatrixAt(i, z)
      for (let w = 0; w < 4; w++) { tyres.setMatrixAt(k * 4 + w, z); rims.setMatrixAt(k * 4 + w, z) }
      pools.setMatrixAt(k, z); blobs.setMatrixAt(k, z)
    },
  }
}

// (A throwaway pairing of a geometry and a material, before it becomes instanced.)
class Mesh2 { readonly geometry: BufferGeometry; readonly material: Material; constructor(g: BufferGeometry, m: Material) { this.geometry = g; this.material = m } }
