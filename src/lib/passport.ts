/**
 * The island's passport: which games you have been to, and since when.
 *
 * `stats.ts` records *finishing* a game; this records *going* to one, which is
 * a different and much commoner thing (Scale or Deep Time have no ending to
 * reach, and plenty of people open a game, look, and leave). A visit is kept
 * as three facts: the first day, the latest day, and on how many different
 * days. Not a count of page loads: refreshing a page is not visiting it again,
 * and a day is as precise a record of when someone plays as anything here
 * needs.
 *
 * Days are the visitor's own calendar day, not UTC: a stamp that says you went
 * to the Harbour tomorrow because it was late evening would be a strange thing
 * for a passport to say.
 *
 * Storage is the same hardened store the stats use (see `stats.ts` for why it
 * is assumed hostile), and `check-passport.mjs` hands it each failure in turn.
 */
import { siteStore, type StatsFile } from './stats'

export const PASSPORT_KEY = 'funsite:passport'
export const PASSPORT_VERSION = 1

export type Visit = {
  /** The first day this browser opened the game, as YYYY-MM-DD. */
  first: string
  /** The most recent day. */
  last: string
  /** How many different days, at least 1. */
  days: number
  /** Known only from a score kept before the passport existed: the day is a guess. */
  old?: boolean
}

export type PassportFile = {
  v: number
  visits: Record<string, Visit>
  /** Stamps the visitor has already seen in the book, so new ones can land. */
  seen: string[]
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The visitor's own calendar day. */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const empty = (): PassportFile => ({ v: PASSPORT_VERSION, visits: {}, seen: [] })

function coerce(raw: unknown): Visit | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const first = typeof o.first === 'string' && DAY.test(o.first) ? o.first : null
  const last = typeof o.last === 'string' && DAY.test(o.last) ? o.last : first
  if (!first || !last) return null
  const days = typeof o.days === 'number' && Number.isFinite(o.days) ? Math.max(1, Math.floor(o.days)) : 1
  // Days are ISO, so they sort as strings. A last before the first is a
  // clock that went backwards; keep the earlier one as the first.
  const v: Visit = first <= last ? { first, last, days } : { first: last, last: first, days }
  if (o.old === true) v.old = true
  return v
}

/** Everything, or an empty passport. Never throws. */
export function readPassport(): PassportFile {
  const s = siteStore()
  if (!s) return empty()
  let raw: string | null = null
  try { raw = s.getItem(PASSPORT_KEY) } catch { return empty() }
  if (!raw) return empty()
  let o: Record<string, unknown>
  try { o = JSON.parse(raw) } catch { return empty() }
  if (!o || typeof o !== 'object' || typeof o.v !== 'number' || o.v > PASSPORT_VERSION) return empty()
  const visits: Record<string, Visit> = {}
  if (o.visits && typeof o.visits === 'object' && !Array.isArray(o.visits))
    for (const [slug, v] of Object.entries(o.visits as Record<string, unknown>)) {
      const c = coerce(v)
      if (c) visits[slug] = c
    }
  const seen = Array.isArray(o.seen) ? [...new Set(o.seen.filter((x): x is string => typeof x === 'string'))] : []
  return { v: PASSPORT_VERSION, visits, seen }
}

function write(file: PassportFile): boolean {
  const s = siteStore()
  if (!s) return false
  try { s.setItem(PASSPORT_KEY, JSON.stringify(file)); return true } catch { return false }
}

/**
 * Stamp a game. Called once per page load by the game shell; a second load
 * on the same day changes nothing, the next day counts one more day.
 * Returns the visit as it now stands, whether or not the write survived.
 */
export function recordVisit(slug: string, day = localDay()): Visit {
  const file = readPassport()
  const prev = file.visits[slug]
  let next: Visit
  if (!prev || prev.old) next = { first: prev && prev.first < day ? prev.first : day, last: day, days: 1 }
  else if (day > prev.last) next = { ...prev, last: day, days: prev.days + 1 }
  else if (day < prev.first) next = { ...prev, first: day }
  else return prev
  file.visits[slug] = next
  write(file)
  return next
}

/** The visitor has opened the book and seen these stamps. */
export function markSeen(slugs: string[]): boolean {
  const file = readPassport()
  const seen = new Set(file.seen)
  const before = seen.size
  for (const s of slugs) seen.add(s)
  if (seen.size === before) return true
  file.seen = [...seen]
  return write(file)
}

/** Wipe the passport, and nothing else: scores and secrets stay. */
export function clearPassport(): boolean {
  const s = siteStore()
  if (!s) return false
  try { s.removeItem(PASSPORT_KEY); return true } catch { return false }
}

/**
 * The passport as the book shows it: real visits, plus any game this browser
 * has a score or a finish for from before the passport existed (it was
 * certainly visited; the day is the finish's, or unknown). Pure.
 */
export function withHistory(file: PassportFile, stats: StatsFile, scored: string[]): Record<string, Visit> {
  const out: Record<string, Visit> = { ...file.visits }
  for (const [slug, g] of Object.entries(stats.games)) {
    if (out[slug]) continue
    const day = DAY.test(g.at) ? g.at : null
    if (day) out[slug] = { first: day, last: day, days: 1, old: true }
  }
  for (const slug of scored) if (!out[slug]) out[slug] = { first: '', last: '', days: 1, old: true }
  return out
}

/** What the book calls you, by how much of the island you have seen. */
export const RANKS = [
  { at: 0, name: 'Just landed' },
  { at: 1 / 32, name: 'Day tripper' },
  { at: 0.15, name: 'Tourist' },
  { at: 0.37, name: 'Regular' },
  { at: 0.62, name: 'Local' },
  { at: 0.87, name: 'Islander' },
  { at: 1, name: 'Keeper of the island' },
] as const

export function rankFor(visited: number, total: number): string {
  if (total <= 0 || visited <= 0) return RANKS[0].name
  const share = Math.min(1, visited / total)
  // Anyone who has been anywhere is at least a day tripper, however many
  // games there come to be.
  let name: string = RANKS[1].name
  for (const r of RANKS.slice(2)) if (share >= r.at - 1e-9) name = r.name
  return name
}

/** Stamps not yet seen in the book, in the order they were first made. */
export function newStamps(visits: Record<string, Visit>, seen: string[]): string[] {
  const s = new Set(seen)
  return Object.entries(visits)
    .filter(([slug, v]) => !s.has(slug) && !v.old)
    .sort((a, b) => a[1].first.localeCompare(b[1].first))
    .map(([slug]) => slug)
}

/** "2 OCT 2026", the way a stamp prints a day. */
export function stampDate(day: string): string {
  if (!DAY.test(day)) return ''
  const [y, m, d] = day.split('-').map(Number)
  const M = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][m - 1]
  return M ? `${d} ${M} ${y}` : ''
}
