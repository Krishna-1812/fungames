/**
 * Powder's automaton, lifted out of the page so it can be run without a
 * browser.
 *
 * The rules did not change when they moved. Two things did:
 *
 *   - The grid and its companions are a `World` object rather than a set of
 *     variables closed over by the page, so a checker can hold several at
 *     once and a scenario can be rebuilt without reloading anything.
 *   - Randomness comes from `world.rand` instead of `Math.random` directly.
 *     A falling-sand simulation is chaotic enough that the same seed is the
 *     only way to assert anything about it twice, and that is what lets
 *     scripts/check-powder.mjs claim a scenario is solvable rather than hope.
 *
 * The order of the sweep matters and is deliberate. Rows run bottom to top so
 * a falling column collapses in one pass instead of one cell per frame, and
 * the horizontal direction alternates with the frame number so piles do not
 * develop a permanent lean to the left.
 */

import {
  MATERIALS, SLOTS, EMPTY, FIRE, SMOKE, STEAM, LAVA, ACID, GLASS, EMBER,
  CLOUD, SPARK, WOOD, ASH, STONE, WATER,
  type Reaction,
} from './powder-rules'

/* -------------------------------------------------------------------------- */
/* Material tables, flattened for the hot loop                                */
/* -------------------------------------------------------------------------- */

export const TYPE = new Uint8Array(SLOTS)
export const DENS = new Uint8Array(SLOTS)
export const FLAM = new Uint8Array(SLOTS)
export const LIFE0 = new Uint16Array(SLOTS)
export const PAL = new Uint8Array(SLOTS * 3)
export const VARY = new Uint8Array(SLOTS)

for (const d of MATERIALS) {
  TYPE[d.id] = d.type
  DENS[d.id] = d.density
  FLAM[d.id] = d.flammable ? 1 : 0
  LIFE0[d.id] = d.life ?? 0
  PAL[d.id * 3] = d.rgb[0]; PAL[d.id * 3 + 1] = d.rgb[1]; PAL[d.id * 3 + 2] = d.rgb[2]
  VARY[d.id] = d.vary
}
// Empty behaves like the lightest possible gas, which is what makes every
// density comparison below work without a special case for it.
DENS[EMPTY] = 1
TYPE[EMPTY] = 3

/* -------------------------------------------------------------------------- */
/* The world                                                                  */
/* -------------------------------------------------------------------------- */

export type World = {
  w: number
  h: number
  grid: Uint8Array
  life: Uint8Array
  shade: Uint8Array
  moved: Uint8Array
  frame: number
  /** Explosions during the last step, for sound and screen shake. */
  bangs: number
  rand: () => number
  /** Every reaction id that has fired in this world. */
  fired: Set<string>
  /** Ids that fired for the first time during the last step. Usually empty. */
  justFired: string[]
}

export function createWorld(w: number, h: number, rand: () => number = Math.random): World {
  return {
    w, h,
    grid: new Uint8Array(w * h),
    life: new Uint8Array(w * h),
    shade: new Uint8Array(w * h),
    moved: new Uint8Array(w * h),
    frame: 0,
    bangs: 0,
    rand,
    fired: new Set(),
    justFired: [],
  }
}

/** Empties the grid without forgetting what has been discovered. */
export function clearWorld(o: World) {
  o.grid.fill(0)
  o.life.fill(0)
  o.shade.fill(0)
  o.moved.fill(0)
  o.frame = 0
  o.bangs = 0
}

/**
 * Forget which reactions have fired, without touching the grid.
 *
 * A scenario needs to know whether its reaction fired *during the scenario*,
 * and `justFired` only reports the first firing in a world's lifetime. The
 * page's discovery log keeps its own saved set, so clearing this costs it
 * nothing.
 */
export function resetFired(o: World) {
  o.fired.clear()
  o.justFired.length = 0
}

export const inside = (o: World, x: number, y: number) =>
  x >= 0 && x < o.w && y >= 0 && y < o.h

