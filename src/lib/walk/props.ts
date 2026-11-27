/**
 * Things that move on the walk (walker.ts): footballs on the grass, beach
 * balls on the sand, crates and fish boxes stacked on the harbour quay,
 * traffic cones along a kerb — each a rigid body you can push, kick, knock
 * over, drive into, that tumbles and rolls and comes to rest, and floats.
 *
 * The physics is cannon-es (a rigid-body engine), run in metres: each thing
 * has its real mass (a football 430 g, a crate 9 kg, a cone 2 kg weighted at
 * its rubber base) and its real shape (a sphere; a box; a cone on its square
 * base), and meets the island's own ground (a height field of it round where
 * they are), everything built (its walls, as boxes), and each other — a ball
 * bounces well off the street, a crate hardly, friction sets a ball rolling
 * and tips a crate over its edge, stacks stand until knocked. Still for a
 * moment, a thing sleeps until something touches it. In the water it floats
 * as much as it weighs against what it pushes aside (a ball high, a crate
 * low, a cone barely), and the water slows it.
 *
 * You are a body in it too (70 kg, upright: you push a crate along slower
 * than you walk, you stop short against a stack, a ball met at a run you
 * kick on); a car is one that nothing stops.
 */
import { Body as CBody, Box as CBox, Cylinder, Heightfield, Material, ContactMaterial, Quaternion as CQuat, Sphere, Vec3, World, SAPBroadphase } from 'cannon-es'
import {
  BoxGeometry, Color, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3,
  type BufferGeometry, type Scene,
} from 'three'
import { METRE } from './body'
import { Bag, place, seeded } from './kit'

type Box = { i0: number; i1: number; j0: number; j1: number; z0: number; z1: number }
export type PropKind = 'football' | 'beachball' | 'crate' | 'fishbox' | 'cone'
const M = METRE

