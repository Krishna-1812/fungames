/**
 * The desk the sketchbook lies on: pale ash, in daylight.
 *
 * Ash is a straight-grained wood with strong, thin late-wood lines and open
 * pores between them, which is what makes it read as wood at a glance rather
 * than as a beige gradient. So that is what is built: a grain that runs along
 * the desk, wandering a little (no tree grows straight), thin darker lines
 * where each year's growth ended, long fibre streaks, and the small dark
 * flecks of the pores, all in one tile that repeats without a seam.
 *
 * Painted fully lit, the way a texture is. The window's light and the shadows
 * of the things on the desk are laid over it by the page.
 */
import { periodic } from './tooth'

/** The tile, in CSS pixels. Wide, because the grain runs a long way. */
export const DESK_W = 960
export const DESK_H = 560

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The desk as an image URL to use as a CSS background. */
export function deskTile(): Promise<string> {
  const W = DESK_W, H = DESK_H
  const n = W * H
  const warp = new Float32Array(n), drift = new Float32Array(n)
  const fibre = new Float32Array(n), pore = new Float32Array(n)
  const tone = new Float32Array(n)
  // Where the grain wanders: slowly along the board, a little faster across.
  // Quartersawn, so it mostly runs straight.
  periodic(W, 2, 3, 101, warp, 7, H)
  periodic(W, 6, 8, 103, warp, 2.5, H)
  // How wide the growth rings are, which changes year to year.
  periodic(W, 2, 6, 107, drift, 1.2, H)
  // Fibres: long along the board, fine across it.
  periodic(W, 5, 220, 109, fibre, 1, H)
  periodic(W, 12, 340, 113, fibre, 0.6, H)
  // Pores: small and elongated with the grain.
  periodic(W, 190, 300, 127, pore, 1, H)
  // And the board's own slow changes of tone.
  periodic(W, 2, 2, 131, tone, 1, H)

  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')!
  const img = g.createImageData(W, H)
  const d = img.data
  // Pale ash, graded a touch cool by the daylight.
  const EARLY = [216, 208, 196], LATE = [184, 172, 156]
  // Rings per tile height: a whole number, so the grain carries over the seam.
  const RINGS = 40
  // No two years are alike: each ring's line is its own strength.
  const year = Float32Array.from({ length: RINGS }, (_, k) => 0.35 + 0.65 * (((Math.sin(k * 12.9898) * 43758.5453) % 1 + 1) % 1))
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const gy = (y + warp[i]) / H * RINGS + drift[i]
      const ring = gy - Math.floor(gy)
      const strength = year[((Math.floor(gy) % RINGS) + RINGS) % RINGS]
      // The year's growth: soft early wood darkening into a thin hard line.
      const late = (smooth(0.86, 0.97, ring) * (1 - smooth(0.97, 1, ring)) * 0.55 + 0.14 * smooth(0.3, 0.97, ring)) * strength
      const f = fibre[i]
      const p = smooth(0.46, 0.64, pore[i]) * (0.25 + 0.75 * smooth(0.5, 0.95, ring))
      let r = EARLY[0] + (LATE[0] - EARLY[0]) * late
      let gg = EARLY[1] + (LATE[1] - EARLY[1]) * late
      let b = EARLY[2] + (LATE[2] - EARLY[2]) * late
      const k = 1 + f * 0.045 - p * 0.12 + tone[i] * 0.035
      r *= k; gg *= k; b *= k
      const o = i * 4
      d[o] = r * 0.975; d[o + 1] = gg * 0.99; d[o + 2] = b * 1.015; d[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return new Promise((resolve) => cv.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : cv.toDataURL()), 'image/png'))
}
