/**
 * Share This Page — the sending desk.
 *
 * Every way of sending the message is a real thing on a real desk, under a
 * cool lamp in a dark room, made from what was actually typed:
 *
 *   - a typed sheet, for the ciphers and the spelled-out codes, each letter
 *     struck a little differently, the way a typewriter's are;
 *   - a sheet of heavy paper with the Braille embossed in it at the real
 *     dimensions (1.44 mm dots, 2.34 mm apart, 6.2 mm cell to cell), seen
 *     under a raking light, because Braille has no ink;
 *   - punched paper tape, one row of holes a character, the real 1-inch
 *     eight-track tape with its feed holes off-centre between tracks three
 *     and four, the desk showing through every hole and the lamp through
 *     the tape's own shadow;
 *   - a fanfold printout of the interstellar bitmap, dot-matrix squares on
 *     tractor-feed paper;
 *   - a brass telegraph key that goes down for every dot and dash, and a
 *     signal lamp that lights with it;
 *   - a telephone keypad whose keys go down with each dual tone;
 *   - two octaves of piano keys, each note pressed as it plays;
 *   - a steel pipe and a spoon for the tap code, with the grid on a card,
 *     each letter ringed in pencil once it has been knocked out;
 *   - a postcard for each joke, handwritten, stamped and postmarked.
 *
 * The page decides everything and schedules the sounds; this only draws, and
 * moves a part when it is told to (`press`). It renders only while something
 * is moving. Units are tenths of a metre.
 */
import {
  ACESFilmicToneMapping, CanvasTexture, CylinderGeometry, DirectionalLight, DoubleSide, Group,
  HemisphereLight, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  Object3D, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, RepeatWrapping,
  Scene, SphereGeometry, SpotLight, SRGBColorSpace, TorusGeometry, Vector2, Vector3, WebGLRenderer,
  BufferGeometry, Float32BufferAttribute, type Material, type Texture,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type DeskView =
  | { kind: 'sheet'; heading: string; text: string }
  | { kind: 'braille'; cells: number[][] }
  | { kind: 'tape'; bytes: number[] }
  | { kind: 'printout'; rows: number; cols: number; bits: number[]; caption: string }
  | { kind: 'postcard'; to: string; address: string[]; message: string; seed: number }
  | { kind: 'key' }
  | { kind: 'keypad' }
  | { kind: 'piano' }
  | { kind: 'pipe' }

export interface Desk {
  show(view: DeskView): void
  /** Put a part down for `dur` seconds, starting `delay` seconds from now:
   *  'key', 'pad:5', 'piano:C4', 'spoon'. */
  press(part: string, delay: number, dur: number): void
  /** The tap-code card: ring the first `n` letters of `letters` in pencil. */
  ring(letters: { row: number; col: number }[], n: number): void
  /** Let go of everything at once. */
  release(): void
  dispose(): void
}

const TYPE = '"Courier Prime", "Courier New", ui-monospace, monospace'
const HAND = 'Caveat, "Segoe Print", cursive'
const DEG = Math.PI / 180

function rng(seed: number) {
  let s = (seed >>> 0) || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

/* ---- paper ---------------------------------------------------------- */

/** A sheet's ground: a cool white with a faint cloud of fibre and tooth. */
function paperGround(x: CanvasRenderingContext2D, w: number, h: number, base: string, seed: number) {
  const r = rng(seed)
  x.fillStyle = base
  x.fillRect(0, 0, w, h)
  for (let i = 0; i < (w * h) / 900; i++) {
    const px = r() * w, py = r() * h, a = r() * Math.PI, l = 4 + r() * 18
    x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(90,96,110,0.05)'
    x.lineWidth = 0.6 + r()
    x.beginPath()
    x.moveTo(px, py)
    x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l)
    x.stroke()
  }
  const g = x.createRadialGradient(w * 0.45, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(255,255,255,0.0)')
  g.addColorStop(1, 'rgba(120,128,140,0.10)')
  x.fillStyle = g
  x.fillRect(0, 0, w, h)
}

/** Type `text` as a typewriter would: each strike a touch off its line and
 *  its weight, now and then a letter struck twice. Wraps at whole words
 *  where it can, and picks the largest size that fits the box. */
function typeInto(
  x: CanvasRenderingContext2D, text: string, box: { x: number; y: number; w: number; h: number },
  sizes: number[], seed: number, ink = '22,26,36',
) {
  const r = rng(seed)
  let size = sizes[sizes.length - 1], lines: string[] = []
  for (const s of sizes) {
    x.font = `400 ${s}px ${TYPE}`
    const cw = x.measureText('M').width
    const cols = Math.max(4, Math.floor(box.w / cw))
    lines = wrap(text, cols)
    if (lines.length * s * 1.45 <= box.h) { size = s; break }
  }
  x.font = `400 ${size}px ${TYPE}`
  const cw = x.measureText('M').width
  x.textBaseline = 'alphabetic'
  lines.forEach((line, li) => {
    const y = box.y + size * 1.1 + li * size * 1.45
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === ' ') continue
      const a = 0.84 + r() * 0.16
      const dx = (r() - 0.5) * size * 0.05, dy = (r() - 0.5) * size * 0.06
      x.fillStyle = `rgba(${ink},${a.toFixed(3)})`
      x.fillText(ch, box.x + i * cw + dx, y + dy)
      if (r() < 0.04) { x.fillStyle = `rgba(${ink},0.25)`; x.fillText(ch, box.x + i * cw + dx + size * 0.03, y + dy) }
    }
  })
}

function wrap(text: string, cols: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      let w = word
      while (w.length > cols) {
        if (line) { out.push(line); line = '' }
        out.push(w.slice(0, cols))
        w = w.slice(cols)
      }
      if (!line) line = w
      else if (line.length + 1 + w.length <= cols) line += ' ' + w
      else { out.push(line); line = w }
    }
    out.push(line)
  }
  return out
}

