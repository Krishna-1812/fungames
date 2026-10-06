/**
 * Analytics: the nightly summaries, and what is kept for how long.
 *
 * Raw events (one row per thing done) are the bulk of the database, so they
 * are kept for 90 days. Before a day's events go, they are counted into two
 * summary tables that are kept for good, and that hold nothing about any one
 * visitor:
 *
 * - `daily_counts`: every event, per UTC day, game, country and kind of
 *   device (plus two counts the dashboard needs that a name alone cannot
 *   say: `game_win`, and `postcard_out` for a postcard shared or saved);
 * - `daily_props`: the values worth keeping of a few events' props, per day
 *   and game: the crowd's choices (`game_pick`), where games were left
 *   (`game_quit`, the last word of each page load that did not finish),
 *   levels reached, things poked, how results were shared.
 *
 * Page views are kept for thirteen months as before (they are small, and
 * every visitor count needs them), and visitor IDs' first and last visits as
 * long as the ID is seen within that time.
 *
 * `nightly()` runs once a day: a Vercel cron calls /api/cron/nightly/, and
 * the admin page runs it too if a day has gone by without it (a site with no
 * cron set up still gets its summaries). It is safe to run any number of
 * times: each day is counted afresh, and the last three days are counted
 * again every night, for the stragglers a closing tab sends late.
 */
import type { Db } from './db'
import { prune } from './ingest'
import { SCRUB_SQL } from './shape'

export const RAW_DAYS = 90
const DAY = 864e5

