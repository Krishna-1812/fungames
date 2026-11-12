/**
 * The tooth of From Memory's paper.
 *
 * Drawing paper is not flat. Under a raking light it is a field of tiny
 * rounded bumps, and that relief is what a pencil actually draws on: graphite
 * is scraped off onto the tops of the bumps first, and only reaches down into
 * the hollows when you press. That is why a light pencil line looks grainy and
 * a hard one looks solid, and it is most of what separates a pencil line from
 * a grey one.
 *
 * So the relief is one thing, shared. The sheet is lit from it (paper.ts), and
 * the pencil deposits against it (memo-ink.ts), at the same pixel, so the grain
 * in a line is the grain of the paper under it.
 *
 * It is a tile that repeats seamlessly, built from periodic noise at three
 * sizes plus a faint grain running one way (paper is laid from pulp drained in
 * one direction, and its fibres show it). The heights are then flattened to a
 * uniform spread, rank by rank, so that a pencil pressing to depth p touches
 * very nearly a fraction p of the paper. That keeps how dark a line is in
 * proportion to how hard it was drawn, whatever the noise happened to do.
 */

/** The tile's size in CSS pixels. */
export const TILE = 256

export type Tooth = {
  /** Device pixels per CSS pixel the tile was built at. */
  scale: number
  /** Side of the tile in device pixels. */
  size: number
  /** Height of the paper at each device pixel, 0 (hollow) to 1 (peak), uniformly spread. */
  h: Float32Array
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * Gradient noise on a lattice of cx by cy cells that wraps, sampled on an
 * S by SY grid (square unless SY is given), in roughly -1..1.
 */
export function periodic(S: number, cx: number, cy: number, seed: number, out: Float32Array, k: number, SY = S) {
  const r = rng(seed)
  const gx = new Float32Array(cx * cy), gy = new Float32Array(cx * cy)
  for (let i = 0; i < cx * cy; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a) }
  for (let y = 0; y < SY; y++) {
    const fy = (y / SY) * cy, iy = Math.floor(fy), ty = fy - iy
    const y0 = iy % cy, y1 = (iy + 1) % cy, v = fade(ty)
    for (let x = 0; x < S; x++) {
      const fx = (x / S) * cx, ix = Math.floor(fx), tx = fx - ix
      const x0 = ix % cx, x1 = (ix + 1) % cx, u = fade(tx)
      const a = gx[y0 * cx + x0] * tx + gy[y0 * cx + x0] * ty
      const b = gx[y0 * cx + x1] * (tx - 1) + gy[y0 * cx + x1] * ty
      const c = gx[y1 * cx + x0] * tx + gy[y1 * cx + x0] * (ty - 1)
      const d = gx[y1 * cx + x1] * (tx - 1) + gy[y1 * cx + x1] * (ty - 1)
      const top = a + (b - a) * u, bot = c + (d - c) * u
      out[y * S + x] += (top + (bot - top) * v) * k
    }
  }
}

const cache = new Map<number, Tooth>()

/** The tooth at a given device scale. Built once per scale, then shared. */
export function tooth(scale = 1): Tooth {
  const key = Math.round(scale * 4) / 4 || 1
  const hit = cache.get(key)
  if (hit) return hit
  const size = Math.round(TILE * key)
  const raw = new Float32Array(size * size)
  // Bumps about 2.7, 5.3 and 13 CSS pixels across: cold-pressed paper seen at
  // arm's length, not a pebble-dashed wall.
  periodic(size, 96, 96, 11, raw, 0.55)
  periodic(size, 48, 48, 23, raw, 0.34)
  periodic(size, 20, 20, 37, raw, 0.22)
  // And the grain: long one way, short the other.
  periodic(size, 16, 128, 41, raw, 0.16)

  // To a uniform 0..1, so that depth and coverage agree: each height becomes
  // the share of the paper lower than it. A fine histogram rather than a
  // sort — a quarter of a million values, on the main thread, at load.
  let lo = Infinity, hi = -Infinity
  for (const v of raw) { if (v < lo) lo = v; if (v > hi) hi = v }
  const BINS = 4096, span = (hi - lo) || 1
  const count = new Uint32Array(BINS + 1)
  const bin = (v: number) => Math.min(BINS - 1, Math.floor(((v - lo) / span) * BINS))
  for (const v of raw) count[bin(v) + 1]++
  for (let b = 1; b <= BINS; b++) count[b] += count[b - 1]
  const h = new Float32Array(raw.length)
  const n = raw.length
  for (let i = 0; i < n; i++) {
    const v = raw[i], b = bin(v)
    const within = ((v - lo) / span) * BINS - b
    h[i] = (count[b] + (count[b + 1] - count[b]) * Math.min(1, Math.max(0, within))) / n
  }

  const t = { scale: key, size, h }
  cache.set(key, t)
  return t
}

/**
 * The scale to build the tooth at for a page this many device pixels wide.
 *
 * The grain belongs to the paper, not to the screen: a phone shows the whole
 * page smaller, so it shows the bumps smaller too, the way a photograph of
 * the page would. Measured against a page drawn 900 pixels wide, where the
 * finest bumps come out about 2.7 pixels across.
 */
export function toothScale(pageDeviceWidth: number) {
  return Math.max(0.5, Math.round((pageDeviceWidth / 900) * 4) / 4)
}
