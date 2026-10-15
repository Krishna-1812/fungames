/**
 * The admin page's tabs: each takes what /api/admin/stats/ answered for it
 * and lays it out as stat tiles and cards. Nothing here fetches or decides
 * anything; the page script (src/pages/admin/index.astro) does that.
 */
import { el, card, stats, section, tableEl, fmt, full, pct, share, dur, ago, country, language, when, type Table } from './ui'
import { lineChart, columns, barList, stackBar, weekGrid, funnel, spark, worldMap, splitBars, spreadRows, flowChart, cohortGrid, islandHeat, VITALS, vitalValue, vitalRating, statusBadge, type BarRow, type IslandMap } from './charts'

export type Bucket = 'hour' | 'day' | 'week'
export type Ctx = {
  titles: Record<string, string>
  isoByName: Record<string, string>
  bucket: Bucket
  compare: boolean
  /** Open one game's page. */
  openGame: (slug: string) => void
  /** Narrow the whole page to one country. */
  pickCountry: (iso: string) => void
  /** The island's picture and buildings, for the heat-maps (null if the build had no poster). */
  heat: IslandMap | null
  /** Ask the server for one more thing in the same filter (an error in detail). */
  fetch: (params: Record<string, string>) => Promise<Any>
}
type KV = { k: string; n: number }
type Top = { k: string; views: number; visitors: number }
// The server's answers are plain JSON; each tab reads what it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const gameName = (c: Ctx, s: string | null | undefined) => (s ? c.titles[s] ?? s : '')
const pageName = (c: Ctx, p: string) => (p === '/' ? 'The island (home)' : p.match(/^\/([a-z0-9-]+)\/$/) && c.titles[p.slice(1, -1)] ? c.titles[p.slice(1, -1)] : p)
const kvTable = (rows: KV[], a: string, b = 'Count', label: (k: string) => string = (k) => k): Table => ({ cols: [a, b], rows: rows.map((r) => [label(r.k), r.n]) })
const topTable = (rows: Top[], a: string, label: (k: string) => string = (k) => k): Table => ({ cols: [a, 'Visitors', 'Views'], rows: rows.map((r) => [label(r.k), r.visitors, r.views]) })
const bars = (rows: KV[], label?: (k: string) => string, click?: (k: string) => void): BarRow[] => rows.map((r) => ({ k: r.k, n: r.n, label: label ? label(r.k) : r.k || '(none)', onClick: click ? () => click(r.k) : undefined }))
const topBars = (rows: Top[], label?: (k: string) => string, click?: (k: string) => void): BarRow[] => rows.map((r) => ({ k: r.k, n: r.visitors, label: label ? label(r.k) : r.k, onClick: click ? () => click(r.k) : undefined }))
const grid = (root: HTMLElement) => { const g = el('div', { class: 'ad-grid' }); root.append(g); return g }
const timeline = (c: Ctx, labels: string[]) => ({ xLabel: (i: number) => when(labels[i], c.bucket), tipTitle: (i: number) => when(labels[i], c.bucket, true) })

/* ---- Overview ------------------------------------------------------------ */

export function overview(root: HTMLElement, d: Any, c: Ctx) {
  const k = d.kpis, p = d.prev
  stats(root, [
    { label: 'Visitors', value: fmt(k.visitors), delta: { now: k.visitors, before: p.visitors }, sub: `${pct(k.firstTimers, k.visitors)} new · ${pct(k.withId, k.visitors)} with an ID`, slot: 1 },
    { label: 'Page views', value: fmt(k.views), delta: { now: k.views, before: p.views }, sub: `${(k.views / Math.max(1, k.visits)).toFixed(1)} a visit`, slot: 2 },
    { label: 'Games started', value: fmt(k.starts), delta: { now: k.starts, before: p.starts }, sub: `${fmt(k.dives)} dives from the island`, slot: 3 },
    { label: 'Games finished', value: fmt(k.ends), delta: { now: k.ends, before: p.ends }, sub: `${pct(k.ends, k.starts)} of starts · ${pct(k.wins, k.ends)} won`, slot: 4 },
    { label: 'Time on a page', value: dur(k.engagedMs), delta: { now: k.engagedMs, before: p.engagedMs }, sub: `${dur(k.engagedTotalMs)} in all`, slot: 1 },
    { label: 'Shares', value: fmt(k.shares), delta: { now: k.shares, before: p.shares }, sub: 'results, links and postcards', slot: 2 },
    { label: 'One-page visits', value: share(k.bounce), delta: { now: k.bounce, before: p.bounce, invert: true }, sub: 'left within 10 s, having done nothing', slot: 3 },
    { label: 'Script errors', value: fmt(k.errors), delta: { now: k.errors, before: p.errors, invert: true }, sub: `${fmt(k.events)} events in all`, slot: 4 },
  ], c.compare)
  const g = grid(root)
  const labels: string[] = d.series.map((s: Any) => s.t)
  const prev: number[] = d.prevSeries.map((s: Any) => s.visitors)
  card(g, {
    title: 'Visitors and page views', sub: c.compare ? 'The dotted line is visitors in the period before' : undefined, span: 4,
    empty: !k.views,
    draw: (b) => lineChart(b, { labels, ...timeline(c, labels), series: [
      { name: 'Visitors', values: d.series.map((s: Any) => s.visitors), slot: 1 },
      { name: 'Page views', values: d.series.map((s: Any) => s.views), slot: 2 },
      ...(c.compare ? [{ name: 'Visitors, period before', values: labels.map((_, i) => prev[i] ?? 0), slot: 3, dashed: true }] : []),
    ] }),
    table: () => ({ cols: ['When', 'Visitors', 'Page views', ...(c.compare ? ['Visitors, period before'] : [])], rows: d.series.map((s: Any, i: number) => [when(s.t, c.bucket, true), s.visitors, s.views, ...(c.compare ? [prev[i] ?? 0] : [])]) }),
  })
  card(g, {
    title: 'Games started and finished', span: 2, empty: !k.starts && !k.ends,
    draw: (b) => lineChart(b, { labels, ...timeline(c, labels), height: 200, series: [
      { name: 'Started', values: d.series.map((s: Any) => s.starts), slot: 1 },
      { name: 'Finished', values: d.series.map((s: Any) => s.ends), slot: 2 },
    ] }),
    table: () => ({ cols: ['When', 'Started', 'Finished'], rows: d.series.map((s: Any) => [when(s.t, c.bucket, true), s.starts, s.ends]) }),
  })
  card(g, {
    title: 'Most played', sub: 'Visitors to each game. Click one for its own page', span: 2, empty: !d.games.length,
    draw: (b) => barList(b, d.games.map((r: Any) => ({ k: r.game, n: r.visitors, label: gameName(c, r.game), note: r.ends ? `${fmt(r.ends)} finished` : undefined, onClick: () => c.openGame(r.game) })), { limit: 8 }),
    table: () => ({ cols: ['Game', 'Visitors', 'Views', 'Started', 'Finished'], rows: d.games.map((r: Any) => [gameName(c, r.game), r.visitors, r.views, r.starts, r.ends]) }),
  })
  card(g, {
    title: 'Countries', sub: 'Click one to see only its visitors', span: 2, empty: !d.countries.length,
    draw: (b) => barList(b, topBars(d.countries, country, c.pickCountry), { limit: 8 }),
    table: () => topTable(d.countries, 'Country', country),
  })
  card(g, {
    title: 'Came from', sub: 'Other sites that sent visitors', span: 1, empty: !d.refs.length, emptyText: 'Nobody has come from another site yet.',
    draw: (b) => barList(b, topBars(d.refs), { limit: 8 }), table: () => topTable(d.refs, 'Site'),
  })
  card(g, {
    title: 'Devices', span: 1, empty: !d.devices.length,
    draw: (b) => stackBar(b, d.devices.map((r: Top, i: number) => ({ k: cap(r.k), n: r.visitors, slot: i + 1 }))),
    table: () => topTable(d.devices, 'Device'),
  })
}

/* ---- Live ----------------------------------------------------------------- */

