/**
 * Water answering you (walker.ts): rings spreading out from where you wade or
 * swim, and spray thrown up when you jump in or kick through it.
 *
 * The rings are thin discs on the surface that widen and fade; the spray is
 * drops flung up and out that gravity brings back down into the water (a drop
 * is gone when it falls back through the surface it left).
 */
import { BufferAttribute, BufferGeometry, DataTexture, LinearFilter, Mesh, MeshBasicMaterial, Points, PointsMaterial, RingGeometry, type Scene } from 'three'

const RINGS = 16, DROPS = 220, G = 9.8 * 0.11

export function splashes(scene: Scene) {
  const ringGeo = new RingGeometry(0.93, 1, 56).rotateX(-Math.PI / 2)
  const rings = Array.from({ length: RINGS }, () => {
    const m = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#eef6fb', transparent: true, opacity: 0, depthWrite: false }))
    m.visible = false; m.renderOrder = 2; scene.add(m)
    return { m, age: 0, life: 1, grow: 0.3, start: 0.03, peak: 0.4 }
  })
  let nextRing = 0
  const pos = new Float32Array(DROPS * 3).fill(-999), vel = new Float32Array(DROPS * 3), floor = new Float32Array(DROPS)
  const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(pos, 3)) // (shares pos: the drops move as it changes)
  // A drop: round, bright in its middle, soft at its edge.
  const D = 32, px = new Uint8Array(D * D * 4)
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const r = Math.hypot(x + 0.5 - D / 2, y + 0.5 - D / 2) / (D / 2), i = (y * D + x) * 4
    px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - r) * 2.2)) ** 1.5)
  }
  const dot = new DataTexture(px, D, D); dot.magFilter = dot.minFilter = LinearFilter; dot.needsUpdate = true
  const spray = new Points(geo, new PointsMaterial({ color: '#f4f9ff', map: dot, size: 0.012, transparent: true, opacity: 0.9, depthWrite: false }))
  spray.frustumCulled = false; scene.add(spray)
  let nextDrop = 0

  return {
    /** A ring on the water at a point, widening from a start radius. */
    ring(x: number, y: number, z: number, size = 1, life = 1.4) {
      const r = rings[nextRing++ % RINGS]
      r.m.position.set(x, y + 0.004, z); r.age = 0; r.life = life; r.grow = 0.13 * size; r.start = 0.015 * size; r.peak = Math.min(0.55, 0.25 + size * 0.2)
      r.m.visible = true
    },
    /** A burst of spray from a point on the water: n drops, thrown up as hard as power. */
    burst(x: number, y: number, z: number, n: number, power: number, push: [number, number] = [0, 0]) {
      for (let k = 0; k < n; k++) {
        // (At a person's size: a metre is 0.11 of a world unit, so a hard splash flies a metre or so.)
        const i = nextDrop++ % DROPS, a = Math.random() * Math.PI * 2, out = (0.06 + Math.random() * 0.18) * power
        pos[i * 3] = x + Math.cos(a) * 0.015; pos[i * 3 + 1] = y + 0.004; pos[i * 3 + 2] = z + Math.sin(a) * 0.015
        vel[i * 3] = Math.cos(a) * out + push[0] * 0.4; vel[i * 3 + 1] = (0.2 + Math.random() * 0.36) * power; vel[i * 3 + 2] = Math.sin(a) * out + push[1] * 0.4
        floor[i] = y
      }
    },
    /** How many drops are in the air (for the checks). */
    drops: () => { let n = 0; for (let i = 0; i < DROPS; i++) if (pos[i * 3 + 1] > -900) n++; return n },
    update(dt: number) {
      for (const r of rings) {
        if (!r.m.visible) continue
        r.age += dt
        const t = r.age / r.life
        if (t >= 1) { r.m.visible = false; continue }
        const s = r.start + r.grow * r.age
        r.m.scale.set(s, 1, s)
        ;(r.m.material as MeshBasicMaterial).opacity = r.peak * (1 - t) * Math.min(1, r.age * 12)
      }
      for (let i = 0; i < DROPS; i++) {
        if (pos[i * 3 + 1] < -900) continue
        vel[i * 3 + 1] -= G * dt
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt
        if (vel[i * 3 + 1] < 0 && pos[i * 3 + 1] < floor[i]) pos[i * 3 + 1] = -999
      }
      geo.getAttribute('position').needsUpdate = true
    },
  }
}
