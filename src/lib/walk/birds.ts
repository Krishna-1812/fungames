/**
 * The island's gulls (walker.ts).
 *
 * Herring gulls, at their real size (60 cm long, a wingspan of a metre and a
 * half): white, with pale grey backs and wings, the wingtips black with their
 * white "mirrors", a yellow bill, pink legs. Some ride the air over the
 * harbour and the coast, circling high on still wings, banking into each
 * turn and now and then beating them to climb; others stand about — on the
 * sea rocks, along the piers, on the lamp posts by the sea, down on the
 * sand — or sit on the water, rising and falling on the swell. Go too near
 * one standing (on foot, closer than about three metres; in a car, rather
 * further) and it is off: a run of hard wingbeats, up and away, to join the
 * others circling; and every so often one of those comes down to a free
 * perch, gliding in, wings raised and spread to brake, legs down, and folds
 * its wings on landing. At night they settle, all of them.
 *
 * A gull in the air is drawn in five parts — the body, and each wing in two,
 * the arm and the hand, so a wingbeat bends at the wrist — one draw each for
 * the whole flock; a gull at rest is one shape, its wings folded along its back.
 */
import { CapsuleGeometry, Color, CylinderGeometry, Euler, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, DoubleSide, type BufferGeometry, type Scene } from 'three'
import { METRE } from './body'
import { Bag, curve, loft, place, seeded } from './kit'

type Box = { i0: number; i1: number; j0: number; j1: number; z0: number; z1: number }

const WHITE = new Color('#f4f5f6'), GREY = new Color('#a9b2bb'), TIP = new Color('#17191c'), MIRROR = new Color('#e9ebed'), BILL = new Color('#e2c351'), LEG = new Color('#d9a3a0'), EYE = new Color('#d8d2a2'), PUPIL = new Color('#121212'), UNDER = new Color('#e6e9ec'), UNDERTIP = new Color('#3b3e43')

/** The body, beak to tail along +z (metres; its middle at the origin). */
function bodyShape(bag: Bag, folded: boolean) {
  const r = curve([[0, 0.012], [0.08, 0.035], [0.3, 0.07], [0.5, 0.078], [0.66, 0.06], [0.74, 0.042], [0.8, 0.046], [0.86, 0.044], [0.9, 0.03], [0.93, 0.012], [1, 0.003]])
  const lift = curve([[0, 0.01], [0.5, 0], [0.7, 0.03], [0.8, 0.065], [0.9, 0.07], [1, 0.062]])
  const K = 12
  loft(bag, 26, (t) => {
    const z = -0.32 + t * 0.62, rr = r(t), y0 = lift(t)
    return Array.from({ length: K }, (_, k) => { const a = (k / K) * Math.PI * 2; return new Vector3(Math.sin(a) * rr * (t < 0.3 ? 1.3 - t : 1), y0 + Math.cos(a) * rr * 0.9, z) })
  }, (t, k) => {
    if (t > 0.9) return BILL
    // The mantle (grey) between the wings on the back.
    const top = k <= 2 || k >= K - 2
    return top && t > 0.15 && t < 0.72 ? GREY : WHITE
  }, { closed: true, capStart: true, capEnd: true })
  // Eyes.
  for (const s of [-1, 1]) { bag.add(new SphereGeometry(0.009, 6, 5), place(s * 0.036, 0.083, 0.205), EYE); bag.add(new SphereGeometry(0.005, 5, 4), place(s * 0.042, 0.084, 0.207), PUPIL) }
  if (folded) {
    // The wings folded along the back, the black primaries crossed over the tail.
    for (const s of [-1, 1]) {
      bag.add(new CapsuleGeometry(0.045, 0.3, 3, 8), place(s * 0.058, 0.035, -0.05, Math.PI / 2 - 0.12, s * 0.06, 0, 0.55, 1, 0.75), GREY)
      bag.add(new CapsuleGeometry(0.02, 0.17, 3, 6), place(s * 0.03, 0.045, -0.3, Math.PI / 2 - 0.1, -s * 0.1, 0, 1.1, 1, 0.45), TIP)
      bag.add(new SphereGeometry(0.012, 5, 4), place(s * 0.03, 0.05, -0.37), MIRROR)
    }
    // Legs and webbed feet.
    for (const s of [-1, 1]) {
      bag.add(new CylinderGeometry(0.006, 0.007, 0.13, 5), place(s * 0.035, -0.125, -0.01), LEG)
      bag.add(new CylinderGeometry(0.03, 0.03, 0.006, 3), place(s * 0.035, -0.19, 0.02, 0, Math.PI, 0, 1, 1, 1.4), LEG)
    }
  }
}

