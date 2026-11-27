/**
 * The walk's water (build3d.ts): the sea round the island, and the stream
 * and pond on it.
 *
 * The sea knows how deep it is everywhere. The ground under it (terrain.ts)
 * is baked once into a little map — the depth at each point, and how far it
 * is from the nearest shore (a rock, or the foot of a waterfall, counting as
 * shore) — and the water reads it as it is drawn:
 *
 *   - its colour: clear over the sand in the shallows, so you see the beach
 *     go down under it, turquoise as it deepens, the deep sea's own blue
 *     beyond; more mirror than window at a glancing angle, as water is;
 *   - surf: foam where it laps the sand and the rocks, and lines of it
 *     running in to every shore;
 *   - its swell: the sea itself rises and falls in long, slow waves (and you
 *     with it, swimming: waveAt is the same sum), calming to nothing at the
 *     water's edge, so the coast you walk down never moves.
 *
 * The stream runs downhill, its ripples carried along with it, flecked with
 * foam; it tumbles white down its little falls and over the cliff into the
 * sea; the pond lies still.
 */
import {
  BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, DoubleSide, Float32BufferAttribute, FrontSide, LinearFilter, Mesh, MeshPhysicalMaterial, RGBAFormat, UnsignedByteType,
} from 'three'
import { wetness, RIPPLES_GLSL } from './wet'

/**
 * The waves: direction, wavenumber (radians a tile), and steepness (how far each tilts the surface). Each runs
 * at deep water's speed for its length (ω² = g k, g in tiles: 9.8 m/s² is 2.8 tiles/s²). The first three are
 * long enough to lift the sea; all of them tilt its surface for the light.
 */
const RAW: [number, number, number, number][] = [
  [1, 0.35, 1.9, 0.11], [0.6, 1, 2.7, 0.08], [-0.8, 0.5, 4.3, 0.06], [0.2, -1, 7.9, 0.05],
  [1, -0.6, 13, 0.04], [-0.3, -1, 21, 0.03], [0.9, 0.9, 33, 0.025],
]
export const WAVES = RAW.map(([x, z, k, s]) => { const l = Math.hypot(x, z); return { x: x / l, z: z / l, k, s, w: Math.sqrt(2.84 * k) } })
const LIFT = 3
/** How much the swell lifts the sea, by depth (world units): none at the water's edge, all of it where it is deep. */
export const calm = (depth: number) => { const t = Math.max(0, Math.min(1, (depth - 0.04) / 0.5)); return t * t * (3 - 2 * t) }
/** The sea's surface at a point (above its rest level), at a time, over water of a depth: as the sea is drawn. */
export function waveAt(x: number, z: number, t: number, depth: number) {
  let h = 0
  for (let n = 0; n < LIFT; n++) { const W = WAVES[n]; h += (W.s / W.k) * Math.sin((W.x * x + W.z * z) * W.k - t * W.w) }
  return h * calm(depth)
}
const f = (v: number) => v.toFixed(4)
const LIFT_GLSL = WAVES.slice(0, LIFT).map((W) => `h += ${f(W.s / W.k)} * sin(dot(vec2(${f(W.x)}, ${f(W.z)}), p) * ${f(W.k)} - uTime * ${f(W.w)});`).join('\n    ')
const TILT_GLSL = WAVES.map((W) => `g += vec2(${f(W.x)}, ${f(W.z)}) * ${f(W.s)} * cos(dot(vec2(${f(W.x)}, ${f(W.z)}), p) * ${f(W.k)} - uTime * ${f(W.w)});`).join('\n    ')

