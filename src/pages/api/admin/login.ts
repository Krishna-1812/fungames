/** POST /api/admin/login/ — the admin page's password, swapped for a session cookie. */
import type { APIRoute } from 'astro'
import { adminPassword, passwordMatches, signSession, cookieHeader } from '../../../lib/analytics/auth'
import { json, foreign, clientIp, limited, isHttps } from '../../../lib/analytics/request'

export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (foreign(request)) return json({}, 403)
  const real = adminPassword()
  if (!real) return json({ error: 'ADMIN_PASSWORD is not set in Vercel yet.' }, 503)
  // Ten tries in ten minutes from one address, then a wait.
  if (limited('login:' + clientIp(request, clientAddress), 1, 10, 600_000)) return json({ error: 'Too many tries. Wait ten minutes.' }, 429)
  let typed = ''
  try { typed = String((await request.json()).password ?? '') } catch { return json({}, 400) }
  // A steady pause either way, so the answer's timing says nothing.
  await new Promise((r) => setTimeout(r, 400))
  if (!(await passwordMatches(real, typed))) return json({ error: 'That is not the password.' }, 401)
  const secure = isHttps(request)
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(await signSession(real), secure) })
}
