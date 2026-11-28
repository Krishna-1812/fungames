/**
 * The sea's waves (water.ts draws them; the swimmer, the boats and the gulls ride them): plain numbers, so the page,
 * the processor's copy and the checks all use the very same sea.
 *
 * Two kinds of wave, as on any tropical coast:
 *
 *   - the swell: long, regular waves raised by storms far away, a nine- and a seven-second train arriving from the
 *     open ocean, the same whatever the weather here;
 *   - the wind sea: what the local trade wind raises, from a JONSWAP spectrum (the measured shape of a growing sea:
 *     Hasselmann et al. 1973) for a fetch of twenty kilometres, its peak period and height set by the wind's speed,
 *     spread about the wind's direction.
 *
 * Each is a Gerstner (trochoidal) wave: the water moves in circles, so crests sharpen and troughs flatten, at deep
 * water's own speed for its length (ω² = g k). The swell lifts the sea; the wind sea, shorter, mostly tilts it. All of
 * it calms to nothing at the water's edge (the coast you walk down never moves) — the surf there is drawn, not lifted.
 *
 * In the island's units: a metre is METRE (0.11) of a world unit, time in seconds.
 */
import { METRE } from './body'

/** Earth's gravity, in world units a second squared. */
export const G_WORLD = 9.81 * METRE

export type Wave = {
  /** Direction it travels (unit, in x and z), wavenumber (radians a world unit), angular frequency (radians a second). */
  dx: number; dz: number; k: number; w: number
  /** Its amplitude (world units), its Gerstner steepness (0 a sine, 1 a cusp), its phase; whether it is swell. */
  a: number; q: number; phase: number; swell: boolean
}

/** A seeded random, so the sea is the same every visit. */
function rng(seed: number) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/**
 * JONSWAP's spectral density (m² s) at angular frequency ω (rad/s), for a wind of U (m/s) over a fetch F (m):
 * α and the peak from the fetch-limited relations, γ = 3.3.
 */
export function jonswap(omega: number, U: number, F: number) {
  const g = 9.81, chi = (g * F) / (U * U)
  const alpha = 0.076 * Math.pow(chi, -0.22), wp = 22 * Math.pow((g * g) / (U * F), 1 / 3)
  const sigma = omega <= wp ? 0.07 : 0.09
  const r = Math.exp(-((omega - wp) ** 2) / (2 * sigma * sigma * wp * wp))
  return (alpha * g * g) / omega ** 5 * Math.exp(-1.25 * (wp / omega) ** 4) * Math.pow(3.3, r)
}
/** The peak angular frequency of that sea (rad/s). */
export const jonswapPeak = (U: number, F: number) => 22 * Math.pow((9.81 * 9.81) / (U * F), 1 / 3)

/** The design wind the wind sea is built for (m/s: a fresh trade wind), and its fetch. */
export const DESIGN_WIND = 7, FETCH = 20000

/** The waves: two swell trains, then ten of the wind sea from its spectrum (longest first). */
function makeWaves(): Wave[] {
  const r = rng(0x5ea)
  const waves: Wave[] = []
  // (Heading towards the island from the south-east, as an ocean swell would; the trade wind from the east.)
  const swell = (period: number, hM: number, ang: number) => {
    const w = (2 * Math.PI) / period, kM = (w * w) / 9.81
    waves.push({ dx: Math.cos(ang), dz: Math.sin(ang), k: kM / METRE, w, a: (hM / 2) * METRE, q: 0.35, phase: r() * 6.283, swell: true })
  }
  swell(9, 0.55, Math.PI * 1.22)
  swell(7, 0.3, Math.PI * 1.1)
  const wp = jonswapPeak(DESIGN_WIND, FETCH), windAng = Math.PI * 1.02
  // Ten frequencies spread from just under the peak to four times it, each band's energy in one wave.
  const N = 10, lo = Math.log(wp * 0.8), hi = Math.log(wp * 4)
  for (let i = 0; i < N; i++) {
    const w0 = Math.exp(lo + ((hi - lo) * i) / N), w1 = Math.exp(lo + ((hi - lo) * (i + 1)) / N), w = Math.sqrt(w0 * w1)
    const aM = Math.sqrt(2 * jonswap(w, DESIGN_WIND, FETCH) * (w1 - w0))
    // Spread about the wind (cos² spreading: most of it within 45° of the wind).
    const spread = (r() - 0.5) * 1.6 * (0.5 + i / N)
    const kM = (w * w) / 9.81
    waves.push({ dx: Math.cos(windAng + spread), dz: Math.sin(windAng + spread), k: kM / METRE, w, a: aM * METRE, q: 0, phase: r() * 6.283, swell: false })
  }
  // Steepness shared out so the crests sharpen but never loop over themselves (Σ Q k a stays under 0.8 at full wind).
  const wind = waves.filter((v) => !v.swell)
  const sumKA = wind.reduce((s, v) => s + v.k * v.a, 0)
  for (const v of wind) v.q = 0.55 / Math.max(sumKA, 1e-6)
  return waves
}
export const SEA_WAVES = makeWaves()

