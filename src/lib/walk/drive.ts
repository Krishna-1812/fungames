/**
 * Driving (walker.ts): a car you drive yourself, moved by the forces a real one feels.
 *
 * The car is a rigid body on four tyres (the "bicycle model" vehicle engineers
 * use, both wheels of an axle taken together): the engine pulls with all its
 * force until its power runs out, air and rolling resistance hold it back,
 * the brakes stop it in the distance a real car's do, and a hill pulls it
 * back or runs it on. Each axle's tyres grip the road with a force that grows
 * with how far they slip sideways and then levels off at what the road can
 * give (μ times the weight on them): so the car turns on its front wheels,
 * understeers if you ask too much of them, and with the handbrake's locked
 * rear wheels slides its tail round. Slow, it simply goes where its front
 * wheels point. The steering turns less the faster you go, as a real car's
 * does by feel.
 *
 * It follows the ground under each of its wheels — up and down a slope, onto
 * a kerb or a pier, off an edge and down again — and it hits things: a wall,
 * a tree, a lamp post or another car stops it where they meet, with an
 * impulse at the point of contact (glance off a corner and it spins); water
 * slows it, and deep enough it floods the engine.
 *
 * Everything inside is in metres and seconds; where it is, in the world's units
 * (body.ts: a metre is 0.11 of one).
 */
import { METRE } from './body'

export type Box = { i0: number; i1: number; j0: number; j1: number; z0: number; z1: number }

/** A car's measurements (metres, kilograms, watts, newtons, metres a second). */
export type Spec = {
  /** Length, width and height of the body. */
  len: number; wid: number; tall: number
  /** The axles, from the middle of the car (forward is +): front and rear. The track; the wheels' radius. */
  front: number; rear: number; track: number; wheel: number
  mass: number; power: number; pull: number; top: number
  /** The steering's full lock (radians at the road wheels). */
  lock: number
}

export type Ground = {
  heightAt(x: number, z: number): number
  boxes: Box[]
  /** The water's surface over a point, if there is water there. */
  waterAt(x: number, z: number, ground: number): number | null
  /** Other cars in the way: middle (world units), the way it faces, half its length and width (world units). */
  others(): { x: number; z: number; yaw: number; hl: number; hw: number }[]
  /** How far the world goes (world units); past that, the sea's edge holds the car back. */
  grid: number
}

/** The driver's hands and feet: throttle forward (+) or back (−, a brake while moving forward), steering (+ right), the handbrake. */
export type Controls = { throttle: number; steer: number; handbrake: boolean }

const G = 9.81
/** What a step up a car's wheels take without noticing (a kerb), and what stops it (a wall). */
const KERB = 0.32, WALL = 0.42
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

export type Vehicle = ReturnType<typeof vehicle>