/** A plane with a little life in it: the corners lift, the middle bows. */
function sheetGeometry(w: number, d: number, lift: number, seed: number) {
  const g = new PlaneGeometry(w, d, 32, 24)
  g.rotateX(-Math.PI / 2)
  const p = g.attributes.position
  const r = rng(seed)
  const c = [r(), r(), r(), r()]
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / w + 0.5, v = p.getZ(i) / d + 0.5
    const corner = c[0] * (1 - u) * (1 - v) + c[1] * u * (1 - v) + c[2] * (1 - u) * v + c[3] * u * v
    const edge = Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 4)
    p.setY(i, 0.0015 + lift * edge * (0.4 + corner) + lift * 0.25 * Math.sin(u * Math.PI) * 0.3)
  }
  g.computeVertexNormals()
  return g
}

/* ---------------------------------------------------------------------- */

type Framing = { r: number; elev: number; az: number; target?: [number, number, number] }

export function createDesk(canvasEl: HTMLCanvasElement, opts: { still?: boolean } = {}): Desk | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.debug.checkShaderErrors = false
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.setClearColor('#0a0e16')

  const scene = new Scene()
  // White paper under a lamp is the brightest thing here; the lamp is set so it stays paper, not glare.
  const LAMP = 3.1
  const pmrem = new PMREMGenerator(renderer)
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  const camera = new PerspectiveCamera(30, 1, 0.05, 80)

  /* ---- the desk and the lamp ---- */
  const [wc, wx] = canvas(1024, 1024)
  {
    // Grey-stained oak, quarter-sawn, the grain running left to right:
    // growth rings as bands bent by a slow warp, the late wood of each ring
    // darker, and the open pores that make oak oak as fine dark flecks
    // along it. Tiles seamlessly, so the noise wraps.
    const N = 1024
    const vn = (seed: number, period: number) => {
      const r = rng(seed), g = new Float32Array(period * period).map(() => r())
      return (x: number, y: number) => {
        const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
        const at = (i: number, j: number) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)]
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
        const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx
        const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx
        return a + (b - a) * sy
      }
    }
    const warp = vn(11, 8), fine = vn(12, 64), fleck = vn(13, 256)
    const img = wx.createImageData(N, N)
    const dark = [33, 37, 44], light = [60, 66, 76]
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N
        const w = warp(u * 8, v * 8) * 2 + warp(u * 8 + 3.1, v * 8 + 1.7) * 0.6
        const ring = (v * 64 + w * 3.2) % 1
        // Early wood pale and wide, late wood a sharper dark line.
        let t = 0.55 + 0.45 * Math.pow(Math.sin(ring * Math.PI), 0.6) - 0.34 * Math.pow(Math.max(0, ring - 0.82) / 0.18, 2)
        t += (fine(u * 64, v * 64 * 0.25) - 0.5) * 0.22
        const f = fleck(u * 256, v * 256 * 4)
        if (f > 0.83) t -= (f - 0.83) * 2.4
        t = Math.max(0, Math.min(1, t))
        const i = (y * N + x) * 4
        img.data[i] = dark[0] + (light[0] - dark[0]) * t
        img.data[i + 1] = dark[1] + (light[1] - dark[1]) * t
        img.data[i + 2] = dark[2] + (light[2] - dark[2]) * t
        img.data[i + 3] = 255
      }
    }
    wx.putImageData(img, 0, 0)
  }
  const wood = tex(wc)
  wood.wrapS = wood.wrapT = RepeatWrapping
  // One tile of grain is 40 cm of desk: rings a few millimetres apart.
  wood.repeat.set(10, 10)
  const deskMat = new MeshPhysicalMaterial({ color: '#c3c8d1', map: wood, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, envMap: room, envMapIntensity: 0.35 })
  const desk = new Mesh(new PlaneGeometry(40, 40), deskMat)
  desk.rotation.x = -Math.PI / 2
  desk.receiveShadow = true
  scene.add(desk)

  const lamp = new SpotLight('#eef3ff', LAMP, 0, 0.62, 0.75, 0)
  lamp.position.set(-2.2, 6.5, 3.0)
  lamp.target.position.set(0, 0, 0)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(2048, 2048)
  lamp.shadow.bias = -0.0002
  lamp.shadow.normalBias = 0.004
  lamp.shadow.radius = 5
  lamp.shadow.blurSamples = 16
  lamp.shadow.camera.near = 2
  lamp.shadow.camera.far = 14
  scene.add(lamp, lamp.target)
  const sky = new HemisphereLight('#b8c6dc', '#0b0d12', 0.32)
  scene.add(sky)
  // A low light from the left, only up for the Braille, which has nothing else to show it.
  const rake = new DirectionalLight('#f2f5ff', 0)
  rake.position.set(-6, 0.9, -0.8)
  rake.castShadow = true
  // Fine enough to throw a shadow from a dot half a millimetre high.
  rake.shadow.mapSize.set(4096, 4096)
  rake.shadow.camera.left = -1.15; rake.shadow.camera.right = 1.15; rake.shadow.camera.top = 0.9; rake.shadow.camera.bottom = -0.9
  rake.shadow.camera.near = 1; rake.shadow.camera.far = 14
  rake.shadow.bias = -0.00015
  rake.shadow.normalBias = 0.0008
  rake.shadow.radius = 1.5
  rake.visible = false
  scene.add(rake, rake.target)

  /* ---- materials ---- */
  const env = <T extends MeshStandardMaterial>(m: T, k = 0.8) => { m.envMap = room; m.envMapIntensity = k; return m }
  const brass = env(new MeshPhysicalMaterial({ color: '#c8a55a', metalness: 1, roughness: 0.28 }), 1.1)
  const steel = env(new MeshPhysicalMaterial({ color: '#c3c9d2', metalness: 1, roughness: 0.32 }), 1)
  const blackGloss = env(new MeshPhysicalMaterial({ color: '#0d0f13', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }), 0.9)
  const ivory = env(new MeshPhysicalMaterial({ color: '#f4f5f6', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }), 0.8)
  const walnut = env(new MeshPhysicalMaterial({ color: '#4a3a32', map: wood, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.25 }), 0.6)
  const plastic = env(new MeshPhysicalMaterial({ color: '#2a2f38', roughness: 0.55, clearcoat: 0.2 }), 0.5)

  /* ---- the things on the desk ---- */
  const groups = new Map<string, Group>()
  const parts = new Map<string, (down: number) => void>()
  const disposables: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d)
  const shadowed = (o: Object3D) => { o.traverse((m) => { if ((m as Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true } }); return o }

  function holder(kind: string) {
    let g = groups.get(kind)
    if (!g) { g = new Group(); g.visible = false; groups.set(kind, g); scene.add(g) }
    return g
  }
  /** Empty a holder for content that is rebuilt from the message each time. */
  function clear(g: Group) {
    for (const o of [...g.children]) {
      g.remove(o)
      o.traverse((m) => {
        const mesh = m as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as (Material & { map?: Texture | null; alphaMap?: Texture | null; bumpMap?: Texture | null })[]
        for (const mt of mats) {
          if (mt === brass || mt === steel || mt === blackGloss || mt === ivory || mt === walnut || mt === plastic) continue
          mt.map?.dispose(); mt.alphaMap?.dispose(); mt.bumpMap?.dispose(); mt.dispose()
        }
      })
    }
  }

  function paperMaterial(map: Texture, bump?: Texture) {
    return env(new MeshStandardMaterial({ map, roughness: 0.86, bumpMap: bump ?? null, bumpScale: 0.6, side: DoubleSide }), 0.3)
  }

  /** The typed sheet: A5 on its side. */
  function buildSheet(heading: string, text: string) {
    const g = holder('sheet')
    clear(g)
    const W = 2048, H = 1448
    const [c, x] = canvas(W, H)
    const seed = [...(heading + text)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 11)
    paperGround(x, W, H, '#e9ecf0', seed)
    typeInto(x, heading.toUpperCase(), { x: 150, y: 110, w: W - 300, h: 120 }, [40], seed + 1, '40,46,60')
    x.fillStyle = 'rgba(40,46,60,0.35)'
    x.fillRect(150, 215, 520, 3)
    typeInto(x, text, { x: 150, y: 270, w: W - 300, h: H - 380 }, [132, 112, 96, 84, 74, 64, 56, 48, 42, 36, 31, 27], seed + 2)
    const mesh = new Mesh(sheetGeometry(2.1, 1.48, 0.012, seed), paperMaterial(tex(c)))
    mesh.rotation.y = -3 * DEG
    g.add(shadowed(mesh))
  }

  /** Braille: heavy paper, dots raised in it, nothing printed. */
  const dotGeo = keep(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2))
  function buildBraille(cells: number[][]) {
    const g = holder('braille')
    clear(g)
    const W = 2.1, D = 1.48
    const [c, x] = canvas(1024, 724)
    paperGround(x, 1024, 724, '#f3f2ee', 5)
    const paperMat = paperMaterial(tex(c))
    const sheet = new Mesh(sheetGeometry(W, D, 0.006, 5), paperMat)
    g.add(shadowed(sheet))
    // Real dimensions, in tenths of a metre: 2.34 mm dot to dot, 6.2 mm cell to cell, 10 mm line to line.
    const dot = 0.0234, cell = 0.062, line = 0.1, margin = 0.2
    const perLine = Math.floor((W - margin * 2) / cell)
    // Words kept whole on a line where they fit.
    const words: number[][][] = [[]]
    for (const cl of cells) { if (!cl.length) words.push([]); else words[words.length - 1].push(cl) }
    const rows: number[][][] = [[]]
    for (const w of words.filter((w) => w.length)) {
      const row = rows[rows.length - 1]
      const need = (row.length ? 1 : 0) + w.length
      if (row.length + need > perLine && row.length) rows.push([...w])
      else { if (row.length) row.push([]); row.push(...w) }
    }
    const pos: [number, number][] = []
    rows.slice(0, Math.floor((D - margin * 2) / line)).forEach((row, ri) => {
      row.forEach((dots, ci) => {
        for (const d of dots) {
          const col = d <= 3 ? 0 : 1, rr = (d - 1) % 3
          pos.push([-W / 2 + margin + ci * cell + col * dot, -D / 2 + margin + ri * line + rr * dot])
        }
      })
    })
    const inst = new InstancedMesh(dotGeo, paperMat, Math.max(1, pos.length))
    inst.count = pos.length
    const m = new Matrix4()
    pos.forEach(([px, pz], i) => {
      m.makeScale(0.0072, 0.0048, 0.0072).setPosition(px, 0.0016, pz)
      inst.setMatrixAt(i, m)
    })
    inst.castShadow = inst.receiveShadow = true
    g.add(inst)
    g.rotation.y = 4 * DEG
  }

  /** Eight-track paper tape, one row of holes a byte, laid across the desk in a slow S. */
  function buildTape(bytes: number[]) {
    const g = holder('tape')
    clear(g)
    const LEAD = 12
    const rowsN = bytes.length + LEAD * 2
    const PX = 22 // canvas pixels per tenth of an inch
    const [c, x] = canvas(10 * PX, rowsN * PX)
    x.fillStyle = '#fff'
    x.fillRect(0, 0, c.width, c.height)
    x.fillStyle = '#000'
    for (let i = 0; i < rowsN; i++) {
      const b = i >= LEAD && i < LEAD + bytes.length ? bytes[i - LEAD] : 0
      const cy = (i + 0.5) * PX
      // Across the tape: tracks 1-3, the feed hole, tracks 4-8; bit 0 on track 1.
      const across = [1, 2, 3, -1, 4, 5, 6, 7, 8]
      across.forEach((t, k) => {
        const cx = (k + 1) * PX
        if (t === -1) { x.beginPath(); x.arc(cx, cy, PX * 0.23, 0, Math.PI * 2); x.fill() }
        else if ((b >> (t - 1)) & 1) { x.beginPath(); x.arc(cx, cy, PX * 0.36, 0, Math.PI * 2); x.fill() }
      })
    }
    const alpha = tex(c, false)
    alpha.anisotropy = 8
    const [pc, px] = canvas(256, 1024)
    paperGround(px, 256, 1024, '#dfe6ee', 9)
    const look = tex(pc)
    look.wrapT = RepeatWrapping
    look.repeat.set(1, rowsN / 40)
    const mat = env(new MeshStandardMaterial({ map: look, alphaMap: alpha, alphaTest: 0.5, roughness: 0.62, side: DoubleSide }), 0.35)
    // A strip along a gentle S, 1 inch wide, 0.1 inch a row.
    const width = 0.254, pitch = 0.0254, len = rowsN * pitch
    const geo = new BufferGeometry()
    const N = Math.max(8, rowsN * 2)
    const vs: number[] = [], uvs: number[] = [], idx: number[] = []
    const path = (s: number) => {
      const f = s / len - 0.5
      return new Vector2(f * len * 0.92, Math.sin(f * Math.PI * 1.6) * 0.17 + f * 0.12)
    }
    let acc = 0, prev = path(0)
    const params: number[] = [0]
    for (let i = 1; i <= N; i++) { const p = path((i / N) * len); acc += p.distanceTo(prev); prev = p; params.push(acc) }
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * len
      const p = path(s), q = path(Math.min(len, s + 0.01)), o = path(Math.max(0, s - 0.01))
      const t = q.clone().sub(o).normalize(), n = new Vector2(-t.y, t.x)
      const lift = 0.004 + 0.02 * Math.pow(Math.max(0, Math.sin((i / N) * Math.PI * 3.1 + 0.4)), 6)
      for (const side of [-1, 1]) {
        vs.push(p.x + (n.x * width * side) / 2, lift + 0.003 * side * Math.sin(i * 0.05), p.y + (n.y * width * side) / 2)
        uvs.push(side < 0 ? 0 : 1, 1 - params[i] / acc)
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    }
    geo.setAttribute('position', new Float32BufferAttribute(vs, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const strip = new Mesh(geo, mat)
    strip.castShadow = strip.receiveShadow = true
    g.add(strip)
    return len
  }

  /** The interstellar bitmap, dot-matrix on tractor-feed paper. */
  function buildPrintout(rows: number, cols: number, bits: number[], caption: string) {
    const g = holder('printout')
    clear(g)
    const W = 1600, H = 1300
    const [c, x] = canvas(W, H)
    paperGround(x, W, H, '#e9ece9', 21)
    // Faint green bars, and the tractor holes down both margins.
    x.fillStyle = 'rgba(120,190,150,0.13)'
    for (let y = 0; y < H; y += 120) x.fillRect(90, y, W - 180, 60)
    x.fillStyle = '#0a0e16'
    for (let y = 30; y < H; y += 60) for (const cx of [45, W - 45]) { x.beginPath(); x.arc(cx, y, 13, 0, Math.PI * 2); x.fill() }
    x.strokeStyle = 'rgba(60,70,80,0.35)'
    x.setLineDash([6, 6])
    for (const cx of [90, W - 90]) { x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, H); x.stroke() }
    x.setLineDash([])
    const box = { x: 220, y: 160, w: W - 440, h: H - 380 }
    const s = Math.floor(Math.min(box.w / cols, box.h / rows))
    const ox = box.x + (box.w - s * cols) / 2, oy = box.y + (box.h - s * rows) / 2
    const r = rng(rows * 131 + cols)
    for (let i = 0; i < rows * cols; i++) {
      if (!bits[i]) continue
      const cx = ox + (i % cols) * s, cy = oy + Math.floor(i / cols) * s
      // Each square is struck by pins: dots that overlap, darker where they do.
      x.fillStyle = `rgba(20,24,34,${0.78 + r() * 0.2})`
      x.fillRect(cx + s * 0.08, cy + s * 0.08, s * 0.84, s * 0.84)
    }
    typeInto(x, caption, { x: 220, y: H - 200, w: W - 440, h: 120 }, [34, 30, 26], 22, '30,36,48')
    const mesh = new Mesh(sheetGeometry(1.9, 1.54, 0.01, 21), paperMaterial(tex(c)))
    // The next sheet of the fold, under this one.
    const under = new Mesh(sheetGeometry(1.9, 1.54, 0.006, 22), paperMaterial(tex(c)))
    under.position.set(0.05, -0.0012, 0.06)
    under.rotation.y = 1.5 * DEG
    g.add(shadowed(under), shadowed(mesh))
    g.rotation.y = -2 * DEG
  }

  /** A postcard to someone who will not reply. */
  function buildPostcard(to: string, address: string[], message: string, seed: number) {
    const g = holder('postcard')
    clear(g)
    const W = 1480, H = 1050
    const [c, x] = canvas(W, H)
    paperGround(x, W, H, '#ebe8e1', seed)
    const r = rng(seed)
    // The dividing line and the address lines.
    x.strokeStyle = 'rgba(60,66,80,0.55)'
    x.lineWidth = 2
    x.beginPath(); x.moveTo(W * 0.56, 120); x.lineTo(W * 0.56, H - 110); x.stroke()
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(W * 0.61, 470 + i * 120); x.lineTo(W - 90, 470 + i * 120); x.stroke() }
    x.font = `600 26px ${TYPE}`
    x.fillStyle = 'rgba(60,66,80,0.7)'
    x.fillText('POST CARD', 90, 96)
    // The stamp: perforated, engraved in one ink.
    const sx = W - 300, sy = 90, sw = 200, sh = 240
    x.save()
    x.shadowColor = 'rgba(0,0,0,0.18)'; x.shadowBlur = 6; x.shadowOffsetY = 2
    x.fillStyle = '#fbfbf8'
    x.fillRect(sx, sy, sw, sh)
    x.restore()
    x.fillStyle = '#f4f1ea'
    for (let i = 0; i <= 10; i++) for (const [ax, ay] of [[sx + (i * sw) / 10, sy], [sx + (i * sw) / 10, sy + sh]]) { x.beginPath(); x.arc(ax, ay, 7, 0, Math.PI * 2); x.fill() }
    for (let i = 0; i <= 12; i++) for (const [ax, ay] of [[sx, sy + (i * sh) / 12], [sx + sw, sy + (i * sh) / 12]]) { x.beginPath(); x.arc(ax, ay, 7, 0, Math.PI * 2); x.fill() }
    const inkStamp = ['#1f4f8a', '#2c6b5a', '#5a3a8a', '#7a2a3a'][seed % 4]
    x.fillStyle = inkStamp
    x.fillRect(sx + 18, sy + 18, sw - 36, sh - 36)
    x.fillStyle = '#fbfbf8'
    x.fillRect(sx + 26, sy + 26, sw - 52, sh - 52)
    x.strokeStyle = inkStamp
    x.lineWidth = 1.4
    for (let i = 0; i < 34; i++) { const yy = sy + 40 + i * 4.6; x.beginPath(); x.moveTo(sx + 32, yy); x.lineTo(sx + sw - 32, yy + Math.sin(i * 0.5) * 3); x.stroke() }
    x.fillStyle = inkStamp
    x.beginPath(); x.arc(sx + sw / 2, sy + sh * 0.46, 46, 0, Math.PI * 2); x.fill()
    x.font = `700 30px ${TYPE}`
    x.textAlign = 'center'
    x.fillText('POSTAGE', sx + sw / 2, sy + sh - 44)
    x.textAlign = 'left'
    // The postmark, struck a little off the stamp, and its wavy cancellation.
    x.save()
    x.translate(sx - 30, sy + 150)
    x.rotate(-0.18)
    x.strokeStyle = 'rgba(30,34,46,0.62)'
    x.lineWidth = 4
    x.beginPath(); x.arc(0, 0, 82, 0, Math.PI * 2); x.stroke()
    x.lineWidth = 2
    x.beginPath(); x.arc(0, 0, 60, 0, Math.PI * 2); x.stroke()
    x.fillStyle = 'rgba(30,34,46,0.62)'
    x.font = `700 22px ${TYPE}`
    x.textAlign = 'center'
    const d = new Date()
    x.fillText(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(), 0, 8)
    x.font = `700 15px ${TYPE}`
    x.fillText(String(d.getFullYear()), 0, 32)
    x.textAlign = 'left'
    x.lineWidth = 3.5
    for (let k = 0; k < 4; k++) {
      x.beginPath()
      for (let t = 0; t <= 260; t += 6) { const yy = -45 + k * 30 + Math.sin(t * 0.06) * 7; t ? x.lineTo(110 + t, yy) : x.moveTo(110 + t, yy) }
      x.stroke()
    }
    x.restore()
    // Handwritten: the message on the left, the address on the right, in blue-black.
    const pen = (s: string, px: number, py: number, size: number, maxW: number) => {
      x.font = `600 ${size}px ${HAND}`
      const words = s.split(' ')
      let line = '', y = py
      for (const w of words) {
        const t = line ? line + ' ' + w : w
        if (x.measureText(t).width > maxW && line) { ink(line, px, y); line = w; y += size * 1.12 } else line = t
      }
      if (line) ink(line, px, y)
      return y
    }
    const ink = (s: string, px: number, py: number) => {
      x.save()
      x.translate(px, py)
      x.rotate((r() - 0.5) * 0.03)
      x.fillStyle = `rgba(16,28,70,${0.92 + r() * 0.08})`
      x.fillText(s, 0, 0)
      x.restore()
    }
    const size = message.length > 60 ? 66 : message.length > 30 ? 84 : 108
    pen(message, 100, 250, size, W * 0.56 - 170)
    pen(`To ${to}`, W * 0.62, 455, 76, W * 0.36)
    address.forEach((a, i) => pen(a, W * 0.62, 575 + i * 120, 60, W * 0.36))
    const card = new Mesh(new PlaneGeometry(1.48, 1.05), paperMaterial(tex(c)))
    card.rotation.x = -Math.PI / 2
    // Just proud of the card's edge, or the two fight over the same depth.
    card.position.y = 0.0068
    const edge = new Mesh(new RoundedBoxGeometry(1.48, 0.006, 1.05, 2, 0.002), env(new MeshStandardMaterial({ color: '#ece8df', roughness: 0.9 }), 0.3))
    edge.position.y = 0.003
    const pc = new Group()
    pc.add(shadowed(edge), shadowed(card))
    pc.rotation.y = (r() - 0.5) * 8 * DEG
    g.add(pc)
  }

  /** The telegraph key, and a signal lamp wired to it. */
  function buildKey() {
    const g = holder('key')
    if (g.children.length) return
    const base = new Mesh(new RoundedBoxGeometry(1.5, 0.1, 0.75, 4, 0.02), walnut)
    base.position.y = 0.05
    g.add(base)
    // Two trunnion posts and the pivot across them.
    for (const z of [-0.12, 0.12]) {
      const post = new Mesh(new RoundedBoxGeometry(0.08, 0.26, 0.06, 2, 0.012), brass)
      post.position.set(0.28, 0.23, z)
      g.add(post)
    }
    const pivot = new Mesh(new CylinderGeometry(0.018, 0.018, 0.34, 16), steel)
    pivot.rotation.x = Math.PI / 2
    pivot.position.set(0.28, 0.3, 0)
    g.add(pivot)
    const arm = new Group()
    arm.position.set(0.28, 0.3, 0)
    const lever = new Mesh(new RoundedBoxGeometry(1.08, 0.05, 0.075, 3, 0.012), brass)
    lever.position.set(-0.38, 0, 0)
    arm.add(lever)
    const tail = new Mesh(new RoundedBoxGeometry(0.28, 0.05, 0.075, 3, 0.012), brass)
    tail.position.set(0.2, 0, 0)
    arm.add(tail)
    const stem = new Mesh(new CylinderGeometry(0.018, 0.018, 0.1, 12), brass)
    stem.position.set(-0.85, 0.06, 0)
    arm.add(stem)
    const knob = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(0.12, 0.0), new Vector2(0.135, 0.02), new Vector2(0.13, 0.05), new Vector2(0.09, 0.075), new Vector2(0, 0.08)], 40), blackGloss)
    knob.position.set(-0.85, 0.1, 0)
    arm.add(knob)
    g.add(arm)
    // The contact under the lever, the spring behind, and two binding posts.
    const contact = new Mesh(new CylinderGeometry(0.03, 0.03, 0.18, 16), steel)
    contact.position.set(-0.3, 0.19, 0)
    g.add(contact)
    const spring = new Mesh(new TorusGeometry(0.03, 0.007, 8, 18), steel)
    spring.rotation.x = Math.PI / 2
    for (let i = 0; i < 6; i++) { const s = spring.clone(); s.position.set(0.48, 0.13 + i * 0.022, 0); g.add(s) }
    for (const z of [-0.22, 0.22]) {
      const bp = new Mesh(new CylinderGeometry(0.045, 0.05, 0.11, 18), brass)
      bp.position.set(0.62, 0.155, z)
      g.add(bp)
    }
    // The lamp: a brass bezel with a frosted dome, to the right and behind.
    const lampG = new Group()
    lampG.position.set(0.15, 0, -0.95)
    const foot = new Mesh(new CylinderGeometry(0.2, 0.24, 0.07, 32), brass)
    foot.position.y = 0.035
    const neck = new Mesh(new CylinderGeometry(0.06, 0.07, 0.16, 24), brass)
    neck.position.y = 0.15
    const bezel = new Mesh(new TorusGeometry(0.15, 0.025, 12, 40), brass)
    bezel.rotation.x = Math.PI / 2
    bezel.position.y = 0.26
    const glassMat = env(new MeshPhysicalMaterial({ color: '#eef3fa', roughness: 0.35, transmission: 0.6, thickness: 0.05, emissive: '#dce9ff', emissiveIntensity: 0 }), 0.8)
    const dome = new Mesh(new SphereGeometry(0.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat)
    dome.position.y = 0.26
    lampG.add(foot, neck, bezel, dome)
    const glow = new PointLight('#dfe9ff', 0, 4, 2)
    glow.position.set(0, 0.42, 0)
    lampG.add(glow)
    g.add(lampG)
    // The wire between them, a soft loop on the desk.
    const wire = new Mesh(new TorusGeometry(0.42, 0.012, 8, 48, Math.PI * 0.9), plastic)
    wire.rotation.x = -Math.PI / 2
    wire.position.set(0.45, 0.012, -0.5)
    g.add(wire)
    shadowed(g)
    dome.castShadow = false
    g.rotation.y = 18 * DEG
    parts.set('key', (d) => {
      arm.rotation.z = d * 2.6 * DEG
      glassMat.emissiveIntensity = d * 2.4
      glow.intensity = d * 2.2
    })
  }

  /** A telephone keypad, 1 to # in a block of dark plastic. */
  function buildKeypad() {
    const g = holder('keypad')
    if (g.children.length) return
    const housing = new Mesh(new RoundedBoxGeometry(0.98, 0.14, 1.28, 5, 0.05), plastic)
    housing.position.y = 0.07
    g.add(housing)
    const labels: [string, string][] = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', 'OPER'], ['#', '']]
    const keyGeo = keep(new RoundedBoxGeometry(0.24, 0.07, 0.2, 4, 0.03))
    labels.forEach(([d, l], i) => {
      const [c, x] = canvas(256, 214)
      x.fillStyle = '#e9ecf0'
      x.fillRect(0, 0, 256, 214)
      x.fillStyle = '#1b1f27'
      x.textAlign = 'center'
      x.font = `600 ${l ? 104 : 120}px "Zalando Sans", ui-sans-serif, system-ui, sans-serif`
      x.fillText(d, 128, l ? 128 : 150)
      if (l) { x.font = '600 38px ui-sans-serif, system-ui, sans-serif'; x.fillText(l, 128, 182) }
      const face = env(new MeshPhysicalMaterial({ color: '#ffffff', map: tex(c), roughness: 0.4, clearcoat: 0.4 }), 0.6)
      const side = env(new MeshPhysicalMaterial({ color: '#d9dde3', roughness: 0.4 }), 0.6)
      const key = new Mesh(keyGeo, [side, side, face, side, side, side])
      const col = i % 3, row = Math.floor(i / 3)
      const y0 = 0.16
      key.position.set((col - 1) * 0.29, y0, (row - 1.5) * 0.25)
      g.add(key)
      parts.set('pad:' + d, (down) => { key.position.y = y0 - down * 0.028 })
    })
    shadowed(g)
    g.rotation.y = -6 * DEG
  }

  /** Two octaves, C4 to B5. */
  const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  function buildPiano() {
    const g = holder('piano')
    if (g.children.length) return
    const kw = 0.235, n = 14, total = kw * n
    const slip = new Mesh(new RoundedBoxGeometry(total + 0.16, 0.26, 0.3, 3, 0.02), walnut)
    slip.position.set(0, 0.13, -0.95)
    const bed = new Mesh(new RoundedBoxGeometry(total + 0.16, 0.08, 1.75, 3, 0.02), walnut)
    bed.position.set(0, 0.04, -0.1)
    const felt = new Mesh(new PlaneGeometry(total, 0.06), env(new MeshStandardMaterial({ color: '#1d3a34', roughness: 1 }), 0.1))
    felt.rotation.x = -Math.PI / 2
    felt.position.set(0, 0.082, -0.78)
    g.add(slip, bed, felt)
    const wGeo = keep(new RoundedBoxGeometry(kw - 0.012, 0.12, 1.5, 3, 0.012))
    const bGeo = keep(new RoundedBoxGeometry(0.13, 0.1, 0.95, 3, 0.014))
    for (let i = 0; i < n; i++) {
      const pivot = new Group()
      pivot.position.set(-total / 2 + kw * (i + 0.5), 0.08, -0.8)
      const key = new Mesh(wGeo, ivory)
      key.position.set(0, 0.06, 0.75)
      pivot.add(key)
      g.add(pivot)
      parts.set(`piano:${WHITE[i % 7]}${4 + Math.floor(i / 7)}`, (d) => { pivot.rotation.x = d * 3.4 * DEG })
      // A black key between this white key and the next, where a piano has one.
      if (![2, 6].includes(i % 7) && i < n - 1) {
        const bp = new Group()
        bp.position.set(-total / 2 + kw * (i + 1), 0.2, -0.8)
        const bk = new Mesh(bGeo, blackGloss)
        bk.position.set(0, 0.03, 0.475)
        bp.add(bk)
        g.add(bp)
      }
    }
    shadowed(g)
    g.rotation.y = 0
  }

  /** The tap code: a steel pipe, a spoon, and the grid on a card. */
  let tapCard: { draw(letters: { row: number; col: number }[], n: number): void } | null = null
  function buildPipe() {
    const g = holder('pipe')
    if (g.children.length) return
    const pipe = new Mesh(new CylinderGeometry(0.11, 0.11, 3.2, 40, 1, false), steel)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(0, 0.11, -0.55)
    // Two brackets holding it to the desk.
    for (const xx of [-1.1, 1.1]) {
      const br = new Mesh(new TorusGeometry(0.125, 0.018, 10, 30, Math.PI), steel)
      br.position.set(xx, 0.11, -0.55)
      br.rotation.y = Math.PI / 2
      g.add(br)
    }
    // A teaspoon, turned on a lathe: the bowl, and the handle as a flattened rod.
    const spoon = new Group()
    const bowl = new Mesh(new SphereGeometry(0.1, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel)
    bowl.scale.set(0.75, 0.32, 1)
    bowl.rotation.x = Math.PI
    bowl.position.set(0, 0.03, 0)
    const handle = new Mesh(new RoundedBoxGeometry(0.05, 0.016, 0.62, 2, 0.007), steel)
    handle.position.set(0, 0.05, 0.38)
    handle.rotation.x = -8 * DEG
    spoon.add(bowl, handle)
    const swing = new Group()
    swing.position.set(0.25, 0.08, 0.35)
    spoon.position.set(0, 0, -0.62)
    swing.add(spoon)
    g.add(pipe, swing)
    parts.set('spoon', (d) => { swing.rotation.x = -(1 - d) * 16 * DEG })
    swing.rotation.x = -16 * DEG
    // The card.
    const W = 900, H = 900
    const [c, x] = canvas(W, H)
    const t = tex(c)
    const draw = (letters: { row: number; col: number }[], n: number) => {
      paperGround(x, W, H, '#e8eae6', 31)
      const grid = ['ABCDE', 'FGHIJ', 'LMNOP', 'QRSTU', 'VWXYZ']
      const ox = 150, oy = 170, s = 130
      x.strokeStyle = 'rgba(40,46,60,0.6)'
      x.lineWidth = 2
      for (let i = 0; i <= 5; i++) {
        x.beginPath(); x.moveTo(ox, oy + i * s); x.lineTo(ox + 5 * s, oy + i * s); x.stroke()
        x.beginPath(); x.moveTo(ox + i * s, oy); x.lineTo(ox + i * s, oy + 5 * s); x.stroke()
      }
      x.font = `400 70px ${TYPE}`
      x.textAlign = 'center'
      x.fillStyle = 'rgba(16,20,30,0.95)'
      grid.forEach((row, ri) => row.split('').forEach((ch, ci) => x.fillText(ri === 0 && ci === 2 ? 'C/K' : ch, ox + ci * s + s / 2, oy + ri * s + s / 2 + 24)))
      x.font = `400 44px ${TYPE}`
      x.fillStyle = 'rgba(40,46,60,0.7)'
      for (let i = 0; i < 5; i++) { x.fillText(String(i + 1), ox - 50, oy + i * s + s / 2 + 15); x.fillText(String(i + 1), ox + i * s + s / 2, oy - 34) }
      x.textAlign = 'left'
      x.font = `italic 600 ${'52'}px ${HAND}`
      x.fillStyle = 'rgba(40,46,60,0.55)'
      x.fillText('row, then column', ox, H - 46)
      // Pencil rings round each letter already knocked out.
      const rr = rng(77)
      for (let i = 0; i < Math.min(n, letters.length); i++) {
        const { row, col } = letters[i]
        const cx = ox + (col - 1) * s + s / 2, cy = oy + (row - 1) * s + s / 2
        x.strokeStyle = `rgba(60,64,72,${0.45 + rr() * 0.2})`
        x.lineWidth = 3.5
        x.beginPath()
        x.ellipse(cx + (rr() - 0.5) * 8, cy + (rr() - 0.5) * 8, 50 + rr() * 8, 44 + rr() * 8, rr() - 0.5, 0, Math.PI * 2 - 0.3)
        x.stroke()
      }
      t.needsUpdate = true
    }
    draw([], 0)
    tapCard = { draw }
    const card = new Mesh(sheetGeometry(0.95, 0.95, 0.008, 31), paperMaterial(t))
    card.position.set(-0.1, 0, 0.55)
    card.rotation.y = 5 * DEG
    g.add(card)
    shadowed(g)
  }

  /* ---- framing, presses, the loop ---- */
  const FRAMES: Record<string, Framing> = {
    sheet: { r: 1.2, elev: 64, az: 0 },
    // Close in on the first lines: the dots are 1.44 mm across.
    braille: { r: 0.46, elev: 36, az: -14, target: [-0.38, 0, -0.5] },
    tape: { r: 1.5, elev: 58, az: 0 },
    printout: { r: 1.15, elev: 66, az: 0 },
    postcard: { r: 0.88, elev: 62, az: 4 },
    key: { r: 1.05, elev: 34, az: -18, target: [0, 0.12, -0.25] },
    keypad: { r: 0.82, elev: 52, az: 0, target: [0, 0.1, 0] },
    piano: { r: 1.8, elev: 38, az: -6, target: [0, 0.1, 0] },
    pipe: { r: 1.05, elev: 46, az: -10, target: [0, 0.08, 0.05] },
  }

  let current = ''
  let framing: Framing = FRAMES.sheet
  const camFrom = { pos: new Vector3(), tgt: new Vector3() }
  const camTo = { pos: new Vector3(), tgt: new Vector3() }
  let camT = 1
  const look = new Vector3()

  function aim(f: Framing, into: { pos: Vector3; tgt: Vector3 }) {
    const w = Math.max(1, canvasEl.clientWidth), h = Math.max(1, canvasEl.clientHeight)
    const v = camera.fov * DEG, hf = 2 * Math.atan(Math.tan(v / 2) * (w / h))
    const d = f.r / Math.sin(Math.min(v, hf) / 2)
    const e = f.elev * DEG, a = f.az * DEG
    const t = f.target ?? [0, 0, 0]
    into.tgt.set(t[0], t[1], t[2])
    into.pos.set(t[0] + d * Math.cos(e) * Math.sin(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.cos(a))
  }

  type Press = { part: string; t0: number; t1: number }
  let presses: Press[] = []
  const clock = () => performance.now() / 1000
  let raf = 0, last = 0

  function apply(now: number) {
    const down = new Map<string, number>()
    for (const p of presses) {
      if (!parts.has(p.part)) continue
      // A quick fall, a short hold, a quick return.
      const a = Math.min(1, Math.max(0, (now - p.t0) / 0.022)), b = Math.min(1, Math.max(0, (now - p.t1) / 0.05))
      down.set(p.part, Math.max(down.get(p.part) ?? 0, a * (1 - b)))
    }
    for (const [name, set] of parts) set(down.get(name) ?? 0)
    presses = presses.filter((p) => now < p.t1 + 0.06)
  }

  function frame(now: number) {
    const dt = last ? Math.min(0.05, now / 1000 - last) : 1 / 60
    last = now / 1000
    if (camT < 1) {
      camT = Math.min(1, camT + dt / 0.9)
      const k = camT < 0.5 ? 4 * camT ** 3 : 1 - (-2 * camT + 2) ** 3 / 2
      camera.position.lerpVectors(camFrom.pos, camTo.pos, k)
      look.lerpVectors(camFrom.tgt, camTo.tgt, k)
      camera.lookAt(look)
    }
    apply(clock())
    renderer.render(scene, camera)
    if (camT < 1 || presses.length) raf = requestAnimationFrame(frame)
    else { raf = 0; last = 0 }
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame) }

  function fit() {
    const w = Math.max(1, canvasEl.clientWidth), h = Math.max(1, canvasEl.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1.75 : 2))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // The title sits over the top of the picture, so the desk is drawn a little low to clear it.
    camera.setViewOffset(w, h, 0, -h * (w < 600 ? 0.12 : 0.08), w, h)
    camera.updateProjectionMatrix()
    aim(framing, camTo)
    if (camT >= 1) { camera.position.copy(camTo.pos); look.copy(camTo.tgt); camera.lookAt(look) }
  }

  function show(v: DeskView) {
    const br = v.kind === 'braille'
    rake.visible = br
    rake.intensity = br ? 4.6 : 0
    lamp.intensity = br ? LAMP * 0.3 : LAMP
    sky.intensity = br ? 0.12 : 0.32
    switch (v.kind) {
      case 'sheet': buildSheet(v.heading, v.text); break
      case 'braille': buildBraille(v.cells); break
      case 'tape': {
        const len = buildTape(v.bytes)
        FRAMES.tape = { r: Math.min(2.2, Math.max(0.9, len * 0.48)), elev: 58, az: 0 }
        break
      }
      case 'printout': buildPrintout(v.rows, v.cols, v.bits, v.caption); break
      case 'postcard': buildPostcard(v.to, v.address, v.message, v.seed); break
      case 'key': buildKey(); break
      case 'keypad': buildKeypad(); break
      case 'piano': buildPiano(); break
      case 'pipe': buildPipe(); break
    }
    for (const [k, g] of groups) g.visible = k === v.kind
    const changed = current !== v.kind
    current = v.kind
    framing = FRAMES[v.kind]
    if (changed) {
      camFrom.pos.copy(camera.position)
      camFrom.tgt.copy(look)
      aim(framing, camTo)
      camT = opts.still || !camera.position.lengthSq() ? 1 : 0
      if (camT >= 1) { camera.position.copy(camTo.pos); look.copy(camTo.tgt); camera.lookAt(look) }
    }
    wake()
  }

  const ro = new ResizeObserver(() => { fit(); wake() })
  ro.observe(canvasEl)
  fit()

  // A typed page waits for its typeface: draw again once the fonts are in.
  let lastView: DeskView | null = null
  document.fonts?.ready.then(() => { if (lastView && ['sheet', 'postcard', 'printout'].includes(lastView.kind)) show(lastView) })

  return {
    show(v) { lastView = v; show(v) },
    press(part, delay, dur) {
      const t = clock() + delay
      presses.push({ part, t0: t, t1: t + Math.max(0.03, dur) })
      wake()
    },
    ring(letters, n) { tapCard?.draw(letters, n); wake() },
    release() { presses = []; apply(clock()); wake() },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      for (const g of groups.values()) clear(g)
      for (const d of disposables) d.dispose()
      for (const m of [brass, steel, blackGloss, ivory, walnut, plastic, deskMat]) m.dispose()
      wood.dispose(); room.dispose()
      renderer.dispose()
    },
  }
}

