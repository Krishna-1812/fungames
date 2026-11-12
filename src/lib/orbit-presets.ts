/**
 * Orbit's three starting systems, built here rather than in the page so
 * scripts/check-orbit.mjs can prove they hold together at every screen size.
 *
 * ## The solar system
 *
 * Spacing is everything. What matters between two neighbouring orbits is not
 * the gap in pixels but the gap in mutual Hill radii — the reach of the two
 * planets' own gravity against the star's — and that grows with distance, so
 * equal pixel gaps get steadily more crowded going outwards. The old preset
 * spaced its planets evenly, went from 4.3 Hill radii of separation to 1.7,
 * and lost a planet within seconds every time. Spacing them geometrically
 * holds the separation constant all the way out.
 *
 * Where the screen has room, the outermost planet is a giant with a moon of
 * its own. A giant is a crowd on its own: at a sixty-fifth of the sun it needs
 * four and a half mutual Hill radii of clear space inside it, so the rocky
 * planets stop where that begins, and its moon has to sit in the inner part of
 * its Hill sphere — prograde moons further out than about half of it are taken
 * by the star — and clear of the giant's surface by more than a perturbed
 * orbit wanders. Two moons were tried and do not last: in the room there is,
 * each pumps the other's eccentricity until the inner one hits the giant, nine
 * runs in ten within two minutes. One moon, every run, indefinitely.
 *
 * On a phone there is no such room — a giant's Hill sphere at the edge of a
 * 390-pixel screen is smaller than its moon's orbit would need to be — so the
 * phone gets the rocky planets alone, sized to fit three.
 */
import { makeBody, circularV, radiusFor, type Body } from './orbit-sim'

export const SUN = 2600
/** The golden angle, so neighbouring planets never start side by side. */
const GOLDEN = 2.39996

/**
 * Cancel the system's net momentum by nudging the heaviest body.
 *
 * Without this a ring of planets all going the same way carries the star
 * slowly across the screen, because a preset that hands everything a velocity
 * and the star none is a system with somewhere to be.
 */
export function settle(bodies: Body[]) {
  if (!bodies.length) return
  let px = 0, py = 0
  for (const b of bodies) { px += b.m * b.vx; py += b.m * b.vy }
  let heavy = bodies[0]
  for (const b of bodies) if (b.m > heavy.m) heavy = b
  heavy.vx -= px / heavy.m
  heavy.vy -= py / heavy.m
}

/**
 * A body of mass m on a circular orbit of radius r round a primary of mass M
 * at (cx, cy) moving at (cvx, cvy), starting at angle a.
 *
 * The pair turns about its barycentre, so the relative speed is the pair's,
 * sqrt(G(M+m)/r), and the body carries M/(M+m) of it; the primary's recoil,
 * the other m/(M+m), is left to whoever places it — settle() for the star.
 * For a giant at a sixty-fifth of the sun the difference is not academic:
 * getting it wrong is an eccentricity of three percent.
 */
function circling(cx: number, cy: number, cvx: number, cvy: number, M: number, r: number, a: number, m: number) {
  const v = circularV(M + m, r) * (M / (M + m))
  return makeBody(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cvx - Math.sin(a) * v, cvy + Math.cos(a) * v, m)
}

/** Gaps between rocky orbits, in mutual Hill radii. Four loses a planet in a
 *  third of runs, though never in the first forty seconds; five is clean. */
const HILL_GAPS = 5
/** ...and between the lighter rocky planets inside a giant, which a giant
 *  system needs to fit more than one of; clean at four and a half. */
const LIGHT_GAPS = 4.5
/** Below this edge (half the short side, less a margin) a giant and its moon
 *  do not fit, and the system is rocky planets only. */
export const GIANT_ROOM = 250
const GIANT = 40
const GIANT_AT = 0.87
/** Clear space inside the giant's orbit, in mutual Hill radii. */
const GIANT_GAPS = 4.5
const MOON = 0.1
/** How far out of the giant's Hill sphere its moon may go: inside the half
 *  that keeps a prograde moon, with margin. */
