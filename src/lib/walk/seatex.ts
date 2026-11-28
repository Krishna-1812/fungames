/**
 * The sea's fine detail, made once on the device (water.ts, terrain.ts):
 *
 *   - two cascades of small waves (six metres and a metre and a half a repeat): a random sea of a wind spectrum
 *     (Phillips'), its heights and slopes by inverse FFT (Tessendorf's method, frozen in time — the cascades drift
 *     across the sea instead), so they tile without a seam;
 *   - the caustics each casts: light refracted through those slopes and gathered where it focuses a little below
 *     the surface — traced, not drawn — so the bright net on the sea floor is the one the waves above would make;
 *   - foam: a lace of bubbles and threads that dissolves from its thin parts first as the foam thins.
 *
 * Plain arrays (bake*) for the checks; DataTextures (seaTextures) for the page.
 */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three'

/** A seeded random, and a pair of Gaussians from it. */
function rng(seed: number) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const gauss = (r: () => number) => { const u = Math.max(1e-9, r()), v = r(); const m = Math.sqrt(-2 * Math.log(u)); return [m * Math.cos(6.2832 * v), m * Math.sin(6.2832 * v)] }

/** An in-place radix-2 FFT over n complex numbers (re, im), forward or inverse (unscaled). */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr
      }
    }
  }
}
/** A 2D inverse FFT of an N×N spectrum (row-major), in place. */
function ifft2(re: Float64Array, im: Float64Array, N: number) {
  const r = new Float64Array(N), i = new Float64Array(N)
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) { r[x] = re[y * N + x]; i[x] = im[y * N + x] } fft(r, i, true); for (let x = 0; x < N; x++) { re[y * N + x] = r[x]; im[y * N + x] = i[x] } }
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; i[y] = im[y * N + x] } fft(r, i, true); for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = i[y] } }
}

export type Cascade = { N: number; height: Float32Array; sx: Float32Array; sz: Float32Array }

/**
 * One cascade: a Phillips spectrum for a wind (direction wx, wz; L = V²/g, the largest wave it raises, in the
 * cascade's own units of one repeat), its shortest waves damped, by inverse FFT into heights and slopes (slope per
 * unit of the repeat, scaled so the steepest few in a hundred are about 0.35).
 */
export function bakeCascade(N: number, seed: number, wx: number, wz: number, L: number, small: number): Cascade {
  const r = rng(seed)
  const hr = new Float64Array(N * N), hi = new Float64Array(N * N), xr = new Float64Array(N * N), xi = new Float64Array(N * N), zr = new Float64Array(N * N), zi = new Float64Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = x < N / 2 ? x : x - N, m = y < N / 2 ? y : y - N
    const kx = 2 * Math.PI * n, kz = 2 * Math.PI * m, k = Math.hypot(kx, kz)
    if (k < 1e-6) continue
    const kd = (kx * wx + kz * wz) / k
    // Phillips: waves along the wind, none much longer than L, the shortest damped; waves against the wind weaker.
    let P = (Math.exp(-1 / (k * L) ** 2) / k ** 4) * kd * kd * Math.exp(-((k * small) ** 2))
    if (kd < 0) P *= 0.15
    const [g1, g2] = gauss(r), a = Math.sqrt(P / 2)
    const i = y * N + x
    hr[i] = g1 * a; hi[i] = g2 * a
    // Slopes: i k H.
    xr[i] = -kx * hi[i]; xi[i] = kx * hr[i]; zr[i] = -kz * hi[i]; zi[i] = kz * hr[i]
  }
  ifft2(hr, hi, N); ifft2(xr, xi, N); ifft2(zr, zi, N)
  const height = new Float32Array(N * N), sx = new Float32Array(N * N), sz = new Float32Array(N * N)
  // (Normalised: heights to −1..1 at their extremes, slopes so the steep tail sits at about 0.35.)
  let hmax = 0; const mags: number[] = []
  for (let i = 0; i < N * N; i++) { hmax = Math.max(hmax, Math.abs(hr[i])); mags.push(Math.hypot(xr[i], zr[i])) }
  mags.sort((a, b) => a - b)
  const s97 = mags[Math.floor(mags.length * 0.97)] || 1
  for (let i = 0; i < N * N; i++) { height[i] = hr[i] / hmax; sx[i] = (xr[i] / s97) * 0.35; sz[i] = (zr[i] / s97) * 0.35 }
  return { N, height, sx, sz }
}

/**
 * The caustics a cascade casts: each texel's light bent by its slope (water's index, 1.33) and carried a depth below
 * the surface (in texels), gathered where it lands, wrapped round the repeat; normalised so the floor's mean light is
 * unchanged (the waves only move it about). M×M from the cascade's N×N.
 */
