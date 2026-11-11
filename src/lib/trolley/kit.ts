/**
 * What the layout is made from: the surfaces (drawn once into canvases, since
 * a model railway is flock, gravel, stained wood and enamel paint and none of
 * those needs a photograph), and the few geometry helpers every model on it
 * uses.
 *
 * Named imports throughout; see the note at the top of lib/orbit-render.ts.
 */
import {
  BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Matrix4, Euler, Quaternion, Vector3,
  RepeatWrapping, SRGBColorSpace,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A seeded generator, so a scene is the same scene every time it is built. */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---- geometry ---------------------------------------------------------- */

const M = new Matrix4(), Qn = new Quaternion(), E = new Euler(), P = new Vector3(), S = new Vector3()

/** Give a geometry one flat colour and move it into place. Returns it unindexed, ready to merge. */
export function part(
  geo: BufferGeometry, color: number | Color,
  at: [number, number, number] = [0, 0, 0], turn: [number, number, number] = [0, 0, 0], scale: [number, number, number] | number = 1,
): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale
  M.compose(P.set(...at), Qn.setFromEuler(E.set(...turn)), S.set(s[0], s[1], s[2]))
  g.applyMatrix4(M)
  const c = color instanceof Color ? color : new Color(color)
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2))
  if (!g.getAttribute('normal')) g.computeVertexNormals()
  // Whatever else a helper geometry carries (uv1, tangents) would stop the merge.
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k)
  return g
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()
  return g
}

export type Along = { x: number; y: number; z: number; nx: number; nz: number }

/** Points along a line in the ground plane, each with the direction across it. */
export function along(pts: Array<{ x: number; z: number }>, y = 0): Along[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
    // Across is the tangent turned a quarter towards +z.
    return { x: p.x, y, z: p.z, nx: -(b.z - a.z) / l, nz: (b.x - a.x) / l }
  })
}

/**
 * Sweep a cross-section along a line. The section is a list of [across, up]
 * corners; each edge between two corners becomes its own strip, so the shape
 * is smooth along its length and has real edges across it.
 */
export function sweep(line: Along[], section: Array<[number, number]>, closed = true, vScale = 1): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  const edges = closed ? section.length : section.length - 1
  let run = 0
  const runs = line.map((p, i) => (i ? (run += Math.hypot(p.x - line[i - 1].x, p.z - line[i - 1].z)) : 0))
  for (let e = 0; e < edges; e++) {
    const a = section[e], b = section[(e + 1) % section.length]
    const base = pos.length / 3
    line.forEach((p, i) => {
      pos.push(p.x + p.nx * a[0], p.y + a[1], p.z + p.nz * a[0], p.x + p.nx * b[0], p.y + b[1], p.z + p.nz * b[0])
      uv.push(a[0] * vScale, runs[i] * vScale, b[0] * vScale, runs[i] * vScale)
      if (i) { const k = base + i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
    })
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* ---- surfaces ---------------------------------------------------------- */

function canvas(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const el = document.createElement('canvas')
  el.width = el.height = size
  draw(el.getContext('2d')!, size)
  const t = new CanvasTexture(el)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  return t
}

/** Speckle a canvas so that it tiles: anything near an edge is drawn again on the other side. */
function scatter(c: CanvasRenderingContext2D, s: number, n: number, r: () => number, one: (x: number, y: number) => void) {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      if (x + ox < -24 || x + ox > s + 24 || y + oy < -24 || y + oy > s + 24) continue
      one(x + ox, y + oy)
    }
  }
}

/** Flock: thousands of short fibres in a handful of greens over a mottled ground. */
export function grassTexture() {
  return canvas(1024, (c, s) => {
    const r = rng(11)
    c.fillStyle = '#5f7a34'
    c.fillRect(0, 0, s, s)
    scatter(c, s, 260, r, (x, y) => {
      const g = c.createRadialGradient(x, y, 0, x, y, 40 + r() * 70)
      const tone = r()
      g.addColorStop(0, tone > 0.6 ? 'rgba(126,142,58,0.34)' : tone > 0.3 ? 'rgba(64,98,40,0.36)' : 'rgba(92,120,48,0.3)')
      g.addColorStop(1, 'rgba(90,120,50,0)')
      c.fillStyle = g
      c.fillRect(x - 110, y - 110, 220, 220)
    })
    const greens = ['#3f5f25', '#4d7029', '#6a8a38', '#7f9a44', '#8ea34c', '#556f2c', '#a3ac5a']
    c.lineCap = 'round'
    scatter(c, s, 16000, r, (x, y) => {
      c.strokeStyle = greens[(r() * greens.length) | 0]
      c.globalAlpha = 0.35 + r() * 0.5
      c.lineWidth = 0.8 + r() * 1.1
      const a = -Math.PI / 2 + (r() - 0.5) * 1.5, l = 3 + r() * 6
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke()
    })
    c.globalAlpha = 1
  }, 1)
}