/* ---- the shapes ---- */
function football() {
  // Twelve black pentagons round the white: the faces of a fine icosphere near each of the icosahedron's corners.
  const g = new IcosahedronGeometry(1, 4), P = g.getAttribute('position')
  const corners = new IcosahedronGeometry(1, 0).getAttribute('position')
  const cs: Vector3[] = []
  for (let i = 0; i < corners.count; i++) { const v = new Vector3().fromBufferAttribute(corners, i).normalize(); if (!cs.some((c) => c.distanceTo(v) < 1e-3)) cs.push(v) }
  const col: number[] = [], a = new Vector3(), b = new Vector3(), c = new Vector3()
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2)
    const mid = a.clone().add(b).add(c).normalize()
    const black = cs.some((v) => v.angleTo(mid) < 0.3)
    for (let k = 0; k < 3; k++) col.push(...(black ? [0.06, 0.06, 0.07] : [0.95, 0.95, 0.94]))
  }
  const bag = new Bag(); bag.add(g)
  bag.c = col
  return bag.geometry(1)
}
function beachball() {
  // Six gores, white caps at the poles.
  const g = new SphereGeometry(1, 24, 16).toNonIndexed(), P = g.getAttribute('position')
  const gores = [new Color('#d8333a'), new Color('#f2f4f7'), new Color('#2f6df6'), new Color('#f2f4f7'), new Color('#1f9e8f'), new Color('#f2f4f7')]
  const col: number[] = [], a = new Vector3(), b = new Vector3(), c = new Vector3()
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2)
    const mid = a.clone().add(b).add(c).divideScalar(3)
    const k = Math.floor(((Math.atan2(mid.z, mid.x) + Math.PI) / (Math.PI * 2)) * 6) % 6
    const cc = Math.abs(mid.y) > 0.93 ? new Color('#f2f4f7') : gores[k]
    for (let n = 0; n < 3; n++) col.push(cc.r, cc.g, cc.b)
  }
  const bag = new Bag(); bag.add(g); bag.c = col
  return bag.geometry(1)
}
/** A slatted wooden crate (or a moulded fish box), size in metres. */
function crate(w: number, h: number, d: number, fish: boolean) {
  const bag = new Bag()
  if (fish) {
    const blue = new Color('#2b5f95'), dark = new Color('#20476f')
    bag.add(new BoxGeometry(w, 0.04, d), place(0, -h / 2 + 0.02, 0), dark)
    for (const s of [-1, 1]) { bag.add(new BoxGeometry(0.03, h, d), place(s * (w / 2 - 0.015), 0, 0), blue); bag.add(new BoxGeometry(w, h, 0.03), place(0, 0, s * (d / 2 - 0.015)), blue) }
    // Hand-holes, and the rim.
    for (const s of [-1, 1]) bag.add(new BoxGeometry(0.035, 0.04, 0.12), place(s * (w / 2 - 0.012), h / 2 - 0.07, 0), new Color('#10233a'))
    for (const s of [-1, 1]) { bag.add(new BoxGeometry(w + 0.02, 0.025, 0.04), place(0, h / 2 - 0.012, s * (d / 2 - 0.01)), blue); bag.add(new BoxGeometry(0.04, 0.025, d + 0.02), place(s * (w / 2 - 0.01), h / 2 - 0.012, 0), blue) }
    return bag.geometry()
  }
  const wood = [new Color('#a5835e'), new Color('#9a7752'), new Color('#b08d67'), new Color('#8f6e4c')], post = new Color('#7d5f40')
  const rnd = seeded(Math.round(w * 100 + h * 10))
  // Corner posts; slats on each side with gaps; a solid base.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bag.add(new BoxGeometry(0.05, h, 0.05), place(sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025)), post)
  const n = Math.max(3, Math.round(h / 0.09))
  for (let k = 0; k < n; k++) {
    const y = -h / 2 + (h / n) * (k + 0.5), sh = (h / n) * 0.72
    for (const s of [-1, 1]) {
      bag.add(new BoxGeometry(w - 0.02, sh, 0.018), place(0, y, s * (d / 2 - 0.009)), wood[Math.floor(rnd() * 4)])
      bag.add(new BoxGeometry(0.018, sh, d - 0.02), place(s * (w / 2 - 0.009), y, 0), wood[Math.floor(rnd() * 4)])
    }
  }
  bag.add(new BoxGeometry(w - 0.02, 0.02, d - 0.02), place(0, -h / 2 + 0.01, 0), wood[1])
  return bag.geometry()
}
/** A traffic cone, 50 cm: a square rubber base, the red cone with two white reflective bands. */
function cone() {
  const bag = new Bag(), red = new Color('#cf2e36'), white = new Color('#eef0f2'), base = new Color('#1b1c1f')
  const h = 0.5, c = CONE_C
  bag.add(new BoxGeometry(0.32, 0.03, 0.32), place(0, 0.015 - c, 0), base)
  const seg = (y0: number, y1: number, col: Color) => { const r = (y: number) => 0.13 * (1 - y / h) + 0.02; bag.add(new CylinderGeometry(r(y1), r(y0), y1 - y0, 18, 1, true), place(0, (y0 + y1) / 2 - c, 0), col) }
  seg(0.03, 0.2, red); seg(0.2, 0.26, white); seg(0.26, 0.32, red); seg(0.32, 0.37, white); seg(0.37, h - 0.01, red)
  bag.add(new TorusGeometry(0.02, 0.008, 4, 10), place(0, h - 0.01 - c, 0, Math.PI / 2), red)
  return bag.geometry()
}
/** A cone's middle of mass, above its base (its rubber base is heavy). */
const CONE_C = 0.13

