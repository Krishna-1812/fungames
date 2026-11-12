/**
 * The sheet on the table, in three dimensions.
 *
 * The stage used to be painted: flat polygons, a fibre pattern laid over them,
 * a blurred shape for a shadow. It was a careful drawing of a sheet of paper.
 * This is a sheet of paper. It has a surface you can see the fibres in because
 * light rakes across them, an edge made of as many layers as the stack really
 * has (until there are too many to tell apart, when they blur into an edge
 * colour, the way they do), a shadow that is cast rather than drawn, and a
 * flap that rolls over the way paper does (curl.ts) rather than swinging on a
 * hinge.
 *
 * It lies on a cutting mat with a centimetre grid, because the game is about
 * size and nothing says how small a folded sheet has got like the squares it
 * no longer covers. The grid follows the camera down through the decades —
 * centimetres, then millimetres — so there is always a ruler in view.
 *
 * Nothing here decides anything. The page still owns the folding: how far
 * the hand has pulled, how many folds the sheet allows, which way it turns.
 * This only draws what it is told, the same way fold-scene.ts did, and the
 * page keeps that as its fallback if there is no WebGL.
 *
 * Units are the page's normalised ones (the sheet's largest dimension near 1),
 * with `mm` saying how many millimetres one of them is.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture,
  Color, CylinderGeometry, SpotLight, DoubleSide, Group, HemisphereLight, LinearMipmapLinearFilter,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry,
  PMREMGenerator, RepeatWrapping, Scene, ShaderMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Texture,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { curl } from './curl'
import { periodic } from '../memo/tooth'

export type Look = 'a4' | 'note' | 'tissue' | 'roll' | 'pitch' | 'leaf'

export type TableState = {
  look: string
  /** Half the sheet's width (along the fold, x) and depth (z), and its height, in scene units. */
  halfW: number
  halfD: number
  height: number
  /** Millimetres in one scene unit. */
  mm: number
  /** Layers in the stack (2^n), for the edge. */
  layers: number
  /** The fold under the hand, 0..1. */
  u: number
  /** The quarter turn after an alternating fold. */
  yaw: number
  /** Where the last crease is: none yet, the right-hand end, or the near side. */
  lip: 'none' | 'x' | 'z'
  /** How much desk there is, 0..1: it fades as the stack leaves the room. */
  ground: number
  /** The imaginary column above the stack, 0..1, and its colour. */
  column: number
  accent: [number, number, number]
  /** A squash as a crease is pressed down, 0..1. */
  press: number
}

type LookDef = {
  color: string
  edge: string
  rough: number
  metal?: number
  relief: 'paper' | 'crinkle' | 'quilt' | 'beaten'
  normal: number
  env: number
  /** Millimetres one tile of the relief covers. */
  tile: number
  /** How much of the lamp shows through a sheet lit from behind. */
  trans: number
}

const LOOKS: Record<Look, LookDef> = {
  a4: { color: '#e9ecef', edge: '#c9cfd8', rough: 0.84, relief: 'paper', normal: 0.8, env: 0.1, tile: 24, trans: 0.85 },
  note: { color: '#c9d3c1', edge: '#a4b19c', rough: 0.78, relief: 'paper', normal: 1.0, env: 0.1, tile: 20, trans: 0.5 },
  tissue: { color: '#f1f4f8', edge: '#dce1e8', rough: 0.95, relief: 'crinkle', normal: 0.8, env: 0.08, tile: 60, trans: 0.85 },
  roll: { color: '#eef0f3', edge: '#d7dce3', rough: 0.95, relief: 'quilt', normal: 0.8, env: 0.08, tile: 16, trans: 0.75 },
  pitch: { color: '#f1f4f8', edge: '#dce1e8', rough: 0.95, relief: 'crinkle', normal: 0.8, env: 0.08, tile: 60, trans: 0.85 },
  leaf: { color: '#e7bf62', edge: '#b88a34', rough: 0.3, metal: 1, relief: 'beaten', normal: 0.75, env: 1.1, tile: 30, trans: 0 },
}

/* ---------------------------------------------------------------------------
   Textures, grown once
   --------------------------------------------------------------------------- */

