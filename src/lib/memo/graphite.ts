/**
 * The pencil's one rule, on its own so it can be held to account
 * (scripts/check-memo-pencil.mjs) without a canvas: memo-ink.ts applies it to
 * every pixel a stroke touches, against the paper's relief from tooth.ts.
 */

/**
 * How much graphite a pixel takes: the lead pressing `p` (0..1) onto paper
 * whose bump there stands `t` high (0 hollow, 1 peak, uniformly spread).
 *
 * The lead reaches the top `reach` of the bumps, with a soft shoulder so the
 * grain is not a hard stipple; pressing harder also leaves more on each bump
 * it does reach. Pure, so scripts/check-memo-pencil.mjs can hold it to that.
 */
export function graphite(p: number, t: number) {
  if (p < 0.02) return 0
  const reach = p * 1.1 + 0.04
  let a = (t - (1 - reach)) / 0.3
  if (a <= 0) return 0
  a = a >= 1 ? 1 : a * a * (3 - 2 * a)
  return a * (0.34 + 0.6 * p)
}
