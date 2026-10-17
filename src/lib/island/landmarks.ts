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

export type District = { key: DistrictKey; name: string; at: [number, number]; r: number; ground: [string, string]; tint: string }

/** Seven districts, each where its games belong: space up high, the sea at the front. */
export const DISTRICTS: District[] = [
  { key: 'peaks', name: 'Sky Peaks', at: [7, 7], r: 5.4, ground: ['#62a95b', '#6cb162'], tint: '#c9f7ea' },
  { key: 'badlands', name: 'The Badlands', at: [22, 6.3], r: 5.1, ground: ['#d1c7b4', '#c8bda8'], tint: '#e6e1f7' },
  { key: 'proving', name: 'Proving Grounds', at: [23, 15], r: 4.9, ground: ['#6aaf5a', '#74b763'], tint: '#cff6ea' },
  { key: 'harbour', name: 'The Harbour', at: [22, 22.2], r: 4.9, ground: ['#6cb65c', '#78bd66'], tint: '#d6ecff' },
  { key: 'funfair', name: 'The Funfair', at: [14.4, 23.8], r: 5.1, ground: ['#6cb65c', '#78bd66'], tint: '#ffe1e8' },
  { key: 'market', name: 'Market Street', at: [7, 21.3], r: 5.1, ground: ['#6cb65c', '#78bd66'], tint: '#d9f3f0' },
  { key: 'oldtown', name: 'Old Town', at: [14.4, 14], r: 6.5, ground: ['#6cb65c', '#78bd66'], tint: '#e3e9ff' },
]

/** Where each game stands: [slug, district, i, j] — the footprint's back corner. */
export const PLACES: [string, DistrictKey, number, number][] = [
  ['space-elevator', 'peaks', 4, 4], ['constellation-draw', 'peaks', 8, 3], ['universe-forecast', 'peaks', 2, 8],
  ['orbit', 'peaks', 8, 7], ['speed', 'peaks', 6, 2], ['scale', 'peaks', 5, 9],
  ['asteroid', 'badlands', 19, 3], ['days-since-incident', 'badlands', 23, 5], ['deep-time', 'badlands', 18, 7], ['fusion', 'badlands', 22, 8],
  ['trolley', 'proving', 20, 12], ['not-a-robot', 'proving', 25, 13], ['steady-hand', 'proving', 21, 17],
  ['ambient-mix', 'harbour', 20, 20], ['share-this-page', 'harbour', 22, 24], ['deep-sea', 'harbour', 27, 19], ['paper-folds', 'harbour', 24, 27],
  ['earth-reviews', 'funfair', 11, 23], ['overstimulated', 'funfair', 15, 24], ['internet-artifacts', 'funfair', 16, 20], ['progress', 'funfair', 12, 26],
  ['auction', 'market', 5, 18], ['printing-money', 'market', 7, 21], ['dark-patterns', 'market', 3, 22], ['spend-it', 'market', -1, 19],
  ['who-was-alive', 'oldtown', 11, 10], ['life-in-weeks', 'oldtown', 16, 10], ['every-second', 'oldtown', 10, 14], ['day-go', 'oldtown', 13, 13], ['rule-cascade', 'oldtown', 17, 14], ['from-memory', 'oldtown', 12, 17],
]