const SIDE = 256

/** A tileable relief, as a normal map: paper fibre, tissue crinkle, quilting, beaten metal. */
function reliefMap(kind: LookDef['relief']): Texture {
  const S = SIDE, n = S * S
  const h = new Float32Array(n)
  if (kind === 'paper') {
    periodic(S, 64, 64, 3, h, 0.5)
    periodic(S, 20, 140, 5, h, 0.45)    // fibres, laid one way
    periodic(S, 140, 26, 7, h, 0.25)
  } else if (kind === 'crinkle') {
    periodic(S, 5, 7, 11, h, 1)
    periodic(S, 13, 11, 13, h, 0.45)
    periodic(S, 48, 48, 17, h, 0.2)
  } else if (kind === 'beaten') {
    const t = new Float32Array(n)
    periodic(S, 6, 5, 19, t, 1)
    periodic(S, 15, 17, 23, t, 0.5)
    // Ridges where the hammer folded the leaf: the creases of crumpled foil.
    for (let i = 0; i < n; i++) h[i] = 0.6 - Math.abs(t[i])
    periodic(S, 60, 60, 29, h, 0.08)
  } else {
    // Quilting: a grid of soft pillows pressed into a tissue.
    periodic(S, 60, 60, 31, h, 0.25)
    const cells = 8
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = ((x / S) * cells) % 1 - 0.5, fy = ((y / S) * cells) % 1 - 0.5
      h[y * S + x] += 0.9 * Math.exp(-(fx * fx + fy * fy) * 14)
    }
  }
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  const img = g.createImageData(S, S)
  const k = kind === 'paper' ? 2.2 : kind === 'quilt' ? 4 : 3
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x
    const dx = (h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)]) * k
    const dy = (h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]) * k
    const l = Math.hypot(dx, dy, 1)
    img.data[i * 4] = ((-dx / l) * 0.5 + 0.5) * 255
    img.data[i * 4 + 1] = ((dy / l) * 0.5 + 0.5) * 255
    img.data[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(cv)
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  return t
}

/**
 * The cut edge of a stack: one sheet, then the hairline gap to the next,
 * repeated as many times as there are layers. Mipmapped, so when there are
 * more layers than pixels they average into the edge's own colour instead of
 * shimmering — which is what a real stack's edge does too.
 */
function laminations(): Texture {
  const cv = document.createElement('canvas')
  cv.width = 4; cv.height = 16
  const g = cv.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 4, 16)
  g.fillStyle = '#c9ced6'; g.fillRect(0, 13, 4, 2)
  g.fillStyle = '#9da4af'; g.fillRect(0, 15, 4, 1)
  const t = new CanvasTexture(cv)
  t.wrapS = t.wrapT = RepeatWrapping
  t.minFilter = LinearMipmapLinearFilter
  t.colorSpace = SRGBColorSpace
  return t
}

/** A soft dark pool, for the shadow right under the paper that no light reaches. */
function pool(): Texture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const g = cv.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(0,0,0,1)')
  grd.addColorStop(0.55, 'rgba(0,0,0,0.6)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(cv)
}

/* ---------------------------------------------------------------------------
   The flap, rebuilt from the curl every frame
   --------------------------------------------------------------------------- */

const SEG = 72

/**
 * The flap as a slab following the curl: its top and bottom faces, its two
 * cut sides and its free edge. Positions are rewritten in place each frame;
 * the topology never changes.
 */
