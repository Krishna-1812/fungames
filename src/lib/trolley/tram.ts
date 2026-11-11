/**
 * The tram.
 *
 * A single-truck heritage car: enamel red below the waist, cream above it,
 * a clerestory roof, a trolley pole reaching back to the wire, a driver at
 * the front and a number on the side. It is the thing the game is named
 * after, so it is the most-built object on the layout.
 *
 * The origin is the middle of the car at rail-top height. The body sits on
 * springs (`body`), separate from the truck and the two wheelsets, so braking
 * can pitch it forward and a curve can lean it while the wheels stay down.
 */
import {
  BoxGeometry, CanvasTexture, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, PlaneGeometry, PointLight, Shape, SphereGeometry, SpotLight, Sprite, SpriteMaterial, AdditiveBlending,
} from 'three'
import type { BufferGeometry, Texture } from 'three'
import { labelTexture, merge, part, puffTexture } from './kit'
import { TRACK } from './track'

export const TRAM = {
  /** Half extents of the box the physics pushes with, and where its middle is above the rail. */
  HALF: [3.62, 1.52, 1.17] as [number, number, number],
  MID: 1.5,
  /** Wheelset positions fore and aft of the middle. */
  AXLE: 1.3,
  WHEEL: 0.4,
}

const RED = 0x9a1d1b, CREAM = 0xeadfc6, IRON = 0x1d1b1a, ROOF = 0x5c5f63, WOOD = 0x6e4a2e

