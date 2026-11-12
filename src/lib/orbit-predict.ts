/**
 * Where a launch will go, before it is launched.
 *
 * Two things a real mission planner has and Orbit did not.
 *
 * ## The frame you launch from
 *
 * Nothing is launched from rest. A rocket leaving Earth already has Earth's
 * thirty kilometres a second round the Sun, and that is most of what it has.
 * So a launch that starts inside a body's sphere of influence is thrown
 * relative to that body: it inherits the body's velocity, and the drag adds
 * to it. That is what makes a moon round a moving planet possible by hand —
 * without it you would have to match the planet's orbital speed with the drag
 * before you could even begin to aim at it.
 *
 * The sphere is the Hill sphere, r·∛(m/3M): how far a body's own gravity
 * outweighs the tidal pull of the heaviest thing it orbits. Every body has
 * one, measured against the heaviest *other* body, which for the star itself
 * is the biggest planet and so covers the whole field. Where spheres nest —
 * a moon's inside a planet's inside the star's — the smallest wins, because
 * that is the body you are actually standing next to.
 *
 * ## The path
 *
 * Then the launch is flown forward, a few hundred frames, against the
 * heaviest dozen bodies in the system moving under their own gravity too —
 * the same leapfrog at the same step the page runs, so the curve drawn is the
 * curve flown, as far as the bodies left out do not matter. It stops where the
 * body would hit something or leave, or once it has gone all the way round
 * whatever it was launched from. When that is a moving planet the path is
 * kept relative to the planet, so a moon's orbit draws as the loop it is
 * rather than the spiral it traces across the sky.
 */
import { G, SOFT, radiusFor, type Body } from './orbit-sim'

/** The Hill radius of `b` against the heaviest other body, or Infinity. */
function hill(b: Body, bodies: Body[]): number {
  let p: Body | null = null
  for (const o of bodies) if (o !== b && (!p || o.m > p.m)) p = o
  if (!p) return Infinity
  const d = Math.hypot(b.x - p.x, b.y - p.y)
  return d * Math.cbrt(b.m / (3 * p.m))
}

export type Frame = { body: Body; reach: number } | null

/**
 * The body a launch at (x, y) is thrown relative to: the one with the
 * smallest sphere of influence that contains the point, or null for the
 * screen's own frame.
 */
export function launchFrame(bodies: Body[], x: number, y: number): Frame {
  let best: Frame = null
  for (const b of bodies) {
    const reach = hill(b, bodies)
    if (Math.hypot(x - b.x, y - b.y) >= reach) continue
    if (!best || reach < best.reach) best = { body: b, reach }
  }
  return best
}

export type Path = {
  /** x, y pairs in world pixels, already shifted into the host's frame. */
  pts: Float32Array
  n: number
  /** Where it would hit something, if it does. */
  hit: { x: number; y: number } | null
  /** True when it went all the way round the host. */
  closed: boolean
}

const ATTRACTORS = 12

/**
 * Fly a launch forward. `frames` is in page frames (two half-steps each,
 * exactly as the page integrates).
 */
export function predict(
  bodies: Body[], x: number, y: number, vx: number, vy: number, m: number,
  host: Body | null, frames = 420, w = 0, h = 0,
): Path {
  // The bodies that matter: the heaviest dozen, and the host whatever its size.
  const pick = [...bodies].sort((a, b) => b.m - a.m).slice(0, ATTRACTORS)
  if (host && !pick.includes(host)) pick.push(host)
  const n = pick.length + 1
  const px = new Float64Array(n), py = new Float64Array(n)
  const pvx = new Float64Array(n), pvy = new Float64Array(n)
  const pm = new Float64Array(n), pr = new Float64Array(n)
  pick.forEach((b, i) => { px[i] = b.x; py[i] = b.y; pvx[i] = b.vx; pvy[i] = b.vy; pm[i] = b.m; pr[i] = b.r })
  const me = n - 1
  px[me] = x; py[me] = y; pvx[me] = vx; pvy[me] = vy; pm[me] = m; pr[me] = radiusFor(m)
  const hi = host ? pick.indexOf(host) : -1
  const ox = hi >= 0 ? host!.x : 0, oy = hi >= 0 ? host!.y : 0

  const out = new Float32Array((frames + 1) * 2)
  let k = 0
  const push = () => {
    out[k++] = hi >= 0 ? px[me] - px[hi] + ox : px[me]
    out[k++] = hi >= 0 ? py[me] - py[hi] + oy : py[me]
  }
  push()

  const ax = new Float64Array(n), ay = new Float64Array(n)
  const s2 = SOFT * SOFT, dt = 0.5, half = dt / 2
  const pad = Math.max(w, h) * 2.2
  let hit: Path['hit'] = null
  let swept = 0
  let last = hi >= 0 ? Math.atan2(py[me] - py[hi], px[me] - px[hi]) : 0
  let closed = false

  frames: for (let f = 0; f < frames; f++) {
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < n; i++) { px[i] += pvx[i] * half; py[i] += pvy[i] * half; ax[i] = 0; ay[i] = 0 }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = px[j] - px[i], dy = py[j] - py[i]
          const inv = 1 / Math.sqrt(dx * dx + dy * dy + s2)
          const q = G * inv * inv * inv
          ax[i] += q * pm[j] * dx; ay[i] += q * pm[j] * dy
          ax[j] -= q * pm[i] * dx; ay[j] -= q * pm[i] * dy
        }
      }
      for (let i = 0; i < n; i++) {
        pvx[i] += ax[i] * dt; pvy[i] += ay[i] * dt
        px[i] += pvx[i] * half; py[i] += pvy[i] * half
      }
      for (let i = 0; i < me; i++) {
        const dx = px[i] - px[me], dy = py[i] - py[me], rr = pr[i] + pr[me]
        if (dx * dx + dy * dy <= rr * rr) {
          push()
          hit = { x: out[k - 2], y: out[k - 1] }
          break frames
        }
      }
    }
    push()
    if (w && (px[me] < -pad || px[me] > w + pad || py[me] < -pad || py[me] > h + pad)) break
    if (hi >= 0) {
      const a = Math.atan2(py[me] - py[hi], px[me] - px[hi])
      let d = a - last
      if (d > Math.PI) d -= 2 * Math.PI
      else if (d < -Math.PI) d += 2 * Math.PI
      swept += d
      last = a
      // A little past a full turn, so the end of the loop visibly meets its start.
      if (Math.abs(swept) > 2 * Math.PI + 0.25) { closed = true; break }
    }
  }
  return { pts: out, n: k / 2, hit, closed }
}