function flapGeometry() {
  const geo = new BufferGeometry()
  // Per station along the flap: top-near, top-far, bottom-near, bottom-far,
  // and each duplicated for the sides so they get their own normals and UVs.
  const V = (SEG + 1) * 8 + 8
  geo.setAttribute('position', new BufferAttribute(new Float32Array(V * 3), 3))
  geo.setAttribute('normal', new BufferAttribute(new Float32Array(V * 3), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(V * 2), 2))
  const idx: number[] = []
  const top: number[] = [], bottom: number[] = [], sides: number[] = []
  const base = (i: number) => i * 8
  for (let i = 0; i < SEG; i++) {
    const a = base(i), b = base(i + 1)
    // top: 0 near, 1 far
    top.push(a, b, a + 1, a + 1, b, b + 1)
    // bottom: 2 near, 3 far (wound the other way)
    bottom.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3)
    // near side: 4 top, 5 bottom
    sides.push(a + 4, a + 5, b + 4, b + 4, a + 5, b + 5)
    // far side: 6 top, 7 bottom
    sides.push(a + 6, b + 6, a + 7, a + 7, b + 6, b + 7)
  }
  const e = (SEG + 1) * 8
  sides.push(e, e + 2, e + 1, e + 1, e + 2, e + 3)
  idx.push(...top, ...bottom, ...sides)
  geo.setIndex(idx)
  geo.addGroup(0, top.length, 0)
  geo.addGroup(top.length, bottom.length, 1)
  geo.addGroup(top.length + bottom.length, sides.length, 2)
  return geo
}

function writeFlap(geo: BufferGeometry, a: number, b: number, h: number, u: number, mm: number, tile: number) {
  const P = geo.getAttribute('position') as BufferAttribute
  const N = geo.getAttribute('normal') as BufferAttribute
  const T = geo.getAttribute('uv') as BufferAttribute
  const c = curl(u, a, h)
  const half = h / 2
  // The relief is laid in millimetres of paper, so it travels with the paper
  // round the bend instead of sliding across it.
  const uvk = mm / tile
  for (let i = 0; i <= SEG; i++) {
    const s = (a * i) / SEG
    const p = c.at(s)
    const tx = p.x + p.nx * half, ty = p.y + p.ny * half
    const bx = p.x - p.nx * half, by = p.y - p.ny * half
    const o = i * 8
    const set = (k: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, uu: number, vv: number) => {
      P.setXYZ(o + k, x, y, z); N.setXYZ(o + k, nx, ny, nz); T.setXY(o + k, uu, vv)
    }
    const su = s * uvk
    set(0, tx, ty, b, p.nx, p.ny, 0, su, 0)
    set(1, tx, ty, -b, p.nx, p.ny, 0, su, 2 * b * uvk)
    set(2, bx, by, b, -p.nx, -p.ny, 0, su, 0)
    set(3, bx, by, -b, -p.nx, -p.ny, 0, su, 2 * b * uvk)
    // Sides: v runs across the thickness, so the laminations land on them.
    set(4, tx, ty, b, 0, 0, 1, s, 1)
    set(5, bx, by, b, 0, 0, 1, s, 0)
    set(6, tx, ty, -b, 0, 0, -1, s, 1)
    set(7, bx, by, -b, 0, 0, -1, s, 0)
  }
  // The free edge.
  const p = c.at(a)
  const tx = p.x + p.nx * half, ty = p.y + p.ny * half, bx = p.x - p.nx * half, by = p.y - p.ny * half
  const ex = Math.cos(c.theta), ey = Math.sin(c.theta)
  const e = (SEG + 1) * 8
  P.setXYZ(e, tx, ty, b); P.setXYZ(e + 1, tx, ty, -b); P.setXYZ(e + 2, bx, by, b); P.setXYZ(e + 3, bx, by, -b)
  for (let k = 0; k < 4; k++) N.setXYZ(e + k, ex, ey, 0)
  T.setXY(e, 0, 1); T.setXY(e + 1, 1, 1); T.setXY(e + 2, 0, 0); T.setXY(e + 3, 1, 0)
  P.needsUpdate = N.needsUpdate = T.needsUpdate = true
  geo.computeBoundingSphere()
}

/* ---------------------------------------------------------------------------
   The mat
   --------------------------------------------------------------------------- */

/**
 * A self-healing cutting mat: deep slate, faintly mottled, with a grid
 * printed on it. The grid is in real millimetres and picks its decade from
 * how much of the mat is in view, cross-fading between them, so there is
 * always a ruler at a readable size under the paper.
 */
