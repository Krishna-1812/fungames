/**
 * Analytics: what the admin page reads. Every number on it is one of these
 * queries, over `views` and `events`, through one filter (a time range, and
 * optionally a country, a kind of device and a game), leaving out test
 * traffic unless asked. Kept apart from the endpoint so the checker can run
 * each against a real Postgres.
 *
 * A visitor is their ID where they have one, and otherwise the daily hash:
 * so a visitor with no ID who comes on three days counts three times over a
 * week. That is the price of not storing anything on their device, and the
 * page says so.
 *
 * Every value that reaches SQL is a bound parameter, except a handful of
 * words picked from fixed lists here (a column, a bucket size), never from
 * the request.
 */
import type { Db } from './db'

export const VISITOR = 'coalesce(v.vid, v.dh)'

export type Bucket = 'hour' | 'day' | 'week'
export type Filter = {
  from: Date
  to: Date
  /** The admin's timezone, for days and hours. */
  tz: string
  bucket: Bucket
  /** Include the traffic marked as test runs (the admin page's ?test=1). */
  test?: boolean
  country?: string
  device?: string
  game?: string
}
/** The phase-1 name, kept for callers that only need a range. */
export type Range = Filter

const ZONE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$|^UTC$/
const bucketFor = (ms: number): Bucket => (ms <= 2.1 * 864e5 ? 'hour' : ms <= 120 * 864e5 ? 'day' : 'week')

/** A range `days` back from now (1–400), in the admin's timezone. */
export function rangeOf(days: number, tz: string, now = new Date()): Filter {
  const d = Number.isFinite(days) ? Math.min(400, Math.max(1, Math.round(days))) : 7
  const from = new Date(now.getTime() - d * 864e5)
  return { from, to: now, tz: ZONE.test(tz) ? tz : 'UTC', bucket: bucketFor(now.getTime() - from.getTime()) }
}

/** The filter from the admin page's query string: days= or start=&end= (ISO), tz=, country=, device=, game=, test=1. */
export function filterOf(q: URLSearchParams, now = new Date()): Filter {
  let f = rangeOf(Number(q.get('days') ?? 7), q.get('tz') ?? 'UTC', now)
  const s = Date.parse(q.get('start') ?? ''), e = Date.parse(q.get('end') ?? '')
  if (Number.isFinite(s) && Number.isFinite(e) && e > s && e - s <= 400 * 864e5) {
    f = { ...f, from: new Date(s), to: new Date(Math.min(e, now.getTime())), bucket: bucketFor(e - s) }
  }
  const country = q.get('country') ?? '', device = q.get('device') ?? '', game = q.get('game') ?? ''
  if (/^[A-Z]{2}$/.test(country)) f.country = country
  if (/^(phone|tablet|desktop)$/.test(device)) f.device = device
  if (/^[a-z][a-z0-9-]{1,40}$/.test(game)) f.game = game
  f.test = q.get('test') === '1'
  return f
}

/** The same length of time, just before. */
export const previous = (f: Filter): Filter => ({ ...f, to: f.from, from: new Date(f.from.getTime() - (f.to.getTime() - f.from.getTime())) })

/* ---- building queries -------------------------------------------------- */

