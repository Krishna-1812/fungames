/** Every game's building, by slug. check-island proves there is one per listed game. */
import type { Landmark } from './kit'
import { peaks } from './lm-peaks'
import { badlands } from './lm-badlands'
import { harbour } from './lm-harbour'
import { market } from './lm-market'
import { funfair } from './lm-funfair'
import { town } from './lm-town'
import { proving } from './lm-proving'

export const LANDMARKS: Record<string, Landmark> = { ...peaks, ...badlands, ...proving, ...harbour, ...funfair, ...market, ...town }

export type DistrictKey = 'peaks' | 'badlands' | 'proving' | 'harbour' | 'funfair' | 'market' | 'oldtown'

export type District = {
  key: DistrictKey; name: string; at: [number, number]; r: number; ground: [string, string]; tint: string
  /**
   * Where its name is lettered on the live map (tile i, j, height): on open ground in front of its hero, not over
   * its roof. Unset, 1.2 tiles in front of its middle, on the ground (world.ts labels).
   */
  label?: [number, number, number]
}

/** Seven districts, each where its games belong: space up high, the sea at the front. */
export const DISTRICTS: District[] = [
  { key: 'peaks', name: 'Sky Peaks', at: [6.6, 6.6], r: 6.2, ground: ['#62a95b', '#6cb162'], tint: '#c9f7ea', label: [10.6, 6.2, 24] },
  { key: 'badlands', name: 'The Badlands', at: [23.6, 5.4], r: 5.0, ground: ['#d1c7b4', '#c8bda8'], tint: '#e6e1f7' },
  { key: 'proving', name: 'Proving Grounds', at: [24, 14.6], r: 4.6, ground: ['#6aaf5a', '#74b763'], tint: '#cff6ea' },
  { key: 'harbour', name: 'The Harbour', at: [22.4, 22.6], r: 4.4, ground: ['#6cb65c', '#78bd66'], tint: '#d6ecff', label: [24.6, 19.2, 0] },
  { key: 'funfair', name: 'The Funfair', at: [13.8, 24.6], r: 4.8, ground: ['#6cb65c', '#78bd66'], tint: '#ffe1e8', label: [16.4, 23.2, 0] },
  { key: 'market', name: 'Market Street', at: [5.6, 21.6], r: 5.0, ground: ['#6cb65c', '#78bd66'], tint: '#d9f3f0' },
  { key: 'oldtown', name: 'Old Town', at: [14.6, 14.6], r: 6.3, ground: ['#6cb65c', '#78bd66'], tint: '#e3e9ff' },
]

/* ---- the island's shape ---------------------------------------------------- */
/**
 * The island, a letter a tile (rows are i, columns j; the back is the top
 * left, the front the bottom right): the district whose ground it is, or water.
 * Sky Peaks rises to two summits at the back, falling in cliffs into the fjord
 * that cuts in between it and the Badlands; a lake lies at its foot, with Old
 * Town round it; Market Street's headland keeps a cove behind a sand spit; the
 * Funfair looks out over the west; and the Harbour wraps round its own bay,
 * a breakwater out along its far side.
 */
const MAP = `..............................
...PPPPP.......M..............
..PPPPPPPP....MMMMM.......MM..
.PPPPPPPPPP...MMMMMMM....MMM..
.PPPPPPPPPP..MMMMMMMMMMMMMM...
.PPPPPPPPPPP.MMMMMMMMMMMMM....
.PPPPPPPPPPPPMMMMMMMMMMMMM....
..PPPPPPPPPPOOMMMMMMMMMMMM....
..PPPPPPPPPOOOOOMMMMMMMMMF....
..PPPPPPPP.OOOOOOOMMMMMFFFF...
...PPPPPP.O.OOOOOOOMMFFFFFF...
...PPPPPP...OOOOOOOOFFFFFFFF..
....PPPPP..OOOOOOOOOFFFFFFFF..
.....PPPOOOOOOOOOOOOFFFFFFFF..
.........OOOOOOOOOOOFFFFFFFFF.
.........OOOOOOOOOOOFFFFFFFF..
....BBB..OOOOOOOOOOOOFFFFF....
..BBBBBB.OOOOOOOOOOOOFFFF.....
.BBBBBBBBOOOOOOOOOOOOHHF......
.BBBBBBBBBRRRROOOOOOHHHHH.....
.BBBBBBBBBRRRRRRROOHHHHHHH....
.BBBBBBBBBRRRRRRRRHHHHHHHHH...
..BBBBBBBBRRRRRRRRHHH....HHH..
..BBBBBBBBRRRRRRRRHH......HH..
...BBBBBBBRRRRRRRRHH......HH..
....BBBBBBRRRRRRRRHH......HH..
.....BBBB.RRRRRRRHHHH...HHHH..
...........RRRRRHHHHH...HHH...
.............RRRH.............
..............................`.split(/\r?\n/)
const LETTER: Record<string, DistrictKey> = { P: 'peaks', B: 'badlands', R: 'proving', H: 'harbour', F: 'funfair', M: 'market', O: 'oldtown' }
/** The mountain's tops: where, and how many terraces up (twelve units a terrace). */
export const SUMMITS: [number, number, number][] = [[4.4, 5.0, 6], [2.4, 8.6, 5]]
/** How quickly the mountain falls away from a summit, terraces a tile. */
const FALL = 0.72