function plan(L: number, W: number, r: number) {
  const s = new Shape(), x = L / 2, z = W / 2
  s.moveTo(-x + r, -z)
  s.lineTo(x - r, -z); s.absarc(x - r, -z + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x, z - r); s.absarc(x - r, z - r, r, 0, Math.PI / 2, false)
  s.lineTo(-x + r, z); s.absarc(-x + r, z - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-x, -z + r); s.absarc(-x + r, -z + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/** A slab with the car's rounded plan, from one height to another. */
function slab(L: number, W: number, r: number, y0: number, y1: number, color: number, bevel = 0): BufferGeometry {
  const g = new ExtrudeGeometry(plan(L, W, r), {
    depth: y1 - y0 - bevel, curveSegments: 12, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, bevelOffset: -bevel,
  })
  g.rotateX(-Math.PI / 2)
  return part(g, color, [0, y0, 0])
}

export function buildTram() {
  const group = new Group(), body = new Group()
  group.add(body)
  const textures: Texture[] = []

  const paint = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12 })
  const matte = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.1 })
  const steel = new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.95 })
  const glass = new MeshPhysicalMaterial({
    color: 0xc4dbe6, transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, envMapIntensity: 1.8, depthWrite: false,
  })
  const L = 7.1, W = 2.3, R = 0.86

  /* ---- paintwork ---- */
  const painted: BufferGeometry[] = [
    slab(L, W, R, 0.5, 1.5, RED),
    slab(L + 0.05, W + 0.05, R + 0.02, 1.5, 1.62, CREAM),
    slab(L + 0.05, W + 0.05, R + 0.02, 2.5, 2.68, CREAM),
    // Lining round the lower panel, the way a paint shop finishes one.
    slab(L + 0.012, W + 0.012, R, 0.62, 0.66, CREAM),
    slab(L + 0.012, W + 0.012, R, 1.36, 1.39, CREAM),
  ]
  // Window pillars, set round the plan.
  const ring = plan(L - 0.04, W - 0.04, R - 0.02).getSpacedPoints(22)
  ring.pop()
  ring.forEach((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[(i + 1) % ring.length]
    const turn = Math.atan2(b.y - a.y, b.x - a.x)
    painted.push(part(new BoxGeometry(0.1, 0.9, 0.07), CREAM, [p.x, 2.06, -p.y], [0, turn, 0]))
  })
  body.add(new Mesh(merge(painted), paint))

  /* ---- everything unpainted on the body ---- */
  const dull: BufferGeometry[] = [
    slab(L + 0.16, W + 0.16, R + 0.06, 2.68, 2.9, ROOF, 0.1),
    slab(5.2, 1.3, 0.4, 2.86, 3.08, ROOF, 0.07),
    slab(L - 0.1, W - 0.1, R - 0.04, 0.42, 0.5, IRON),
    // Fenders and the slatted lifeguard under each end.
    part(new BoxGeometry(0.14, 0.2, 1.9), IRON, [3.62, 0.36, 0]), part(new BoxGeometry(0.14, 0.2, 1.9), IRON, [-3.62, 0.36, 0]),
    part(new BoxGeometry(0.7, 0.05, 1.8), IRON, [3.25, 0.02, 0], [0, 0, 0.5]), part(new BoxGeometry(0.7, 0.05, 1.8), IRON, [-3.25, 0.02, 0], [0, 0, -0.5]),
    // Inside: a floor, two long benches, the controller.
    slab(L - 0.3, W - 0.3, R - 0.1, 0.5, 0.56, 0x3a2c22),
    part(new BoxGeometry(3.9, 0.36, 0.4), WOOD, [0, 0.95, 0.78]), part(new BoxGeometry(3.9, 0.36, 0.4), WOOD, [0, 0.95, -0.78]),
    part(new BoxGeometry(3.9, 0.5, 0.06), WOOD, [0, 1.3, 0.98]), part(new BoxGeometry(3.9, 0.5, 0.06), WOOD, [0, 1.3, -0.98]),
    part(new CylinderGeometry(0.11, 0.13, 0.9, 10), IRON, [2.95, 1.0, 0.35]),
    part(new BoxGeometry(0.06, 0.9, 2.0), CREAM, [2.2, 2.0, 0]), part(new BoxGeometry(0.06, 0.9, 2.0), CREAM, [-2.2, 2.0, 0]),
    // Steps.
    part(new BoxGeometry(0.7, 0.05, 0.3), IRON, [2.75, 0.3, 1.25]), part(new BoxGeometry(0.7, 0.05, 0.3), IRON, [-2.75, 0.3, 1.25]),
    part(new BoxGeometry(0.7, 0.05, 0.3), IRON, [2.75, 0.3, -1.25]), part(new BoxGeometry(0.7, 0.05, 0.3), IRON, [-2.75, 0.3, -1.25]),
    // The driver: a uniform, a face, a cap.
    part(new CylinderGeometry(0.2, 0.24, 0.62, 10), 0x232a3c, [2.85, 1.72, -0.2]),
    part(new SphereGeometry(0.13, 12, 10), 0xd6a887, [2.87, 2.18, -0.2]),
    part(new CylinderGeometry(0.14, 0.14, 0.07, 12), 0x1a2030, [2.88, 2.3, -0.2]),
    part(new BoxGeometry(0.16, 0.02, 0.2), 0x1a2030, [3.0, 2.27, -0.2]),
    // Trolley pole and its base.
    part(new CylinderGeometry(0.16, 0.2, 0.14, 10), IRON, [-0.3, 3.12, 0]),
    part(new CylinderGeometry(0.022, 0.03, 3.42, 6), IRON, [-1.82, 3.82, 0], [0, 0, Math.PI / 2 - Math.atan2(TRACK.RAIL + 4.52 - 3.12 - TRACK.RAIL, 3.05)]),
    // Lamp housings, front and back.
    part(new CylinderGeometry(0.17, 0.17, 0.12, 14), IRON, [3.56, 1.02, 0], [0, 0, Math.PI / 2]),
    part(new CylinderGeometry(0.17, 0.17, 0.12, 14), IRON, [-3.56, 1.02, 0], [0, 0, Math.PI / 2]),
    part(new BoxGeometry(0.1, 0.26, 1.0), IRON, [3.5, 2.59, 0]), part(new BoxGeometry(0.1, 0.26, 1.0), IRON, [-3.5, 2.59, 0]),
  ]
  body.add(new Mesh(merge(dull), matte))

  const panes = new Mesh(slab(L - 0.1, W - 0.1, R - 0.04, 1.62, 2.5, 0xffffff), glass)
  panes.renderOrder = 2
  body.add(panes)

  /* ---- the number: on both sides and on the board at the front ---- */
  const numMat = new MeshBasicMaterial({ transparent: true, toneMapped: true, color: 0xf1e7cf })
  const boardMat = new MeshBasicMaterial({ color: 0xffffff })
  const side = (z: number, flip: boolean) => {
    const m = new Mesh(new PlaneGeometry(0.62, 0.62), numMat)
    m.position.set(0, 1.0, z)
    if (flip) m.rotation.y = Math.PI
    body.add(m)
  }
  side(W / 2 + 0.006, false); side(-W / 2 - 0.006, true)
  const board = new Mesh(new PlaneGeometry(0.9, 0.2), boardMat)
  board.position.set(3.556, 2.59, 0)
  board.rotation.y = Math.PI / 2
  body.add(board)
  let numTex: CanvasTexture | null = null, boardTex: CanvasTexture | null = null
  function setNumber(n: number) {
    numTex?.dispose(); boardTex?.dispose()
    numTex = labelTexture(String(n), '#f1e7cf', null, '700 190px Georgia, serif')
    boardTex = labelTexture(`${n}  ·  JUNCTION`, '#f4f0e4', '#15171c', '700 44px system-ui, sans-serif', 512, 112)
    numMat.map = numTex; numMat.needsUpdate = true
    boardMat.map = boardTex; boardMat.needsUpdate = true
  }

  /* ---- lamps ---- */
  const lensMat = new MeshBasicMaterial({ color: 0xfff1cf })
  const lens = new Mesh(new CylinderGeometry(0.135, 0.135, 0.02, 16), lensMat)
  lens.rotation.z = Math.PI / 2
  lens.position.set(3.63, 1.02, 0)
  body.add(lens)
  const puff = puffTexture()
  textures.push(puff)
  const glowMat = new SpriteMaterial({ map: puff, color: 0xffe9bd, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })
  const glow = new Sprite(glowMat)
  glow.position.set(3.7, 1.02, 0)
  glow.scale.setScalar(2.4)
  body.add(glow)
  const beam = new SpotLight(0xffe2ae, 0, 46, 0.42, 0.7, 1.4)
  beam.position.set(3.6, 1.05, 0)
  beam.target.position.set(14, -0.6, 0)
  body.add(beam, beam.target)
  const cabin = new PointLight(0xffd9a0, 0, 7, 1.6)
  cabin.position.set(0, 2.3, 0)
  body.add(cabin)
  const ceilMat = new MeshBasicMaterial({ color: 0x000000 })
  const ceil = new Mesh(new PlaneGeometry(5.6, 1.6), ceilMat)
  ceil.rotation.x = Math.PI / 2
  ceil.position.set(0, 2.49, 0)
  body.add(ceil)
  function setLamps(k: number) {
    lensMat.color.setRGB(0.45 + 2.6 * k, 0.42 + 2.2 * k, 0.36 + 1.5 * k)
    glowMat.opacity = 0.12 + 0.75 * k
    beam.intensity = 260 * k
    cabin.intensity = 9 * k
    ceilMat.color.setRGB(1.6 * k, 1.25 * k, 0.8 * k)
  }

  /* ---- the truck and its wheels: these stay level ---- */
  const frame: BufferGeometry[] = [
    part(new BoxGeometry(3.7, 0.2, 0.12), IRON, [0, 0.36, 0.86]), part(new BoxGeometry(3.7, 0.2, 0.12), IRON, [0, 0.36, -0.86]),
    part(new BoxGeometry(0.16, 0.16, 1.7), IRON, [0, 0.36, 0]),
  ]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    frame.push(part(new BoxGeometry(0.34, 0.3, 0.14), IRON, [sx * TRAM.AXLE, 0.38, sz * 0.9]))
    // A leaf spring over each axle box.
    frame.push(part(new BoxGeometry(0.9, 0.05, 0.1), 0x2c2a28, [sx * TRAM.AXLE, 0.58, sz * 0.9]))
    frame.push(part(new BoxGeometry(0.6, 0.05, 0.1), 0x2c2a28, [sx * TRAM.AXLE, 0.63, sz * 0.9]))
  }
  group.add(new Mesh(merge(frame), matte))
  const sets = [-1, 1].map((sx) => {
    const g: BufferGeometry[] = [part(new CylinderGeometry(0.06, 0.06, 1.7, 8), 0x3a3836, [0, 0, 0], [Math.PI / 2, 0, 0])]
    for (const sz of [-1, 1]) {
      g.push(part(new CylinderGeometry(TRAM.WHEEL, TRAM.WHEEL, 0.1, 22), 0xb9b4ae, [0, 0, sz * TRACK.GAUGE], [Math.PI / 2, 0, 0]))
      g.push(part(new CylinderGeometry(TRAM.WHEEL + 0.045, TRAM.WHEEL + 0.045, 0.03, 22), 0xb9b4ae, [0, 0, sz * (TRACK.GAUGE - 0.065)], [Math.PI / 2, 0, 0]))
      g.push(part(new CylinderGeometry(0.29, 0.29, 0.12, 16), 0x5a1513, [0, 0, sz * TRACK.GAUGE], [Math.PI / 2, 0, 0]))
      // Spokes, so a turning wheel is seen to turn.
      for (let k = 0; k < 4; k++) g.push(part(new BoxGeometry(0.56, 0.05, 0.125), 0x1b1a19, [0, 0, sz * TRACK.GAUGE], [0, 0, (k * Math.PI) / 4]))
    }
    const m = new Mesh(merge(g), steel)
    m.position.set(sx * TRAM.AXLE, TRAM.WHEEL, 0)
    group.add(m)
    return m
  })

  group.traverse((o) => { const m = o as Mesh; if (m.isMesh && m !== panes && m.material !== numMat) { m.castShadow = true; m.receiveShadow = true } })
  setNumber(1)
  setLamps(0)

  return {
    group, body, sets, setNumber, setLamps,
    /** Where the pole meets the wire, in the car's own frame, for sparks. */
    shoe: [-3.35, 4.52, 0] as [number, number, number],
    dispose() {
      group.traverse((o) => { const m = o as Mesh; m.geometry?.dispose() })
      for (const m of [paint, matte, steel, glass, numMat, boardMat, lensMat, glowMat, ceilMat]) m.dispose()
      numTex?.dispose(); boardTex?.dispose()
      for (const t of textures) t.dispose()
    },
  }
}

export type Tram = ReturnType<typeof buildTram>