class Q {
  ps: unknown[] = []
  /** A bound parameter. */
  p(v: unknown) { this.ps.push(v); return `$${this.ps.length}` }
  /** The filter on views (alias v), with the time on `on` (v.ts, or e.ts for events). */
  where(f: Filter, on = 'v.ts', opts: { game?: boolean } = {}) {
    const w = [`${on} >= ${this.p(f.from)}`, `${on} < ${this.p(f.to)}`]
    if (!f.test) w.push('not v.test')
    if (f.country) w.push(`v.country = ${this.p(f.country)}`)
    if (f.device) w.push(`v.device = ${this.p(f.device)}`)
    if (f.game && opts.game !== false) w.push(`v.game = ${this.p(f.game)}`)
    return w.join(' and ')
  }
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
type Row = Record<string, unknown>
const rows = async (d: Db, q: Q, sql: string) => d.query<Row>(sql, q.ps)
/** `k`, `n` pairs, as most lists are. */
const pairs = (rs: Row[], key = 'k', val = 'n') => rs.map((r) => ({ k: r[key] === null || r[key] === undefined ? '' : String(r[key]), n: n(r[val]) }))
const truncOf = (b: Bucket) => (b === 'hour' ? 'hour' : b === 'week' ? 'week' : 'day')
const tLabel = `'YYYY-MM-DD"T"HH24:00'`

/* ---- the headline numbers --------------------------------------------- */

export async function kpis(d: Db, f: Filter) {
  const q = new Q()
  const [v] = await rows(d, q, `
    select count(*) as views, count(distinct ${VISITOR}) as visitors,
      count(distinct (${VISITOR}) || to_char(v.ts at time zone 'UTC', 'YYYYMMDD')) as visits,
      coalesce(avg(nullif(v.engaged_ms, 0)), 0) as engaged,
      coalesce(sum(v.engaged_ms), 0) as engaged_total,
      count(distinct v.vid) as with_id,
      count(*) filter (where v.game is not null) as game_views,
      count(distinct ${VISITOR}) filter (where coalesce(v.first_days, 0) = 0 and coalesce(v.visit_days, 0) <= 1) as first_timers,
      coalesce(avg(v.scroll), 0) as scroll
    from views v where ${q.where(f)}`)
  const q2 = new Q()
  const [e] = await rows(d, q2, `
    select count(*) filter (where e.name = 'game_start') as starts,
      count(*) filter (where e.name = 'game_end') as ends,
      count(*) filter (where e.name = 'game_end' and e.props->>'kind' = 'win') as wins,
      count(*) filter (where e.name = 'share' or (e.name = 'isl_postcard' and e.props->>'action' in ('share', 'save'))) as shares,
      count(*) filter (where e.name = 'isl_dive') as dives,
      count(*) filter (where e.name = 'error') as errors,
      count(*) as events
    from events e join views v on v.pid = e.pid where ${q2.where(f, 'e.ts')}`)
  // Visits of one page and nothing done on it.
  const q3 = new Q()
  const [b] = await rows(d, q3, `
    with day as (
      select ${VISITOR} as who, date_trunc('day', v.ts) as day, count(*) as views, sum(v.engaged_ms) as ms
      from views v where ${q3.where(f)} group by 1, 2)
    select count(*) filter (where views = 1 and coalesce(ms, 0) < 10000) as bounced, count(*) as visits from day`)
  return {
    views: n(v.views), visitors: n(v.visitors), visits: n(v.visits), engagedMs: Math.round(n(v.engaged)), engagedTotalMs: n(v.engaged_total),
    withId: n(v.with_id), gameViews: n(v.game_views), firstTimers: n(v.first_timers), scroll: Math.round(n(v.scroll)),
    starts: n(e.starts), ends: n(e.ends), wins: n(e.wins), shares: n(e.shares), dives: n(e.dives), errors: n(e.errors), events: n(e.events),
    bounce: n(b.visits) ? n(b.bounced) / n(b.visits) : 0,
  }
}

/** Visitors, views, starts and endings per hour, day or week. */
export async function series(d: Db, f: Filter) {
  const q = new Q()
  const tz = q.p(f.tz)
  const vs = await rows(d, q, `
    select to_char(date_trunc('${truncOf(f.bucket)}', v.ts at time zone ${tz}), ${tLabel}) as t,
      count(*) as views, count(distinct ${VISITOR}) as visitors
    from views v where ${q.where(f)} group by 1 order by 1`)
  const q2 = new Q()
  const tz2 = q2.p(f.tz)
  const es = await rows(d, q2, `
    select to_char(date_trunc('${truncOf(f.bucket)}', e.ts at time zone ${tz2}), ${tLabel}) as t,
      count(*) filter (where e.name = 'game_start') as starts, count(*) filter (where e.name = 'game_end') as ends
    from events e join views v on v.pid = e.pid where ${q2.where(f, 'e.ts')} and e.name in ('game_start', 'game_end') group by 1`)
  const by = new Map(es.map((r) => [String(r.t), r]))
  // Every bucket in the range, empty ones included, so the chart's x-axis is time and not just the busy hours.
  const out: { t: string; views: number; visitors: number; starts: number; ends: number }[] = []
  const have = new Map(vs.map((r) => [String(r.t), r]))
  for (const t of bucketsOf(f)) {
    const v = have.get(t), e = by.get(t)
    out.push({ t, views: n(v?.views), visitors: n(v?.visitors), starts: n(e?.starts), ends: n(e?.ends) })
  }
  return out
}

/** Every bucket label in a range, in the admin's timezone, as Postgres writes them. */
export function bucketsOf(f: Filter): string[] {
  const out: string[] = []
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: f.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
  const parts = (t: number) => Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]))
  const step = f.bucket === 'hour' ? 3600e3 : 864e5
  const seen = new Set<string>()
  for (let t = f.from.getTime(); t < f.to.getTime() + step; t += step) {
    if (t > f.to.getTime() && out.length) break
    const p = parts(Math.min(t, f.to.getTime() - 1))
    let label: string
    if (f.bucket === 'hour') label = `${p.year}-${p.month}-${p.day}T${p.hour}:00`
    else if (f.bucket === 'day') label = `${p.year}-${p.month}-${p.day}T00:00`
    else {
      // ISO weeks start on Monday, as date_trunc('week') does.
      const back = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday)
      const m = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - back))
      label = `${m.toISOString().slice(0, 10)}T00:00`
    }
    if (!seen.has(label)) { seen.add(label); out.push(label) }
  }
  return out
}

export async function live(d: Db, f: Pick<Filter, 'test'> = {}, now = new Date()) {
  const since = new Date(now.getTime() - 5 * 60_000)
  const t = f.test ? 'true' : 'not v.test'
  const pages = await d.query<Row>(`select v.path, v.game, v.country, v.region, v.city, v.device, v.os, v.browser, v.lat, v.lon, v.seen, v.ts, v.ref_host, v.engaged_ms
    from views v where v.seen >= $1 and ${t} order by v.seen desc limit 300`, [since])
  const [c] = await d.query<Row>(`select count(distinct ${VISITOR}) as n from views v where v.seen >= $1 and ${t}`, [since])
  const perMin = await d.query<Row>(`select to_char(date_trunc('minute', e.ts), 'HH24:MI') as t, count(*) as n
    from events e join views v on v.pid = e.pid where e.ts >= $1 and ${t} group by 1 order by 1`, [new Date(now.getTime() - 30 * 60_000)])
  const ev = await d.query<Row>(`select e.ts, e.name, coalesce(e.game, v.game) as game, e.props, v.path, v.country, v.city, v.device
    from events e join views v on v.pid = e.pid where e.ts >= $1 and ${t} and e.name not in ('vital') order by e.ts desc limit 60`, [new Date(now.getTime() - 30 * 60_000)])
  return { now: n(c.n), pages, perMin: pairs(perMin, 't'), events: ev }
}

