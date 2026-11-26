/**
 * You, on the walk (walker.ts): a person, at the island's own scale.
 *
 * The island is built at about 0.11 of a world unit to the metre (its doors,
 * its storeys, its cars and its trees all agree on that), so you stand 1.75 m
 * — 0.19 — tall: jointed at the hips, knees and ankles, the shoulders and
 * elbows, the neck; a head with hair, eyes, nose and ears; a T-shirt with its
 * sleeves, jeans, and trainers with their soles.
 *
 * How you move is worked out from what you are doing, every frame:
 *
 *   - standing: breathing, your weight shifting from foot to foot, looking
 *     about now and then;
 *   - walking and running: a stride whose length and beat come from your
 *     speed — legs swinging from the hip, knees bending through each swing,
 *     feet kept level, arms swinging against the legs (bent at the elbow, a
 *     runner's more), the hips rising and falling with each step, the body
 *     leaning into a run;
 *   - in the air: knees tucked, arms out for balance; and a squat as you land,
 *     deeper the harder you came down;
 *   - wading: arms lifted clear of the water, a shorter step;
 *   - swimming: lying along the surface in a front crawl, arm over arm, the
 *     legs fluttering, turning the head to breathe every other stroke;
 *   - climbing: reaching up, hauling yourself over, a knee up onto the edge;
 *   - driving: sat back in the seat, hands on the wheel, turning it as you
 *     steer, your head turned a little into the bend.
 */
import { CapsuleGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three'

/** A metre, in the world's units. */
export const METRE = 0.11
const M = (m: number) => m * METRE

export type Doing = {
  /** How fast you are going across the ground (world units a second), and whether you are running. */
  speed: number; running: boolean
  ground: boolean; swimming: boolean
  /** How deep the water is round you, from 0 (dry) to 1 (up to your chest). */
  wade: number
  /** How far up a climb you are (0 to 1), or null. */
  climb: number | null
  /** Your speed up or down (world units a second). */
  vy: number
  /** Sat at the wheel of a car: how far it is turned (−1 left to 1 right); null on foot. */
  seated?: number | null
}

export function figure() {
  const mat = (color: string, roughness = 0.8) => new MeshStandardMaterial({ color, roughness })
  const skin = mat('#d9a581', 0.6), shirt = mat('#4fe3c1', 0.85), jeans = mat('#2f3d5c', 0.9), shoe = mat('#f2f4f8', 0.6), sole = mat('#3d4458', 0.7), hair = mat('#3b2a20', 0.95), dark = mat('#1b2340', 0.4)
  const cap = (r: number, len: number, m: Material, y = 0, sx = 1, sz = 1) => { const g = new Mesh(new CapsuleGeometry(r, len, 6, 12), m); g.position.y = y; g.scale.set(sx, 1, sz); g.castShadow = true; return g }
  const ball = (r: number, m: Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const g = new Mesh(new SphereGeometry(r, 16, 12), m); g.position.set(x, y, z); g.scale.set(sx, sy, sz); g.castShadow = true; return g }
  const joint = (x: number, y: number, z: number, parent: Group) => { const g = new Group(); g.position.set(x, y, z); parent.add(g); return g }

  const root = new Group()
  // The hips carry everything; swimming, the whole body pivots about them.
  const hips = joint(0, M(0.93), 0, root)
  hips.add(cap(M(0.15), M(0.08), jeans, M(0.03), 1.1, 0.78))
  const torso = joint(0, M(0.05), 0, hips)
  torso.add(cap(M(0.155), M(0.26), shirt, M(0.24), 1.18, 0.72))
  const neck = joint(0, M(0.5), 0, torso)
  neck.add(cap(M(0.05), M(0.06), skin, M(0.03)))
  const head = joint(0, M(0.08), 0, neck)
  head.add(ball(M(0.105), skin, 0, M(0.11), 0, 0.92, 1.12, 1))
  // Hair: a cap over the crown and the back of the head.
  const crown = ball(M(0.112), hair, 0, M(0.14), -M(0.012), 0.97, 0.95, 1.03)
  head.add(crown)
  for (const x of [-1, 1]) {
    head.add(ball(M(0.014), dark, x * M(0.037), M(0.12), M(0.093)))
    head.add(ball(M(0.022), skin, x * M(0.1), M(0.1), 0, 0.5, 1, 0.8))
  }
  head.add(ball(M(0.02), skin, 0, M(0.09), M(0.103), 0.8, 1, 1.1))
  const limbs = (side: number) => {
    const shoulder = joint(side * M(0.2), M(0.42), 0, torso)
    shoulder.add(cap(M(0.055), M(0.08), shirt, -M(0.06)))
    shoulder.add(cap(M(0.042), M(0.2), skin, -M(0.15)))
    const elbow = joint(0, -M(0.29), 0, shoulder)
    elbow.add(cap(M(0.036), M(0.19), skin, -M(0.12)))
    elbow.add(ball(M(0.045), skin, 0, -M(0.26), M(0.005), 0.8, 1.15, 0.7))
    const hip = joint(side * M(0.09), 0, 0, hips)
    hip.add(cap(M(0.07), M(0.3), jeans, -M(0.21)))
    const knee = joint(0, -M(0.44), 0, hip)
    knee.add(cap(M(0.055), M(0.31), jeans, -M(0.2)))
    const ankle = joint(0, -M(0.44), 0, knee)
    const foot = new Mesh(new CapsuleGeometry(M(0.045), M(0.17), 6, 10), shoe)
    foot.rotation.x = Math.PI / 2; foot.position.set(0, -M(0.02), M(0.055)); foot.scale.set(1, 1, 0.75); foot.castShadow = true
    const tread = new Mesh(new CapsuleGeometry(M(0.047), M(0.17), 4, 10), sole)
    tread.rotation.x = Math.PI / 2; tread.position.set(0, -M(0.042), M(0.055)); tread.scale.set(1.02, 1, 0.3)
    ankle.add(foot, tread)
    return { shoulder, elbow, hip, knee, ankle }
  }
  const L = limbs(1), R = limbs(-1)

  let phase = 0, stroke = 0, breathe = 0, land = 0, lookT = 0, look = 0, wasGround = true, lastVy = 0
  const ease = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, k)
  return {
    root,
    /** Each frame: pose the body for what you are doing. */
    update(dt: number, d: Doing) {
      breathe += dt
      const walkK = Math.min(1, d.speed / 0.16), runK = d.running ? Math.min(1, Math.max(0, (d.speed - 0.2) / 0.35)) : 0
      // The stride: about 1.4 m a full cycle walking, 2.6 m running.
      const cycle = M(1.4 + 1.2 * runK)
      if (d.ground) phase += (d.speed / cycle) * Math.PI * 2 * dt
      // Coming down hard: a squat that springs back up.
      if (d.ground && !wasGround) land = Math.min(1, Math.max(0, -lastVy - 0.1) / 0.35)
      land = Math.max(0, land - dt * 3)
      wasGround = d.ground; lastVy = d.vy

      const k = dt * 12
      let hipY = M(0.93), pitch = 0, lean = 0
      // Limb angles to blend towards (x: forward and back; z: out to the side).
      const tgt = { lt: 0, lk: 0, la: 0, rt: 0, rk: 0, ra: 0, ls: 0, le: 0, lz: 0.06, rs: 0, re: 0, rz: -0.06, headY: 0, headX: 0, twist: 0 }

      if (d.seated != null) {
        // At the wheel: thighs along the seat, shins down to the pedals, leaning back; hands at ten to two, turning with it.
        const st = d.seated
        tgt.lt = tgt.rt = -1.42; tgt.lk = tgt.rk = 1.3; tgt.la = tgt.ra = 0.2
        tgt.ls = -1.05 - 0.28 * st; tgt.rs = -1.05 + 0.28 * st; tgt.le = tgt.re = -0.62
        tgt.lz = 0.18 - 0.1 * st; tgt.rz = -0.18 - 0.1 * st
        tgt.headY = -0.22 * st; tgt.headX = 0.12
        lean = -0.24
      } else if (d.swimming) {
        // The crawl: lying along the water, arm over arm, legs fluttering, breathing to one side every other stroke.
        stroke += dt * (2.2 + d.speed * 18)
        pitch = 1.38; hipY = M(0.93)
        tgt.ls = -stroke; tgt.rs = -stroke - Math.PI
        tgt.le = -0.3 - 0.4 * Math.max(0, Math.sin(stroke)); tgt.re = -0.3 - 0.4 * Math.max(0, Math.sin(stroke + Math.PI))
        tgt.lz = 0.15; tgt.rz = -0.15
        const kick = Math.sin(stroke * 3) * 0.35
        tgt.lt = kick; tgt.rt = -kick; tgt.lk = 0.15 + Math.max(0, kick) * 0.4; tgt.rk = 0.15 + Math.max(0, -kick) * 0.4
        tgt.headX = -0.9; tgt.headY = Math.max(0, Math.sin(stroke * 0.5)) * 0.9
        // (Shoulders turned with each pull.)
        tgt.twist = Math.sin(stroke) * 0.25
      } else if (d.climb !== null) {
        // Hauling up over an edge: hands on it, pulling up, a knee coming over.
        const f = d.climb
        tgt.ls = tgt.rs = -2.7 + 1.6 * f; tgt.le = tgt.re = -0.2 - 1.1 * Math.sin(f * Math.PI)
        tgt.lz = 0.2; tgt.rz = -0.2
        tgt.lt = -1.4 * Math.sin(f * Math.PI); tgt.lk = 1.6 * Math.sin(f * Math.PI); tgt.rt = 0.25; tgt.rk = 0.5
        lean = 0.35 * Math.sin(f * Math.PI)
      } else if (!d.ground) {
        // In the air: tucked, arms out.
        const up = Math.max(-1, Math.min(1, d.vy / 0.3))
        tgt.lt = tgt.rt = -0.5 - 0.2 * up; tgt.lk = tgt.rk = 0.9; tgt.la = tgt.ra = -0.3
        tgt.ls = tgt.rs = -0.8 - 0.4 * up; tgt.le = tgt.re = -0.6; tgt.lz = 0.7; tgt.rz = -0.7
        lean = 0.1
      } else {
        const p = phase, sw = walkK * (0.42 + 0.33 * runK)
        // The legs: swinging from the hip, the knee bending as each comes through, the foot kept level.
        const leg = (q: number) => { const t = -Math.sin(q) * sw, kn = (0.12 + 0.95 * runK) * walkK * Math.pow(Math.max(0, Math.cos(q)), 1.4) + 0.06 * walkK; return [t, kn, -(t + kn) * 0.75] as const }
        const [lt, lk, la] = leg(p), [rt, rk, ra] = leg(p + Math.PI)
        Object.assign(tgt, { lt, lk, la, rt, rk, ra })
        // The arms against the legs; a runner's bent and pumping.
        const arm = walkK * (0.38 + 0.45 * runK)
        tgt.ls = Math.sin(p) * arm; tgt.rs = -Math.sin(p) * arm
        tgt.le = tgt.re = -(0.18 + 1.15 * runK) * walkK - 0.06
        // Each step lifts and drops the hips; a run leans in.
        hipY -= M(0.025 + 0.035 * runK) * walkK * (0.5 + 0.5 * Math.cos(2 * p)) + M(0.005)
        lean = 0.05 * walkK + 0.2 * runK
        tgt.twist = Math.sin(p) * 0.1 * walkK
        // Standing: breathing, a shift of weight, looking about.
        if (walkK < 0.05) {
          lookT -= dt
          if (lookT < 0) { lookT = 2.5 + Math.random() * 4; look = (Math.random() - 0.5) * 1.2 }
          tgt.headY = look
          hipY += M(0.004) * Math.sin(breathe * 0.7)
          tgt.lk = 0.05 + 0.04 * Math.max(0, Math.sin(breathe * 0.35)); tgt.rk = 0.05 + 0.04 * Math.max(0, -Math.sin(breathe * 0.35))
        }
        // Wading: arms lifted clear, shorter steps.
        if (d.wade > 0) { tgt.lz += 0.5 * d.wade; tgt.rz -= 0.5 * d.wade; tgt.le -= 0.4 * d.wade; tgt.re -= 0.4 * d.wade }
      }
      // The landing squat.
      if (land > 0) { hipY -= M(0.18) * land; tgt.lt -= 0.6 * land; tgt.rt -= 0.6 * land; tgt.lk += 1.2 * land; tgt.rk += 1.2 * land; tgt.la -= 0.6 * land; tgt.ra -= 0.6 * land; lean += 0.3 * land }

      // (Out of the water, the arms come round from wherever the crawl left them, the short way.)
      if (!d.swimming) for (const sh of [L.shoulder, R.shoulder]) sh.rotation.x = Math.atan2(Math.sin(sh.rotation.x), Math.cos(sh.rotation.x))
      hips.position.y = ease(hips.position.y, hipY, k * 1.5)
      hips.rotation.x = ease(hips.rotation.x, pitch, dt * 5)
      torso.rotation.x = ease(torso.rotation.x, lean, k)
      torso.rotation.y = ease(torso.rotation.y, tgt.twist, k)
      torso.scale.y = 1 + 0.012 * Math.sin(breathe * 1.7)
      head.rotation.y = ease(head.rotation.y, tgt.headY, dt * 4)
      head.rotation.x = ease(head.rotation.x, tgt.headX - lean * 0.6, k)
      const swimLimb = d.swimming ? 1 : k
      L.hip.rotation.x = ease(L.hip.rotation.x, tgt.lt, k); R.hip.rotation.x = ease(R.hip.rotation.x, tgt.rt, k)
      L.knee.rotation.x = ease(L.knee.rotation.x, tgt.lk, k); R.knee.rotation.x = ease(R.knee.rotation.x, tgt.rk, k)
      L.ankle.rotation.x = ease(L.ankle.rotation.x, tgt.la, k); R.ankle.rotation.x = ease(R.ankle.rotation.x, tgt.ra, k)
      L.shoulder.rotation.x = d.swimming ? tgt.ls : ease(L.shoulder.rotation.x, tgt.ls, swimLimb); R.shoulder.rotation.x = d.swimming ? tgt.rs : ease(R.shoulder.rotation.x, tgt.rs, swimLimb)
      L.shoulder.rotation.z = ease(L.shoulder.rotation.z, tgt.lz, k); R.shoulder.rotation.z = ease(R.shoulder.rotation.z, tgt.rz, k)
      L.elbow.rotation.x = ease(L.elbow.rotation.x, tgt.le, k); R.elbow.rotation.x = ease(R.elbow.rotation.x, tgt.re, k)
    },
  }
}