/** Ballast: angular grey and brown stones, each with a lit side and a shadow under it. */
export function gravelTexture() {
  return canvas(512, (c, s) => {
    const r = rng(23)
    c.fillStyle = '#6f6860'
    c.fillRect(0, 0, s, s)
    const tones = ['#8d877e', '#7a746c', '#a09a90', '#655f58', '#93887a', '#b0aaa0', '#5a544e', '#877d70']
    scatter(c, s, 2600, r, (x, y) => {
      const rad = 3 + r() * 6, n = 5 + ((r() * 3) | 0), spin = r() * 6.28
      c.fillStyle = 'rgba(30,26,22,0.45)'
      c.beginPath()
      for (let k = 0; k < n; k++) { const a = spin + (k / n) * 6.28, q = rad * (0.7 + r() * 0.45); c.lineTo(x + 1.5 + Math.cos(a) * q, y + 2 + Math.sin(a) * q) }
      c.fill()
      c.fillStyle = tones[(r() * tones.length) | 0]
      c.beginPath()
      for (let k = 0; k < n; k++) { const a = spin + (k / n) * 6.28, q = rad * (0.7 + r() * 0.45); c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) }
      c.fill()
      c.fillStyle = 'rgba(255,250,240,0.16)'
      c.beginPath(); c.arc(x - rad * 0.25, y - rad * 0.3, rad * 0.45, 0, 6.28); c.fill()
    })
  }, 1)
}

/** Creosoted timber: long grain, a few splits, darker at the ends. */
export function woodTexture() {
  return canvas(256, (c, s) => {
    const r = rng(37)
    c.fillStyle = '#5d4534'
    c.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i++) {
      const y = r() * s
      c.strokeStyle = r() > 0.5 ? 'rgba(34,22,14,0.28)' : 'rgba(150,118,88,0.2)'
      c.lineWidth = 0.6 + r() * 1.6
      c.beginPath()
      const x0 = r() * s, len = 30 + r() * 160
      c.moveTo(x0, y); c.bezierCurveTo(x0 + len * 0.3, y + (r() - 0.5) * 3, x0 + len * 0.6, y + (r() - 0.5) * 3, x0 + len, y + (r() - 0.5) * 2)
      c.stroke()
    }
  }, 1)
}

/** Corrugated card: fine flutes, a paler worn edge, tape. */
export function cardTexture() {
  return canvas(512, (c, s) => {
    const r = rng(41)
    c.fillStyle = '#b08d62'
    c.fillRect(0, 0, s, s)
    for (let x = 0; x < s; x += 4) {
      c.fillStyle = x % 8 ? 'rgba(80,56,30,0.07)' : 'rgba(255,240,214,0.06)'
      c.fillRect(x, 0, 2, s)
    }
    for (let i = 0; i < 500; i++) {
      c.fillStyle = r() > 0.5 ? 'rgba(70,48,26,0.06)' : 'rgba(255,236,204,0.06)'
      c.fillRect(r() * s, r() * s, 10 + r() * 60, 2 + r() * 6)
    }
  }, 1)
}

/** Text on a transparent ground, for the crate's mark and the tram's number. */
export function labelTexture(text: string, ink: string, ground: string | null, font = '700 150px Georgia, serif', w = 256, h = 256) {
  const el = document.createElement('canvas')
  el.width = w; el.height = h
  const c = el.getContext('2d')!
  if (ground) { c.fillStyle = ground; c.fillRect(0, 0, w, h) }
  c.fillStyle = ink
  c.font = font
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, w / 2, h / 2 + h * 0.04)
  const t = new CanvasTexture(el)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** A soft round puff, for dust, steam and the glow round a lamp. */
export function puffTexture() {
  const el = document.createElement('canvas')
  el.width = el.height = 128
  const c = el.getContext('2d')!
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(el)
  t.colorSpace = SRGBColorSpace
  return t
}
