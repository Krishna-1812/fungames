/**
 * POST /api/save/ — save codes (src/lib/saves.ts, lib/sync.ts).
 *
 * One endpoint, by `op`, and all POST so a code is never in a URL:
 * - `make`  {data}            → {code, rev}
 * - `get`   {code}            → {rev, data}, or 404
 * - `put`   {code, rev, data} → {rev}, or 409 with {rev, data} to merge with
 * - `drop`  {code}            → {ok}
 *
 * Reading by code is limited hard per address: a code is 80 random bits, so
 * guessing is hopeless anyway, but nothing here should help anyone try.
 */
import type { APIRoute } from 'astro'
import { getDb } from '../../lib/analytics/db'
import { json, foreign, clientIp, limited } from '../../lib/analytics/request'
import { cleanRecords, makeSave, getSave, putSave, dropSave } from '../../lib/saves'
import { CODE_RE, MAX_ALL } from '../../lib/sync'

export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (foreign(request)) return json({}, 403)
  const ip = clientIp(request, clientAddress)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_ALL * 2) return json({}, 413)
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json({}, 400) }
  const op = body?.op, code = typeof body?.code === 'string' ? body.code : ''
  if (op !== 'make' && !CODE_RE.test(code)) return json({}, 400)
  // Makes are rare; gets and puts happen on page loads and leaving pages.
  if (op === 'make' ? limited('save-make:' + ip, 1, 10, 3_600_000) : limited('save:' + ip, 1, 120, 600_000)) return json({}, 429)
  try {
    const d = await getDb()
    if (op === 'make') {
      const data = cleanRecords(body.data)
      return data ? json(await makeSave(d, data)) : json({}, 400)
    }
    if (op === 'get') {
      const s = await getSave(d, code)
      return s ? json(s) : json({}, 404)
    }
    if (op === 'put') {
      const data = cleanRecords(body.data), rev = body.rev
      if (!data || typeof rev !== 'number' || !Number.isInteger(rev)) return json({}, 400)
      const r = await putSave(d, code, rev, data)
      return !r ? json({}, 404) : r.ok ? json({ rev: r.rev }) : json({ rev: r.rev, data: r.data }, 409)
    }
    if (op === 'drop') return json({ ok: await dropSave(d, code) })
    return json({}, 400)
  } catch (e) {
    console.error('save', (e as Error).message)
    return json({ error: 'unavailable' }, 503)
  }
}
