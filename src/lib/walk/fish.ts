/**
 * Fish in the island's shallows (walker.ts).
 *
 * Schools of small silvery fish (twenty to thirty centimetres: dark blue-grey
 * backs, silver flanks, pale bellies) cruise the clear water off the beaches,
 * the rocks and the piers, a few bigger bream wandering on their own; seen
 * through the surface where it is shallow enough to see the sand. Each school
 * turns and drifts together, every fish keeping its place in it loosely, its
 * tail beating; wade or swim near and they scatter, darting off fast, and
 * gather again once you are past. Now and then, out where it is deeper, one
 * jumps clear of the water and falls back with a splash.
 *
 * All drawn together, one draw for every fish; the tail's beat bends each body
 * as it is drawn (a wave down it, more towards the tail).
 */
import { Color, CylinderGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Euler, Vector3, type Scene } from 'three'
import { METRE } from './body'
import { Bag, curve, loft, seeded } from './kit'

/** A fish one unit long, head along +z, its middle at the origin: lofted body, a forked tail, a dorsal fin. */
function fishShape() {
  const bag = new Bag()
  const back = new Color('#24384a'), flank = new Color('#b9c6cf'), belly = new Color('#eef1f2'), fin = new Color('#6f8291'), eye = new Color('#0d0f10')
  const w = curve([[0, 0.012], [0.12, 0.03], [0.45, 0.075], [0.7, 0.07], [0.88, 0.05], [1, 0.006]])
  const h = curve([[0, 0.02], [0.12, 0.05], [0.45, 0.13], [0.7, 0.12], [0.88, 0.08], [1, 0.012]])
  const K = 10
  loft(bag, 16, (t) => Array.from({ length: K }, (_, k) => { const a = (k / K) * Math.PI * 2; return new Vector3(Math.sin(a) * w(t), Math.cos(a) * h(t), -0.42 + t * 0.92) }),
    (_, k) => (k <= 1 || k >= K - 1 ? back : k <= 3 || k >= K - 3 ? flank : belly), { closed: true, capStart: true, capEnd: true })
  // The tail: two lobes, forked.
  const T = (x: number, y: number, z: number) => new Vector3(x, y, z)
  bag.tri(T(0, 0.012, -0.4), T(0, 0.15, -0.6), T(0, 0.03, -0.54), fin, new Vector3(1, 0, 0)); bag.tri(T(0, 0.012, -0.4), T(0, 0.03, -0.54), T(0, 0.15, -0.6), fin, new Vector3(-1, 0, 0))
  bag.tri(T(0, -0.012, -0.4), T(0, -0.03, -0.54), T(0, -0.15, -0.6), fin, new Vector3(1, 0, 0)); bag.tri(T(0, -0.012, -0.4), T(0, -0.15, -0.6), T(0, -0.03, -0.54), fin, new Vector3(-1, 0, 0))
  bag.tri(T(0, 0.012, -0.4), T(0, 0.03, -0.54), T(0, -0.03, -0.54), fin, new Vector3(1, 0, 0)); bag.tri(T(0, 0.012, -0.4), T(0, -0.03, -0.54), T(0, 0.03, -0.54), fin, new Vector3(-1, 0, 0))
  bag.tri(T(0, 0.012, -0.4), T(0, -0.03, -0.54), T(0, -0.012, -0.4), fin, new Vector3(1, 0, 0)); bag.tri(T(0, 0.012, -0.4), T(0, -0.012, -0.4), T(0, -0.03, -0.54), fin, new Vector3(-1, 0, 0))
  // The dorsal fin.
  bag.tri(T(0, 0.12, 0.12), T(0, 0.2, -0.02), T(0, 0.1, -0.12), fin, new Vector3(1, 0, 0)); bag.tri(T(0, 0.12, 0.12), T(0, 0.1, -0.12), T(0, 0.2, -0.02), fin, new Vector3(-1, 0, 0))
  // Eyes.
  for (const s of [-1, 1]) bag.add(new CylinderGeometry(0.018, 0.018, 0.01, 8).rotateZ(Math.PI / 2), new Matrix4().makeTranslation(s * 0.045, 0.03, 0.36), eye)
  return bag.geometry(1)
}

type School = { x: number; z: number; yaw: number; tx: number; tz: number; hx: number; hz: number; v: number; scare: number }
type Fish = { school: number; ox: number; oz: number; oy: number; x: number; y: number; z: number; yaw: number; v: number; len: number; beat: number; seed: number; solo: boolean }

