/**
 * Fusion's bench: the things on it have weight.
 *
 * Every element on the board is a disc with a position, a velocity and a
 * mass, drifting without gravity over a surface with a little drag — a puck
 * on an air table. That is enough physics to change what the game feels
 * like: a token keeps moving when you let go of it, so you can flick one
 * across the board; tokens knock into each other and share momentum, heavier
 * ones moving less; a fusion pushes everything near it outwards.
 *
 * Fixed time step, semi-implicit Euler, impulses for collisions with a
 * positional correction so resting stacks do not sink into each other. A
 * token that is held is moved by the hand, not by forces — it follows the
 * pointer on a critically damped spring, so it has a real velocity when it
 * is released — and passes over the others without pushing them, because
 * otherwise you could never set one down on another.
 *
 * No DOM in here: the page moves its elements to where this says they are,
 * and scripts/check-fusion-physics.mjs runs it headless.
 */

export type Body = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  m: number
  /** Held by the pointer: kinematic, and does not collide. */
  held: boolean
  /** Hand position while held. */
  tx: number
  ty: number
  /** Seconds left in which hitting something counts as being thrown at it. */
  thrown: number
  /** Out of the simulation for a moment (mid-fusion). */
  frozen: boolean
}

export type Contact = { a: Body; b: Body; speed: number }

const STEP = 1 / 120
/** Drag: a free token loses about four fifths of its speed each second. */
const DRAG = 1.6
const RESTITUTION = 0.42
const WALL = 0.5
/** How stiffly a held token follows the hand (1/s). */
const FOLLOW = 46
/** How long after release a hit still counts as a throw. */
export const THROW_WINDOW = 1.6

export class World {
  bodies: Body[] = []
  w = 100
  h = 100
  private acc = 0
  private nextId = 1

  resize(w: number, h: number) {
    this.w = w
    this.h = h
  }

  add(x: number, y: number, r: number, m = 1): Body {
    const b: Body = { id: this.nextId++, x, y, vx: 0, vy: 0, r, m, held: false, tx: x, ty: y, thrown: 0, frozen: false }
    this.bodies.push(b)
    return b
  }

  remove(b: Body) {
    const i = this.bodies.indexOf(b)
    if (i >= 0) this.bodies.splice(i, 1)
  }

  grab(b: Body, x: number, y: number) {
    b.held = true
    b.thrown = 0
    b.tx = x
    b.ty = y
  }

  /** Let go: it keeps the velocity the hand gave it, and counts as thrown. */
  release(b: Body) {
    b.held = false
    b.thrown = Math.hypot(b.vx, b.vy) > 140 ? THROW_WINDOW : 0
  }

  /** A push outwards from a point: what a fusion does to its neighbours. */
  blast(x: number, y: number, strength: number, radius: number, except?: Body) {
    for (const b of this.bodies) {
      if (b === except || b.held || b.frozen) continue
      const dx = b.x - x, dy = b.y - y
      const d = Math.hypot(dx, dy)
      if (d > radius || d < 1e-3) continue
      const k = (strength * (1 - d / radius)) / (b.m * d)
      b.vx += dx * k
      b.vy += dy * k
    }
  }

  /** The body under a point, topmost (latest) first. */
  at(x: number, y: number): Body | null {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i]
      if (!b.frozen && Math.hypot(b.x - x, b.y - y) <= b.r) return b
    }
    return null
  }

  /** The body another is resting over closely enough to be "on" it. */
  under(b: Body): Body | null {
    let best: Body | null = null, bestD = Infinity
    for (const o of this.bodies) {
      if (o === b || o.frozen) continue
      const d = Math.hypot(o.x - b.x, o.y - b.y)
      if (d < (o.r + b.r) * 0.62 && d < bestD) { best = o; bestD = d }
    }
    return best
  }

  /** The nearest other body and its distance, for the field's filament. */
  nearest(b: Body): { body: Body; d: number } | null {
    let best: Body | null = null, bestD = Infinity
    for (const o of this.bodies) {
      if (o === b || o.frozen) continue
      const d = Math.hypot(o.x - b.x, o.y - b.y)
      if (d < bestD) { best = o; bestD = d }
    }
    return best ? { body: best, d: bestD } : null
  }

  /** Total kinetic energy, for the checker. */
  energy() {
    let e = 0
    for (const b of this.bodies) e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy)
    return e
  }

  /** Advance by dt seconds of real time; returns the hits that happened. */
  advance(dt: number): Contact[] {
    const hits: Contact[] = []
    this.acc += Math.min(dt, 0.1)
    while (this.acc >= STEP) {
      this.acc -= STEP
      this.step(STEP, hits)
    }
    return hits
  }

  private step(dt: number, hits: Contact[]) {
    const drag = Math.exp(-DRAG * dt)
    for (const b of this.bodies) {
      if (b.frozen) continue
      if (b.held) {
        // Critically damped towards the hand: no overshoot, a true velocity.
        const ax = (b.tx - b.x) * FOLLOW * FOLLOW * 0.25 - b.vx * FOLLOW
        const ay = (b.ty - b.y) * FOLLOW * FOLLOW * 0.25 - b.vy * FOLLOW
        b.vx += ax * dt
        b.vy += ay * dt
      } else {
        b.vx *= drag
        b.vy *= drag
        if (b.thrown > 0) b.thrown -= dt
      }
      b.x += b.vx * dt
      b.y += b.vy * dt
      // The board's edges.
      if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * WALL }
      if (b.x > this.w - b.r) { b.x = this.w - b.r; if (b.vx > 0) b.vx = -b.vx * WALL }
      if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy = -b.vy * WALL }
      if (b.y > this.h - b.r) { b.y = this.h - b.r; if (b.vy > 0) b.vy = -b.vy * WALL }
    }
    const n = this.bodies.length
    for (let i = 0; i < n; i++) {
      const a = this.bodies[i]
      if (a.held || a.frozen) continue
      for (let j = i + 1; j < n; j++) {
        const b = this.bodies[j]
        if (b.held || b.frozen) continue
        let dx = b.x - a.x, dy = b.y - a.y
        const min = a.r + b.r
        let d2 = dx * dx + dy * dy
        if (d2 >= min * min) continue
        if (d2 < 1e-6) { dx = 0.01 * (i - j); dy = 0.013; d2 = dx * dx + dy * dy }
        const d = Math.sqrt(d2)
        const nx = dx / d, ny = dy / d
        const ia = 1 / a.m, ib = 1 / b.m
        // Push them apart, each by its share.
        const push = (min - d) / (ia + ib)
        a.x -= nx * push * ia; a.y -= ny * push * ia
        b.x += nx * push * ib; b.y += ny * push * ib
        // And exchange momentum along the line between them.
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rel < 0) {
          const jn = (-(1 + RESTITUTION) * rel) / (ia + ib)
          a.vx -= jn * nx * ia; a.vy -= jn * ny * ia
          b.vx += jn * nx * ib; b.vy += jn * ny * ib
          if (-rel > 30) hits.push({ a, b, speed: -rel })
        }
      }
    }
  }
}
