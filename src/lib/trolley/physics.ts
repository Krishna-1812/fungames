/**
 * Trolley's rigid bodies.
 *
 * Everything that can be knocked over on the layout is a box with a mass: a
 * figure, a lobster, a hen, a crate. The tram is a box too, but one that is
 * driven and never pushed back: it weighs twelve tonnes and a figure weighs
 * seventy kilos, so pretending the figure slows it would be the less honest
 * simulation.
 *
 * What is solved, 240 times a second:
 *
 *   - each body's eight corners against the ground (a height function, so the
 *     ballast bed is a real step up from the grass);
 *   - each corner against the driven boxes, with the box's own velocity at the
 *     point of contact, so a figure is carried off by the tram's front and
 *     not teleported out of it;
 *   - body against body, as two spheres apiece, which is enough to stop five
 *     figures falling through each other and cheap enough to forget about.
 *
 * Impulses with Coulomb friction, a little positional correction, and sleep.
 * A body that has not been touched yet is asleep and stands exactly where it
 * was put: a figure balanced on a 30 cm base is not something a solver should
 * be asked to hold up for a minute while somebody reads the question.
 *
 * No three.js in here, so `scripts/check-trolley-physics.mjs` can run it.
 */

export type V3 = [number, number, number]
export type Q = [number, number, number, number] // x y z w

export type Body = {
  /** Half extents of the box, in its own frame. */
  h: V3
  m: number
  /** Inverse inertia about each local axis. */
  ii: V3
  p: V3
  q: Q
  v: V3
  w: V3
  asleep: boolean
  /** Seconds it has been nearly still, towards going back to sleep. */
  still: number
  /** How bouncy and how grippy it is. */
  e: number
  mu: number
  /** Set the first time anything driven touches it. */
  struck: boolean
  /** Whatever the caller wants to hang on it. */
  tag?: unknown
}

/** A box that moves on rails (or does not move at all) and cannot be pushed. */
export type Driver = {
  h: V3
  p: V3
  /** Heading about +y, radians; the box's long axis is its local x. */
  yaw: number
  v: V3
  /** Bodies struck by it bounce off this much. */
  e: number
}

export type World = {
  bodies: Body[]
  drivers: Driver[]
  ground: (x: number, z: number) => number
  g: number
  /** Called once per body, the first time a moving driver touches it. */
  onStrike?: (b: Body, speed: number) => void
  /** Called for a hard landing, with the closing speed. */
  onLand?: (b: Body, speed: number) => void
}

export const STEP = 1 / 240

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Rotate v by q. */
export function rot(q: Q, v: V3): V3 {
  const [x, y, z, w] = q
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]
}
/** Rotate v by the inverse of q. */
function unrot(q: Q, v: V3): V3 {
  return rot([-q[0], -q[1], -q[2], q[3]], v)
}

/** World-space inverse inertia applied to a vector. */
function invI(b: Body, v: V3): V3 {
  const l = unrot(b.q, v)
  return rot(b.q, [l[0] * b.ii[0], l[1] * b.ii[1], l[2] * b.ii[2]])
}

export function makeBody(h: V3, m: number, p: V3, yaw = 0, e = 0.18, mu = 0.7): Body {
  // A solid box: I = m/3 (b² + c²) about each axis, with half extents.
  const ix = (m / 3) * (h[1] * h[1] + h[2] * h[2])
  const iy = (m / 3) * (h[0] * h[0] + h[2] * h[2])
  const iz = (m / 3) * (h[0] * h[0] + h[1] * h[1])
  return {
    h, m, ii: [1 / ix, 1 / iy, 1 / iz], p: [...p] as V3,
    q: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
    v: [0, 0, 0], w: [0, 0, 0], asleep: true, still: 0, e, mu, struck: false,
  }
}

/** Push on a body at a point: the change in v and in w from an impulse. */
export function impulse(b: Body, r: V3, j: V3) {
  b.v[0] += j[0] / b.m; b.v[1] += j[1] / b.m; b.v[2] += j[2] / b.m
  const dw = invI(b, cross(r, j))
  b.w[0] += dw[0]; b.w[1] += dw[1]; b.w[2] += dw[2]
}

const CORNERS: V3[] = []
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) CORNERS.push([sx, sy, sz])

/**
 * One contact: a point on the body, a normal pointing out of whatever it hit,
 * how deep, and how fast the other thing is moving there.
 */
