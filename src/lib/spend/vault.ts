/**
 * The money, in a warehouse: lib/spend/cash.ts's pallets, bricks, bundles and
 * notes, standing on a polished concrete floor under cool overhead light.
 *
 * Spend, and what you spent is taken: the pallets at the back lift up into
 * the dark, a brick is lifted off the top, a note floats away. Sell, and it
 * comes back down. The camera always frames what is left — the whole hall at
 * a hundred billion, and, a dollar from the end, one note lying on a pallet —
 * so the size of the fortune is something you travel through rather than a
 * number that gets shorter.
 */
import {
  ACESFilmicToneMapping, BoxGeometry, CanvasTexture, DirectionalLight, FogExp2, HemisphereLight,
  InstancedMesh, LinearMipmapLinearFilter, Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, RepeatWrapping, Scene,
  SRGBColorSpace, Texture, Vector3, WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as C from './cash'
import { noteFace, edges, bundleTop, palletSide, palletTop } from './paper'

export type Vault = {
  /** Show this balance. 'buy' takes the difference away, 'sell' puts it back, 'still' just shows it. */
  set(dollars: number, how: 'buy' | 'sell' | 'still'): void
  /** Draw at this size. Returns true while anything is still moving. */
  frame(w: number, h: number): boolean
  dispose(): void
}

type Kind = 'pallets' | 'bases' | 'bricks' | 'bundles' | 'notes' | 'c50' | 'c20' | 'c10' | 'c5' | 'c1'
const KINDS: Kind[] = ['pallets', 'bases', 'bricks', 'bundles', 'notes', 'c50', 'c20', 'c10', 'c5', 'c1']
const CAP: Record<Kind, number> = {
  pallets: C.PALLETS, bases: C.PALLETS + 1, bricks: C.BRICKS_PER_PALLET, bundles: C.BUNDLES_PER_BRICK,
  notes: C.NOTES_PER_BUNDLE, c50: 2, c20: 3, c10: 2, c5: 2, c1: 5,
}

/** The camera's fixed view: a little to the left and well above, looking down the hall. */
const PITCH = 0.56, AZIM = -0.5

export function createVault(canvas: HTMLCanvasElement, opts: { reduced: boolean }): Vault | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  const BG = 0x0a0d12
  renderer.setClearColor(BG, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.outputColorSpace = SRGBColorSpace
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())

  const scene = new Scene()
  const fog = new FogExp2(BG, 0.01)
  scene.fog = fog
  const pmrem = new PMREMGenerator(renderer)
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  /* ---- light: a cool sky of overhead fittings, one strong key for shadows -- */
  const sky = new HemisphereLight('#cfdaeb', '#0c1016', 0.5)
  const key = new DirectionalLight('#f1f5ff', 1.9)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 4
  key.shadow.bias = -0.0002
  scene.add(sky, key, key.target)

  /* ---- surfaces ------------------------------------------------------------ */
  const textures: Texture[] = []
  const tex = (c: HTMLCanvasElement, u = 1, v = 1) => {
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(u, v)
    t.anisotropy = aniso
    t.minFilter = LinearMipmapLinearFilter
    textures.push(t)
    return t
  }
  const cEdgeLong = edges(true), cEdgeShort = edges(false), cTop = bundleTop()
  const materials: Material[] = []
  const paper = (map: Texture, film = 0) => {
    const m = film
      ? new MeshPhysicalMaterial({ map, roughness: 0.82, clearcoat: film, clearcoatRoughness: 0.2, envMap: room, envMapIntensity: 0.45 })
      : new MeshStandardMaterial({ map, roughness: 0.8, envMap: room, envMapIntensity: 0.25 })
    materials.push(m)
    return m
  }
  /** Box faces in three's order: +x, −x, +y, −y, +z, −z. */
  const faces = (ends: Material, top: Material, sides: Material, bottom = top) => [ends, ends, top, bottom, sides, sides]

  // A pallet's cash under stretch film: from the side, bundle after bundle; from above, the notes.
  const blockMats = faces(
    paper(tex(cEdgeShort, C.LAYOUT.z, C.LAYOUT.y * C.BUNDLES_PER_BRICK), 0.8),
    paper(tex(cTop, C.LAYOUT.x, C.LAYOUT.z), 0.8),
    paper(tex(cEdgeLong, C.LAYOUT.x, C.LAYOUT.y * C.BUNDLES_PER_BRICK), 0.8),
  )
  const brickMats = faces(
    paper(tex(cEdgeShort, 1, C.BUNDLES_PER_BRICK), 1),
    paper(tex(cTop), 1),
    paper(tex(cEdgeLong, 1, C.BUNDLES_PER_BRICK), 1),
  )
  const bundleMats = faces(paper(tex(cEdgeShort)), paper(tex(cTop)), paper(tex(cEdgeLong)))
  const noteEdge = new MeshStandardMaterial({ color: '#e3e9e6', roughness: 0.85 })
  materials.push(noteEdge)
  const noteMats = (v: number) => faces(noteEdge, paper(tex(noteFace(v))), noteEdge)
  const wood = (c: HTMLCanvasElement) => {
    const m = new MeshStandardMaterial({ map: tex(c), roughness: 0.92, envMap: room, envMapIntensity: 0.12 })
    materials.push(m)
    return m
  }
  const woodUnder = new MeshStandardMaterial({ color: '#17130f', roughness: 1 })
  materials.push(woodUnder)
  const baseMats = [wood(palletSide(true)), wood(palletSide(true)), wood(palletTop()), woodUnder, wood(palletSide(false)), wood(palletSide(false))]

  /* ---- the pieces: what is there, and what is on its way out -------------- */
  const geo: Record<Kind, BoxGeometry> = {
    pallets: new BoxGeometry(C.BLOCK.w, C.BLOCK.h, C.BLOCK.d),
    bases: new BoxGeometry(C.BASE.w, C.BASE.h, C.BASE.d),
    bricks: new BoxGeometry(C.BRICK.w, C.BRICK.h, C.BRICK.d),
    bundles: new BoxGeometry(C.BUNDLE.w, C.BUNDLE.h, C.BUNDLE.d),
    notes: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
    c50: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
    c20: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
    c10: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
    c5: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
    c1: new BoxGeometry(C.NOTE.w, C.NOTE.h, C.NOTE.d),
  }
  const mats: Record<Kind, Material[]> = {
    pallets: blockMats, bases: baseMats, bricks: brickMats, bundles: bundleMats, notes: noteMats(100),
    c50: noteMats(50), c20: noteMats(20), c10: noteMats(10), c5: noteMats(5), c1: noteMats(1),
  }
  const make = (k: Kind) => {
    const m = new InstancedMesh(geo[k], mats[k], CAP[k])
    m.count = 0
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false
    scene.add(m)
    return m
  }
  const still = Object.fromEntries(KINDS.map((k) => [k, make(k)])) as Record<Kind, InstancedMesh>
  const gone = Object.fromEntries(KINDS.map((k) => [k, make(k)])) as Record<Kind, InstancedMesh>

  /* ---- the floor: polished concrete, cut into slabs ------------------------ */
  const floorMat = new MeshStandardMaterial({ color: '#474d55', roughness: 0.38, metalness: 0, envMap: room, envMapIntensity: 0.4 })
  materials.push(floorMat)
  const floorU = { uView: { value: 40 }, uCentre: { value: new Vector3() } }
  floorMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, floorU)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vFloorW;