export function put(o: World, x: number, y: number, el: number) {
  if (!inside(o, x, y)) return
  const i = y * o.w + x
  o.grid[i] = el
  o.life[i] = LIFE0[el] ? Math.min(255, LIFE0[el]) : 0
  o.shade[i] = (o.rand() * 255) | 0
}

export const at = (o: World, x: number, y: number) =>
  inside(o, x, y) ? o.grid[y * o.w + x] : EMPTY

function swap(o: World, a: number, b: number) {
  const g = o.grid[a]; o.grid[a] = o.grid[b]; o.grid[b] = g
  const l = o.life[a]; o.life[a] = o.life[b]; o.life[b] = l
  const s = o.shade[a]; o.shade[a] = o.shade[b]; o.shade[b] = s
  o.moved[a] = 1; o.moved[b] = 1
}

export function explode(o: World, x: number, y: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue
      const nx = x + dx, ny = y + dy
      if (!inside(o, nx, ny)) continue
      const g = o.grid[ny * o.w + nx]
      if (g === STONE || g === GLASS) { if (o.rand() < 0.5) put(o, nx, ny, EMPTY); continue }
      put(o, nx, ny, o.rand() < 0.75 ? FIRE : SMOKE)
    }
  }
}

/** How many cells of each material there are. Index by material id. */
export function census(o: World, out = new Uint32Array(SLOTS)): Uint32Array {
  out.fill(0)
  for (let i = 0; i < o.grid.length; i++) out[o.grid[i]]++
  return out
}

/**
 * How many cells of `el` sit inside a rectangle, in cell coordinates.
 *
 * A whole-grid census cannot express "still in the tank" — acid that has eaten
 * through the floor and run out across the world is still acid, and still
 * counted. Some goals are about *where* something is, and this is the smallest
 * addition that lets one say so.
 */
export function regionCount(
  o: World, x0: number, y0: number, x1: number, y1: number, el: number,
): number {
  let n = 0
  const ax = Math.max(0, x0 | 0), bx = Math.min(o.w, x1 | 0)
  const ay = Math.max(0, y0 | 0), by = Math.min(o.h, y1 | 0)
  for (let y = ay; y < by; y++) {
    for (let x = ax; x < bx; x++) if (o.grid[y * o.w + x] === el) n++
  }
  return n
}

export function countAlive(o: World): number {
  let n = 0
  for (let i = 0; i < o.grid.length; i++) if (o.grid[i] !== EMPTY) n++
  return n
}

/* -------------------------------------------------------------------------- */
/* The rules                                                                  */
/* -------------------------------------------------------------------------- */

const N4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const

/**
 * Returns true when the cell was consumed and must not also move.
 *
 * Pairwise reactions come from the table. Everything below them is something
 * a single cell does on its own, which is why it is not in the table and not
 * something the log asks you to find.
 */
