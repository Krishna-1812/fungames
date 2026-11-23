/**
 * Where Does The Day Go? — the day as a ring of glass on a sheet of paper.
 *
 * Twenty-four hours, clockwise from waking at the top, each part of the day
 * its own block of coloured glass: smoked for sleep, cobalt for work, mint
 * for home, lilac for the morning, a grey-blue for the commute, sky for
 * lunch, raspberry for dinner. The blocks are swept along the ring with
 * rounded edges (so their rims catch the light the way cast glass does),
 * lit by a cool window light and the room, and seen through: the paper and
 * its printed dial bend behind them.
 *
 * An interruption is a saw cut. Where a new one lands, the two pieces either
 * side are knocked apart (out from the ring, along it, and a little askew)
 * and settle back on springs, never quite square again. The twenty-three
 * minutes after a cut into work are frosted: the same block, ground matt
 * from the cut on, so the clear cobalt left is the work actually done. The
 * page computes all of that (lib/day-model.ts); this only draws it.
 *
 * Shadows are drawn rather than cast. A shadow map would make every block
 * throw a black one; coloured glass throws its own colour, darker at the
 * rims where the bevels bend the light away. So the shadows, and a thin
 * contact line where glass meets paper, are painted into a texture the
 * paper is multiplied by, which keeps them in the opaque pass: they show
 * through the glass as well as beside it.
 *
 * It renders only while something is moving.
 */
import {
  ACESFilmicToneMapping, BufferAttribute, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  HemisphereLight, LinearMipmapLinearFilter, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, RepeatWrapping, Scene, SRGBColorSpace, Vector3,
  WebGLRenderer, type Texture,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLASS_TINT, type Piece } from './day-model'

export type DayPiece = Piece

/** Where the ring sits in the canvas: its centre as fractions of the width
 *  and height, and its diameter (dial included) as a fraction of the
 *  smaller side. */
export type Framing = { x: number; y: number; size: number }

export interface DayGlass {
  set(pieces: DayPiece[], total: number, opts?: { instant?: boolean }): void
  frame(f: Framing): void
  resize(): void
  dispose(): void
}


/* The ring, in scene units: a metre-ish dial lying on the desk. */
const RO = 1.0, RI = 0.73, H = 0.105, RB = 0.024
const RM = (RI + RO) / 2
const DIAL = 1.36 // the printed dial's outer edge, for framing
const TAU = Math.PI * 2
const DEG = Math.PI / 180

/* ---------------------------------------------------------------------- */
/* Geometry: a rounded-rectangle profile swept along an arc, with rounded  */
/* ends, split into two groups (frosted from the start, clear after).     */
/* ---------------------------------------------------------------------- */

const CORNER = 4
const PROFILE = 4 * (CORNER + 1)

function profile(shrink: number, out: Float32Array) {
  const uc = RM, yc = H / 2
  const hu = (RO - RI) / 2 - shrink, hy = H / 2 - shrink
  const r = Math.max(0, RB - shrink)
  // Counter-clockwise in (radial, up): outer-bottom, outer-top, inner-top, inner-bottom.
  const corners: [number, number, number][] = [
    [uc + hu - r, yc - hy + r, -Math.PI / 2],
    [uc + hu - r, yc + hy - r, 0],
    [uc - hu + r, yc + hy - r, Math.PI / 2],
    [uc - hu + r, yc - hy + r, Math.PI],
  ]
  let k = 0
  for (const [cu, cy, a0] of corners) {
    for (let j = 0; j <= CORNER; j++) {
      const a = a0 + (j / CORNER) * (Math.PI / 2)
      out[k++] = cu + r * Math.cos(a)
      out[k++] = cy + r * Math.sin(a)
    }
  }
}

const prof = new Float32Array(PROFILE * 2)

/** A block from angle t0 to t1 (radians clockwise from the top), ground matt
 *  up to tf. An end the saw made is flat, with only the arris taken off it;
 *  an end that was cast is as round as the block's long edges. */