const NOISE = /* glsl */ `
float wHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

/** The map of the sea: depth and distance to shore, a texel to an eighth of a tile. */
const RES = 8
type Field = { tex: DataTexture; box: [number, number, number]; depth: (x: number, z: number) => number }

function field(x0: number, size: number, heightAt: (x: number, z: number) => number, seaY: number, rocks: { x: number; z: number; r: number }[], falls: { x: number; z: number }[]): Field {
  const S = size * RES, depth = new Float32Array(S * S), dist = new Float32Array(S * S)
  for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
    const x = x0 + (b + 0.5) / RES, z = x0 + (a + 0.5) / RES
    let dp = seaY - heightAt(x, z)
    for (const r of rocks) if (Math.hypot(x - r.x, z - r.z) < r.r * 0.85) dp = -0.1
    depth[a * S + b] = dp
    // The shore: land, a rock, or where a waterfall strikes the sea.
    dist[a * S + b] = dp <= 0 || falls.some((q) => Math.hypot(x - q.x, z - q.z) < 0.12) ? 0 : 1e9
  }
  // Distance out from the shore (a chamfer pass each way, in texels).
  const pass = (a0: number, a1: number, da: number, b0: number, b1: number, db: number) => {
    for (let a = a0; a !== a1; a += da) for (let b = b0; b !== b1; b += db) {
      const i = a * S + b
      let v = dist[i]
      const pa = a - da, pb = b - db
      if (pa >= 0 && pa < S) v = Math.min(v, dist[pa * S + b] + 1)
      if (pb >= 0 && pb < S) v = Math.min(v, dist[a * S + pb] + 1)
      if (pa >= 0 && pa < S && pb >= 0 && pb < S) v = Math.min(v, dist[pa * S + pb] + 1.4142)
      if (pa >= 0 && pa < S && b + db >= 0 && b + db < S) v = Math.min(v, dist[pa * S + b + db] + 1.4142)
      dist[i] = v
    }
  }
  pass(0, S, 1, 0, S, 1); pass(S - 1, -1, -1, S - 1, -1, -1); pass(0, S, 1, S - 1, -1, -1); pass(S - 1, -1, -1, 0, S, 1)
  const px = new Uint8Array(S * S * 4)
  for (let i = 0; i < S * S; i++) {
    px[i * 4] = Math.round(Math.max(0, Math.min(1, (depth[i] + 0.2) / 2)) * 255)
    px[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, dist[i] / RES / 2)) * 255)
    px[i * 4 + 3] = 255
  }
  const tex = new DataTexture(px, S, S, RGBAFormat, UnsignedByteType)
  tex.magFilter = tex.minFilter = LinearFilter; tex.wrapS = tex.wrapT = ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true
  const depthOf = (x: number, z: number) => {
    const b = Math.floor((x - x0) * RES), a = Math.floor((z - x0) * RES)
    return a < 0 || b < 0 || a >= S || b >= S ? 2 : depth[a * S + b]
  }
  return { tex, box: [x0, x0, size], depth: depthOf }
}

/** The sea: a fine sheet over the island and its waters (it lifts in the swell), and beyond it, flat to the horizon. */
export function buildSea(opts: { grid: number; margin: number; seaY: number; heightAt: (x: number, z: number) => number; rocks: { x: number; z: number; r: number }[]; falls: { x: number; z: number }[]; time: { value: number } }) {
  const { grid, margin, seaY, time } = opts
  const x0 = -margin, size = grid + 2 * margin
  const fd = field(x0, size, opts.heightAt, seaY, opts.rocks, opts.falls)
  const uniforms = {
    uTime: time, uDepth: { value: fd.tex }, uBox: { value: fd.box }, uSeaY: { value: seaY },
    uShallow: { value: new Color('#5ccfc4') }, uMid: { value: new Color('#178fa6') }, uDeep: { value: new Color('#0c3a55') },
    uFoam: { value: 1 },
    /** How much the swell lifts the sea (0 for someone who asked for less motion: the sea lies flat, still glittering). */
    uLift: { value: 1 },
    uRain: wetness.rain, uChop: wetness.chop,
  }
  const mat = new MeshPhysicalMaterial({ color: '#14688f', roughness: 0.04, metalness: 0, transparent: true, side: FrontSide, clearcoat: 0 })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = `uniform float uTime;
uniform sampler2D uDepth;
uniform vec3 uBox;
uniform float uLift;
varying vec3 vWPos;
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vec2 p = wp.xz;
    float depth = texture2D(uDepth, (p - uBox.xy) / uBox.z).r * 2.0 - 0.2;
    float h = 0.0;
    ${LIFT_GLSL}
    float calmed = smoothstep(0.04, 0.54, depth);
    // (The sheet's own rim stays put, where it meets the flat sea beyond.)
    vec2 rim = min(p - (uBox.xy - 10.0), (uBox.xy + uBox.z + 10.0) - p);
    calmed *= smoothstep(0.0, 4.0, min(rim.x, rim.y));
    transformed.y += h * calmed * uLift;
    vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  }`)
    sh.fragmentShader = `uniform float uTime;