/* ---- tabs ---------------------------------------------------------------- */

export async function overview(d: Db, f: Filter) {
  const prev = previous(f)
  const [now, before, s, ps, g, countries, devices, refs, lv] = await Promise.all([
    kpis(d, f), kpis(d, prev), series(d, f), series(d, prev), games(d, f),
    top(d, 'country', f, 8), top(d, 'device', f, 3), top(d, 'ref_host', f, 8), live(d, f),
  ])
  return { kpis: now, prev: before, series: s, prevSeries: ps, games: g.slice(0, 8), countries, devices, refs, live: { now: lv.now } }
}

export async function games(d: Db, f: Filter) {
  const q = new Q()
  const views = await rows(d, q, `
    select v.game, count(*) as views, count(distinct ${VISITOR}) as visitors, coalesce(avg(nullif(v.engaged_ms, 0)), 0) as engaged
    from views v where ${q.where(f)} and v.game is not null group by v.game`)
  const q2 = new Q()
  const evs = await rows(d, q2, `
    select coalesce(e.game, v.game) as game,
      count(*) filter (where e.name = 'game_start') as starts,
      count(*) filter (where e.name = 'game_end') as ends,
      count(*) filter (where e.name = 'game_end' and e.props->>'kind' = 'win') as wins,
      count(*) filter (where e.name = 'share') as shares,
      count(*) filter (where e.name = 'game_restart') as restarts,
      count(*) filter (where e.name = 'game_howto') as howto,
      count(*) filter (where e.name = 'isl_dive') as dives,
      count(*) filter (where e.name = 'isl_card') as cards,
      coalesce(percentile_cont(0.5) within group (order by (e.props->>'ms')::float) filter (where e.name = 'game_end' and (e.props->>'ms')::float > 0), 0) as median_ms
    from events e join views v on v.pid = e.pid
    where ${q2.where(f, 'e.ts', { game: false })} and coalesce(e.game, v.game) is not null
      ${f.game ? `and coalesce(e.game, v.game) = ${q2.p(f.game)}` : ''} group by 1`)
  const q3 = new Q()
  const tz = q3.p(f.tz)
  const spark = await rows(d, q3, `
    select v.game, to_char(date_trunc('${f.bucket === 'hour' ? 'hour' : 'day'}', v.ts at time zone ${tz}), ${tLabel}) as t, count(distinct ${VISITOR}) as n
    from views v where ${q3.where(f)} and v.game is not null group by 1, 2`)
  const by = new Map<string, Record<string, number | string | number[]>>()
  const row = (g: string) => by.get(g) ?? by.set(g, { game: g, views: 0, visitors: 0, engagedMs: 0, starts: 0, ends: 0, wins: 0, shares: 0, restarts: 0, howto: 0, dives: 0, cards: 0, medianMs: 0, trend: [] }).get(g)!
  for (const v of views) Object.assign(row(String(v.game)), { views: n(v.views), visitors: n(v.visitors), engagedMs: Math.round(n(v.engaged)) })
  for (const e of evs) Object.assign(row(String(e.game)), { starts: n(e.starts), ends: n(e.ends), wins: n(e.wins), shares: n(e.shares), restarts: n(e.restarts), howto: n(e.howto), dives: n(e.dives), cards: n(e.cards), medianMs: Math.round(n(e.median_ms)) })
  const labels = f.bucket === 'week' ? bucketsOf({ ...f, bucket: 'day' }) : bucketsOf(f)
  const idx = new Map(labels.map((t, i) => [t, i]))
  for (const s of spark) {
    const r = row(String(s.game))
    if (!(r.trend as number[]).length) r.trend = labels.map(() => 0)
    const i = idx.get(String(s.t)); if (i !== undefined) (r.trend as number[])[i] = n(s.n)
  }
  for (const r of by.values()) if (!(r.trend as number[]).length) r.trend = labels.map(() => 0)
  return [...by.values()].sort((a, b) => Number(b.visitors) - Number(a.visitors) || Number(b.views) - Number(a.views))
}

/**
 * Ten bins between the smallest and largest value (one, if they are all the
 * same). Equal widths, unless the values span more than a hundredfold and are
 * all above zero (an impact's death toll, a rock's megatonnes): then equal
 * ratios, or nearly everything lands in the first bar.
 */
function histogram(values: number[], bins = 10) {
  if (!values.length) return { min: 0, max: 0, bins: [] as { lo: number; hi: number; n: number }[], median: 0, p90: 0, mean: 0, log: false }
  const s = [...values].sort((a, b) => a - b)
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]
  const min = s[0], max = s[s.length - 1]
  const k = min === max ? 1 : Math.min(bins, s.length)
  const log = min > 0 && max / min > 100
  const f = (v: number) => (log ? Math.log10(v) : v)
  const lo0 = f(min), w = (f(max) - lo0) / k || 1
  const edge = (i: number) => (log ? 10 ** (lo0 + i * w) : lo0 + i * w)
  const out = Array.from({ length: k }, (_, i) => ({ lo: edge(i), hi: i === k - 1 ? max : edge(i + 1), n: 0 }))
  for (const v of s) out[Math.min(k - 1, Math.floor((f(v) - lo0) / w))].n++
  return { min, max, bins: out, median: q(0.5), p90: q(0.9), mean: s.reduce((a, b) => a + b, 0) / s.length, log }
}