function sector(t0: number, t1: number, tf: number, saw0: boolean, saw1: boolean): BufferGeometry {
  const arc = (t1 - t0) * RM
  const end = (saw: boolean) => Math.max(0.0005, Math.min(saw ? 0.0045 : RB, arc * 0.45))
  const be0 = end(saw0), be1 = end(saw1)
  const CAP = 4
  const rings: [number, number][] = [] // [angle, shrink]
  for (let j = 0; j <= CAP; j++) {
    const f = (j / CAP) * (Math.PI / 2)
    rings.push([t0 + (be0 * (1 - Math.cos(f))) / RM, be0 * (1 - Math.sin(f))])
  }
  const m0 = t0 + be0 / RM, m1 = t1 - be1 / RM
  const steps = Math.max(1, Math.ceil((m1 - m0) / (1.5 * DEG)))
  const mids: number[] = []
  for (let i = 1; i < steps; i++) mids.push(m0 + ((m1 - m0) * i) / steps)
  if (tf > m0 + 1e-5 && tf < m1 - 1e-5) mids.push(tf)
  mids.sort((a, b) => a - b)
  for (const t of mids) rings.push([t, 0])
  for (let j = CAP; j >= 0; j--) {
    const f = (j / CAP) * (Math.PI / 2)
    rings.push([t1 - (be1 * (1 - Math.cos(f))) / RM, be1 * (1 - Math.sin(f))])
  }

  const nR = rings.length
  const pos = new Float32Array((nR * PROFILE + 2) * 3)
  let v = 0
  for (const [t, s] of rings) {
    profile(s, prof)
    const st = Math.sin(t), ct = Math.cos(t)
    for (let k = 0; k < PROFILE; k++) {
      const r = prof[k * 2], y = prof[k * 2 + 1]
      pos[v++] = r * st; pos[v++] = y; pos[v++] = -r * ct
    }
  }
  const c0 = nR * PROFILE, c1 = c0 + 1
  pos[v++] = RM * Math.sin(t0); pos[v++] = H / 2; pos[v++] = -RM * Math.cos(t0)
  pos[v++] = RM * Math.sin(t1); pos[v++] = H / 2; pos[v++] = -RM * Math.cos(t1)

  const frost: number[] = [], clear: number[] = []
  for (let i = 0; i < nR - 1; i++) {
    const into = (rings[i][0] + rings[i + 1][0]) / 2 < tf ? frost : clear
    for (let k = 0; k < PROFILE; k++) {
      const k1 = (k + 1) % PROFILE
      const a = i * PROFILE + k, b = i * PROFILE + k1, c = (i + 1) * PROFILE + k1, d = (i + 1) * PROFILE + k
      into.push(a, b, c, a, c, d)
    }
  }
  const startCap = tf > t0 + 1e-6 ? frost : clear
  const endCap = tf >= t1 - 1e-6 ? frost : clear
  const last = (nR - 1) * PROFILE
  for (let k = 0; k < PROFILE; k++) {
    const k1 = (k + 1) % PROFILE
    startCap.push(c0, k1, k)
    endCap.push(c1, last + k, last + k1)
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setIndex([...frost, ...clear])
  g.addGroup(0, frost.length, 0)
  g.addGroup(frost.length, clear.length, 1)
  g.computeVertexNormals()
  return g
}

/* ---------------------------------------------------------------------- */
/* The paper: fibre, a printed dial, and the painted shadows.             */
/* ---------------------------------------------------------------------- */

const SPAN = 3.2 // the dial texture and the shadows cover [-SPAN/2, SPAN/2]² of the desk

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function fibreTexture(): CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  x.fillStyle = '#808080'
  x.fillRect(0, 0, S, S)
  const r = rng(7)
  // Fine tooth, then long pale fibres lying every which way.
  const img = x.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (r() - 0.5) * 22
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n
  }
  x.putImageData(img, 0, 0)
  x.lineCap = 'round'
  for (let i = 0; i < 900; i++) {
    const px = r() * S, py = r() * S, a = r() * Math.PI, l = 6 + r() * 26
    x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'
    x.lineWidth = 0.6 + r() * 0.8
    x.beginPath()
    x.moveTo(px, py)
    x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, py + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, px + Math.cos(a) * l, py + Math.sin(a) * l)
    x.stroke()
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(7, 7)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** The dial, printed in grey ink: hours from waking round the outside of the ring. */
function dialTexture(): CanvasTexture {
  const S = 2048
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')!
  const k = S / SPAN
  x.translate(S / 2, S / 2)
  x.scale(k, k)
  const ink = 'rgba(32,38,50,'
  x.lineCap = 'butt'
  // Two hairlines either side of where the glass lies.
  for (const [r, w, a] of [[RI - 0.045, 1.2, 0.35], [RO + 0.04, 1.4, 0.55]] as const) {
    x.strokeStyle = ink + a + ')'
    x.lineWidth = w / k
    x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke()
  }
  for (let m = 0; m < 24 * 4; m++) {
    const t = (m / 96) * TAU
    const hour = m % 4 === 0, three = m % 12 === 0
    const r0 = RO + 0.04, r1 = r0 + (three ? 0.1 : hour ? 0.065 : 0.03)
    x.strokeStyle = ink + (hour ? 0.8 : 0.45) + ')'
    x.lineWidth = (three ? 3 : hour ? 2 : 1.2) / k
    x.beginPath()
    x.moveTo(r0 * Math.sin(t), -r0 * Math.cos(t))
    x.lineTo(r1 * Math.sin(t), -r1 * Math.cos(t))
    x.stroke()
  }
  x.fillStyle = ink + '0.82)'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  for (let h = 0; h < 24; h += 3) {
    const t = (h / 24) * TAU, r = RO + 0.215
    x.save()
    x.translate(r * Math.sin(t), -r * Math.cos(t))
    x.scale(1 / k, 1 / k)
    x.font = `600 ${h === 0 ? 40 : 46}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`
    x.fillText(h === 0 ? 'WAKE' : `${h}h`, 0, 0)
    x.restore()
  }
  const t = new CanvasTexture(c)
  // Drawn with the canvas's y running toward the viewer, as the desk's z does.
  t.flipY = false
  t.colorSpace = SRGBColorSpace
  t.minFilter = LinearMipmapLinearFilter
  t.anisotropy = 8
  return t
}

