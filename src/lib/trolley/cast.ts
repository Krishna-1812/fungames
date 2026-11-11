/**
 * Who and what stands on the layout.
 *
 * Figures, lobsters and hens are single solid models with their origin at
 * their middle, because each one is one rigid body to the physics and the
 * mesh simply takes the body's position and turn every frame. The lever, the
 * footbridge, the crate and the briefcase are furniture: they are placed and
 * (the lever, the crate) moved by springs, but nothing knocks them over.
 *
 * A figure is seeded: height, build, clothes, skin, hair and what the arms
 * are doing all come from one number, so problem 7 has the same five people
 * on it every time it is asked.
 */
import {
  BoxGeometry, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry, DoubleSide,
} from 'three'
import type { BufferGeometry, Texture } from 'three'
import { cardTexture, labelTexture, merge, part, rng } from './kit'
import type { V3 } from './physics'

export type Piece = { mesh: Mesh; half: V3; mass: number }
export type Look = 'person' | 'you' | 'friend' | 'stranger' | 'ghost'

const SHIRTS = [0x2f5d8a, 0xa83232, 0x3f7a54, 0xd8cdb0, 0x5b4a8a, 0x2b2d36, 0x8c4a2e, 0xe6e2d8, 0x4a7fa5, 0x8a3b5c, 0x39656a, 0x9a8f6a]
const LEGS = [0x2a3040, 0x4a4038, 0x5b6470, 0x1f2226, 0x6b5a45, 0x34495c]
const SKIN = [0xf0c8a4, 0xe0b08a, 0xc68f66, 0x9a6a46, 0x6b452e]
const HAIR = [0x1c1614, 0x3b2a1e, 0x6b4a2a, 0xa9854a, 0x8c8a86, 0xcfcac0, 0x7a2f1c]

