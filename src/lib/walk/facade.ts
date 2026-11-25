/**
 * Buildings up close (build3d.ts): what makes a wall a wall, a roof a roof
 * and a window a window when you walk right up to one.
 *
 *   - What they are made of, painted in a shader from where each point is:
 *     walls of painted render, grained and patched, streaked by the rain and
 *     darkened by damp at the foot; roofs of tiles in courses, each tile its
 *     own shade, the gaps between them dark; flat roofs of gravel over a
 *     membrane; metal, a little brushed.
 *   - Windows you can see into. Behind every pane is a room — its back wall
 *     with a picture on it, its side walls, its floor and ceiling, a sofa or
 *     a sideboard against the wall, curtains or a blind at the window — worked
 *     out for each pixel from where you stand (interior mapping), so it moves
 *     as a real room would. By day it is dim behind the glass's reflection;
 *     at night, if someone is home, its light is on.
 *   - Things the island's map draws on its buildings that the walk did not
 *     have yet: the lighthouse, the painted boards and posters (their pictures
 *     drawn from the map's own), window boxes, dishes, and a name board over
 *     the door of every game's building.
 *
 * The positions follow Unity's builders (unity/.../Models.cs), so the walk
 * and the realistic island agree.
 */
import {
  BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3,
} from 'three'

export const PX = 45.254834, PH = PX * 0.8660254
/** Screen pixels, and the site's height pixels, as world units. */
export const Px = (v: number) => v / PX
export const Hy = (v: number) => v / PH
/** Along the ground towards the map's camera, and across its picture to the right (Unity's Facing and Across). */
export const FACING = new Vector3(Math.SQRT1_2, 0, Math.SQRT1_2), ACROSS = new Vector3(-Math.SQRT1_2, 0, Math.SQRT1_2)

/** What a surface is made of, as the facade shader knows it. */
export const MAT = { paint: 0, wall: 1, roof: 2, tiles: 3, metal: 4, trim: 5 } as const

/* ---- the windows: glass with a room behind it ------------------------------ */
export class GlassBag {
  pos: number[] = []; nor: number[] = []; col: number[] = []; win: number[] = []; tan: number[] = []; seed: number[] = []; home: number[] = []
  private c = new Color()
  /**
   * A pane: its corners bottom-left, bottom-right, top-right, top-left (as you face it from outside), its
   * outward normal, its pane colour, a seed of its own, and when (0–1 of the homes lit) its light comes on
   * (2: never — nobody lives there).
   */
  pane(a: Vector3, b: Vector3, c: Vector3, d: Vector3, out: Vector3, hex: string, seed: number, home: number) {
    const W = a.distanceTo(b), H = a.distanceTo(d)
    if (W < 1e-4 || H < 1e-4) return
    const T = b.clone().sub(a).normalize()
    this.c.set(hex)
    const v = [[a, 0, 0], [b, 1, 0], [c, 1, 1], [a, 0, 0], [c, 1, 1], [d, 0, 1]] as const
    // Wound to face out.
    const f = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
    const order = f.dot(out) >= 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4]
    for (const k of order) {
      const [p, u, w] = v[k]
      this.pos.push(p.x, p.y, p.z); this.nor.push(out.x, out.y, out.z); this.col.push(this.c.r, this.c.g, this.c.b)
      this.win.push(u, w, W, H); this.tan.push(T.x, T.y, T.z); this.seed.push(seed); this.home.push(home)
    }
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3))
    g.setAttribute('aWin', new Float32BufferAttribute(this.win, 4))
    g.setAttribute('aTan', new Float32BufferAttribute(this.tan, 3))
    g.setAttribute('aSeed', new Float32BufferAttribute(this.seed, 1))
    g.setAttribute('aHome', new Float32BufferAttribute(this.home, 1))
    return g
  }
}