/** One game, in depth. */
export async function game(d: Db, f0: Filter, slug: string) {
  const f = { ...f0, game: slug }
  const q = new Q()
  // The page's own funnel: page loads that saw it, started it, finished it, shared it.
  const [fun] = await rows(d, q, `
    select count(distinct v.pid) as views,
      count(distinct v.pid) filter (where exists (select 1 from events e where e.pid = v.pid and e.name = 'game_start')) as started,
      count(distinct v.pid) filter (where exists (select 1 from events e where e.pid = v.pid and e.name = 'game_end')) as finished,
      count(distinct v.pid) filter (where exists (select 1 from events e where e.pid = v.pid and e.name = 'game_end' and e.props->>'kind' = 'win')) as won,
      count(distinct v.pid) filter (where exists (select 1 from events e where e.pid = v.pid and e.name = 'share')) as shared,
      count(distinct ${VISITOR}) as visitors,
      coalesce(avg(nullif(v.engaged_ms, 0)), 0) as engaged,
      coalesce(avg(v.scroll), 0) as scroll
    from views v where ${q.where(f)}`)
  const q2 = new Q()
  const evs = await rows(d, q2, `
    select e.name, e.props from events e join views v on v.pid = e.pid
    where ${q2.where(f, 'e.ts', { game: false })} and coalesce(e.game, v.game) = ${q2.p(slug)}
      and e.name in ('game_result', 'game_end', 'game_level', 'game_best', 'share', 'game_restart', 'game_howto', 'game_pause', 'sound')
    order by e.ts desc limit 20000`)
  // Every number a game reports, as a distribution; every word, as a count.
  const numeric = new Map<string, number[]>(), words = new Map<string, Map<string, number>>()
  const ends: number[] = [], kinds = { win: 0, lose: 0 }
  const levels = new Map<string, number>(), shares = new Map<string, number>()
  let restarts = 0, howto = 0, pauses = 0, soundOn = 0, bests = 0
  for (const e of evs) {
    const p = (e.props ?? {}) as Record<string, unknown>
    if (e.name === 'game_result') {
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'number') (numeric.get(k) ?? numeric.set(k, []).get(k)!).push(v)
        else if (typeof v === 'string' || typeof v === 'boolean') { const m = words.get(k) ?? words.set(k, new Map()).get(k)!; m.set(String(v), (m.get(String(v)) ?? 0) + 1) }
      }
    } else if (e.name === 'game_end') {
      if (typeof p.ms === 'number' && p.ms > 0) ends.push(p.ms / 1000)
      if (p.kind === 'win') kinds.win++; else kinds.lose++
    } else if (e.name === 'game_level') levels.set(String(p.text ?? ''), (levels.get(String(p.text ?? '')) ?? 0) + 1)
    else if (e.name === 'share') shares.set(String(p.outcome ?? ''), (shares.get(String(p.outcome ?? '')) ?? 0) + 1)
    else if (e.name === 'game_restart') restarts++
    else if (e.name === 'game_howto') howto++
    else if (e.name === 'game_pause') pauses++
    else if (e.name === 'sound' && p.on === true) soundOn++
    else if (e.name === 'game_best') bests++
  }
  const most = (m: Map<string, number>, k = 12) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([k2, v]) => ({ k: k2, n: v }))
  const q3 = new Q()
  const entry = await rows(d, q3, `
    select case when v.from_path = '/' then 'The island' when v.from_path is not null then 'Another game' when v.ref_host is not null then v.ref_host when v.sref is not null then 'A shared link' else 'Direct' end as k,
      count(*) as n from views v where ${q3.where(f)} group by 1 order by 2 desc limit 10`)
  const [s, devices] = await Promise.all([series(d, f), top(d, 'device', f, 3)])
  return {
    funnel: { views: n(fun.views), started: n(fun.started), finished: n(fun.finished), won: n(fun.won), shared: n(fun.shared) },
    visitors: n(fun.visitors), engagedMs: Math.round(n(fun.engaged)), scroll: Math.round(n(fun.scroll)),
    series: s, devices, entry: pairs(entry),
    results: [...numeric].map(([k, v]) => ({ k, count: v.length, ...histogram(v) })).sort((a, b) => b.count - a.count),
    words: [...words].map(([k, m]) => ({ k, values: most(m) })),
    duration: histogram(ends), kinds, levels: most(levels, 20), shares: most(shares),
    restarts, howto, pauses, soundOn, bests,
  }
}

const COLUMNS = new Set(['path', 'country', 'region', 'city', 'device', 'os', 'browser', 'ref_host', 'lang', 'tz', 'utm_source', 'utm_medium', 'utm_campaign', 'sref', 'from_path', 'conn', 'game'])

