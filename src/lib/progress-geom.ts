/**
 * Progress's instrument.
 *
 * The page used to draw thirteen horizontal bars, one per unit of time. They
 * were good bars — the fill was made of moving material and it moved at that
 * row's real rate — but thirteen parallel bars say that these units are
 * thirteen separate things, and they are not. This minute is inside this hour
 * is inside today is inside this week. Each one *contains* the one before it,
 * and parallel is exactly the wrong word for that.
 *
 * So they are concentric now: fifteen channels milled into one dial, ordered
 * by span, the fastest at the rim. "Further in is slower" is the sort key
 * rather than a caption, and the nesting is the picture.
 *
 * ## Why a machined object and not a ring chart
 *
 * A ring chart carries the same numbers. What it does not carry is the reason
 * to look at this page twice, which is that the fast rings are visibly alive
 * and the slow ones are visibly dead. An instrument makes that difference
 * physical: the outer channels run with hot lume and the inner ones hold cold
 * mineral, and the Sun's — dead centre, at 46% — has not moved since before
 * there were eyes to read it.
 *
 * ## Why this is not in progress-dial.ts
 *
 * Because a checker cannot import that file. Every shader module on this site
 * imports ./gl, and Node's TypeScript loader will not take it — ShaderSurface
 * uses parameter properties, which strip-only mode rejects, and the module
 * calls matchMedia at import time. That is why nothing here has ever had a
 * test. So the parts with answers in them — where each ring is, which ring a
 * point is in, what colour a rate is, how dark the readout's ground may be —
 * live in this half, with no imports at all, and the shader interpolates them
 * into its own source. The two cannot disagree about where a channel is,
 * because there is only one statement of where a channel is.
 */
/**
 * Relative luminance ceiling for the readout aperture, applied after the
 * tonemap so it constrains what actually reaches the screen.
 *
 * The dimmest thing printed on the aperture is the unit label at #a08cbb,
 * L = 0.298. WCAG wants 4.5:1, so the brightest its ground may be is
 *   (0.298 + 0.05) / 4.5 - 0.05 = 0.0274
 *
 * The number below is lower, and not as a fudge. `toSRGB()` here is pow(1/2.2)
 * while WCAG decodes with the real sRGB curve, and the two disagree at this
 * end: the same cap Progress's old backdrop used measured back off the
 * framebuffer three thousandths brighter than it was set. 0.021 reads back as
 * 0.025, which is 4.63:1.
 *
 * In practice the aperture renders far below this — it is a recess, and the
 * crystal reflection is shaped to fall outside it. The cap is a backstop, so
 * that whatever gets authored in here later, the contrast still holds.
 */
export const APERTURE_MAX_LUM = 0.021

/**
 * The dial's radii, as fractions of the canvas half-width.
 *
 * The canvas is square and `centred()` normalises on the short axis, so 1.0 is
 * the edge of the element. The gap above `caseR` is not spare room — it is
 * where the case's own shadow falls, drawn by the shader rather than by a CSS
 * `drop-shadow()`, which on a canvas this size is re-rasterised every frame.
 */
export const DIAL = {
  /** Outer edge of the steel case. */
  caseR: 0.94,
  /**
   * Inner edge of the bezel; the dial plate starts here.
   *
   * The bezel is wider than it needs to be to look like a bezel, because it
   * also carries the four stamped numerals. At its first width they sat eight
   * pixels off the rim, on top of the knurling.
   */
  bezelIn: 0.838,
  /** Outermost channel's outer wall. */
  trackOut: 0.822,
  /** Innermost channel's inner wall. Inside this is the engine-turned boss. */
  trackIn: 0.37,
  /** The recessed readout aperture at the centre. */
  aperR: 0.285,
  /**
   * Share of each band that is cut away, the rest being the rib between.
   *
   * 0.7 left the ribs a pixel and a half wide at fifteen rings, and fifteen
   * fills with nothing between them stopped being channels and became one
   * wash. The metal has to be wide enough to see, or none of the milling is.
   */
  groove: 0.6,
} as const

/**
 * The two ends of the lume.
 *
 * These are linear-light HDR values, not CSS colours — the hot end is over 1.0
 * on two channels because it is meant to bloom through the tonemapper rather
 * than sit at the top of the range.
 *
 * They live here, in one place, because the register plate under the dial
 * paints its rules with the same colours and the two must not drift. The
 * shader interpolates these constants into its source and `lumeCss()` runs the
 * identical mix, tonemap and transfer curve in JavaScript, so a row's rule and
 * its ring are the same colour by construction.
 */
export const LUME_COLD = [0.12, 0.075, 0.36] as const
export const LUME_HOT = [1.16, 0.44, 1.02] as const

const aces = (x: number) =>
  Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)))

/** The colour a ring of this rate is drawn in, as CSS. */
export function lumeCss(rate: number, gain = 1) {
  const sp = Math.min(1, Math.max(0, rate))
  const k = sp * sp * (3 - 2 * sp)
  const ch = (i: number) => {
    const lin = (LUME_COLD[i] + (LUME_HOT[i] - LUME_COLD[i]) * k) * gain
    return Math.round(Math.pow(aces(lin), 1 / 2.2) * 255)
  }
  return `rgb(${ch(0)} ${ch(1)} ${ch(2)})`
}

export type Ring = {
  /** Inner and outer wall of the milled channel. */
  r0: number
  r1: number
  /** Inner and outer edge of the band, ribs included. */
  b0: number
  b1: number
  mid: number
}

/**
 * Ring `i` of `n`, counting outward-in: 0 is the fastest unit, at the rim.
 *
 * The page hit-tests the pointer with this and the shader lays the channels
 * out from the same numbers, so a hover cannot land on a different ring from
 * the one that lights up.
 */
export function ring(n: number, i: number): Ring {
  const band = (DIAL.trackOut - DIAL.trackIn) / n
  const b1 = DIAL.trackOut - i * band
  const b0 = b1 - band
  const cut = (band * (1 - DIAL.groove)) / 2
  return { b0, b1, r0: b0 + cut, r1: b1 - cut, mid: (b0 + b1) / 2 }
}

/**
 * Which ring a point falls in, or -1 for the bezel, the ribs and the boss.
 *
 * `x` and `y` are in the space the shader works in: origin at the centre, 1.0
 * at the edge of the element. The test is radial, so which way up y runs makes
 * no difference to it — the flip in the page matters for the crystal's
 * parallax, not for this.
 */
export function ringAt(x: number, y: number, n: number): number {
  const r = Math.hypot(x, y)
  if (r > DIAL.trackOut || r < DIAL.trackIn) return -1
  const band = (DIAL.trackOut - DIAL.trackIn) / n
  const i = Math.floor((DIAL.trackOut - r) / band)
  if (i < 0 || i >= n) return -1
  const g = ring(n, i)
  // Inside the band, but standing on a rib rather than in the channel. Ribs
  // are 3 pixels wide; snapping to the nearer channel would be a lie about a
  // gap the eye can see, so the answer is honestly "nothing".
  return r >= g.r0 && r <= g.r1 ? i : -1
}

