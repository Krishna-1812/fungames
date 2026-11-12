/**
 * Orbit's physics, lifted out of the page so it can be run without a browser.
 *
 * Nothing here changed behaviour when it moved, with one exception noted
 * below: bodies now carry an id, because a challenge like "this body of yours
 * completed a lap" needs to know it is watching the same body from one frame
 * to the next, and an array index does not survive a merge.
 *
 * The integrator is leapfrog, in its drift–kick–drift form: half a step of
 * motion, then the whole step's change of velocity from the forces at that
 * midpoint, then the other half of the motion. It costs exactly what the
 * semi-implicit Euler it replaced did — one pass over the pairs per step — and
 * it is second order where that was first: halve the step and the error
 * quarters rather than halves. At the step the page runs, a circle that Euler
 * drew 1.4% out of round comes back from leapfrog true to a few parts in a
 * hundred thousand. Both are symplectic, so the energy of a closed orbit
 * oscillates around its true value instead of drifting; leapfrog is also
 * time-reversible, which is why an ellipse here closes on itself lap after
 * lap. scripts/check-orbit.mjs measures all of it.
 *
 * ## Softening, and why there is almost none left
 *
 * The separation in the force law is sqrt(d² + SOFT²) rather than d. That is a
 * standard n-body device for stopping a close pass producing an infinite
 * impulse, and for years SOFT here was 26 pixels.
 *
 * It was guarding against something that cannot happen. Bodies merge the
 * moment they touch, so no two are ever closer than the sum of their radii —
 * 5.6 at the very least, and 38 for a moon against the sun — and the force
 * never gets near its singularity. What 26 pixels of softening did do was
 * weaken gravity everywhere that mattered: by a fifth at the innermost preset
 * orbit, so Kepler's laws did not hold, every ellipse precessed into a
 * rosette at about 22° a lap, and the zone round a planet where a moon could
 * stay was entirely inside it. A moon launched round a planet was lost within
 * seconds, every time.
 *
 * With leapfrog the close passes are accurate without it — energy holds to a
 * tenth of a percent through a pass that skims the star — so SOFT is now one
 * pixel: inverse-square everywhere a body can actually be. Ellipses close,
 * the period goes as the radius to the three halves, escape is √2 times
 * circular, and a planet can keep a moon. scripts/check-orbit.mjs holds the
 * simulation to each of those.
 *
 * The helpers below keep the softened form so they stay exact for whatever
 * SOFT is. The circular speed, from setting the softened pull equal to the
 * centripetal acceleration:
 *
 *     a_grav = G·M·r / (r² + s²)^(3/2)
 *     v²     = G·M·r² / (r² + s²)^(3/2)
 *
 * which at s = 1 is Kepler's sqrt(GM/r) to within 0.05% even at contact.
 */

export type Body = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  m: number
  r: number
  hue: number
  star: boolean
  /** True when a player fling made it, false for a preset. */
  mine: boolean
}

export const G = 1
/** Softening length: only a guard against two bodies at one point. See the header. */
export const SOFT = 1
export const MAX_BODIES = 320
/** Above this a body is drawn as a light source and counts as a star. */
export const STAR_MASS = 200

/**
 * Bodies are drawn as lit spheres, and below about 16px across there are not
 * enough pixels for a terminator to read. This is the physical radius, not a
 * render-only fudge: collisions use the same number, so a body that looks like
 * it should touch actually does.
 */
export const radiusFor = (m: number) => Math.max(2.8, Math.cbrt(m) * 2.6)
export const hueFor = (m: number) => (m >= STAR_MASS ? 42 : m >= 20 ? 205 : 190)

let nextId = 1
/** Only for the checker, so runs are reproducible. */
export function resetIds() {
  nextId = 1
}

export function makeBody(
  x: number, y: number, vx: number, vy: number, m: number, mine = false,
): Body {
  return { id: nextId++, x, y, vx, vy, m, r: radiusFor(m), hue: hueFor(m), star: m >= STAR_MASS, mine }
}

/**
 * Speed for a circular orbit of radius r about mass M.
 *
 * This is the test-particle answer, which is what the presets want: it assumes
 * the thing doing the orbiting is light enough not to move the primary. For
 * two bodies of comparable mass the exact relative speed uses M + m, and the
 * difference is the mass ratio — 0.1% for a planet round this game's star, and
 * not remotely negligible for two stars, which is why `binary()` passes the
 * pair's total.
 */
export const circularV = (M: number, r: number) =>
  Math.sqrt((G * M * r * r) / Math.pow(r * r + SOFT * SOFT, 1.5))

/** Speed needed at radius r to escape mass M. Test-particle, as above. */
export const escapeV = (M: number, r: number) =>
  Math.sqrt((2 * G * M) / Math.sqrt(r * r + SOFT * SOFT))

export type Merge = { x: number; y: number; m: number; survivor: number; absorbed: number }
export type StepEvents = { merges: Merge[]; escaped: Body[] }

/**
 * Advance the system by dt and return what happened.
 *
 * The returned array may be a different array from the one passed in — bodies
 * that leave the field are filtered out — so callers must use the result.
 */