export function live(root: HTMLElement, d: Any, c: Ctx) {
  const pages: Any[] = d.pages
  const by = new Map<string, number>()
  for (const p of pages) by.set(p.path, (by.get(p.path) ?? 0) + 1)
  stats(root, [
    { label: 'Here now', value: fmt(d.now), sub: 'visitors active in the last five minutes', slot: 1 },
    { label: 'Pages open', value: fmt(pages.length), sub: `${by.size} different pages`, slot: 2 },
    { label: 'Events, last 30 minutes', value: fmt(d.perMin.reduce((a: number, r: KV) => a + r.n, 0)), sub: 'everything done on the site', slot: 3 },
    { label: 'Countries now', value: fmt(new Set(pages.map((p) => p.country).filter(Boolean)).size), sub: 'among the people here', slot: 4 },
  ], false)
  const g = grid(root)
  const values = new Map<string, number>()
  for (const p of pages) if (p.country) values.set(p.country, (values.get(p.country) ?? 0) + 1)
  card(g, {
    title: 'Where they are', sub: 'Each dot is a page open in the last five minutes', span: 4,
    draw: (b) => { void worldMap(b, { values, isoByName: c.isoByName, unit: 'pages open', dots: pages.filter((p) => p.lat !== null && p.lon !== null).map((p) => ({ lat: p.lat, lon: p.lon, label: [p.city, country(p.country)].filter(Boolean).join(', ') })) }) },
    table: () => ({ cols: ['Page', 'City', 'Country', 'Device', 'Seen'], rows: pages.map((p) => [pageName(c, p.path), p.city ?? '', country(p.country ?? ''), p.device ?? '', ago(p.seen)]) }),
  })
  card(g, {
    title: 'Open right now', span: 2, empty: !by.size, emptyText: 'Nobody in the last five minutes.',
    draw: (b) => barList(b, [...by].sort((a, b2) => b2[1] - a[1]).map(([k, n]) => ({ k, n, label: pageName(c, k) })), { limit: 10, unit: 'pages' }),
    table: () => ({ cols: ['Page', 'Open'], rows: [...by].map(([k, n]) => [pageName(c, k), n]) }),
  })
  card(g, {
    title: 'Events a minute', sub: 'The last half hour', span: 2, empty: !d.perMin.length,
    draw: (b) => columns(b, { labels: d.perMin.map((r: KV) => r.k), values: d.perMin.map((r: KV) => r.n), tipTitle: (i) => d.perMin[i].k, unit: 'events', height: 180 }),
    table: () => kvTable(d.perMin, 'Minute', 'Events'),
  })
  card(g, {
    title: 'As it happens', sub: 'The newest first; it refreshes every ten seconds', span: 4, empty: !d.events.length, emptyText: 'Nothing in the last half hour.',
    draw: (b) => b.append(feed(c, d.events)),
    table: () => ({ cols: ['When', 'What', 'Where', 'Details', 'City', 'Country', 'Device'], rows: d.events.map((e: Any) => [new Date(e.ts).toLocaleTimeString(), EV[e.name] ?? e.name, e.game ? gameName(c, e.game) : pageName(c, e.path), propsText(e.props), e.city ?? '', country(e.country ?? ''), e.device ?? '']) }),
  })
}

export const EV: Record<string, string> = {
  game_start: 'started', game_end: 'finished', game_result: 'result', game_best: 'personal best', game_level: 'level', game_restart: 'restarted',
  game_pause: 'paused', game_howto: 'how to play', sound: 'sound', share: 'shared', vital: 'speed', error: 'error', outbound: 'left for',
  notfound: '404', consent: 'consent', isl_dive: 'dived into', isl_card: 'looked at', isl_search: 'searched', isl_filter: 'filtered',
  isl_surprise: 'surprise me', isl_today: 'today', isl_board: 'noticeboard', isl_board_go: 'noticeboard', isl_poke: 'poked', isl_bottle: 'bottle',
  isl_postcard: 'postcard', isl_passport: 'passport', isl_cover: 'cover', isl_time: 'day/night', isl_welcome: 'welcome', isl_minimap: 'mini-map',
  isl_ball: 'ball', isl_pigeons: 'pigeons', isl_session: 'explored', isl_fps: 'island fps',
  game_pick: 'picked', game_quit: 'left mid-game', isl_tap: 'tapped the map', next_show: 'saw up next', next_go: 'went on to',
}
const propsText = (p: Record<string, unknown>) => Object.entries(p ?? {}).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(' · ')
function feed(c: Ctx, events: Any[]) {
  return el('ol', { class: 'ad-feed' }, ...events.map((e) => el('li', {},
    el('span', { class: `ad-ev k-${e.name.split('_')[0]}`, text: EV[e.name] ?? e.name }),
    el('b', { text: e.game ? gameName(c, e.game) : pageName(c, e.path) }),
    el('span', { class: 'ad-feed-p', text: propsText(e.props) }),
    el('span', { class: 'ad-dim', text: `${[e.city, e.country ? country(e.country) : null].filter(Boolean).join(', ') || 'somewhere'} · ${e.device ?? ''} · ${ago(e.ts)}` }))))
}

/* ---- Games ----------------------------------------------------------------- */

export function games(root: HTMLElement, rows: Any[], c: Ctx, listed: string[]) {
  const all = new Map(rows.map((r) => [r.game, r]))
  // Every game, played or not: a game nobody opened is worth seeing too.
  const full2 = listed.map((s) => all.get(s) ?? { game: s, views: 0, visitors: 0, engagedMs: 0, starts: 0, ends: 0, wins: 0, shares: 0, restarts: 0, howto: 0, dives: 0, cards: 0, medianMs: 0, trend: [] })
  // Unlisted games (Powder) too; anything else is not a game.
  for (const r of rows) if (!listed.includes(r.game) && c.titles[r.game]) full2.push(r)
  const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0)
  stats(root, [
    { label: 'Games opened', value: `${rows.filter((r) => r.views && listed.includes(r.game)).length} of ${listed.length}`, sub: 'had at least one visitor', slot: 1 },
    { label: 'Starts', value: fmt(sum('starts')), sub: `${pct(sum('starts'), sum('views'))} of game page loads`, slot: 2 },
    { label: 'Finishes', value: fmt(sum('ends')), sub: `${pct(sum('ends'), sum('starts'))} of starts`, slot: 3 },
    { label: 'Restarts', value: fmt(sum('restarts')), sub: `${fmt(sum('howto'))} how-to-play opens`, slot: 4 },
  ], false)
  const g = grid(root)
  const t = el('div', { class: 'ad-scroll' })
  const table = el('table', { class: 'ad-table ad-games' })
  const cols: [string, (r: Any) => number | string][] = [
    ['Visitors', (r) => r.visitors], ['Views', (r) => r.views], ['Started', (r) => r.starts], ['Finished', (r) => r.ends],
    ['Completion', (r) => (r.starts ? r.ends / r.starts : -1)], ['Won', (r) => (r.ends ? r.wins / r.ends : -1)], ['From island', (r) => r.dives],
    ['Shares', (r) => r.shares], ['Restarts', (r) => r.restarts], ['How-to', (r) => r.howto], ['Median game', (r) => r.medianMs], ['Time on page', (r) => r.engagedMs],
  ]
  let sortBy = 0, dir = -1
  const head = el('tr', {}, el('th', { scope: 'col', class: 'a-l', text: 'Game' }), el('th', { scope: 'col', class: 'a-l', text: 'Trend' }), ...cols.map(([n2], i) => el('th', { scope: 'col', class: 'a-r' }, el('button', { type: 'button', 'data-i': i, text: n2 }))))
  const body = el('tbody')
  const show = (v: number | string, i: number) => (i === 4 || i === 5 ? (Number(v) < 0 ? '–' : share(Number(v))) : i >= 10 ? (Number(v) ? dur(Number(v)) : '–') : full(Number(v)))
  const paint = () => {
    const sorted = [...full2].sort((a, b) => (Number(cols[sortBy][1](a)) - Number(cols[sortBy][1](b))) * dir)
    body.replaceChildren(...sorted.map((r) => {
      const tr = el('tr', { class: 'is-link', tabindex: 0 }, el('th', { scope: 'row', class: 'a-l', text: gameName(c, r.game) }), el('td', { class: 'a-l' }, r.trend?.length ? spark(r.trend) : ''),
        ...cols.map(([, f2], i) => el('td', { class: 'a-r', text: show(f2(r), i) })))
      tr.addEventListener('click', () => c.openGame(r.game))
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') c.openGame(r.game) })
      return tr
    }))
  }
  head.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return
    const i = Number(b.dataset.i); dir = sortBy === i ? -dir : -1; sortBy = i
    for (const x of head.querySelectorAll('button')) x.removeAttribute('aria-sort')
    b.setAttribute('aria-sort', dir < 0 ? 'descending' : 'ascending'); paint()
  })
  table.append(el('thead', {}, head), body); t.append(table); paint()
  const tableCard = card(g, {
    title: 'Every game', sub: 'Click a column to sort, a row to open the game. Completion is finishes over starts', span: 4,
    table: () => ({ cols: ['Game', ...cols.map(([n2]) => n2)], rows: full2.map((r) => [gameName(c, r.game), ...cols.map(([, f2], i) => (i === 4 || i === 5 ? (Number(f2(r)) < 0 ? '' : +(Number(f2(r)) * 100).toFixed(1)) : Number(f2(r))))]) }),
    file: 'games',
  })
  tableCard.querySelector('.ad-card-body')!.replaceChildren(t)
  card(g, {
    title: 'Finished, of those who started', sub: 'Games with at least five starts', span: 2, empty: !rows.some((r) => r.starts >= 5),
    emptyText: 'No game has five starts yet.',
    draw: (b) => barList(b, rows.filter((r) => r.starts >= 5).map((r) => ({ k: r.game, n: Math.round((r.ends / r.starts) * 100), label: gameName(c, r.game), note: `${r.ends} of ${r.starts}`, onClick: () => c.openGame(r.game) })).sort((a, b2) => b2.n - a.n), { max: 100, unit: '%', limit: 12 }),
    table: () => ({ cols: ['Game', 'Started', 'Finished', 'Completion %'], rows: rows.filter((r) => r.starts).map((r) => [gameName(c, r.game), r.starts, r.ends, +((r.ends / r.starts) * 100).toFixed(1)]) }),
  })
  card(g, {
    title: 'Longest looked at', sub: 'Average time on the game’s page', span: 2, empty: !rows.some((r) => r.engagedMs),
    draw: (b) => barList(b, rows.filter((r) => r.engagedMs).map((r) => ({ k: r.game, n: Math.round(r.engagedMs / 1000), label: gameName(c, r.game), note: dur(r.engagedMs), onClick: () => c.openGame(r.game) })).sort((a, b2) => b2.n - a.n), { unit: 's', limit: 12 }),
    table: () => ({ cols: ['Game', 'Seconds on page'], rows: rows.map((r) => [gameName(c, r.game), Math.round(r.engagedMs / 1000)]) }),
  })
}

