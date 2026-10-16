/**
 * The island's calendar: what season it is on Tiny Island, by the visitor's
 * own date, and what that looks like.
 *
 * Each season is a look the island wears for a while (weather falling or
 * rising across the whole map, fireworks, a tint to the light), a line for
 * the noticeboard, and a name the passport can count. The look itself is
 * world.ts's weather layers and moves.ts's LAYERS, switched on by the
 * page's `data-season`; this file only says which one, and until when.
 *
 * Festivals that move with the moon (Diwali, Holi) are listed by year, from
 * the published calendars; a year with no entry simply has no festival look
 * rather than a wrong one. scripts/check-seasons.mjs walks a whole year.
 *
 * When two overlap, the one that comes round less often wins: New Year over
 * winter.
 */

export type SeasonKey = 'newyear' | 'diwali' | 'holi' | 'winter' | 'monsoon' | 'spring'

export type Season = {
  key: SeasonKey
  /** What the noticeboard and the passport call it. */
  name: string
  /** What is different on the island. */
  line: string
}

export const SEASONS: Record<SeasonKey, Season> = {
  newyear: { key: 'newyear', name: 'New Year', line: 'Snow, and fireworks over the island all night long.' },
  diwali: { key: 'diwali', name: 'Diwali', line: 'Sky lanterns drifting up over the island, and fireworks after dark.' },
  holi: { key: 'holi', name: 'Holi', line: 'Clouds of coloured powder drifting across the whole island.' },
  winter: { key: 'winter', name: 'Winter', line: 'Snow falling on every district, from the peaks to the harbour.' },
  monsoon: { key: 'monsoon', name: 'Monsoon', line: 'Rain over the island, and a grey, soft light on everything.' },
  spring: { key: 'spring', name: 'Spring', line: 'Blossom drifting down over the island all month.' },
}

/** Diwali (Lakshmi Puja), by year: the festival look runs two days either side. */
export const DIWALI: Record<number, string> = { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26' }
/** Holi (Rangwali Holi), by year: the day itself and the day before. */
export const HOLI: Record<number, string> = { 2026: '03-04', 2027: '03-22', 2028: '03-11', 2029: '03-01', 2030: '03-20' }

const DAY = 864e5
/** Midnight at the start of a local calendar day. */
const local = (y: number, md: string) => { const [m, d] = md.split('-').map(Number); return new Date(y, m - 1, d) }
const within = (d: Date, from: Date, toInclusive: Date) => d >= from && d < new Date(toInclusive.getTime() + DAY)

export type Now = Season & { until: Date }

/** The season on the island on this date (the visitor's own calendar), and when it ends; or null. */
export function seasonOn(d: Date = new Date()): Now | null {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
  const at = (key: SeasonKey, until: Date): Now => ({ ...SEASONS[key], until })
  // New Year's Eve and New Year's Day.
  if (m === 11 && day === 31) return at('newyear', new Date(y + 1, 0, 2))
  if (m === 0 && day === 1) return at('newyear', new Date(y, 0, 2))
  // Diwali: two days either side of the night itself.
  if (DIWALI[y]) {
    const c = local(y, DIWALI[y])
    const from = new Date(c.getTime() - 2 * DAY), to = new Date(c.getTime() + 2 * DAY)
    if (within(d, from, to)) return at('diwali', new Date(to.getTime() + DAY))
  }
  // Holi: the day before and the day.
  if (HOLI[y]) {
    const c = local(y, HOLI[y])
    if (within(d, new Date(c.getTime() - DAY), c)) return at('holi', new Date(c.getTime() + DAY))
  }
  // Winter: December to Twelfth Night.
  if (m === 11) return at('winter', new Date(y + 1, 0, 7))
  if (m === 0 && day <= 6) return at('winter', new Date(y, 0, 7))
  // Monsoon: July and August.
  if (m === 6 || m === 7) return at('monsoon', new Date(y, 8, 1))
  // Spring: April.
  if (m === 3) return at('spring', new Date(y, 4, 1))
  return null
}

/** The next season after this date, and when it starts (for "coming up" on the noticeboard). */
export function nextSeason(d: Date = new Date()): { season: Season; from: Date } | null {
  const now = seasonOn(d)?.key ?? null
  for (let k = 1; k <= 370; k++) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k)
    const s = seasonOn(t)
    if (s && s.key !== now) return { season: SEASONS[s.key], from: t }
  }
  return null
}

/* ---- the seasons this browser has seen, for the passport ---------------- */

export const SEEN_KEY = 'isl-seasons'

export function seasonsSeen(s: Pick<Storage, 'getItem'> | null): SeasonKey[] {
  try {
    const v = JSON.parse(s?.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(v) ? [...new Set(v.filter((k): k is SeasonKey => typeof k === 'string' && k in SEASONS))] : []
  } catch { return [] }
}

/** Note a season seen (only a real one: not one asked for with ?season=). Returns whether it is new. */
export function seeSeason(key: SeasonKey, s: Pick<Storage, 'getItem' | 'setItem'> | null): boolean {
  const seen = seasonsSeen(s)
  if (seen.includes(key)) return false
  try { s?.setItem(SEEN_KEY, JSON.stringify([...seen, key])) } catch { return false }
  return true
}
