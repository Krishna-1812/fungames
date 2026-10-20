/**
 * The last good answer from a live feed, kept in the site's database, for the
 * days the feed itself is down (NASA's DONKI has whole days of 503s; USGS's
 * search can take longer than anyone will wait).
 *
 * Days Since Incident counts from the most recent event in each log, so an
 * answer from a few hours or days ago is still the right count unless
 * something new has happened since, which is far better than a blank sign.
 * Everything here fails quietly: with no database, nothing is remembered and
 * the routes behave exactly as they would without it.
 */
import { getDb, hasDb } from './analytics/db'

let made: Promise<void> | null = null
async function table() {
  const db = await getDb()
  made ??= db.query('create table if not exists feed_cache (key text primary key, body text not null, at timestamptz not null default now())').then(() => undefined)
  await made
  return db
}

/** Keep a good answer. */
export async function remember(key: string, body: string): Promise<void> {
  if (!hasDb()) return
  try {
    const db = await table()
    await db.query('insert into feed_cache (key, body, at) values ($1, $2, now()) on conflict (key) do update set body = excluded.body, at = excluded.at', [key, body])
  } catch { made = null }
}

/** The last good answer, and when it was got; null if there is none. */
export async function recall(key: string): Promise<{ body: string; at: string } | null> {
  if (!hasDb()) return null
  try {
    const db = await table()
    const rows = await db.query<{ body: string; at: string | Date }>('select body, at from feed_cache where key = $1', [key])
    return rows[0] ? { body: rows[0].body, at: new Date(rows[0].at).toISOString() } : null
  } catch { made = null; return null }
}
