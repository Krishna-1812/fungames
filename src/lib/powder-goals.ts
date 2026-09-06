/**
 * Powder's eight scenarios.
 *
 * The sandbox already had something to find — forty-eight reactions and a log
 * counting them — but nothing to *do*. These are the something to do.
 *
 * ## Why scenarios rather than achievements
 *
 * Orbit's challenges are all statements about one trajectory, which is why
 * they were straightforward to define. A cellular automaton has no trajectory:
 * the state is a whole grid, and almost every interesting sentence about one
 * ("you built a dam") is not decidable from a census.
 *
 * So these do not try. Each hands you a starting grid, takes away most of the
 * palette, and asks for a number a census can answer: this much glass, no
 * plants left, the barrel gone. The puzzle is in the setup and the
 * restriction, not in the predicate. That also makes them checkable —
 * scripts/check-powder.mjs plays every one to completion against a seeded
 * random source, and separately checks that leaving it alone never finishes
 * it, so none can be passed by waiting.
 *
 * ## The mask
 *
 * One of them restricts where you may draw. Without that, "set off the barrel
 * without going near it" is solved by drawing a spark on the barrel and the
 * wire is scenery.
 *
 * ## Coordinates
 *
 * Setups are written in fractions of the grid, because the grid is whatever
 * fits the window — anywhere from 80×60 on a phone to 340×250 on a desktop.
 * A scenario laid out in cells would be a different puzzle on every screen,
 * and the targets scale with the area for the same reason.
 */

import {
  SAND, WATER, STONE, WOOD, FIRE, LAVA, PLANT, ACID, GLASS,
  EMBER, SALT, DIRT, SEED, METAL, SPARK, POWDER, THERMITE,
} from './powder-rules'
import { type World, put, census, regionCount, resetFired } from './powder-sim'

/** Numbers a scenario works out from the grid it just painted. */
export type Targets = Record<string, number>

export type Stats = {
  /** Frames since the scenario was loaded. */
  frames: number
  /** Census when it was loaded, for goals phrased against the starting state. */
  start: Uint32Array
  /** Highest each material has reached since. */
  peak: Uint32Array
  /** Reaction ids that have fired since. */
  fired: Set<string>
  /** Whatever `setup` worked out, so `done` does not have to guess. */
  target: Targets
  /** Cells painted so far, against the scenario's budget. */
  spent: number
}

export type Scenario = {
  id: string
  name: string
  /** The task, in one line, shown while you play. */
  brief: string
  /** Why it works, shown once it is done. */
  note: string
  /** The only materials the palette offers. */
  palette: number[]
  /**
   * Cells of material you are allowed to paint, in total.
   *
   * This is what makes a scenario a puzzle rather than a chore. The checker
   * found the first draft of "turn the sand into glass" solved at frame eight,
   * because paint was free and the answer was to scribble lava everywhere. A
   * budget means you have to let the lava sink and do the work instead.
   */
  budget: number
  /** Paints the starting grid and returns the numbers it implies. */
  setup: (o: World) => Targets
  /**
   * The rightmost column you may draw in, as a fraction of the width.
   * Undefined means anywhere.
   */
  drawTo?: number
  /**
   * True when it is solved.
   *
   * Gets the world as well as the census, because not every goal is a global
   * count. "Keep the acid in the tank" cannot be asked of a census at all —
   * acid that has eaten through the floor and run across the world is still
   * acid, and still counted — so that one asks how much is inside a rectangle.
   */
  done: (c: Uint32Array, s: Stats, o: World) => boolean
  /** The live line under the brief. */
  progress: (c: Uint32Array, s: Stats, o: World) => string
}

/* -------------------------------------------------------------------------- */
/* Painting helpers, in fractions of the grid                                 */
/* -------------------------------------------------------------------------- */

const px = (o: World, fx: number) => Math.round(fx * o.w)
const py = (o: World, fy: number) => Math.round(fy * o.h)

/** A filled rectangle, corners given as fractions of the grid. */
function rect(o: World, x0: number, y0: number, x1: number, y1: number, el: number) {
  for (let y = py(o, y0); y < py(o, y1); y++) {
    for (let x = px(o, x0); x < px(o, x1); x++) put(o, x, y, el)
  }
}

/** An open-topped box: a floor and two walls, `t` cells thick. */
function basin(o: World, x0: number, y0: number, x1: number, y1: number, el: number, t = 2) {
  const ax = px(o, x0), bx = px(o, x1), ay = py(o, y0), by = py(o, y1)
  for (let y = by - t; y < by; y++) for (let x = ax; x < bx; x++) put(o, x, y, el)
  for (let y = ay; y < by; y++) {
    for (let x = ax; x < ax + t; x++) put(o, x, y, el)
    for (let x = bx - t; x < bx; x++) put(o, x, y, el)
  }
}

/** How much acid is still inside the tank the acid scenario drew. */
const inTank = (o: World, s: Stats) =>
  regionCount(o, s.target.zx0, s.target.zy0, s.target.zx1, s.target.zy1, ACID)