function matMaterial() {
  const m = new MeshStandardMaterial({ color: '#3a4757', roughness: 0.9, metalness: 0, transparent: true, envMapIntensity: 0.05 })
  const uni = {
    uMm: { value: 1 },
    uStep: { value: 10 },
    uFine: { value: 1 },
    uFade: { value: 1 },
    uCentre: { value: new Vector2() },
    uRadius: { value: 4 },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMatW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMatW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vMatW;
uniform float uMm, uStep, uFine, uFade, uRadius;
uniform vec2 uCentre;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float gridAt(vec2 p) {
  vec2 d = abs(fract(p - 0.5) - 0.5) / max(fwidth(p), vec2(1e-5));
  return 1.0 - clamp(min(d.x, d.y) * 1.3 - 0.15, 0.0, 1.0);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 q = (vMatW.xz - uCentre) * uMm;
  float mot = vnoise(q / 38.0) * 0.6 + vnoise(q / 9.0) * 0.4;
  diffuseColor.rgb *= 0.9 + 0.16 * mot;
  float minor = gridAt(q / uStep) * uFine;
  float major = gridAt(q / (uStep * 10.0));
  float mid = gridAt(q / (uStep * 5.0)) * 0.5;
  float line = max(max(minor * 0.05, mid * 0.08), major * 0.14);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.65, 0.76), line);
  float r = length(vMatW.xz - uCentre);
  diffuseColor.a *= uFade * (1.0 - smoothstep(uRadius * 0.55, uRadius, r));
}`)
  }
  return { m, uni }
}

/* ---------------------------------------------------------------------------
   The column: the stack, after there is no more paper
   --------------------------------------------------------------------------- */

function columnMaterial() {
  return new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uColor: { value: new Color() }, uStrength: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float face = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(face, 3.0);
        float rise = smoothstep(0.0, 0.004, vY);
        vec3 c = mix(uColor, vec3(1.0, 0.99, 0.96), core * 0.85);
        gl_FragColor = vec4(c * (0.25 + 1.2 * core) * uStrength * rise, 1.0);
      }`,
  })
}

/* ---------------------------------------------------------------------------
   The table
   --------------------------------------------------------------------------- */

export type Table = {
  /** Draw this state at this size. Returns false if it could not draw at all. */
  render(s: TableState, w: number, h: number): boolean
  /** Where the free edge of the sheet is on screen, for the hint to grab it. */
  grip(): { x: number; y: number } | null
  /** Whether the camera is still easing to its new framing. */
  settling(): boolean
  dispose(): void
}

export function createTable(canvas: HTMLCanvasElement): Table | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setClearColor(0x000000, 0)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  /* The room's reflections, given to each material rather than to the scene:
     a scene-wide environment ignores each material's own envMapIntensity in
     this version of three, and at full strength it floods white paper to a
     single flat value whatever the lamp is doing. */
  const pmrem = new PMREMGenerator(renderer)
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const camera = new PerspectiveCamera(30, 1, 0.001, 5000)

  // A cool desk lamp up and to the back left, throwing a pool of light that falls
  // away across the mat, and a little of the room's own light.
  const key = new SpotLight('#f1f5ff', 3.3, 0, 0.4, 1, 0)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0002
  // Soft at the edges, because a lamp is not a point.
  key.shadow.radius = 5
  key.shadow.blurSamples = 16
  scene.add(key, key.target)
  const fill = new HemisphereLight('#cfd9e8', '#141a22', 0.3)
  scene.add(fill)

  const lam = laminations()
  const reliefs = new Map<string, Texture>()
  const relief = (k: LookDef['relief']) => {
    let t = reliefs.get(k)
    if (!t) { t = reliefMap(k); reliefs.set(k, t) }
    return t
  }

  // The stack's faces and the flap's are the same paper, but the stack is a
  // box scaled to size (its relief repeat set per size) while the flap writes
  // its own millimetre UVs (repeat 1) — so each gets its own copy of the map.
  const faceMat = new MeshStandardMaterial()
  const underMat = new MeshStandardMaterial()
  const flapFace = new MeshStandardMaterial({ side: DoubleSide })
  const flapUnder = new MeshStandardMaterial({ side: DoubleSide })
  /* Thin paper lit from behind glows: some of the lamp comes straight
     through it. So the side of the flap facing away from the lamp gets a
     share of the lamp's light back, in the paper's own colour — the single
     strongest cue that a raised sheet is paper rather than card. */
  const glow = { uLight: { value: new Vector3(0, 1, 0) }, uTrans: { value: 0.5 } }
  for (const m of [flapFace, flapUnder]) m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, glow)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLight;\nuniform float uTrans;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
