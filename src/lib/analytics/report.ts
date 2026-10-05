/**
 * Analytics: what the admin page reads. Every number on it is one of these
 * queries, over views and events, leaving out test traffic. Kept apart from
 * the endpoint so the checker can run each against a real Postgres.
 *
 * A visitor is their ID where they have one, and otherwise the daily hash:
 * so a visitor with no ID who comes on three days counts three times over a
 * week. That is the price of not storing anything on their device, and the
 * page says so.
 */
import type { Db } from './db'

export const VISITOR = 'coalesce(vid, dh)'

/** `test`: include the traffic marked as test runs (the admin page's ?test=1). */
export type Range = { from: Date; to: Date; tz: string; bucket: 'hour' | 'day'; test?: boolean }

/** A range from the admin page's query string: `days` (1–365) back from now, in the admin's timezone. */
export function rangeOf(days: number, tz: string, now = new Date()): Range {
  const d = Number.isFinite(days) ? Math.min(365, Math.max(1, Math.round(days))) : 7
  const zone = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/.test(tz) ? tz : 'UTC'
  return { from: new Date(now.getTime() - d * 864e5), to: now, tz: zone, bucket: d <= 2 ? 'hour' : 'day' }
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

export async function kpis(d: Db, from: Date, to: Date, withTest = false) {
  const [v] = await d.query(
    `select count(*) as views, count(distinct ${VISITOR}) as visitors,
       coalesce(avg(nullif(engaged_ms, 0)), 0) as engaged,
       count(*) filter (where game is not null) as game_views,
       count(distinct vid) as with_id
     from views where ts >= $1 and ts < $2 and ${withTest ? 'true' : 'not test'}`,
    [from, to],
  )
  const [e] = await d.query(
    `select count(*) filter (where e.name = 'game_start') as starts,
       count(*) filter (where e.name = 'game_end') as ends,
       count(*) filter (where e.name = 'game_end' and e.props->>'kind' = 'win') as wins,
       count(*) filter (where e.name = 'share') as shares,
       count(*) filter (where e.name = 'isl_dive') as dives,
       count(*) filter (where e.name = 'error') as errors
     from events e join views v on v.pid = e.pid
     where e.ts >= $1 and e.ts < $2 and ${withTest ? 'true' : 'not v.test'}`,
    [from, to],
  )
  return {
    views: num(v.views), visitors: num(v.visitors), engagedMs: Math.round(num(v.engaged)), gameViews: num(v.game_views), withId: num(v.with_id),
    starts: num(e.starts), ends: num(e.ends), wins: num(e.wins), shares: num(e.shares), dives: num(e.dives), errors: num(e.errors),
  }
}

export async function live(d: Db, now = new Date(), withTest = false) {
  const since = new Date(now.getTime() - 5 * 60_000)
  const rows = await d.query(
    `select path, game, country, city, device, lat, lon, seen from views
     where seen >= $1 and ${withTest ? 'true' : 'not test'} order by seen desc limit 200`,
    [since],
  )
  const [c] = await d.query(`select count(distinct ${VISITOR}) as n from views where seen >= $1 and ${withTest ? 'true' : 'not test'}`, [since])
  return { now: num(c.n), pages: rows }
}

export async function series(d: Db, r: Range, withTest = false) {
  const rows = await d.query<{ t: string; views: unknown; visitors: unknown }>(
    `select to_char(date_trunc('${r.bucket}', ts at time zone $3), 'YYYY-MM-DD"T"HH24:00') as t,
       count(*) as views, count(distinct ${VISITOR}) as visitors
     from views where ts >= $1 and ts < $2 and ${withTest ? 'true' : 'not test'} group by 1 order by 1`,
    [r.from, r.to, r.tz],
  )
  return rows.map((x) => ({ t: x.t, views: num(x.views), visitors: num(x.visitors) }))
}

export async function games(d: Db, from: Date, to: Date, withTest = false) {
  const views = await d.query(
    `select game, count(*) as views, count(distinct ${VISITOR}) as visitors, coalesce(avg(nullif(engaged_ms, 0)), 0) as engaged
     from views where ts >= $1 and ts < $2 and ${withTest ? 'true' : 'not test'} and game is not null group by game`,
    [from, to],
  )
  const evs = await d.query(
    `select coalesce(e.game, v.game) as game,
       count(*) filter (where e.name = 'game_start') as starts,
       count(*) filter (where e.name = 'game_end') as ends,
       count(*) filter (where e.name = 'game_end' and e.props->>'kind' = 'win') as wins,
       count(*) filter (where e.name = 'share') as shares,
       count(*) filter (where e.name = 'game_restart') as restarts,
       count(*) filter (where e.name = 'isl_dive') as dives
     from events e join views v on v.pid = e.pid
     where e.ts >= $1 and e.ts < $2 and ${withTest ? 'true' : 'not v.test'} and coalesce(e.game, v.game) is not null group by 1`,
    [from, to],
  )
  const by = new Map<string, Record<string, number | string>>()
  const row = (g: string) => by.get(g) ?? by.set(g, { game: g, views: 0, visitors: 0, engagedMs: 0, starts: 0, ends: 0, wins: 0, shares: 0, restarts: 0, dives: 0 }).get(g)!
  for (const v of views) Object.assign(row(String(v.game)), { views: num(v.views), visitors: num(v.visitors), engagedMs: Math.round(num(v.engaged)) })
  for (const e of evs) Object.assign(row(String(e.game)), { starts: num(e.starts), ends: num(e.ends), wins: num(e.wins), shares: num(e.shares), restarts: num(e.restarts), dives: num(e.dives) })
  return [...by.values()].sort((a, b) => Number(b.views) - Number(a.views))
}

/** The top values of one column of views, by visitors. */
const COLUMNS = new Set(['path', 'country', 'city', 'device', 'os', 'browser', 'ref_host', 'lang', 'utm_source', 'utm_campaign', 'sref', 'from_path'])
export async function top(d: Db, col: string, from: Date, to: Date, limit = 12, withTest = false) {
  if (!COLUMNS.has(col)) throw new Error('column')
  const rows = await d.query(
    `select ${col} as k, count(*) as views, count(distinct ${VISITOR}) as visitors
     from views where ts >= $1 and ts < $2 and ${withTest ? 'true' : 'not test'} and ${col} is not null
     group by 1 order by visitors desc, views desc limit ${Math.min(50, limit)}`,
    [from, to],
  )
  return rows.map((x) => ({ k: String(x.k), views: num(x.views), visitors: num(x.visitors) }))
}

export async function vitals(d: Db, from: Date, to: Date, withTest = false) {
  const rows = await d.query(
    `select e.props->>'metric' as metric, count(*) as n,
       percentile_cont(0.75) within group (order by (e.props->>'value')::float) as p75
     from events e join views v on v.pid = e.pid
     where e.name = 'vital' and e.ts >= $1 and e.ts < $2 and ${withTest ? 'true' : 'not v.test'} group by 1`,
    [from, to],
  )
  return rows.map((x) => ({ metric: String(x.metric), n: num(x.n), p75: num(x.p75) }))
}

export async function errors(d: Db, from: Date, to: Date, withTest = false) {
  const rows = await d.query(
    `select e.props->>'msg' as msg, count(*) as n, count(distinct v.path) as pages, max(e.ts) as last
     from events e join views v on v.pid = e.pid
     where e.name = 'error' and e.ts >= $1 and e.ts < $2 and ${withTest ? 'true' : 'not v.test'} group by 1 order by n desc limit 10`,
    [from, to],
  )
  return rows.map((x) => ({ msg: String(x.msg), n: num(x.n), pages: num(x.pages), last: x.last }))
}

export async function recent(d: Db, limit = 40, withTest = false) {
  return d.query(
    `select e.ts, e.name, coalesce(e.game, v.game) as game, e.props, v.path, v.country, v.city, v.device
     from events e join views v on v.pid = e.pid where ${withTest ? 'true' : 'not v.test'} order by e.id desc limit ${Math.min(200, limit)}`,
  )
}

export async function overview(d: Db, r: Range) {
  const span = r.to.getTime() - r.from.getTime()
  const prevFrom = new Date(r.from.getTime() - span)
  const t = !!r.test
  const [now, before, s, g, pages, countries, devices, browsers, os, refs, v, errs, ev, lv] = await Promise.all([
    kpis(d, r.from, r.to, t), kpis(d, prevFrom, r.from, t), series(d, r, t), games(d, r.from, r.to, t),
    top(d, 'path', r.from, r.to, 12, t), top(d, 'country', r.from, r.to, 12, t), top(d, 'device', r.from, r.to, 12, t),
    top(d, 'browser', r.from, r.to, 12, t), top(d, 'os', r.from, r.to, 12, t), top(d, 'ref_host', r.from, r.to, 12, t),
    vitals(d, r.from, r.to, t), errors(d, r.from, r.to, t), recent(d, 40, t), live(d, r.to, t),
  ])
  return { range: { from: r.from, to: r.to, tz: r.tz, bucket: r.bucket }, kpis: now, prev: before, series: s, games: g, pages, countries, devices, browsers, os, refs, vitals: v, errors: errs, recent: ev, live: lv }
}
