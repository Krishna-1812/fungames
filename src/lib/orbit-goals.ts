/**
 * Orbit's eight challenges.
 *
 * The sandbox was the whole game: a beautiful n-body simulation with nothing to
 * reach for. These give it something. The rule they are all written to is that
 * a challenge has to be a real statement about orbital mechanics, decidable
 * from the trajectory alone — not "stay on screen for a while".
 *
 * ## What each one actually measures
 *
 * Laps are counted by accumulating the *signed* angle a body sweeps about the
 * heaviest body. A lap is 2π of it. This is deliberately not "did it return to
 * roughly where it started": a body drifting past on a straight line returns to
 * the same angle twice and never sweeps anything, and a body on a precessing
 * orbit never returns to the same point at all but is unarguably in orbit.
 *
 * Within a lap the smallest and largest separations are the periapsis and
 * apoapsis, so their ratio is the shape of the orbit. For a Kepler ellipse it
 * is exactly (1+e)/(1−e), which is where the thresholds come from: a ratio of
 * 1.25 is e ≈ 0.11, and 5 is e ≈ 0.67. The field here is softened rather than
 * inverse-square (see orbit-sim.ts) so those are close rather than exact, but
 * the ratio is measured, not inferred, and it means the same thing either way.
 *
 * "Bound" is the sign of a body's energy relative to the system's centre of
 * mass. Bound then unbound is the whole of the slingshot: a two-body encounter
 * cannot change a body's energy, so the only way out is to take some from a
 * third body that is moving. That is a real gravity assist and nothing else
 * satisfies it.
 *
 * ## What is deliberately not here
 *
 * A moon orbiting a planet orbiting the star. It reads well and it cannot be
 * done: the softening length is 26, and the stable satellite zone around a
 * planet of any mass this game offers is entirely inside that radius, where
 * the force has been flattened away. Checked before it was written rather
 * than after.
 *
 * Most challenges require a body *you launched*. Otherwise pressing "Solar
 * system" completes the first one four seconds later, and pressing "Binary"
 * completes the binary, which is not a game.
 */

import {
  type Body, type StepEvents, STAR_MASS, barycentre, bodyEnergy, relEnergy, heaviest,
} from './orbit-sim'

export type Goal = {
  id: string
  name: string
  /** What you have to do, in one line, on the panel. */
  brief: string
  /** The physics, shown once you have done it. */
  note: string
}

export const GOALS: Goal[] = [
  {
    id: 'orbit',
    name: 'First orbit',
    brief: 'Fling something all the way around the heaviest body',
    note: 'Aim across the star, not at it. An orbit is a fall that keeps missing.',
  },
  {
    id: 'circle',
    name: 'Round trip',
    brief: 'Complete a lap that stays almost circular',
    note: 'Furthest point within a quarter of the closest — an eccentricity under 0.11. There is exactly one speed that does this at any given distance.',
  },
  {
    id: 'comet',
    name: 'Long-period comet',
    brief: 'Complete a lap that goes at least five times further out than in',
    note: 'Eccentricity above 0.67. Halley reaches 0.97, which is why you see it twice a century rather than twice a year.',
  },
  {
    id: 'graze',
    name: 'Grazing pass',
    brief: 'Complete a lap that passes within twice your crash distance',
    note: 'Periapsis inside two body-radii of contact. Fastest point of the whole orbit, and the one the Parker Solar Probe was built for.',
  },
  {
    id: 'binary',
    name: 'Binary star',
    brief: 'Have two stars of similar mass, one of them yours, orbit each other',
    note: 'Neither one is the centre. Both fall around a barycentre out in open space between them, which is what separates a binary from a star with something going round it — and it is how most of the stars you can see are arranged.',
  },
  {
    id: 'slingshot',
    name: 'Slingshot',
    brief: 'Get a captured body of yours thrown out of the system entirely',
    note: 'It has to be bound first, and go half way round. Two bodies alone cannot do this — the energy has to come from a third one that is moving. Voyager 2 left on Jupiter’s.',
  },
  {
    id: 'laps',
    name: 'Ten laps',
    brief: 'Keep one body of yours going round ten times',
    note: 'One lap can be luck. Ten means the orbit is closed and nothing has perturbed it — and a tighter orbit gets you there sooner, because the period grows faster than the radius does.',
  },
  {
    id: 'collapse',
    name: 'Last one standing',
    brief: 'Collapse everything into a single body of 3,000',
    note: 'Every merge conserves momentum, so the survivor inherits the drift of everything it ate.',
  },
]

