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
 */
import type { APIRoute } from 'astro'

export const prerender = false

const KINDS = new Set(['FLR', 'GST', 'IPS'])
const DAY = /^\d{4}-\d{2}-\d{2}$/
/** The page never asks for more than five years back (incident-fetch's DEEP_DAYS); a little slack. */
const OLDEST_MS = 6 * 366 * 24 * 3600 * 1000

const reply = (body: string, status: number, cache: string) =>
  new Response(body, { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })

export const GET: APIRoute = async ({ url }) => {
  const kind = url.searchParams.get('kind') ?? ''
  const start = url.searchParams.get('start') ?? ''
  const end = url.searchParams.get('end') ?? ''
  const s = Date.parse(start), e = Date.parse(end)
  if (!KINDS.has(kind) || !DAY.test(start) || !DAY.test(end) || !(s <= e) || Date.now() - s > OLDEST_MS || e - Date.now() > 2 * 24 * 3600 * 1000) {
    return reply('{"error":"bad request"}', 400, 'no-store')
  }
  const key = process.env.NASA_API_KEY || 'DEMO_KEY'
  try {
    const r = await fetch(`https://api.nasa.gov/DONKI/${kind}?startDate=${start}&endDate=${end}&api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(25_000) })
    const text = await r.text()
    // DONKI answers an empty range with an empty body, not [].
    const body = r.ok ? (text.trim() ? text : '[]') : ''
    if (!r.ok || !body.startsWith('[')) return reply(`{"error":"upstream ${r.status}"}`, 502, 'public, s-maxage=120')
    return reply(body, 200, 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400')
  } catch {
    return reply('{"error":"upstream timeout"}', 504, 'public, s-maxage=60')
  }
}