/* ---- One game --------------------------------------------------------------- */

export function game(root: HTMLElement, d: Any, slug: string, c: Ctx, back: () => void) {
  const f = d.funnel
  const backBtn = el('button', { type: 'button', class: 'ad-back', text: '← Every game' })
  backBtn.addEventListener('click', back)
  root.append(el('div', { class: 'ad-game-head' }, backBtn, el('h2', { text: gameName(c, slug) }), el('a', { href: `/${slug}/`, class: 'ad-open', target: '_blank', rel: 'noopener', text: 'Open the game ↗' })))
  stats(root, [
    { label: 'Visitors', value: fmt(d.visitors), sub: `${fmt(f.views)} page loads`, slot: 1 },
    { label: 'Started', value: pct(f.started, f.views), sub: `${fmt(f.started)} of the page loads`, slot: 2 },
    { label: 'Finished', value: pct(f.finished, f.started), sub: `of starts · ${pct(f.won, f.finished)} won`, slot: 3 },
    { label: 'A game takes', value: d.duration.median ? dur(d.duration.median * 1000) : '–', sub: d.duration.p90 ? `median; 1 in 10 take over ${dur(d.duration.p90 * 1000)}` : 'median, start to ending', slot: 4 },
    { label: 'Time on the page', value: dur(d.engagedMs), sub: `read ${d.scroll}% of the way down`, slot: 1 },
    { label: 'Shared', value: fmt(f.shared), sub: `${pct(f.shared, f.finished)} of finishes`, slot: 2 },
    { label: 'Restarts', value: fmt(d.restarts), sub: `${fmt(d.howto)} read how to play · ${fmt(d.pauses)} paused`, slot: 3 },
    { label: 'Personal bests', value: fmt(d.bests), sub: `${fmt(d.soundOn)} turned the sound on`, slot: 4 },
  ], false)
  const g = grid(root)
  card(g, {
    title: 'From opening to sharing', sub: 'Page loads, and how many of them got each step further', span: 2, empty: !f.views,
    draw: (b) => funnel(b, [{ k: 'Opened', n: f.views }, { k: 'Started', n: f.started }, { k: 'Finished', n: f.finished }, { k: 'Won', n: f.won }, { k: 'Shared', n: f.shared }]),
    table: () => ({ cols: ['Step', 'Page loads'], rows: [['Opened', f.views], ['Started', f.started], ['Finished', f.finished], ['Won', f.won], ['Shared', f.shared]] }),
  })
  const labels: string[] = d.series.map((s: Any) => s.t)
  card(g, {
    title: 'Over time', span: 2, empty: !f.views,
    draw: (b) => lineChart(b, { labels, ...timeline(c, labels), height: 220, series: [
      { name: 'Page views', values: d.series.map((s: Any) => s.views), slot: 1 },
      { name: 'Started', values: d.series.map((s: Any) => s.starts), slot: 2 },
      { name: 'Finished', values: d.series.map((s: Any) => s.ends), slot: 3 },
    ] }),
    table: () => ({ cols: ['When', 'Views', 'Started', 'Finished'], rows: d.series.map((s: Any) => [when(s.t, c.bucket, true), s.views, s.starts, s.ends]) }),
  })
  crowd(root, d)
  section(root, 'What players got', 'Every number the game reports at its ending, as a spread across everyone who finished')
  const g2 = grid(root)
  if (!d.results.length) card(g2, { title: 'Results', span: 4, empty: true, emptyText: 'Nobody has finished this game in this period yet.' })
  for (const r of d.results) {
    const nf = (v: number) => (Math.abs(v) >= 100 ? fmt(Math.round(v)) : fmt(+v.toFixed(2)))
    card(g2, {
      title: label(r.k), sub: `${fmt(r.count)} endings · median ${nf(r.median)} · most ${nf(r.max)}${r.log ? ' · on a log scale: each bar wider than the last by the same ratio' : ''}`, span: 2,
      draw: (b) => columns(b, { labels: r.bins.map((x: Any) => nf(x.lo)), values: r.bins.map((x: Any) => x.n), tipTitle: (i) => `${nf(r.bins[i].lo)} to ${nf(r.bins[i].hi)}`, unit: 'endings', xLabel: (i) => nf(r.bins[i].lo) }),
      table: () => ({ cols: ['From', 'To', 'Endings'], rows: r.bins.map((x: Any) => [+x.lo.toFixed(2), +x.hi.toFixed(2), x.n]) }),
    })
  }
  for (const w of d.words) card(g2, {
    title: label(w.k), sub: 'The most common', span: 2,
    draw: (b) => barList(b, w.values.map((v: KV) => ({ k: v.k, n: v.n })), { limit: 10 }),
    table: () => kvTable(w.values, label(w.k)),
  })
  if (d.duration.bins.length) card(g2, {
    title: 'How long a game takes', sub: `From the first touch to the ending · median ${dur(d.duration.median * 1000)}`, span: 2,
    draw: (b) => columns(b, { labels: d.duration.bins.map((x: Any) => dur(x.lo * 1000)), values: d.duration.bins.map((x: Any) => x.n), tipTitle: (i) => `${dur(d.duration.bins[i].lo * 1000)} to ${dur(d.duration.bins[i].hi * 1000)}`, unit: 'games', xLabel: (i) => dur(d.duration.bins[i].lo * 1000) }),
    table: () => ({ cols: ['From (s)', 'To (s)', 'Games'], rows: d.duration.bins.map((x: Any) => [Math.round(x.lo), Math.round(x.hi), x.n]) }),
  })
  section(root, 'How they got there, and how far they went')
  const g3 = grid(root)
  card(g3, { title: 'Arrived from', span: 1, empty: !d.entry.length, draw: (b) => barList(b, bars(d.entry)), table: () => kvTable(d.entry, 'From', 'Page loads') })
  card(g3, { title: 'Devices', span: 1, empty: !d.devices.length, draw: (b) => stackBar(b, d.devices.map((r: Top, i: number) => ({ k: cap(r.k), n: r.visitors, slot: i + 1 }))), table: () => topTable(d.devices, 'Device') })
  card(g3, { title: 'Milestones reached', sub: 'Level-ups and milestones the game announced', span: 1, empty: !d.levels.length, emptyText: 'This game announces no milestones, or nobody reached one.', draw: (b) => barList(b, bars(d.levels), { limit: 10 }), table: () => kvTable(d.levels, 'Milestone') })
  card(g3, { title: 'Shares', sub: 'What happened when Share was pressed', span: 1, empty: !d.shares.length, emptyText: 'Not shared yet.', draw: (b) => barList(b, bars(d.shares, (k) => ({ shared: 'Sent from the share sheet', downloaded: 'Saved the card', copied: 'Copied the link', dismissed: 'Closed the sheet', failed: 'Could not share' })[k] ?? k)), table: () => kvTable(d.shares, 'Outcome') })
}
const yesNo = (k: string) => (k === 'true' ? 'Yes' : k === 'false' ? 'No' : k)
const nfmt = (v: number) => (Math.abs(v) >= 100 ? fmt(Math.round(v)) : fmt(+v.toFixed(2)))

