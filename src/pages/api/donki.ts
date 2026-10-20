/**
 * GET /api/donki/?kind=FLR&start=YYYY-MM-DD&end=YYYY-MM-DD — NASA DONKI's
 * flare (FLR), geomagnetic-storm (GST) and interplanetary-shock (IPS) logs,
 * for Days Since Incident (lib/incident-fetch.ts).
 *
 * Asked from every visitor's own browser, the logs ran on NASA's shared
 * DEMO_KEY, whose hourly allowance is per address and was already spent: three
 * of the page's four sections said the feed did not answer. Through here, the
 * answer is cached at Vercel's edge for an hour, so one request to NASA serves
 * everyone who asks for the same day's window. NASA_API_KEY (a free key from
 * api.nasa.gov) is used when it is set; DEMO_KEY until then.
 *
 * DONKI goes down for whole days (api.nasa.gov then answers 503), so the log
 * is also asked of DONKI's own server, and the last good answer is kept
 * (lib/feed-cache.ts) and given back, marked stale, when neither answers.
 */
import type { APIRoute } from 'astro'
import { remember, recall } from '../../lib/feed-cache'

export const prerender = false

const KINDS = new Set(['FLR', 'GST', 'IPS'])
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** The page never asks for more than five years back (incident-fetch's DEEP_DAYS); a little slack. */
const OLDEST_MS = 6 * 366 * 24 * 3600 * 1000

const reply = (body: string, status: number, cache: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'application/json', 'cache-control': cache, ...extra } })

async function ask(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!r.ok) return null
    const text = (await r.text()).trim()
    // DONKI answers an empty range with an empty body, not [].
    const body = text || '[]'
    return body.startsWith('[') ? body : null
  } catch { return null }
}

export const GET: APIRoute = async ({ url }) => {
  const kind = url.searchParams.get('kind') ?? ''
  const start = url.searchParams.get('start') ?? ''
  const end = url.searchParams.get('end') ?? ''
  const s = Date.parse(start), e = Date.parse(end)
  if (!KINDS.has(kind) || !DAY.test(start) || !DAY.test(end) || !(s <= e) || Date.now() - s > OLDEST_MS || e - Date.now() > 2 * 24 * 3600 * 1000) {
    return reply('{"error":"bad request"}', 400, 'no-store')
  }
  const key = process.env.NASA_API_KEY || 'DEMO_KEY'
  // The same window, by its length: today's answer for "the last 400 days" stands in for yesterday's.
  const memo = `donki:${kind}:${Math.round((e - s) / 864e5)}`
  const body =
    (await ask(`https://api.nasa.gov/DONKI/${kind}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(key)}`)) ??
    (await ask(`https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${kind}?startDate=${start}&endDate=${end}`))
  if (body) {
    await remember(memo, body)
    return reply(body, 200, 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400')
  }
  const old = await recall(memo)
  if (old) return reply(old.body, 200, 'public, s-maxage=300', { 'x-feed-as-of': old.at })
  return reply('{"error":"upstream unavailable"}', 502, 'public, s-maxage=120')
}