export function vehicle(spec: Spec, x: number, z: number, yaw: number) {
  // The weight sits a little forward of the middle (the engine is at the front).
  const cg = (spec.front + spec.rear) / 2 + 0.06 * (spec.front - spec.rear)
  const a = spec.front - cg, b = cg - spec.rear, L = a + b
  const m = spec.mass, Iz = (m * (spec.len * spec.len + spec.wid * spec.wid)) / 12
  // Tyres: how hard they push back per radian of slip, and the most the road gives (μ).
  const Cf = 2 * 52000, Cr = 2 * 56000, MU = 0.95
  const hl = spec.len / 2, hw = spec.wid / 2

  const s = {
    /** Where (world units), which way it faces (radians, as three's rotation.y: forward is (cos, −sin)). */
    x, z, y: 0, yaw,
    /** Speed forward and to the left (m/s), how fast it turns (rad/s, + to the left), the road wheels' angle (+ left). */
    u: 0, vl: 0, r: 0, steer: 0,
    /** Falling (m/s), the ground's pitch and roll under it, the body's lean on its springs (radians), the wheels' turn. */
    vy: 0, pitch: 0, roll: 0, lean: 0, dive: 0, spin: 0, air: false,
    /** Lights: braking, reversing. How deep the water is under it (m); whether it has flooded. */
    braking: false, reversing: false, depth: 0, flooded: false,
    /** The hardest knock this frame (m/s into whatever it hit). */
    hit: 0,
    /** Acceleration forward and sideways (m/s²), for the body's lean. */
    ax: 0, ay: 0,
  }

  /** A point on the car (metres forward and to the right of its middle) in the world. */
  const toWorld = (bx: number, bz: number): [number, number] => {
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw)
    return [s.x + (bx * c + bz * n) * METRE, s.z + (-bx * n + bz * c) * METRE]
  }
  /** The ground under a point: the land, or the top of something low enough to drive onto. */
  const groundAt = (G0: Ground, px: number, pz: number, from: number) => {
    let g = G0.heightAt(px, pz)
    for (const bx of G0.boxes) if (px > bx.j0 && px < bx.j1 && pz > bx.i0 && pz < bx.i1 && bx.z1 <= from + KERB * METRE && bx.z1 > g) g = bx.z1
    return g
  }
  // Points round the car's sides that touch whatever it runs into: the corners and along each side.
  const rim: [number, number][] = []
  for (const fx of [-1, -0.5, 0, 0.5, 1]) for (const sz of [-1, 1]) rim.push([fx * hl, sz * hw])
  for (const sz of [-0.5, 0.5]) for (const fx of [-1, 1]) rim.push([fx * hl, sz * hw])

  type Hit = { px: number; pz: number; nx: number; nz: number; depth: number }
  /** The deepest place the car is into something: its point (world), the way out (unit, world) and how far (world units). */
  const contact = (G0: Ground): Hit | null => {
    let best: Hit | null = null
    const lo = s.y + KERB * METRE, hi = s.y + spec.tall * METRE * 0.9
    const keep = (h: Hit) => { if (!best || h.depth > best.depth) best = h }
    for (const [bx, bz] of rim) {
      const [px, pz] = toWorld(bx, bz)
      // Something built (or grown) in the way.
      for (const B of G0.boxes) {
        if (B.z1 <= lo || B.z0 >= hi || px <= B.j0 || px >= B.j1 || pz <= B.i0 || pz >= B.i1) continue
        const dl = px - B.j0, dr = B.j1 - px, dn = pz - B.i0, ds = B.i1 - pz, d = Math.min(dl, dr, dn, ds)
        keep({ px, pz, depth: d, nx: d === dl ? -1 : d === dr ? 1 : 0, nz: d === dn ? -1 : d === ds ? 1 : 0 })
      }
      // A terrace wall or a cliff: out the way the ground falls away.
      const gh = G0.heightAt(px, pz)
      if (gh > s.y + WALL * METRE) {
        const e = 0.03, gx = G0.heightAt(px + e, pz) - G0.heightAt(px - e, pz), gz = G0.heightAt(px, pz + e) - G0.heightAt(px, pz - e)
        let nx = -gx, nz = -gz, l = Math.hypot(nx, nz)
        if (l < 1e-6) { nx = s.x - px; nz = s.z - pz; l = Math.hypot(nx, nz) || 1 }
        keep({ px, pz, nx: nx / l, nz: nz / l, depth: 0.004 })
      }
      // Another car.
      for (const o of G0.others()) {
        const c = Math.cos(o.yaw), n = Math.sin(o.yaw), dx = px - o.x, dz = pz - o.z
        const lx = dx * c - dz * n, lz = dx * n + dz * c
        if (Math.abs(lx) >= o.hl || Math.abs(lz) >= o.hw) continue
        const ex = o.hl - Math.abs(lx), ez = o.hw - Math.abs(lz)
        // (Its local axes in the world: forward (c, −n), right (n, c).)
        if (ex < ez) keep({ px, pz, depth: ex, nx: Math.sign(lx) * c, nz: -Math.sign(lx) * n })
        else keep({ px, pz, depth: ez, nx: Math.sign(lz) * n, nz: Math.sign(lz) * c })
      }
    }
    // The other way about: a corner of something poking into the car's side.
    const c = Math.cos(s.yaw), n = Math.sin(s.yaw), HL = hl * METRE, HW = hw * METRE
    const poke = (px: number, pz: number) => {
      const dx = px - s.x, dz = pz - s.z, lx = dx * c - dz * n, lz = dx * n + dz * c
      if (Math.abs(lx) >= HL || Math.abs(lz) >= HW) return
      const ex = HL - Math.abs(lx), ez = HW - Math.abs(lz)
      // Pushed back away from it: against the face it came through.
      if (ex < ez) keep({ px, pz, depth: ex, nx: -Math.sign(lx) * c, nz: Math.sign(lx) * n })
      else keep({ px, pz, depth: ez, nx: -Math.sign(lz) * n, nz: -Math.sign(lz) * c })
    }
    const R = Math.max(HL, HW) + 0.02
    for (const B of G0.boxes) {
      if (B.z1 <= lo || B.z0 >= hi || B.j1 < s.x - R || B.j0 > s.x + R || B.i1 < s.z - R || B.i0 > s.z + R) continue
      poke(B.j0, B.i0); poke(B.j1, B.i0); poke(B.j0, B.i1); poke(B.j1, B.i1)
    }
    for (const o of G0.others()) {
      if (Math.hypot(o.x - s.x, o.z - s.z) > R + o.hl + 0.05) continue
      const oc = Math.cos(o.yaw), on = Math.sin(o.yaw)
      for (const [fx, fz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) poke(o.x + fx * o.hl * oc + fz * o.hw * on, o.z - fx * o.hl * on + fz * o.hw * oc)
    }
    return best
  }

  /** The world velocity (m/s) from the car's own. */
  const worldV = () => { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); return [s.u * c - s.vl * n, -s.u * n - s.vl * c] }
  const setWorldV = (vx: number, vz: number) => { const c = Math.cos(s.yaw), n = Math.sin(s.yaw); s.u = vx * c - vz * n; s.vl = -vx * n - vz * c }

  /** Knocked out of whatever it ran into: moved clear, and an impulse at the point they met. */
  const collide = (G0: Ground) => {
    for (let k = 0; k < 4; k++) {
      const h = contact(G0)
      if (!h) return
      s.x += h.nx * (h.depth + 0.0005); s.z += h.nz * (h.depth + 0.0005)
      const rx = (h.px - s.x) / METRE, rz = (h.pz - s.z) / METRE
      const [vx, vz] = worldV()
      // The point's own velocity: the car's, and its turning (ω × r, about the vertical).
      const px = vx + s.r * rz, pz = vz - s.r * rx
      const vn = px * h.nx + pz * h.nz
      if (vn >= 0) continue
      const rn = rz * h.nx - rx * h.nz
      const j = (-(1 + 0.18) * vn) / (1 / m + (rn * rn) / Iz)
      let nvx = vx + (j * h.nx) / m, nvz = vz + (j * h.nz) / m
      s.r += (j * rn) / Iz
      // Scraping along it: friction against the slide.
      const tx = -h.nz, tz = h.nx, vt = px * tx + pz * tz, rt = rz * tx - rx * tz
      const jt = clamp(-vt / (1 / m + (rt * rt) / Iz), -0.35 * j, 0.35 * j)
      nvx += (jt * tx) / m; nvz += (jt * tz) / m; s.r += (jt * rt) / Iz
      setWorldV(nvx, nvz)
      s.hit = Math.max(s.hit, -vn)
    }
  }

  /** One small step of the forces. */
  const sub = (h: number, ctl: Controls, G0: Ground) => {
    const speed = Math.abs(s.u)
    // The steering: less lock the faster it goes; turned at a hand's pace, and back to the middle a little quicker.
    const want = -clamp(ctl.steer, -1, 1) * spec.lock / (1 + (speed / 11) ** 2)
    const rate = Math.abs(want) < Math.abs(s.steer) ? 3.2 : 2.2
    s.steer += clamp(want - s.steer, -rate * h, rate * h)
    const d = s.steer

    // Along the road: the engine (all its pull, until its power runs out), the brakes, the air, the tyres rolling, the hill.
    const t = clamp(ctl.throttle, -1, 1)
    const live = !s.flooded && !s.air
    let drive = 0, brake = 0
    if (t > 0) { if (s.u < -0.3) brake = t * 9000; else if (s.u < spec.top) drive = t * Math.min(spec.pull, spec.power / Math.max(0.5, s.u)) }
    else if (t < 0) { if (s.u > 0.3) brake = -t * 9000; else if (s.u > -5) drive = t * spec.pull * 0.55 }
    if (!live) drive = 0
    if (ctl.handbrake) brake += 5200
    s.braking = brake > 0 && speed > 0.05
    s.reversing = s.u < -0.2 && t < 0
    const air = 0.5 * 1.2 * 0.7 * s.u * Math.abs(s.u)
    const roll = speed > 0.02 ? 0.013 * m * G * Math.sign(s.u) : 0
    const hill = m * G * Math.sin(s.pitch)
    const wade = s.depth > 0.12 ? 900 * Math.min(1, s.depth) * s.u * Math.abs(s.u) + 2600 * Math.min(1, s.depth) * Math.sign(s.u) : 0

    // Across: each axle's tyres pushing back against their slip, up to what the road gives.
    const Fzf = (m * G * b) / L, Fzr = (m * G * a) / L
    const muR = ctl.handbrake ? MU * 0.42 : MU
    const grip = (C: number, alpha: number, mu: number, Fz: number) => -mu * Fz * Math.tanh((C * alpha) / (mu * Fz))
    const ue = Math.max(Math.abs(s.u), 0.5)
    const af = Math.atan2(s.vl + a * s.r, ue) - d * Math.sign(s.u || 1), ar = Math.atan2(s.vl - b * s.r, ue)
    const Fyf = s.air ? 0 : grip(Cf, af, MU, Fzf), Fyr = s.air ? 0 : grip(Cr, ar, muR, Fzr)

    const Fx = drive - air - roll - hill - wade
    // (Slow, the tyres' sideways slip means little: they simply roll where they point; below.)
    const kin = s.air ? 1 : s.u > 0 ? smooth(2, 5, s.u) : 0
    const du = (Fx - kin * Fyf * Math.sin(d)) / m + kin * s.vl * s.r
    const dvl = (Fyf * Math.cos(d) + Fyr) / m - s.u * s.r
    const dr = (a * Fyf * Math.cos(d) - b * Fyr) / Iz
    let u = s.u + du * h
    // The brakes take speed off, but never turn it round.
    if (brake > 0) { const dv = (brake / m) * h; u = Math.abs(u) <= dv ? 0 : u - Math.sign(u) * dv }
    // Standing still with nothing pressed, it stays still.
    if (t === 0 && Math.abs(u) < 0.05 && !s.air && Math.abs(hill) < 0.25 * m * G) u = 0
    let vl = s.vl + dvl * h, r = s.r + dr * h
    // Slow, it goes where its wheels point: any slide (after a knock) is taken off by the tyres' grip, no faster than μg.
    if (kin < 1) {
      const rk = (u * Math.tan(d)) / L, vk = rk * b, lim = MU * G * h
      const kvl = s.vl + clamp(vk - s.vl, -lim, lim), kr = s.r + clamp(rk - s.r, (-2 * lim) / L, (2 * lim) / L)
      r = r * kin + kr * (1 - kin); vl = vl * kin + kvl * (1 - kin)
    }
    s.ax = (u - s.u) / h; s.ay = u * r
    s.u = u; s.vl = vl; s.r = r

    // Moving.
    const [vx, vz] = worldV()
    s.x += vx * h * METRE; s.z += vz * h * METRE; s.yaw += s.r * h
    s.spin += (s.u * h) / spec.wheel
    // Out at sea, it is held to the world.
    const OUT = 5
    if (s.x < -OUT || s.x > G0.grid + OUT || s.z < -OUT || s.z > G0.grid + OUT) {
      s.x = clamp(s.x, -OUT, G0.grid + OUT); s.z = clamp(s.z, -OUT, G0.grid + OUT); s.u *= 0.5; s.vl *= 0.5
    }
    collide(G0)

    // Up and down: the ground under each wheel; off an edge it falls.
    const W2 = spec.track / 2
    const [flx, flz] = toWorld(spec.front, -W2), [frx, frz] = toWorld(spec.front, W2), [rlx, rlz] = toWorld(spec.rear, -W2), [rrx, rrz] = toWorld(spec.rear, W2)
    const from = s.y
    const hfl = groundAt(G0, flx, flz, from), hfr = groundAt(G0, frx, frz, from), hrl = groundAt(G0, rlx, rlz, from), hrr = groundAt(G0, rrx, rrz, from)
    const ground = (hfl + hfr + hrl + hrr) / 4
    s.pitch = Math.atan2((hfl + hfr - hrl - hrr) / 2, L * METRE)
    s.roll = Math.atan2((hfl + hrl - hfr - hrr) / 2, spec.track * METRE)
    if (s.y > ground + 0.04 * METRE) {
      // In the air.
      s.air = true; s.vy -= G * h; s.y += s.vy * h * METRE
      if (s.y <= ground) { s.hit = Math.max(s.hit, -s.vy * 0.5); s.y = ground; s.vy = 0; s.air = false }
    } else { s.air = false; s.vy = 0; s.y = ground }

    // Water: how deep, and deep enough to drown the engine.
    const surface = G0.waterAt(s.x, s.z, ground)
    s.depth = surface === null ? 0 : Math.max(0, (surface - ground) / METRE)
    if (s.depth > 0.72) s.flooded = true
    else if (s.depth < 0.3) s.flooded = false
  }

  return {
    s, spec,
    /** Driven on for dt seconds (in small steps, so it stays true at any frame rate). */
    step(dt: number, ctl: Controls, G0: Ground) {
      s.hit = 0
      const n = Math.max(1, Math.ceil(dt / 0.008))
      for (let k = 0; k < n; k++) sub(dt / n, ctl, G0)
      // The body on its springs: it dives as it brakes, squats as it pulls away, leans out of a corner.
      const k2 = Math.min(1, dt * 7)
      s.dive += (clamp(s.ax * 0.0075, -0.06, 0.05) - s.dive) * k2
      s.lean += (clamp(s.ay * 0.0085, -0.07, 0.07) - s.lean) * k2
    },
    /** Set down somewhere, still. */
    place(nx: number, nz: number, nyaw: number, G0: Ground) {
      s.x = nx; s.z = nz; s.yaw = nyaw; s.u = s.vl = s.r = s.vy = 0; s.y = G0.heightAt(nx, nz); s.air = false
      sub(1e-4, { throttle: 0, steer: 0, handbrake: true }, G0)
    },
    /** Speed (m/s). */
    speed: () => Math.hypot(s.u, s.vl),
    /** Its footprint, for anything that must keep out of it (world units). */
    box: () => ({ x: s.x, z: s.z, yaw: s.yaw, hl: hl * METRE, hw: hw * METRE, top: s.y + spec.tall * METRE }),
    toWorld,
  }
}
