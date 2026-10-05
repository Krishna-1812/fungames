/** POST /api/forget/ — the privacy page's Forget me: every row held under one visitor ID, deleted. */
import type { APIRoute } from 'astro'
import { isId } from '../../lib/analytics/shape'
import { getDb } from '../../lib/analytics/db'
import { forget } from '../../lib/analytics/ingest'
import { json, foreign, clientIp, limited } from '../../lib/analytics/request'

export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (foreign(request)) return json({}, 403)
  if (limited('forget:' + clientIp(request, clientAddress), 1, 20, 600_000)) return json({}, 429)
  let vid: unknown
  try { vid = (await request.json()).vid } catch { return json({}, 400) }
  if (!isId(vid)) return json({}, 400)
  try {
    return json({ ok: true, views: await forget(await getDb(), vid) })
  } catch {
    return json({ ok: false }, 503)
  }
}
