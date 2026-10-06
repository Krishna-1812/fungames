/**
 * GET /api/cron/nightly/ — the nightly summaries and the 90-day trim
 * (src/lib/analytics/rollup.ts), called by a Vercel cron at 03:17 UTC
 * (vercel.json's `crons`).
 *
 * With CRON_SECRET set in Vercel, only a request carrying it (Vercel's cron
 * sends it as a bearer token) or the signed-in admin can run it. Without it,
 * anyone may ask, but it runs at most once in twenty hours, and every run is
 * harmless: it counts days afresh and trims what is past keeping anyway.
 * `?force=1` (the admin only) runs it now.
 */
import type { APIRoute } from 'astro'
import { getDb, env } from '../../../lib/analytics/db'
import { isAdmin } from '../../../lib/analytics/auth'
import { due, nightly } from '../../../lib/analytics/rollup'
import { json } from '../../../lib/analytics/request'

export const prerender = false

export const GET: APIRoute = async ({ request, url }) => {
  const secret = env('CRON_SECRET')
  const admin = await isAdmin(request)
  const bearer = request.headers.get('authorization') === `Bearer ${secret}`
  if (secret && !bearer && !admin) return json({ error: 'not allowed' }, 401)
  try {
    const d = await getDb()
    const force = admin && url.searchParams.get('force') === '1'
    if (!force && !(await due(d, new Date(), 20))) return json({ ran: false, why: 'ran within the last 20 hours' })
    return json(await nightly(d))
  } catch (e) {
    const msg = (e as Error).message
    console.error('nightly', msg)
    return json({ error: msg === 'no-db' ? 'No database is connected yet.' : msg.slice(0, 200) }, 503)
  }
}