const ROOM = /* glsl */ `
{
  vec3 N = normalize(vGN), T = normalize(vTan), B = normalize(cross(N, T));
  if (B.y < 0.0) B = -B;
  vec3 V = normalize(vGW - cameraPosition);
  // The ray from your eye through this point of the glass, in the room's own frame: across, up, in.
  vec3 rd = vec3(dot(V, T), dot(V, B), -dot(V, N));
  rd.z = max(rd.z, 0.02);
  float W = vWin.z, H = vWin.w, s = vSeed;
  vec3 ro = vec3(vWin.x * W, vWin.y * H, 0.0);
  // The room: wider than its window, its floor below the sill and its ceiling above the head, some way back.
  float D = max(0.26, W * 1.4);
  vec3 lo = vec3(-0.55 * W, -0.6 * H, 0.0), hi = vec3(1.55 * W, 1.4 * H, D);
  vec3 tt = (mix(lo, hi, step(0.0, rd)) - ro) / rd;
  float t = min(min(tt.x, tt.y), tt.z);
  vec3 h = ro + rd * t;
  vec3 wall = mix(vec3(0.8, 0.76, 0.7), vec3(0.64, 0.7, 0.76), fract(s * 7.13)) * (0.82 + 0.3 * fract(s * 13.7));
  vec3 c;
  if (t == tt.z) {
    c = wall;
    // A picture on the back wall, or shelves.
    vec2 q = vec2(h.x - 0.5 * W, h.y - 0.75 * H);
    if (fract(s * 3.7) > 0.4 && abs(q.x) < 0.22 * W && abs(q.y) < 0.18 * H) c = mix(vec3(0.15, 0.2, 0.3), vec3(0.5, 0.62, 0.55), fract(s * 21.3)) * (0.7 + 0.3 * step(0.03 * W, 0.22 * W - abs(q.x)));
    if (h.y < lo.y + 0.06 * H) c *= 0.7;
  } else if (t == tt.y) {
    if (rd.y < 0.0) {
      // The floor: boards, or a carpet.
      c = fract(s * 5.9) > 0.5 ? vec3(0.42, 0.3, 0.21) * (0.85 + 0.15 * step(0.5, fract(h.x * 34.0))) : vec3(0.36, 0.38, 0.42);
    } else {
      c = vec3(0.86);
    }
  } else {
    c = wall * 0.78;
  }
  // A sofa or a sideboard against the back wall.
  vec3 f0 = vec3(0.12 * W, lo.y, D * 0.7), f1 = vec3(0.88 * W, lo.y + 0.55 * H, D);
  vec3 ta = (f0 - ro) / rd, tb = (f1 - ro) / rd;
  vec3 tn = min(ta, tb), tf = max(ta, tb);
  float tin = max(max(tn.x, tn.y), tn.z), tout = min(min(tf.x, tf.y), tf.z);
  if (tin < tout && tin > 0.0 && tin < t) {
    c = mix(vec3(0.3, 0.33, 0.42), vec3(0.45, 0.36, 0.3), fract(s * 11.1)) * (tin == tn.y ? 1.1 : 0.85);
    t = tin;
  }
  // Further in is darker.
  c *= 1.0 - 0.4 * clamp(t / (D * 1.4), 0.0, 1.0);
  // Curtains drawn to the sides, or a blind half down, at the window itself.
  float cw = fract(s * 3.31) > 0.3 ? 0.1 + 0.1 * fract(s * 5.71) : 0.0;
  if (vWin.x < cw || vWin.x > 1.0 - cw) c = mix(vec3(0.75, 0.72, 0.66), vec3(0.5, 0.58, 0.72), fract(s * 17.3)) * (0.78 + 0.22 * sin(vWin.x * 80.0 * W / 0.15));
  float bl = fract(s * 9.13) > 0.72 ? 0.25 + 0.4 * fract(s * 2.9) : 0.0;
  if (vWin.y > 1.0 - bl) c = vec3(0.86, 0.85, 0.82) * (0.8 + 0.2 * step(0.35, fract(vWin.y * H * 160.0)));
  // Lit: by day, dimly, from its own windows; at night, if someone is home, by its lamp.
  float lit = smoothstep(vHome, vHome + 0.02, uHomes);
  vec3 lamp = vec3(1.0, 0.88, 0.72);
  totalEmissiveRadiance += c * (0.5 * uDay + lamp * lit * 1.5 * (1.0 - uDay * 0.85));
}
`