/** The crowd's choices (game_pick), where runs stop (game_quit) and how far they get (game_level). */
function crowd(root: HTMLElement, d: Any) {
  section(root, 'What the crowd chose', 'Every choice, discovery and step the game reports, from everyone who played it in this period')
  const g = grid(root)
  if (!d.crowd.length) card(g, { title: 'Choices', span: 4, empty: true, emptyText: 'Nobody has made a choice in this game in this period yet.' })
  for (const q of d.crowd) {
    if (q.kind === 'split') card(g, {
      title: q.what, sub: `${fmt(q.total)} answers across ${fmt(q.rows.length)} ${q.rows.length === 1 ? 'question' : 'questions'}`, span: q.rows.length > 4 ? 4 : 2,
      draw: (b) => splitBars(b, q.rows, q.answers, { label: yesNo }),
      table: () => {
        const ans: string[] = [...new Set<string>(q.rows.flatMap((r: Any) => r.values.map((v: KV) => v.k)))]
        return { cols: ['Question', 'Answers', ...ans.map(yesNo)], rows: q.rows.map((r: Any) => [r.of, r.n, ...ans.map((a) => r.values.find((v: KV) => v.k === a)?.n ?? 0)]) }
      },
    })
    else if (q.kind === 'splitNumber') card(g, {
      title: q.what, sub: `${fmt(q.total)} answers · the dot is the median, the thick line runs to the 90th percentile`, span: q.rows.length > 6 ? 4 : 2,
      draw: (b) => spreadRows(b, q.rows),
      table: () => ({ cols: ['For', 'Answers', 'Median', '90th percentile', 'Mean', 'Least', 'Most'], rows: q.rows.map((r: Any) => [r.of, r.n, +r.median.toFixed(2), +r.p90.toFixed(2), +r.mean.toFixed(2), +r.min.toFixed(2), +r.max.toFixed(2)]) }),
    })
    else if (q.kind === 'number') card(g, {
      title: q.what, sub: `${fmt(q.total)} answers · median ${nfmt(q.median)} · from ${nfmt(q.min)} to ${nfmt(q.max)}${q.log ? ' · log scale' : ''}`, span: 2,
      draw: (b) => columns(b, { labels: q.bins.map((x: Any) => nfmt(x.lo)), values: q.bins.map((x: Any) => x.n), tipTitle: (i) => `${nfmt(q.bins[i].lo)} to ${nfmt(q.bins[i].hi)}`, unit: 'answers', xLabel: (i) => nfmt(q.bins[i].lo), slot: 3 }),
      table: () => ({ cols: ['From', 'To', 'Answers'], rows: q.bins.map((x: Any) => [+x.lo.toFixed(2), +x.hi.toFixed(2), x.n]) }),
    })
    else card(g, {
      title: q.what, sub: `${fmt(q.total)} answers · ${fmt(q.distinct)} different`, span: 2,
      draw: (b) => barList(b, q.values.map((v: KV) => ({ k: v.k, n: v.n, label: yesNo(v.k) })), { limit: 10, total: q.total, slot: 2 }),
      table: () => kvTable(q.values, q.what, 'Answers', yesNo),
    })
  }
  const st = d.stops, starts = d.funnel.started
  section(root, 'Where people stop', 'Runs left going when the page was closed or hidden, and how far runs get')
  const g2 = grid(root)
  card(g2, {
    title: 'Left mid-game, at', sub: st.total ? `${fmt(st.total)} runs left before an ending${starts ? ` · ${pct(st.total, starts)} of page loads that started` : ''}` : undefined, span: 2,
    empty: !st.total, emptyText: 'Nobody has left this game mid-way in this period.',
    draw: (b) => (st.numeric && st.list.length > 3
      ? columns(b, { labels: st.list.map((x: Any) => x.k || 'start'), values: st.list.map((x: Any) => x.n), tipTitle: (i) => (st.list[i].k ? `Stopped at ${st.list[i].k}` : 'Stopped before any progress'), unit: 'runs', slot: 4 })
      : barList(b, st.list.map((x: Any) => ({ k: x.k, n: x.n, label: x.k || 'Before any progress', note: x.ms ? `median ${dur(x.ms)} in` : undefined })), { limit: 12, slot: 4, total: st.total })),
    table: () => ({ cols: ['Stopped at', 'Runs', 'Median time in (s)'], rows: st.list.map((x: Any) => [x.k || 'before any progress', x.n, x.ms ? Math.round(x.ms / 1000) : '']) }),
  })
  card(g2, {
    title: 'How far runs get', sub: 'Pages that reached each level-up the game announced', span: 2, empty: !d.reach.length, emptyText: 'This game announces no levels, or nobody reached one.',
    draw: (b) => barList(b, d.reach.map((r: Any) => ({ k: String(r.i), n: r.n, label: r.text || `Level-up ${r.i}`, note: `${pct(r.n, d.reach[0].n)} of the first` })), { limit: 14, slot: 1 }),
    table: () => ({ cols: ['Step', 'Called', 'Reached it'], rows: d.reach.map((r: Any) => [r.i, r.text, r.n]) }),
  })
}

/** A result's key, as a heading: `actualWork` → "Actual work", `depthM` → "Depth (m)". */
const label = (k: string) => {
  const s = k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/ km s$/, ' (km/s)').replace(/ km$/, ' (km)').replace(/ m$/, ' (m)')
  return s[0].toUpperCase() + s.slice(1)
}

/* ---- Island ----------------------------------------------------------------- */

