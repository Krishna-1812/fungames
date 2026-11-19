/**
 * Days Since Incident — the Sun and the Earth's magnetic field, from more
 * than one place.
 *
 * The page first read every space-weather row from NASA's DONKI log. DONKI is
 * a good log, but it is one server on one shared key: on Vercel the free
 * DEMO_KEY is spent by other people's apps before ours asks, and DONKI's own
 * host goes quiet for days. When it did, eleven of the sixteen rows on the
 * sign went blank at once.
 *
 * So each row is now answered by whoever answers, and the answers are merged
 * by the one rule the page has always had: the most recent qualifying event
 * wins.
 *
 *  - Solar flares: NOAA SWPC's own GOES flare list for the last week (the
 *    very instrument the classes are defined on), HEK's copy of the SWPC
 *    list for history, and DONKI when it answers.
 *  - Geomagnetic storms: the Kp index itself, from GFZ Potsdam (the body
 *    that computes the official Kp, back to 1932) and SWPC's estimate for the
 *    last week; a storm is any three hours at Kp 5 or more, its G-level
 *    NOAA's own from that Kp.
 *  - Interplanetary shocks: DONKI when it answers; otherwise SWPC's "sudden
 *    impulse" summaries, the jolt the Earth's field gives when a shock
 *    arrives.
 *
 * All of it is pure: the server route (pages/api/space-weather.ts) fetches,
 * this turns raw answers into events, and check-space-weather.mjs holds it to
 * real captured shapes.
 */
import {
  FLARE_CATEGORIES, STORM_CATEGORIES, SHOCK_CATEGORIES, flareFlux, mostRecentQualifying,
  type IncidentEvent, type IncidentCategory,
} from './incident-model'

export const SPACE_CATEGORIES: IncidentCategory[] = [...FLARE_CATEGORIES, ...STORM_CATEGORIES, ...SHOCK_CATEGORIES]

/** A remembered or reported event, with where it came from. */
export type SourcedEvent = IncidentEvent & { src: string }
export type Latest = Record<string, SourcedEvent | null>

