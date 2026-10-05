/**
 * GET /api/admin/export/?what=views|events&… (the same filter as stats) — the
 * range's raw rows as CSV, up to 100,000, for a signed-in admin only. No visitor
 * ID or daily hash is in it: an export says what happened, not who did it.
 */
import type { APIRoute } from 'astro'
import { isAdmin } from '../../../lib/analytics/auth'
import { getDb } from '../../../lib/analytics/db'
import { filterOf, rawViews, rawEvents } from '../../../lib/analytics/report'
import { json } from '../../../lib/analytics/request'
import { toCsv } from '../../../lib/analytics/csv'

export const prerender = false

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await isAdmin(request))) return json({ error: 'signed out' }, 401)
  const what = url.searchParams.get('what') === 'events' ? 'events' : 'views'
  const f = filterOf(url.searchParams)
  try {
    const d = await getDb()
    const rs = what === 'events' ? await rawEvents(d, f) : await rawViews(d, f)
    const day = (t: Date) => t.toISOString().slice(0, 10)
    return new Response(toCsv(rs), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${what}-${day(f.from)}-to-${day(f.to)}.csv"`,
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return json({ error: (e as Error).message.slice(0, 200) }, 503)
  }
}
