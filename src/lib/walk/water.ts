/**
 * The walk's water (build3d.ts): the sea round the island, and the stream and pond on it — water as an optical
 * material, moved by a real sea.
 *
 * The sea's surface is the waves of sea.ts (a long ocean swell and the trade wind's own sea, Gerstner waves at their
 * real speeds), with the small waves of two drifting cascades (seatex.ts) over them for the light, the ripples round
 * you (wake.ts), each moving boat's Kelvin wake and the rain's rings. It is drawn after everything solid (lens.ts), so
 * it can see what lies under it:
 *
 *   - refraction: the sea floor, a rock, a swimmer's legs, seen through the surface and bent by it;
 *   - absorption: the light that comes back up loses red first, then green, by the length of its path through the
 *     water (Beer–Lambert, clear tropical water's own coefficients) — so the shallows over sand are clear, then
 *     turquoise, and deep water is the blue its own scattering gives, with nothing seen through it;
 *   - reflection: the sky, and (on High) what stands round it — the island, a pier, a boat — found in the picture by
 *     marching the reflected ray through its depth; how much by Fresnel, water's index 1.33: a window looking down,
 *     a mirror at a glancing angle;
 *   - the sun through a wave: crests standing against a low sun glow green-blue as its light scatters through them;
 *   - foam: lapping every shore, breaking along the beaches as each wave shoals and runs up the sand (the swash, its
 *     thin sheet climbing and draining back), streaked off the steepest crests in a wind, laid from a lace that thins
 *     from its finest threads first;
 *   - from below (swimming under, or a photograph): Snell's window — the sky through a circle overhead, the surface
 *     a mirror of the deep outside it.
 *
 * The sea sheet is a disc round the camera, fine near it and coarse towards the horizon (40,000 triangles, where the
 * old fixed sheet was 139,000), moved with the camera by whole steps so it never swims. The stream and the pond run
 * along their flow (two drifting phases of the same small waves), see through to their beds and tumble white down
 * their falls.
 */
import {
  BufferGeometry, ClampToEdgeWrapping, DataTexture, DoubleSide, Float32BufferAttribute, LinearFilter, Matrix4, Mesh, MeshPhysicalMaterial, RGBAFormat,
  type Texture, UnsignedByteType, Vector2, Vector3, Vector4,
} from 'three'
import { wetness, RIPPLES_GLSL } from './wet'
import { SEA_GLSL, SEA_WAVES, calm, seaState, waveAt as seaWaveAt, G_WORLD, windSea } from './sea'
import { seaTextures } from './seatex'
import { METRE } from './body'

/** The layers the water (and what floats over it) is drawn on, after everything solid (lens.ts). */
export const WATER_LAYER = 3, OVER_WATER_LAYER = 4
export const WATER_MASK = (1 << WATER_LAYER) | (1 << OVER_WATER_LAYER)

/** The wind's direction over the sea (for the boats' sails), and the sea's surface for the checks. */
export const WAVES = [(() => { const w = SEA_WAVES.find((v) => !v.swell)!; return { x: w.dx, z: w.dz } })()]
export { calm }
/** The sea's height above its rest level at a point, at a time, over water of a depth (sea.ts: the drawn surface). */
export const waveAt = (x: number, z: number, t: number, depth: number) => seaWaveAt(x, z, t, depth)

/**
 * Clear tropical water's absorption and scattering (per metre: red, green, blue — pure water's absorption, a little
 * fine sand and plankton scattering), and per world unit as the shaders use them.
 */
export const WATER_ABSORB = [0.45, 0.065, 0.021], WATER_SCATTER = [0.03, 0.045, 0.06]
const perUnit = (v: number[]) => new Vector3(...v.map((x) => x / METRE))
/**
 * What deep water sends back up of the light in it (a fraction, per colour): only what it scatters backwards (a few
 * hundredths of all it scatters) against what it absorbs, about a third of that leaving the surface — so the open
 * sea is the dark blue it really is (two or three percent in blue, nearly nothing in red), not a pale glow.
 */
