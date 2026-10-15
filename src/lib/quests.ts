/**
 * Quests: thirteen things to do on Tiny Island, kept in the passport, each
 * with a bar that fills as you go and some with a new passport cover at the
 * end of them.
 *
 * Every quest is worked out from what this browser already keeps (the
 * passport's stamps, the stats' endings and bests, the daily streak, the
 * bottles, the sightings), so a quest done before quests existed is simply
 * done the first time the book is opened. The only new things counted are
 * challenges sent to a friend and won, which nothing kept before.
 *
 * What this file stores (`funsite:quests`): the day each quest was first
 * seen done, which of those the passport has shown, and the two challenge
 * counts. Hardened like every other store here: junk in, nothing thrown.
 * scripts/check-quests.mjs plays a browser through them.
 */
import { siteStore, readAll } from './stats'
import { localDay, readPassport, withHistory } from './passport'
import { readDaily, streakOf, utcDay } from './daily'
import { readBottles, count as bottleCount } from './bottles'
import { bestKey } from '../data/game-meta'
import { seasonsSeen } from './island/seasons'

export const QUESTS_KEY = 'funsite:quests'
export const QUESTS_VERSION = 1

/** Everything a quest can be measured by, gathered from the other stores. */
export type QuestState = {
  /** Every listed game: its category and district. */
  games: { slug: string; cat: string; district: string }[]
  /** Games stamped in the passport. */
  visited: Set<string>
  /** Games played to an ending (stats plays, or a best kept). */
  finished: Set<string>
  /** Games with a personal best. */
  bests: Set<string>
  /** Different days this browser was here. */
  days: number
  /** The longest daily-challenge streak. */
  streak: number
  bottles: number
  sightings: number
  /** Different seasons of the island's calendar seen here (lib/island/seasons.ts). */
  seasons: number
  sent: number
  won: number
}

export type Quest = {
  id: string
  name: string
  line: string
  /** How far along, and out of how many. */
  of: (s: QuestState) => [number, number]
  /** A passport cover it earns (bottles.ts QUEST_COVERS). */
  cover?: string
}

const KNOW = ['trolley', 'dark-patterns', 'not-a-robot']

export const QUESTS: Quest[] = [
  { id: 'landfall', name: 'Landfall', line: 'Open three games.', of: (s) => [s.visited.size, 3] },
  { id: 'regular', name: 'Regular', line: 'Come back to the island on three different days.', of: (s) => [s.days, 3] },
  { id: 'know-thyself', name: 'Know thyself', line: 'Finish the three games that measure you: Trolley, Dark Patterns and I’m Not a Robot.', of: (s) => [KNOW.filter((g) => s.finished.has(g)).length, 3] },
  { id: 'lab-notes', name: 'Lab notes', line: 'Open six of the real-science games.', of: (s) => [s.games.filter((g) => g.cat === 'science' && s.visited.has(g.slug)).length, 6] },
  { id: 'on-the-board', name: 'On the board', line: 'Set a personal best in five different games.', of: (s) => [s.bests.size, 5] },
  { id: 'three-in-a-row', name: 'Three in a row', line: 'Finish the daily challenge three days running.', of: (s) => [s.streak, 3] },
  { id: 'grand-tour', name: 'Grand tour', line: 'Get a stamp in every one of the seven districts.', of: (s) => [new Set(s.games.filter((g) => s.visited.has(g.slug)).map((g) => g.district)).size, new Set(s.games.map((g) => g.district)).size], cover: 'aurora' },
  { id: 'ambassador', name: 'Ambassador', line: 'Send a friend a challenge from the end of a game.', of: (s) => [s.sent, 1] },
  { id: 'champion', name: 'Champion', line: 'Beat a friend’s challenge.', of: (s) => [s.won, 1], cover: 'glacier' },
  { id: 'beachcomber', name: 'Beachcomber', line: 'Find six messages in bottles along the shore.', of: (s) => [s.bottles, 6] },
  { id: 'through-the-year', name: 'Through the year', line: 'See the island in four of its seasons: snow, blossom, rain, leaves or a festival.', of: (s) => [s.seasons, 4] },
  { id: 'keen-eye', name: 'Keen eye', line: 'Spot ten things on the island that do something when you poke them.', of: (s) => [s.sightings, 10] },
  { id: 'a-whole-week', name: 'A whole week', line: 'Finish the daily challenge seven days running.', of: (s) => [s.streak, 7], cover: 'midnight' },
  { id: 'keeper', name: 'Keeper of the island', line: 'Get a stamp from every game on the island.', of: (s) => [s.visited.size, s.games.length], cover: 'opal' },
]

