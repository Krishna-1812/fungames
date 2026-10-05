/** GET /api/health/ — whether analytics is set up: a database and an admin password, as yes or no (never their values). */
import type { APIRoute } from 'astro'
import { getDb, hasDb } from '../../lib/analytics/db'
import { adminPassword } from '../../lib/analytics/auth'
import { json } from '../../lib/analytics/request'

export const prerender = false

export const GET: APIRoute = async () => {
  let db = false
  if (hasDb()) {
    try { await (await getDb()).query('select 1'); db = true } catch { db = false }
  }
  return json({ db, password: !!adminPassword() })
}
