/**
 * GET /api/cron/remind/ — send the hour's daily reminders (src/lib/push.ts).
 *
 * Run every hour by .github/workflows/remind.yml. Anyone may ask: the first
 * request in an hour sends to whoever is due, and every other request that
 * hour does nothing, so there is nothing here worth protecting. With
 * CRON_SECRET set, a bearer token carrying it may also `?force=1` a re-run.
 */
import type { APIRoute } from 'astro'
import { getDb, env } from '../../../lib/analytics/db'
import { json } from '../../../lib/analytics/request'
import { claimHour, remindAll, vapidKeys } from '../../../lib/push'

export const prerender = false

export const GET: APIRoute = async ({ request, url }) => {
  if (!vapidKeys()) return json({ ran: false, why: 'no VAPID keys set' })
  const secret = env('CRON_SECRET')
  const force = !!secret && request.headers.get('authorization') === `Bearer ${secret}` && url.searchParams.get('force') === '1'
  try {
    const d = await getDb()
    if (!force && !(await claimHour(d))) return json({ ran: false, why: 'already ran this hour' })
    return json({ ran: true, ...(await remindAll(d)) })
  } catch (e) {
    console.error('remind cron', (e as Error).message)
    return json({ error: 'unavailable' }, 503)
  }
}