function resolve(b: Body, r: V3, n: V3, depth: number, vOther: V3, e: number, mu: number): number {
  const vp: V3 = [
    b.v[0] + b.w[1] * r[2] - b.w[2] * r[1] - vOther[0],
    b.v[1] + b.w[2] * r[0] - b.w[0] * r[2] - vOther[1],
    b.v[2] + b.w[0] * r[1] - b.w[1] * r[0] - vOther[2],
  ]
  const vn = dot(vp, n)
  let closing = 0
  if (vn < 0) {
    closing = -vn
    const rn = cross(r, n)
    const k = 1 / b.m + dot(n, cross(invI(b, rn), r))
    // Nothing bounces at a crawl; that is what keeps a resting box at rest.
    const jn = (-(1 + (vn < -0.6 ? e : 0)) * vn) / k
    impulse(b, r, [n[0] * jn, n[1] * jn, n[2] * jn])
    // Friction, along whatever sliding is left.
    const t: V3 = [vp[0] - vn * n[0], vp[1] - vn * n[1], vp[2] - vn * n[2]]
    const tl = Math.hypot(t[0], t[1], t[2])
    if (tl > 1e-4) {
      t[0] /= tl; t[1] /= tl; t[2] /= tl
      const rt = cross(r, t)
      const kt = 1 / b.m + dot(t, cross(invI(b, rt), r))
      const jt = Math.max(-mu * jn, Math.min(mu * jn, -tl / kt))
      impulse(b, r, [t[0] * jt, t[1] * jt, t[2] * jt])
    }
  }
  // Ease it back out rather than snapping, an eighth of the depth a step.
  const push = Math.min(depth, 0.05) * 0.125
  b.p[0] += n[0] * push; b.p[1] += n[1] * push; b.p[2] += n[2] * push
  return closing
}

function quatStep(q: Q, w: V3, dt: number) {
  const [x, y, z, s] = q
  const hx = w[0] * dt * 0.5, hy = w[1] * dt * 0.5, hz = w[2] * dt * 0.5
  q[0] = x + hx * s + hy * z - hz * y
  q[1] = y + hy * s + hz * x - hx * z
  q[2] = z + hz * s + hx * y - hy * x
  q[3] = s - hx * x - hy * y - hz * z
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l
}

/** Is a world point inside a driver, and if so which face is nearest? */
function inDriver(d: Driver, x: number, y: number, z: number) {
  const c = Math.cos(d.yaw), s = Math.sin(d.yaw)
  const dx = x - d.p[0], dy = y - d.p[1], dz = z - d.p[2]
  // Local x is the heading; yaw is about +y, so the heading is (c, 0, -s).
  const lx = dx * c - dz * s, lz = dx * s + dz * c
  const px = d.h[0] - Math.abs(lx), py = d.h[1] - Math.abs(dy), pz = d.h[2] - Math.abs(lz)
  if (px <= 0 || py <= 0 || pz <= 0) return null
  let n: V3, depth: number
  // Never downwards: a body under the skirt is shoved along, not into the bed.
  const under = dy < 0
  if (px <= pz && (under || px <= py)) { const k = Math.sign(lx) || 1; n = [c * k, 0, -s * k]; depth = px }
  else if (under || pz <= py) { const k = Math.sign(lz) || 1; n = [s * k, 0, c * k]; depth = pz }
  else { n = [0, Math.sign(dy) || 1, 0]; depth = py }
  return { n, depth }
}

