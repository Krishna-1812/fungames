/**
 * GET /api/crowd/?g=<game> — how everyone else answered the questions a game
 * shows back to its players (lib/analytics/crowd.ts): counts only, groups too
 * small to mean anything left out. Vercel's edge keeps each game's answer for
 * ten minutes, so a busy page costs the database one query per game per ten
 * minutes, not one per player.
 */
import type { APIRoute } from 'astro'
import { getDb, hasDb } from '../../lib/analytics/db'
import { crowdFor, PUBLIC } from '../../lib/analytics/crowd'
import { json } from '../../lib/analytics/request'

export const prerender = false

const CACHED = { 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' }

export const GET: APIRoute = async ({ url }) => {
  const game = url.searchParams.get('g') ?? ''
  if (!Object.hasOwn(PUBLIC, game)) return json({}, 404)
  if (!hasDb()) return json({ q: {} }, 200, CACHED)
  try {
    return json({ q: await crowdFor(await getDb(), game) }, 200, CACHED)
  } catch (e) {
    console.error('crowd', (e as Error).message)
    return json({}, 503)
  }
}
