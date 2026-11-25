/**
 * What grows on the walk (build3d.ts), and the wind in it.
 *
 * Every tree the island's map plants, built as the real thing: a trunk of
 * bark that tapers and leans, branches out of it, and a crown of leaves —
 * dozens of leaf sprays, each a card painted with real leaves (an atlas drawn
 * here: broad leaves, cherry blossom, pine needles, a palm's frond), lit as
 * the round crown they make rather than as flat cards. Pines in whorls of
 * drooping boughs, snow on those up the mountain; cypresses in columns;
 * palms on ringed, curving trunks with arching fronds and coconuts; saguaro
 * and barrel cacti, ribbed; rocks, boulders, hoodoos and buttes in their
 * bands; reeds; the bare snag.
 *
 * Grass: tufts of blades, and wildflowers among them, on every lawn and
 * verge (wherever terrain.ts says grass grows), in chunks drawn only near
 * you and growing up out of the ground at the edge of what you can see.
 *
 * Everything that grows moves in the wind: a slow sway with gusts running
 * through it, the leaves and blades fluttering at their tips — less for
 * anyone who asked for reduced motion.
 *
 * Trunks, cacti and rocks are solid (boxes, as walls are): you walk round a
 * tree, and climb a low rock.
 */
import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshDepthMaterial, MeshStandardMaterial,
  Quaternion, RGBADepthPacking, SRGBColorSpace, Vector3, type Material,
} from 'three'
import { PX_H, W, Y, type WorldData } from './build3d'

const UP = new Vector3(0, 1, 0)
type Box = { i0: number; j0: number; i1: number; j1: number; z0: number; z1: number }

/** A small seeded random: the same tree grows the same way every time. */
function rng(seed: number) {
  let a = Math.floor(seed * 2654435761) >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/* ---- the wind ------------------------------------------------------------- */
/** Sways a vertex by how free it is to move (aSway: 0 at the root, 1 at a tip), in the world, with gusts. */
const WIND = /* glsl */ `
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif
  {
    vec3 wp = (modelMatrix * mvPosition).xyz;
    float gust = 0.55 + 0.45 * sin(uTime * 0.45 + wp.x * 0.13 + wp.z * 0.09) * sin(uTime * 0.23 + wp.z * 0.07);
    float s = sin(uTime * 1.5 + wp.x * 0.8 + wp.z * 0.6) * 0.65 + sin(uTime * 2.9 + wp.x * 2.1 - wp.z * 1.3) * 0.3;
    float flutter = sin(uTime * 8.0 + wp.x * 23.0 + wp.z * 17.0) * aSway;
    vec2 dir = vec2(0.82, 0.57);
    mvPosition.xz += (dir * (s + 0.6) * gust + vec2(flutter * 0.25)) * aSway * aSway * uWind * uBend;
    mvPosition.y -= abs(s) * aSway * aSway * uWind * uBend * 0.25;
    GROW
  }
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
`
type Wind = { time: { value: number }; wind: { value: number } }
function windy(m: Material, w: Wind, bend: number, grow = '') {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = w.time; sh.uniforms.uWind = w.wind; sh.uniforms.uBend = { value: bend }
    sh.vertexShader = 'attribute float aSway;\nuniform float uTime;\nuniform float uWind;\nuniform float uBend;\n' + sh.vertexShader.replace('#include <project_vertex>', () => WIND.replace('GROW', grow))
    // Leaves are lit as the crown they make, from either side.
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
  }
  m.customProgramCacheKey = () => `walk-wind-${bend}-${grow ? 'g' : ''}`
}

/* ---- the leaves: an atlas, drawn ------------------------------------------- */
/** Where each kind of leaf is in the atlas (u0, v0, u1, v1). */
const CELL = { broad: [0, 0.5, 0.5, 1], blossom: [0.5, 0.5, 1, 1], needle: [0, 0, 0.5, 0.5], frond: [0.5, 0, 1, 0.5] } as const
type Cell = keyof typeof CELL

