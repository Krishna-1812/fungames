/**
 * Where the rails go.
 *
 * One main line along +x, and one of two branches leaving it at the points:
 * a siding that runs off beside it, or a loop that comes back and rejoins just
 * short of whoever is standing there. A route is the list of points the tram
 * actually follows, with the distance along it, so the tram can be driven by
 * how far it has gone and both bogies can be asked where they are.
 *
 * Plain numbers and no three.js, for the same reason as the physics.
 */

export const TRACK = {
  /** Half the gauge, rail centre to track centre. */
  GAUGE: 0.72,
  /** Top of the sleepers above the grass. */
  BED: 0.3,
  /** Top of the rail. */
  RAIL: 0.46,
  /** How far off the siding runs. Negative z is away from the camera. */
  SIDE: -7.5,
  LOOP_SIDE: -5,
  /** Where the points are. */
  FORK: -8,
  LOOP_FORK: -17,
  /** Where whoever is on a track stands. */
  STAND: 15,
  /** Where the tram waits. */
  START: -27,
  FAR: 90,
} as const

export type Pt = { x: number; z: number }
export type Route = { pts: Pt[]; s: number[]; length: number }

const smoother = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10))

/** The siding's z at a given x. */
export function sideZ(x: number, loop: boolean) {
  if (!loop) return TRACK.SIDE * smoother((x - TRACK.FORK) / 20)
  const out = smoother((x - TRACK.LOOP_FORK) / 14)
  const back = smoother((x + 2) / 14)
  return TRACK.LOOP_SIDE * (out - back)
}

function build(f: (x: number) => number, x0: number, x1: number): Route {
  const pts: Pt[] = [], s: number[] = []
  let len = 0
  const n = Math.ceil((x1 - x0) / 0.2)
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, z = f(x)
    if (i) len += Math.hypot(x - pts[i - 1].x, z - pts[i - 1].z)
    pts.push({ x, z }); s.push(len)
  }
  return { pts, s, length: len }
}

/** The line the tram takes: straight on, or over the points. */
export function route(diverted: boolean, loop = false, x0: number = TRACK.START - 8, x1: number = TRACK.FAR): Route {
  return build((x) => (diverted ? sideZ(x, loop) : 0), x0, x1)
}

/** The branch on its own, from the points outwards, for laying rails along. */
export function branch(loop: boolean): Route {
  return loop ? build((x) => sideZ(x, true), TRACK.LOOP_FORK, 12.5) : build((x) => sideZ(x, false), TRACK.FORK, TRACK.FAR)
}

/** Position and heading a distance along a route. */
export function at(r: Route, dist: number) {
  const d = Math.max(0, Math.min(r.length, dist))
  let lo = 0, hi = r.s.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r.s[mid] <= d) lo = mid; else hi = mid }
  const a = r.pts[lo], b = r.pts[hi], span = r.s[hi] - r.s[lo] || 1, t = (d - r.s[lo]) / span
  const tx = (b.x - a.x) / span, tz = (b.z - a.z) / span
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx, tz }
}

/** How far along a route a given x is (routes never double back in x). */
export function distAtX(r: Route, x: number) {
  let lo = 0, hi = r.pts.length - 1
  if (x <= r.pts[0].x) return 0
  if (x >= r.pts[hi].x) return r.length
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (r.pts[mid].x <= x) lo = mid; else hi = mid }
  const t = (x - r.pts[lo].x) / (r.pts[hi].x - r.pts[lo].x || 1)
  return r.s[lo] + (r.s[hi] - r.s[lo]) * t
}

/**
 * The ground under a point: grass at zero, and a ballast bed that steps up
 * under each line. `lines` give a line's z at an x, or null where it is not.
 */
export function groundAt(x: number, z: number, lines: Array<(x: number) => number | null>) {
  let h = 0
  for (const f of lines) {
    const lz = f(x)
    if (lz === null) continue
    const d = Math.abs(z - lz)
    // Flat across the sleepers, then a shoulder down to the grass.
    const bed = d < 1.35 ? TRACK.BED : d < 2.15 ? TRACK.BED * (1 - (d - 1.35) / 0.8) : 0
    if (bed > h) h = bed
  }
  return h
}