/** Which island heat-map is showing, kept across refreshes. */
let heatMode: 'taps' | 'look' | 'dives' = 'taps'
const POKES: Record<string, string> = { ufo: 'The UFO (3 a.m.)', house32: 'The 32nd building', treasure: 'Buried treasure', castaway: 'The castaway', whale: 'The whale', notice: 'The noticeboard' }
export function island(root: HTMLElement, d: Any, c: Ctx) {
  const k = d.counts
  stats(root, [
    { label: 'Visitors to the island', value: fmt(d.home.visitors), sub: `${fmt(d.home.views)} visits · ${dur(d.home.engagedMs)} on average`, slot: 1 },
    { label: 'Dives into games', value: fmt(k.dives), sub: `${pct(k.dives, d.home.views)} of island visits`, slot: 2 },
    { label: 'Things poked', value: fmt(k.pokes), sub: `${fmt(k.finds)} first finds`, slot: 3 },
    { label: 'Bottles found', value: fmt(k.bottles), sub: `${fmt(k.postcards)} postcards made`, slot: 4 },
    { label: 'Explored', value: d.session.n ? dur(d.session.secs * 1000) : '–', sub: d.session.n ? `${d.session.drags.toFixed(1)} drags · ${d.session.districts.toFixed(1)} districts a visit` : 'in a visit, on average', slot: 1 },
    { label: 'Surprise me', value: fmt(k.surprise), sub: `${fmt(k.today)} Today · ${fmt(k.board)} noticeboard`, slot: 2 },
    { label: 'Searches', value: fmt(k.searches), sub: `${fmt(k.passports)} passport opens`, slot: 3 },
    { label: 'Ball and pigeons', value: fmt(k.ball), sub: `throws · ${fmt(k.pigeons)} flocks put up · ${fmt(k.minimap)} mini-map`, slot: 4 },
  ], false)
  const g = grid(root)
  if (c.heat) {
    const map = c.heat
    const tapTotal = d.heat.taps.reduce((a: number, t: Any) => a + t.n, 0)
    // The mode buttons redraw the chart in place.
    const draw = (b: HTMLElement): void => islandHeat(b, { map, taps: d.heat.taps, look: d.heat.look, lookW: d.heat.lookW, lookH: d.heat.lookH, dives: d.dives, title: (s) => gameName(c, s), mode: heatMode, onMode: (m) => { heatMode = m; b.replaceChildren(); draw(b) } })
    card(g, {
      title: 'The island, heat-mapped', sub: `${fmt(tapTotal)} taps and clicks on the map · ${fmt(d.session.n)} visits’ worth of looking · ${fmt(k.dives)} dives`, span: 4,
      draw,
      table: () => heatMode === 'look'
        ? { cols: ['Column', 'Row', 'Seconds'], rows: d.heat.look.map((v: number, i: number) => [i % d.heat.lookW + 1, Math.floor(i / d.heat.lookW) + 1, v * 2]).filter((r: number[]) => r[2]) }
        : heatMode === 'dives' ? kvTable(d.dives, 'Game', 'Dives', (s) => gameName(c, s))
        : { cols: ['Map x', 'Map y', 'Landed on', 'Taps'], rows: d.heat.taps.map((t: Any) => [t.x, t.y, t.hit, t.n]) },
      file: 'island-heat',
    })
  }
  card(g, { title: 'Dived into', sub: 'Games entered from the map. Click one for its page', span: 2, empty: !d.dives.length, draw: (b) => barList(b, bars(d.dives, (s) => gameName(c, s), c.openGame), { limit: 12 }), table: () => kvTable(d.dives, 'Game', 'Dives', (s) => gameName(c, s)) })
  card(g, { title: 'Looked at', sub: 'Building cards opened (once a visit each)', span: 2, empty: !d.cards.length, draw: (b) => barList(b, bars(d.cards, (s) => gameName(c, s), c.openGame), { limit: 12 }), table: () => kvTable(d.cards, 'Game', 'Cards', (s) => gameName(c, s)) })
  card(g, { title: 'Poked', span: 1, empty: !d.pokes.length, draw: (b) => barList(b, bars(d.pokes, (p) => POKES[p] ?? cap(p)), { limit: 10 }), table: () => kvTable(d.pokes, 'Thing') })
  card(g, { title: 'Found for the first time', sub: 'Including the secrets', span: 1, empty: !d.finds.length, draw: (b) => barList(b, bars(d.finds, (p) => POKES[p] ?? cap(p)), { limit: 10, slot: 3 }), table: () => kvTable(d.finds, 'Thing', 'First finds') })
  card(g, { title: 'Districts explored', sub: 'In the middle of the screen at some point in a visit', span: 1, empty: !d.districts.length, draw: (b) => barList(b, bars(d.districts, district)), table: () => kvTable(d.districts, 'District', 'Visits', district) })
  card(g, { title: 'Bottles', sub: 'Found for the first time, by bottle', span: 1, empty: !d.bottles.length, emptyText: 'No bottle found yet.', draw: (b) => barList(b, bars(d.bottles.sort((a: KV, b2: KV) => Number(a.k) - Number(b2.k)), (n2) => `Bottle ${n2}`), { limit: 12, slot: 2 }), table: () => kvTable(d.bottles, 'Bottle', 'Found') })
  card(g, { title: 'Searched for', sub: 'Words typed into the games list', span: 2, empty: !d.searches.length, emptyText: 'Nobody has searched yet.', draw: (b) => barList(b, bars(d.searches), { limit: 12 }), table: () => kvTable(d.searches, 'Search') })
  card(g, { title: 'Searched, and found nothing', sub: 'Games people looked for that are not here', span: 2, empty: !d.empties.length, emptyText: 'Every search found something.', draw: (b) => barList(b, bars(d.empties), { limit: 12, slot: 4 }), table: () => kvTable(d.empties, 'Search') })
  card(g, { title: 'The noticeboard', sub: 'Opened from, and the lines followed', span: 1, empty: !d.boardFrom.length && !d.boardGo.length, draw: (b) => { barList(b, [...bars(d.boardFrom, (k2) => `Opened from ${k2}`), ...bars(d.boardGo, (k2) => `Followed: ${k2}`)]) }, table: () => ({ cols: ['What', 'Count'], rows: [...d.boardFrom.map((r: KV) => ['Opened from ' + r.k, r.n]), ...d.boardGo.map((r: KV) => ['Followed ' + r.k, r.n])] }) })
  card(g, { title: 'Postcards', span: 1, empty: !d.postcards.length, emptyText: 'No postcard yet.', draw: (b) => barList(b, bars(d.postcards, (k2) => ({ made: 'Made', save: 'Saved', share: 'Sent' })[k2] ?? k2)), table: () => kvTable(d.postcards, 'Action') })
  card(g, { title: 'The passport', sub: 'Opened, and the pages turned to', span: 1, empty: !d.tabs.length, draw: (b) => barList(b, bars(d.tabs, (k2) => (k2 === 'open' ? 'Opened' : k2[0].toUpperCase() + k2.slice(1)))), table: () => kvTable(d.tabs, 'Page') })
  card(g, { title: 'Small choices', sub: 'Filters, covers, day or night, the welcome', span: 1, empty: !d.filters.length && !d.covers.length && !d.time.length && !d.welcome.length,
    draw: (b) => barList(b, [...bars(d.filters, (k2) => `Filter: ${k2}`), ...bars(d.covers, (k2) => `Cover: ${k2}`), ...bars(d.time, (k2) => `Picked ${k2}`), ...bars(d.welcome, (k2) => `Welcome: ${k2}`)], { limit: 14 }),
    table: () => ({ cols: ['Choice', 'Count'], rows: [...d.filters.map((r: KV) => ['Filter ' + r.k, r.n]), ...d.covers.map((r: KV) => ['Cover ' + r.k, r.n]), ...d.time.map((r: KV) => ['Time ' + r.k, r.n]), ...d.welcome.map((r: KV) => ['Welcome ' + r.k, r.n])] }) })
  card(g, { title: 'How smoothly it draws', sub: 'Frames a second over five seconds, by device', span: 4, empty: !d.fps.length, tableOnly: true,
    table: () => ({ cols: ['Device', 'Measured', 'Median fps', 'Slowest 10% at'], rows: d.fps.map((r: Any) => [r.k, r.n, Math.round(r.median), Math.round(r.low)]) }) })
}
const district = (k: string) => ({ peaks: 'Sky Peaks', badlands: 'The Badlands', proving: 'Proving Grounds', harbour: 'The Harbour', funfair: 'The Funfair', market: 'Market Street', oldtown: 'Old Town' })[k] ?? k

/* ---- Audience ----------------------------------------------------------------- */