/** A wing's half, as a thin cambered plate: span along +x (to the left wing's tip), chord along z. Mirrored for the right. */
function wingShape(bag: Bag, part: 'arm' | 'hand', side: number) {
  const span = part === 'arm' ? 0.29 : 0.44
  // Leading and trailing edges (z) along the span (u from root to tip).
  const le = part === 'arm' ? curve([[0, 0.07], [1, 0.085]]) : curve([[0, 0.085], [0.5, 0.05], [1, -0.07]])
  const te = part === 'arm' ? curve([[0, -0.13], [1, -0.1]]) : curve([[0, -0.1], [0.45, -0.13], [0.85, -0.15], [1, -0.08]])
  const top = (u: number, v: number) => {
    if (part === 'arm') return v > 0.88 ? WHITE : GREY
    if (u > 0.5) return u > 0.84 && u < 0.93 && v > 0.3 && v < 0.75 ? MIRROR : TIP
    return v > 0.9 && u < 0.4 ? WHITE : GREY
  }
  const bottom = (u: number) => (part === 'hand' && u > 0.55 ? UNDERTIP : UNDER)
  const U = 10, V = 4
  const P = (u: number, v: number, up: number) => {
    const x = u * span, a = le(u), b = te(u), z = a + (b - a) * v
    const thick = 0.006 * (1 - u * 0.7)
    // Camber: highest a third back from the leading edge; a rounded leading edge.
    const y = Math.sin(Math.min(1, v * 1.5) * Math.PI * 0.5) * 0.012 * (1 - u * 0.5) - v * 0.004 + up * thick * (1 - v)
    return new Vector3(side * x, y, z)
  }
  for (let a = 0; a < U; a++) for (let b = 0; b < V; b++) {
    const u0 = a / U, u1 = (a + 1) / U, v0 = b / V, v1 = (b + 1) / V
    const ct = top((u0 + u1) / 2, (v0 + v1) / 2), cb = bottom((u0 + u1) / 2)
    const t = [P(u0, v0, 1), P(u1, v0, 1), P(u1, v1, 1), P(u0, v1, 1)]
    const d = [P(u0, v0, -1), P(u1, v0, -1), P(u1, v1, -1), P(u0, v1, -1)]
    // (Wound to face up on top, down underneath, for either wing.)
    if (side < 0) { bag.tri(t[0], t[2], t[1], ct); bag.tri(t[0], t[3], t[2], ct); bag.tri(d[0], d[1], d[2], cb); bag.tri(d[0], d[2], d[3], cb) }
    else { bag.tri(t[0], t[1], t[2], ct); bag.tri(t[0], t[2], t[3], ct); bag.tri(d[0], d[2], d[1], cb); bag.tri(d[0], d[3], d[2], cb) }
  }
}

type Perch = { x: number; z: number; y: number; water: boolean; taken: boolean }
type Gull = {
  mode: 'soar' | 'land' | 'stand' | 'takeoff'
  x: number; y: number; z: number; yaw: number; pitch: number; bank: number; v: number; vy: number
  flap: number; flapping: number; wing: number; hand: number
  /** Its circle: the thermal it rides, how far out, its own place round it. */
  ring: number; rad: number; ang: number; alt: number
  perch: Perch | null; t: number; from: Vector3; timer: number; look: number; size: number
}