function leafAtlas() {
  if (typeof document === 'undefined') return null
  const S = 512, H = 256, cv = document.createElement('canvas'); cv.width = S; cv.height = S
  const g = cv.getContext('2d')!
  const r = rng(7)
  const leaf = (x: number, y: number, len: number, wid: number, ang: number, col: string) => {
    g.save(); g.translate(x, y); g.rotate(ang)
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -wid, len, 0); g.quadraticCurveTo(len * 0.5, wid, 0, 0); g.fill()
    g.strokeStyle = 'rgba(220,235,190,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.9, 0); g.stroke()
    g.restore()
  }
  const greens = ['#3b6a2c', '#4a7a33', '#5a8a3a', '#2f5a26', '#6a9640', '#44722f']
  // Broad leaves: a spray from a twig at the bottom.
  {
    const cx = H / 2, cy = H / 2
    g.strokeStyle = '#5a4634'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, H - 4); g.quadraticCurveTo(cx + 6, cy + 20, cx, cy - 30); g.stroke()
    for (let k = 0; k < 190; k++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 104
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9
      leaf(x, y, 20 + r() * 14, 7 + r() * 4, a + (r() - 0.5) * 1.4, greens[Math.floor(r() * greens.length)])
    }
  }
  // Blossom: a few leaves, and a cloud of petals.
  {
    const ox = H, cx = ox + H / 2, cy = H / 2
    for (let k = 0; k < 30; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 95; leaf(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 14, 5, a, greens[k % 3]) }
    const pinks = ['#f2b7c8', '#f7d0dc', '#ffffff', '#eaa3b9', '#f9e1e8']
    for (let k = 0; k < 300; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 104
      g.fillStyle = pinks[Math.floor(r() * pinks.length)]; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.92, 4 + r() * 3.5, 0, Math.PI * 2); g.fill()
    }
  }
  // Pine: a bough, broad at its base, needles off both sides of its twigs.
  {
    const oy = H, cx = H / 2
    g.strokeStyle = '#4b3a2c'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, oy + H - 2); g.lineTo(cx, oy + 8); g.stroke()
    for (let t = 0; t < 1; t += 0.012) {
      const y = oy + H - 4 - t * (H - 14), span = (1 - t) * 105 + 12
      for (const side of [-1, 1]) {
        const x0 = cx, x1 = cx + side * span * (0.6 + r() * 0.4)
        g.strokeStyle = ['#24452a', '#2f5733', '#3a6a3a'][Math.floor(r() * 3)]; g.lineWidth = 1.6
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y - span * 0.25); g.stroke()
      }
    }
  }
  // A palm's frond: the rib up the middle, leaflets hanging off it both ways, shorter towards the tip.
  {
    const ox = H, oy = H, cx = ox + H / 2
    g.strokeStyle = '#7c8a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, oy + H - 2); g.lineTo(cx, oy + 4); g.stroke()
    for (let t = 0.02; t < 1; t += 0.018) {
      const y = oy + H - 4 - t * (H - 10), len = (Math.sin(Math.PI * (0.12 + 0.88 * t)) * 0.9 + 0.1) * 118
      for (const side of [-1, 1]) {
        g.strokeStyle = ['#3e6e2c', '#4d7f33', '#5e9038'][Math.floor(r() * 3)]; g.lineWidth = 3.2
        g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + side * len * 0.5, y - 6, cx + side * len, y + len * 0.28); g.stroke()
      }
    }
  }
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 4
  return tex
}

/* ---- gathering geometry ------------------------------------------------------ */
class Gather {
  pos: number[] = []; nor: number[] = []; col: number[] = []; sway: number[] = []; uv: number[] = []
  private c = new Color()
  v(p: Vector3, n: Vector3, hex: string | Color, sway: number, u = 0, w = 0) {
    if (typeof hex === 'string') this.c.set(hex); else this.c.copy(hex)
    this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.col.push(this.c.r, this.c.g, this.c.b); this.sway.push(sway); this.uv.push(u, w)
  }
  geometry(uv = false) {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('aSway', new Float32BufferAttribute(this.sway, 1))
    if (uv) g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    return g
  }
}