uniform float uView;
uniform vec3 uCentre;
float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return fn(p) * 0.55 + fn(p * 2.1 + 7.3) * 0.3 + fn(p * 4.3 + 1.7) * 0.15; }
float joint(vec2 p, float every, float width) {
  vec2 d = abs(fract(p / every + 0.5) - 0.5) * every;
  vec2 aa = fwidth(p) * 1.2;
  vec2 j = 1.0 - smoothstep(vec2(width), vec2(width) + aa, d);
  return max(j.x, j.y);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vFloorW.xz;
  // Big clouds of trowelled concrete, smaller ones inside them, and a speckle
  // of aggregate that only shows close up.
  float big = fbm(p * 0.22), mid = fbm(p * 2.7);
  float fine = fh(floor(p * 900.0));
  float fadeMid = 1.0 - smoothstep(6.0, 40.0, uView);
  float fadeFine = 1.0 - smoothstep(0.15, 1.2, uView);
  float s = 0.84 + 0.22 * big + 0.1 * (mid - 0.5) * fadeMid + 0.1 * (fine - 0.5) * fadeFine;
  // Saw cuts every six metres, four millimetres wide, fading out when they
  // would be thinner than a pixel.
  s *= 1.0 - 0.3 * joint(p, 6.0, 0.004) * (1.0 - smoothstep(30.0, 90.0, uView));
  // The light is over the money: the floor falls away into the dark beyond it.
  float r = length(p - uCentre.xz) / max(uView, 0.05);
  s *= mix(1.0, 0.1, smoothstep(0.22, 0.95, r));
  diffuseColor.rgb *= s;
}`)
  }
  const floor = new Mesh(new PlaneGeometry(1, 1), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  /* ---- the camera ---------------------------------------------------------- */
  const camera = new PerspectiveCamera(30, 1, 0.01, 1000)
  const back = new Vector3(Math.sin(AZIM) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(AZIM) * Math.cos(PITCH))
  const fwd = back.clone().negate()
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, fwd)
  const q = new Vector3()
  const target = new Vector3(), want = new Vector3()
  let dist = 0, wantDist = 1
  let aimBox: { min: number[]; max: number[] } | null = null

  /** The nearest the camera can stand with all the points in frame, and the aim moved to centre them. */
  function fit(points: Vector3[], aim: Vector3, tanH: number, tanV: number) {
    let D = 0
    for (let pass = 0; pass < 3; pass++) {
      D = 0
      for (const p of points) {
        q.copy(p).sub(aim)
        const z = q.dot(fwd)
        D = Math.max(D, Math.abs(q.dot(right)) / tanH - z, Math.abs(q.dot(up)) / tanV - z)
      }
      let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity
      for (const p of points) {
        q.copy(p).sub(aim)
        const depth = D + q.dot(fwd)
        const sx = q.dot(right) / depth, sy = q.dot(up) / depth
        lx = Math.min(lx, sx); hx = Math.max(hx, sx); ly = Math.min(ly, sy); hy = Math.max(hy, sy)
      }
      aim.addScaledVector(right, ((lx + hx) / 2) * D).addScaledVector(up, ((ly + hy) / 2) * D)
    }
    return D
  }

  /* ---- what is where, and what is moving ----------------------------------- */
  type Piece = C.Piece
  const empty = () => Object.fromEntries(KINDS.map((k) => [k, [] as Piece[]])) as Record<Kind, Piece[]>
  let now: Record<Kind, Piece[]> = empty()
  /** Leaving: lifted away, each after its own delay. */
  let leaving: { kind: Kind; p: Piece; t0: number; spin: number }[] = []
  /** Arriving (put back): dropped in from above. */
  const arriving = new Map<string, number>()
  /** Staying but moving: a loose stack settling onto the brick below. */
  const moving = new Map<string, { from: Piece; t0: number }>()
  const o = new Object3D()

  const sort = (cash: C.Cash) => {
    const ps = C.pieces(cash)
    const by = (v: number) => ps.change.filter((c) => c.value === v)
    return { pallets: ps.pallets, bases: ps.bases, bricks: ps.bricks, bundles: ps.bundles, notes: ps.notes,
      c50: by(50), c20: by(20), c10: by(10), c5: by(5), c1: by(1) } as Record<Kind, Piece[]>
  }

  function set(dollars: number, how: 'buy' | 'sell' | 'still') {
    const cash = C.breakDown(dollars)
    const next = sort(cash)
    const t = performance.now()
    if (how !== 'still' && !opts.reduced) {
      for (const k of KINDS) {
        const was = new Map(now[k].map((p) => [p.key, p]))
        const is = new Set(next[k].map((p) => p.key))
        if (how === 'buy') {
          // The furthest go first, so a big purchase empties the hall from the back.
          const out = now[k].filter((p) => !is.has(p.key))
          out.forEach((p, i) => {
            const delay = Math.min(520, (out.length - 1 - i) * (k === 'pallets' || k === 'bases' ? 1.2 : 40))
            leaving.push({ kind: k, p, t0: t + delay, spin: (hash(i + p.y * 1000) - 0.5) })
          })
        } else {
          next[k].forEach((p, i) => { if (!was.has(p.key)) arriving.set(p.key, t + Math.min(400, i * 30)) })
        }
        for (const p of next[k]) {
          const q0 = was.get(p.key)
          if (q0 && (q0.x !== p.x || q0.y !== p.y || q0.z !== p.z)) moving.set(p.key, { from: q0, t0: t })
        }
      }
      // The flight is long enough already; the cap keeps a giant purchase drawable.
      if (leaving.length > 2400) leaving = leaving.slice(-2400)
    }
    now = next
    const b = C.bounds(cash)
    aimBox = b ?? (() => {
      const p = C.palletAt(Math.min(cash.pallets, C.PALLETS - 1))
      return { min: [p.x - C.BASE.w / 2, 0, p.z - C.BASE.d / 2], max: [p.x + C.BASE.w / 2, C.BASE.h, p.z + C.BASE.d / 2] }
    })()
    if (opts.reduced || how === 'still') dist = 0
  }

  /** How far through, eased; 0 before it starts. */
  const ease = (t: number, t0: number, dur: number) => Math.max(0, Math.min(1, (t - t0) / dur))

  function place(m: InstancedMesh, i: number, p: Piece, dx = 0, dy = 0, dz = 0, rx = 0, rz = 0) {
    o.position.set(p.x + dx, p.y + dy, p.z + dz)
    o.rotation.set(rx, p.rot ?? 0, rz)
    o.updateMatrix()
    m.setMatrixAt(i, o.matrix)
  }

  function writePieces(t: number) {
    let busy = false
    for (const k of KINDS) {
      const m = still[k], list = now[k]
      list.forEach((p, i) => {
        let dx = 0, dy = 0, dz = 0
        const mv = moving.get(p.key)
        if (mv) {
          const e = ease(t, mv.t0, 320)
          const s = e * e * (3 - 2 * e)
          dx = (mv.from.x - p.x) * (1 - s); dy = (mv.from.y - p.y) * (1 - s); dz = (mv.from.z - p.z) * (1 - s)
          if (e >= 1) moving.delete(p.key); else busy = true
        }
        const at = arriving.get(p.key)
        if (at !== undefined) {
          // Dropped from a little above, landing with one small bounce.
          const e = ease(t, at, 460)
          const fall = Math.max(p.h * 4, 0.04)
          const h = e < 0.7 ? 1 - Math.pow(e / 0.7, 2) : 0.06 * Math.sin(((e - 0.7) / 0.3) * Math.PI)
          // Not yet: out of the way until its turn comes.
          dy += fall * h + (t < at ? 1e4 : 0)
          if (e >= 1) arriving.delete(p.key); else busy = true
        }
        place(m, i, p, dx, dy, dz)
      })
      m.count = list.length
      m.instanceMatrix.needsUpdate = true
    }
    // The ones on their way out: up and away, faster as they go; notes flutter.
    const counts: Record<string, number> = {}
    leaving = leaving.filter((f) => t - f.t0 < 1300)
    for (const f of leaving) {
      const i = counts[f.kind] ?? 0
      if (i >= CAP[f.kind]) continue
      counts[f.kind] = i + 1
      const e = ease(t, f.t0, 1300)
      const size = Math.max(f.p.w, f.p.h, f.p.d)
      const paperish = f.kind === 'notes' || f.kind[0] === 'c'
      const lift = size * (paperish ? 4 : 9) * e * e
      const sway = paperish ? Math.sin(e * 9 + f.spin * 6) * size * 0.25 * e : 0
      place(gone[f.kind], i, f.p, sway, lift, 0, f.spin * e * (paperish ? 1.6 : 0.08), f.spin * e * (paperish ? 0.9 : 0.05))
    }
    for (const k of KINDS) {
      gone[k].count = counts[k] ?? 0
      gone[k].instanceMatrix.needsUpdate = true
    }
    return busy || leaving.length > 0
  }

  const corners = Array.from({ length: 8 }, () => new Vector3())
  function frame(w: number, h: number) {
    if (w < 2 || h < 2) return false
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const t = performance.now()
    let busy = writePieces(t)

    // Frame what is left: the box round the money, a little room around it.
    if (aimBox) {
      const [x0, y0, z0] = aimBox.min, [x1, y1, z1] = aimBox.max
      let i = 0
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners[i++].set(x, y, z)
      const tanV = Math.tan((camera.fov * Math.PI) / 360), tanH = tanV * camera.aspect
      want.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
      wantDist = fit(corners, want, tanH * 0.84, tanV * 0.8)
    }
    if (!dist) { dist = wantDist; target.copy(want) }
    else {
      // Through a range of a few hundred to one, so ease the distance in log space.
      const k = 0.075
      dist = Math.exp(Math.log(dist) + (Math.log(wantDist) - Math.log(dist)) * k)
      target.lerp(want, k)
      if (Math.abs(Math.log(wantDist / dist)) > 0.002 || target.distanceTo(want) > wantDist * 0.001) busy = true
    }
    camera.position.copy(target).addScaledVector(back, dist)
    camera.near = dist * 0.01
    camera.far = dist * 60
    camera.lookAt(target)
    camera.updateProjectionMatrix()

    // The floor runs off into the dark in every direction; the haze is scaled
    // to the view, so the back of the hall fades at a hundred billion and the
    // pallet's far edge does a dollar from the end.
    floor.scale.set(dist * 60, dist * 60, 1)
    floor.position.set(target.x, 0, target.z)
    const view = 2 * dist * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
    floorU.uView.value = view
    floorU.uCentre.value.copy(target)
    fog.density = 0.38 / dist

    // The key light follows the framing, so its shadows are as sharp as the map allows.
    const L = Math.max(view, 0.3)
    key.position.copy(target).add(new Vector3(-0.55, 1.5, 0.35).multiplyScalar(L * 1.4))
    key.target.position.copy(target)
    const sc = key.shadow.camera
    sc.left = -L; sc.right = L; sc.top = L; sc.bottom = -L
    sc.near = L * 0.05; sc.far = L * 5
    sc.updateProjectionMatrix()
    key.shadow.normalBias = L * 0.0008

    renderer.render(scene, camera)
    return busy
  }

  return {
    set,
    frame,
    dispose() {
      renderer.dispose()
      for (const t of textures) t.dispose()
      for (const m of materials) m.dispose()
      for (const g of Object.values(geo)) g.dispose()
      room.dispose()
      pmrem.dispose()
    },
  }
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