/** The top values of one column of views, by visitors. */
export async function top(d: Db, col: string, f: Filter, limit = 12) {
  if (!COLUMNS.has(col)) throw new Error('column')
  const q = new Q()
  const rs = await rows(d, q, `
    select v.${col} as k, count(*) as views, count(distinct ${VISITOR}) as visitors
    from views v where ${q.where(f)} and v.${col} is not null and v.${col} <> ''
    group by 1 order by visitors desc, views desc limit ${Math.min(250, Math.max(1, Math.round(limit)))}`)
  return rs.map((x) => ({ k: String(x.k), views: n(x.views), visitors: n(x.visitors) }))
}

/** Counts of one event's prop, e.g. which kind of thing was poked. */
async function propCounts(d: Db, f: Filter, name: string, prop: string | null, limit = 20, extra = '') {
  const q = new Q()
  const key = prop ? `e.props->>${q.p(prop)}` : `coalesce(e.game, v.game)`
  return pairs(await rows(d, q, `
    select ${key} as k, count(*) as n from events e join views v on v.pid = e.pid
    where ${q.where(f, 'e.ts', { game: false })} and e.name = ${q.p(name)} ${extra}
    group by 1 order by 2 desc limit ${limit}`))
}

export async function island(d: Db, f: Filter) {
  const q = new Q()
  const [counts] = await rows(d, q, `
    select count(*) filter (where e.name = 'isl_surprise') as surprise, count(*) filter (where e.name = 'isl_today') as today,
      count(*) filter (where e.name = 'isl_board') as board, count(*) filter (where e.name = 'isl_ball') as ball,
      count(*) filter (where e.name = 'isl_pigeons') as pigeons, count(*) filter (where e.name = 'isl_minimap') as minimap,
      count(*) filter (where e.name = 'isl_poke') as pokes, count(*) filter (where e.name = 'isl_poke' and e.props->>'first' = 'true') as finds,
      count(*) filter (where e.name = 'isl_bottle' and e.props->>'first' = 'true') as bottles,
      count(*) filter (where e.name = 'isl_postcard' and e.props->>'action' = 'made') as postcards,
      count(*) filter (where e.name = 'isl_dive') as dives, count(*) filter (where e.name = 'isl_search') as searches,
      count(*) filter (where e.name = 'isl_passport' and e.props->>'tab' = 'open') as passports
    from events e join views v on v.pid = e.pid where ${q.where(f, 'e.ts', { game: false })} and e.name like 'isl\\_%'`)
  const q2 = new Q()
  const [home] = await rows(d, q2, `select count(*) as views, count(distinct ${VISITOR}) as visitors, coalesce(avg(nullif(v.engaged_ms, 0)), 0) as engaged from views v where ${q2.where(f, 'v.ts', { game: false })} and v.path = '/'`)
  const q3 = new Q()
  // The page sends its summary each time it is hidden: the last one per page load is the whole visit.
  const [sess] = await rows(d, q3, `
    with last as (select distinct on (e.pid) e.props from events e join views v on v.pid = e.pid
      where ${q3.where(f, 'e.ts', { game: false })} and e.name = 'isl_session' order by e.pid, e.ts desc)
    select count(*) as n, coalesce(avg((props->>'secs')::float), 0) as secs, coalesce(avg((props->>'drags')::float), 0) as drags,
      coalesce(avg((props->>'n_districts')::float), 0) as districts, coalesce(avg((props->>'cards')::float), 0) as cards from last`)
  const q4 = new Q()
  const districts = pairs(await rows(d, q4, `
    with last as (select distinct on (e.pid) e.props from events e join views v on v.pid = e.pid
      where ${q4.where(f, 'e.ts', { game: false })} and e.name = 'isl_session' order by e.pid, e.ts desc)
    select dist as k, count(*) as n from last, unnest(string_to_array(nullif(props->>'districts', ''), ' ')) as dist group by 1 order by 2 desc`))
  const q5 = new Q()
  const fps = await rows(d, q5, `
    select v.device as k, count(*) as n, percentile_cont(0.5) within group (order by (e.props->>'fps')::float) as median,
      percentile_cont(0.1) within group (order by (e.props->>'fps')::float) as low
    from events e join views v on v.pid = e.pid where ${q5.where(f, 'e.ts', { game: false })} and e.name = 'isl_fps' group by 1 order by 2 desc`)
  const [dives, cards, pokes, finds, bottles, postcards, boardFrom, boardGo, searches, empties, filters, tabs, covers, welcome, time] = await Promise.all([
    propCounts(d, f, 'isl_dive', null, 40), propCounts(d, f, 'isl_card', null, 40), propCounts(d, f, 'isl_poke', 'kind', 30),
    propCounts(d, f, 'isl_poke', 'kind', 30, `and e.props->>'first' = 'true'`), propCounts(d, f, 'isl_bottle', 'n', 12, `and e.props->>'first' = 'true'`),
    propCounts(d, f, 'isl_postcard', 'action', 5), propCounts(d, f, 'isl_board', 'from', 5), propCounts(d, f, 'isl_board_go', 'row', 10),
    propCounts(d, f, 'isl_search', 'q', 25), propCounts(d, f, 'isl_search', 'q', 15, `and e.props->>'results' = '0'`),
    propCounts(d, f, 'isl_filter', 'filter', 6), propCounts(d, f, 'isl_passport', 'tab', 12), propCounts(d, f, 'isl_cover', 'cover', 6),
    propCounts(d, f, 'isl_welcome', 'answer', 4), propCounts(d, f, 'isl_time', 'mode', 3),
  ])
  const c = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, n(v)]))
  return {
    home: { views: n(home.views), visitors: n(home.visitors), engagedMs: Math.round(n(home.engaged)) }, counts: c,
    session: { n: n(sess.n), secs: n(sess.secs), drags: n(sess.drags), districts: n(sess.districts), cards: n(sess.cards) },
    districts, fps: fps.map((r) => ({ k: String(r.k), n: n(r.n), median: n(r.median), low: n(r.low) })),
    dives, cards, pokes, finds, bottles, postcards, boardFrom, boardGo, searches, empties, filters, tabs, covers, welcome, time,
  }
}

