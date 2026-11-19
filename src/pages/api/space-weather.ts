/**
 * GET /api/space-weather/ — every space-weather row of Days Since Incident,
 * and the instruments' last few weeks, in one small answer.
 *
 * Asked of NASA's DONKI alone, the page went blank whenever DONKI did (the
 * shared DEMO_KEY spent, its host down for days). Now each row is answered
 * by whoever answers (lib/space-weather.ts): NOAA SWPC's GOES flare list,
 * Kp from GFZ Potsdam and SWPC, DONKI's shock log when it answers, SWPC's
 * sudden-impulse summaries when it does not. Their answers are merged with
 * what this route has remembered (lib/feed-cache.ts) and with the seed read
 * from the full records at build time (data/incident-seed.ts), the most
 * recent event per row winning. One feed down now costs nothing; all of
 * them down costs only freshness, and the answer says so.
 *
 * Cached at Vercel's edge for ten minutes, so the feeds are asked a few
 * times an hour however many people are looking.
 */
import type { APIRoute } from 'astro'
import { remember, recall } from '../../lib/feed-cache'
import { env } from '../../lib/analytics/db'
import { SEED, SEED_AS_OF } from '../../data/incident-seed'
import {
  parseSwpcFlare, parseGfz, parseDonkiIps, parseSuddenImpulse, kpStorms, swpcKpRows, xrayTrace, kpTrace,
  mergeLatest, latestList, type Latest, type SourcedEvent, type GfzKp,
} from '../../lib/space-weather'
import { FLARE_CATEGORIES } from '../../lib/incident-model'

export const prerender = false

const DAY = 86_400_000
const SWPC = 'https://services.swpc.noaa.gov'
const iso = (t: number) => new Date(t).toISOString().slice(0, 19) + 'Z'

async function get(url: string, ms = 9000): Promise<unknown | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } })
    if (!r.ok) return null
    const text = (await r.text()).trim()
    return text ? JSON.parse(text) : []
  } catch { return null }
}

type Trace = { t0: number; step: number; v: (number | null)[] }
type Memory = { latest: Latest; xray?: Trace; kp?: Trace; heard: Record<string, number> }

export const GET: APIRoute = async () => {
  const now = Date.now()
  const key = env('NASA_API_KEY') || 'DEMO_KEY'
  const [flares, xrays, swpcKp, gfz, alerts, ips, memRaw] = await Promise.all([
    get(`${SWPC}/json/goes/primary/xray-flares-7-day.json`),
    get(`${SWPC}/json/goes/primary/xrays-7-day.json`),
    get(`${SWPC}/products/noaa-planetary-k-index.json`),
    get(`https://kp.gfz.de/app/json/?start=${iso(now - 35 * DAY)}&end=${iso(now)}&index=Kp`),
    get(`${SWPC}/products/alerts.json`),
    get(`https://api.nasa.gov/DONKI/IPS?startDate=${iso(now - 400 * DAY).slice(0, 10)}&endDate=${iso(now + DAY).slice(0, 10)}&api_key=${encodeURIComponent(key)}`),
    recall('sw:v1'),
  ])
  let mem: Memory | null = null
  try { mem = memRaw ? JSON.parse(memRaw.body) : null } catch { mem = null }

  const list = <T,>(x: unknown, f: (r: T) => SourcedEvent | null) => (Array.isArray(x) ? (x as T[]).map(f).filter((e): e is SourcedEvent => !!e) : [])
  const gfzOk = !!gfz && Array.isArray((gfz as GfzKp).Kp)
  // SWPC's Kp is an estimate made as it happens; GFZ's is the index itself.
  // Where GFZ has spoken, SWPC's estimate stands only for the hours after.
  const gfzLast = gfzOk ? Date.parse(((gfz as GfzKp).datetime ?? []).at(-1) ?? '') || 0 : 0
  const kpRows = swpcKpRows(swpcKp).filter((r) => r.time > gfzLast)
  const settled = [
    ...list(flares, parseSwpcFlare),
    ...(gfzOk ? parseGfz(gfz as GfzKp) : []),
    ...list(ips, parseDonkiIps),
    ...list(alerts, parseSuddenImpulse),
  ]
  // What is kept is only what will not be revised; the estimate is shown, not remembered.
  const keep = mergeLatest(SEED, latestList(mem?.latest), settled)
  const latest = mergeLatest(latestList(keep), kpStorms(kpRows.map((r) => r.time), kpRows.map((r) => r.kp), 'NOAA SWPC, estimated'))

  // The instruments' traces: today's if they came, else the last ones seen.
  const xray = Array.isArray(xrays) && xrays.length ? xrayTrace(xrays as never[]) : mem?.xray ?? null
  const gfzRows = gfzOk ? (gfz as Required<GfzKp>).datetime.map((d, i) => ({ time: Date.parse(d), kp: (gfz as Required<GfzKp>).Kp[i] })) : []
  const kp = gfzRows.length || kpRows.length ? kpTrace([kpRows, gfzRows], now) : mem?.kp ?? null

  // Who answered this time, and when each was last heard from.
  const heard = { ...(mem?.heard ?? {}) }
  const answered = { 'NOAA SWPC': Array.isArray(flares) || Array.isArray(swpcKp), 'GFZ Potsdam': gfzOk, 'NASA DONKI': Array.isArray(ips) }
  for (const [name, ok] of Object.entries(answered)) if (ok) heard[name] = now

  const next: Memory = { latest: keep, xray: xray ?? undefined, kp: kp ?? undefined, heard }
  if (Object.values(answered).some(Boolean)) await remember('sw:v1', JSON.stringify(next))

  // The flares worth naming on the X-ray trace, and the shocks on the Kp one.
  const since = (t: number) => (e: SourcedEvent) => e.time >= t
  const marks = {
    flares: list(flares, parseSwpcFlare).filter((e) => e.value >= FLARE_CATEGORIES[1].min).map((e) => ({ time: e.time, cls: e.detail.split(' ')[1] })),
    shocks: [...list(ips, parseDonkiIps), ...list(alerts, parseSuddenImpulse)].filter(since(now - 31 * DAY)).map((e) => e.time),
  }

  const body = JSON.stringify({ now, seedAsOf: SEED_AS_OF, latest, heard, answered, xray, kp, marks })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400' },
  })
}