export function audience(root: HTMLElement, d: Any, c: Ctx) {
  const f = d.flags
  stats(root, [
    { label: 'Countries', value: fmt(d.countries.length), sub: d.countries[0] ? `most from ${country(d.countries[0].k)}` : 'none yet', slot: 1 },
    { label: 'On a phone', value: pct(d.devices.find((x: Top) => x.k === 'phone')?.visitors ?? 0, d.devices.reduce((a: number, x: Top) => a + x.visitors, 0)), sub: 'of visitors', slot: 2 },
    { label: 'Dark mode', value: pct(f.dark, f.darkKnown), sub: `${pct(f.touch, f.n)} touch screens`, slot: 3 },
    { label: 'Reduced motion', value: pct(f.rm, f.n), sub: 'asked their device for less movement', slot: 4 },
  ], false)
  const g = grid(root)
  const values = new Map<string, number>(d.countries.map((r: Top) => [r.k, r.visitors]))
  card(g, { title: 'Where visitors are', sub: 'Click a country to see only its visitors', span: 4, empty: !d.countries.length,
    draw: (b) => { void worldMap(b, { values, isoByName: c.isoByName, onPick: c.pickCountry }) }, table: () => topTable(d.countries, 'Country', country) })
  card(g, { title: 'Countries', span: 1, empty: !d.countries.length, draw: (b) => barList(b, topBars(d.countries, country, c.pickCountry)), table: () => topTable(d.countries, 'Country', country) })
  card(g, { title: 'Regions', span: 1, empty: !d.regions.length, draw: (b) => barList(b, bars(d.regions)), table: () => kvTable(d.regions, 'Region', 'Visitors') })
  card(g, { title: 'Cities', span: 2, empty: !d.cities.length, draw: (b) => barList(b, bars(d.cities), { limit: 12 }), table: () => kvTable(d.cities, 'City', 'Visitors') })
  card(g, { title: 'When they visit', sub: 'Day and hour in the visitor’s own time', span: 4, empty: !d.week.length, draw: (b) => weekGrid(b, d.week),
    table: () => ({ cols: ['Day', 'Hour', 'Visitors'], rows: d.week.map((r: Any) => [['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][r.dow], r.h, r.n]) }) })
  card(g, { title: 'Devices', span: 1, empty: !d.devices.length, draw: (b) => stackBar(b, d.devices.map((r: Top, i: number) => ({ k: cap(r.k), n: r.visitors, slot: i + 1 }))), table: () => topTable(d.devices, 'Device') })
  card(g, { title: 'Systems', span: 1, empty: !d.os.length, draw: (b) => barList(b, topBars(d.os)), table: () => topTable(d.os, 'System') })
  card(g, { title: 'Browsers', span: 1, empty: !d.browsers.length, draw: (b) => barList(b, bars(d.browsers), { unit: 'page views' }), table: () => kvTable(d.browsers, 'Browser', 'Page views') })
  card(g, { title: 'Languages', span: 1, empty: !d.langs.length, draw: (b) => barList(b, bars(d.langs, language)), table: () => kvTable(d.langs, 'Language', 'Visitors', language) })
  card(g, { title: 'Window widths', span: 2, empty: !d.screens.length, draw: (b) => columns(b, { labels: d.screens.map((r: KV) => r.k), values: d.screens.map((r: KV) => r.n), tipTitle: (i) => d.screens[i].k, unit: 'page views', height: 180 }), table: () => kvTable(d.screens, 'Width', 'Page views') })
  card(g, { title: 'Pixel density', span: 1, empty: !d.dpr.length, draw: (b) => barList(b, bars(d.dpr)), table: () => kvTable(d.dpr, 'Pixel ratio', 'Page views') })
  card(g, { title: 'Connections', span: 1, empty: !d.conn.length, emptyText: 'Only Chromium browsers say.', draw: (b) => barList(b, topBars(d.conn)), table: () => topTable(d.conn, 'Connection') })
  card(g, { title: 'Timezones', span: 2, empty: !d.tzs.length, draw: (b) => barList(b, topBars(d.tzs), { limit: 10 }), table: () => topTable(d.tzs, 'Timezone') })
}

/* ---- Acquisition ---------------------------------------------------------------- */

export function acquisition(root: HTMLElement, d: Any, c: Ctx) {
  const total = d.kinds.reduce((a: number, r: KV) => a + r.n, 0)
  const g = grid(root)
  card(g, { title: 'How visitors arrive', sub: 'Each visitor counted once per kind of arrival', span: 4, empty: !total,
    draw: (b) => stackBar(b, d.kinds.length <= 4 ? d.kinds.map((r: KV, i: number) => ({ k: r.k, n: r.n, slot: i + 1 })) : [...d.kinds.slice(0, 3).map((r: KV, i: number) => ({ k: r.k, n: r.n, slot: i + 1 })), { k: 'Everything else', n: d.kinds.slice(3).reduce((x: number, r: KV) => x + r.n, 0), slot: 4 }]),
    table: () => kvTable(d.kinds, 'Arrived', 'Visitors') })
  card(g, { title: 'Sites that sent visitors', span: 2, empty: !d.refs.length, emptyText: 'Nobody has come from another site yet.', draw: (b) => barList(b, topBars(d.refs), { limit: 12 }), table: () => topTable(d.refs, 'Site') })
  card(g, { title: 'The exact pages', sub: 'Which page on that site the link was on', span: 2, empty: !d.refPaths.length, draw: (b) => barList(b, bars(d.refPaths), { limit: 12 }), table: () => kvTable(d.refPaths, 'Page', 'Visitors') })
  card(g, { title: 'Campaigns', sub: 'utm_source, utm_medium and utm_campaign on links', span: 2, empty: !d.sources.length && !d.campaigns.length, emptyText: 'No tagged links yet. Add ?utm_source=… to a link you post.',
    draw: (b) => barList(b, [...topBars(d.sources, (k) => `Source: ${k}`), ...topBars(d.mediums, (k) => `Medium: ${k}`), ...topBars(d.campaigns, (k) => `Campaign: ${k}`)], { limit: 14 }),
    table: () => ({ cols: ['Tag', 'Value', 'Visitors'], rows: [...d.sources.map((r: Top) => ['source', r.k, r.visitors]), ...d.mediums.map((r: Top) => ['medium', r.k, r.visitors]), ...d.campaigns.map((r: Top) => ['campaign', r.k, r.visitors])] }) })
  card(g, { title: 'Back through a shared link', sub: 'Visitors who arrived on a link someone shared from the site', span: 2, empty: !d.srefs.length, emptyText: 'Nobody has come back through a shared link yet.', draw: (b) => barList(b, topBars(d.srefs, (k) => ({ share: 'A shared result', postcard: 'A postcard' })[k] ?? k)), table: () => topTable(d.srefs, 'Shared as') })
  card(g, { title: 'Where visits start', sub: 'The first page, arriving from outside', span: 2, empty: !d.landing.length, draw: (b) => barList(b, bars(d.landing, (p) => pageName(c, p)), { limit: 12 }), table: () => kvTable(d.landing, 'Page', 'Arrivals', (p) => pageName(c, p)) })
  card(g, { title: 'Where visits end', sub: 'The last page seen that day', span: 2, empty: !d.exits.length, draw: (b) => barList(b, bars(d.exits, (p) => pageName(c, p)), { limit: 12 }), table: () => kvTable(d.exits, 'Page', 'Last page', (p) => pageName(c, p)) })
  const flow = (k: string) => k.split(' → ').map((p) => pageName(c, p)).join(' → ')
  card(g, { title: 'From one page to the next', span: 4, empty: !d.flows.length, draw: (b) => barList(b, bars(d.flows, flow), { limit: 15 }), table: () => kvTable(d.flows, 'Path', 'Times', flow) })
  card(g, { title: 'Shares', sub: 'What happened when Share was pressed', span: 1, empty: !d.shares.length, draw: (b) => barList(b, bars(d.shares)), table: () => kvTable(d.shares, 'Outcome') })
  card(g, { title: 'Shared from', span: 1, empty: !d.shareGames.length, draw: (b) => barList(b, bars(d.shareGames, (s) => gameName(c, s))), table: () => kvTable(d.shareGames, 'Game', 'Shares', (s) => gameName(c, s)) })
  card(g, { title: 'Left for', sub: 'Links to other sites that were followed (Buy Me a Coffee among them)', span: 2, empty: !d.outbound.length, emptyText: 'Nobody has followed a link out yet.', draw: (b) => barList(b, bars(d.outbound)), table: () => kvTable(d.outbound, 'Site', 'Clicks') })
}

/* ---- Journeys -------------------------------------------------------------------- */

export function journeys(root: HTMLElement, d: Any, c: Ctx) {
  const [visits, isl, card1, dive, play, fin, shared] = d.island
  const [, game, gplay, gfin, gshared] = d.games
  const avg = d.lengths.reduce((a: number, r: KV) => a + (r.k === '8+' ? 8 : Number(r.k)) * r.n, 0) / Math.max(1, d.visits)
  stats(root, [
    { label: 'Visits', value: fmt(visits), sub: 'a visitor’s pages on one day', slot: 1 },
    { label: 'Pages a visit', value: d.visits ? avg.toFixed(1) : '–', sub: `${pct(d.lengths.find((r: KV) => r.k === '1')?.n ?? 0, d.visits)} saw only one`, slot: 2 },
    { label: 'Island to a game', value: pct(dive, isl), sub: 'of visits that saw the island went into a game from the map', slot: 3 },
    { label: 'Played to the end', value: pct(gfin, gplay), sub: 'of visits that started a game finished one', slot: 4 },
  ], false)
  const g = grid(root)
  const steps = (xs: [string, number][]) => xs.map(([k, n]) => ({ k, n }))
  const islandSteps = steps([['Visits', visits], ['Saw the island', isl], ['Opened a building’s card', card1], ['Went into a game from the map', dive], ['Started playing', play], ['Finished a game', fin], ['Shared something', shared]])
  const gameSteps = steps([['Visits', visits], ['Opened a game', game], ['Started playing', gplay], ['Finished a game', gfin], ['Shared something', gshared]])
  card(g, { title: 'From the island', sub: 'Each step counts visits that did every step before it too', span: 2, empty: !visits,
    draw: (b) => funnel(b, islandSteps), table: () => kvTable(islandSteps, 'Step', 'Visits') })
  card(g, { title: 'Any visit, to a shared result', sub: 'However they arrived: straight to a game, from a link, from the island', span: 2, empty: !visits,
    draw: (b) => funnel(b, gameSteps), table: () => kvTable(gameSteps, 'Step', 'Visits') })
  const lab = (k: string) => (k === '(left)' ? 'Left the site' : k === '(other)' ? 'Another page' : pageName(c, k))
  card(g, { title: 'Page to page', sub: 'The first four steps of every visit: the commonest pages at each step, and where visits ended', span: 4, empty: !d.visits,
    draw: (b) => flowChart(b, { steps: d.flow.steps, links: d.flow.links, label: lab, heads: ['First page', 'Second', 'Third', 'Fourth'] }),
    table: () => ({ cols: ['Step', 'From', 'To', 'Visits'], rows: d.flow.links.map((l: Any) => [`${l.s + 1} → ${l.s + 2}`, lab(l.a), lab(l.b), l.n]) }), file: 'page-flow' })
  const path = (k: string) => k.split(' ').map((p) => (p === '…' ? '…' : pageName(c, p))).join(' → ')
  card(g, { title: 'The commonest visits', sub: 'Whole visits, page by page (a reload is not a step; past five pages, …)', span: 2, empty: !d.top.length,
    draw: (b) => barList(b, d.top.map((r: KV) => ({ k: r.k, n: r.n, label: path(r.k) })), { limit: 12, total: d.visits }),
    table: () => kvTable(d.top, 'Visit', 'Times', path) })
  card(g, { title: 'Pages in a visit', sub: 'Different pages, in a row', span: 2, empty: !d.lengths.length,
    draw: (b) => columns(b, { labels: d.lengths.map((r: KV) => r.k), values: d.lengths.map((r: KV) => r.n), tipTitle: (i) => `${d.lengths[i].k} page${d.lengths[i].k === '1' ? '' : 's'}`, unit: 'visits', height: 200, slot: 2 }),
    table: () => kvTable(d.lengths, 'Pages', 'Visits') })
}

/* ---- Retention ------------------------------------------------------------------- */

export function retention(root: HTMLElement, d: Any, c: Ctx) {
  const i = d.ids
  stats(root, [
    { label: 'Visitors with an ID', value: fmt(i.n), sub: 'the ones who can be told apart across days', slot: 1 },
    { label: 'Came back', value: pct(i.returned, i.n), sub: `${fmt(i.returned)} visited on more than one day`, slot: 2 },
    { label: 'Days a visitor', value: i.n ? i.days.toFixed(1) : '–', sub: 'on average, in this period', slot: 3 },
    { label: 'Games a visitor', value: i.n ? i.games.toFixed(1) : '–', sub: `${i.n ? i.views.toFixed(1) : '–'} page views each`, slot: 4 },
  ], false)
  const rets: { k: string; n: number; back: number }[] = d.returns
  stats(root, rets.map((r, j) => ({ label: `Came back ${r.k}`, value: r.n ? pct(r.back, r.n) : '–', sub: r.n ? `${fmt(r.back)} of ${fmt(r.n)} whose first visit was long enough ago` : 'too soon to tell', slot: j + 1 })).concat([{ label: 'New in twelve weeks', value: fmt(d.cohorts.weeks.reduce((x: number, w: Any) => x + w.size, 0)), sub: 'visitor IDs whose first visit was in the last twelve weeks', slot: 4 }]), false)
  const g = grid(root)
  const weeks = d.cohorts.weeks
  card(g, { title: 'Return visits, by the week people first came', sub: 'Each row is a week’s new visitors with an ID; each column, the share seen again that many weeks later. Not filtered by country, device or game', span: 4,
    empty: !weeks.length, emptyText: 'No visitor with an ID has a first visit in the last twelve weeks yet.',
    draw: (b) => cohortGrid(b, weeks, { now: new Date(), label: (iso) => 'Week of ' + new Date(iso + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }),
    table: () => ({ cols: ['Week of', 'People', ...Array.from({ length: 12 }, (_, j) => `Week ${j}`)], rows: weeks.map((w: Any) => [w.cohort, w.size, ...Array.from({ length: 12 }, (_, j) => w.back.find((x: Any) => x.wk === j)?.n ?? 0)]) }),
    file: 'cohorts' })
  const labels: string[] = d.daily.map((r: Any) => r.t)
  card(g, { title: 'New and returning', sub: 'New: no earlier visit here, and an empty passport', span: 4, empty: !d.daily.length,
    draw: (b) => lineChart(b, { labels, ...timeline(c, labels), area: false, series: [{ name: 'New', values: d.daily.map((r: Any) => r.fresh), slot: 1 }, { name: 'Returning', values: d.daily.map((r: Any) => r.returning), slot: 2 }] }),
    table: () => ({ cols: ['When', 'New', 'Returning'], rows: d.daily.map((r: Any) => [when(r.t, c.bucket, true), r.fresh, r.returning]) }) })
  card(g, { title: 'Days visited', sub: 'In this period, by visitors with an ID', span: 2, empty: !d.daysHist.length,
    draw: (b) => columns(b, { labels: d.daysHist.map((r: KV) => r.k), values: d.daysHist.map((r: KV) => r.n), tipTitle: (j) => `${d.daysHist[j].k} day${d.daysHist[j].k === '1' ? '' : 's'}`, unit: 'visitors', height: 190 }),
    table: () => kvTable(d.daysHist, 'Days', 'Visitors') })
  card(g, { title: 'Games played', sub: 'Different games each visitor opened in this period', span: 2, empty: !d.gamesHist.length,
    draw: (b) => columns(b, { labels: d.gamesHist.map((r: KV) => r.k), values: d.gamesHist.map((r: KV) => r.n), tipTitle: (j) => `${d.gamesHist[j].k} game${d.gamesHist[j].k === '1' ? '' : 's'}`, unit: 'visitors', height: 190, slot: 2 }),
    table: () => kvTable(d.gamesHist, 'Games', 'Visitors') })
  card(g, { title: 'Passports', sub: 'Games ever visited, from the passport each browser keeps', span: 2, empty: !d.passport.length,
    draw: (b) => columns(b, { labels: d.passport.map((r: KV) => r.k), values: d.passport.map((r: KV) => r.n), tipTitle: (j) => d.passport[j].k, unit: 'visitors', height: 190, slot: 3 }),
    table: () => kvTable(d.passport, 'Games in the passport', 'Visitors') })
  const CONSENT: Record<string, string> = { na: 'ID, not asked (not needed there)', yes: 'Said yes', no: 'Said no', gpc: 'Global Privacy Control', pending: 'Not answered yet', unknown: 'Unknown' }
  card(g, { title: 'Consent', sub: 'How each visitor is counted', span: 2, empty: !d.consent.length,
    draw: (b) => barList(b, bars(d.consent, (k) => CONSENT[k] ?? k)), table: () => kvTable(d.consent, 'Consent', 'Visitors', (k) => CONSENT[k] ?? k) })
}

/* ---- Health -------------------------------------------------------------------------- */

const fmtBytes = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b >= 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B')
const KEPT: Record<string, string> = {
  views: 'a row per page load, 13 months', events: 'a row per thing done, 90 days', visitors: 'each ID’s first and last visit',
  daily_counts: 'every event counted per day, for good', daily_props: 'the crowd’s choices per day, for good', salts: 'today’s random salt', meta: 'when the summaries ran',
}

/** One error, in detail, under the errors table. */
async function errorDetail(box: HTMLElement, e: Any, c: Ctx) {
  box.replaceChildren(el('p', { class: 'ad-dim', text: 'Loading…' }))
  let x: Any
  try { x = await c.fetch({ tab: 'error', key: e.key }) } catch { box.replaceChildren(el('p', { class: 'ad-empty', text: 'That error could not be loaded.' })); return }
  const close = el('button', { type: 'button', class: 'ad-mini', text: 'Close' })
  close.addEventListener('click', () => box.replaceChildren())
  box.replaceChildren(el('div', { class: 'ad-err-head' }, el('div', {}, el('p', { class: 'ad-kicker', text: [x.type, x.src].filter(Boolean).join(' · ') || 'Error' }), el('h4', { text: x.msg })), close))
  stats(box, [
    { label: 'Times', value: fmt(x.n), sub: x.first ? `first ${ago(x.first)}, last ${ago(x.last)}` : '', slot: 4 },
    { label: 'Pages', value: fmt(x.paths.length), sub: x.paths[0] ? `most on ${pageName(c, x.paths[0].k)}` : '', slot: 1 },
    { label: 'Browsers', value: fmt(x.browsers.length), sub: x.browsers[0]?.k ?? '', slot: 2 },
    { label: 'Devices', value: fmt(x.devices.length), sub: x.devices.map((v: KV) => `${v.k} ${v.n}`).join(' · '), slot: 3 },
  ], false)
  const g = grid(box)
  const labels: string[] = x.series.map((r: Any) => r.t)
  card(g, { title: 'When', span: 4, draw: (b) => lineChart(b, { labels, ...timeline(c, labels), height: 160, series: [{ name: 'Times', values: x.series.map((r: Any) => r.n), slot: 4 }] }), table: () => ({ cols: ['When', 'Times'], rows: x.series.map((r: Any) => [when(r.t, c.bucket, true), r.n]) }) })
  card(g, { title: 'Stack', sub: 'The top three frames, as the browsers reported them', span: 2, empty: !x.stacks.length, emptyText: 'No stack came with it (an error thrown as a string, or from another site’s script).',
    draw: (b) => b.append(...x.stacks.slice(0, 4).map((s2: KV) => el('div', { class: 'ad-stackframe' }, el('pre', { text: s2.k }), el('span', { class: 'ad-dim', text: `${fmt(s2.n)} times` })))), table: () => kvTable(x.stacks, 'Stack', 'Times') })
  card(g, { title: 'Where in the file', span: 1, empty: !x.lines.length, draw: (b) => barList(b, bars(x.lines), { slot: 4 }), table: () => kvTable(x.lines, 'Line', 'Times') })
  card(g, { title: 'Pages', span: 1, empty: !x.paths.length, draw: (b) => barList(b, bars(x.paths, (p) => pageName(c, p)), { slot: 4 }), table: () => kvTable(x.paths, 'Page', 'Times', (p) => pageName(c, p)) })
  card(g, { title: 'Browsers', span: 1, draw: (b) => barList(b, bars(x.browsers)), table: () => kvTable(x.browsers, 'Browser', 'Times') })
  card(g, { title: 'Systems', span: 1, draw: (b) => barList(b, bars(x.os)), table: () => kvTable(x.os, 'System', 'Times') })
  card(g, { title: 'Countries', span: 1, empty: !x.countries.length, draw: (b) => barList(b, bars(x.countries, country)), table: () => kvTable(x.countries, 'Country', 'Times', country) })
  card(g, { title: 'Kind', span: 1, draw: (b) => barList(b, bars(x.kinds, (k) => ({ error: 'Thrown', promise: 'A promise rejected' })[k] ?? k)), table: () => kvTable(x.kinds, 'Kind', 'Times') })
  card(g, { title: 'The latest', span: 4, tableOnly: true, table: () => ({ cols: ['When', 'Page', 'Browser', 'System', 'Device', 'Country', 'Line'], rows: x.recent.map((r: Any) => [new Date(r.ts).toLocaleString(), pageName(c, r.path), r.browser, r.os ?? '', r.device ?? '', country(r.country ?? ''), r.line ?? '']) }) })
  box.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function health(root: HTMLElement, d: Any, c: Ctx) {
  const overall = d.vitals.filter((v: Any) => v.device === null)
  const tiles = el('section', { class: 'ad-vitals' })
  for (const [m, info] of Object.entries(VITALS)) {
    const v = overall.find((x: Any) => x.metric === m)
    const t = el('div', { class: 'ad-vital' }, el('p', { class: 'ad-stat-l' }, `${info.name} `, el('span', { class: 'ad-dim', text: m })))
    if (!v) t.append(el('p', { class: 'ad-stat-v ad-dim', text: '–' }), el('p', { class: 'ad-stat-s', text: info.what }))
    else {
      const total = v.good + v.mid + v.poor || 1
      t.append(el('p', { class: 'ad-stat-v', text: vitalValue(m, v.p75) }), statusBadge(vitalRating(m, v.p75)),
        el('div', { class: 'ad-stack thin', role: 'img', 'aria-label': `${pct(v.good, total)} good, ${pct(v.mid, total)} needs work, ${pct(v.poor, total)} poor` }, el('span', { class: 's7', style: `flex:${v.good}` }), el('span', { class: 's8', style: `flex:${v.mid}` }), el('span', { class: 's9', style: `flex:${v.poor}` })),
        el('p', { class: 'ad-stat-s', text: `75% of ${fmt(v.n)} page loads were this fast or faster · ${pct(v.good, total)} good` }))
    }
    tiles.append(t)
  }
  section(root, 'Speed', 'Google’s Core Web Vitals, measured in visitors’ own browsers: the 75th percentile, against Google’s lines for good and poor')
  root.append(tiles)
  const g = grid(root)
  const devs = ['phone', 'tablet', 'desktop']
  card(g, { title: 'By device', span: 2, tableOnly: true, empty: !d.vitals.length,
    table: () => ({ cols: ['Metric', ...devs], rows: Object.keys(VITALS).map((m) => [VITALS[m].name, ...devs.map((dv) => { const v = d.vitals.find((x: Any) => x.metric === m && x.device === dv); return v ? vitalValue(m, v.p75) : '–' })]) }) })
  card(g, { title: 'By page', sub: 'Slowest first, by largest paint', span: 2, tableOnly: true, empty: !d.pages.length,
    table: () => ({ cols: ['Page', 'Loads', 'LCP', 'INP', 'CLS', 'TTFB'], rows: [...d.pages].sort((a: Any, b: Any) => (b.lcp ?? 0) - (a.lcp ?? 0)).map((p: Any) => [pageName(c, p.path), p.n, p.lcp === null ? '–' : vitalValue('LCP', p.lcp), p.inp === null ? '–' : vitalValue('INP', p.inp), p.cls === null ? '–' : vitalValue('CLS', p.cls), p.ttfb === null ? '–' : vitalValue('TTFB', p.ttfb)]) }) })
  const errTable = (): Table => ({ cols: ['Message', 'File:line', 'Times', 'Visitors', 'Pages', 'Browsers', 'Last'], align: ['l', 'l', 'r', 'r', 'l', 'l', 'r'], rows: d.errors.map((e: Any) => [e.msg, `${e.src || '?'}:${e.line || '?'}`, e.n, e.visitors, e.paths, e.browsers, ago(e.last)]) })
  const errCard = card(g, { title: 'Script errors', sub: 'Grouped by message and file. Click one for everything known about it', span: 4, tableOnly: true, empty: !d.errors.length, emptyText: 'No errors in this period. Lovely.', table: errTable })
  const detail = el('div', { class: 'ad-err-detail' })
  if (d.errors.length) {
    errCard.querySelector('.ad-card-body')!.replaceChildren(tableEl(errTable(), { onRow: (i) => void errorDetail(detail, d.errors[i], c) }))
    g.append(detail)
  }
  card(g, { title: 'Broken links', sub: 'Addresses that showed the 404 page', span: 2, empty: !d.missing.length, emptyText: 'No 404s in this period.', draw: (b) => barList(b, bars(d.missing)), table: () => kvTable(d.missing, 'Address', 'Times') })
  card(g, { title: 'The island’s frame rate', sub: 'By device', span: 2, tableOnly: true, empty: !d.fps.length,
    table: () => ({ cols: ['Device', 'Measured', 'Median fps', 'Slowest 10% at'], rows: d.fps.map((r: Any) => [r.k, r.n, Math.round(r.median), Math.round(r.low)]) }) })
  const s = d.storage
  if (s) card(g, { title: 'What is kept', sub: `Raw events for ${s.rawDays} days, then daily totals for good · ${fmtBytes(s.dbBytes)} in all${s.nightly ? ` · summaries last run ${ago(s.nightly.at)}` : ' · summaries not run yet'}`, span: 4, tableOnly: true,
    table: () => ({ cols: ['Table', 'Rows', 'Size', 'Holds'], align: ['l', 'r', 'r', 'l'], rows: s.tables.map((t: Any) => [t.t, t.rows, fmtBytes(t.bytes), KEPT[t.t] ?? '']) }) })
}