export async function audience(d: Db, f: Filter) {
  const q = new Q()
  // When people visit, in their own time (the visitor's timezone, when Postgres knows it; the admin's otherwise).
  const tz = q.p(f.tz)
  const week = await rows(d, q, `
    select extract(isodow from v.ts at time zone coalesce(z.name, ${tz}))::int as dow, extract(hour from v.ts at time zone coalesce(z.name, ${tz}))::int as h,
      count(distinct ${VISITOR}) as n
    from views v left join pg_timezone_names z on z.name = v.tz where ${q.where(f)} group by 1, 2`)
  const q2 = new Q()
  const [flags] = await rows(d, q2, `
    select count(*) as n, count(*) filter (where v.dark) as dark, count(*) filter (where v.rm) as rm, count(*) filter (where v.touch) as touch,
      count(*) filter (where v.dark is not null) as dark_known
    from views v where ${q2.where(f)}`)
  const q3 = new Q()
  const screens = pairs(await rows(d, q3, `
    select case when v.vw < 480 then 'under 480 px' when v.vw < 768 then '480–767 px' when v.vw < 1024 then '768–1023 px'
      when v.vw < 1440 then '1024–1439 px' when v.vw < 1920 then '1440–1919 px' else '1920 px and up' end as k, count(*) as n
    from views v where ${q3.where(f)} and v.vw is not null group by 1 order by min(v.vw)`))
  const q4 = new Q()
  const dpr = pairs(await rows(d, q4, `select round(v.dpr::numeric, 1)::text || '×' as k, count(*) as n from views v where ${q4.where(f)} and v.dpr is not null group by 1 order by 2 desc limit 6`))
  const q5 = new Q()
  const browsers = pairs(await rows(d, q5, `select v.browser || coalesce(' ' || v.bver, '') as k, count(*) as n from views v where ${q5.where(f)} group by 1 order by 2 desc limit 12`))
  const q6 = new Q()
  const langs = pairs(await rows(d, q6, `select split_part(v.lang, '-', 1) as k, count(distinct ${VISITOR}) as n from views v where ${q6.where(f)} and v.lang is not null group by 1 order by 2 desc limit 12`))
  const [countries, devices, os, conn, tzs] = await Promise.all([
    top(d, 'country', f, 250), top(d, 'device', f, 3), top(d, 'os', f, 8), top(d, 'conn', f, 5), top(d, 'tz', f, 12),
  ])
  const q7 = new Q()
  const regionsBy = await rows(d, q7, `select v.country || ' · ' || v.region as k, count(distinct ${VISITOR}) as n from views v where ${q7.where(f)} and v.region is not null group by 1 order by 2 desc limit 15`)
  const q8 = new Q()
  const citiesBy = await rows(d, q8, `select v.city || ', ' || v.country as k, count(distinct ${VISITOR}) as n from views v where ${q8.where(f)} and v.city is not null group by 1 order by 2 desc limit 20`)
  return {
    week: week.map((r) => ({ dow: n(r.dow), h: n(r.h), n: n(r.n) })),
    flags: { n: n(flags.n), dark: n(flags.dark), rm: n(flags.rm), touch: n(flags.touch), darkKnown: n(flags.dark_known) },
    screens, dpr, browsers, langs, countries, regions: pairs(regionsBy), cities: pairs(citiesBy), devices, os, conn, tzs,
  }
}