const MOON_REACH = 0.42
/** Clear sky between the moon and the giant's surface. */
const MOON_CLEAR = 6

export function solar(w: number, h: number, rand = Math.random): Body[] {
  const cx = w / 2, cy = h / 2
  const out = [makeBody(cx, cy, 0, 0, SUN)]
  const edge = Math.min(w, h) / 2 - 12
  const spin = rand() * Math.PI * 2
  let i = 0

  if (edge >= GIANT_ROOM) {
    const gR = edge * GIANT_AT
    const rock = 4
    const ratio = 1 + LIGHT_GAPS * Math.cbrt((2 * rock) / (3 * SUN))
    // How many mutual Hill radii lie between a rocky orbit at r and the giant's.
    const clear = (r: number) => (gR - r) / (Math.cbrt((GIANT + rock) / (3 * SUN)) * (gR + r) / 2)
    for (let r = 70; clear(r) >= GIANT_GAPS; r *= ratio, i++) {
      out.push(circling(cx, cy, 0, 0, SUN, r, spin + i * GOLDEN, 2 + rand() * (rock - 2)))
    }
    const giant = circling(cx, cy, 0, 0, SUN, gR, spin + i * GOLDEN, GIANT)
    out.push(giant)
    const rH = gR * Math.cbrt(GIANT / (3 * SUN))
    const d = radiusFor(GIANT) + radiusFor(MOON) + MOON_CLEAR
    if (d <= rH * MOON_REACH) {
      const moon = circling(giant.x, giant.y, giant.vx, giant.vy, GIANT, d, rand() * Math.PI * 2, MOON)
      // The giant's recoil from its moon, which settle() would hand the sun.
      giant.vx -= ((moon.vx - giant.vx) * MOON) / GIANT
      giant.vy -= ((moon.vy - giant.vy) * MOON) / GIANT
      out.push(moon)
    }
  } else {
    // How heavy the planets can be and still leave room for three of them.
    // A planet's Hill radius grows as the cube root of its mass, so lighter
    // planets pack closer; both ends are clamped, because below 4 they are
    // specks and above 14 the ladder runs off any screen anyway.
    const want = Math.cbrt(edge / 70)
    const heaviest = Math.min(14, Math.max(4, 1.5 * SUN * Math.pow((want - 1) / HILL_GAPS, 3)))
    const ratio = 1 + HILL_GAPS * Math.cbrt((2 * heaviest) / (3 * SUN))
    for (let r = 70; r <= edge; i++, r *= ratio) {
      out.push(circling(cx, cy, 0, 0, SUN, r, spin + i * GOLDEN, 4 + rand() * (heaviest - 4)))
    }
  }
  // Every orbit above is set with circularV(M + m), the pair's speed, so the
  // star and each planet turn about their barycentre rather than the planet
  // being fractionally slow; settling then takes out the star's share.
  settle(out)
  return out
}

/** Two equal stars about their barycentre, with a disc of small bodies round both. */
export function binary(w: number, h: number, rand = Math.random): Body[] {
  const cx = w / 2, cy = h / 2
  const sep = Math.min(w, h) * 0.22
  const M = 900
  // Each star travels at half the relative circular speed of the pair, and
  // the pair's speed is set by their combined mass over the full separation.
  const v = circularV(2 * M, 2 * sep) / 2
  const out = [makeBody(cx - sep, cy, 0, v, M), makeBody(cx + sep, cy, 0, -v, M)]
  for (let i = 0; i < 14; i++) {
    const r = sep * (2.1 + rand() * 1.5)
    const a = rand() * Math.PI * 2
    out.push(circling(cx, cy, 0, 0, 2 * M, r, a, 3 + rand() * 6))
  }
  settle(out)
  return out
}

/** Ninety bodies thrown in at random, for gravity to sort out. */
export function chaos(w: number, h: number, rand = Math.random): Body[] {
  const out: Body[] = []
  for (let i = 0; i < 90; i++) {
    out.push(makeBody(rand() * w, rand() * h, (rand() - 0.5) * 1.4, (rand() - 0.5) * 1.4, 3 + rand() * 12))
  }
  settle(out)
  return out
}