/* ---------------------------------------------------------------------- */

type Live = {
  key: string
  start: number; end: number; frost: number; cut: boolean
  ds: number; de: number; df: number
  th: number; thv: number; r: number; rv: number; yaw: number; yawv: number
  rT: number; yawT: number
  mesh: Mesh
  built: [number, number, number]
}

const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t)

export function createDayGlass(canvas: HTMLCanvasElement): DayGlass | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setClearColor('#eceff3')

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const room = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
  pmrem.dispose()

  const camera = new PerspectiveCamera(26, 1, 0.05, 60)

  // A cool window light high to the back left, and the room.
  const sunDir = new Vector3(-2.4, 3.0, -1.9).normalize()
  const sun = new DirectionalLight('#f3f6ff', 2.1)
  sun.position.copy(sunDir).multiplyScalar(6)
  scene.add(sun, new HemisphereLight('#e8eef8', '#9aa3b0', 0.85))

  /* ---- the paper ---- */
  const fibre = fibreTexture()
  const dial = dialTexture()
  const SH = 1024
  const shadeCanvas = document.createElement('canvas')
  shadeCanvas.width = shadeCanvas.height = SH
  const shadeCtx = shadeCanvas.getContext('2d')!
  const sketch = document.createElement('canvas')
  sketch.width = sketch.height = SH
  const sketchCtx = sketch.getContext('2d')!
  const shade = new CanvasTexture(shadeCanvas)
  shade.flipY = false
  shade.colorSpace = SRGBColorSpace

  const paper = new MeshStandardMaterial({ color: '#fbfcfe', map: fibre, roughness: 0.94, metalness: 0, envMap: room, envMapIntensity: 0.35 })
  paper.onBeforeCompile = (sh) => {
    sh.uniforms.shadeMap = { value: shade }
    sh.uniforms.dialMap = { value: dial }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDesk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDesk = (modelMatrix * vec4(position, 1.0)).xz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDesk;\nuniform sampler2D shadeMap;\nuniform sampler2D dialMap;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // The fibre texture is a grey around 0.5: lift it to a gentle tooth.
        diffuseColor.rgb = diffuse * (0.86 + 0.28 * texture2D(map, vMapUv).r);
        vec2 duv = vDesk / ${SPAN.toFixed(2)} + 0.5;
        float inside = step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
        vec4 ink = texture2D(dialMap, duv) * inside;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.14, 0.19), ink.a * 0.9);
        // Grey #808080 is no change: darker is shadow, lighter is light the glass gathered.
        diffuseColor.rgb *= mix(vec3(1.0), texture2D(shadeMap, duv).rgb / 0.2158, inside);
        // The window's pool of light, falling away across the desk.
        diffuseColor.rgb *= mix(0.78, 1.05, smoothstep(5.0, 0.3, length(vDesk - vec2(-0.7, -1.0))));`,
      )
  }
  const desk = new Mesh(new PlaneGeometry(30, 30), paper)
  desk.rotation.x = -Math.PI / 2
  ;(desk.geometry.attributes.uv as BufferAttribute).array.forEach((_, i, a) => ((a as Float32Array)[i] *= 4))
  desk.geometry.attributes.uv.needsUpdate = true
  scene.add(desk)

  /* ---- the glass ---- */
  const mats = new Map<string, [MeshPhysicalMaterial, MeshPhysicalMaterial]>()
  const white = new Color('#ffffff')
  function glass(key: string): [MeshPhysicalMaterial, MeshPhysicalMaterial] {
    let m = mats.get(key)
    if (m) return m
    const tint = new Color(GLASS_TINT[key] ?? '#8c9ab0')
    const smoke = key === 'sleep'
    const clear = new MeshPhysicalMaterial({
      color: mix(white, tint, smoke ? 0.3 : 0.25),
      metalness: 0, roughness: 0.035, transmission: 1, thickness: H * 1.4, ior: 1.52,
      attenuationColor: smoke ? new Color('#3a4a6a') : tint, attenuationDistance: smoke ? 0.1 : 0.16,
      specularIntensity: 1, envMap: room, envMapIntensity: 1.15,
    })
    const ground = clear.clone()
    ground.roughness = 0.62
    ground.transmission = 0.92
    ground.color = mix(white, tint, smoke ? 0.4 : 0.14)
    ground.attenuationDistance = (smoke ? 0.1 : 0.16) * 1.6
    ground.envMapIntensity = 0.9
    m = [ground, clear]
    mats.set(key, m)
    return m
  }

  let total = 24
  let lives: Live[] = []
  let raf = 0
  let last = 0
  let framing: Framing = { x: 0.5, y: 0.5, size: 0.9 }
  let instant = false

  const A = () => TAU / Math.max(1e-6, total)
  const hash = (x: number) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

  function gaps(i: number): [number, number] {
    // A saw kerf where an interruption cut, a hairline where one part of the day meets the next.
    const cuts = lives.reduce((n, l) => n + (l.cut ? 1 : 0), 0)
    const wakingArc = lives.filter((l) => l.key !== 'sleep').reduce((s, l) => s + (l.de - l.ds), 0) * A()
    const kerf = Math.min(0.5 * DEG, (0.22 * wakingArc) / Math.max(1, cuts + 1))
    const hair = 0.16 * DEG
    const me = lives[i], next = lives[(i + 1) % lives.length]
    return [(me.cut ? kerf : hair) / 2, (next && next !== me && next.cut ? kerf : hair) / 2]
  }

  function place(l: Live, i: number) {
    const a = A()
    const [g0, g1] = gaps(i)
    let t0 = l.ds * a + g0, t1 = l.de * a - g1
    if (t1 - t0 < 0.05 * DEG) { const c = (t0 + t1) / 2; t0 = c - 0.025 * DEG; t1 = c + 0.025 * DEG }
    const tf = Math.min(t1, t0 + l.df * a)
    const [b0, b1, bf] = l.built
    if (!(Math.abs(b0 - t0) <= 2e-5) || Math.abs(b1 - t1) > 2e-5 || Math.abs(bf - tf) > 2e-5) {
      l.mesh.geometry.dispose()
      const next = lives[(i + 1) % lives.length]
      l.mesh.geometry = sector(t0, t1, tf, l.cut, !!next && next !== l && next.cut)
      l.built = [t0, t1, tf]
    }
    const tc = (t0 + t1) / 2
    const cx = RM * Math.sin(tc), cz = -RM * Math.cos(tc)
    const m = new Matrix4().makeRotationY(-l.th)
    m.multiply(new Matrix4().makeTranslation(Math.sin(tc) * l.r + cx, 0, -Math.cos(tc) * l.r + cz))
    m.multiply(new Matrix4().makeRotationY(l.yaw))
    m.multiply(new Matrix4().makeTranslation(-cx, 0, -cz))
    l.mesh.matrix.copy(m)
    l.mesh.matrixWorldNeedsUpdate = true
  }

  /* The shadows: each block's footprint, pushed away from the window by its
     height, filled with the colour its glass lets through and darkened at
     the rim; then a contact line under the block itself. Multiplied in. */
  function paintShadows() {
    const k = SH / SPAN
    const s = sketchCtx
    s.setTransform(1, 0, 0, 1, 0, 0)
    s.globalCompositeOperation = 'source-over'
    s.fillStyle = '#808080'
    s.fillRect(0, 0, SH, SH)
    s.setTransform(k, 0, 0, k, SH / 2, SH / 2)
    s.globalCompositeOperation = 'multiply'
    const off = (H * 0.9) / sunDir.y
    const ox = -sunDir.x * off, oz = -sunDir.z * off
    const v = new Vector3()
    const outline = (l: Live, dx: number, dz: number, inset: number, from?: number) => {
      const t1 = l.built[1], t0 = from ?? l.built[0]
      const n = Math.max(2, Math.ceil((t1 - t0) / (2 * DEG)))
      s.beginPath()
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / n
        v.set((RO - inset) * Math.sin(t), 0, -(RO - inset) * Math.cos(t)).applyMatrix4(l.mesh.matrix)
        j ? s.lineTo(v.x + dx, v.z + dz) : s.moveTo(v.x + dx, v.z + dz)
      }
      for (let j = n; j >= 0; j--) {
        const t = t0 + ((t1 - t0) * j) / n
        v.set((RI + inset) * Math.sin(t), 0, -(RI + inset) * Math.cos(t)).applyMatrix4(l.mesh.matrix)
        s.lineTo(v.x + dx, v.z + dz)
      }
      s.closePath()
    }
    for (const l of lives) {
      const tint = new Color(GLASS_TINT[l.key] ?? '#8c9ab0')
      const through = l.key === 'sleep' ? mix(tint, white, 0.35).multiplyScalar(0.8) : mix(white, tint, 0.5).multiplyScalar(0.93)
      outline(l, ox, oz, 0.004)
      s.fillStyle = '#' + through.getHexString()
      s.fill()
      s.lineWidth = RB * 1.1
      s.strokeStyle = l.key === 'sleep' ? '#8a8f9a' : '#b9bec8'
      s.stroke()
    }
    // A rounded block of clear glass is a lens along its length: it gathers
    // the light into a bright line down the middle of its shadow. Ground
    // glass scatters it instead, so only the clear part does this.
    s.globalCompositeOperation = 'screen'
    for (const l of lives) {
      const tf = l.built[2]
      if (l.built[1] - tf < 0.2 * DEG) continue
      const tint = new Color(GLASS_TINT[l.key] ?? '#8c9ab0')
      const glow = mix(white, tint, l.key === 'sleep' ? 0.2 : 0.5).multiplyScalar(l.key === 'sleep' ? 0.16 : 0.34)
      outline(l, ox * 1.25, oz * 1.25, (RO - RI) * 0.41, tf)
      s.fillStyle = '#' + glow.getHexString()
      s.fill()
    }
    s.globalCompositeOperation = 'multiply'
    for (const l of lives) {
      outline(l, 0, 0, -0.002)
      s.lineWidth = 0.006
      s.strokeStyle = '#7d828c'
      s.stroke()
    }
    shadeCtx.globalCompositeOperation = 'copy'
    shadeCtx.filter = `blur(${(0.007 * k).toFixed(1)}px)`
    shadeCtx.drawImage(sketch, 0, 0)
    shadeCtx.filter = 'none'
    shade.needsUpdate = true
  }

  function step(dt: number): boolean {
    const ease = instant ? 1 : 1 - Math.exp(-dt * 13)
    let moving = false
    // Glass on paper: a stiff spring back into line, damped by the friction, with a little overshoot.
    const K = 75, C = 2 * 0.42 * Math.sqrt(K)
    for (const l of lives) {
      l.ds += (l.start - l.ds) * ease
      l.de += (l.end - l.de) * ease
      l.df += (l.frost - l.df) * ease
      if (Math.abs(l.start - l.ds) + Math.abs(l.end - l.de) + Math.abs(l.frost - l.df) > 1e-4) moving = true
      if (instant) {
        l.th = 0; l.r = l.rT; l.yaw = l.yawT; l.thv = l.rv = l.yawv = 0
        continue
      }
      const n = 4, h = dt / n
      for (let i = 0; i < n; i++) {
        l.thv += (-K * l.th - C * l.thv) * h; l.th += l.thv * h
        l.rv += (-K * (l.r - l.rT) - C * l.rv) * h; l.r += l.rv * h
        l.yawv += (-K * (l.yaw - l.yawT) - C * l.yawv) * h; l.yaw += l.yawv * h
      }
      if (Math.abs(l.thv) + Math.abs(l.rv) + Math.abs(l.yawv) > 2e-4 || Math.abs(l.th) + Math.abs(l.r - l.rT) + Math.abs(l.yaw - l.yawT) > 2e-5) moving = true
    }
    lives.forEach(place)
    return moving
  }

  function render() {
    paintShadows()
    renderer.render(scene, camera)
  }

  function tick(now: number) {
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60)
    last = now
    const moving = step(dt)
    render()
    raf = moving ? requestAnimationFrame(tick) : 0
    if (!moving) last = 0
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick) }

  function fit() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.75 : 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Far enough that the dial spans `size` of the smaller side.
    const want = (framing.size * Math.min(w, h)) / 2
    const tan = Math.tan((camera.fov * DEG) / 2)
    const d = (DIAL * h) / (2 * tan * want)
    const elev = 57 * DEG
    camera.position.set(0, d * Math.sin(elev), d * Math.cos(elev))
    camera.lookAt(0, 0, 0.04)
    camera.setViewOffset(w, h, (0.5 - framing.x) * w, (0.5 - framing.y) * h, w, h)
    camera.updateProjectionMatrix()
  }

  function set(pieces: DayPiece[], newTotal: number, opts: { instant?: boolean } = {}) {
    instant = !!opts.instant
    total = newTotal > 0 ? newTotal : 24
    const same = pieces.length === lives.length && pieces.every((p, i) => p.key === lives[i].key && p.cut === lives[i].cut)
    if (same) {
      pieces.forEach((p, i) => { const l = lives[i]; l.start = p.start; l.end = p.end; l.frost = p.frost })
    } else {
      const old = lives
      const oldCuts = old.filter((l) => l.cut).map((l) => l.start)
      const next: Live[] = pieces.map((p, i) => {
        const c = (p.start + p.end) / 2
        const o = old.find((l) => c >= l.start && c < l.end) ?? null
        const map = (x: number) => (o && o.end > o.start ? o.ds + ((x - o.start) * (o.de - o.ds)) / (o.end - o.start) : x)
        const seed = hash(p.start * 3.7 + i * 0.01)
        const l: Live = {
          key: p.key, start: p.start, end: p.end, frost: p.frost, cut: p.cut,
          ds: map(p.start), de: map(p.end), df: o ? Math.min(o.df, p.end - p.start) : p.frost,
          th: o?.th ?? 0, thv: o?.thv ?? 0, r: o?.r ?? 0, rv: o?.rv ?? 0, yaw: o?.yaw ?? 0, yawv: o?.yawv ?? 0,
          // A sawn piece never sits quite square again.
          rT: p.cut ? (seed - 0.5) * 0.014 : 0,
          yawT: p.cut ? (hash(seed * 91) - 0.5) * 0.035 : 0,
          mesh: new Mesh(new BufferGeometry(), glass(p.key)),
          built: [NaN, NaN, NaN],
        }
        l.mesh.matrixAutoUpdate = false
        return l
      })
      // A fresh cut knocks the pieces either side of it apart.
      if (!instant) {
        next.forEach((l, i) => {
          if (!l.cut || oldCuts.some((c) => Math.abs(c - l.start) < 0.02)) return
          const s = hash(l.start * 13.1)
          const prev = next[i - 1]
          l.thv += 0.08 + s * 0.06; l.rv += 0.3 + s * 0.3; l.yawv += (s - 0.5) * 3.2
          if (prev) { prev.thv -= 0.05 + s * 0.05; prev.rv += 0.16 + hash(s) * 0.24; prev.yawv -= (hash(s * 7) - 0.5) * 2.6 }
        })
      }
      for (const l of old) { scene.remove(l.mesh); l.mesh.geometry.dispose() }
      lives = next
      for (const l of lives) scene.add(l.mesh)
    }
    if (instant) { step(1 / 60); render() } else wake()
  }

  const ro = new ResizeObserver(() => { fit(); if (!raf) render() })
  ro.observe(canvas)
  fit()

  return {
    set,
    frame(f) {
      if (f.x === framing.x && f.y === framing.y && f.size === framing.size) return
      framing = f
      fit()
      if (!raf) render()
    },
    resize() { fit(); if (!raf) render() },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const l of lives) l.mesh.geometry.dispose()
      for (const [a, b] of mats.values()) { a.dispose(); b.dispose() }
      for (const t of [fibre, dial, shade, room] as Texture[]) t.dispose()
      renderer.dispose()
    },
  }
}