export const backscatter = (absorb: number[], scatter: number[], back: number) => new Vector3(...absorb.map((a, k) => (0.33 * back * scatter[k]) / (a + back * scatter[k])))
/** The light a swimmer sees all round them, scattered from every side (a fraction of the light in the water). */
export const sideScatter = (absorb: number[], scatter: number[]) => new Vector3(...absorb.map((a, k) => (0.35 * scatter[k]) / (a + scatter[k])))

const NOISE = /* glsl */ `
float wHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

/**
 * What the water sees of the rest of the picture (lens.ts fills it in between drawing the solid world and the water):
 * its colour and depth, the camera's projection both ways, its near and far, the picture's size; whether it can
 * refract at all (not without a depth), and how many steps the reflections march (0: the sky only).
 */
export const waterView = {
  tScene: { value: null as Texture | null }, tSceneDepth: { value: null as Texture | null },
  uProj: { value: new Matrix4() }, uInvProj: { value: new Matrix4() }, uNF: { value: new Vector2(0.012, 500) }, uRes: { value: new Vector2(1, 1) },
  uRefract: { value: 0 }, uSSR: { value: 0 },
  /** (For looking into it: 1 the path through the water, 2 the sea's depth, 3 the depth behind; 0 the picture.) */
  uDbg: { value: 0 },
}

/** Optics the sea and the pool share: the scene behind, its depth, the path through the water, Fresnel. */
const OPTICS = /* glsl */ `
uniform sampler2D tScene, tSceneDepth;
uniform mat4 uProj, uInvProj;
uniform vec2 uNF, uRes;
uniform float uRefract, uSSR, uDbg;
uniform vec3 uAbsorb, uScatter, uWaterLight, uInK, uSideK;
float oViewZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNF.x * uNF.y / (uNF.y + uNF.x - z * (uNF.y - uNF.x)); }
// The light that comes back up through the water to the eye: what lies behind (bent by the normal), dimmed by its
// path through the water per colour, plus what the water itself scatters towards the eye.
vec3 oThrough(vec3 viewPos, vec3 nView, float maxPath, out float path) {
  vec3 sigma = uAbsorb + uScatter;
  vec3 inscatter = uWaterLight * uInK;
  path = maxPath;
  if (uRefract < 0.5) return inscatter * (1.0 - exp(-sigma * maxPath));
  vec2 uv = gl_FragCoord.xy / uRes;
  float zs = -viewPos.z, ray = length(viewPos) / max(zs, 1e-4);
  float d0 = texture2D(tSceneDepth, uv).x;
  float pre = d0 >= 1.0 ? 1.0 : clamp((oViewZ(d0) - zs) * ray * 6.0, 0.0, 1.0);
  vec2 ruv = uv + nView.xy * 0.06 * pre / max(1.0, zs * 0.4);
  float d = texture2D(tSceneDepth, ruv).x;
  // (Bent onto something in front of the water: not bent at all.)
  if (d < 1.0 && oViewZ(d) < zs) { ruv = uv; d = d0; }
  path = d >= 1.0 ? maxPath : min(maxPath, max(0.0, oViewZ(d) - zs) * ray);
  vec3 T = exp(-sigma * path);
  vec3 behind = texture2D(tScene, ruv).rgb;
  return behind * T + inscatter * (1.0 - T);
}
float oFresnel(float cosI) { float c = 1.0 - clamp(cosI, 0.0, 1.0); return 0.02 + 0.98 * c * c * c * c * c; }
// Reflections from the picture itself: the reflected ray marched through its depth (view space), refined at a hit.
vec4 oSSR(vec3 viewPos, vec3 R) {
  if (uSSR < 0.5 || uRefract < 0.5) return vec4(0.0);
  int steps = int(uSSR);
  float stepL = 0.02 + 0.015 * -viewPos.z;
  vec3 p = viewPos, prev = p;
  for (int i = 0; i < steps; i++) {
    prev = p; p += R * stepL; stepL *= 1.15;
    vec4 c = uProj * vec4(p, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (c.w <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float d = texture2D(tSceneDepth, uv).x;
    if (d >= 1.0) continue;
    float zs = oViewZ(d), gap = -p.z - zs;
    if (gap > 0.0 && gap < stepL * 3.0 + 0.02) {
      // (A few halvings back towards where it entered.)
      vec3 a = prev, b = p;
      for (int k = 0; k < 4; k++) { vec3 m = (a + b) * 0.5; vec4 mc = uProj * vec4(m, 1.0); float md = texture2D(tSceneDepth, mc.xy / mc.w * 0.5 + 0.5).x; if (-m.z > oViewZ(md)) b = m; else a = m; }
      vec4 bc = uProj * vec4(b, 1.0); vec2 buv = bc.xy / bc.w * 0.5 + 0.5;
      vec2 e = min(buv, 1.0 - buv);
      float fade = smoothstep(0.0, 0.08, min(e.x, e.y)) * (1.0 - float(i) / float(steps));
      return vec4(texture2D(tScene, buv).rgb, fade);
    }
  }
  return vec4(0.0);
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


/** The disc of sea round the camera: rings from a hand's breadth out to the horizon, each a little wider than the last. */
function seaDisc(rings: number, around: number, r0: number, r1: number) {
  const pos: number[] = [0, 0, 0], idx: number[] = []
  const grow = Math.log(r1 / r0) / (rings - 1)
  for (let i = 0; i < rings; i++) {
    const r = r0 * Math.exp(grow * i)
    for (let a = 0; a < around; a++) { const t = (a / around) * Math.PI * 2; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r) }
  }
  for (let a = 0; a < around; a++) idx.push(0, 1 + ((a + 1) % around), 1 + a)
  for (let i = 0; i < rings - 1; i++) for (let a = 0; a < around; a++) {
    const p = 1 + i * around + a, q = 1 + i * around + ((a + 1) % around), p2 = p + around, q2 = q + around
    idx.push(p, q, p2, q, q2, p2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  g.setIndex(idx)
  return g
}

/** The sea: a disc that follows the camera, its waves, its optics. */
export function buildSea(opts: { grid: number; margin: number; seaY: number; heightAt: (x: number, z: number) => number; rocks: { x: number; z: number; r: number }[]; falls: { x: number; z: number }[]; time: { value: number } }) {
  const { grid, margin, seaY, time } = opts
  const x0 = -margin, size = grid + 2 * margin
  const fd = field(x0, size, opts.heightAt, seaY, opts.rocks, opts.falls)
  const tex = seaTextures()
  const uniforms = {
    uTime: time, uDepth: { value: fd.tex }, uBox: { value: fd.box }, uSeaY: { value: seaY },
    /** How much the sea moves (0 for someone who asked for less motion: it lies flat, still glittering). */
    uLift: { value: 1 },
    uSeaState: { value: new Vector2(1, 1) },
    tDetail: { value: tex.detail as Texture }, tFoamTex: { value: tex.foam as Texture },
    /** The two cascades' repeats (one over their size, world units) and where their drift has carried them. */
    uDet: { value: new Vector2(1 / (6 * METRE), 1 / (1.6 * METRE)) }, uDrift: { value: new Vector4() },
    uAbsorb: { value: perUnit(WATER_ABSORB) }, uScatter: { value: perUnit(WATER_SCATTER) },
    uInK: { value: backscatter(WATER_ABSORB, WATER_SCATTER, 0.05) }, uSideK: { value: sideScatter(WATER_ABSORB, WATER_SCATTER) },
    /** The light in the water (what a white card under the surface would show), and the sun's direction and light. */
    uWaterLight: { value: new Vector3(1, 1, 1) }, uSunDir: { value: new Vector3(0, 1, 0) }, uSunCol: { value: new Vector3(1, 1, 1) },
    /** The sky straight up, for looking up from under the water. */
    uSkyUp: { value: new Vector3(1, 1, 1) },
    /** The ripples round you (wake.ts): their buffer and where it is. */
    tWake: { value: null as Texture | null }, uWake: { value: new Vector4() },
    /** Up to six boats under way: x, z, heading, speed (world units a second). */
    uBoats: { value: Array.from({ length: 6 }, () => new Vector4()) }, uBoatN: { value: 0 },
    uRain: wetness.rain, uChop: wetness.chop,
    ...waterView,
  }
  const mat = new MeshPhysicalMaterial({ color: '#000000', roughness: 0.03, metalness: 0, ior: 1.333, side: DoubleSide })
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = `uniform float uTime, uLift;
uniform sampler2D uDepth;
uniform vec3 uBox;
varying vec3 vWPos;
varying vec2 vRest;
varying float vCalm;
varying float vSurf;
${SEA_GLSL}
` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vec2 p = wp.xz;
    vec4 m = texture2D(uDepth, (p - uBox.xy) / uBox.z);
    float depth = m.r * 2.0 - 0.2, shore = m.g * 2.0;
    float c = smoothstep(0.04, 0.54, depth) * uLift;
    vec3 dN; float crest;
    vec3 o = seaGerstner(p, uTime, 0.0, dN, crest) * c;
    // Surf: each wave shoaling towards a beach stands up as it runs in, and breaks; then the swash runs up the sand
    // and drains back (the sheet lifts there, over the sand under it).
    float ph = shore * 3.6 + uTime * 0.9;
    float zone = smoothstep(0.02, 0.08, shore) * (1.0 - smoothstep(0.18, 0.32, shore));
    float roll = pow(0.5 + 0.5 * cos(ph), 8.0) * zone;
    float r = fract(uTime * 0.9 / 6.2832);
    float swash = (r < 0.25 ? smoothstep(0.0, 0.25, r) : 1.0 - smoothstep(0.25, 1.0, r)) * (1.0 - smoothstep(0.0, 0.12, shore));
    o.y += (roll * 0.004 + swash * 0.012) * uLift;
    transformed += o;
    vWPos = wp + o;
    vRest = p;
    vCalm = c;
    vSurf = swash * uLift;
  }`)
    sh.fragmentShader = `uniform float uTime, uSeaY, uLift, uRain, uChop, uBoatN;
uniform sampler2D uDepth, tDetail, tFoamTex, tWake;
uniform vec3 uBox, uSunDir, uSunCol, uSkyUp;
uniform vec2 uDet;
uniform vec4 uDrift, uWake;
uniform vec4 uBoats[6];
varying vec3 vWPos;
varying vec2 vRest;
varying float vCalm;
varying float vSurf;
vec3 sN;
float sFoam, sCrest, sDepth;
${SEA_GLSL}
${NOISE}
${RIPPLES_GLSL}
${OPTICS}
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec2 p = vWPos.xz;
    vec4 m = texture2D(uDepth, (p - uBox.xy) / uBox.z);
    sDepth = m.r * 2.0 - 0.2;
    float shore = m.g * 2.0;
    float dist = length(vWPos - cameraPosition);
    // The big waves' slope, from their own sum (the shortest faded where a pixel is wider than they are).
    vec3 dN; float crest;
    seaGerstner(vRest, uTime, dist * 0.004, dN, crest);
    dN *= vCalm; crest *= vCalm;
    sCrest = crest;
    vec3 n = vec3(-dN.x, 1.0 - dN.y, -dN.z);
    // The small waves: two cascades drifting their own ways, calmer in the shallows, fading with distance.
    vec4 a = texture2D(tDetail, p * uDet.x + uDrift.xy), b = texture2D(tDetail, p * uDet.y + uDrift.zw);
    vec2 sa = a.rg * 2.0 - 1.0, sb = b.ba * 2.0 - 1.0;
    float near = 1.0 - smoothstep(10.0, 120.0, dist);
    float chop = (0.45 + 0.55 * uSeaState.x) * uChop * mix(0.35, 1.0, smoothstep(0.0, 0.3, sDepth));
    n.xz -= (sa * 0.55 + sb * 0.35 * near) * chop;
    // The ripples round you.
    vec2 wq = (p - uWake.xy) * uWake.z + 0.5;
    if (uWake.w > 0.0 && wq.x > 0.0 && wq.x < 1.0 && wq.y > 0.0 && wq.y < 1.0) {
      float e = 1.0 / 256.0;
      float h0 = texture2D(tWake, wq).r, hx = texture2D(tWake, wq + vec2(e, 0.0)).r, hz = texture2D(tWake, wq + vec2(0.0, e)).r;
      n.xz -= vec2(hx - h0, hz - h0) * 70.0;
    }
    // Each boat under way: its Kelvin wake — the transverse waves across its track and the diverging ones along the
    // 19.5° wedge behind it — and the churned water down the middle.
    float churn = 0.0;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uBoatN) break;
      vec4 bt = uBoats[i];
      vec2 fw = vec2(sin(bt.z), cos(bt.z)), sd = vec2(fw.y, -fw.x), rel = p - bt.xy;
      float u = -dot(rel, fw), v = dot(rel, sd), sp = max(bt.w, 0.02);
      if (u <= 0.0 || u > 4.0) continue;
      float K = ${G_WORLD.toFixed(5)} / (sp * sp);
      float wedge = 1.0 - smoothstep(0.3, 0.42, abs(v) / (u + 0.02));
      float amp = wedge * min(1.0, u * 30.0) * exp(-u * 0.9) * min(1.0, sp * 4.0) * 0.25;
      vec2 div = normalize(-fw * 0.57 + sd * sign(v) * 0.82);
      n.xz -= amp * (fw * -cos(K * u) * 0.6 + div * cos(K * 1.6 * (u * 0.57 + abs(v) * 0.82)));
      float wid = 0.02 + u * 0.06;
      churn = max(churn, exp(-(v * v) / (wid * wid)) * exp(-u * 1.2) * min(1.0, sp * 3.0));
    }
    if (uRain > 0.01) n.xz += rRipples(p * 0.6, uTime, uRain).xy * 0.16 * (1.0 - smoothstep(2.0, 8.0, dist));
    sN = normalize(n);
    // Foam: the shore's lap, the breaking surf and the swash's edge, the steepest crests in a wind, a boat's churn —
    // how much, then laid as lace (thinning from its finest threads first).
    float nz = wNoise(p * 9.0 + vec2(uTime * 0.25, -uTime * 0.18));
    // (On the sea's side of the waterline: over the sand the swash runs up, only its edge foams.)
    float lap = (1.0 - smoothstep(0.0, 0.07 + 0.05 * sin(uTime * 1.3 + p.x * 2.0 + p.y * 1.7), shore + (nz - 0.5) * 0.05)) * smoothstep(-0.002, 0.004, sDepth);
    float ph = shore * 3.6 + uTime * 0.9;
    float zone = smoothstep(0.02, 0.08, shore) * (1.0 - smoothstep(0.18, 0.32, shore));
    // (The breaker's own line, and the foam it leaves behind it in patches and streaks, not an even sheet.)
    float patches = smoothstep(0.35, 0.75, wNoise(p * 1.7 + vec2(uTime * 0.05, -uTime * 0.03)) * 0.7 + wNoise(p * 5.3 - uTime * 0.08) * 0.3);
    float breaking = (pow(0.5 + 0.5 * cos(ph), 10.0) + 0.45 * pow(0.5 + 0.5 * cos(ph - 0.7), 6.0) * patches) * zone;
    // (The swash's own edge: the last few centimetres of the sheet running up the sand, while it runs.)
    float thin = sDepth + vSurf * 0.012;
    float sheet = (1.0 - smoothstep(0.0, 0.0035, thin)) * smoothstep(-0.0008, 0.0004, thin) * smoothstep(0.05, 0.3, vSurf);
    float whitecap = smoothstep(0.45, 0.75, crest) * smoothstep(0.6, 1.2, uSeaState.x);
    float amount = clamp(lap * 0.7 + breaking * 0.7 + sheet * 0.6 + whitecap + churn * 1.5, 0.0, 1.0) * (1.0 - smoothstep(0.6, 1.6, sDepth) * (1.0 - whitecap));
    vec4 ft = mix(texture2D(tFoamTex, p * 7.0 + vec2(uTime * 0.02, -uTime * 0.015) + sN.xz * 0.05), texture2D(tFoamTex, p * 3.1 - vec2(uTime * 0.013, uTime * 0.01) + 0.37), 0.35);
    // (No foam, no lace: the threads only show once there is foam to thin.)
    // (A thread shows once the foam is thicker than its place in the order; a whisper of foam shows nothing.)
    sFoam = clamp(ft.r * smoothstep(0.15 + ft.g * 0.8, 0.35 + ft.g * 0.8, amount) + amount * amount * 0.45, 0.0, 1.0);
    // (From below, foam is a shadow on the surface, not a lace to be lit.)
    if (!gl_FrontFacing) sFoam *= 0.3;
    // Foam is white and rough; the water itself has no colour of its own to light (its colour is what it lets through).
    diffuseColor.rgb = vec3(0.8) * sFoam;
    diffuseColor.a = 1.0;
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(0.025 + 0.1 * smoothstep(8.0, 120.0, length(vWPos - cameraPosition)), 0.7, sFoam);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize((viewMatrix * vec4(gl_FrontFacing ? sN : -sN, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
  {
    vec3 V = normalize(vViewPosition);
    float cosI = dot(normal, V);
    float clear = 1.0 - sFoam;
    if (gl_FrontFacing) {
      // From above: what comes up through it, by (1 − Fresnel); the picture's reflection over the sky's.
      float F = oFresnel(cosI), path;
      vec3 up = oThrough(-vViewPosition, normal, sDepth > 1.5 ? 80.0 : 40.0, path);
      totalEmissiveRadiance += up * (1.0 - F) * clear;
      if (uDbg > 0.5) { float dv = uDbg < 1.5 ? path * 4.0 : uDbg < 2.5 ? sDepth * 4.0 : oViewZ(texture2D(tSceneDepth, gl_FragCoord.xy / uRes).x) * 0.1; totalEmissiveRadiance = vec3(dv, fract(dv * 10.0) * 0.3, -dv) * 4.0; reflectedLight.directSpecular *= 0.0; reflectedLight.indirectSpecular *= 0.0; }
      vec4 r = oSSR(-vViewPosition, reflect(-V, normal));
      reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, r.rgb * F, r.a) * clear;
      // The sun through a crest standing against it.
      vec3 Vw = normalize(cameraPosition - vWPos);
      float back = pow(clamp(dot(-Vw, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 6.0) * clamp(sCrest * 2.0 + 0.1, 0.0, 1.0);
      totalEmissiveRadiance += uSunCol * uSideK * back * 0.08 * clear;
    } else {
      // From below: Snell's window — the sky through it where the angle is steep enough, beyond it a mirror of the deep.
      float sinI = sqrt(max(0.0, 1.0 - cosI * cosI)), sinT = sinI * 1.333;
      vec3 deep = uWaterLight * uSideK;
      vec3 seen = sinT >= 1.0 ? deep : mix(uSkyUp, deep, oFresnel(sqrt(max(0.0, 1.0 - sinT * sinT))));
      totalEmissiveRadiance += seen * clear;
      reflectedLight.indirectSpecular *= 0.0;
    }
  }`)
  }
  mat.customProgramCacheKey = () => 'walk-sea-2'

  const disc = seaDisc(110, 176, 0.04, 470)
  const sheet = new Mesh(disc, mat)
  sheet.frustumCulled = false
  sheet.receiveShadow = true
  sheet.layers.set(WATER_LAYER)
  // (Moved with the camera, by whole steps of its own finest ring's size, so the mesh never swims under the waves.)
  sheet.onBeforeRender = (_r, _s, cam) => { const s = 0.04; sheet.position.set(Math.round(cam.position.x / s) * s, seaY, Math.round(cam.position.z / s) * s); sheet.updateMatrixWorld() }
  // Its surface at a point, now (for the swimmer, the boats, the splashes): the same waves, the same calming.
  const surfaceAt = (x: number, z: number) => seaY + (uniforms.uLift.value > 0 ? waveAt(x, z, time.value, fd.depth(x, z)) * uniforms.uLift.value : 0)
  let drift = 0
  /** Each frame: the wind's sea, the cascades' drift. */
  const update = (dt: number, wind: number) => {
    seaState.wind = windSea(wind); seaState.swell = 1
    uniforms.uSeaState.value.set(seaState.wind, seaState.swell)
    drift += dt
    // (Each cascade carried along by the wind at about its own waves' speed.)
    uniforms.uDrift.value.set(drift * 0.031, drift * 0.012, -drift * 0.052, drift * 0.07)
  }
  return { meshes: [sheet], material: mat, uniforms, surfaceAt, depthAt: fd.depth, caustics: tex.caustics, update }
}

/**
 * The stream and the pond: water that runs along its flow — the small waves carried downstream in two phases, each
 * fading out as it stretches and in again fresh (so the current never smears them) — seen through to its pebbles,
 * a little peaty; white where it tumbles down its falls; the pond barely stirring.
 */
export function poolMaterial(time: { value: number }, sea: { tDetail: { value: Texture }; uWaterLight: { value: Vector3 } }) {
  const m = new MeshPhysicalMaterial({ color: '#000000', roughness: 0.04, metalness: 0, ior: 1.333, side: DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    // (A stream's water: a little peaty — more absorption in blue than the sea's — and more silt to scatter.)
    const pa = [0.7, 0.16, 0.14], ps = [0.06, 0.07, 0.07]
    Object.assign(sh.uniforms, waterView, { tDetail: sea.tDetail, uWaterLight: sea.uWaterLight, uAbsorb: { value: perUnit(pa) }, uScatter: { value: perUnit(ps) }, uInK: { value: backscatter(pa, ps, 0.08) }, uSideK: { value: sideScatter(pa, ps) } })
    sh.vertexShader = 'attribute vec3 aFlow;\nvarying vec3 vWPos;\nvarying vec3 vFlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  vFlow = aFlow;')
    sh.fragmentShader = `uniform float uTime;
uniform sampler2D tDetail;
varying vec3 vWPos;
varying vec3 vFlow;
float pFoam;
vec3 pN;
${NOISE}
${OPTICS}
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float kind = floor(vFlow.z + 0.5);
    vec2 p = vWPos.xz, dir = vFlow.xy;
    pFoam = 0.0; pN = vec3(0.0, 1.0, 0.0);
    if (kind > 1.5) {
      // Falling: white streaks tumbling down it, thickest where it breaks at the foot.
      float along = vWPos.x * abs(dir.y) + vWPos.z * abs(dir.x);
      float s = wNoise(vec2(along * 26.0, vWPos.y * 7.0 + uTime * 5.0)) * 0.7 + wNoise(vec2(along * 61.0, vWPos.y * 15.0 + uTime * 9.0)) * 0.3;
      pFoam = smoothstep(0.3, 0.7, s) * 0.9 + 0.1;
    } else {
      // Running: the small waves carried along in two phases half a cycle apart, each faded out as it stretches.
      float speed = kind > 0.5 ? 0.12 : 0.004, cyc = 1.6;
      float t1 = fract(uTime / cyc), t2 = fract(uTime / cyc + 0.5), w1 = 1.0 - abs(t1 * 2.0 - 1.0);
      vec2 q = p * 5.0;
      vec2 s1 = texture2D(tDetail, q - dir * t1 * cyc * speed * 5.0).ba * 2.0 - 1.0;
      vec2 s2 = texture2D(tDetail, q - dir * t2 * cyc * speed * 5.0 + 0.5).ba * 2.0 - 1.0;
      vec2 sl = (s1 * w1 + s2 * (1.0 - w1)) * (kind > 0.5 ? 0.35 : 0.08);
      pN = normalize(vec3(-sl.x, 1.0, -sl.y));
      // Fine streaks of foam drawn out along the current.
      vec2 lc = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
      float fl = wNoise(vec2(lc.x * 9.0 - uTime * 4.0, lc.y * 38.0)) * 0.65 + wNoise(vec2(lc.x * 23.0 - uTime * 6.5, lc.y * 70.0)) * 0.35;
      pFoam = kind > 0.5 ? smoothstep(0.72, 0.86, fl) * 0.5 : 0.0;
    }
    diffuseColor.rgb = vec3(0.8) * pFoam;
    diffuseColor.a = 1.0;
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(0.04, 0.7, pFoam);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize((viewMatrix * vec4(gl_FrontFacing ? pN : -pN, 0.0)).xyz);')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
  {
    vec3 V = normalize(vViewPosition);
    float F = oFresnel(abs(dot(normal, V))), path;
    vec3 up = oThrough(-vViewPosition, normal, 2.0, path);
    totalEmissiveRadiance += up * (1.0 - F) * (1.0 - pFoam);
    reflectedLight.indirectSpecular *= 1.0 - pFoam;
  }`)
  }
  m.customProgramCacheKey = () => 'walk-pool-2'
  return m
}