/**
 * The island's own ground at a tile, before any building forces its plot to
 * be land: whether it is land, its district, and how many terraces up the
 * mountain it stands (the terraces' edges wander a little, as contours do).
 * world.ts builds the map from this, and check-island checks the buildings
 * stand on it.
 */
export function ground(i: number, j: number): { land: boolean; district: District; level: number } {
  const ch = MAP[i]?.[j] ?? '.', key = LETTER[ch]
  // Water belongs to the district nearest it, for whatever needs to know (a bottle washed up by it).
  const district = key ? DISTRICTS.find((d) => d.key === key)! : DISTRICTS.reduce((b, d) => (Math.hypot(i + 0.5 - d.at[0], j + 0.5 - d.at[1]) / d.r < Math.hypot(i + 0.5 - b.at[0], j + 0.5 - b.at[1]) / b.r ? d : b))
  let level = 0
  if (key === 'peaks') {
    const wander = 0.2 * Math.sin(i * 1.31 + j * 0.57) + 0.14 * Math.cos(j * 1.73 - i * 0.61)
    for (const [si, sj, top] of SUMMITS) level = Math.max(level, Math.round(top - Math.hypot(i + 0.5 - si, j + 0.5 - sj) * FALL + wander))
  }
  return { land: !!key, district, level: Math.max(0, level) }
}

/** The river, a tile at a time: from its spring under the second summit, down the terraces into the lake, and out of it into the fjord. */
export const RIVER: [number, number][] = [[2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [13, 9], [13, 8]]
/** The park pond in Old Town, where the ducks go round. */
export const POND: [number, number][] = [[16, 14], [16, 15], [17, 14], [17, 15]]

/** Where each game stands: [slug, district, i, j] — the footprint's back corner. */
export const PLACES: [string, DistrictKey, number, number][] = [
  ['space-elevator', 'peaks', 3, 3], ['constellation-draw', 'peaks', 1, 7], ['universe-forecast', 'peaks', 6, 1],
  ['orbit', 'peaks', 8, 6], ['speed', 'peaks', 4, 7], ['scale', 'peaks', 8, 2],
  ['asteroid', 'badlands', 18, 3], ['days-since-incident', 'badlands', 20, 6], ['deep-time', 'badlands', 24, 4], ['fusion', 'badlands', 18, 7],
  ['trolley', 'proving', 20, 10], ['not-a-robot', 'proving', 24, 15], ['steady-hand', 'proving', 23, 11],
  ['ambient-mix', 'harbour', 19, 21], ['share-this-page', 'harbour', 26, 26], ['deep-sea', 'harbour', 28, 19], ['paper-folds', 'harbour', 23, 23],
  ['earth-reviews', 'funfair', 9, 25], ['overstimulated', 'funfair', 14, 24], ['internet-artifacts', 'funfair', 13, 20], ['progress', 'funfair', 16, 21],
  ['auction', 'market', 4, 16], ['printing-money', 'market', 7, 20], ['dark-patterns', 'market', 4, 21], ['spend-it', 'market', 2, 21],
  ['who-was-alive', 'oldtown', 8, 12], ['life-in-weeks', 'oldtown', 18, 18], ['every-second', 'oldtown', 15, 17], ['day-go', 'oldtown', 13, 12], ['rule-cascade', 'oldtown', 14, 9], ['from-memory', 'oldtown', 10, 16],
]

/** The town square every road leads back to. */
export const HUB: [number, number] = [12, 15]
/**
 * The streets, laid before the roads that join the districts up: each from
 * one point to another, found round the buildings. Market's high street and
 * the lane across it; Old Town's lake road on to the Funfair, the old road
 * down the middle, and the mill lane; the pier road; the harbour's quay;
 * the Proving Grounds' test track; the dust road out to the Badlands.
 */
export const STREETS: [[number, number], [number, number]][] = [
  [[6, 14], [6, 24]], [[3, 19], [9, 19]],
  [[12, 11], [12, 26]], [[7, 15], [19, 15]], [[17, 9], [17, 20]],
  [[9, 22], [17, 22]],
  [[19, 13], [26, 13]], [[24, 10], [24, 17]], [[22, 2], [22, 13]], [[15, 19], [15, 26]], [[3, 23], [9, 23]],
]
