/**
 * POST /api/collect/ — the tracker's batches (src/lib/analytics/client.ts).
 *
 * Answers `{ c: 'ask' }` where an ID needs a yes first (the EU, the EEA, the
 * UK and Switzerland), `{ c: 'ok' }` elsewhere; the tracker decides what to
 * store from that. Bots, the admin's own browsing, other sites and anything
 * malformed are turned away without a word.
 */
import type { APIRoute } from 'astro'
import { parseBatch, isBot, mustAsk } from '../../lib/analytics/shape'
import { getDb } from '../../lib/analytics/db'
import { ingest, prune } from '../../lib/analytics/ingest'
import { claim, nightly } from '../../lib/analytics/rollup'
import { isAdmin } from '../../lib/analytics/auth'
import { clientIp, geo, json, foreign, limited, siteHost } from '../../lib/analytics/request'

export const prerender = false

/** When this instance last cleared out old records: once an hour is plenty. */
let pruned = 0

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const g = geo(request)
  const answer = { c: mustAsk(g.country) ? 'ask' : 'ok' }
  if (foreign(request)) return json({}, 403)
  if (await isAdmin(request)) return json({ ...answer, admin: true })
  const len = Number(request.headers.get('content-length') ?? 0)
  if (len > 16_384) return json({}, 413)
  const body = await request.text()
  const now = new Date()
  const batch = parseBatch(body, now.getTime())
  if (!batch) return json({}, 400)
  // A bot is not a visitor, unless it is one of this site's own test runs,
  // which say so and are kept apart (and gone in two days).
  const ua = request.headers.get('user-agent') ?? ''
  if (isBot(ua) && !batch.test) return json(answer)
  const ip = clientIp(request, clientAddress)
  if (limited(ip, 1 + batch.events.length, 900, 600_000)) return json(answer, 429)
  try {
    const d = await getDb()
    await ingest(d, batch, { ip, ua, host: siteHost(request), ...g }, now)
    if (now.getTime() - pruned > 3600_000) {
      pruned = now.getTime()
      await prune(d, now)
      // The nightly summaries and the 90-day trim, once a day, by whichever visit comes first.
      if (await claim(d, now)) await nightly(d, now)
    }
  } catch (e) {
    // Analytics must never break the site: the page has already moved on.
    console.error('collect', (e as Error).message)
    return json(answer, 503)
  }
  return json(answer)
}
