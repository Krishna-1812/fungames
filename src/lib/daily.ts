/**
 * The daily challenge's memory: which days this browser took part, whether it
 * beat the target, and the streak that makes.
 *
 * The challenge itself is `dailyFor` (data/game-meta.ts): one game and one
 * target per UTC day, the same for everyone, with no server deciding it. So
 * the days here are UTC days too, and a new challenge arrives at UTC midnight
 * (the page says when that is on the visitor's own clock).
 *
 * **The streak** counts days in a row the challenge was played to the end,
 * beaten or not: a streak that one bad round could end would punish exactly
 * the people coming back. Beaten days are kept, and shown, apart. **One missed
 * day a week is forgiven**: a single missed day between two played ones does
 * not break the streak, at most once in any seven days, so a weekend away is
 * not the end of a month's run. A day not yet played today never breaks it
 * either; it is still there to play.
 *
 * Written on the assumption that storage is hostile (see stats.ts): every
 * read survives junk, every write survives being refused.
 * scripts/check-daily.mjs holds all of this to account.
 */

export const DAILY_KEY = 'funsite:daily'
export const DAILY_VERSION = 1

/** One day's challenge, as played: which game, and whether its target was beaten. */
export type DayEntry = { g: string; ok: boolean }
export type DailyFile = { v: number; days: Record<string, DayEntry>; best: number }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY = 864e5

/** The challenge's day: UTC, as YYYY-MM-DD. */
export const utcDay = (d: Date | number = new Date()) => new Date(d).toISOString().slice(0, 10)
const shift = (day: string, by: number) => utcDay(Date.parse(day + 'T00:00:00Z') + by * DAY)

type Store = Pick<Storage, 'getItem' | 'setItem'>
function store(): Store | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}

const empty = (): DailyFile => ({ v: DAILY_VERSION, days: {}, best: 0 })

/** Everything, or nothing. Never throws. */
export function readDaily(s: Store | null = store()): DailyFile {
  if (!s) return empty()
  let o: unknown
  try { o = JSON.parse(s.getItem(DAILY_KEY) ?? 'null') } catch { return empty() }
  if (!o || typeof o !== 'object') return empty()
  const r = o as Record<string, unknown>
  if (typeof r.v !== 'number' || r.v > DAILY_VERSION) return empty()
  const days: Record<string, DayEntry> = {}
  if (r.days && typeof r.days === 'object' && !Array.isArray(r.days))
    for (const [k, v] of Object.entries(r.days as Record<string, unknown>)) {
      const e = v as Record<string, unknown> | null
      if (DAY_RE.test(k) && e && typeof e.g === 'string' && typeof e.ok === 'boolean') days[k] = { g: e.g.slice(0, 40), ok: e.ok }
    }
  const best = typeof r.best === 'number' && Number.isFinite(r.best) ? Math.max(0, Math.floor(r.best)) : 0
  return { v: DAILY_VERSION, days, best }
}

export type Streak = {
  /** Days in the streak (played days only; forgiven ones are not counted in). */
  n: number
  /** The longest streak this browser has had. */
  best: number
  /** Today's challenge, if it has been played. */
  today: DayEntry | null
  /** Days missed and forgiven inside the current streak. */
  forgiven: string[]
  /** Whether the streak is only waiting on today (it ends if today is missed and cannot be forgiven). */
  atRisk: boolean
}

/** Whether a missed day at walk position `i` can be forgiven, given the last forgiven position. */
const canForgive = (i: number, last: number) => i - last >= 7

/** The streak as it stands on `today`. */
export function streakOf(days: Record<string, DayEntry>, today: string, best = 0): Streak {
  let n = 0
  const forgiven: string[] = []
  let lastForgiven = -Infinity
  // Today counts if played; if not, it is simply not over yet.
  if (days[today]) n++
  let d = shift(today, -1)
  for (let i = 1; i < 800; i++, d = shift(d, -1)) {
    if (days[d]) { n++; continue }
    // A single missed day with a played day before it, at most once in any seven.
    if (days[shift(d, -1)] && canForgive(i, lastForgiven)) { forgiven.push(d); lastForgiven = i; continue }
    break
  }
  const atRisk = !days[today] && n > 0
  return { n, best: Math.max(best, n), today: days[today] ?? null, forgiven, atRisk }
}

/**
 * Today's challenge, played to its end: remembered (a beaten round is never
 * replaced by a later one that missed), the longest streak kept, and the
 * streak returned. `first` says whether this was today's first finish.
 */
export function recordDaily(slug: string, ok: boolean, now: Date = new Date(), s: Store | null = store()): { streak: Streak; first: boolean; beatenNow: boolean } {
  const file = readDaily(s)
  const today = utcDay(now)
  const prev = file.days[today]
  const first = !prev || prev.g !== slug
  const beatenNow = ok && !(prev?.g === slug && prev.ok)
  file.days[today] = { g: slug, ok: ok || (prev?.g === slug && prev.ok) }
  // Old days past a year only cost space: the streak cannot reach them without a year of play, and then it keeps them.
  const keep = shift(today, -400)
  for (const k of Object.keys(file.days)) if (k < keep) delete file.days[k]
  const streak = streakOf(file.days, today, file.best)
  file.best = streak.best
  try { s?.setItem(DAILY_KEY, JSON.stringify(file)) } catch { /* storage refused: the round still counted on screen */ }
  return { streak, first, beatenNow }
}

export type CalDay = { day: string; state: 'won' | 'played' | 'forgiven' | 'missed' | 'open' }

/** The last `count` days, oldest first, for the row of dots. */
export function calendar(days: Record<string, DayEntry>, today: string, forgiven: string[], count = 14): CalDay[] {
  const out: CalDay[] = []
  for (let k = count - 1; k >= 0; k--) {
    const day = shift(today, -k)
    const e = days[day]
    out.push({ day, state: e ? (e.ok ? 'won' : 'played') : forgiven.includes(day) ? 'forgiven' : day === today ? 'open' : 'missed' })
  }
  return out
}

/** Milliseconds until the next challenge (UTC midnight). */
export const msToNext = (now: Date = new Date()) => Date.parse(shift(utcDay(now), 1) + 'T00:00:00Z') - now.getTime()

/** "6h 12m", "48m", "under a minute". */
export function inWords(ms: number): string {
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'under a minute'
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

/**
 * The text a player sends: the day, the game, beaten or not, the streak and
 * the last week as squares (beaten, played, missed), no spoilers.
 */
export function shareText(o: { title: string; ok: boolean; streak: Streak; cal: CalDay[]; url: string; now?: Date }): string {
  const date = (o.now ?? new Date()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const sq = o.cal.slice(-7).map((c) => (c.state === 'won' ? '🟦' : c.state === 'played' ? '🟪' : c.state === 'forgiven' ? '▫️' : '⬜')).join('')
  return `Tiny Island daily · ${date}\n${o.title}: ${o.ok ? 'beaten ✓' : 'not this time'}\nStreak ${o.streak.n} ${sq}\n${o.url}`
}