export async function acquisition(d: Db, f: Filter) {
  const q = new Q()
  const kinds = pairs(await rows(d, q, `
    select case when v.from_path is not null then 'Inside the site'
      when v.sref is not null then 'Shared links'
      when v.utm_source is not null then 'Campaigns'
      when v.ref_host ~ '(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave|startpage)\\.' then 'Search'
      when v.ref_host ~ '(facebook|instagram|twitter|x\\.com|t\\.co|reddit|linkedin|pinterest|tiktok|youtube|threads|bsky|mastodon|whatsapp|telegram|discord)' then 'Social'
      when v.ref_host is not null then 'Other sites' else 'Direct' end as k, count(distinct ${VISITOR}) as n
    from views v where ${q.where(f)} group by 1 order by 2 desc`))
  const q2 = new Q()
  const refPaths = pairs(await rows(d, q2, `select v.ref_host || coalesce(v.ref_path, '') as k, count(distinct ${VISITOR}) as n from views v where ${q2.where(f)} and v.ref_host is not null group by 1 order by 2 desc limit 20`))
  const q3 = new Q()
  // Where visits start: a page arrived at from outside the site.
  const landing = pairs(await rows(d, q3, `select v.path as k, count(*) as n from views v where ${q3.where(f)} and v.from_path is null group by 1 order by 2 desc limit 15`))
  const q4 = new Q()
  const flows = pairs(await rows(d, q4, `select v.from_path || ' → ' || v.path as k, count(*) as n from views v where ${q4.where(f)} and v.from_path is not null and v.from_path <> v.path group by 1 order by 2 desc limit 20`))
  const q5 = new Q()
  const exits = pairs(await rows(d, q5, `
    with ranked as (select v.path, row_number() over (partition by ${VISITOR}, date_trunc('day', v.ts) order by v.ts desc) as r from views v where ${q5.where(f)})
    select path as k, count(*) as n from ranked where r = 1 group by 1 order by 2 desc limit 15`))
  const [refs, sources, mediums, campaigns, srefs, outbound, shares, shareGames] = await Promise.all([
    top(d, 'ref_host', f, 25), top(d, 'utm_source', f, 12), top(d, 'utm_medium', f, 8), top(d, 'utm_campaign', f, 12), top(d, 'sref', f, 10),
    propCounts(d, f, 'outbound', 'host', 15), propCounts(d, f, 'share', 'outcome', 6), propCounts(d, f, 'share', null, 15),
  ])
  return { kinds, refs, refPaths, sources, mediums, campaigns, srefs, landing, flows, exits, outbound, shares, shareGames }
}

export async function retention(d: Db, f: Filter) {
  const q = new Q()
  const tz = q.p(f.tz)
  // New: a visitor with no earlier visit in the database and none in their passport.
  const daily = await rows(d, q, `
    with firsts as (select v.vid, min(v.ts) as first from views v where v.vid is not null group by 1)
    select to_char(date_trunc('${truncOf(f.bucket)}', v.ts at time zone ${tz}), ${tLabel}) as t,
      count(distinct ${VISITOR}) filter (where (v.vid is null and coalesce(v.first_days, 0) = 0) or (v.vid is not null and date_trunc('day', fi.first) = date_trunc('day', v.ts) and coalesce(v.first_days, 0) = 0)) as fresh,
      count(distinct ${VISITOR}) as all_
    from views v left join firsts fi on fi.vid = v.vid where ${q.where(f)} group by 1 order by 1`)
  const q2 = new Q()
  const [ids] = await rows(d, q2, `
    with per as (select v.vid, count(distinct date_trunc('day', v.ts)) as days, count(distinct v.game) as games, count(*) as views
      from views v where ${q2.where(f)} and v.vid is not null group by 1)
    select count(*) as n, count(*) filter (where days > 1) as returned, coalesce(avg(days), 0) as days, coalesce(avg(games), 0) as games, coalesce(avg(views), 0) as views from per`)
  const q3 = new Q()
  const daysHist = pairs(await rows(d, q3, `
    with per as (select v.vid, count(distinct date_trunc('day', v.ts)) as days from views v where ${q3.where(f)} and v.vid is not null group by 1)
    select case when days >= 8 then '8+' else days::text end as k, count(*) as n from per group by 1 order by min(days)`))
  const q4 = new Q()
  const gamesHist = pairs(await rows(d, q4, `
    with per as (select ${VISITOR} as who, count(distinct v.game) as games from views v where ${q4.where(f)} group by 1)
    select case when games >= 10 then '10+' else games::text end as k, count(*) as n from per group by 1 order by min(games)`))
  const q5 = new Q()
  // From the passport each browser keeps: how many games it has ever been to, and on how many days.
  const passport = pairs(await rows(d, q5, `
    with last as (select distinct on (${VISITOR}) v.games_seen, v.visit_days from views v where ${q5.where(f)} order by ${VISITOR}, v.ts desc)
    select case when games_seen is null or games_seen = 0 then 'none yet' when games_seen < 5 then '1–4' when games_seen < 10 then '5–9'
      when games_seen < 20 then '10–19' when games_seen < 31 then '20–30' else 'all 31' end as k, count(*) as n from last group by 1 order by min(coalesce(games_seen, 0))`))
  const q6 = new Q()
  const consent = pairs(await rows(d, q6, `select coalesce(v.consent, 'unknown') as k, count(distinct ${VISITOR}) as n from views v where ${q6.where(f)} group by 1 order by 2 desc`))
  return {
    daily: daily.map((r) => ({ t: String(r.t), fresh: n(r.fresh), returning: Math.max(0, n(r.all_) - n(r.fresh)) })),
    ids: { n: n(ids.n), returned: n(ids.returned), days: n(ids.days), games: n(ids.games), views: n(ids.views) },
    daysHist, gamesHist, passport, consent,
  }
}

/** Each Web Vital rated here, against Google's own lines, rather than trusting the rating a browser sent. */
const RATE = `case e.props->>'metric'
  when 'LCP' then case when (e.props->>'value')::float <= 2500 then 'good' when (e.props->>'value')::float <= 4000 then 'mid' else 'poor' end
  when 'INP' then case when (e.props->>'value')::float <= 200 then 'good' when (e.props->>'value')::float <= 500 then 'mid' else 'poor' end
  when 'CLS' then case when (e.props->>'value')::float <= 0.1 then 'good' when (e.props->>'value')::float <= 0.25 then 'mid' else 'poor' end
  when 'FCP' then case when (e.props->>'value')::float <= 1800 then 'good' when (e.props->>'value')::float <= 3000 then 'mid' else 'poor' end
  when 'TTFB' then case when (e.props->>'value')::float <= 800 then 'good' when (e.props->>'value')::float <= 1800 then 'mid' else 'poor' end end`