export function toys(scene: Scene, o: {
  heightAt(x: number, z: number): number; boxes: Box[]; seaY: number
  /** Water's surface at a point (the sea's or the stream's), if there is water there. */
  waterAt(x: number, z: number): number | null
  kind(i: number, j: number): string; roads: [number, number][]; start: { x: number; z: number }; piers: [number, number][][]; seed?: number
}) {
  const rnd = seeded(o.seed ?? 17)
  // What is built, filed by tile, for each body to look for near it.
  const near = new Map<number, Box[]>()
  for (const b of o.boxes) for (let i = Math.floor(b.i0); i <= Math.floor(b.i1); i++) for (let j = Math.floor(b.j0); j <= Math.floor(b.j1); j++) { const k = i * 1000 + j; if (!near.has(k)) near.set(k, []); near.get(k)!.push(b) }
  const boxesNear = (x: number, z: number) => { const out = new Set<Box>(); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const B of near.get((Math.floor(z) + a) * 1000 + Math.floor(x) + b) ?? []) out.add(B); return out }
  const ground = (x: number, z: number) => o.heightAt(x, z)

  type Prop = { kind: PropKind; p: Vector3; q: Quaternion; mass: number; reach: number; floats: number; knockT: number; c?: CBody }
  const bodies: Prop[] = []
  const add = (kind: PropKind, x: number, y: number, z: number, yaw = 0) => {
    const mass = kind === 'football' ? 0.43 : kind === 'beachball' ? 0.12 : kind === 'crate' ? 9 : kind === 'fishbox' ? 3 : 2
    const reach = (kind === 'football' ? 0.11 : kind === 'beachball' ? 0.2 : 0.42) * M
    const floats = kind === 'football' ? 0.2 : kind === 'beachball' ? 0.05 : kind === 'crate' ? 0.55 : kind === 'fishbox' ? 0.4 : 0.8
    const b: Prop = { kind, p: new Vector3(x, y, z), q: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw), mass, reach, floats, knockT: 0 }
    bodies.push(b)
    return b
  }
  /** The height a body rests at on the ground (its lowest point on it). */
  const restY = (kind: PropKind, x: number, z: number) => ground(x, z) + (kind === 'football' ? 0.11 * M : kind === 'beachball' ? 0.2 * M : kind === 'crate' ? 0.21 * M : kind === 'fishbox' ? 0.13 * M : CONE_C * M)

  /* ---- where they are ---- */
  const roads = new Set(o.roads.map(([i, j]) => i * 1000 + j))
  const clear = (x: number, z: number, r: number) => {
    const g = ground(x, z)
    for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r], [0, 0]]) { if (Math.abs(ground(x + a, z + b) - g) > 0.004) return false; if (o.waterAt(x + a, z + b) !== null && o.waterAt(x + a, z + b)! > ground(x + a, z + b)) return false }
    for (const B of boxesNear(x, z)) if (B.z1 > g + 0.01 && B.z0 < g + 0.2 && x + r > B.j0 && x - r < B.j1 && z + r > B.i0 && z - r < B.i1) return false
    return true
  }
  /** Somewhere free of a kind (grass, sand), near a point. */
  const findSpot = (want: (i: number, j: number) => boolean, from: { x: number; z: number }, maxD: number, r: number) => {
    for (let tries = 0; tries < 900; tries++) {
      const a = rnd() * Math.PI * 2, d = 1 + rnd() * maxD, x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d
      const i = Math.floor(z), j = Math.floor(x)
      if (!want(i, j) || !clear(x, z, r) || bodies.some((b) => Math.hypot(b.p.x - x, b.p.z - z) < 0.5)) continue
      return { x, z }
    }
    return null
  }
  const grass = (i: number, j: number) => o.kind(i, j) === '1' && !roads.has(i * 1000 + j)
  const sand = (i: number, j: number) => o.kind(i, j) === 'b' && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => o.kind(i + a, j + b) === '1' || o.kind(i + a, j + b) === 'b')
  for (let k = 0; k < 3; k++) { const s = findSpot(grass, o.start, 2 + k * 2, 0.05); if (s) add('football', s.x, restY('football', s.x, s.z), s.z) }
  for (let k = 0; k < 3; k++) { const s = findSpot(sand, k === 0 ? o.start : { x: 22, z: 24 }, 6 + k * 3, 0.06); if (s) add('beachball', s.x, restY('beachball', s.x, s.z), s.z) }
  // Crates and fish boxes on the quay by the harbour pier: two stacks, a few left about.
  const harbour = o.piers[o.piers.length - 1]?.[0] ?? [25.5, 19.6]
  for (let k = 0; k < 2; k++) {
    const s = findSpot((i, j) => o.kind(i, j) !== '0', { x: harbour[1], z: harbour[0] }, 1.2 + k, 0.12)
    if (!s) continue
    const yaw = rnd() * 0.3, cs = Math.cos(yaw), sn = Math.sin(yaw)
    if (k === 0) {
      // Two crates side by side, a third on top.
      const y0 = restY('crate', s.x, s.z)
      for (const off of [-0.31, 0.31]) add('crate', s.x + cs * off * M, y0, s.z - sn * off * M, yaw)
      add('crate', s.x, y0 + 0.42 * M + 0.0005, s.z, yaw + 0.05)
    } else {
      // Fish boxes, four high.
      const y0 = restY('fishbox', s.x, s.z)
      for (let n = 0; n < 4; n++) add('fishbox', s.x, y0 + n * 0.26 * M + n * 0.0004, s.z, yaw + (rnd() - 0.5) * 0.06)
    }
  }
  for (let k = 0; k < 2; k++) { const s = findSpot((i, j) => o.kind(i, j) !== '0', { x: harbour[1], z: harbour[0] }, 2.5, 0.07); if (s) add('crate', s.x, restY('crate', s.x, s.z), s.z, rnd() * 3) }
  // Cones along a kerb near you: a row on the pavement of a straight street.
  {
    const DX = [0, 0, -1, 1], DZ = [-1, 1, 0, 0]
    const straight = o.roads.filter(([i, j]) => (roads.has((i - 1) * 1000 + j) && roads.has((i + 1) * 1000 + j) && !roads.has(i * 1000 + j - 1) && !roads.has(i * 1000 + j + 1)) || (roads.has(i * 1000 + j - 1) && roads.has(i * 1000 + j + 1) && !roads.has((i - 1) * 1000 + j) && !roads.has((i + 1) * 1000 + j)))
      .sort((a, b) => Math.hypot(a[1] + 0.5 - o.start.x, a[0] + 0.5 - o.start.z) - Math.hypot(b[1] + 0.5 - o.start.x, b[0] + 0.5 - o.start.z))
    for (const [i, j] of straight.slice(1, 6)) {
      const ns = roads.has((i - 1) * 1000 + j)
      // (On the pavement edge, by the kerb: 0.3 of a tile out from the middle of the road.)
      const side = rnd() < 0.5 ? 1 : -1, pts: [number, number][] = []
      for (let n = 0; n < 4; n++) { const t = -0.3 + n * 0.2; pts.push(ns ? [j + 0.5 + side * 0.3, i + 0.5 + t] : [j + 0.5 + t, i + 0.5 + side * 0.3]) }
      if (!pts.every(([x, z]) => clear(x, z, 0.02))) continue
      for (const [x, z] of pts) add('cone', x, restY('cone', x, z), z, rnd() * 6)
      void DX; void DZ
      break
    }
  }

  /* ---- drawing them ---- */
  const geos: Record<PropKind, BufferGeometry> = {
    football: (() => { const g = football(); g.scale(0.11 * M, 0.11 * M, 0.11 * M); return g })(),
    beachball: (() => { const g = beachball(); g.scale(0.2 * M, 0.2 * M, 0.2 * M); return g })(),
    crate: crate(0.6, 0.42, 0.42, false), fishbox: crate(0.7, 0.26, 0.42, true), cone: cone(),
  }
  const meshes = {} as Record<PropKind, InstancedMesh>
  for (const k of Object.keys(geos) as PropKind[]) {
    const n = bodies.filter((b) => b.kind === k).length
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: k === 'football' ? 0.45 : k === 'beachball' ? 0.25 : k === 'cone' ? 0.5 : 0.85 })
    const m = new InstancedMesh(geos[k], mat, Math.max(1, n)); m.count = n; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.name = `props-${k}`
    meshes[k] = m; scene.add(m)
  }
  const mx = new Matrix4(), one = new Vector3(1, 1, 1)
  const draw = () => {
    const at: Record<string, number> = {}
    for (const b of bodies) { const k = at[b.kind] = (at[b.kind] ?? -1) + 1; meshes[b.kind].setMatrixAt(k, mx.compose(b.p, b.q, one)) }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true
  }
  draw()

  /* ---- the physics, in metres (world units ÷ METRE) ---- */
  const world = new World({ gravity: new Vec3(0, -9.8, 0) })
  world.broadphase = new SAPBroadphase(world)
  world.allowSleep = true
  ;(world.solver as unknown as { iterations: number }).iterations = 12
  const WORLD = 1, PROP = 2, YOU = 4, CAR = 8
  const mats = { ground: new Material('ground'), ball: new Material('ball'), crate: new Material('crate'), cone: new Material('cone'), you: new Material('you') }
  const pair = (a: Material, b: Material, friction: number, restitution: number) => world.addContactMaterial(new ContactMaterial(a, b, { friction, restitution }))
  pair(mats.ball, mats.ground, 0.5, 0.62); pair(mats.crate, mats.ground, 0.55, 0.05); pair(mats.cone, mats.ground, 0.6, 0.15)
  pair(mats.crate, mats.crate, 0.6, 0.02); pair(mats.ball, mats.crate, 0.4, 0.5); pair(mats.ball, mats.ball, 0.3, 0.7); pair(mats.cone, mats.crate, 0.5, 0.1); pair(mats.cone, mats.cone, 0.5, 0.2); pair(mats.ball, mats.cone, 0.4, 0.5)
  pair(mats.you, mats.crate, 0.3, 0); pair(mats.you, mats.cone, 0.3, 0); pair(mats.you, mats.ball, 0.2, 0.3)
  const toM = (v: number) => v / M

  // The ground round where things are: height fields a thirty-second of a tile (28 cm) apart, and the walls built there.
  const S = 1 / 32
  const regions: { x0: number; z0: number; x1: number; z1: number }[] = []
  for (const b of bodies) {
    const r = { x0: Math.floor(b.p.x) - 4, z0: Math.floor(b.p.z) - 4, x1: Math.floor(b.p.x) + 5, z1: Math.floor(b.p.z) + 5 }
    const hit = regions.find((q) => r.x0 <= q.x1 && r.x1 >= q.x0 && r.z0 <= q.z1 && r.z1 >= q.z0)
    if (hit) { hit.x0 = Math.min(hit.x0, r.x0); hit.z0 = Math.min(hit.z0, r.z0); hit.x1 = Math.max(hit.x1, r.x1); hit.z1 = Math.max(hit.z1, r.z1) } else regions.push(r)
  }
  const inRegion = (x: number, z: number) => regions.some((q) => x > q.x0 + 0.1 && x < q.x1 - 0.1 && z > q.z0 + 0.1 && z < q.z1 - 0.1)
  for (const q of regions) {
    const nx = Math.round((q.x1 - q.x0) / S) + 1, nz = Math.round((q.z1 - q.z0) / S) + 1
    const data: number[][] = []
    for (let i = 0; i < nx; i++) { const row: number[] = []; for (let j = 0; j < nz; j++) row.push(toM(ground(q.x0 + i * S, q.z1 - j * S))); data.push(row) }
    const hf = new Heightfield(data, { elementSize: toM(S) })
    const body = new CBody({ mass: 0, material: mats.ground, collisionFilterGroup: WORLD, collisionFilterMask: PROP })
    body.addShape(hf)
    // (Its rows run along x, its columns up its own y, which, laid flat, runs back towards −z.)
    body.position.set(toM(q.x0), 0, toM(q.z1))
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    world.addBody(body)
    const seen = new Set<Box>()
    for (let i = q.z0; i <= q.z1; i++) for (let j = q.x0; j <= q.x1; j++) for (const B of near.get(i * 1000 + j) ?? []) {
      if (seen.has(B)) continue
      seen.add(B)
      const sb = new CBody({ mass: 0, material: mats.ground, collisionFilterGroup: WORLD, collisionFilterMask: PROP })
      sb.addShape(new CBox(new Vec3(toM(B.j1 - B.j0) / 2, toM(B.z1 - B.z0) / 2, toM(B.i1 - B.i0) / 2)))
      sb.position.set(toM((B.j0 + B.j1) / 2), toM((B.z0 + B.z1) / 2), toM((B.i0 + B.i1) / 2))
      world.addBody(sb)
    }
  }
  const knocks: { kind: PropKind; at: Vector3; hard: number }[] = []
  // The things themselves.
  for (const b of bodies) {
    const c = new CBody({ mass: b.mass, collisionFilterGroup: PROP, collisionFilterMask: WORLD | PROP | YOU | CAR, allowSleep: true, sleepSpeedLimit: 0.08, sleepTimeLimit: 0.6 })
    if (b.kind === 'football' || b.kind === 'beachball') {
      c.addShape(new Sphere(b.kind === 'football' ? 0.11 : 0.2)); c.material = mats.ball; c.linearDamping = 0.04; c.angularDamping = 0.3
    } else if (b.kind === 'crate' || b.kind === 'fishbox') {
      const [w, h, d] = b.kind === 'crate' ? [0.6, 0.42, 0.42] : [0.7, 0.26, 0.42]
      c.addShape(new CBox(new Vec3(w / 2, h / 2, d / 2))); c.material = mats.crate; c.linearDamping = 0.05; c.angularDamping = 0.1
    } else {
      // A cone on its base: the middle of mass low, where the heavy rubber is.
      c.addShape(new Cylinder(0.025, 0.15, 0.46, 10), new Vec3(0, 0.03 + 0.23 - CONE_C, 0)); c.addShape(new CBox(new Vec3(0.16, 0.015, 0.16)), new Vec3(0, 0.015 - CONE_C, 0))
      c.material = mats.cone; c.linearDamping = 0.05; c.angularDamping = 0.15
    }
    c.position.set(toM(b.p.x), toM(b.p.y), toM(b.p.z)); c.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w)
    world.addBody(c)
    c.sleep()
    b.c = c
    c.addEventListener('collide', (e: { contact: { getImpactVelocityAlongNormal(): number } }) => {
      const hard = Math.abs(e.contact.getImpactVelocityAlongNormal())
      if (hard > 0.6 && b.knockT <= 0) { b.knockT = 0.08; knocks.push({ kind: b.kind, at: b.p.clone(), hard }) }
    })
  }
  // You: upright, 70 kg, touching only the things (the walk keeps you to the ground and the walls).
  const youBody = new CBody({ mass: 70, fixedRotation: true, collisionFilterGroup: YOU, collisionFilterMask: PROP, material: mats.you, linearDamping: 0, allowSleep: false })
  youBody.addShape(new Cylinder(0.25, 0.25, 1.75, 10))
  youBody.position.set(0, -1000, 0)
  world.addBody(youBody)
  // Cars near: boxes that go where they go.
  const carBodies = Array.from({ length: 6 }, () => {
    const cb = new CBody({ mass: 0, type: CBody.KINEMATIC, collisionFilterGroup: CAR, collisionFilterMask: PROP, allowSleep: false })
    cb.addShape(new CBox(new Vec3(2.2, 0.65, 0.9))); cb.position.set(0, -1000, 0); world.addBody(cb)
    return cb
  })
  let kicked = 0

  const sync = () => {
    for (const b of bodies) { const c = b.c!; b.p.set(c.position.x * M, c.position.y * M, c.position.z * M); b.q.set(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w) }
    draw()
  }
  const cq = new CQuat()

  return {
    bodies,
    /**
     * Each frame: everything awake moves on; you and the cars push through it.
     * Returns your velocity, as pushing things has left it (world units a second; null if you are not on foot).
     */
    step(dt: number, c: { you: { x: number; y: number; z: number; vx: number; vz: number; running: boolean } | null; cars: { x: number; y: number; z: number; yaw: number; hl: number; hw: number; tall: number; vx: number; vz: number }[] }) {
      knocks.length = 0
      if (dt <= 0) return null
      const h = Math.min(dt, 1 / 20)
      kicked -= h
      for (const b of bodies) b.knockT -= h
      // You, where the walk has you, going where you are going.
      if (c.you) {
        youBody.position.set(toM(c.you.x), toM(c.you.y) + 0.875, toM(c.you.z))
        youBody.velocity.set(toM(c.you.vx), 0, toM(c.you.vz)); youBody.aabbNeedsUpdate = true
      } else { youBody.position.set(0, -1000, 0); youBody.velocity.set(0, 0, 0) }
      const want = c.you ? Math.hypot(youBody.velocity.x, youBody.velocity.z) : 0
      // The nearest cars.
      carBodies.forEach((cb, k) => {
        const car = c.cars[k]
        if (!car) { cb.position.set(0, -1000, 0); cb.velocity.set(0, 0, 0); return }
        const box = cb.shapes[0] as CBox, half = box.halfExtents
        if (Math.abs(half.x - toM(car.hl)) > 0.01 || Math.abs(half.z - toM(car.hw)) > 0.01) { half.set(toM(car.hl), toM(car.tall) / 2, toM(car.hw)); box.updateConvexPolyhedronRepresentation(); box.updateBoundingSphereRadius(); cb.updateBoundingRadius(); cb.aabbNeedsUpdate = true }
        cb.position.set(toM(car.x), toM(car.y + car.tall / 2), toM(car.z))
        cb.quaternion.copy(cq.setFromEuler(0, car.yaw, 0))
        cb.velocity.set(toM(car.vx), 0, toM(car.vz))
        // (Moved by hand: its bounds must be worked out again.)
        cb.aabbNeedsUpdate = true
      })
      // In the water: floating as it weighs against what it pushes aside, and slowed.
      for (const b of bodies) {
        const cb = b.c!
        if (cb.sleepState === CBody.SLEEPING) continue
        const surf = o.waterAt(b.p.x, b.p.z)
        if (surf === null) continue
        const r = toM(b.reach) * 0.8, depth = toM(surf) - (cb.position.y - r), sub = Math.max(0, Math.min(1, depth / (2 * r)))
        if (sub <= 0) continue
        cb.applyForce(new Vec3(0, (9.8 * cb.mass / b.floats) * sub, 0))
        cb.velocity.scale(1 - Math.min(1, 1.6 * sub * h), cb.velocity); cb.angularVelocity.scale(1 - Math.min(1, 2 * sub * h), cb.angularVelocity)
      }
      world.step(1 / 120, h, 6)
      // Off the edge of the ground the physics knows: the island's own ground, simply.
      for (const b of bodies) {
        const cb = b.c!
        if (cb.sleepState === CBody.SLEEPING) continue
        const x = cb.position.x * M, z = cb.position.z * M
        if (!inRegion(x, z)) {
          const g = toM(ground(x, z)) + toM(b.reach) * 0.6
          if (cb.position.y < g) { cb.position.y = g; if (cb.velocity.y < 0) cb.velocity.y *= -0.3; cb.velocity.x *= 0.98; cb.velocity.z *= 0.98 }
        }
        if (cb.position.y < toM(o.seaY) - 30) cb.sleep()
      }
      sync()
      // A ball you run into, you kick on (a touch walking, a real kick running).
      let out: { vx: number; vz: number } | null = null
      if (c.you) {
        for (const b of bodies) {
          if (b.kind !== 'football' && b.kind !== 'beachball') continue
          const dx = b.p.x - c.you.x, dz = b.p.z - c.you.z, d = Math.hypot(dx, dz), sp = Math.hypot(c.you.vx, c.you.vz)
          if (d < 0.25 * M + b.reach + 0.004 && b.p.y < c.you.y + 0.6 * M && sp > 0.5 * M && kicked <= 0 && dx * c.you.vx + dz * c.you.vz > 0) {
            kicked = 0.4
            const k = toM(sp) * (c.you.running ? 2.0 : 1.3) * (b.kind === 'beachball' ? 0.7 : 1)
            b.c!.wakeUp(); b.c!.velocity.set((dx / d) * k, k * (c.you.running ? 0.35 : 0.12), (dz / d) * k)
            b.c!.angularVelocity.set((dz / d) * k * 6, 0, -(dx / d) * k * 6)
            knocks.push({ kind: b.kind, at: b.p.clone(), hard: k })
          }
        }
        // (What you pushed against held you back: your speed as the contacts left it, never faster than you meant.)
        const got = Math.hypot(youBody.velocity.x, youBody.velocity.z), k = want > 1e-6 ? Math.min(1, got / want) : 1
        out = { vx: c.you.vx * k, vz: c.you.vz * k }
      }
      return out
    },
    /** What was hit this frame, and how hard (m/s), for the sound. */
    knocks: () => knocks,
    state: () => bodies.map((b) => ({ kind: b.kind, x: b.p.x, y: b.p.y, z: b.p.z, asleep: b.c!.sleepState === CBody.SLEEPING, up: new Vector3(0, 1, 0).applyQuaternion(b.q).y, v: b.c!.velocity.length() })),
    dispose() { for (const m of Object.values(meshes)) { scene.remove(m); m.geometry.dispose(); (m.material as MeshStandardMaterial).dispose() } },
  }
}
