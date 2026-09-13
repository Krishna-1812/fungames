/**
 * Days Since Incident — the live loader.
 *
 * Runs entirely in the visitor's own browser, against three real feeds:
 *
 *  - USGS's earthquake catalogue search, which already answers "the single
 *    most recent event at or above magnitude X" directly — one small request
 *    per tier, each at a tier-appropriate lookback window (see
 *    `QUAKE_FAST_LOOKBACK_DAYS` below for why that window can't just be
 *    "since forever" for every tier).
 *  - NASA DONKI's flare/storm/shock logs, which only answer "everything in
 *    this date range" — no magnitude filter, no "most recent" mode. A ten-year
 *    request there is ~1.5MB and took 27 seconds when timed against the real
 *    endpoint while building this. So the load is staged: a fast 400-day pull
 *    renders the page immediately, and only a category still unresolved after
 *    that (the rarest tiers — X10 flares, G5 storms) triggers one further,
 *    slower pull for *that source alone*, reaching back five years.
 *
 * Every network call is wrapped so a genuine failure (the shared DEMO_KEY
 * rate limit, a timeout, the visitor being offline) renders as "the feed
 * didn't answer" rather than as "nothing has ever happened" — those are
 * different facts and the page must not confuse them.
 */
import { SITE } from '../site.config'
import {
  EARTHQUAKE_CATEGORIES,
  FLARE_CATEGORIES,
  STORM_CATEGORIES,
  SHOCK_CATEGORIES,
  parseUsgsFeature,
  parseDonkiFlare,
  parseDonkiStorm,
  parseDonkiShock,
  type IncidentEvent,
  type IncidentCategory,
} from './incident-model'

export type DonkiKind = 'FLR' | 'GST' | 'IPS'

const FAST_DAYS = 400
const DEEP_DAYS = 365 * 5
const DAY_MS = 86_400_000
/** USGS's catalogue is complete for anything this page cares about well before this. */
const EARTHQUAKE_START = '1950-01-01'

const CATEGORIES_BY_KIND: Record<DonkiKind, IncidentCategory[]> = {
  FLR: FLARE_CATEGORIES,
  GST: STORM_CATEGORIES,
  IPS: SHOCK_CATEGORIES,
}
const PARSE_BY_KIND: Record<DonkiKind, (raw: any) => IncidentEvent | null> = {
  FLR: parseDonkiFlare,
  GST: parseDonkiStorm,
  IPS: parseDonkiShock,
}

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

async function fetchDonkiRange(kind: DonkiKind, startEpoch: number, endEpoch: number): Promise<SourceResult> {
  try {
    const url = `https://api.nasa.gov/DONKI/${kind}?startDate=${iso(startEpoch)}&endDate=${iso(endEpoch)}&api_key=${SITE.nasaApiKey}`
    const raw = await getJSON(url, 25_000)
    if (!Array.isArray(raw)) return { events: [], ok: false }
    const events = raw.map(PARSE_BY_KIND[kind]).filter((e): e is IncidentEvent => e != null)
    return { events, ok: true }
  } catch {
    return { events: [], ok: false }
  }
}

async function queryQuake(min: number, starttime: string, timeoutMs: number): Promise<SourceResult> {
  try {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${min}&limit=1&orderby=time&starttime=${starttime}`
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
      const fast = await queryQuake(c.min, fastStart, 10_000)
      if (!fast.ok || fast.events.length) { out.set(c.id, fast); return }
      out.set(c.id, await queryQuake(c.min, EARTHQUAKE_START, 20_000))
    }),
  )
  return out
}

export interface FastLoad {
  quakes: Map<string, SourceResult>
  flr: SourceResult
  gst: SourceResult
  ips: SourceResult
}

/** The immediate pass: fast per-tier earthquake lookups, plus a 400-day DONKI window. */
export async function loadFast(now: number): Promise<FastLoad> {
  const [quakes, flr, gst, ips] = await Promise.all([
    fetchQuakes(now),
    fetchDonkiRange('FLR', now - FAST_DAYS * DAY_MS, now),
    fetchDonkiRange('GST', now - FAST_DAYS * DAY_MS, now),
    fetchDonkiRange('IPS', now - FAST_DAYS * DAY_MS, now),
  ])
  return { quakes, flr, gst, ips }
}

/** The one-shot deeper pull for a single DONKI source, reaching back to five years. Non-overlapping with loadFast's own window. */
export async function loadDeep(kind: DonkiKind, now: number): Promise<SourceResult> {
  return fetchDonkiRange(kind, now - DEEP_DAYS * DAY_MS, now - FAST_DAYS * DAY_MS)
}

export function categoriesFor(kind: DonkiKind): IncidentCategory[] {
  return CATEGORIES_BY_KIND[kind]
}

/* ---- a light, session-scoped cache ---------------------------------------
 * Storage is assumed hostile, same as lib/stats.ts: wrapped in try/catch,
 * never assumed present, never trusted without a shape check. This is not
 * that file's cross-game store — it is one page's own scratch space, so it
 * lives here rather than growing stats.ts a feed-caching feature no other
 * game needs. */

const CACHE_KEY = 'funsite:days-since-incident:v1'
const CACHE_TTL_MS = 15 * 60 * 1000

interface CacheShape {
  at: number
  quakes: [string, SourceResult][]
  flr: SourceResult
  gst: SourceResult
  ips: SourceResult
  deep: Partial<Record<DonkiKind, SourceResult>>
}

export function readCache(now: number): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheShape
    if (typeof parsed?.at !== 'number' || now - parsed.at > CACHE_TTL_MS) return null
    if (!Array.isArray(parsed.quakes) || !parsed.flr || !parsed.gst || !parsed.ips) return null
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