export function step(
  bodies: Body[], dt: number, w: number, h: number,
): { bodies: Body[]; events: StepEvents } {
  const events: StepEvents = { merges: [], escaped: [] }
  const n = bodies.length
  const half = dt / 2

  // Drift: half a step on the current velocities, to the midpoint.
  for (const b of bodies) { b.x += b.vx * half; b.y += b.vy * half }

  // Accelerations from every pair, computed once and applied to both.
  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = bodies[i]
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy + SOFT * SOFT
      const inv = 1 / Math.sqrt(d2)
      const f = G * inv * inv * inv
      ax[i] += f * b.m * dx; ay[i] += f * b.m * dy
      ax[j] -= f * a.m * dx; ay[j] -= f * a.m * dy
    }
  }

  // Kick with the midpoint forces, then drift the second half on the new
  // velocities.
  for (let i = 0; i < n; i++) {
    const b = bodies[i]
    b.vx += ax[i] * dt
    b.vy += ay[i] * dt
    b.x += b.vx * half
    b.y += b.vy * half
  }

  // Merge overlapping bodies, conserving mass and momentum.
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const rr = a.r + b.r
      if (dx * dx + dy * dy > rr * rr) continue

      const big = a.m >= b.m ? a : b
      const small = big === a ? b : a
      const m = a.m + b.m
      big.vx = (a.vx * a.m + b.vx * b.m) / m
      big.vy = (a.vy * a.m + b.vy * b.m) / m
      big.x = (a.x * a.m + b.x * b.m) / m
      big.y = (a.y * a.m + b.y * b.m) / m
      big.m = m
      big.r = radiusFor(m)
      big.hue = hueFor(m)
      big.star = m >= STAR_MASS
      // A merged body inherits authorship: if either half was yours, it is
      // still something you built, and the challenges should keep counting it.
      big.mine = big.mine || small.mine

      bodies.splice(bodies.indexOf(small), 1)
      events.merges.push({ x: big.x, y: big.y, m: small.m, survivor: big.id, absorbed: small.id })
      j--
    }
  }

  // Anything flung far outside the view is gone for good; drop it.
  const pad = Math.max(w, h) * 2.2
  const kept: Body[] = []
  for (const b of bodies) {
    if (b.x > -pad && b.x < w + pad && b.y > -pad && b.y < h + pad) kept.push(b)
    else events.escaped.push(b)
  }
  return { bodies: kept, events }
}

/* -------------------------------------------------------------------------- */
/* Measurements                                                               */
/* -------------------------------------------------------------------------- */

export type Vec = { x: number; y: number; vx: number; vy: number }

/** Mass-weighted mean position and velocity of the whole system. */
export function barycentre(bodies: Body[]): Vec & { m: number } {
  let m = 0, x = 0, y = 0, vx = 0, vy = 0
  for (const b of bodies) {
    m += b.m; x += b.x * b.m; y += b.y * b.m; vx += b.vx * b.m; vy += b.vy * b.m
  }
  if (m === 0) return { x: 0, y: 0, vx: 0, vy: 0, m: 0 }
  return { x: x / m, y: y / m, vx: vx / m, vy: vy / m, m }
}

/** Total energy of the system in its own rest frame. Should be conserved. */
export function totalEnergy(bodies: Body[]): number {
  const com = barycentre(bodies)
  let e = 0
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]
    const dvx = a.vx - com.vx, dvy = a.vy - com.vy
    e += 0.5 * a.m * (dvx * dvx + dvy * dvy)
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]
      const dx = b.x - a.x, dy = b.y - a.y
      e -= (G * a.m * b.m) / Math.sqrt(dx * dx + dy * dy + SOFT * SOFT)
    }
  }
  return e
}

/**
 * Energy per unit mass of one body relative to the system's centre of mass,
 * counting the whole of every pair potential it takes part in.
 *
 * Negative means bound and it will come back; positive means it is leaving and
 * nothing in the system can stop it. Charging a body the full pair potential
 * rather than half is the usual convention for an escaper test, and it is the
 * conservative direction: a body only reads as unbound when it really is.
 */
export function bodyEnergy(b: Body, bodies: Body[], com = barycentre(bodies)): number {
  const dvx = b.vx - com.vx, dvy = b.vy - com.vy
  let e = 0.5 * (dvx * dvx + dvy * dvy)
  for (const o of bodies) {
    if (o === b) continue
    const dx = o.x - b.x, dy = o.y - b.y
    e -= (G * o.m) / Math.sqrt(dx * dx + dy * dy + SOFT * SOFT)
  }
  return e
}

/** Energy per unit mass of `b` relative to `p` alone, ignoring everything else. */
export function relEnergy(b: Body, p: Body): number {
  const dx = b.x - p.x, dy = b.y - p.y
  const dvx = b.vx - p.vx, dvy = b.vy - p.vy
  return 0.5 * (dvx * dvx + dvy * dvy) - (G * (p.m + b.m)) / Math.sqrt(dx * dx + dy * dy + SOFT * SOFT)
}

/** The heaviest body, which everything else is measured against. */
export function heaviest(bodies: Body[]): Body | null {
  let best: Body | null = null
  for (const b of bodies) if (!best || b.m > best.m) best = b
  return best
}