function react(
  o: World, rx: (Reaction | undefined)[], x: number, y: number, i: number, el: number,
): boolean {
  for (const [dx, dy] of N4) {
    const nx = x + dx, ny = y + dy
    if (!inside(o, nx, ny)) continue
    const j = ny * o.w + nx
    const n = o.grid[j]
    const r = rx[el * SLOTS + n]
    if (!r || o.rand() >= r.p) continue

    // The table stores each pair once, so work out which side we are on.
    const forward = r.a === el
    const selfTo = forward ? r.a2 : r.b2
    const otherTo = forward ? r.b2 : r.a2
    if (!o.fired.has(r.id)) { o.fired.add(r.id); o.justFired.push(r.id) }

    if (r.boom) { o.bangs++; explode(o, nx, ny, r.boom); return true }
    if (otherTo !== undefined) put(o, nx, ny, otherTo)
    if (selfTo !== undefined) { put(o, x, y, selfTo); return true }
  }

  /* --- things a cell does by itself ------------------------------------- */

  if (el === FIRE || el === EMBER) {
    // Anything flammable without a named reaction of its own still catches.
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy
      if (!inside(o, nx, ny)) continue
      const n = o.grid[ny * o.w + nx]
      if (FLAM[n] && o.rand() < 0.07) put(o, nx, ny, n === WOOD ? EMBER : FIRE)
    }
    if (o.life[i] > 0) { o.life[i]--; return false }
    // An ember does not go out so much as go to ash.
    put(o, x, y, el === EMBER ? ASH : o.rand() < 0.7 ? SMOKE : EMPTY)
    return true
  }

  if (el === ACID) {
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy
      if (!inside(o, nx, ny)) continue
      const n = o.grid[ny * o.w + nx]
      // Glass is the one thing it cannot touch, which is the reason real
      // acid is sold in it.
      if (n === EMPTY || n === ACID || n === SMOKE || n === STEAM || n === GLASS) continue
      if (o.rand() < 0.14) {
        put(o, nx, ny, EMPTY)
        // Acid is spent as it eats, so a splash cannot erase the whole world.
        if (o.rand() < 0.35) { put(o, x, y, SMOKE); return true }
      }
    }
    return false
  }

  if (el === CLOUD) {
    // A cloud is a rain machine rather than a reagent.
    if (o.rand() < 0.004) {
      const ny = y + 1
      if (inside(o, x, ny) && o.grid[ny * o.w + x] === EMPTY) put(o, x, ny, WATER)
    }
    return false
  }

  if (el === SMOKE || el === STEAM) {
    if (o.life[i] > 0) { o.life[i]--; return false }
    put(o, x, y, el === STEAM && o.rand() < 0.45 ? WATER : EMPTY)
    return true
  }

  if (el === SPARK) {
    // A spark is only ever passing through.
    if (o.life[i] > 0) { o.life[i]--; return false }
    put(o, x, y, EMPTY)
    return true
  }

  return false
}

/** Advance the world one frame. */
export function step(o: World, rx: (Reaction | undefined)[]) {
  o.moved.fill(0)
  o.bangs = 0
  o.justFired.length = 0
  const W = o.w, H = o.h
  const leftFirst = (o.frame & 1) === 0

  for (let y = H - 1; y >= 0; y--) {
    for (let k = 0; k < W; k++) {
      const x = leftFirst ? k : W - 1 - k
      const i = y * W + x
      const el = o.grid[i]
      if (el === EMPTY || o.moved[i]) continue
      if (react(o, rx, x, y, i, el)) continue

      const t = TYPE[el]
      if (t === 0) continue

      if (t === 3) {
        const up = y - 1
        if (up >= 0 && o.grid[up * W + x] === EMPTY) { swap(o, i, up * W + x); continue }
        const d = o.rand() < 0.5 ? -1 : 1
        if (inside(o, x + d, y - 1) && o.grid[(y - 1) * W + x + d] === EMPTY) { swap(o, i, (y - 1) * W + x + d); continue }
        if (inside(o, x + d, y) && o.grid[y * W + x + d] === EMPTY) { swap(o, i, y * W + x + d) }
        continue
      }

      // Powders and liquids sink through anything lighter than themselves.
      const below = y + 1
      if (below < H && DENS[o.grid[below * W + x]] < DENS[el]) { swap(o, i, below * W + x); continue }

      const dir = o.rand() < 0.5 ? -1 : 1
      let slid = false
      for (const d of [dir, -dir]) {
        const nx = x + d
        if (below < H && inside(o, nx, below) && DENS[o.grid[below * W + nx]] < DENS[el]) {
          swap(o, i, below * W + nx); slid = true; break
        }
      }
      if (slid) continue

      if (t === 2) {
        // Sideways spread is what makes a liquid find its own level.
        for (const d of [dir, -dir]) {
          const nx = x + d
          if (!inside(o, nx, y)) continue
          const j = y * W + nx
          if (o.grid[j] === EMPTY || DENS[o.grid[j]] < DENS[el] - 1) { swap(o, i, j); break }
        }
      }
    }
  }
  o.frame++
}

/** A small fast PRNG, so a seeded run is reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