export function fishes(scene: Scene, o: {
  seaY: number; grid: number; depthAt(x: number, z: number): number; seaAt(x: number, z: number): number
  splash(x: number, y: number, z: number, n: number, power: number): void; ring(x: number, y: number, z: number, size: number): void
  schools?: number; seed?: number
}) {
  const rnd = seeded(o.seed ?? 53)
  const M = METRE
  /** Water they keep to: shallow enough to be seen in, deep enough to swim. */
  const good = (x: number, z: number) => { const d = o.depthAt(x, z); return d > 0.07 && d < 0.32 }
  const homes: [number, number][] = []
  for (let tries = 0; tries < 4000 && homes.length < (o.schools ?? 8); tries++) {
    const x = -2 + rnd() * (o.grid + 4), z = -2 + rnd() * (o.grid + 4)
    if (good(x, z) && homes.every(([a, b]) => Math.hypot(a - x, b - z) > 3)) homes.push([x, z])
  }
  const schools: School[] = homes.map(([x, z]) => ({ x, z, yaw: rnd() * 6.28, tx: x, tz: z, hx: x, hz: z, v: 0.4 * M, scare: 0 }))
  const fish: Fish[] = []
  schools.forEach((_, s) => {
    const n = 12 + Math.floor(rnd() * 8)
    for (let k = 0; k < n; k++) fish.push({ school: s, ox: (rnd() - 0.5) * 0.12, oz: (rnd() - 0.5) * 0.2, oy: (rnd() - 0.5) * 0.03, x: 0, y: 0, z: 0, yaw: 0, v: 0, len: (0.2 + rnd() * 0.1) * M, beat: 7 + rnd() * 3, seed: rnd() * 100, solo: false })
    // A bream or two keeping its own way nearby.
    if (rnd() < 0.7) fish.push({ school: s, ox: (rnd() - 0.5) * 0.5, oz: (rnd() - 0.5) * 0.5, oy: -0.02, x: 0, y: 0, z: 0, yaw: 0, v: 0, len: (0.38 + rnd() * 0.08) * M, beat: 4.5, seed: rnd() * 100, solo: true })
  })
  for (const f of fish) { const s = schools[f.school]; f.x = s.x + f.ox; f.z = s.z + f.oz; f.y = o.seaY - 0.05 }
  // One more, to jump.
  const leap = { on: false, t: 0, x: 0, z: 0, yaw: 0, dur: 0.8, next: 6 + rnd() * 10 }

  const geo = fishShape()
  const N = fish.length + 1
  const attr = new InstancedBufferAttribute(new Float32Array(N * 2), 2); attr.setUsage(DynamicDrawUsage)
  geo.setAttribute('aFish', attr)
  const time = { value: 0 }
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45, envMapIntensity: 1.2 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = 'uniform float uTime;\nattribute vec2 aFish;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    // The tail's beat: a wave down the body, growing towards the tail.
    float k = smoothstep(0.35, -0.6, position.z);
    float wave = sin(uTime * aFish.y + aFish.x - position.z * 5.0);
    transformed.x += wave * 0.09 * k;
  }`)
  }
  mat.customProgramCacheKey = () => 'walk-fish'
  const mesh = new InstancedMesh(geo, mat, N)
  mesh.frustumCulled = false; mesh.name = 'fish'
  // (Their shadows on the sand under them, in clear water, are half of what makes them seen.)
  mesh.castShadow = true
  scene.add(mesh)

  const m = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), s3 = new Vector3()
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

  return {
    mesh,
    update(dt: number, c: { cam: Vector3; you: { x: number; y: number; z: number }; inWater: boolean; time: number }) {
      if (dt <= 0) return
      time.value = c.time
      // The schools: each wanders its patch of water, turning away from where it gets too deep or too shallow; and from you.
      for (const s of schools) {
        const dx = s.x - c.you.x, dz = s.z - c.you.z, d = Math.hypot(dx, dz)
        if (c.inWater && d < 0.25) s.scare = 1.6
        s.scare = Math.max(0, s.scare - dt)
        if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.08 || !good(s.tx, s.tz)) {
          for (let k = 0; k < 8; k++) { const tx = s.hx + (rnd() - 0.5) * 2.4, tz = s.hz + (rnd() - 0.5) * 2.4; if (good(tx, tz)) { s.tx = tx; s.tz = tz; break } }
        }
        let want = Math.atan2(s.tx - s.x, s.tz - s.z), speed = 0.45 * M
        if (s.scare > 0) { want = Math.atan2(dx, dz); speed = 2.6 * M }
        s.yaw += Math.max(-2.5, Math.min(2.5, wrap(want - s.yaw) * 2)) * dt
        s.v += (speed - s.v) * Math.min(1, dt * 3)
        const nx = s.x + Math.sin(s.yaw) * s.v * dt, nz = s.z + Math.cos(s.yaw) * s.v * dt
        if (good(nx, nz) || s.scare > 0 && o.depthAt(nx, nz) > 0.04) { s.x = nx; s.z = nz } else { s.yaw += Math.PI * 0.6; s.tx = s.hx; s.tz = s.hz }
      }
      let n = 0
      for (const f of fish) {
        const s = schools[f.school]
        // Its place in the school (turned with it), and a little wander of its own.
        const t = c.time * 0.4 + f.seed, cs = Math.cos(s.yaw), sn = Math.sin(s.yaw)
        const spread = s.scare > 0 ? 2.2 : 1
        const ox = (f.ox + Math.sin(t) * 0.02) * spread, oz = (f.oz + Math.cos(t * 1.3) * 0.02) * spread
        const tx = s.x + ox * cs + oz * sn, tz = s.z - ox * sn + oz * cs
        const ax = tx - f.x, az = tz - f.z, d = Math.hypot(ax, az)
        const sp = Math.min(s.v * 1.6 + d * 1.5, (s.scare > 0 ? 3.2 : 0.9) * M)
        if (d > 1e-4) { f.yaw += wrap(Math.atan2(ax, az) - f.yaw) * Math.min(1, dt * (s.scare > 0 ? 9 : 4)); }
        f.v += (sp - f.v) * Math.min(1, dt * 4)
        f.x += Math.sin(f.yaw) * f.v * dt; f.z += Math.cos(f.yaw) * f.v * dt
        // Half way down, never at the bottom nor breaking the surface.
        const depth = o.depthAt(f.x, f.z)
        f.y += (o.seaY - Math.max(0.025, Math.min(0.12, depth * 0.45)) + f.oy - f.y) * Math.min(1, dt * 2)
        // (Only those near enough to see are drawn: packed to the front of the list.)
        if (Math.hypot(f.x - c.cam.x, f.z - c.cam.z) > 8) continue
        m.compose(v.set(f.x, f.y, f.z), q.setFromEuler(e.set(0, f.yaw, 0)), s3.set(f.len, f.len, f.len))
        mesh.setMatrixAt(n, m)
        attr.setXY(n, f.seed, f.beat * (0.6 + f.v / (0.6 * M)))
        n++
      }
      // Now and then, a fish leaps: somewhere in sight, in deeper water.
      leap.next -= dt
      if (!leap.on && leap.next < 0) {
        leap.next = 8 + rnd() * 18
        const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * 3
        const x = c.cam.x + Math.sin(a) * r, z = c.cam.z + Math.cos(a) * r
        if (o.depthAt(x, z) > 0.25) { Object.assign(leap, { on: true, t: 0, x, z, yaw: rnd() * 6.28, dur: 0.75 + rnd() * 0.3 }); const y = o.seaAt(x, z); o.splash(x, y, z, 8, 0.35); o.ring(x, y, z, 0.6) }
      }
      if (leap.on) {
        leap.t += dt
        const f = leap.t / leap.dur, sea = o.seaAt(leap.x, leap.z)
        // Up out of the water and over, in an arc (half a metre high, a metre and a half along), and in again.
        const x = leap.x + Math.sin(leap.yaw) * (f - 0.5) * 1.5 * M, z = leap.z + Math.cos(leap.yaw) * (f - 0.5) * 1.5 * M
        const y = sea + Math.sin(f * Math.PI) * 0.55 * M - 0.01
        m.compose(v.set(x, y, z), q.setFromEuler(e.set(-Math.cos(f * Math.PI) * 0.9, leap.yaw, 0, 'YXZ')), s3.setScalar(0.42 * M))
        mesh.setMatrixAt(n, m); attr.setXY(n, 0, 14); n++
        if (f >= 1) { leap.on = false; o.splash(x, sea, z, 14, 0.5); o.ring(x, sea, z, 0.9) }
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true; attr.needsUpdate = true
    },
    /** (For the checks.) */
    state: () => ({ schools: schools.map((s) => ({ x: s.x, z: s.z, depth: o.depthAt(s.x, s.z), scared: s.scare > 0 })), fish: fish.length }),
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); scene.remove(mesh) },
  }
}