export function gulls(scene: Scene, o: {
  seaY: number; grid: number
  heightAt(x: number, z: number): number; seaAt(x: number, z: number): number; depthAt(x: number, z: number): number
  kind(i: number, j: number): string; boxes: Box[]; lamps: Vector3[]; piers: [number, number][][]; rocks: [number, number, number][]
  /** Circles in the air (tiles): over the harbour, off the coast. */
  rings: [number, number][]; count?: number; seed?: number
}) {
  const rnd = seeded(o.seed ?? 31)
  const M = METRE
  /** The top of whatever is at a point: the ground, a rock, a pier's deck. */
  const topAt = (x: number, z: number) => { let g = o.heightAt(x, z); for (const b of o.boxes) if (x > b.j0 && x < b.j1 && z > b.i0 && z < b.i1 && b.z1 > g && b.j1 - b.j0 < 2.5) g = b.z1; return g }
  const sea = (i: number, j: number) => o.kind(i, j) === '0'

  /* ---- where they stand ---- */
  const perches: Perch[] = []
  // The sea rocks' tops.
  for (const [i, j, k] of o.rocks) { const x = j + 0.5 + (rnd() - 0.5) * 0.1 * k, z = i + 0.5 + (rnd() - 0.5) * 0.1 * k; perches.push({ x, z, y: topAt(x, z), water: false, taken: false }) }
  // Along the piers.
  for (const pts of o.piers) for (let n = 0; n < 3; n++) {
    const [a, b] = [pts[0], pts[pts.length - 1]], f = 0.35 + n * 0.3
    const x = a[1] + (b[1] - a[1]) * f + (rnd() - 0.5) * 0.1, z = a[0] + (b[0] - a[0]) * f + (rnd() - 0.5) * 0.1
    const y = topAt(x, z); if (y > o.seaY + 0.05) perches.push({ x, z, y, water: false, taken: false })
  }
  // The lamps nearest the sea.
  for (const l of o.lamps) {
    const i = Math.floor(l.z), j = Math.floor(l.x)
    if ([[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]].some(([a, b]) => sea(i + a, j + b) || o.kind(i + a, j + b) === 'b') && rnd() < 0.6) perches.push({ x: l.x, z: l.z, y: l.y + 0.022, water: false, taken: false })
  }
  // The sand by the water, and the water itself.
  for (let i = 0; i < o.grid; i++) for (let j = 0; j < o.grid; j++) {
    if (o.kind(i, j) === 'b' && [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => sea(i + a, j + b)) && rnd() < 0.35) {
      for (let tries = 0; tries < 4; tries++) {
        const x = j + 0.15 + rnd() * 0.7, z = i + 0.15 + rnd() * 0.7, y = o.heightAt(x, z)
        if (y > o.seaY + 0.02 && Math.abs(topAt(x, z) - y) < 1e-4) { perches.push({ x, z, y, water: false, taken: false }); break }
      }
    }
    if (sea(i, j) && rnd() < 0.05) { const x = j + rnd(), z = i + rnd(); if (o.depthAt(x, z) > 0.15) perches.push({ x, z, y: o.seaY, water: true, taken: false }) }
  }

  // The tallest thing on each tile (the ground, or what is built on it), so a gull flying over keeps above it.
  const roofs = new Map<number, number>()
  for (const b of o.boxes) for (let i = Math.floor(b.i0); i <= Math.floor(b.i1); i++) for (let j = Math.floor(b.j0); j <= Math.floor(b.j1); j++) { const k = i * 1000 + j; roofs.set(k, Math.max(roofs.get(k) ?? -9, b.z1)) }
  const floorAt = (x: number, z: number) => Math.max(o.heightAt(x, z), o.seaY, roofs.get(Math.floor(z) * 1000 + Math.floor(x)) ?? -9)
  // And the highest of it round each tile (the hills, the towers), for a gull to keep above.
  const highs = new Map<number, number>()
  const highAt = (x: number, z: number) => {
    const i = Math.floor(z), j = Math.floor(x), k = i * 1000 + j
    let h = highs.get(k)
    if (h === undefined) { h = o.seaY; for (let a = -1; a <= 2; a++) for (let b = -1; b <= 2; b++) h = Math.max(h, floorAt(j + b * 0.99, i + a * 0.99)); highs.set(k, h) }
    return h
  }
  /** Whether a gull can glide in from where it is to a perch without going through anything on the way. */
  const clearTo = (g: Gull, p: Perch) => {
    for (let n = 1; n < 16; n++) {
      const f = n / 16, s = f * f * (3 - 2 * f)
      const x = g.x + (p.x - g.x) * s, z = g.z + (p.z - g.z) * s, y = g.y + (p.y - g.y) * Math.pow(s, 0.7) + Math.sin(f * Math.PI) * 0.15
      if (Math.hypot(p.x - x, p.z - z) < 0.2) continue
      if (y < floorAt(x, z) + 0.06) return false
    }
    return true
  }

  /* ---- the flock ---- */
  const N = o.count ?? 18
  const flock: Gull[] = []
  // The height each circle is flown at: well clear of whatever is under it.
  const ringAlt = o.rings.map(([i, j]) => { let top = o.seaY; for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) top = Math.max(top, topAt(j + 0.5 + b, i + 0.5 + a)); return top })
  for (let n = 0; n < N; n++) {
    const ring = n % o.rings.length
    const g: Gull = {
      mode: 'soar', x: 0, y: 0, z: 0, yaw: rnd() * 6.28, pitch: 0, bank: 0, v: 10 * M, vy: 0, flap: rnd() * 6.28, flapping: 0, wing: 0, hand: 0,
      ring, rad: (8 + rnd() * 14) * M, ang: rnd() * 6.28, alt: ringAlt[ring] + (14 + rnd() * 16) * M,
      perch: null, t: 0, from: new Vector3(), timer: 10 + rnd() * 50, look: 0, size: 0.92 + rnd() * 0.16,
    }
    const [ci, cj] = o.rings[ring]
    g.x = cj + 0.5 + Math.cos(g.ang) * g.rad; g.z = ci + 0.5 + Math.sin(g.ang) * g.rad; g.y = g.alt
    // Half of them start on a perch.
    if (n % 2 === 1) {
      const free = perches.filter((p) => !p.taken)
      if (free.length) { const p = free[Math.floor(rnd() * free.length)]; p.taken = true; g.perch = p; g.mode = 'stand'; g.x = p.x; g.z = p.z; g.y = p.y; g.v = 0; g.timer = 20 + rnd() * 80 }
    }
    flock.push(g)
  }

  /* ---- drawing them ---- */
  const geos: Record<string, BufferGeometry> = {
    body: (() => { const b = new Bag(); bodyShape(b, false); return b.geometry(1) })(),
    rest: (() => { const b = new Bag(); bodyShape(b, true); return b.geometry(1) })(),
    armL: (() => { const b = new Bag(); wingShape(b, 'arm', 1); return b.geometry(1) })(),
    armR: (() => { const b = new Bag(); wingShape(b, 'arm', -1); return b.geometry(1) })(),
    handL: (() => { const b = new Bag(); wingShape(b, 'hand', 1); return b.geometry(1) })(),
    handR: (() => { const b = new Bag(); wingShape(b, 'hand', -1); return b.geometry(1) })(),
  }
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })
  const wingMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: DoubleSide })
  const group = new Group(); group.name = 'gulls'
  const meshes: Record<string, InstancedMesh> = {}
  for (const [k, g] of Object.entries(geos)) {
    const m = new InstancedMesh(g, k.startsWith('arm') || k.startsWith('hand') ? wingMat : mat, N)
    m.frustumCulled = false; m.castShadow = true; m.count = 0; meshes[k] = m; group.add(m)
  }
  scene.add(group)

  const R = new Matrix4(), W1 = new Matrix4(), W2 = new Matrix4(), L = new Matrix4(), e = new Euler(), q = new Quaternion(), v = new Vector3(), sc = new Vector3(), one = new Vector3(1, 1, 1)
  const counts: Record<string, number> = Object.fromEntries(Object.keys(geos).map((k) => [k, 0]))
  const put = (k: string, m: Matrix4) => meshes[k].setMatrixAt(counts[k]++, m)
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

  const takeOff = (g: Gull, awayX: number, awayZ: number) => {
    if (g.perch) g.perch.taken = false
    g.perch = null; g.mode = 'takeoff'; g.t = 0; g.yaw = Math.atan2(awayX, awayZ) + (rnd() - 0.5) * 0.8; g.v = 1.5 * M; g.vy = 0
    g.ring = Math.floor(rnd() * o.rings.length); g.alt = ringAlt[g.ring] + (14 + rnd() * 16) * M; g.timer = 25 + rnd() * 60
  }

  let night = false
  return {
    group,
    /** Each frame: they fly, land and take off; those near enough are drawn. */
    update(dt: number, c: { cam: Vector3; you: { x: number; y: number; z: number }; driving: boolean; day: number; time: number; still: boolean }) {
      if (dt <= 0) return
      night = c.day < 0.2
      for (const k in counts) counts[k] = 0
      for (const g of flock) {
        if (g.mode === 'stand') {
          // On a perch: still, looking about now and then; the water's sitters ride the swell.
          if (g.perch!.water) g.y = o.seaAt(g.x, g.z)
          g.look -= dt
          if (g.look < 0) { g.look = 1.5 + rnd() * 5; g.yaw += (rnd() - 0.5) * 1.2 }
          const dx = g.x - c.you.x, dz = g.z - c.you.z, d = Math.hypot(dx, dz)
          if (d < (c.driving ? 0.9 : 0.3) && Math.abs(g.y - c.you.y) < 0.6) takeOff(g, dx, dz)
          else if (!night && (g.timer -= dt) < 0) takeOff(g, Math.sin(g.yaw), Math.cos(g.yaw))
        } else if (g.mode === 'takeoff') {
          // Hard wingbeats, running up off the perch and climbing away.
          g.t += dt; g.flapping = 1
          g.v = Math.min(9 * M, g.v + 5 * M * dt); g.vy = Math.min(2.6 * M, g.vy + 4 * M * dt)
          g.x += Math.sin(g.yaw) * g.v * dt; g.z += Math.cos(g.yaw) * g.v * dt; g.y += g.vy * dt
          g.pitch = -0.25
          // (Climbing until well clear of everything round it.)
          if (g.t > 6 || (g.t > 2.2 && g.y > floorAt(g.x, g.z) + 8 * M)) g.mode = 'soar'
        } else if (g.mode === 'soar') {
          // Round its circle: steer for a point a little ahead on it, climb or sink to its height.
          const [ci, cj] = o.rings[g.ring]
          const cx = cj + 0.5, cz = ci + 0.5
          g.ang += (g.v / g.rad) * dt * 0.9
          const tx = cx + Math.cos(g.ang + 0.5) * g.rad, tz = cz + Math.sin(g.ang + 0.5) * g.rad
          const want = Math.atan2(tx - g.x, tz - g.z)
          const turn = Math.max(-1.1, Math.min(1.1, wrap(want - g.yaw) * 1.6))
          g.yaw += turn * dt
          // Banked into the turn as a glider is: tan(bank) = v·ω/g.
          g.bank += (Math.atan((-turn * g.v) / (9.8 * M)) - g.bank) * Math.min(1, dt * 2)
          // (Never lower than ten metres over whatever it is flying over, or about to: a hill, a tower; slowing to climb steeply if it must.)
          const sx = Math.sin(g.yaw), sz = Math.cos(g.yaw)
          const floor = Math.max(highAt(g.x, g.z), highAt(g.x + sx, g.z + sz), highAt(g.x + sx * 2, g.z + sz * 2)) + 10 * M
          const hard = g.y < floor - 5 * M
          const climb = Math.max(-1.5 * M, Math.min(g.y < floor ? 4 * M : 2 * M, (Math.max(g.alt, floor) - g.y) * 0.6))
          g.vy += (climb - g.vy) * Math.min(1, dt * (hard ? 3 : 1))
          g.v += ((hard ? 5 : 10 + 2 * Math.sin(g.ang * 1.7)) * M - g.v) * Math.min(1, dt * (hard ? 2 : 0.5))
          g.x += Math.sin(g.yaw) * g.v * dt; g.z += Math.cos(g.yaw) * g.v * dt; g.y += g.vy * dt
          g.pitch += (-g.vy / g.v * 0.8 - g.pitch) * Math.min(1, dt * 2)
          // Beating its wings to climb; otherwise on still wings, with a few beats now and then.
          if (g.vy > 0.8 * M || g.flapping > 0) g.flapping = Math.max(0, g.flapping - dt)
          if (g.vy > 0.9 * M && g.flapping <= 0) g.flapping = 1.2
          else if (rnd() < dt * 0.06) g.flapping = 0.8 + rnd()
          // Time to come down: to a free perch (at night, all of them).
          if (((g.timer -= dt) < 0 || night) && rnd() < dt * (night ? 1 : 0.3)) {
            // (One near enough, with nothing in the way.)
            const free = perches.filter((p) => !p.taken && Math.hypot(p.x - g.x, p.z - g.z) < 8 && clearTo(g, p))
            if (free.length) {
              const p = free.reduce((a, b) => (Math.hypot(b.x - g.x, b.z - g.z) + rnd() * 6 < Math.hypot(a.x - g.x, a.z - g.z) + rnd() * 6 ? b : a))
              p.taken = true; g.perch = p; g.mode = 'land'; g.t = 0; g.from.set(g.x, g.y, g.z)
            } else g.timer = 20
          }
        } else if (g.mode === 'land') {
          // Gliding in: down a curve to the perch, slowing, wings raised to brake, a last flurry of beats.
          const p = g.perch!, py = p.water ? o.seaAt(p.x, p.z) : p.y
          const dist = Math.hypot(p.x - g.from.x, p.z - g.from.z) + Math.abs(py - g.from.y)
          const dur = Math.max(3, dist / (7 * M))
          g.t += dt
          const f = Math.min(1, g.t / dur), s = f * f * (3 - 2 * f)
          const nx = g.from.x + (p.x - g.from.x) * s, nz = g.from.z + (p.z - g.from.z) * s
          // (Height: holding up at first, then dropping in.)
          const ny = g.from.y + (py - g.from.y) * Math.pow(s, 0.7) + Math.sin(f * Math.PI) * 0.15
          const mx = nx - g.x, mz = nz - g.z
          if (Math.hypot(mx, mz) > 1e-5) { const want = Math.atan2(mx, mz); const tr = wrap(want - g.yaw); g.yaw += tr * Math.min(1, dt * 3); g.bank += (-tr * 0.8 - g.bank) * Math.min(1, dt * 3) }
          g.v = Math.hypot(mx, mz) / dt
          g.pitch = -0.1 - 0.5 * Math.max(0, f - 0.7) / 0.3
          g.x = nx; g.z = nz; g.y = ny
          g.flapping = f > 0.82 ? 1 : 0
          if (f >= 1) { g.mode = 'stand'; g.bank = 0; g.pitch = 0; g.v = 0; g.timer = 30 + rnd() * 90 }
        }
        // The wings: beating (three times a second), or held out; raised and spread to brake coming in.
        if (g.mode !== 'stand') {
          if (g.flapping > 0) g.flap += dt * Math.PI * 2 * (g.mode === 'land' ? 4 : 3.1)
          const beat = g.flapping > 0 ? 1 : 0
          const tgtW = beat ? Math.sin(g.flap) * 0.75 + 0.1 : g.mode === 'land' ? 0.35 : 0.09
          const tgtH = beat ? Math.sin(g.flap - 0.9) * 0.6 : g.mode === 'land' ? 0.25 : -0.06
          g.wing += (tgtW - g.wing) * Math.min(1, dt * (beat ? 30 : 4)); g.hand += (tgtH - g.hand) * Math.min(1, dt * (beat ? 30 : 4))
        }
        // Drawn if near enough to make out.
        const d = Math.hypot(g.x - c.cam.x, g.z - c.cam.z)
        if (d > 22) continue
        const s = M * g.size
        R.compose(v.set(g.x, g.y + (g.mode === 'stand' && !g.perch!.water ? 0.19 * s : g.mode === 'stand' ? 0.02 * s : 0), g.z), q.setFromEuler(e.set(g.pitch, g.yaw, g.bank, 'YXZ')), sc.set(s, s, s))
        if (g.mode === 'stand') { put('rest', R); continue }
        put('body', R)
        for (const side of [1, -1]) {
          L.compose(v.set(side * 0.045, 0.045, 0.03), q.setFromEuler(e.set(0, -side * 0.06, side * g.wing, 'XYZ')), one)
          W1.multiplyMatrices(R, L); put(side > 0 ? 'armL' : 'armR', W1)
          L.compose(v.set(side * 0.29, 0, 0), q.setFromEuler(e.set(0, side * 0.1, side * g.hand, 'XYZ')), one)
          W2.multiplyMatrices(W1, L); put(side > 0 ? 'handL' : 'handR', W2)
        }
      }
      for (const [k, m] of Object.entries(meshes)) { m.count = counts[k]; if (m.count) m.instanceMatrix.needsUpdate = true }
    },
    /** (For the checks.) */
    state: () => flock.map((g) => ({ x: g.x, y: g.y, z: g.z, mode: g.mode, water: !!g.perch?.water })),
    perches: () => perches.length,
    dispose() { for (const m of Object.values(meshes)) { m.geometry.dispose(); m.dispose() } mat.dispose(); wingMat.dispose(); scene.remove(group) },
  }
}