export function step(w: World, dt = STEP) {
  const { bodies, drivers } = w
  for (const b of bodies) {
    // Asleep bodies still get looked at by the drivers, so a tram wakes them.
    for (const d of drivers) {
      const moving = Math.hypot(d.v[0], d.v[1], d.v[2])
      for (const c of CORNERS) {
        const r = rot(b.q, [c[0] * b.h[0], c[1] * b.h[1], c[2] * b.h[2]])
        const hit = inDriver(d, b.p[0] + r[0], b.p[1] + r[1], b.p[2] + r[2])
        if (!hit) continue
        if (b.asleep && moving < 0.05) continue // standing on a bridge deck is not being hit
        b.asleep = false; b.still = 0
        if (!b.struck && moving > 0.5) { b.struck = true; w.onStrike?.(b, moving) }
        resolve(b, r, hit.n, hit.depth, d.v, d.e, 0.45)
      }
    }
    if (b.asleep) continue
    b.v[1] -= w.g * dt
    let fastest = 0, touching = 0
    for (const c of CORNERS) {
      const r = rot(b.q, [c[0] * b.h[0], c[1] * b.h[1], c[2] * b.h[2]])
      const x = b.p[0] + r[0], z = b.p[2] + r[2]
      const depth = w.ground(x, z) - (b.p[1] + r[1])
      if (depth > 0) { touching++; fastest = Math.max(fastest, resolve(b, r, [0, 1, 0], depth, [0, 0, 0], b.e, b.mu)) }
    }
    if (fastest > 3) w.onLand?.(b, fastest)
    // Lying on three corners or more and barely moving: the last of the rattle
    // is the solver's, not the body's, so it is taken out.
    if (touching >= 3 && Math.hypot(b.v[0], b.v[1], b.v[2]) < 0.6) {
      const k = Math.exp(-6 * dt)
      b.v[0] *= k; b.v[2] *= k; b.w[0] *= k; b.w[1] *= k; b.w[2] *= k
    }
    // A little air and a little rolling loss, so nothing spins for ever.
    const lin = Math.exp(-0.08 * dt), ang = Math.exp(-0.9 * dt)
    b.v[0] *= lin; b.v[1] *= lin; b.v[2] *= lin
    b.w[0] *= ang; b.w[1] *= ang; b.w[2] *= ang
    b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.p[2] += b.v[2] * dt
    quatStep(b.q, b.w, dt)
    const speed = Math.hypot(b.v[0], b.v[1], b.v[2]) + 0.4 * Math.hypot(b.w[0], b.w[1], b.w[2])
    b.still = speed < 0.2 ? b.still + dt : 0
    if (b.still > 0.5) { b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0] }
  }
  // Body against body: two spheres each, along the long axis.
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    for (let k = i + 1; k < bodies.length; k++) {
      const b = bodies[k]
      if (a.asleep && b.asleep) continue
      for (const sa of [-0.5, 0.5]) for (const sb of [-0.5, 0.5]) {
        const ra = rot(a.q, [0, sa * a.h[1], 0]), rb = rot(b.q, [0, sb * b.h[1], 0])
        const dx = b.p[0] + rb[0] - a.p[0] - ra[0], dy = b.p[1] + rb[1] - a.p[1] - ra[1], dz = b.p[2] + rb[2] - a.p[2] - ra[2]
        const rad = Math.max(a.h[0], a.h[2]) + Math.max(b.h[0], b.h[2])
        const d = Math.hypot(dx, dy, dz)
        if (d >= rad || d < 1e-5) continue
        const n: V3 = [dx / d, dy / d, dz / d]
        const va: V3 = [a.v[0] + a.w[1] * ra[2] - a.w[2] * ra[1], a.v[1] + a.w[2] * ra[0] - a.w[0] * ra[2], a.v[2] + a.w[0] * ra[1] - a.w[1] * ra[0]]
        const vb: V3 = [b.v[0] + b.w[1] * rb[2] - b.w[2] * rb[1], b.v[1] + b.w[2] * rb[0] - b.w[0] * rb[2], b.v[2] + b.w[0] * rb[1] - b.w[1] * rb[0]]
        const vn = dot([vb[0] - va[0], vb[1] - va[1], vb[2] - va[2]], n)
        if (vn > -0.3 && a.asleep !== b.asleep) continue // leaning on a sleeper does not wake it
        a.asleep = false; b.asleep = false; a.still = 0; b.still = 0
        if (vn < 0) {
          const j = (-1.2 * vn) / (1 / a.m + 1 / b.m)
          impulse(a, ra, [-n[0] * j, -n[1] * j, -n[2] * j])
          impulse(b, rb, [n[0] * j, n[1] * j, n[2] * j])
        }
        const push = (rad - d) * 0.1, wa = b.m / (a.m + b.m)
        a.p[0] -= n[0] * push * wa; a.p[1] -= n[1] * push * wa; a.p[2] -= n[2] * push * wa
        b.p[0] += n[0] * push * (1 - wa); b.p[1] += n[1] * push * (1 - wa); b.p[2] += n[2] * push * (1 - wa)
      }
    }
  }
}

/** A spring with a damper, for everything that should settle rather than stop. */
export function spring(x: number, v: number, target: number, k: number, c: number, dt: number): [number, number] {
  const a = k * (target - x) - c * v
  v += a * dt
  return [x + v * dt, v]
}
