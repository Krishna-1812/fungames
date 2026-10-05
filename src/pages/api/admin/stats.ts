/**
 * GET /api/admin/stats/?tab=overview&days=7&tz=Asia/Kolkata[&start=&end=][&country=IN][&device=phone][&game=orbit][&test=1]
 *
 * One tab of the admin page at a time (src/lib/analytics/report.ts), for a
 * signed-in admin only. `tab=game&slug=orbit` is one game in depth;
 * `tab=options` is what the filter row can offer.
 */
import type { APIRoute } from 'astro'
import { isAdmin } from '../../../lib/analytics/auth'
import { getDb, type Db } from '../../../lib/analytics/db'
import * as R from '../../../lib/analytics/report'
import { json } from '../../../lib/analytics/request'

export const prerender = false

const TABS = {
  overview: R.overview, live: (d, f) => R.live(d, f), games: R.games, island: R.island, audience: R.audience,
  acquisition: R.acquisition, retention: R.retention, health: R.health, options: R.options,
} satisfies Record<string, (d: Db, f: R.Filter) => Promise<unknown>>

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await isAdmin(request))) return json({ error: 'signed out' }, 401)
  const f = R.filterOf(url.searchParams)
  const tab = url.searchParams.get('tab') ?? 'overview'
  try {
    const d = await getDb()
    if (tab === 'game') {
      const slug = url.searchParams.get('slug') ?? ''
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug)) return json({ error: 'which game?' }, 400)
      return json(await R.game(d, f, slug))
    }
    const run = TABS[tab as keyof typeof TABS]
    if (!run) return json({ error: 'no such tab' }, 400)
    return json(await run(d, f))
  } catch (e) {
    const msg = (e as Error).message
    return json({ error: msg === 'no-db' ? 'No database is connected yet.' : 'The database did not answer: ' + msg.slice(0, 200) }, 503)
  }
}
