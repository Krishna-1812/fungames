/**
 * Messages in bottles: twelve of them, washed up round Tiny Island's coast
 * (one still bobbing off the castaway's islet), each with a note inside.
 *
 * Finding one is a tap. The island draws them (lib/island/world.ts places
 * them, one to a stretch of shore); this is the record of which ones this
 * browser has found and on what day, what each note says, and what finding
 * them earns: covers for the passport, a new one every three bottles.
 *
 * Storage is the same hardened store the stats and the passport use, and
 * `check-bottles.mjs` hands it every failure in turn: a bottle found in a
 * browser that will not keep it is still found for the visit, and nothing
 * here ever throws.
 */
import { siteStore } from './stats'
import { localDay } from './passport'

export const BOTTLES_KEY = 'funsite:bottles'
export const BOTTLES_VERSION = 1
export const BOTTLE_COUNT = 12

export type Note = { text: string; from: string }

/**
 * What is inside each bottle, by its number. Some are only for fun; most
 * point at something on the island worth finding, so a note is a clue as well
 * as a prize. The castaway's is the one still out at sea (number 12).
 */
export const NOTES: Record<number, Note> = {
  1: { text: 'If you are reading this, poke the windmill. Poke everything. Something comes at three in the morning.', from: 'a night owl' },
  2: { text: 'The big whale only comes up at dawn. Do not tell anyone I told you.', from: 'someone who gets up early' },
  3: { text: 'The lighthouse in your tab says HI in Morse whenever you look away. Look away. Then look back.', from: 'the lighthouse keeper' },
  4: { text: 'Somewhere at the very back of Sky Peaks there is a round blue door with a 32 on it. Knock.', from: 'a neighbour' },
  5: { text: 'To the sheep on Sky Peaks: we know it was you.', from: 'the windmill' },
  6: { text: 'Postcards on this island are free. Press the camera, frame the view, send it to someone you miss.', from: 'the post office' },
  7: { text: 'Make a wish and poke the fountain in Old Town. It cannot grant wishes, but it tries very hard.', from: 'the fountain' },
  8: { text: 'Things I have seen from this beach: a UFO, a dolphin, a kite caught on a whale. Only one of those was a dream.', from: 'a beachcomber' },
  9: { text: 'Try the island at night. Everything you know here looks different with the lights on.', from: 'the lamplighter' },
  10: { text: 'I buried the good stuff on the islet out west. X marks the spot. It always does.', from: 'a pirate, retired' },
  11: { text: 'Lost: one (1) sense of wonder. If found, please return to the Funfair, behind the big wheel.', from: 'Funfair lost property' },
  12: { text: 'Day 212. The crabs have started to trust me. Send biscuits.', from: 'the castaway, on the islet out west' },
}

/** The glass each bottle is blown in: cool colours, one after another round the coast. */
export const GLASS = ['#bdf0da', '#c4e4ff', '#d9cffd', '#b8ece6', '#c8d3ff', '#e2f4ff'] as const
export const glassOf = (n: number) => GLASS[(n - 1) % GLASS.length]

/**
 * Passport covers. The book comes in navy; every three bottles found earns
 * another, to put on from the passport's bottle page. Each is a pair of tones
 * for the book's board and three for the cover's face, with its lettering.
 */
export type Cover = { key: string; name: string; need: number; board: [string, string]; face: [string, string, string]; ink: string }
export const COVERS: Cover[] = [
  { key: 'navy', name: 'Harbour navy', need: 0, board: ['#26347a', '#1c275c'], face: ['#33479a', '#212e6a', '#1a2456'], ink: '#c4f4e8' },
  { key: 'lagoon', name: 'Lagoon', need: 3, board: ['#11786f', '#0b5752'], face: ['#1b9c8e', '#106f68', '#0a504c'], ink: '#e2fff8' },
  { key: 'kelp', name: 'Kelp forest', need: 6, board: ['#1d6a49', '#134a33'], face: ['#2b8b60', '#1b5e42', '#123f2d'], ink: '#dcffe9' },
  { key: 'nebula', name: 'Nebula', need: 9, board: ['#4a2f9e', '#311f70'], face: ['#6b4bcb', '#45309a', '#2c1f6c'], ink: '#efe6ff' },
  { key: 'pearl', name: 'Pearl', need: 12, board: ['#d9e4fb', '#b9c6ec'], face: ['#fbfdff', '#e3ebff', '#efe3ff'], ink: '#2b3a7c' },
]

/**
 * Four more covers, earned by quests rather than bottles (lib/quests.ts says
 * which). `need` is never reached by bottles alone; `quest` names the quest.
 */