/** A target as a share of the whole grid, so it means the same on any screen. */
const share = (o: World, f: number) => Math.max(20, Math.round(o.w * o.h * f))

/* -------------------------------------------------------------------------- */

export const SCENARIOS: Scenario[] = [
  {
    id: 'glass',
    name: 'Glassblower',
    brief: 'Turn the sand bed into glass. This much lava, no more.',
    note: 'Sand plus enough heat is glass, and lava is denser than sand, so it sinks in and works from the inside — until it wraps itself in glass and stops. Spread over the whole bed the same lava makes well over twice as much glass as it does dumped in a heap.',
    palette: [LAVA],
    budget: 2500,
    setup(o) {
      rect(o, 0, 0.62, 1, 1, SAND)
      return { glass: Math.round(census(o)[SAND] * 0.18) }
    },
    done: (c, s) => c[GLASS] >= s.target.glass,
    progress: (c, s) => `${c[GLASS]} of ${s.target.glass} glass`,
  },
  {
    id: 'island',
    name: 'New island',
    brief: 'Make land out of open sea.',
    note: 'Quenched lava is how every real island got here, and the steam coming off it is the sea you spent making the land.',
    palette: [LAVA],
    budget: 3500,
    setup(o) {
      rect(o, 0, 0.45, 1, 1, WATER)
      return { stone: share(o, 0.025) }
    },
    done: (c, s) => c[STONE] >= s.target.stone,
    progress: (c, s) => `${c[STONE]} of ${s.target.stone} stone`,
  },
  {
    id: 'house',
    name: 'Save the house',
    brief: 'Set it alight, then put it out with most of it still standing.',
    note: 'Flames are the easy part. Embers are what actually eat a building — they barely glow, they spread through timber without ever making a flame, and water is the only thing here that stops one.',
    palette: [FIRE, WATER],
    budget: 4500,
    setup(o) {
      rect(o, 0, 0.92, 1, 1, STONE)
      // No roof. A closed one sheds every drop you pour and the fire inside
      // cannot be reached at all, which is not a puzzle, it is a trick.
      rect(o, 0.26, 0.46, 0.32, 0.92, WOOD)
      rect(o, 0.68, 0.46, 0.74, 0.92, WOOD)
      rect(o, 0.26, 0.62, 0.74, 0.67, WOOD)
      rect(o, 0.26, 0.86, 0.74, 0.91, WOOD)
      return { wood: Math.round(census(o)[WOOD] * 0.45), alight: 25 }
    },
    done: (c, s) =>
      s.peak[FIRE] >= s.target.alight &&
      c[FIRE] === 0 && c[EMBER] === 0 &&
      c[WOOD] >= s.target.wood,
    progress: (c, s) =>
      s.peak[FIRE] < s.target.alight
        ? `light it — ${s.peak[FIRE]} of ${s.target.alight} alight at once`
        : `${c[FIRE] + c[EMBER]} still burning · ${c[WOOD]} of ${s.target.wood} timber left`,
  },
  {
    id: 'forest',
    name: 'Green it up',
    brief: 'Grow a forest on bare dirt.',
    note: 'Dirt and water make mud, and a seed in mud sprouts three times faster than a seed in plain water. After that the plants drink and spread on their own, which is the only reason the budget stretches.',
    palette: [WATER, SEED],
    budget: 6000,
    setup(o) {
      rect(o, 0, 0.7, 1, 1, DIRT)
      return { plant: share(o, 0.02) }
    },
    done: (c, s) => c[PLANT] >= s.target.plant,
    progress: (c, s) => `${c[PLANT]} of ${s.target.plant} plant`,
  },
  {
    id: 'salt',
    name: 'Salt the earth',
    brief: 'Wipe out the field. Salt only — you may not burn it.',
    note: 'Salting a field is a real thing people did, and it works because salt does not wash out the way ash does. It only gets down there at all because the growth is patchy — salt is a powder, and a powder sinks only into something lighter than itself. A solid hedge shrugs it off entirely, and the last stubborn fifth is salt sitting on the dirt it has already made.',
    palette: [SALT],
    budget: 9000,
    setup(o) {
      rect(o, 0, 0.78, 1, 1, DIRT)
      // Patchy on purpose. A solid block of plant is denser than salt and
      // static, so nothing could ever get below the top row of it.
      const y0 = py(o, 0.5), y1 = py(o, 0.78)
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < o.w; x++) if (o.rand() < 0.36) put(o, x, y, PLANT)
      }
      const start = census(o)[PLANT]
      return { plant: start, left: Math.max(4, Math.round(start * 0.2)) }
    },
    done: (c, s) => c[PLANT] <= s.target.left,
    progress: (c, s) => `${c[PLANT]} plants left, needs ${s.target.left} or fewer`,
  },
  {
    id: 'wire',
    name: 'Wire it up',
    brief: 'Set off the barrel without going anywhere near it.',
    note: 'A spark runs through metal as far as you laid the wire, and eats the wire behind it. This is a detonator, and it is why charges are wired rather than lit.',
    palette: [SPARK],
    budget: 80,
    // Everything past the first fifth is out of reach, or the wire is scenery.
    drawTo: 0.2,
    setup(o) {
      rect(o, 0, 0.92, 1, 1, STONE)
      // A stone bunker around the charge, on the far side.
      rect(o, 0.72, 0.62, 0.78, 0.92, STONE)
      rect(o, 0.72, 0.62, 1, 0.66, STONE)
      rect(o, 0.8, 0.7, 0.96, 0.92, POWDER)
      // The wire, laid after the bunker so it passes through the wall.
      rect(o, 0.06, 0.3, 0.1, 0.88, METAL)
      rect(o, 0.06, 0.86, 0.86, 0.9, METAL)
      rect(o, 0.82, 0.7, 0.86, 0.9, METAL)
      return {}
    },
    done: (_c, s) => s.fired.has('spark-powder'),
    progress: (c, s) =>
      s.fired.has('spark-metal')
        ? `the wire is live · ${c[POWDER]} gunpowder left`
        : 'put a spark on the wire',
  },
  {
    id: 'acid',
    name: 'Hold the acid',
    brief: 'Keep the acid in the tank. It is already eating its way out.',
    note: 'Acid does not touch glass. That is not a game rule — it is why the stuff is sold in glass bottles, and why the tank you were given is the wrong material. Left in stone it is gone in five seconds.',
    palette: [GLASS],
    budget: 1600,
    setup(o) {
      rect(o, 0, 0.95, 1, 1, STONE)
      basin(o, 0.32, 0.34, 0.68, 0.95, STONE, 2)
      rect(o, 0.35, 0.42, 0.65, 0.93, ACID)
      const zone = [px(o, 0.32), py(o, 0.34), px(o, 0.68), py(o, 0.95)]
      const held = regionCount(o, zone[0], zone[1], zone[2], zone[3], ACID)
      return {
        zx0: zone[0], zy0: zone[1], zx1: zone[2], zy1: zone[3],
        acid: Math.round(held * 0.8), frames: 900,
      }
    },
    done: (_c, s, o) =>
      s.frames >= s.target.frames && inTank(o, s) >= s.target.acid,
    progress: (_c, s, o) => {
      const held = inTank(o, s)
      return held < s.target.acid
        ? `too much has got out — ${held} in the tank, needs ${s.target.acid}`
        : `${held} held · ${Math.max(0, s.target.frames - s.frames)} frames to go`
    },
  },
  {
    id: 'cut',
    name: 'Cut through',
    brief: 'Get through the steel plate. Thermite and a spark.',
    note: 'Thermite does not burn so much as become lava, and lava melts steel into more lava. It is how you cut a plate you cannot get a saw behind — and the spark has to go into the pile, because a spark is a gas and rises away from anything you drop it above.',
    palette: [THERMITE, SPARK],
    budget: 1800,
    setup(o) {
      rect(o, 0, 0.55, 1, 0.62, METAL)
      rect(o, 0, 0.97, 1, 1, STONE)
      return { gone: Math.round(census(o)[METAL] * 0.25) }
    },
    done: (c, s) => s.start[METAL] - c[METAL] >= s.target.gone,
    progress: (c, s) => `${Math.max(0, s.start[METAL] - c[METAL])} of ${s.target.gone} steel gone`,
  },
]

