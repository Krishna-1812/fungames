/**
 * Real spherical astronomy, not a scrolling 2D map.
 *
 * A flat lat/lon-style pan of the sky (x = RA, y = Dec) looks fine near the
 * celestial equator and is visibly wrong everywhere else — constellations
 * stretch and warp as they near the poles, exactly the distortion an actual
 * equirectangular map has. Real planetarium software instead keeps a look
 * direction (ra0, dec0) and re-projects the whole sky onto the tangent plane
 * at that point every time it moves — a gnomonic projection, the same
 * "standard coordinates" astrometry has used for a century, chosen because
 * it is the one projection where a great circle (and every constellation
 * line here is a short arc of one) always renders as a straight line.
 *
 * `scripts/check-sky-projection.mjs` checks this against the geometry it has
 * to satisfy regardless of formula: the view centre always projects to the
 * origin, a real spherical-law-of-cosines separation matches the Cartesian
 * distance between two projected nearby points, and nothing behind the
 * viewer is reported visible.
 */

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

/** Real angular separation between two sky points, in degrees — the
 *  spherical law of cosines, not a flat-plane approximation. */
export function angularSeparationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const d1 = dec1 * D2R
  const d2 = dec2 * D2R
  const dra = (ra2 - ra1) * D2R
  let cosC = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra)
  cosC = Math.max(-1, Math.min(1, cosC))
  return Math.acos(cosC) * R2D
}

export interface Projected {
  x: number
  y: number
  /** In front of the viewer (within 90° of the look direction). A gnomonic
   *  projection has no finite image for anything else. */
  visible: boolean
}

/**
 * Gnomonic (tangent-plane) projection of (ra, dec) as seen looking at
 * (ra0, dec0), in units of radians of arc at the tangent point — multiply by
 * a pixels-per-radian scale to place it on screen. +x is toward increasing
 * RA, +y is toward increasing Dec, both as they'd appear to an observer
 * looking up (not mirrored for an external "looking at a globe" view).
 */
export function project(ra: number, dec: number, ra0: number, dec0: number): Projected {
  const d = dec * D2R
  const d0 = dec0 * D2R
  const dra = (ra - ra0) * D2R
  const cosC = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(dra)
  if (cosC <= 1e-6) return { x: 0, y: 0, visible: false }
  const x = (Math.cos(d) * Math.sin(dra)) / cosC
  const y = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(dra)) / cosC
  return { x, y, visible: true }
}

/**
 * The inverse: given a point (x, y) in the same tangent-plane radian units,
 * projected from a view centred on (ra0, dec0), recover its real (ra, dec).
 * Used to re-centre the view under the cursor while zooming, and to convert
 * a drag delta into how far the look direction actually moved.
 */
export function unproject(x: number, y: number, ra0: number, dec0: number): { ra: number; dec: number } {
  const d0 = dec0 * D2R
  const rho = Math.hypot(x, y)
  if (rho < 1e-12) return { ra: ra0, dec: dec0 }
  const c = Math.atan(rho)
  const sinC = Math.sin(c)
  const cosC = Math.cos(c)
  const dec = Math.asin(cosC * Math.sin(d0) + (y * sinC * Math.cos(d0)) / rho)
  const ra = ra0 * D2R + Math.atan2(x * sinC, rho * Math.cos(d0) * cosC - y * Math.sin(d0) * sinC)
  return { ra: (((ra * R2D) % 360) + 360) % 360, dec: dec * R2D }
}

/** Wrap a right ascension into [0, 360). */
export const wrapRa = (ra: number): number => ((ra % 360) + 360) % 360

/** Clamp a declination into [-90, 90] — there is no further to pan north or south. */
export const clampDec = (dec: number): number => Math.max(-90, Math.min(90, dec))