export async function health(d: Db, f: Filter) {
  const q = new Q()
  const vit = await rows(d, q, `
    select e.props->>'metric' as metric, v.device, count(*) as n,
      percentile_cont(0.75) within group (order by (e.props->>'value')::float) as p75,
      count(*) filter (where ${RATE} = 'good') as good, count(*) filter (where ${RATE} = 'mid') as mid, count(*) filter (where ${RATE} = 'poor') as poor
    from events e join views v on v.pid = e.pid where ${q.where(f, 'e.ts')} and e.name = 'vital' group by grouping sets ((1), (1, 2))`)
  const q2 = new Q()
  const pages = await rows(d, q2, `
    select v.path, count(distinct v.pid) as n,
      percentile_cont(0.75) within group (order by (e.props->>'value')::float) filter (where e.props->>'metric' = 'LCP') as lcp,
      percentile_cont(0.75) within group (order by (e.props->>'value')::float) filter (where e.props->>'metric' = 'INP') as inp,
      percentile_cont(0.75) within group (order by (e.props->>'value')::float) filter (where e.props->>'metric' = 'CLS') as cls,
      percentile_cont(0.75) within group (order by (e.props->>'value')::float) filter (where e.props->>'metric' = 'TTFB') as ttfb
    from events e join views v on v.pid = e.pid where ${q2.where(f, 'e.ts')} and e.name = 'vital' group by 1 order by 2 desc limit 40`)
  const q3 = new Q()
  const errs = await rows(d, q3, `
    select e.props->>'msg' as msg, e.props->>'src' as src, max((e.props->>'line')::int) as line, count(*) as n, count(distinct v.path) as pages,
      count(distinct ${VISITOR}) as visitors, string_agg(distinct v.browser, ', ') as browsers, string_agg(distinct v.path, ', ') as paths, max(e.ts) as last
    from events e join views v on v.pid = e.pid where ${q3.where(f, 'e.ts')} and e.name = 'error' group by 1, 2 order by 4 desc limit 30`)
  const q4 = new Q()
  const missing = pairs(await rows(d, q4, `select v.path as k, count(*) as n from views v where ${q4.where(f, 'v.ts', { game: false })} and v.status = 404 group by 1 order by 2 desc limit 20`))
  const fps = (await island(d, f)).fps
  return {
    vitals: vit.map((r) => ({ metric: String(r.metric), device: r.device === null ? null : String(r.device), n: n(r.n), p75: n(r.p75), good: n(r.good), mid: n(r.mid), poor: n(r.poor) })),
    pages: pages.map((r) => ({ path: String(r.path), n: n(r.n), lcp: r.lcp === null ? null : n(r.lcp), inp: r.inp === null ? null : n(r.inp), cls: r.cls === null ? null : n(r.cls), ttfb: r.ttfb === null ? null : n(r.ttfb) })),
    errors: errs.map((r) => ({ msg: String(r.msg ?? ''), src: String(r.src ?? ''), line: n(r.line), n: n(r.n), pages: n(r.pages), visitors: n(r.visitors), browsers: String(r.browsers ?? ''), paths: String(r.paths ?? ''), last: r.last })),
    missing, fps,
  }
}

/** The filter's choices: every country, and every game, that has any traffic at all in the range. */
export async function options(d: Db, f: Filter) {
  const g = { ...f, country: undefined, device: undefined, game: undefined }
  const [countries, games] = await Promise.all([top(d, 'country', g, 250), top(d, 'game', g, 100)])
  return { countries: countries.map((c) => c.k), games: games.map((x) => x.k) }
}

/** Kept from phase 1 for the checker: the overview's lists, by name. */
export async function vitals(d: Db, f: Filter) {
  return (await health(d, f)).vitals.filter((v) => v.device === null).map(({ metric, n: count, p75 }) => ({ metric, n: count, p75 }))
}

/** The raw rows of a range, for the CSV export. */
export async function rawViews(d: Db, f: Filter, limit = 100_000) {
  const q = new Q()
  return rows(d, q, `select v.ts, v.path, v.game, v.vid is not null as has_id, v.consent, v.ref_host, v.ref_path, v.from_path, v.sref, v.utm_source, v.utm_medium, v.utm_campaign,
      v.country, v.region, v.city, v.device, v.os, v.browser, v.bver, v.vw, v.vh, v.dpr, v.lang, v.tz, v.dark, v.rm, v.conn, v.first_days, v.games_seen, v.visit_days,
      v.engaged_ms, v.scroll, v.status
    from views v where ${q.where(f)} order by v.ts limit ${Math.min(100_000, limit)}`)
}
export async function rawEvents(d: Db, f: Filter, limit = 100_000) {
  const q = new Q()
  return rows(d, q, `select e.ts, e.name, coalesce(e.game, v.game) as game, e.props::text as props, v.path, v.country, v.city, v.device
    from events e join views v on v.pid = e.pid where ${q.where(f, 'e.ts')} order by e.ts limit ${Math.min(100_000, limit)}`)
}