export const SCENARIO_IDS = SCENARIOS.map((s) => s.id)
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id)

/* -------------------------------------------------------------------------- */
/* Running tally                                                              */
/* -------------------------------------------------------------------------- */

/** Set the world up for a scenario and start counting. */
export function begin(o: World, sc: Scenario): Stats {
  resetFired(o)
  const target = sc.setup(o)
  const c = census(o)
  return { frames: 0, start: c, peak: c.slice(), fired: new Set(), target, spent: 0 }
}

/**
 * Paint one cell, if the scenario allows it. Returns false when it was
 * refused, which is either the budget running out or the cell being outside
 * the region this scenario lets you reach.
 */
export function paintCell(
  o: World, s: Stats, sc: Scenario | null, x: number, y: number, el: number,
): boolean {
  if (sc) {
    if (s.spent >= sc.budget) return false
    if (sc.drawTo !== undefined && x > sc.drawTo * o.w) return false
  }
  put(o, x, y, el)
  if (sc) s.spent++
  return true
}

/** How much paint is left, for the readout. */
export const budgetLeft = (sc: Scenario, s: Stats) => Math.max(0, sc.budget - s.spent)

/**
 * Cheap, and must run every frame: `justFired` is emptied by the next step, so
 * sampling it on census frames only would quietly lose reactions — which for
 * the wire scenario is the entire win condition.
 */
export function tickStats(o: World, s: Stats) {
  s.frames++
  for (const id of o.justFired) s.fired.add(id)
}

/** Expensive, and only needs the occasional frame. */
export function foldCensus(s: Stats, c: Uint32Array) {
  for (let i = 0; i < c.length; i++) if (c[i] > s.peak[i]) s.peak[i] = c[i]
}