export type QuestsFile = { v: number; done: Record<string, string>; seen: string[]; sent: number; won: number }
const empty = (): QuestsFile => ({ v: QUESTS_VERSION, done: {}, seen: [], sent: 0, won: 0 })
const IDS = new Set(QUESTS.map((q) => q.id))
const DAY = /^\d{4}-\d{2}-\d{2}$/
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1e6, Math.floor(x))) : 0)

export function readQuests(): QuestsFile {
  const s = siteStore()
  if (!s) return empty()
  let o: unknown
  try { o = JSON.parse(s.getItem(QUESTS_KEY) ?? 'null') } catch { return empty() }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return empty()
  const r = o as Record<string, unknown>
  if (typeof r.v !== 'number' || r.v > QUESTS_VERSION) return empty()
  const done: Record<string, string> = {}
  if (r.done && typeof r.done === 'object' && !Array.isArray(r.done))
    for (const [k, v] of Object.entries(r.done as Record<string, unknown>)) if (IDS.has(k)) done[k] = typeof v === 'string' && DAY.test(v) ? v : ''
  const seen = Array.isArray(r.seen) ? [...new Set(r.seen.filter((x): x is string => typeof x === 'string' && IDS.has(x)))] : []
  return { v: QUESTS_VERSION, done, seen, sent: count(r.sent), won: count(r.won) }
}

function write(f: QuestsFile): boolean {
  const s = siteStore()
  if (!s) return false
  try { s.setItem(QUESTS_KEY, JSON.stringify(f)); return true } catch { return false }
}

/** A challenge sent, or won: the two things only quests count. */
export function bump(what: 'sent' | 'won'): void {
  const f = readQuests()
  f[what]++
  write(f)
}

export type Progress = { q: Quest; n: number; goal: number; done: boolean; day: string | null }

/** Every quest, how far along it is, and whether it is done (once done, always done). */
export function progress(s: QuestState, f: QuestsFile = readQuests()): Progress[] {
  return QUESTS.map((q) => {
    const [n, goal] = q.of(s)
    const done = n >= goal || q.id in f.done
    return { q, n: Math.min(n, goal), goal, done, day: f.done[q.id] || null }
  })
}

/**
 * Note every quest that is done and was not before, with today's date, and
 * return those: what a page can announce.
 */
export function sync(s: QuestState, day = localDay()): Quest[] {
  const f = readQuests()
  const fresh = progress(s, f).filter((p) => p.done && !(p.q.id in f.done)).map((p) => p.q)
  if (!fresh.length) return []
  for (const q of fresh) f.done[q.id] = day
  write(f)
  return fresh
}

/** Done quests the passport has not shown yet. */
export const unseen = (f: QuestsFile = readQuests()) => Object.keys(f.done).filter((id) => !f.seen.includes(id))

export function markQuestsSeen(): void {
  const f = readQuests()
  const ids = Object.keys(f.done)
  if (ids.every((id) => f.seen.includes(id))) return
  f.seen = [...new Set([...f.seen, ...ids])]
  write(f)
}

/** The quest covers earned so far, by key. */
export function questCovers(f: QuestsFile = readQuests()): Set<string> {
  return new Set(QUESTS.filter((q) => q.cover && q.id in f.done).map((q) => q.cover!))
}

/* ---- gathering the state, in a browser -------------------------------- */

/** Everything the quests measure, read from this browser's stores. */
export function gather(games: QuestState['games']): QuestState {
  const s = siteStore()
  const has = (k: string) => { try { return !!s?.getItem(k) } catch { return false } }
  const bests = new Set(games.map((g) => g.slug).filter((slug) => has(bestKey(slug))))
  const stats = readAll()
  const visits = withHistory(readPassport(), stats, [...bests])
  const finished = new Set(games.map((g) => g.slug).filter((slug) => bests.has(slug) || (stats.games[slug]?.plays ?? 0) > 0))
  const daily = readDaily()
  const days = new Set<string>()
  for (const v of Object.values(visits)) { if (v.first) days.add(v.first); if (v.last) days.add(v.last) }
  for (const d of Object.keys(daily.days)) days.add(d)
  // The passport keeps each game's first and last day and how many days in all, not every day:
  // one game opened on three days is three days, even when the middle one is not in the set.
  const mostDays = Math.max(0, ...Object.values(visits).map((v) => v.days))
  let sightings = 0
  try { sightings = (JSON.parse(s?.getItem('isl-found') ?? '[]') as unknown[]).filter((k) => k !== 'bottle').length } catch { /* none */ }
  const f = readQuests()
  return {
    games,
    visited: new Set(Object.keys(visits).filter((slug) => games.some((g) => g.slug === slug))),
    finished,
    bests,
    days: Math.max(days.size, mostDays),
    streak: Math.max(daily.best, streakOf(daily.days, utcDay(), daily.best).n),
    bottles: bottleCount(readBottles()),
    sightings,
    seasons: seasonsSeen(s).length,
    sent: f.sent,
    won: f.won,
  }
}