reflectedLight.indirectDiffuse += diffuseColor.rgb * uTrans * pow(max(0.0, -dot(normal, uLight)), 1.3);`)
  }
  const edgeMat = new MeshStandardMaterial({ map: lam })
  const paper = [flapFace, flapUnder, edgeMat]
  let stackRelief: Texture | null = null

  // The sheet turns as a whole; everything that is paper goes in here.
  const sheet = new Group()
  scene.add(sheet)

  // The stack: a box, its edges striped with its layers.
  const stackGeo = new BoxGeometry(1, 1, 1)
  // px, nx, py, ny, pz, nz
  const stack = new Mesh(stackGeo, [edgeMat, edgeMat, faceMat, underMat, edgeMat, edgeMat])
  stack.castShadow = stack.receiveShadow = true
  sheet.add(stack)

  // The lip: the last crease, a half-round the height of the stack.
  const lipGeo = new CylinderGeometry(0.5, 0.5, 1, 40, 1, false, 0, Math.PI)
  const lip = new Mesh(lipGeo, [faceMat, edgeMat, edgeMat])
  lip.castShadow = lip.receiveShadow = true
  sheet.add(lip)

  // The flap.
  const flapGeo = flapGeometry()
  const flap = new Mesh(flapGeo, paper)
  flap.castShadow = flap.receiveShadow = true
  sheet.add(flap)

  // The mat, and the dark pool right under the paper.
  const { m: matMat, uni: matU } = matMaterial()
  matMat.envMap = room
  const mat = new Mesh(new PlaneGeometry(1, 1), matMat)
  mat.rotation.x = -Math.PI / 2
  mat.receiveShadow = true
  scene.add(mat)
  const under = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: pool(), transparent: true, depthWrite: false, opacity: 0.4, color: '#000000' }))
  under.rotation.x = -Math.PI / 2
  under.renderOrder = 1
  sheet.add(under)

  // The column.
  const colMat = columnMaterial()
  const column = new Mesh(new CylinderGeometry(1, 1, 1, 32, 1, true), colMat)
  column.renderOrder = 2
  scene.add(column)

  if (import.meta.env.DEV) (window as unknown as { __table: unknown }).__table = { renderer, scene, key, camera, mat, flap, stack }

  let look = ''
  const target = new Vector3(), want = new Vector3()
  let dist = 0, wantDist = 0, moving = false

  /* The camera always looks from the same place — up at a lamp-lit angle and
     a little round to the left — so its axes are fixed and only how far back
     it stands, and where it aims, change. */
  const PITCH = 0.66, AZIM = -0.18
  const back = new Vector3(Math.sin(AZIM) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(AZIM) * Math.cos(PITCH))
  const fwd = back.clone().negate()
  const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, fwd)
  const pts = Array.from({ length: 12 }, () => new Vector3())
  const q = new Vector3()

  /**
   * Frame points exactly: the nearest the camera can stand with all of them
   * inside the picture, and the aim moved so they sit in its middle. A
   * bounding sphere does this loosely, and on a tall narrow phone screen
   * loosely means a corner of the sheet off the side.
   */
  function frame(points: Vector3[], aim: Vector3, tanH: number, tanV: number) {
    let D = 0
    for (let pass = 0; pass < 3; pass++) {
      D = 0
      for (const p of points) {
        q.copy(p).sub(aim)
        const z = q.dot(fwd)
        D = Math.max(D, Math.abs(q.dot(right)) / tanH - z, Math.abs(q.dot(up)) / tanV - z)
      }
      // Where the points land, as a fraction of the half-frame, and how far
      // their middle is from the middle of the picture.
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
  let gripAt: { x: number; y: number } | null = null

  function setLook(id: string, mm: number) {
    const L = LOOKS[(id as Look)] ?? LOOKS.a4
    if (id !== look) {
      look = id
      const flapRelief = relief(L.relief)
      stackRelief?.dispose()
      stackRelief = flapRelief.clone()
      stackRelief.needsUpdate = true
      for (const m of [faceMat, underMat, flapFace, flapUnder]) {
        m.envMap = room
        m.color.set(L.color)
        m.roughness = L.rough
        m.metalness = L.metal ?? 0
        m.normalMap = m === faceMat || m === underMat ? stackRelief : flapRelief
        m.normalScale.set(L.normal, L.normal)
        m.envMapIntensity = L.env
        m.needsUpdate = true
      }
      // The underside is the same stuff, a shade duller where it has been
      // handled and lies against the desk.
      underMat.color.set(L.color).multiplyScalar(0.94)
      flapUnder.color.set(L.color).multiplyScalar(0.94)
      glow.uTrans.value = L.trans
      edgeMat.color.set(L.edge)
      edgeMat.roughness = L.metal ? 0.4 : 0.9
      edgeMat.metalness = L.metal ?? 0
      edgeMat.envMap = room
      edgeMat.envMapIntensity = L.env
      edgeMat.needsUpdate = true
    }
    return { L, uvk: mm / L.tile }
  }

  function render(s: TableState, w: number, h: number) {
    if (w < 2 || h < 2) return false
    const dpr = Math.min(2, devicePixelRatio || 1)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h

    const { L, uvk } = setLook(s.look, s.mm)
    const a = s.halfW, b = s.halfD, H = Math.max(s.height, 1e-7)
    const u = Math.max(0, Math.min(1, s.u))
    // Very thin paper is still drawn with some thickness on the edge it shows
    // the camera, or a single sheet has no edge at all; a hundred-and-fiftieth
    // of the sheet's size is under a pixel at rest and enough to catch light.
    const drawnH = Math.max(H, Math.max(a, b) * 0.0015)
    const squash = 1 - 0.035 * s.press

    sheet.rotation.y = s.yaw

    // The stack: whole at rest; during a fold, only the half that stays.
    const x0 = -a, x1 = u > 1e-4 ? 0 : a
    stack.scale.set(x1 - x0, drawnH * squash, 2 * b)
    stack.position.set((x0 + x1) / 2, (drawnH * squash) / 2, 0)
    // Layers up the edges.
    lam.repeat.set(1, Math.max(1, Math.min(s.layers, 4096)))
    // The relief tiles in real millimetres. The box's faces each run 0..1, so
    // the repeat has to be set per size; the flap writes its own UVs.
    stackRelief!.repeat.set(Math.max(1, (x1 - x0) * uvk), Math.max(1, 2 * b * uvk))

    // The lip at the last crease.
    // A half-round cylinder starts upright and bulging towards +x.
    lip.visible = s.lip !== 'none' && u < 1e-4
    if (lip.visible) {
      const rr = (drawnH * squash) / 2
      if (s.lip === 'x') {
        // Lying along z, bulging out of the right-hand end.
        lip.rotation.set(Math.PI / 2, 0, 0)
        lip.scale.set(rr * 2, 2 * b, rr * 2)
        lip.position.set(a, rr, 0)
      } else {
        // After a quarter turn the crease is along the far side: bulge turned
        // to -z first, then the whole thing laid along x.
        lip.rotation.set(0, Math.PI / 2, -Math.PI / 2, 'ZYX')
        lip.scale.set(rr * 2, 2 * a, rr * 2)
        lip.position.set(0, rr, -b)
      }
    }

    // The flap.
    flap.visible = u > 1e-4
    if (flap.visible) writeFlap(flapGeo, a, b, drawnH, u, s.mm, L.tile)

    // The pool right under the paper.
    under.scale.set((x1 - x0) * 1.08 + 0.02, 2 * b * 1.1 + 0.02, 1)
    under.position.set((x0 + x1) / 2, 0.0004 * Math.max(a, b), 0)
    under.material.opacity = 0.32 * s.ground

    // Framing: everything the sheet could occupy — the whole sheet, its stack,
    // and the height the flap reaches standing up mid-fold — so the
    // camera does not breathe while the hand moves.
    const span = Math.max(a, b)
    const X = a + drawnH, top = drawnH * 1.6, peak = drawnH + a * 0.95
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw)
    let i = 0
    const put = (x: number, y: number, z: number) => pts[i++].set(x * cy + z * sy, y, -x * sy + z * cy)
    for (const x of [-X, X]) for (const z of [-b, b]) { put(x, 0, z); put(x, top, z) }
    for (const z of [-b, b]) { put(0, peak, z); put(a * 0.25, peak, z) }
    const fovV = (camera.fov * Math.PI) / 180
    const tanV = Math.tan(fovV / 2), tanH = tanV * camera.aspect
    want.set(0, top / 2, 0)
    // A little room round the edge, and a little more across a narrow screen,
    // where a hand covers it.
    wantDist = frame(pts, want, tanH * (camera.aspect < 1.3 ? 0.86 : 0.9), tanV * 0.9)
    const fovH = 2 * Math.atan(tanH)
    if (!dist) { dist = wantDist; target.copy(want) }
    const k = 0.16
    dist += (wantDist - dist) * k
    target.lerp(want, k)
    moving = Math.abs(wantDist - dist) / wantDist > 0.002 || target.distanceTo(want) / span > 0.002

    camera.position.copy(target).addScaledVector(back, dist)
    camera.near = dist * 0.02
    camera.far = dist * 40
    camera.lookAt(target)
    camera.updateProjectionMatrix()

    // The lamp follows the framing, so the shadow is always as sharp as the
    // map allows.
    const L0 = Math.max(span, H) * 1.6
    // Up, to the left and a little behind: shadows fall forward and to the right
    // where the camera can see them, and the light rakes across the paper.
    key.position.set(target.x - 1.5 * L0, target.y + 2.1 * L0, target.z - 1.0 * L0)
    key.target.position.copy(target)
    camera.updateMatrixWorld()
    glow.uLight.value.copy(key.position).sub(target).normalize().transformDirection(camera.matrixWorldInverse)
    const sc = key.shadow.camera
    sc.near = 0.05 * L0; sc.far = 8 * L0
    sc.updateProjectionMatrix()
    key.shadow.normalBias = 0.002 * span

    // The mat: big enough to run off the frame, its grid sized to the view.
    mat.visible = s.ground > 0.01
    mat.scale.set(dist * 6, dist * 6, 1)
    mat.position.set(target.x, -0.0001 * span, target.z)
    const viewMm = 2 * dist * Math.tan(fovH / 2) * s.mm
    const want10 = viewMm / 26
    const dec = Math.log10(Math.max(1e-9, want10))
    const step = Math.pow(10, Math.floor(dec))
    matU.uMm.value = s.mm
    matU.uStep.value = step
    matU.uFine.value = 1 - Math.min(1, Math.max(0, (dec - Math.floor(dec) - 0.5) / 0.5))
    matU.uFade.value = s.ground
    matU.uCentre.value.set(0, 0)
    matU.uRadius.value = dist * 1.6

    // The column, once there is no paper.
    column.visible = s.column > 0.01
    if (column.visible) {
      const cr = Math.max(0.05 * span, Math.min(a, b) * 0.62)
      const top = drawnH * squash
      column.scale.set(cr, dist * 30, cr)
      column.position.set(0, top + (dist * 30) / 2, 0)
      colMat.uniforms.uColor.value.setRGB(s.accent[0] / 255, s.accent[1] / 255, s.accent[2] / 255, SRGBColorSpace)
      colMat.uniforms.uStrength.value = s.column
    }

    renderer.render(scene, camera)

    // Where the free edge is, for the hand that says "drag me".
    const edge = new Vector3(a, drawnH / 2, 0).applyMatrix4(sheet.matrixWorld).project(camera)
    gripAt = { x: (edge.x * 0.5 + 0.5) * w, y: (-edge.y * 0.5 + 0.5) * h }
    return true
  }

  return {
    render,
    grip: () => gripAt,
    settling: () => moving,
    dispose() {
      renderer.dispose()
      for (const t of reliefs.values()) t.dispose()
      lam.dispose()
    },
  }
}