export function bakeCaustics(c: Cascade, M: number, depth: number) {
  const acc = new Float64Array(M * M), N = c.N, sc = M / N, k = depth * (1 - 1 / 1.33)
  // (Each of four looks a texel, spread over the four texels round where it lands.)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    const i = y * N + x
    const fx = ((x + ox) * sc - c.sx[i] * k * sc), fy = ((y + oy) * sc - c.sz[i] * k * sc)
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    for (const [dx, dy, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) {
      const X = (((x0 + dx) % M) + M) % M, Y = (((y0 + dy) % M) + M) % M
      acc[Y * M + X] += w
    }
  }
  let mean = 0; for (const v of acc) mean += v / (M * M)
  const out = new Float32Array(M * M)
  for (let i = 0; i < M * M; i++) out[i] = acc[i] / mean
  // A light blur, twice (the sun is half a degree wide, not a point; and it smooths the gathering's own grain).
  let src = out
  for (let pass = 0; pass < 2; pass++) {
    const blur = new Float32Array(M * M)
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      let s = 0
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += src[(((y + b) % M + M) % M) * M + (((x + a) % M) + M) % M] * (a === 0 && b === 0 ? 4 : a === 0 || b === 0 ? 2 : 1)
      blur[y * M + x] = s / 16
    }
    src = blur
  }
  return src
}

/** Foam: a lace of bubbles (cells) and the threads between them, with a dissolve order (which parts go first as it thins). */
export function bakeFoam(M: number, seed: number) {
  const r = rng(seed), cells = 14, pts: [number, number][] = []
  for (let i = 0; i < cells * cells; i++) pts.push([((i % cells) + r()) / cells, (Math.floor(i / cells) + r()) / cells])
  const lace = new Float32Array(M * M), order = new Float32Array(M * M)
  const near = (u: number, v: number, sc: number) => {
    let d1 = 9, d2 = 9
    const cu = Math.floor(u * sc), cv = Math.floor(v * sc)
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const gx = (((cu + a) % sc) + sc) % sc, gy = (((cv + b) % sc) + sc) % sc
      const p = pts[(gy % cells) * cells + (gx % cells)]
      const px = (cu + a + (p[0] * cells - Math.floor(p[0] * cells))) / sc, py = (cv + b + (p[1] * cells - Math.floor(p[1] * cells))) / sc
      const d = Math.hypot(u - px, v - py)
      if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
    }
    return [d1, d2]
  }
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const u = (x + 0.5) / M, v = (y + 0.5) / M
    const [a1, a2] = near(u, v, cells), [b1, b2] = near((u * 3) % 1, (v * 3) % 1, cells)
    // Threads between the big bubbles, and the small bubbles' rims.
    const thread = Math.max(0, 1 - (a2 - a1) * cells * 3.2), rim = Math.max(0, 1 - Math.abs(b1 * cells - 0.2 - 0.25 * ((b2 - b1) * cells)) * 6)
    lace[y * M + x] = Math.min(1, thread * 0.9 + rim * 0.3)
    order[y * M + x] = Math.min(1, (a2 - a1) * cells * 1.4 + (r() - 0.5) * 0.05)
  }
  return { lace, order }
}

/** The textures: detail (both cascades' slopes, and the big one's height), caustics (one cascade each), foam. */
export function seaTextures() {
  const N = 128
  const A = bakeCascade(N, 0xa11, 0.94, 0.34, 0.9, 0.006), B = bakeCascade(N, 0xb22, 0.62, -0.78, 0.6, 0.012)
  const enc = (v: number) => Math.round(Math.max(0, Math.min(1, v * 0.5 + 0.5)) * 255)
  const det = new Uint8Array(N * N * 4)
  for (let i = 0; i < N * N; i++) { det[i * 4] = enc(A.sx[i]); det[i * 4 + 1] = enc(A.sz[i]); det[i * 4 + 2] = enc(B.sx[i]); det[i * 4 + 3] = enc(B.sz[i]) }
  const M = 256
  // (Focused about half a cascade's repeat down: the bright net at its sharpest a metre or two under the swell.)
  const cA = bakeCaustics(A, M, N * 0.5), cB = bakeCaustics(B, M, N * 0.7)
  const cau = new Uint8Array(M * M * 4)
  for (let i = 0; i < M * M; i++) { cau[i * 4] = Math.round(Math.min(1, cA[i] / 4) * 255); cau[i * 4 + 1] = Math.round(Math.min(1, cB[i] / 4) * 255); cau[i * 4 + 3] = 255 }
  const F = bakeFoam(256, 0xf0a)
  const foam = new Uint8Array(256 * 256 * 4)
  for (let i = 0; i < 256 * 256; i++) { foam[i * 4] = Math.round(F.lace[i] * 255); foam[i * 4 + 1] = Math.round(Math.max(0, F.order[i]) * 255); foam[i * 4 + 3] = 255 }
  const tex = (d: Uint8Array, s: number) => {
    const t = new DataTexture(d, s, s, RGBAFormat, UnsignedByteType)
    t.wrapS = t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true
    return t
  }
  return { detail: tex(det, N), caustics: tex(cau, M), foam: tex(foam, 256), cascades: [A, B] }
}
