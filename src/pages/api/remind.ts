/**
 * /api/remind/ — daily reminders (src/lib/push.ts).
 *
 * GET says whether reminders can be had here (the site's public key, or null
 * when Vercel has no VAPID keys yet). POST, by `op`:
 * - `on`   {sub, tz, hour, streak, through, done}: remind this browser at `hour` where it is
 * - `done` {endpoint, streak, through}: today's challenge is played; no reminder today
 * - `off`  {endpoint}: stop
 */
import type { APIRoute } from 'astro'
import { getDb } from '../../lib/analytics/db'
import { json, foreign, clientIp, limited } from '../../lib/analytics/request'
import { vapidKeys, okEndpoint, okTz } from '../../lib/push'

export const prerender = false

const B64U = /^[A-Za-z0-9_-]{16,120}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayOrNull = (v: unknown) => (typeof v === 'string' && DAY.test(v) ? v : null)
const small = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(9999, Math.floor(v))) : 0)

export const GET: APIRoute = () => json({ key: vapidKeys()?.publicKey ?? null }, 200, { 'cache-control': 'public, max-age=300' })

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (foreign(request)) return json({}, 403)
  if (limited('remind:' + clientIp(request, clientAddress), 1, 30, 600_000)) return json({}, 429)
  if (!vapidKeys()) return json({ error: 'off' }, 503)
  let b: Record<string, unknown>
  try { b = await request.json() } catch { return json({}, 400) }
  try {
    const d = await getDb()
    if (b.op === 'on') {
      const sub = b.sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
      const endpoint = sub?.endpoint, p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth, hour = b.hour
      if (!okEndpoint(endpoint) || typeof p256dh !== 'string' || !B64U.test(p256dh) || typeof auth !== 'string' || !B64U.test(auth)) return json({}, 400)
      if (!okTz(b.tz) || typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return json({}, 400)
      await d.query(
        `insert into push_subs (endpoint, p256dh, auth, tz, hour, streak, through, done) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz, hour = excluded.hour, streak = excluded.streak, through = excluded.through, done = coalesce(excluded.done, push_subs.done)`,
        [endpoint, p256dh, auth, b.tz, hour, small(b.streak), dayOrNull(b.through), dayOrNull(b.done)],
      )
      return json({ ok: true })
    }
    if (!okEndpoint(b.endpoint)) return json({}, 400)
    if (b.op === 'done') {
      await d.query('update push_subs set done = $2, streak = $3, through = $4 where endpoint = $1', [b.endpoint, new Date().toISOString().slice(0, 10), small(b.streak), dayOrNull(b.through)])
      return json({ ok: true })
    }
    if (b.op === 'off') {
      await d.query('delete from push_subs where endpoint = $1', [b.endpoint])
      return json({ ok: true })
    }
    return json({}, 400)
  } catch (e) {
    console.error('remind', (e as Error).message)
    return json({ error: 'unavailable' }, 503)
  }
}
