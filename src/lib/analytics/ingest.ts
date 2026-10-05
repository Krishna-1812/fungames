/**
 * Analytics: writing a batch. The endpoint (src/pages/api/collect.ts) reads
 * the request; this writes what it found, so the checker can run the same
 * code against a real Postgres with no HTTP in between.
 */
import type { Batch } from './shape'
import { parseUa, parseRef, slugOf } from './shape'
import { dailyHash, type Db } from './db'

/** What the request itself says, before it is forgotten. */
export type Origin = {
  ip: string
  ua: string
  /** This site's host, to tell its own pages from other sites in a referrer. */
  host: string
  country: string | null
  region: string | null
  city: string | null
  lat: number | null
  lon: number | null
}

export async function ingest(d: Db, b: Batch, o: Origin, now = new Date()): Promise<void> {
  const dh = await dailyHash(d, o.ip, o.ua, now)
  if (b.view) {
    const v = b.view
    const dev = parseUa(o.ua, !!v.touch && (v.sw ?? 0) >= 700)
    const r = parseRef(v.ref, o.host)
    const cols: Record<string, unknown> = {
      pid: b.pid, ts: now, seen: now, vid: b.vid, dh, test: b.test, consent: b.consent,
      path: v.path, game: v.status === 404 ? null : slugOf(v.path), title: v.title ?? null, status: v.status ?? null,
      ref_host: r.ref_host, ref_path: r.ref_path, from_path: r.from_path, sref: v.sref ?? null,
      utm_source: v.utm_source ?? null, utm_medium: v.utm_medium ?? null, utm_campaign: v.utm_campaign ?? null,
      country: o.country, region: o.region, city: o.city, lat: o.lat, lon: o.lon,
      device: dev.device, os: dev.os, browser: dev.browser, bver: dev.bver || null,
      sw: v.sw ?? null, sh: v.sh ?? null, vw: v.vw ?? null, vh: v.vh ?? null, dpr: v.dpr ?? null, touch: v.touch ?? null,
      lang: v.lang ?? null, tz: v.tz ?? null, dark: v.dark ?? null, rm: v.rm ?? null, conn: v.conn ?? null,
      mem: v.mem ?? null, cpu: v.cpu ?? null,
      first_days: v.first_days ?? null, games_seen: v.games_seen ?? null, visit_days: v.visit_days ?? null,
    }
    const keys = Object.keys(cols)
    await d.query(
      `insert into views (${keys.join(', ')}) values (${keys.map((_, i) => '$' + (i + 1)).join(', ')}) on conflict (pid) do nothing`,
      keys.map((k) => cols[k]),
    )
  }
  // Every batch says the page is still open, and may bring an ID the
  // visitor agreed to after the page's first batch had gone.
  await d.query(
    `update views set seen = $2, vid = coalesce(vid, $3),
       engaged_ms = greatest(engaged_ms, $4), scroll = greatest(scroll, $5),
       consent = coalesce($6, consent)
     where pid = $1`,
    [b.pid, now, b.vid, Math.round(b.eng?.ms ?? 0), Math.round(b.eng?.scroll ?? 0), b.consent],
  )
  if (b.events.length) {
    const vals: unknown[] = []
    const rows = b.events.map((e, i) => {
      vals.push(b.pid, new Date(e.t), e.n, e.g, JSON.stringify(e.p))
      const k = i * 5
      return `($${k + 1}, $${k + 2}, $${k + 3}, $${k + 4}, $${k + 5}::jsonb)`
    })
    await d.query(`insert into events (pid, ts, name, game, props) values ${rows.join(', ')}`, vals)
  }
}

/** Everything held about one visitor ID, gone (the privacy page's Forget me). */
export async function forget(d: Db, vid: string): Promise<number> {
  await d.query('delete from events where pid in (select pid from views where vid = $1)', [vid])
  const gone = await d.query<{ pid: string }>('delete from views where vid = $1 returning pid', [vid])
  return gone.length
}

/** Nothing older than thirteen months is kept (the privacy page says so), and no test run older than two days. Run now and then, not on every batch. */
export async function prune(d: Db, now = new Date()): Promise<void> {
  const cut = new Date(now.getTime() - 396 * 864e5)
  await d.query('delete from events where ts < $1', [cut])
  await d.query('delete from views where ts < $1', [cut])
  // Test runs are only worth keeping while they are being looked at.
  const testCut = new Date(now.getTime() - 2 * 864e5)
  await d.query('delete from events where pid in (select pid from views where test and ts < $1)', [testCut])
  await d.query('delete from views where test and ts < $1', [testCut])
}