/** Glass with a room behind it: uHomes is how many of the homes have their lights on, uDay how light it is outside. */
export function glassMaterial() {
  const homes = { value: 0 }, day = { value: 1 }
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.04, metalness: 0, envMapIntensity: 1.0 })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHomes = homes; sh.uniforms.uDay = day
    sh.vertexShader = 'attribute vec4 aWin;\nattribute vec3 aTan;\nattribute float aSeed;\nattribute float aHome;\nvarying vec4 vWin;\nvarying vec3 vTan;\nvarying float vSeed;\nvarying float vHome;\nvarying vec3 vGW;\nvarying vec3 vGN;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWin = aWin; vTan = aTan; vSeed = aSeed; vHome = aHome;\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz; vGN = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = 'uniform float uHomes;\nuniform float uDay;\nvarying vec4 vWin;\nvarying vec3 vTan;\nvarying float vSeed;\nvarying float vHome;\nvarying vec3 vGW;\nvarying vec3 vGN;\n' +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', () => '#include <emissivemap_fragment>\n' + ROOM)
        // (The glass itself is near black: what you see is the room's light and the sky's reflection.)
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.08;')
  }
  m.customProgramCacheKey = () => 'walk-glass'
  return { material: m, homes, day }
}

/* ---- what walls and roofs are made of ---------------------------------------- */
const FACADE = /* glsl */ `
{
  float kind = floor(vFMat + 0.5);
  vec3 n = normalize(vFN), an = abs(n);
  vec2 face = an.x > an.z ? vFW.zy : vFW.xy;
  float dist = length(vFW - cameraPosition), fade = 1.0 - smoothstep(4.0, 22.0, dist);
  vec3 c = diffuseColor.rgb; float rough = 0.8, bh = 0.0;
  if (kind > 0.5 && kind < 1.5) {
    // Render: grain, the odd patch, rain streaks down from the top, damp darkening the foot.
    float g = fNoise(face * 60.0) * 0.5 + fNoise(face * 17.0) * 0.5;
    float patchy = smoothstep(0.55, 0.8, fNoise(face * 2.3 + 7.0));
    float streak = fNoise(vec2(face.x * 55.0, face.y * 1.2)) * smoothstep(0.0, 1.0, fNoise(vec2(face.x * 9.0, face.y * 0.6 + 3.0)));
    float above = vFW.y - vFBase;
    c *= (0.94 + 0.08 * mix(0.5, g, fade)) * (1.0 - 0.05 * patchy) * (1.0 - 0.07 * streak);
    c *= 1.0 - 0.22 * (1.0 - smoothstep(0.0, 0.07, above)) * step(an.y, 0.5);
    bh = g * 0.5; rough = 0.88;
  } else if (kind > 1.5 && kind < 2.5) {
    // A flat roof: gravel over the membrane.
    float grit = fNoise(vFW.xz * 140.0), lump = fNoise(vFW.xz * 30.0);
    c = mix(c * 0.55, vec3(0.42, 0.43, 0.45), 0.6) * (0.8 + 0.25 * mix(0.5, grit, fade)) * (0.92 + 0.12 * lump);
    bh = grit * 0.8 + lump * 0.3; rough = 0.95;
  } else if (kind > 2.5 && kind < 3.5) {
    // Tiles in courses up the slope, each course offset by half, each tile a shade of its own.
    vec3 across = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4, 0.0, 0.0));
    float u = dot(vFW, across) * 26.0, v = vFW.y * 34.0;
    float row = floor(v), off = mod(row, 2.0) * 0.5;
    float cell = floor(u + off);
    vec2 f = vec2(fract(u + off), fract(v));
    float gap = smoothstep(0.0, 0.08, f.x) * smoothstep(1.0, 0.92, f.x) * smoothstep(0.0, 0.16, f.y);
    float shade = 0.86 + 0.24 * fHash(vec2(cell, row));
    c *= shade * mix(0.55, 1.0, gap) * (1.0 - 0.18 * f.y);
    bh = gap * 0.6 + f.y * 0.8; rough = 0.72;
  } else if (kind > 3.5 && kind < 4.5) {
    c *= 0.92 + 0.08 * fNoise(vec2(face.x * 200.0, face.y * 6.0)); rough = 0.45;
  } else {
    c *= 0.95 + 0.05 * fNoise(face * 40.0);
  }
  diffuseColor.rgb = c;
  fRough = rough; fBump = bh * fade * 0.05;
}
`
const FACADE_HEAD = /* glsl */ `
varying float vFMat;
varying float vFBase;
varying vec3 vFW;
varying vec3 vFN;
float fRough;
float fBump;
float fHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float fNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), u.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 fPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`