export const GOAL_IDS = GOALS.map((g) => g.id)

/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2
/** Wrap into (−π, π] so a step across the ±π seam does not read as a full lap. */
const wrap = (a: number) => {
  const x = (((a + Math.PI) % TAU) + TAU) % TAU
  return x - Math.PI
}

/** Ratio of apoapsis to periapsis for a near-circular lap. e ≈ 0.11. */
const CIRCLE_RATIO = 1.25
/** ...and for a comet. e ≈ 0.67. */
const COMET_RATIO = 5
/** Periapsis, as a multiple of the distance at which the two would merge. */
const GRAZE_RATIO = 2
/** Heaviest to lightest, for two stars to count as a pair rather than a
 *  star and its satellite. There is no hard line in astronomy; there has to
 *  be one here. */
const BINARY_RATIO = 4
/**
 * Laps by a single body, for the endurance challenge.
 *
 * This replaced "twelve bodies, twenty seconds, no collisions", which the
 * checker showed was not a fair thing to ask for. Bodies here are heavy
 * relative to their star — a moon is 1/433 of it, where Jupiter is 1/1047 and
 * Earth 1/333,000 — so neighbouring orbits sit one or two mutual Hill radii
 * apart where roughly ten are wanted for long-term stability. Whether a given
 * crowd survives turns out to be sharply non-monotonic in the body count:
 * twelve held, eleven did not, fourteen did not. That is real chaos rather
 * than a bug, but a challenge you pass by luck is not a challenge, so this
 * asks about one orbit instead.
 */
const ENDURANCE_LAPS = 10
const COLLAPSE_MASS = 3000

type Track = {
  id: string
  mine: boolean
  /** Angle about the primary, last frame. */
  angle: number
  /** Signed radians swept about the primary since the track began. */
  swept: number
  /** Value of `swept` when the current lap window opened. */
  lapOpened: number
  rmin: number
  rmax: number
  laps: number
  /** Radians swept while bound to the system — the setup for a slingshot. */
  boundSwept: number
}

type Pair = { angle: number; swept: number; seen: boolean }

export type Progress = {
  /** Goal ids completed, in the order they fell. */
  done: string[]
  /** Most laps one body of yours has managed in a single life. */
  bestLaps: number
}

/**
 * Watches a running simulation and reports challenges as they are completed.
 *
 * Fed one call per rendered frame, with whatever the physics step reported.
 * Holds no DOM and no timers, which is the only reason the checker can drive
 * ten thousand frames of it in a fraction of a second.
 */
export class Tracker {
  done = new Set<string>()
  bestLaps = 0

  private tracks = new Map<number, Track>()
  private pairs = new Map<string, Pair>()
  private primaryId = -1
  merges = 0

  /** Wipes trajectory state. Completed challenges survive; a run does not. */
  reset() {
    this.tracks.clear()
    this.pairs.clear()
    this.primaryId = -1
    this.merges = 0
  }

  /** Everything already earned, for restoring a saved session. */
  load(p: Partial<Progress>) {
    for (const id of p.done ?? []) if (GOAL_IDS.includes(id)) this.done.add(id)
    this.bestLaps = Math.max(this.bestLaps, p.bestLaps ?? 0)
  }

  progress(): Progress {
    return { done: [...this.done], bestLaps: this.bestLaps }
  }

  private win(id: string, out: string[]) {
    if (this.done.has(id)) return
    this.done.add(id)
    out.push(id)
  }

