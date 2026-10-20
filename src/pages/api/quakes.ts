/**
 * GET /api/quakes/?min=4.5&start=YYYY-MM-DD — the most recent earthquake at
 * or above a magnitude since a day, from USGS's catalogue search, for Days
 * Since Incident (lib/incident-fetch.ts).
 *
 * Asked from each browser, a slow day at USGS (twelve seconds an answer) left
 * every row of the sign blank. Asked here, the answer is waited for longer,
 * cached at Vercel's edge for ten minutes so one slow search serves everyone,
 * and the last good answer is kept (lib/feed-cache.ts) for when USGS does not
 * answer at all.
 */
import type { APIRoute } from 'astro'
import { remember, recall } from '../../lib/feed-cache'

export const prerender = false

const DAY = /^\d{4}-\d{2}-\d{2}$/
const reply = (body: string, status: number, cache: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'application/json', 'cache-control': cache, ...extra } })

export const GET: APIRoute = async ({ url }) => {
  const min = Number(url.searchParams.get('min'))
  const start = url.searchParams.get('start') ?? ''
  if (!Number.isFinite(min) || min < 0 || min > 10 || !DAY.test(start) || Date.parse(start) < Date.parse('1900-01-01')) {
    return reply('{"error":"bad request"}', 400, 'no-store')
  }
  const memo = `quake:${min}:${start <= '1950-12-31' ? 'all' : 'recent'}`
  try {
    const r = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${min}&limit=1&orderby=time&starttime=${start}`, { signal: AbortSignal.timeout(25_000) })
    if (r.ok) {
      const j = (await r.json()) as { features?: unknown[] }
      // Only what the page reads: the one event, not the search's metadata.
      const body = JSON.stringify({ features: (j.features ?? []).slice(0, 1) })
      await remember(memo, body)
      return reply(body, 200, 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
    }
  } catch { /* fall through to the last good answer */ }
  const old = await recall(memo)
  if (old) return reply(old.body, 200, 'public, s-maxage=120', { 'x-feed-as-of': old.at })
  return reply('{"error":"upstream unavailable"}', 502, 'public, s-maxage=60')
}