/* -------------------------------------------------------------------------- */
/* Flares                                                                       */
/* -------------------------------------------------------------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "14:02 UTC" — the page says the date itself. */
const utc = (t: number) => { const d = new Date(t); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC` }

/** A GOES class written the way NOAA writes it: "M2.3", "X1.0". Anything else is not a flare. */
function flare(cls: string, at: string | number | undefined, src: string, region?: number): SourcedEvent | null {
  if (!cls || at == null) return null
  // HEK writes the big ones with a bare point: "X17." for X17.
  const c = cls.trim().toUpperCase().replace(/\.$/, '')
  const value = flareFlux(c)
  const time = typeof at === 'number' ? at : Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(at) ? at : at + 'Z')
  if (value == null || !Number.isFinite(time)) return null
  const where = region ? `, from sunspot region ${region}` : ''
  return { kind: 'flare', time, value, detail: `Class ${c} solar flare${where}, peaking ${utc(time)}`, src }
}

/** One row of SWPC's xray-flares-7-day.json. */
export type SwpcFlare = { max_time?: string; max_class?: string; begin_time?: string }
export const parseSwpcFlare = (r: SwpcFlare) => flare(r.max_class ?? '', r.max_time ?? r.begin_time, 'NOAA SWPC')

/** One row of HEK's flare search, SWPC's list as LMSAL keeps it. */
export type HekFlare = { event_peaktime?: string; fl_goescls?: string; ar_noaanum?: number }
export const parseHekFlare = (r: HekFlare) => flare(r.fl_goescls ?? '', r.event_peaktime, 'NOAA SWPC via HEK', r.ar_noaanum || undefined)

/** One row of DONKI's FLR log. */
export type DonkiFlr = { classType?: string; peakTime?: string | null; beginTime?: string; activeRegionNum?: number | null }
export const parseDonkiFlr = (r: DonkiFlr) => flare(r.classType ?? '', r.peakTime ?? r.beginTime, 'NASA DONKI', r.activeRegionNum ?? undefined)

/* -------------------------------------------------------------------------- */
/* Storms, from Kp                                                              */
/* -------------------------------------------------------------------------- */

/** Kp is published in thirds: 5- 5o 5+ are 4.667, 5, 5.333. */
export function kpName(kp: number): string {
  const whole = Math.round(kp)
  const third = Math.round((kp - whole) * 3)
  return `${whole}${third > 0 ? '+' : third < 0 ? '-' : ''}`
}
/** NOAA's G-level for a Kp: G1 at 5, up to G5 at 9. Zero below a storm. */
export const gLevel = (kp: number) => (kp >= 4.99 ? Math.min(5, Math.floor(kp + 0.01) - 4) : 0)

/**
 * Three-hour Kp readings, as the times their intervals start and the values,
 * into storm events: every interval at Kp 5 or more is one, so the most
 * recent at each G-level is simply the most recent interval at that Kp.
 */
export function kpStorms(times: (string | number)[], kp: number[], src: string): SourcedEvent[] {
  const out: SourcedEvent[] = []
  for (let i = 0; i < Math.min(times.length, kp.length); i++) {
    const v = kp[i]
    if (!(v >= 4.99)) continue
    const raw = times[i]
    const time = typeof raw === 'number' ? raw : Date.parse(/Z$/.test(raw) ? raw : raw + 'Z')
    if (!Number.isFinite(time)) continue
    out.push({ kind: 'storm', time, value: Math.round(v * 1000) / 1000, detail: `G${gLevel(v)} storm, Kp ${kpName(v)} for the three hours from ${utc(time)}`, src })
  }
  return out
}

/** GFZ's JSON: parallel arrays. */
export type GfzKp = { datetime?: string[]; Kp?: number[] }
export const parseGfz = (j: GfzKp) => kpStorms(j.datetime ?? [], j.Kp ?? [], 'GFZ Potsdam')

/** SWPC's noaa-planetary-k-index.json: objects with time_tag and Kp (older copies: a header row then arrays). */
export function swpcKpRows(j: unknown): { time: number; kp: number }[] {
  if (!Array.isArray(j)) return []
  const rows: { time: number; kp: number }[] = []
  for (const r of j) {
    let tag: unknown, kp: unknown
    if (Array.isArray(r)) { tag = r[0]; kp = Number(r[1]) } else if (r && typeof r === 'object') { tag = (r as any).time_tag; kp = Number((r as any).Kp ?? (r as any).kp_index) }
    if (typeof tag !== 'string' || !Number.isFinite(kp as number)) continue
    const time = Date.parse(/Z$/.test(tag) ? tag : tag.replace(' ', 'T') + 'Z')
    if (Number.isFinite(time)) rows.push({ time, kp: kp as number })
  }
  return rows
}

/* -------------------------------------------------------------------------- */
/* Shocks                                                                       */
/* -------------------------------------------------------------------------- */

/** One row of DONKI's IPS log. */
export type DonkiIps = { eventTime?: string; location?: string; instruments?: { displayName?: string }[] }
export function parseDonkiIps(r: DonkiIps): SourcedEvent | null {
  const time = Date.parse(r.eventTime ?? '')
  if (!Number.isFinite(time)) return null
  const craft = r.instruments?.[0]?.displayName?.split(':')[0]?.trim()
  const where = craft ? ` by ${craft}` : r.location ? ` at ${r.location}` : ''
  return { kind: 'shock', time, value: 1, detail: `Interplanetary shock detected${where}, ${utc(time)}`, src: 'NASA DONKI' }
}

/**
 * SWPC's alert feed: a "SUMMARY: Geomagnetic Sudden Impulse" is the
 * ground's record of a shock arriving, with the minute it was observed
 * ("Observed: 2024 May 10 1705 UTC").
 */
export type SwpcAlert = { message?: string; issue_datetime?: string }
export function parseSuddenImpulse(a: SwpcAlert): SourcedEvent | null {
  const m = /SUMMARY:\s*Geomagnetic Sudden Impulse[\s\S]*?Observed:\s*(\d{4})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2})(\d{2})\s*UTC/i.exec(a.message ?? '')
  if (!m) return null
  const mon = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase())
  if (mon < 0) return null
  const time = Date.UTC(+m[1], mon, +m[3], +m[4], +m[5])
  const dev = /Deviation:\s*(\d+)\s*nT/i.exec(a.message ?? '')
  return { kind: 'shock', time, value: 1, detail: `A shock reached the Earth: a ${dev ? dev[1] + ' nT ' : ''}sudden impulse in the magnetic field, ${utc(time)}`, src: 'NOAA SWPC' }
}

/* -------------------------------------------------------------------------- */
/* Merging                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The most recent qualifying event per category, from every list given: the
 * seed baked at build time, what the server remembered, and what answered
 * now. A source that is down simply contributes nothing.
 */
export function mergeLatest(...lists: (SourcedEvent | null | undefined)[][]): Latest {
  const all = lists.flat().filter((e): e is SourcedEvent => !!e)
  const out: Latest = {}
  for (const c of SPACE_CATEGORIES) out[c.id] = mostRecentQualifying(all, c) as SourcedEvent | null
  return out
}
/** A Latest as a plain list, for merging again. */
export const latestList = (l: Latest | null | undefined): SourcedEvent[] => Object.values(l ?? {}).filter((e): e is SourcedEvent => !!e)

/* -------------------------------------------------------------------------- */
/* The instruments' traces                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The GOES long-band X-ray flux (0.1–0.8 nm, the band flare classes are
 * read on) as the largest value in each `stepMin` minutes, log10 W/m²,
 * from SWPC's one-minute series. A gap stays a gap (null).
 */
export function xrayTrace(rows: { time_tag?: string; flux?: number; energy?: string }[], stepMin = 10): { t0: number; step: number; v: (number | null)[] } {
  const step = stepMin * 60_000
  const pts: [number, number][] = []
  for (const r of rows) {
    if (r.energy !== '0.1-0.8nm' || !(typeof r.flux === 'number' && r.flux > 0) || !r.time_tag) continue
    const t = Date.parse(r.time_tag)
    if (Number.isFinite(t)) pts.push([t, r.flux])
  }
  if (!pts.length) return { t0: 0, step, v: [] }
  pts.sort((a, b) => a[0] - b[0])
  const t0 = Math.floor(pts[0][0] / step) * step
  const n = Math.floor((pts[pts.length - 1][0] - t0) / step) + 1
  const v: (number | null)[] = new Array(n).fill(null)
  for (const [t, f] of pts) {
    const i = Math.floor((t - t0) / step)
    const l = Math.round(Math.log10(f) * 1000) / 1000
    if (v[i] == null || l > (v[i] as number)) v[i] = l
  }
  return { t0, step, v }
}

/**
 * Three-hourly Kp over the last `days`, the most recent reading per interval
 * winning (SWPC's estimate is replaced by GFZ's figure where both exist; the
 * caller passes GFZ last). A missing interval is null.
 */
export function kpTrace(sources: { time: number; kp: number }[][], now: number, days = 30): { t0: number; step: number; v: (number | null)[] } {
  const step = 3 * 3600_000
  const t0 = Math.floor((now - days * 86_400_000) / step) * step
  const n = Math.floor((now - t0) / step) + 1
  const v: (number | null)[] = new Array(n).fill(null)
  for (const list of sources) for (const { time, kp } of list) {
    const i = Math.round((time - t0) / step)
    if (i >= 0 && i < n && Number.isFinite(kp)) v[i] = Math.round(kp * 1000) / 1000
  }
  return { t0, step, v }
}
