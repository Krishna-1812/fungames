/**
 * Days Since Incident — the live loader.
 *
 * Runs in the visitor's own browser, against two of this site's own cached
 * routes:
 *
 *  - /api/quakes/ — USGS's earthquake catalogue search, which already answers
 *    "the single most recent event at or above magnitude X" directly: one
 *    small request per tier, each at a tier-appropriate lookback window (see
 *    `QUAKE_FAST_LOOKBACK_DAYS` below for why that window can't just be
 *    "since forever" for every tier).
 *  - /api/space-weather/ — every flare, storm and shock row in one answer,
 *    merged on the server from NOAA SWPC, GFZ Potsdam and NASA DONKI with
 *    what it remembers and a seed read from the full records
 *    (lib/space-weather.ts), along with the X-ray and Kp traces the page
 *    draws.
 *
 * Every network call is wrapped so a genuine failure (a timeout, the visitor
 * being offline) renders as "the feed didn't answer" rather than as
 * "nothing has ever happened" — those are different facts and the page must
 * not confuse them.
 */
import { withBase } from './base'
import { EARTHQUAKE_CATEGORIES, parseUsgsFeature, type IncidentEvent } from './incident-model'
import type { Latest } from './space-weather'

const DAY_MS = 86_400_000
/** USGS's catalogue is complete for anything this page cares about well before this. */
const EARTHQUAKE_START = '1950-01-01'

const iso = (epochMs: number) => new Date(epochMs).toISOString().slice(0, 10)

async function getJSON(url: string, timeoutMs: number): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/**
 * How far back to search first, per magnitude tier. Discovered live, not
 * guessed: `minmagnitude=2.5&starttime=1950-01-01` — a fine query for a rare
 * tier — took USGS 20 real seconds and came back a 503, because a 76-year
 * window over the single most common tier is an enormous scan even with
 * `limit=1`. M2.5+ happens many times a day worldwide, so it is always in
 * the last few days; only the rare tiers genuinely need to look far back.
 * A tier that comes back empty at its fast window still gets the distant
 * fallback below — this is a speed floor, not a correctness one.
 */
const QUAKE_FAST_LOOKBACK_DAYS: Record<string, number> = {
  'eq-2.5': 5,
  'eq-4.5': 30,
  'eq-6.0': 200,
  'eq-7.0': 500,
  'eq-8.0': 1800,
}

export interface SourceResult {
  events: IncidentEvent[]
  /** False if the request itself failed — distinct from "found nothing". */
  ok: boolean
}

/** The instruments' recent traces, as the route sends them: log10 W/m² for X-rays, Kp for the field. */
export type Trace = { t0: number; step: number; v: (number | null)[] }
export interface SpaceAnswer {
  now: number
  seedAsOf: number
  latest: Latest
  heard: Record<string, number>
  answered: Record<string, boolean>
  xray: Trace | null
  kp: Trace | null
  marks: { flares: { time: number; cls: string }[]; shocks: number[] }
}

async function fetchSpace(): Promise<SpaceAnswer | null> {
  try {
    const j = await getJSON(withBase('/api/space-weather/'), 30_000)
    return j && typeof j === 'object' && j.latest ? (j as SpaceAnswer) : null
  } catch {
    return null
  }
}

async function queryQuake(min: number, starttime: string, timeoutMs: number): Promise<SourceResult> {
  try {
    // Through the site's own cached route (pages/api/quakes.ts): one slow USGS search serves every visitor.
    const url = withBase(`/api/quakes/?min=${min}&start=${starttime}`)
    const j = await getJSON(url, timeoutMs)
    const f = j?.features?.[0]
    return { events: f ? [parseUsgsFeature(f)] : [], ok: true }
  } catch {
    return { events: [], ok: false }
  }
}

/** One request per magnitude tier at a tier-appropriate window, widening to the
 *  full record only for a tier whose fast window came back genuinely empty. */
async function fetchQuakes(now: number): Promise<Map<string, SourceResult>> {
  const out = new Map<string, SourceResult>()
  await Promise.all(
    EARTHQUAKE_CATEGORIES.map(async (c) => {
      const fastStart = iso(now - QUAKE_FAST_LOOKBACK_DAYS[c.id] * DAY_MS)
      const fast = await queryQuake(c.min, fastStart, 30_000)
      if (!fast.ok || fast.events.length) { out.set(c.id, fast); return }
      out.set(c.id, await queryQuake(c.min, EARTHQUAKE_START, 35_000))
    }),
  )
  return out
}

export interface FastLoad {
  quakes: Map<string, SourceResult>
  flr: SourceResult
  gst: SourceResult
  ips: SourceResult
  space: SpaceAnswer | null
}

/** Everything at once: per-tier earthquake lookups, and the space-weather answer. */
export async function loadFast(now: number): Promise<FastLoad> {
  const [quakes, space] = await Promise.all([fetchQuakes(now), fetchSpace()])
  const of = (kind: IncidentEvent['kind']): SourceResult => ({
    events: Object.values(space?.latest ?? {}).filter((e): e is IncidentEvent & { src: string } => !!e && e.kind === kind),
    ok: !!space,
  })
  const ips = of('shock')
  // A shock row with nothing to show and DONKI silent is a feed that did not answer, not a quiet Sun.
  if (space && !ips.events.length && !space.answered['NASA DONKI']) ips.ok = false
  return { quakes, flr: of('flare'), gst: of('storm'), ips, space }
}

/* ---- a light, session-scoped cache ---------------------------------------
 * Storage is assumed hostile, same as lib/stats.ts: wrapped in try/catch,
 * never assumed present, never trusted without a shape check. This is not
 * that file's cross-game store — it is one page's own scratch space, so it
 * lives here rather than growing stats.ts a feed-caching feature no other
 * game needs. */

const CACHE_KEY = 'funsite:days-since-incident:v2'
const CACHE_TTL_MS = 15 * 60 * 1000

interface CacheShape {
  at: number
  quakes: [string, SourceResult][]
  flr: SourceResult
  gst: SourceResult
  ips: SourceResult
  space: SpaceAnswer | null
}

export function readCache(now: number): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (typeof parsed?.at !== 'number' || now - parsed.at > CACHE_TTL_MS) return null
    if (!Array.isArray(parsed.quakes) || !parsed.flr || !parsed.gst || !parsed.ips) return null
    // A feed that failed is asked again, not remembered: the page says "try reloading", so reloading must try.
    if (!parsed.flr.ok || !parsed.gst.ok || !parsed.space || parsed.quakes.some(([, r]) => !r?.ok)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCache(entry: Omit<CacheShape, 'at'>, now: number): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...entry, at: now }))
  } catch {
    /* full, blocked, or private mode — the page still works, just refetches next time */
  }
}