export function flora(d: WorldData, opts: { siteAt: (x: number, z: number) => number; heightAt: (x: number, z: number) => number; meadow: (x: number, z: number) => Color | null; boxes: Box[]; time: { value: number }; phone: boolean }) {
  const wood = new Gather(), leaves = new Gather()
  const solids: Box[] = []
  const N = new Vector3()
  // A tapering round bar, its normals round it, its sway rising along it.
  const limb = (a: Vector3, b: Vector3, r0: number, r1: number, col: string, s0: number, s1: number, sides = 7) => {
    const ax = b.clone().sub(a), len = ax.length(); if (len < 1e-5) return
    ax.divideScalar(len)
    const u = new Vector3().crossVectors(ax, Math.abs(ax.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize(), v = new Vector3().crossVectors(ax, u)
    const ring = (c: Vector3, r: number, k: number) => { const t = (k / sides) * Math.PI * 2; N.copy(u).multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t)); return [c.clone().addScaledVector(N, r), N.clone()] as const }
    for (let k = 0; k < sides; k++) {
      const [p0, n0] = ring(a, r0, k), [p1, n1] = ring(a, r0, k + 1), [q0, m0] = ring(b, r1, k), [q1, m1] = ring(b, r1, k + 1)
      wood.v(p0, n0, col, s0); wood.v(p1, n1, col, s0); wood.v(q1, m1, col, s1)
      wood.v(p0, n0, col, s0); wood.v(q1, m1, col, s1); wood.v(q0, m0, col, s1)
    }
  }
  // A leaf spray: a card of leaves, lit as part of the round crown (normal from its middle), swaying as its tips do.
  const card = (c: Vector3, right: Vector3, up: Vector3, w: number, h: number, cell: Cell, tint: Color, n: Vector3, sway: number) => {
    const [u0, v0, u1, v1] = CELL[cell]
    const R = right.clone().multiplyScalar(w / 2), Uv = up.clone().multiplyScalar(h / 2)
    const a = c.clone().sub(R).sub(Uv), b = c.clone().add(R).sub(Uv), e = c.clone().add(R).add(Uv), f = c.clone().sub(R).add(Uv)
    const sb = sway * 0.75, st = Math.min(1, sway * 1.1)
    leaves.v(a, n, tint, sb, u0, v0); leaves.v(b, n, tint, sb, u1, v0); leaves.v(e, n, tint, st, u1, v1)
    leaves.v(a, n, tint, sb, u0, v0); leaves.v(e, n, tint, st, u1, v1); leaves.v(f, n, tint, st, u0, v1)
  }
  const randDir = (r: () => number) => { const t = r() * Math.PI * 2, z = r() * 2 - 1, s = Math.sqrt(1 - z * z); return new Vector3(Math.cos(t) * s, z, Math.sin(t) * s) }
  /** A round crown of leaf sprays about a middle: n cards within an ellipsoid. */
  const crown = (c: Vector3, R: number, Rv: number, n: number, size: number, cell: Cell, base: Color, r: () => number, sway: number, floor = c.y - Rv) => {
    for (let k = 0; k < n; k++) {
      const dir = randDir(r), d = 0.5 + 0.5 * Math.sqrt(r())
      const p = c.clone().add(new Vector3(dir.x * R * d, dir.y * Rv * d, dir.z * R * d))
      if (p.y < floor) p.y = floor + r() * 0.02
      const nrm = p.clone().sub(c).normalize().lerp(UP, 0.35).normalize()
      const right = new Vector3().crossVectors(dir, UP).normalize(); if (right.lengthSq() < 0.01) right.set(1, 0, 0)
      right.applyAxisAngle(dir, r() * Math.PI)
      const up = new Vector3().crossVectors(right, dir).normalize()
      const tint = base.clone().multiplyScalar(0.78 + 0.42 * r() * (0.6 + 0.4 * (p.y - c.y + Rv) / (2 * Rv)))
      const s = size * (0.8 + 0.4 * r())
      card(p, right, up, s, s, cell, tint, nrm, sway * (0.6 + 0.4 * ((p.y - c.y) / Rv + 1) / 2))
    }
  }
  /** A rock: a lumpy, faceted stone, its colour in bands. */
  const stone = (c: Vector3, rx: number, ry: number, cols: string[], r: () => number) => {
    const lat = 6, lon = 9, seed = r() * 10
    const P = (la: number, lo: number) => {
      const t = -Math.PI / 2 + (la / lat) * Math.PI, p = (lo / lon) * Math.PI * 2
      const k = 0.78 + 0.32 * Math.abs(Math.sin(seed + la * 1.7 + lo * 2.3) * Math.cos(seed * 0.7 + lo * 1.1))
      return new Vector3(c.x + Math.cos(t) * Math.sin(p) * rx * k, c.y + Math.max(-0.15, Math.sin(t)) * ry * k, c.z + Math.cos(t) * Math.cos(p) * rx * k)
    }
    for (let la = 0; la < lat; la++) for (let lo = 0; lo < lon; lo++) {
      const a = P(la, lo), b = P(la, lo + 1), e = P(la + 1, lo + 1), f = P(la + 1, lo)
      for (const [p, q, s] of [[a, b, e], [a, e, f]]) {
        const n = new Vector3().subVectors(q, p).cross(new Vector3().subVectors(s, p))
        if (n.lengthSq() < 1e-14) continue
        n.normalize(); if (n.dot(p.clone().add(q).add(s).divideScalar(3).sub(c)) < 0) n.negate()
        const col = cols[Math.min(cols.length - 1, Math.floor(((p.y - c.y + ry) / (2 * ry)) * cols.length))]
        wood.v(p, n, col, 0); wood.v(q, n, col, 0); wood.v(s, n, col, 0)
      }
    }
  }
  /** A ribbed column (a cactus's stem, a hoodoo's drum): its rings at heights, radii, colour by band. */
  const ribbed = (base: Vector3, rings: [number, number][], cols: (q: number) => string, ribs: number, depth: number, sway = 0) => {
    const sides = ribs * 2
    for (let q = 0; q + 1 < rings.length; q++) for (let k = 0; k < sides; k++) {
      const P = (i: number, kk: number) => { const a = (kk / sides) * Math.PI * 2, rr = rings[i][1] * (kk % 2 ? 1 - depth : 1); return new Vector3(base.x + Math.sin(a) * rr, base.y + rings[i][0], base.z + Math.cos(a) * rr) }
      const Nn = (kk: number) => { const a = (kk / sides) * Math.PI * 2; return new Vector3(Math.sin(a), 0.15, Math.cos(a)).normalize() }
      const col = cols(q), s0 = sway * q / rings.length, s1 = sway * (q + 1) / rings.length
      wood.v(P(q, k), Nn(k), col, s0); wood.v(P(q, k + 1), Nn(k + 1), col, s0); wood.v(P(q + 1, k + 1), Nn(k + 1), col, s1)
      wood.v(P(q, k), Nn(k), col, s0); wood.v(P(q + 1, k + 1), Nn(k + 1), col, s1); wood.v(P(q + 1, k), Nn(k), col, s1)
    }
    const top = rings[rings.length - 1], c = base.clone().add(new Vector3(0, top[0], 0))
    for (let k = 0; k < sides; k++) {
      const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2
      wood.v(c.clone().add(new Vector3(0, top[1] * 0.4, 0)), UP, cols(rings.length - 2), sway)
      wood.v(c.clone().add(new Vector3(Math.sin(a0) * top[1], 0, Math.cos(a0) * top[1])), UP, cols(rings.length - 2), sway)
      wood.v(c.clone().add(new Vector3(Math.sin(a1) * top[1], 0, Math.cos(a1) * top[1])), UP, cols(rings.length - 2), sway)
    }
  }
  const solid = (c: Vector3, r: number, h: number) => solids.push({ i0: c.z - r, i1: c.z + r, j0: c.x - r, j1: c.x + r, z0: c.y - 0.05, z1: c.y + h })

  for (const [name, x, y, z0, k] of d.plants) {
    const gz = opts.siteAt(y, x), z = Math.abs(z0 - gz) < 14 ? gz - 0.6 : z0
    const kind = name.replace(/[0-9]+$/, '').split('-')[0]
    const B = W(x, y, z), r = rng(x * 31.7 + y * 7.3 + k)
    const lean = new Vector3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12).normalize()
    if (kind === 'round' || kind === 'blossom') {
      const th = Y(8 * k) * 1.35, R = 0.2 * k * 1.15, Rv = R * 0.85
      const top = B.clone().addScaledVector(lean, th * 1.05), c = B.clone().addScaledVector(lean, th).add(new Vector3(0, Rv * 0.75, 0))
      limb(B.clone().add(new Vector3(0, -0.02, 0)), top, 0.03 * k, 0.017 * k, '#6b5442', 0, 0.25)
      for (let b = 0; b < 5; b++) { const t = randDir(r); t.y = Math.abs(t.y) * 0.6 + 0.3; limb(B.clone().addScaledVector(lean, th * (0.7 + 0.25 * r())), c.clone().addScaledVector(t.normalize(), R * 0.55), 0.012 * k, 0.005 * k, '#6b5442', 0.2, 0.55, 5) }
      const leafy = kind === 'blossom' ? new Color('#ffffff') : new Color().setHSL(0.27 + r() * 0.05, 0.42, 0.42)
      crown(c, R, Rv, 78, 0.2 * k, kind === 'blossom' ? 'blossom' : 'broad', leafy, r, 1)
      solid(B, 0.035 * k, th)
    } else if (kind === 'bush') {
      const R = 0.14 * k, Rv = 0.1 * k
      crown(B.clone().add(new Vector3(0, Rv * 0.8, 0)), R, Rv, 30, 0.14 * k, 'broad', new Color().setHSL(0.28, 0.4, 0.38), r, 0.6, B.y)
      solid(B, R * 0.6, Rv * 1.6)
    } else if (kind === 'pine' || kind === 'snowpine') {
      const H = Y(36 * k) * 1.15, snowy = kind === 'snowpine'
      limb(B.clone().add(new Vector3(0, -0.02, 0)), B.clone().add(new Vector3(0, H, 0)), 0.032 * k, 0.005 * k, '#5d4636', 0, 0.5)
      const whorls = 13, tint = snowy ? new Color('#c9d5d8') : new Color('#ffffff')
      for (let w = 0; w < whorls; w++) {
        const f = (w + 0.5) / whorls, h = H * (0.18 + 0.78 * f), rr = 0.22 * k * Math.pow(1 - f, 0.85) + 0.035 * k
        const at = B.clone().add(new Vector3(0, h, 0)), n = 8 + Math.round((1 - f) * 4), off = r() * 6
        for (let b = 0; b < n; b++) {
          const a = off + (b / n) * Math.PI * 2, dir = new Vector3(Math.sin(a), -0.32 - 0.1 * r(), Math.cos(a)).normalize()
          const lat = new Vector3(Math.cos(a), 0, -Math.sin(a))
          const mid = at.clone().addScaledVector(dir, rr * 0.55), nrm = new Vector3(Math.sin(a), 0.6, Math.cos(a)).normalize()
          const col = tint.clone().multiplyScalar(0.85 + 0.3 * r())
          card(mid, lat, dir, rr * 1.15, rr * 1.25, 'needle', col, nrm, 0.35 + 0.5 * f)
          card(mid, new Vector3(0, 1, 0).cross(dir).normalize().lerp(UP, 0.6).normalize(), dir, rr * 0.6, rr * 1.1, 'needle', col.clone().multiplyScalar(0.9), nrm, 0.35 + 0.5 * f)
        }
      }
      // Filled in: sprays all through the cone, so it is a tree and not a skeleton of one.
      for (let m = 0; m < 46; m++) {
        const f = r(), h = H * (0.2 + 0.78 * f), rmax = 0.2 * k * Math.pow(1 - f, 0.85) + 0.03 * k
        const a = r() * Math.PI * 2, d = rmax * Math.sqrt(r()) * 0.8, p = B.clone().add(new Vector3(Math.sin(a) * d, h, Math.cos(a) * d))
        const dir = randDir(r), right = new Vector3().crossVectors(dir, UP).normalize(), up = new Vector3().crossVectors(right, dir).normalize()
        card(p, right, up, rmax * 0.9, rmax * 0.9, 'needle', tint.clone().multiplyScalar(0.7 + 0.3 * r()), new Vector3(Math.sin(a), 0.7, Math.cos(a)).normalize(), 0.3 + 0.5 * f)
      }
      card(B.clone().add(new Vector3(0, H * 0.98, 0)), new Vector3(1, 0, 0), UP, 0.08 * k, 0.12 * k, 'needle', tint, UP, 0.9)
      solid(B, 0.04 * k, H * 0.6)
    } else if (kind === 'cypress') {
      const H = Y(33 * k)
      limb(B.clone().add(new Vector3(0, -0.02, 0)), B.clone().add(new Vector3(0, Y(6 * k), 0)), 0.022 * k, 0.016 * k, '#5d4636', 0, 0.1)
      crown(B.clone().add(new Vector3(0, Y(3 * k) + H / 2, 0)), 0.085 * k, H / 2, 46, 0.09 * k, 'needle', new Color('#9fb39a'), r, 0.7)
      solid(B, 0.03 * k, H)
    } else if (kind === 'palm') {
      const H = Y(22 * k) * 1.3, bend = new Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(H * 0.28)
      const P = (t: number) => B.clone().add(new Vector3(0, H * t, 0)).addScaledVector(bend, t * t)
      // The trunk, in rings, each a little proud of the last.
      for (let s = 0; s < 12; s++) {
        const t0 = s / 12, t1 = (s + 1) / 12, r0 = (0.026 - 0.008 * t0) * k
        limb(P(t0), P(t1), r0 * 1.08, r0 * 0.92, s % 2 ? '#8a745a' : '#9e8768', t0 * 0.5, t1 * 0.5)
      }
      const crownAt = P(1)
      for (let f = 0; f < 14; f++) {
        const a = (f / 14) * Math.PI * 2 + r() * 0.35, dir = new Vector3(Math.sin(a), 0, Math.cos(a)), lat = new Vector3(Math.cos(a), 0, -Math.sin(a))
        const L = (0.38 + 0.12 * r()) * k, lift = 0.35 + 0.3 * r()
        const S = (t: number) => crownAt.clone().addScaledVector(dir, L * t).add(new Vector3(0, L * (lift * t - 1.05 * t * t), 0))
        for (let s = 0; s < 6; s++) {
          const t0 = s / 6, t1 = (s + 1) / 6
          const w0 = L * 0.3 * Math.sin(Math.PI * (0.1 + 0.9 * t0)) + 0.01, w1 = L * 0.3 * Math.sin(Math.PI * (0.1 + 0.9 * t1)) + 0.01
          const [u0, v0, u1, v1] = CELL.frond, vv0 = v0 + (v1 - v0) * t0, vv1 = v0 + (v1 - v0) * t1
          // The leaflets hang down off the rib on both sides.
          const A = S(t0).addScaledVector(lat, -w0 / 2).add(new Vector3(0, -w0 * 0.3, 0)), Bq = S(t0).addScaledVector(lat, w0 / 2).add(new Vector3(0, -w0 * 0.3, 0))
          const C = S(t1).addScaledVector(lat, w1 / 2).add(new Vector3(0, -w1 * 0.3, 0)), D = S(t1).addScaledVector(lat, -w1 / 2).add(new Vector3(0, -w1 * 0.3, 0))
          const n = dir.clone().multiplyScalar(0.3).add(UP).normalize(), tint = new Color('#ffffff').multiplyScalar(0.85 + 0.25 * r())
          const s0 = 0.4 + 0.6 * t0, s1 = 0.4 + 0.6 * t1
          leaves.v(A, n, tint, s0, u0, vv0); leaves.v(Bq, n, tint, s0, u1, vv0); leaves.v(C, n, tint, s1, u1, vv1)
          leaves.v(A, n, tint, s0, u0, vv0); leaves.v(C, n, tint, s1, u1, vv1); leaves.v(D, n, tint, s1, u0, vv1)
        }
      }
      for (let c = 0; c < 3; c++) { const a = (c / 3) * Math.PI * 2; stone(crownAt.clone().add(new Vector3(Math.sin(a) * 0.025 * k, -0.02 * k, Math.cos(a) * 0.025 * k)), 0.017 * k, 0.019 * k, ['#5a3f26', '#6b4d2e'], r) }
      solid(B, 0.032 * k, H * 0.8)
    } else if (kind === 'cactus') {
      const H = Y(18 * k) * 1.2, R = 0.034 * k, col = (q: number) => (q % 2 ? '#4f8a55' : '#558f5a')
      ribbed(B.clone().add(new Vector3(0, -0.01, 0)), [[0, R], [H * 0.8, R], [H * 0.95, R * 0.8], [H, R * 0.4]], col, 8, 0.12, 0.15)
      for (const side of [1, -1]) {
        if (side < 0 && r() < 0.4) continue
        const a = r() * Math.PI * 2, out = new Vector3(Math.sin(a), 0, Math.cos(a)), from = B.clone().add(new Vector3(0, H * (0.35 + 0.2 * r()), 0))
        const elbow = from.clone().addScaledVector(out, 0.07 * k)
        limb(from, elbow, R * 0.6, R * 0.6, '#4f8a55', 0.05, 0.08)
        ribbed(elbow.clone().add(new Vector3(0, -R * 0.6, 0)), [[0, R * 0.6], [H * 0.3, R * 0.6], [H * 0.36, R * 0.3]], col, 6, 0.12, 0.1)
      }
      solid(B, R * 1.1, H)
    } else if (kind === 'barrel') {
      ribbed(B.clone().add(new Vector3(0, -0.01, 0)), [[0, 0.03 * k], [0.03 * k, 0.05 * k], [0.06 * k, 0.045 * k], [0.075 * k, 0.02 * k]], (q) => (q % 2 ? '#5d9156' : '#679a5e'), 10, 0.14)
      for (let f = 0; f < 4; f++) { const a = (f / 4) * Math.PI * 2; stone(B.clone().add(new Vector3(Math.sin(a) * 0.012 * k, 0.078 * k, Math.cos(a) * 0.012 * k)), 0.008 * k, 0.006 * k, ['#e993b0'], r) }
      solid(B, 0.04 * k, 0.07 * k)
    } else if (kind === 'rock' || kind === 'boulders') {
      const n = kind === 'boulders' ? 3 : 1
      for (let m = 0; m < n; m++) {
        const rx = 0.12 * k * (m ? 0.55 + 0.3 * r() : 1), at = B.clone().add(new Vector3((m ? r() - 0.5 : 0) * 0.22 * k, rx * 0.25, (m ? r() - 0.5 : 0) * 0.22 * k))
        stone(at, rx, rx * 0.7, ['#7a7672', '#8d8a85', '#9a968f'], r)
        if (m === 0) solid(at, rx * 0.65, rx * 0.65)
      }
    } else if (kind === 'hoodoo' || kind === 'butte') {
      const big = kind === 'butte', R = (big ? 0.32 : 0.09) * k, H = Y((big ? 30 : 34) * k)
      const bands = ['#c4a98c', '#b08f72', '#d2baa0', '#a8856a']
      const rings: [number, number][] = big ? [[0, R * 1.12], [H * 0.25, R * 1.02], [H * 0.55, R], [H * 0.9, R * 0.97], [H, R * 0.95]] : [[0, R * 1.2], [H * 0.3, R], [H * 0.5, R * 0.75], [H * 0.65, R * 0.9], [H * 0.85, R * 0.62], [H * 0.93, R * 0.6]]
      ribbed(B.clone().add(new Vector3(0, -0.02, 0)), rings, (q) => bands[q % bands.length], big ? 7 : 5, 0.18)
      if (!big) stone(B.clone().add(new Vector3(0, H * 0.97, 0)), R * 1.25, R * 0.45, ['#8a6c55', '#7d604b'], r)
      solid(B, R * 0.85, H)
    } else if (kind === 'reeds') {
      for (let m = 0; m < 16; m++) {
        const a = r() * Math.PI * 2, d = r() * 0.05 * k, h = Y(10 * k) * (0.6 + 0.5 * r()), base = B.clone().add(new Vector3(Math.sin(a) * d, -0.01, Math.cos(a) * d))
        const tip = base.clone().add(new Vector3(Math.sin(a) * h * 0.15, h, Math.cos(a) * h * 0.15)), side = new Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(0.004)
        const col = m % 3 ? '#6f9a4e' : '#8aa85a'
        wood.v(base.clone().sub(side), UP, col, 0); wood.v(base.clone().add(side), UP, col, 0); wood.v(tip, UP, col, 1)
      }
    } else if (kind === 'snag') {
      const H = Y(14 * k) * 1.3, top = B.clone().addScaledVector(lean, H)
      limb(B.clone().add(new Vector3(0, -0.02, 0)), top, 0.022 * k, 0.006 * k, '#8d7a66', 0, 0.2)
      for (let b = 0; b < 4; b++) { const t = randDir(r); t.y = Math.abs(t.y) * 0.5 + 0.4; const from = B.clone().addScaledVector(lean, H * (0.45 + 0.4 * r())); limb(from, from.clone().addScaledVector(t.normalize(), 0.08 * k), 0.008 * k, 0.002 * k, '#8d7a66', 0.2, 0.5, 5) }
      solid(B, 0.025 * k, H)
    }
  }

  const wind = { value: 1 }, w: Wind = { time: opts.time, wind }
  const atlasTex = leafAtlas()
  const woodMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
  windy(woodMat, w, 0.012)
  const leafMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide, alphaTest: 0.42, ...(atlasTex ? { map: atlasTex } : {}) })
  windy(leafMat, w, 0.03)
  const woodMesh = new Mesh(wood.geometry(), woodMat)
  woodMesh.castShadow = true; woodMesh.receiveShadow = true
  const leafMesh = new Mesh(leaves.geometry(true), leafMat)
  leafMesh.castShadow = true; leafMesh.receiveShadow = true
  // Its shadow is the leaves' own shape, swaying with them.
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaTest: 0.42, ...(atlasTex ? { map: atlasTex } : {}) })
  windy(depth, w, 0.03)
  leafMesh.customDepthMaterial = depth
  // (The occlusion pass would see each spray as a solid card: it leaves them out; lens.ts.)
  leafMesh.userData.noAO = true

  const group = new Group()
  group.add(woodMesh, leafMesh)
  const lawn = grass(opts, w, opts.phone ? 70 : 140)
  group.add(lawn.group)
  return { group, solids, wind, lawn, grown: { wood: wood.pos.length / 9, leaves: leaves.pos.length / 18 } }
}