export function createCast() {
  const solid = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 })
  const ghost = new MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x6f9bd8, emissiveIntensity: 0.25 })
  const iron = new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.7 })
  const card = cardTexture()
  const cardMat = new MeshStandardMaterial({ map: card, roughness: 0.9, side: DoubleSide })
  const textures: Texture[] = [card]
  const marks: MeshBasicMaterial[] = []

  function figure(seed: number, look: Look = 'person'): Piece {
    const r = rng(seed * 7 + 3)
    const big = look === 'stranger'
    // A third over scale, the way the figures on a layout are: they are what the eye is looking for.
    const H = (big ? 1.92 : 1.56 + r() * 0.32) * 1.32
    const k = H / 1.75
    const wide = big ? 1.6 : 0.9 + r() * 0.25, deep = big ? 1.55 : 0.92 + r() * 0.2
    const skin = SKIN[(r() * SKIN.length) | 0]
    const shirt = look === 'you' ? 0x14a39a : look === 'friend' ? 0x7a4fd0 : big ? 0x54483c : SHIRTS[(r() * SHIRTS.length) | 0]
    const legs = big ? 0x2a2a2e : LEGS[(r() * LEGS.length) | 0]
    const hair = HAIR[(r() * HAIR.length) | 0]
    const dress = !big && look === 'person' && r() < 0.28
    const pose = r()
    const g: BufferGeometry[] = []
    for (const s of [-1, 1]) {
      g.push(part(new BoxGeometry(0.11, 0.07, 0.25), 0x1c1a19, [s * 0.09 * wide, 0.035, 0.035]))
      g.push(part(new CapsuleGeometry(0.072, 0.62, 3, 8), dress ? skin : legs, [s * 0.09 * wide, 0.43, 0]))
      // An arm: down by the side, or up, because somebody on a track would.
      const up = pose > 0.62 || (pose > 0.4 && s > 0)
      const tilt = up ? s * -2.55 : s * -0.13
      const ax = s * (0.235 * wide + (up ? 0.1 : 0.02)), ay = up ? 1.56 : 1.1
      g.push(part(new CapsuleGeometry(0.05, 0.46, 3, 8), shirt, [ax, ay, 0], [0, 0, tilt]))
      g.push(part(new SphereGeometry(0.056, 8, 6), skin, [ax + (up ? s * 0.16 : s * 0.035), up ? 1.82 : 0.82, 0]))
    }
    g.push(part(new SphereGeometry(0.17, 12, 8), dress ? shirt : legs, [0, 0.84, 0], [0, 0, 0], [wide, 0.6, 0.72 * deep]))
    if (dress) g.push(part(new CylinderGeometry(0.16, 0.3, 0.52, 12), shirt, [0, 0.62, 0], [0, 0, 0], [wide, 1, 0.8 * deep]))
    g.push(part(new CapsuleGeometry(0.165, 0.34, 4, 12), shirt, [0, 1.14, 0], [0, 0, 0], [wide, 1, 0.68 * deep]))
    if (big) g.push(part(new SphereGeometry(0.2, 12, 10), shirt, [0, 1.02, 0.07], [0, 0, 0], [wide * 0.95, 1, deep * 0.8]))
    g.push(part(new CylinderGeometry(0.05, 0.055, 0.1, 8), skin, [0, 1.41, 0]))
    g.push(part(new SphereGeometry(0.118, 14, 12), skin, [0, 1.56, 0], [0, 0, 0], [1, 1.12, 1.02]))
    for (const s of [-1, 1]) g.push(part(new SphereGeometry(0.013, 6, 5), 0x15110f, [s * 0.042, 1.575, 0.111]))
    const style = r()
    if (style < 0.82 || big) {
      g.push(part(new SphereGeometry(0.126, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, [0, 1.585, -0.012], [-0.25, 0, 0], [1.02, 1.1, 1.06]))
      if (style < 0.3 && !big) g.push(part(new CapsuleGeometry(0.1, 0.16, 3, 8), hair, [0, 1.47, -0.07], [0.1, 0, 0], [1.05, 1, 0.6]))
    }
    if (style > 0.9 && !big) {
      g.push(part(new CylinderGeometry(0.19, 0.19, 0.02, 14), 0x3a332c, [0, 1.655, 0]))
      g.push(part(new CylinderGeometry(0.115, 0.125, 0.11, 14), 0x3a332c, [0, 1.71, 0]))
    }
    const geo = merge(g)
    geo.scale(k, k, k)
    geo.translate(0, -H / 2, 0)
    const mesh = new Mesh(geo, look === 'ghost' ? ghost : solid)
    mesh.castShadow = look !== 'ghost'
    mesh.receiveShadow = true
    return { mesh, half: [0.25 * wide * k, H / 2, 0.17 * deep * k], mass: big ? 150 : 50 + r() * 35 }
  }

  /** A lobster, nose towards +z, lying on the bed. */
  function lobster(seed: number): Piece {
    const r = rng(seed * 13 + 1)
    const red = new Color(0xb2301e).multiplyScalar(0.85 + r() * 0.3), dark = red.clone().multiplyScalar(0.6)
    const g: BufferGeometry[] = [
      part(new CapsuleGeometry(0.1, 0.2, 4, 10), red, [0, 0, 0.08], [Math.PI / 2, 0, 0], [1.15, 1, 0.8]),
      part(new ConeGeometry(0.1, 0.12, 8), dark, [0, 0, -0.5], [-Math.PI / 2, 0, 0], [1.6, 1, 0.3]),
    ]
    for (let i = 0; i < 4; i++) g.push(part(new SphereGeometry(0.09 - i * 0.012, 10, 6), i % 2 ? dark : red, [0, -0.01, -0.1 - i * 0.095], [0, 0, 0], [1.1, 0.62, 0.8]))
    for (const s of [-1, 1]) {
      g.push(part(new CylinderGeometry(0.022, 0.022, 0.26, 6), red, [s * 0.16, 0, 0.27], [Math.PI / 2, 0, s * -0.55]))
      g.push(part(new SphereGeometry(0.07, 10, 8), red, [s * 0.23, 0, 0.44], [0, s * 0.25, 0], [0.85, 0.55, 1.7]))
      g.push(part(new CylinderGeometry(0.005, 0.005, 0.4, 4), dark, [s * 0.07, 0.07, 0.36], [1.05, 0, s * -0.3]))
      g.push(part(new SphereGeometry(0.016, 6, 5), 0x0d0b0a, [s * 0.045, 0.06, 0.24]))
      for (let i = 0; i < 3; i++) g.push(part(new CylinderGeometry(0.008, 0.008, 0.2, 4), dark, [s * 0.15, -0.04, 0.12 - i * 0.07], [0, 0, s * 1.05]))
    }
    const geo = merge(g)
    geo.scale(1.5, 1.5, 1.5)
    const mesh = new Mesh(geo, solid)
    mesh.castShadow = mesh.receiveShadow = true
    return { mesh, half: [0.37, 0.13, 0.75], mass: 3 }
  }

  /** A hen, beak towards +z. */
  function chicken(seed: number): Piece {
    const r = rng(seed * 17 + 5)
    const tone = r()
    const body = new Color(tone < 0.45 ? 0xf1eee4 : tone < 0.8 ? 0x9a5a2c : 0x2c2622).multiplyScalar(0.9 + r() * 0.2)
    const leg = 0xcf9a2e, comb = 0xb8281f
    const g: BufferGeometry[] = [
      part(new SphereGeometry(0.16, 14, 10), body, [0, 0.21, 0], [0, 0, 0], [0.92, 0.95, 1.25]),
      part(new ConeGeometry(0.11, 0.26, 8), body.clone().multiplyScalar(0.86), [0, 0.33, -0.19], [-0.75, 0, 0], [0.7, 1, 1]),
      part(new SphereGeometry(0.075, 12, 10), body, [0, 0.4, 0.14]),
      part(new CylinderGeometry(0.05, 0.075, 0.14, 8), body, [0, 0.33, 0.11], [0.5, 0, 0]),
      part(new ConeGeometry(0.022, 0.07, 6), leg, [0, 0.39, 0.225], [Math.PI / 2, 0, 0]),
      part(new BoxGeometry(0.02, 0.06, 0.09), comb, [0, 0.485, 0.14]),
      part(new SphereGeometry(0.02, 6, 5), comb, [0, 0.345, 0.2], [0, 0, 0], [0.7, 1.4, 0.7]),
    ]
    for (const s of [-1, 1]) {
      g.push(part(new SphereGeometry(0.011, 6, 5), 0x0d0b0a, [s * 0.052, 0.415, 0.19]))
      g.push(part(new SphereGeometry(0.11, 10, 8), body.clone().multiplyScalar(0.9), [s * 0.12, 0.22, -0.02], [0, 0, 0], [0.35, 0.8, 1.2]))
      g.push(part(new CylinderGeometry(0.01, 0.01, 0.1, 5), leg, [s * 0.05, 0.05, 0.02]))
      g.push(part(new BoxGeometry(0.05, 0.01, 0.08), leg, [s * 0.05, 0.005, 0.045]))
    }
    const geo = merge(g)
    geo.translate(0, -0.26, 0)
    geo.scale(1.5, 1.5, 1.5)
    const mesh = new Mesh(geo, solid)
    mesh.castShadow = mesh.receiveShadow = true
    return { mesh, half: [0.21, 0.39, 0.33], mass: 3 }
  }

  /** The points lever, on its frame. `dead` leaves the rod cut short. */
  function lever(dead: boolean) {
    const group = new Group()
    const base: BufferGeometry[] = [
      part(new BoxGeometry(1.0, 0.1, 0.56), 0x55585a, [0, 0.05, 0]),
      part(new BoxGeometry(0.72, 0.36, 0.05), 0x3b3e40, [0, 0.26, 0.14]), part(new BoxGeometry(0.72, 0.36, 0.05), 0x3b3e40, [0, 0.26, -0.14]),
      // The rod to the points: whole, or sawn through a little way out.
      part(new CylinderGeometry(0.025, 0.025, dead ? 0.7 : 2.2, 6), 0x2c2a28, [0.25, 0.1, dead ? -0.6 : -1.35], [Math.PI / 2, 0, 0]),
    ]
    if (dead) base.push(part(new CylinderGeometry(0.025, 0.025, 0.6, 6), 0x2c2a28, [0.32, 0.06, -1.75], [Math.PI / 2, 0.5, 0.2]))
    const frame = new Mesh(merge(base), iron)
    frame.castShadow = frame.receiveShadow = true
    group.add(frame)
    const arm = new Mesh(merge([
      part(new CylinderGeometry(0.03, 0.04, 1.45, 8), 0x26282a, [0, 0.72, 0]),
      part(new CylinderGeometry(0.048, 0.048, 0.34, 10), 0xb3241d, [0, 1.42, 0]),
      part(new SphereGeometry(0.06, 10, 8), 0xb3241d, [0, 1.6, 0]),
      part(new CylinderGeometry(0.06, 0.06, 0.34, 10), 0x26282a, [0, 0, 0], [Math.PI / 2, 0, 0]),
    ]), iron)
    arm.castShadow = true
    arm.position.set(0, 0.24, 0)
    group.add(arm)
    group.scale.setScalar(1.45)
    return { group, /** 0 is set for the main line, 1 thrown. */ set(t: number) { arm.rotation.z = 0.5 - t } }
  }

  /** A footbridge across the main line at x = 0, deck top at `DECK`. */
  const DECK = 5.35
  function bridge() {
    const wood = 0x7b6247, steelC = 0x4b5257
    const g: BufferGeometry[] = [part(new BoxGeometry(2.2, 0.22, 12.4), wood, [0, DECK - 0.11, 0])]
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.push(part(new BoxGeometry(0.22, DECK, 0.22), steelC, [sx * 0.95, DECK / 2 - 0.1, sz * 5.1]))
      g.push(part(new BoxGeometry(0.1, 0.1, 3.2), steelC, [sx * 0.95, DECK - 1.1, sz * 3.9], [sz * 0.72, 0, 0]))
    }
    for (const sz of [-1, 1]) {
      g.push(part(new BoxGeometry(2.0, 0.12, 0.12), steelC, [0, DECK - 0.5, sz * 5.1]))
      // Steps down to the grass at each end.
      g.push(part(new BoxGeometry(1.5, 0.16, 7.6), wood, [0, DECK / 2 - 0.1, sz * 9.75], [sz * 0.78, 0, 0]))
      for (const sx of [-1, 1]) g.push(part(new BoxGeometry(0.06, 0.06, 7.6), steelC, [sx * 0.75, DECK / 2 + 0.9, sz * 9.75], [sz * 0.78, 0, 0]))
    }
    // Handrails: all along the far side, and broken in the middle on the side the tram comes from.
    const rail = (sx: number, z0: number, z1: number) => {
      g.push(part(new BoxGeometry(0.06, 0.06, z1 - z0), steelC, [sx * 1.04, DECK + 1.05, (z0 + z1) / 2]))
      g.push(part(new BoxGeometry(0.04, 0.04, z1 - z0), steelC, [sx * 1.04, DECK + 0.55, (z0 + z1) / 2]))
      for (let z = z0; z <= z1 + 0.01; z += 1.1) g.push(part(new BoxGeometry(0.06, 1.05, 0.06), steelC, [sx * 1.04, DECK + 0.52, z]))
    }
    rail(1, -6.1, 6.1); rail(-1, -6.1, -1.3); rail(-1, 1.5, 6.1)
    const mesh = new Mesh(merge(g), solid)
    mesh.castShadow = mesh.receiveShadow = true
    return mesh
  }

  /** The crate the siding runs into: card, tape, flaps, and a question mark. */
  function crate() {
    const group = new Group()
    const Lx = 9.4, Hy = 4.9, Wz = 4.0, t = 0.08
    const wall = (sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const m = new Mesh(new BoxGeometry(sx, sy, sz), cardMat)
      m.position.set(x, y, z); m.rotation.set(rx, 0, rz)
      m.castShadow = m.receiveShadow = true
      group.add(m)
    }
    wall(Lx, Hy, t, 0, Hy / 2, Wz / 2); wall(Lx, Hy, t, 0, Hy / 2, -Wz / 2)
    wall(Lx, t, Wz, 0, Hy, 0); wall(t, Hy, Wz, Lx / 2, Hy / 2, 0)
    // Flaps at the open end, folded back.
    wall(1.6, Hy, t, -Lx / 2 - 0.55, Hy / 2, Wz / 2 + 0.55, 0, 0); group.children[group.children.length - 1].rotation.y = -0.8
    wall(1.6, Hy, t, -Lx / 2 - 0.55, Hy / 2, -Wz / 2 - 0.55, 0, 0); group.children[group.children.length - 1].rotation.y = 0.8
    wall(1.6, t, Wz, -Lx / 2 - 0.6, Hy + 0.5, 0, 0, -0.7)
    const tape = new Mesh(new BoxGeometry(Lx + 0.02, 0.02, 0.5), new MeshStandardMaterial({ color: 0xcdb98f, roughness: 0.35 }))
    tape.position.set(0, Hy + 0.045, 0)
    group.add(tape)
    const q = labelTexture('?', '#4a321c', null, '700 220px Georgia, serif')
    textures.push(q)
    const qm = new MeshBasicMaterial({ map: q, transparent: true, toneMapped: true, color: 0x8a6a48 })
    marks.push(qm)
    for (const s of [1, -1]) {
      const m = new Mesh(new PlaneGeometry(2.8, 2.8), qm)
      m.position.set(0.6, Hy / 2, s * (Wz / 2 + t / 2 + 0.005))
      if (s < 0) m.rotation.y = Math.PI
      group.add(m)
    }
    // Dark inside, whatever the hour.
    const inside = new Mesh(new PlaneGeometry(Wz - 0.2, Hy - 0.1), new MeshBasicMaterial({ color: 0x0b0806 }))
    inside.position.set(Lx / 2 - 3.2, Hy / 2, 0)
    inside.rotation.y = -Math.PI / 2
    group.add(inside)
    return { group, length: Lx }
  }

  /** A case of banknotes, open. */
  function briefcase() {
    const g: BufferGeometry[] = [
      part(new BoxGeometry(0.9, 0.16, 0.6), 0x2b2320, [0, 0.08, 0]),
      part(new BoxGeometry(0.9, 0.6, 0.05), 0x2b2320, [0, 0.4, -0.31], [-0.25, 0, 0]),
    ]
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
      g.push(part(new BoxGeometry(0.24, 0.07, 0.24), (i + j) % 2 ? 0x5f8f62 : 0x6fa06f, [-0.28 + i * 0.28, 0.2, -0.13 + j * 0.27]))
    const mesh = new Mesh(merge(g), solid)
    mesh.castShadow = mesh.receiveShadow = true
    return mesh
  }

  return {
    figure, lobster, chicken, lever, bridge, crate, briefcase, DECK,
    dispose() {
      for (const m of [solid, ghost, iron, cardMat, ...marks]) m.dispose()
      for (const t of textures) t.dispose()
    },
  }
}

export type Cast = ReturnType<typeof createCast>