uniform sampler2D uDepth;
uniform vec3 uBox;
uniform float uSeaY;
uniform vec3 uShallow;
uniform vec3 uMid;
uniform vec3 uDeep;
uniform float uFoam;
uniform float uRain;
uniform float uChop;
varying vec3 vWPos;
float wDepth;
float wFoam;
float wCalm;
${NOISE}
${RIPPLES_GLSL}
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    vec4 m = texture2D(uDepth, (p - uBox.xy) / uBox.z);
    wDepth = m.r * 2.0 - 0.2;
    float shore = m.g * 2.0;
    wCalm = smoothstep(0.02, 0.4, wDepth);
    // Clear in the shallows, turquoise as it deepens, then the deep sea's blue.
    vec3 c = mix(uShallow, uMid, smoothstep(0.0, 0.3, wDepth));
    c = mix(c, uDeep, smoothstep(0.25, 0.9, wDepth));
    float a = mix(0.2, 0.94, smoothstep(0.0, 0.5, wDepth));
    // At a glancing angle it is a mirror, whatever lies under it.
    vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float fres = pow(1.0 - clamp(dot(up, normalize(vViewPosition)), 0.0, 1.0), 4.0);
    a = mix(a, 1.0, fres * 0.85);
    // Surf: a lace of foam where it laps the shore, and lines of it running in.
    float n = wNoise(p * 9.0 + vec2(uTime * 0.25, -uTime * 0.18)), n2 = wNoise(p * 23.0 - vec2(uTime * 0.4, uTime * 0.3));
    float lap = 1.0 - smoothstep(0.0, 0.07 + 0.05 * sin(uTime * 1.3 + p.x * 2.0 + p.y * 1.7), shore + (n - 0.5) * 0.05);
    float run = smoothstep(0.55, 1.0, sin(shore * 15.0 - uTime * 1.7 + n * 2.5)) * (1.0 - smoothstep(0.12, 0.6, shore));
    float foam = clamp(lap * smoothstep(0.25, 0.6, n2 + n * 0.5) + run * smoothstep(0.45, 0.75, n2 * 0.7 + n * 0.6), 0.0, 1.0) * uFoam;
    foam *= 1.0 - smoothstep(0.5, 1.6, wDepth);
    wFoam = foam;
    diffuseColor.rgb = mix(c, vec3(0.93, 0.96, 0.98), foam);
    diffuseColor.a = max(a, foam * 0.95);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.75, wFoam);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 p = vWPos.xz, g = vec2(0.0);
    ${TILT_GLSL}
    // Calmer far off (the horizon is a line, not noise) and in the shallows.
    g *= (1.0 - 0.75 * clamp(length(vWPos - cameraPosition) / 60.0, 0.0, 1.0)) * mix(0.35, 1.0, wCalm) * (1.0 - wFoam * 0.7) * uChop;
    // Rain: rings everywhere it lands (near you; further off they are too small to see).
    if (uRain > 0.01) g += rRipples(p * 0.6, uTime, uRain).xy * 0.16 * (1.0 - smoothstep(2.0, 8.0, length(vWPos - cameraPosition)));
    normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x, 1.0, -g.y)), 0.0)).xyz);
  }`)
  }
  mat.customProgramCacheKey = () => 'walk-sea'

  // The fine sheet, a quarter of a tile to a square, ten tiles past the field each way.
  const A = x0 - 10, B = x0 + size + 10, STEP = 0.25, n = Math.round((B - A) / STEP)
  const pos: number[] = [], idx: number[] = []
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) pos.push(A + b * STEP, seaY, A + a * STEP)
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const p = a * (n + 1) + b
    idx.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2)
  }
  const near = new BufferGeometry()
  near.setAttribute('position', new Float32BufferAttribute(pos, 3))
  near.setAttribute('normal', new Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  near.setIndex(idx)
  // The flat sea beyond: a frame round the sheet, out to the horizon.
  const F = 3000, far = new BufferGeometry()
  const ring = [[-F, -F], [F, -F], [F, F], [-F, F]], hole = [[A, A], [B, A], [B, B], [A, B]]
  const fp: number[] = []
  for (let k = 0; k < 4; k++) {
    const o0 = ring[k], o1 = ring[(k + 1) % 4], h0 = hole[k], h1 = hole[(k + 1) % 4]
    for (const [x, z] of [o0, h0, o1, o1, h0, h1]) fp.push(x, seaY, z)
  }
  far.setAttribute('position', new Float32BufferAttribute(fp, 3)); far.computeVertexNormals()
  // (Wound to face up: three's right hand, with x east and z south.)
  if (far.getAttribute('normal').getY(0) < 0) { const p = far.getAttribute('position'); for (let i = 0; i < p.count; i += 3) { const y = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)]; p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, y[0], y[1], y[2]) } far.computeVertexNormals() }
  const sheet = new Mesh(near, mat), beyond = new Mesh(far, mat)
  sheet.receiveShadow = beyond.receiveShadow = true
  // Its surface at a point, now (for the swimmer, and the splashes).
  const surfaceAt = (x: number, z: number) => seaY + waveAt(x, z, time.value, fd.depth(x, z)) * uniforms.uLift.value
  return { meshes: [sheet, beyond], material: mat, uniforms, surfaceAt, depthAt: fd.depth }
}

/** The stream and the pond: running water carried downhill, white where it falls, the pond still. */
export function poolMaterial(time: { value: number }) {
  const m = new MeshPhysicalMaterial({ color: '#2f7f8f', roughness: 0.06, metalness: 0, transparent: true, side: DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = 'attribute vec3 aFlow;\nvarying vec3 vWPos;\nvarying vec3 vFlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vFlow = aFlow;')
    sh.fragmentShader = `uniform float uTime;