/** The sea's state now: how much of the wind sea there is (1 at the design wind; it goes as the wind's square), and of the swell. */
export const seaState = { wind: 1, swell: 1 }
/**
 * The wind sea's scale for the weather's wind (0 to 1): its energy grows with the wind, from a third of the design sea
 * in a light air to 1.65 times it in a strong breeze — held there, as the Gerstner crests would otherwise fold.
 */
export const windSea = (wind: number) => 0.35 + 1.3 * Math.max(0, Math.min(1, wind)) ** 2

/** How much the sea moves at a depth (world units): none at the water's edge, all of it in a few metres of water. */
export const calm = (depth: number) => { const t = Math.max(0, Math.min(1, (depth - 0.04) / 0.5)); return t * t * (3 - 2 * t) }

const amp = (v: Wave, s = seaState) => v.a * (v.swell ? s.swell : s.wind)

/** The surface displaced from a rest point (x, z) at a time: [dx, dy, dz] (before calming). */
export function gerstner(x: number, z: number, t: number, s = seaState): [number, number, number] {
  let ox = 0, oy = 0, oz = 0
  for (const v of SEA_WAVES) {
    const a = amp(v, s), th = v.k * (v.dx * x + v.dz * z) - v.w * t + v.phase, c = Math.cos(th)
    ox += v.q * a * v.dx * c; oz += v.q * a * v.dz * c; oy += a * Math.sin(th)
  }
  return [ox, oy, oz]
}

/**
 * The sea's height above its rest level at a point (x, z) of the world, at a time, over water of a depth: the
 * Gerstner surface found at that point (the rest point whose displaced position lands there, by a few fixed-point
 * steps), calmed by depth — the same surface the sea is drawn with.
 */
export function waveAt(x: number, z: number, t: number, depth: number, s = seaState) {
  const c = calm(depth)
  if (c <= 0) return 0
  let px = x, pz = z
  for (let n = 0; n < 4; n++) { const [ox, , oz] = gerstner(px, pz, t, s); px = x - ox * c; pz = z - oz * c }
  return gerstner(px, pz, t, s)[1] * c
}

/** The significant wave height of the sea now (world units): four times the root of the summed energies. */
export const significantHeight = (s = seaState) => 4 * Math.sqrt(SEA_WAVES.reduce((e, v) => e + amp(v, s) ** 2 / 2, 0))

const f = (v: number) => v.toFixed(6)
/** The same waves for the shaders: one vec4 (dir x, dir z, k, ω) and one vec4 (amplitude, steepness, phase, swell) each. */
export const SEA_GLSL = /* glsl */ `
#define SEA_N ${SEA_WAVES.length}
const vec4 SEA_KW[SEA_N] = vec4[](${SEA_WAVES.map((v) => `vec4(${f(v.dx)}, ${f(v.dz)}, ${f(v.k)}, ${f(v.w)})`).join(', ')});
const vec4 SEA_AQ[SEA_N] = vec4[](${SEA_WAVES.map((v) => `vec4(${f(v.a)}, ${f(v.q)}, ${f(v.phase)}, ${v.swell ? '1.0' : '0.0'})`).join(', ')});
uniform vec2 uSeaState;
// The displaced surface (x, y, z offsets) at a rest point; with its slope (for the normal) and how sharp its crest is.
vec3 seaGerstner(vec2 p, float t, float fadeK, out vec3 dN, out float crest) {
  vec3 o = vec3(0.0); dN = vec3(0.0); crest = 0.0;
  for (int i = 0; i < SEA_N; i++) {
    vec4 kw = SEA_KW[i], aq = SEA_AQ[i];
    float a = aq.x * (aq.w > 0.5 ? uSeaState.y : uSeaState.x);
    // (Waves too short to be seen at this distance faded out, so the far sea does not sparkle with noise.)
    a *= 1.0 - smoothstep(0.35, 1.0, kw.z * fadeK);
    float th = kw.z * dot(kw.xy, p) - kw.w * t + aq.z, s = sin(th), c = cos(th);
    o += vec3(aq.y * a * kw.x * c, a * s, aq.y * a * kw.y * c);
    float ka = kw.z * a;
    dN += vec3(kw.x * ka * c, aq.y * ka * s, kw.y * ka * c);
    crest += aq.y * ka * s;
  }
  return o;
}
`