/* ---- grass -------------------------------------------------------------------- */
/** Tufts of grass (and some wildflowers), a chunk of four tiles at a time, drawn within reach of you. */
function grass(opts: { heightAt: (x: number, z: number) => number; meadow: (x: number, z: number) => Color | null; boxes: Box[] }, w: Wind, perTile: number) {
  // A tuft: blades around its middle, each bending out, dark at the root and light at the tip.
  const tuft = (flower: boolean) => {
    const g = new Gather(), r = rng(flower ? 3 : 1), blades = flower ? 6 : 11
    const base = new Color('#ffffff').multiplyScalar(0.5), mid = new Color('#ffffff').multiplyScalar(0.85), tip = new Color('#ffffff').multiplyScalar(1.15)
    for (let b = 0; b < blades; b++) {
      const a = (b / blades) * Math.PI * 2 + r(), out = new Vector3(Math.sin(a), 0, Math.cos(a)), side = new Vector3(Math.cos(a), 0, -Math.sin(a))
      // (About 20 to 40 cm: a metre is 0.11.)
      const h = 0.022 + 0.022 * r(), wd = 0.0032
      const sp = 0.002 + 0.012 * r(), p0 = out.clone().multiplyScalar(sp), p1 = out.clone().multiplyScalar(sp + h * 0.18).add(new Vector3(0, h * 0.55, 0)), p2 = out.clone().multiplyScalar(sp + h * 0.5).add(new Vector3(0, h, 0))
      const L0 = p0.clone().addScaledVector(side, -wd), R0 = p0.clone().addScaledVector(side, wd), L1 = p1.clone().addScaledVector(side, -wd * 0.6), R1 = p1.clone().addScaledVector(side, wd * 0.6)
      g.v(L0, UP, base, 0); g.v(R0, UP, base, 0); g.v(R1, UP, mid, 0.55)
      g.v(L0, UP, base, 0); g.v(R1, UP, mid, 0.55); g.v(L1, UP, mid, 0.55)
      g.v(L1, UP, mid, 0.55); g.v(R1, UP, mid, 0.55); g.v(p2, UP, tip, 1)
    }
    if (flower) {
      // A flower head on its stalk: a little star of petals.
      const top = new Vector3(0, 0.045, 0), white = new Color('#ffffff').multiplyScalar(1.6)
      for (let p = 0; p < 5; p++) {
        const a0 = (p / 5) * Math.PI * 2, a1 = a0 + 0.9
        g.v(top, UP, white, 1); g.v(top.clone().add(new Vector3(Math.sin(a0) * 0.007, 0.001, Math.cos(a0) * 0.007)), UP, white, 1); g.v(top.clone().add(new Vector3(Math.sin(a1) * 0.007, 0.001, Math.cos(a1) * 0.007)), UP, white, 1)
      }
      const s = new Vector3(0.0025, 0, 0)
      g.v(s.clone().negate(), UP, base, 0); g.v(s, UP, base, 0); g.v(top, UP, mid, 1)
    }
    return g.geometry()
  }
  const blades = tuft(false), heads = tuft(true)
  const reach = { value: 9 }
  const mat = (bend: number) => {
    const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide })
    // Out at the edge of reach, grass grows up out of the ground (and is not drawn past it).
    windy(m, w, bend, `{ vec3 o = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz; float f = 1.0 - smoothstep(uReach * 0.7, uReach, length(o.xz - cameraPosition.xz)); mvPosition.y = mix(instanceMatrix[3].y, mvPosition.y, f); }`)
    const inner = m.onBeforeCompile
    m.onBeforeCompile = (sh, r) => { inner.call(m, sh, r); sh.uniforms.uReach = reach; sh.vertexShader = 'uniform float uReach;\n' + sh.vertexShader }
    return m
  }
  const bladeMat = mat(0.02), headMat = mat(0.02)
  // Where nothing is built.
  const built = new Map<string, Box[]>()
  for (const b of opts.boxes) for (let i = Math.floor(b.i0); i <= b.i1; i++) for (let j = Math.floor(b.j0); j <= b.j1; j++) { const k = `${i},${j}`; if (!built.has(k)) built.set(k, []); built.get(k)!.push(b) }
  const clear = (x: number, z: number, y: number) => !(built.get(`${Math.floor(z)},${Math.floor(x)}`) ?? []).some((b) => x > b.j0 - 0.02 && x < b.j1 + 0.02 && z > b.i0 - 0.02 && z < b.i1 + 0.02 && b.z0 < y + 0.1 && b.z1 > y - 0.05)
  const CH = 4, group = new Group(), chunks: { mesh: Group; x: number; z: number }[] = []
  const m4 = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), flowers = ['#ffffff', '#c9b8f2', '#f2b7c8', '#b8d2f5']
  for (let ci = -1; ci < 31; ci += CH) for (let cj = -1; cj < 31; cj += CH) {
    const r = rng(ci * 97 + cj * 13 + 5), pts: { x: number; z: number; y: number; c: Color }[] = []
    for (let n = 0; n < perTile * CH * CH; n++) {
      const x = cj + r() * CH, z = ci + r() * CH, c = opts.meadow(x, z)
      if (!c) continue
      const y = opts.heightAt(x, z)
      if (!clear(x, z, y)) continue
      pts.push({ x, z, y, c })
    }
    if (!pts.length) continue
    const nFl = Math.floor(pts.length * 0.06)
    const bl = new InstancedMesh(blades, bladeMat, pts.length - nFl), fl = new InstancedMesh(heads, headMat, Math.max(1, nFl))
    pts.forEach((t, k) => {
      const flower = k < nFl, im = flower ? fl : bl, idx = flower ? k : k - nFl
      q.setFromAxisAngle(UP, r() * Math.PI * 2); s.setScalar(0.8 + 0.55 * r()); p.set(t.x, t.y - 0.004, t.z)
      m4.compose(p, q, s); im.setMatrixAt(idx, m4)
      im.setColorAt(idx, flower ? new Color(flowers[k % flowers.length]).multiplyScalar(0.85) : t.c.clone().multiplyScalar(0.85 + 0.35 * r()))
    })
    if (!nFl) fl.count = 0
    const cg = new Group()
    for (const im of [bl, fl]) { im.receiveShadow = true; im.computeBoundingSphere(); cg.add(im) }
    group.add(cg); chunks.push({ mesh: cg, x: cj + CH / 2, z: ci + CH / 2 })
  }
  return {
    group, reach,
    /** Draw the chunks within reach of a point (the camera). */
    near(x: number, z: number) { for (const c of chunks) c.mesh.visible = Math.hypot(c.x - x, c.z - z) < reach.value + CH * 0.75 },
    count: () => chunks.reduce((t, c) => t + c.mesh.children.reduce((u, m) => u + (m as InstancedMesh).count, 0), 0),
    /** Every tuft's foot (for the checks). */
    feet: () => chunks.flatMap((c) => c.mesh.children.flatMap((m) => { const im = m as InstancedMesh, out: [number, number][] = [], e = new Matrix4(); for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, e); out.push([e.elements[12], e.elements[14]]) } return out })),
  }
}

export { PX_H }