varying vec3 vWPos;
varying vec3 vFlow;
float pFoam;
vec2 pSlope;
${NOISE}
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float kind = floor(vFlow.z + 0.5);
    vec2 p = vWPos.xz, dir = vFlow.xy;
    pFoam = 0.0; pSlope = vec2(0.0);
    vec3 c = vec3(0.07, 0.22, 0.24);
    float a = 0.72;
    if (kind > 1.5) {
      // Falling: white streaks tumbling down it, thickest where it breaks at the foot.
      float along = vWPos.x * abs(dir.y) + vWPos.z * abs(dir.x);
      float s = wNoise(vec2(along * 26.0, vWPos.y * 7.0 + uTime * 5.0)) * 0.7 + wNoise(vec2(along * 61.0, vWPos.y * 15.0 + uTime * 9.0)) * 0.3;
      pFoam = smoothstep(0.35, 0.75, s);
      a = 0.86;
    } else {
      // Running: its ripples carried along with it; the pond barely stirs.
      float speed = kind > 0.5 ? 0.45 : 0.03;
      vec2 q = p * 7.0 - dir * uTime * speed * 7.0;
      float e = 0.07;
      float h0 = wNoise(q), hx = wNoise(q + vec2(e, 0.0)), hz = wNoise(q + vec2(0.0, e));
      pSlope = vec2(hx - h0, hz - h0) / e * (kind > 0.5 ? 0.09 : 0.03);
      // Fine streaks of foam drawn out along the current.
      vec2 lc = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
      float fl = wNoise(vec2(lc.x * 9.0 - uTime * 4.0, lc.y * 38.0)) * 0.65 + wNoise(vec2(lc.x * 23.0 - uTime * 6.5, lc.y * 70.0)) * 0.35;
      pFoam = kind > 0.5 ? smoothstep(0.7, 0.84, fl) * 0.55 : 0.0;
    }
    diffuseColor.rgb = mix(c, vec3(0.93, 0.96, 0.98), pFoam);
    diffuseColor.a = max(a, pFoam);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.7, pFoam);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (vFlow.z < 1.5) normal = normalize((viewMatrix * vec4(normalize(vec3(-pSlope.x, 1.0, -pSlope.y)), 0.0)).xyz);`)
  }
  m.customProgramCacheKey = () => 'walk-pool'
  return m
}