/** The material of everything built: its colours from the model, its surfaces painted by what each is (aMat). */
export function facadeMaterial() {
  const m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aMat;\nattribute float aBase;\nvarying float vFMat;\nvarying float vFBase;\nvarying vec3 vFW;\nvarying vec3 vFN;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFMat = aMat; vFBase = aBase;\n  vFW = (modelMatrix * vec4(transformed, 1.0)).xyz; vFN = normalize(mat3(modelMatrix) * objectNormal);')
    sh.fragmentShader = FACADE_HEAD + sh.fragmentShader
      .replace('#include <color_fragment>', () => '#include <color_fragment>\n' + FACADE)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = fRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = fPerturb(-vViewPosition, normal, vec2(dFdx(fBump), dFdy(fBump)), faceDirection);')
  }
  m.customProgramCacheKey = () => 'walk-facade'
  return m
}

/* ---- pictures: the map's own prints, and the games' names ------------------------- */
export type Print = { name: string; w: number; h: number; svg: string }
/** UV-mapped quads, drawn with one atlas texture. */
export class PrintBag {
  pos: number[] = []; uv: number[] = []; nor: number[] = []
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, uv: [number, number, number, number], out: Vector3) {
    const [u0, v0, u1, v1] = uv
    const f = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a))
    const P = [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]] as const
    const order = f.dot(out) >= 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4]
    for (const k of order) { const [p, u, v] = P[k]; this.pos.push(p.x, p.y, p.z); this.uv.push(u, v); this.nor.push(out.x, out.y, out.z) }
  }
  geometry() {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2))
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3))
    return g
  }
}

/**
 * An atlas of pictures: the map's prints (SVG, drawn in as they load) and the games' name boards (text).
 * place() returns where each sits (u0, v0, u1, v1); in Node (the checks) there is no canvas, and nothing is drawn.
 */
export function atlas(prints: Print[], names: string[]) {
  const SCALE = 6, W = 2048
  type Slot = { x: number; y: number; w: number; h: number }
  const slots = new Map<string, Slot>()
  let x = 0, y = 0, row = 0
  const put = (key: string, w: number, h: number) => {
    if (x + w > W) { x = 0; y += row + 4; row = 0 }
    slots.set(key, { x, y, w, h }); x += w + 4; row = Math.max(row, h)
  }
  for (const p of prints) put('print:' + p.name, Math.min(W, Math.ceil(p.w * SCALE)), Math.ceil(p.h * SCALE))
  for (const n of names) put('name:' + n, 512, 96)
  const H = Math.pow(2, Math.ceil(Math.log2(Math.max(64, y + row + 4))))
  const uvOf = (key: string): [number, number, number, number] | null => {
    const s = slots.get(key); if (!s) return null
    return [s.x / W, 1 - (s.y + s.h) / H, (s.x + s.w) / W, 1 - s.y / H]
  }
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissive: new Color('#ffffff'), emissiveIntensity: 0 })
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const g = cv.getContext('2d')!
    const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace; tex.anisotropy = 8; tex.minFilter = LinearMipmapLinearFilter
    material.map = tex; material.emissiveMap = tex; material.needsUpdate = true
    // The games' names: white on the island's navy, in the site's own type.
    for (const n of names) {
      const s = slots.get('name:' + n)!
      g.fillStyle = '#1b2340'; g.fillRect(s.x, s.y, s.w, s.h)
      g.strokeStyle = '#4fe3c1'; g.lineWidth = 5; g.strokeRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16)
      g.fillStyle = '#f4f6fc'; g.textAlign = 'center'; g.textBaseline = 'middle'
      let size = 46; g.font = `700 ${size}px system-ui, sans-serif`
      while (g.measureText(n).width > s.w - 60 && size > 18) { size -= 2; g.font = `700 ${size}px system-ui, sans-serif` }
      g.fillText(n, s.x + s.w / 2, s.y + s.h / 2 + 2)
    }
    for (const p of prints) {
      const s = slots.get('print:' + p.name)!
      const img = new Image()
      img.onload = () => { g.drawImage(img, s.x, s.y, s.w, s.h); tex.needsUpdate = true }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${s.w}" height="${s.h}">${p.svg}</svg>`)
    }
    tex.needsUpdate = true
  }
  return { uvOf, material }
}
