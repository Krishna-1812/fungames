/**
 * The shape of a fold in progress.
 *
 * Paper does not fold like a door on a hinge. Lift the free edge and the sheet
 * rolls: a curve near the crease, then flat to the edge you are holding. Press
 * it down and the curve tightens until it is as tight as the stack allows —
 * a half-turn whose radius is half the stack's own thickness, because the
 * paper on the inside of the bend cannot go round anything smaller than
 * nothing. That tight half-turn is the "lip" the page has always drawn, and it
 * is the length Gallivan's equations charge for: paper that went round the
 * bend is paper that did not reach the far side. So a finished flap stops
 * short of the far edge by exactly that, and you can see it.
 *
 * Here x runs along the sheet with the crease at 0 and the flap lying towards
 * +x; y is up, and the stack being folded occupies 0..h. The flap is followed
 * along its middle surface, s from the crease (0) to its free edge (a). Pure,
 * so scripts/check-fold-curl.mjs can hold it to the things above.
 */

export type Curl = {
  /** How far round it has turned, 0 (flat) to π (lying on top). */
  theta: number
  /** Radius of the bend, at the middle of the paper. Never under h / 2. */
  R: number
  /** Where the middle of the paper is, s along it, and which way its top faces. */
  at(s: number): { x: number; y: number; nx: number; ny: number }
}

/**
 * The flap at fold progress u (0..1), for a flap a long and a stack h thick.
 *
 * Mid-fold the loop is loose — about a seventh of the flap across, the way a
 * sheet bends when you lift its edge — and it closes to the tightest possible
 * as the fold completes.
 */
export function curl(u: number, a: number, h: number): Curl {
  const k = Math.max(0, Math.min(1, u))
  const theta = Math.PI * k
  const loose = a * 0.14 * Math.sin(Math.PI * k) * Math.pow(1 - k, 0.35)
  // The bend can never take more paper than the flap has.
  const R = Math.max(h / 2, Math.min(h / 2 + loose, theta > 1e-6 ? (a * 0.9) / theta : Infinity))
  const bend = theta * R
  return {
    theta,
    R,
    at(s: number) {
      if (s <= bend) {
        const phi = R > 0 ? s / R : 0
        return { x: R * Math.sin(phi), y: h / 2 + R - R * Math.cos(phi), nx: -Math.sin(phi), ny: Math.cos(phi) }
      }
      const ex = R * Math.sin(theta), ey = h / 2 + R - R * Math.cos(theta)
      const t = s - bend
      return { x: ex + t * Math.cos(theta), y: ey + t * Math.sin(theta), nx: -Math.sin(theta), ny: Math.cos(theta) }
    },
  }
}