export const QUEST_COVERS: (Cover & { quest: string })[] = [
  { key: 'aurora', name: 'Aurora', need: Infinity, quest: 'grand-tour', board: ['#0f5e6e', '#0a414d'], face: ['#2fb5a8', '#3a6fd0', '#5a3fb0'], ink: '#eafffb' },
  { key: 'glacier', name: 'Glacier', need: Infinity, quest: 'champion', board: ['#6fa6cc', '#4f86ad'], face: ['#eef8ff', '#c4e6f8', '#a3d1ec'], ink: '#1d4a6b' },
  { key: 'midnight', name: 'Midnight', need: Infinity, quest: 'a-whole-week', board: ['#151a33', '#0b0f22'], face: ['#283063', '#181e40', '#0f1430'], ink: '#9fe9ff' },
  { key: 'opal', name: 'Opal', need: Infinity, quest: 'keeper', board: ['#a99be0', '#8574c7'], face: ['#f2f0ff', '#d9f3ef', '#e3dcff'], ink: '#3b2f7a' },
]
/** Every cover there is. */
export const ALL_COVERS: Cover[] = [...COVERS, ...QUEST_COVERS]

export type BottlesFile = {
  v: number
  /** Each bottle found, by number, and the day it was found (YYYY-MM-DD). */
  found: Record<number, string>
  /** The cover the passport wears. */
  cover: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const empty = (): BottlesFile => ({ v: BOTTLES_VERSION, found: {}, cover: 'navy' })

/**
 * What this browser kept (and anything found this visit that it would not
 * keep), or nothing. Never throws, never returns something half-typed.
 */
export function readBottles(): BottlesFile {
  const file = fromStore()
  // A browser that refused to write still remembers for the visit.
  if (mem) { for (const [k, v] of Object.entries(mem.found)) if (!(k in file.found)) file.found[Number(k)] = v; if (mem.cover !== 'navy') file.cover = mem.cover }
  // A quest cover was checked when it was put on (wearCover); the quests are not this file's to read.
  if (!unlocked(count(file)).some((c) => c.key === file.cover) && !QUEST_COVERS.some((c) => c.key === file.cover)) file.cover = 'navy'
  return file
}

function fromStore(): BottlesFile {
  const s = siteStore()
  if (!s) return empty()
  let raw: string | null = null
  try { raw = s.getItem(BOTTLES_KEY) } catch { return empty() }
  if (!raw) return empty()
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { return empty() }
  if (!o || typeof o !== 'object' || typeof o.v !== 'number' || o.v > BOTTLES_VERSION) return empty()
  const found: Record<number, string> = {}
  if (o.found && typeof o.found === 'object' && !Array.isArray(o.found))
    for (const [k, v] of Object.entries(o.found as Record<string, unknown>)) {
      const n = Number(k)
      if (Number.isInteger(n) && n >= 1 && n <= BOTTLE_COUNT) found[n] = typeof v === 'string' && DAY.test(v) ? v : ''
    }
  // A cover is only worn if it is one there is (and, in readBottles, one that has been earned).
  return { v: BOTTLES_VERSION, found, cover: typeof o.cover === 'string' && ALL_COVERS.some((c) => c.key === o.cover) ? o.cover : 'navy' }
}

/** Kept for the visit when the browser will not keep anything: a bottle found is found until the page goes. */
let mem: BottlesFile | null = null

function write(file: BottlesFile): boolean {
  mem = file
  const s = siteStore()
  if (!s) return false
  try { s.setItem(BOTTLES_KEY, JSON.stringify(file)); return true } catch { return false }
}

export const count = (file: BottlesFile) => Object.keys(file.found).length

/** The covers earned with this many bottles, navy first. */
export const unlocked = (n: number) => COVERS.filter((c) => n >= c.need)

/**
 * A bottle found. Returns what changed: whether it is new (a second tap on
 * one is not finding it again), how many there now are, and a cover it has
 * just earned, if any.
 */
export function findBottle(n: number, day = localDay()): { first: boolean; total: number; cover: Cover | null; file: BottlesFile } {
  const file = readBottles()
  if (!Number.isInteger(n) || n < 1 || n > BOTTLE_COUNT || n in file.found) return { first: false, total: count(file), cover: null, file }
  const before = count(file)
  file.found[n] = DAY.test(day) ? day : ''
  write(file)
  const total = count(file)
  const cover = COVERS.find((c) => c.need > before && c.need <= total) ?? null
  return { first: true, total, cover, file }
}

/** Put a cover on the passport, if it has been earned: by bottles, or by a quest in `byQuest` (lib/quests.ts questCovers). */
export function wearCover(key: string, byQuest: Set<string> = new Set()): boolean {
  const file = readBottles()
  if (!unlocked(count(file)).some((c) => c.key === key) && !(byQuest.has(key) && QUEST_COVERS.some((c) => c.key === key))) return false
  file.cover = key
  return write(file)
}

/** The bottles go back in the sea (the passport's "start again" does not do this; it is for the checker). */
export function clearBottles(): boolean {
  mem = null
  const s = siteStore()
  if (!s) return false
  try { s.removeItem(BOTTLES_KEY); return true } catch { return false }
}
