/** GET /api/admin/stats/?days=7&tz=Asia/Kolkata[&test=1] — everything the admin page shows, for a signed-in admin only. */
import type { APIRoute } from 'astro'
import { isAdmin } from '../../../lib/analytics/auth'
import { getDb } from '../../../lib/analytics/db'
import { overview, rangeOf } from '../../../lib/analytics/report'
import { json } from '../../../lib/analytics/request'

export const prerender = false

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await isAdmin(request))) return json({ error: 'signed out' }, 401)
  const r = { ...rangeOf(Number(url.searchParams.get('days') ?? 7), url.searchParams.get('tz') ?? 'UTC'), test: url.searchParams.get('test') === '1' }
  try {
    return json(await overview(await getDb(), r))
  } catch (e) {
    const msg = (e as Error).message
    return json({ error: msg === 'no-db' ? 'No database is connected yet.' : 'The database did not answer: ' + msg.slice(0, 200) }, 503)
  }
}