  /**
   * Take one look at the running system and return any challenges completed
   * since the last look. Called once per rendered frame.
   */
  observe(bodies: Body[], ev: StepEvents): string[] {
    const won: string[] = []

    if (ev.merges.length) this.merges += ev.merges.length

    const primary = heaviest(bodies)
    if (!primary) {
      this.tracks.clear()
      this.pairs.clear()
      return won
    }

    // A new primary means every lap so far was measured about something else.
    if (primary.id !== this.primaryId) {
      this.primaryId = primary.id
      this.tracks.clear()
      this.pairs.clear()
    }

    const com = barycentre(bodies)
    const seen = new Set<number>()

    for (const b of bodies) {
      if (b.id === primary.id) continue
      seen.add(b.id)

      const dx = b.x - primary.x, dy = b.y - primary.y
      const r = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)

      let t = this.tracks.get(b.id)
      if (!t) {
        t = {
          id: String(b.id), mine: b.mine, angle, swept: 0, lapOpened: 0,
          rmin: r, rmax: r, laps: 0, boundSwept: 0,
        }
        this.tracks.set(b.id, t)
        continue
      }

      const d = wrap(angle - t.angle)
      t.angle = angle
      t.swept += d
      t.mine = b.mine
      if (r < t.rmin) t.rmin = r
      if (r > t.rmax) t.rmax = r

      if (bodyEnergy(b, bodies, com) < 0) t.boundSwept += Math.abs(d)

      if (Math.abs(t.swept - t.lapOpened) >= TAU) {
        t.laps++
        if (t.mine) {
          this.bestLaps = Math.max(this.bestLaps, t.laps)
          this.win('orbit', won)
          if (t.laps >= ENDURANCE_LAPS) this.win('laps', won)
          const shape = t.rmax / Math.max(t.rmin, 1e-9)
          if (shape <= CIRCLE_RATIO) this.win('circle', won)
          if (shape >= COMET_RATIO) this.win('comet', won)
          if (t.rmin <= GRAZE_RATIO * (primary.r + b.r)) this.win('graze', won)
        }
        // Open a fresh window. Carrying the extremes over would let one wide
        // early pass mark every later lap as a comet.
        t.lapOpened = t.swept
        t.rmin = r
        t.rmax = r
      }
    }

    // A slingshot is a body that was bound, went round, and then left. This
    // has to be read before the prune below: an escaped body is already gone
    // from `bodies`, so its track is about to be deleted as unseen, taking the
    // evidence with it.
    for (const b of ev.escaped) {
      if (!b.mine) continue
      const t = this.tracks.get(b.id)
      // Half a lap while bound. Anything less is a body that was merely
      // passing through, which is not a capture and not an assist.
      if (t && t.boundSwept >= Math.PI && bodyEnergy(b, bodies) > 0) {
        this.win('slingshot', won)
      }
    }

    for (const id of this.tracks.keys()) if (!seen.has(id)) this.tracks.delete(id)

    this.checkBinary(bodies, won)

    if (bodies.length === 1 && bodies[0].m >= COLLAPSE_MASS) this.win('collapse', won)

    return won
  }

  /**
   * Two stars going round each other rather than round anything else.
   *
   * Mutually nearest is not enough on its own, and the checker caught it: a
   * 400 orbiting a 3000 is that star's nearest neighbour and sweeps a clean 2π
   * about it, which is a satellite and not a binary. Two more conditions,
   * both of them how the distinction is actually drawn:
   *
   *   - Comparable masses, within four to one.
   *   - The centre of mass falls *outside* the larger star. This is the
   *     Pluto–Charon argument. If the barycentre is buried inside the bigger
   *     body then the small one is going round it; if it is out in open space
   *     then both of them are going round nothing.
   */
  private checkBinary(bodies: Body[], won: string[]) {
    // The heaviest body is allowed to be half of the pair. A binary is two
    // stars orbiting nothing else, so one of them is necessarily the heaviest
    // thing present, and excluding it would make the goal unwinnable.
    const list = bodies.filter((b) => b.m >= STAR_MASS)

    for (const p of this.pairs.values()) p.seen = false

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]
        if (!a.mine && !b.mine) continue
        if (relEnergy(b, a) >= 0) continue
        if (nearestStar(a, list) !== b || nearestStar(b, list) !== a) continue

        const big = a.m >= b.m ? a : b
        const small = big === a ? b : a
        if (big.m / small.m > BINARY_RATIO) continue
        const sep = Math.hypot(b.x - a.x, b.y - a.y)
        if ((sep * small.m) / (a.m + b.m) <= big.r) continue

        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        const p = this.pairs.get(key)
        if (!p) {
          this.pairs.set(key, { angle, swept: 0, seen: true })
          continue
        }
        p.swept += wrap(angle - p.angle)
        p.angle = angle
        p.seen = true
        if (Math.abs(p.swept) >= TAU) this.win('binary', won)
      }
    }

    // A pair that stops qualifying loses its progress. Half a revolution, a
    // hundred frames apart with an unbound gap in between, is not one orbit.
    for (const [k, p] of this.pairs) if (!p.seen) this.pairs.delete(k)
  }
}

function nearestStar(of: Body, list: Body[]): Body | null {
  let best: Body | null = null
  let bd = Infinity
  for (const o of list) {
    if (o === of) continue
    const d = (o.x - of.x) ** 2 + (o.y - of.y) ** 2
    if (d < bd) { bd = d; best = o }
  }
  return best
}
