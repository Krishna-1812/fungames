/** POST /api/admin/logout/ — the session cookie, cleared. */
import type { APIRoute } from 'astro'
import { cookieHeader } from '../../../lib/analytics/auth'
import { json, isHttps } from '../../../lib/analytics/request'

export const prerender = false

export const POST: APIRoute = ({ request }) =>
  json({ ok: true }, 200, { 'set-cookie': cookieHeader('', isHttps(request), 0) })