const midnight = (t: Date | number) => { const d = new Date(t); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
export const isoDay = (t: Date | number) => new Date(t).toISOString().slice(0, 10)

/** The first moment whose raw events are kept: UTC midnight, 90 days before today. */
export const rawFrom = (now = new Date()) => new Date(midnight(now).getTime() - RAW_DAYS * DAY)

/** The props kept per event: [event, prop]. game_pick and game_quit have rules of their own. */
const KEPT: [string, string][] = [
  ['game_level', 'text'], ['share', 'outcome'], ['isl_poke', 'kind'], ['isl_postcard', 'action'],
  ['isl_board_go', 'row'], ['isl_filter', 'filter'], ['isl_cover', 'cover'], ['isl_time', 'mode'],
]

export async function getMeta(d: Db, k: string): Promise<{ v: string; at: Date } | null> {
  const [r] = await d.query<{ v: string; at: string | Date }>('select v, at from meta where k = $1', [k])
  return r ? { v: r.v, at: new Date(r.at) } : null
}
export const setMeta = (d: Db, k: string, v: string, now = new Date()) =>
  d.query('insert into meta (k, v, at) values ($1, $2, $3) on conflict (k) do update set v = excluded.v, at = excluded.at', [k, v, now])

/** Count one UTC day (`day`, YYYY-MM-DD) into the summaries, replacing whatever they held for it. */
export async function rollupDay(d: Db, day: string): Promise<void> {
  const from = new Date(day + 'T00:00:00Z'), to = new Date(from.getTime() + DAY)
  const range = `e.ts >= $2 and e.ts < $3 and not v.test`
  const dims = `coalesce(e.game, v.game, '') as game, coalesce(v.country, '') as country, coalesce(v.device, '') as device`
  await d.query('delete from daily_counts where day = $1', [day])
  await d.query(`
    insert into daily_counts (day, name, game, country, device, n)
    select $1::date, name, game, country, device, count(*) from (
      select e.name, ${dims} from events e join views v on v.pid = e.pid where ${range}
      union all
      select 'game_win', ${dims} from events e join views v on v.pid = e.pid where ${range} and e.name = 'game_end' and e.props->>'kind' = 'win'
      union all
      select 'postcard_out', ${dims} from events e join views v on v.pid = e.pid where ${range} and e.name = 'isl_postcard' and e.props->>'action' in ('share', 'save')
    ) x group by 2, 3, 4, 5`, [day, from, to])
  await d.query('delete from daily_props where day = $1', [day])
  const kept = KEPT.map(([n, p]) => `(e.name = '${n}' and e.props ? '${p}')`).join(' or ')
  const value = `case ${KEPT.map(([n, p]) => `when e.name = '${n}' then e.props->>'${p}'`).join(' ')} end`
  const key = `case ${KEPT.map(([n, p]) => `when e.name = '${n}' then '${p}'`).join(' ')} end`
  await d.query(`
    insert into daily_props (day, name, game, k, of, v, n)
    select $1::date, name, game, k, of, v, count(*) from (
      select e.name, coalesce(e.game, v.game, '') as game, e.props->>'what' as k, coalesce(e.props->>'of', '') as of, e.props->>'v' as v
        from events e join views v on v.pid = e.pid where ${range} and e.name = 'game_pick' and e.props ? 'what' and e.props ? 'v'
      union all
      select e.name, coalesce(e.game, v.game, ''), ${key}, '', ${value}
        from events e join views v on v.pid = e.pid where ${range} and (${kept})
      union all
      select 'game_quit', game, 'at', '', coalesce(at, '') from (
        select distinct on (e.pid) e.name, coalesce(e.game, v.game, '') as game, e.props->>'at' as at
        from events e join views v on v.pid = e.pid where ${range} and e.name in ('game_quit', 'game_end') order by e.pid, e.ts desc
      ) last where name = 'game_quit'
    ) x where k is not null and v is not null group by 2, 3, 4, 5, 6`, [day, from, to])
}

export type NightlyReport = { rolled: string[]; trimmed: number; ms: number; ran: boolean }

/** Whether a day has gone by since the last run (the admin page's fallback for a missing cron). */
export async function due(d: Db, now = new Date(), hours = 26): Promise<boolean> {
  const m = await getMeta(d, 'nightly')
  return !m || now.getTime() - m.at.getTime() > hours * 3600e3
}

/**
 * Count every finished day not yet counted (and the last three again), then
 * let raw events older than 90 days go, but only days already counted.
 * `maxDays` bounds one run, so a first run over a long history cannot time
 * out a function; the next run carries on.
 */
export async function nightly(d: Db, now = new Date(), maxDays = 60): Promise<NightlyReport> {
  const t0 = Date.now()
  // Anything a game should never have sent about its player, stored before the rule (shape.ts, scrub).
  for (const sql of SCRUB_SQL) await d.query(sql)
  const today = midnight(now)
  const through = await getMeta(d, 'rolled_through')
  let start: Date
  if (through) start = new Date(Math.min(new Date(through.v + 'T00:00:00Z').getTime() - 2 * DAY, today.getTime() - DAY))
  else {
    const [r] = await d.query<{ t: string | Date | null }>('select min(ts) as t from events')
    start = r?.t ? midnight(new Date(r.t)) : today
  }
  const rolled: string[] = []
  for (let t = start.getTime(); t < today.getTime() && rolled.length < maxDays; t += DAY) {
    // A day counted before and since trimmed has nothing left to count again: counting it would empty its summary.
    if (through && isoDay(t) <= through.v && t < rawFrom(now).getTime()) continue
    await rollupDay(d, isoDay(t))
    rolled.push(isoDay(t))
  }
  const last = rolled.length ? rolled[rolled.length - 1] : through?.v
  if (last && (!through || last > through.v)) await setMeta(d, 'rolled_through', last, now)

  // Raw events go after 90 days, and never before their day has been counted.
  let trimmed = 0
  if (last) {
    const cut = new Date(Math.min(rawFrom(now).getTime(), new Date(last + 'T00:00:00Z').getTime() + DAY))
    const [r] = await d.query<{ n: string | number }>('with gone as (delete from events where ts < $1 returning 1) select count(*) as n from gone', [cut])
    trimmed = Number(r?.n ?? 0)
  }
  await prune(d, now)

  // Visitor IDs seen before the visitors table existed, and any the page's own upserts missed.
  const back = await getMeta(d, 'visitors_from_views')
  await d.query(`
    insert into visitors (vid, first, last, test)
    select vid, min(ts), max(ts), bool_and(test) from views where vid is not null and ts >= $1
    group by vid
    on conflict (vid) do update set first = least(visitors.first, excluded.first), last = greatest(visitors.last, excluded.last)`,
  [back ? new Date(now.getTime() - 2 * DAY) : new Date(0)])
  if (!back) await setMeta(d, 'visitors_from_views', 'done', now)

  const ms = Date.now() - t0
  await setMeta(d, 'nightly', JSON.stringify({ rolled: rolled.length, trimmed, ms }), now)
  return { rolled, trimmed, ms, ran: true }
}

/** What the database holds, for the Health tab: rows and bytes per table, the oldest raw event, and the last run. */
export async function storage(d: Db, now = new Date()) {
  const tables = ['views', 'events', 'visitors', 'daily_counts', 'daily_props', 'salts', 'meta']
  const sizes = await d.query<{ t: string; bytes: string | number; rows: string | number }>(`
    select c.relname as t, pg_total_relation_size(c.oid) as bytes, greatest(c.reltuples, 0) as rows
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where c.relkind = 'r' and s.nspname = current_schema() and c.relname = any($1)`, [tables])
  // Exact counts for the tables that are small or that matter most; reltuples is only an estimate.
  const [exact] = await d.query<Record<string, string | number | null>>(`
    select (select count(*) from views) as views, (select count(*) from events) as events, (select count(*) from visitors) as visitors,
      (select count(*) from daily_counts) as daily_counts, (select count(*) from daily_props) as daily_props, (select count(*) from salts) as salts, (select count(*) from meta) as meta,
      (select min(ts) from events) as oldest_event, (select min(ts) from views) as oldest_view, (select min(day) from daily_counts) as oldest_day,
      pg_database_size(current_database()) as db_bytes`)
  const [nightlyMeta, through] = await Promise.all([getMeta(d, 'nightly'), getMeta(d, 'rolled_through')])
  return {
    tables: tables.map((t) => {
      const s = sizes.find((r) => r.t === t)
      return { t, bytes: Number(s?.bytes ?? 0), rows: Number(exact[t] ?? s?.rows ?? 0) }
    }),
    dbBytes: Number(exact.db_bytes ?? 0),
    oldestEvent: exact.oldest_event, oldestView: exact.oldest_view, oldestDay: exact.oldest_day,
    rawFrom: rawFrom(now).toISOString(), rawDays: RAW_DAYS,
    nightly: nightlyMeta ? { at: nightlyMeta.at.toISOString(), ...JSON.parse(nightlyMeta.v) } : null,
    rolledThrough: through?.v ?? null,
  }
}
