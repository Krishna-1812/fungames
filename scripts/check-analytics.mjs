/**
 * check-analytics — does the site count what it says, and only that?
 *
 * The analytics (src/lib/analytics/) are held to their own rules here, with
 * the real SQL run against a real Postgres (PGlite, in memory):
 *
 * - what may be sent: known events only, small flat props, nothing nested,
 *   timestamps kept honest, ids that are ids, a batch that fits;
 * - what a game reports: Life in Weeks' age coarsened to a decade;
 * - what the server reads off a request: devices, bots, referrers without
 *   their query strings, and who must be asked before an ID is stored;
 * - the source itself: every event the code sends is a known one, every
 *   known one is sent from somewhere, and no tracking call reads what a
 *   player typed;
 * - the database: a batch written, brought up to date, counted the way the
 *   admin page counts it; test traffic left out; Forget me forgets; old
 *   records go; the daily hash changes with the day;
 * - the admin's session: signed, expiring, and useless once tampered with
 *   or once the password changes.
 *
 *   node scripts/check-analytics.mjs
 */
import { register } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/analytics/shape.ts')
const DB = await import('../src/lib/analytics/db.ts')
const I = await import('../src/lib/analytics/ingest.ts')
const Rp = await import('../src/lib/analytics/report.ts')
const A = await import('../src/lib/analytics/auth.ts')
const { PGlite } = await import('@electric-sql/pglite')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)
const id = (c) => c.repeat(22)

console.log('\nwhat may be sent')
{
  const good = JSON.stringify({ v: 1, pid: id('a'), vid: id('b'), c: 'yes', e: [{ n: 'game_end', t: NOW - 1000, p: { kind: 'win', score: '12 / 12' }, g: 'orbit' }] })
  const b = S.parseBatch(good, NOW)
  check(b && b.events.length === 1 && b.events[0].g === 'orbit' && b.consent === 'yes' && b.vid === id('b'), 'a well-formed batch is read whole')
  check(S.parseBatch('not json', NOW) === null && S.parseBatch(JSON.stringify({ v: 2, pid: id('a') }), NOW) === null && S.parseBatch(JSON.stringify({ v: 1, pid: 'short' }), NOW) === null, 'garbage, a future version, or a bad page id is refused')
  check(S.parseBatch('x'.repeat(S.LIMITS.body + 1), NOW) === null, 'a body over 16 KB is refused unread')
  const odd = S.parseBatch(JSON.stringify({ v: 1, pid: id('a'), vid: 'x', c: 'maybe', e: [{ n: 'drop_table', t: NOW }, { n: 'vital', t: NOW + 864e5 }, { n: 'vital', t: NOW - 3 * 864e5 }, { n: 'share', t: NOW, g: '../etc' }] }), NOW)
  check(odd.events.length === 3 && odd.events.every((e) => e.n !== 'drop_table'), 'an unknown event name is dropped')
  check(odd.events[0].t === NOW && odd.events[1].t === NOW, 'a timestamp from the future, or from days ago, becomes the server’s now')
  check(odd.events[2].g === null && odd.vid === null && odd.consent === null, 'a bad game slug, visitor id or consent state is left out')
  const many = S.parseBatch(JSON.stringify({ v: 1, pid: id('a'), e: Array.from({ length: 90 }, () => ({ n: 'sound', t: NOW })) }), NOW)
  check(many.events.length === S.LIMITS.events, `at most ${S.LIMITS.events} events in a batch`)
  const p = S.cleanProps({ a: 1 / 3, b: NaN, c: Infinity, d: { x: 1 }, e: [1], f: 'y'.repeat(500), g: true, 'Bad Key': 1, h: ' line\nbreak\u0000 ', i: 1, j: 2, k: 3, l: 4, m: 5, n: 6, o: 7, p: 8, q: 9, r: 10 })
  check(p.a === 0.3333 && !('b' in p) && !('c' in p) && !('d' in p) && !('e' in p), 'props: numbers rounded, non-finite and nested values dropped')
  check(p.f.length === 80 && p.g === true && !('Bad Key' in p) && p.h === 'line break', 'props: strings cut to 80 and cleaned of control characters, bad keys dropped')
  check(Object.keys(p).length === S.LIMITS.props, `props: at most ${S.LIMITS.props}`)
  check(S.cleanPath('/orbit/?born=1990-01-01#x') === '/orbit/' && S.cleanPath('javascript:alert(1)') === null, 'a path keeps nothing after it, and must be a path')
  const view = S.parseBatch(JSON.stringify({ v: 1, pid: id('a'), view: { path: '/', sw: 1e9, dpr: 'x', lang: 'en-GB', touch: 'yes' } }), NOW).view
  check(view.sw === 20000 && view.dpr === undefined && view.touch === undefined && view.lang === 'en-GB', 'view fields are clamped and typed')
  // A realistic full batch: a view and forty events fits easily.
  const full = JSON.stringify({ v: 1, pid: id('a'), vid: id('b'), c: 'na', view: { path: '/universe-forecast/', ref: 'https://news.ycombinator.com/item?id=123', title: 'Universe Forecast — a long page title here', sw: 1920, sh: 1080, vw: 1903, vh: 950, dpr: 1.25, touch: false, lang: 'en-GB', tz: 'Europe/London', dark: true, rm: false, conn: '4g', mem: 8, cpu: 12, first_days: 30, games_seen: 12, visit_days: 9 }, e: Array.from({ length: 40 }, (_, k) => ({ n: 'isl_search', t: NOW, p: { q: 'space things'.repeat(3), results: k, more: 'x'.repeat(60) } })), eng: { ms: 123456, scroll: 77 } })
  check(full.length < S.LIMITS.body * 0.6, `a full batch is ${(full.length / 1024).toFixed(1)} KB, well inside the limit`)
}

console.log('\nwhat a game reports')
{
  const r = S.gameResult('life-in-weeks', { weeks: 2000 })
  check(!('weeks' in r) && r.age_decade === 30, 'Life in Weeks: weeks lived (an age to the week) becomes an age decade')
  const o = S.gameResult('orbit', { score: 3, sheet: 'a4' })
  check(o.score === 3 && o.sheet === 'a4', 'every other game’s numbers go as they are')
}

console.log('\nwhat the server reads off a request')
{
  const ua = {
    win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    pixel: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    tab: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
    ff: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0',
  }
  const d = (u, t) => { const x = S.parseUa(u, t); return `${x.device} ${x.os} ${x.browser} ${x.bver}` }
  check(d(ua.win) === 'desktop Windows Chrome 141', 'Windows, Chrome: a desktop')
  check(d(ua.edge) === 'desktop Windows Edge 141', 'Edge is Edge, not Chrome')
  check(d(ua.iphone) === 'phone iOS Safari 18', 'an iPhone is a phone')
  check(d(ua.ipad, true) === 'tablet iPadOS Safari 18' && d(ua.ipad, false) === 'desktop macOS Safari 18', 'an iPad says it is a Mac; touch gives it away')
  check(d(ua.pixel) === 'phone Android Chrome 141' && d(ua.tab).startsWith('tablet Android'), 'Android: Mobile is a phone, otherwise a tablet')
  check(d(ua.samsung).includes('Samsung Internet 27') && d(ua.ff) === 'desktop macOS Firefox 132', 'Samsung Internet and Firefox')
  check(S.isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)') && S.isBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36') && S.isBot('curl/8.4.0') && S.isBot(null), 'crawlers, headless browsers, scripts and no user agent are not visitors')
  check(!Object.values(ua).some(S.isBot), 'real browsers are')
  check(S.mustAsk('DE') && S.mustAsk('GB') && S.mustAsk('CH') && S.mustAsk('NO') && S.mustAsk(null), 'the EU, EEA, UK and Switzerland are asked first, and so is an unknown country')
  check(!S.mustAsk('US') && !S.mustAsk('IN') && !S.mustAsk('JP'), 'elsewhere, no')
  const r = S.parseRef('https://www.google.com/search?q=my+secret+search', 'fungames.vercel.app')
  check(r.ref_host === 'google.com' && r.ref_path === '/search' && !JSON.stringify(r).includes('secret'), 'another site’s referrer keeps its host and path, never its query')
  const own = S.parseRef('https://fungames.vercel.app/orbit/?x=1', 'fungames.vercel.app')
  check(own.ref_host === null && own.from_path === '/orbit/', 'this site’s own page is kept as the path it came from')
  check(S.parseRef('android-app://com.slack/', 'x').ref_host === null && S.parseRef('nonsense', 'x').ref_host === null, 'anything that is not a web address is left out')
  check(S.slugOf('/orbit/') === 'orbit' && S.slugOf('/') === null && S.slugOf('/admin/x/') === null && S.slugOf('/privacy/') === null && S.slugOf('/admin/') === null, 'a game is known by its path, and the privacy and admin pages are not games')
}

console.log('\nthe source')
{
  const files = []
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|astro)$/.test(f)) files.push(p) } }
  walk('src')
  const sent = new Set()
  const bad = [], reads = []
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\b(?:track|sent)\(\s*'([a-z_]+)'/g)) { sent.add(m[1]); if (!S.isEvent(m[1])) bad.push(`${f}: ${m[1]}`) }
    for (const line of src.split('\n')) if (/\b(?:track|sent)\(/.test(line) && /(?<!\bm)\.value\b(?!\s*=[^=])|\b(?:textContent|innerText|innerHTML)\b(?!\s*=[^=])/.test(line)) reads.push(`${f}: ${line.trim().slice(0, 100)}`)
  }
  check(!bad.length, `every event the code sends is a known one${bad.length ? ': ' + bad.join(', ') : ''}`)
  const unsent = Object.keys(S.EVENTS).filter((n) => !sent.has(n) && n !== 'game_result' && n !== 'consent' && n !== 'notfound' && n !== 'vital' && n !== 'error' && n !== 'outbound')
  check(!unsent.length, `every known event is sent from somewhere${unsent.length ? ' (not: ' + unsent.join(', ') + ')' : ''}`)
  check(!reads.length, `no tracking call reads what was typed into the page${reads.length ? ': ' + reads.join(' | ') : ''}`)
  const client = readFileSync('src/lib/analytics/client.ts', 'utf8')
  check(/game_result', gameResult\(/.test(client), 'a game’s ending is coarsened (gameResult) before it leaves the browser')
  check(/globalPrivacyControl/.test(client) && /K\.consent/.test(client), 'the tracker reads Global Privacy Control and the stored answer')
  const shell = readFileSync('src/lib/game-shell.ts', 'utf8')
  check(/sent\('game_end'/.test(shell) && /sent\('game_start'/.test(shell), 'the game shell reports starts and endings for every game')
}

console.log('\nthe database')
{
  const pg = new PGlite()
  DB.useDb({ query: async (text, params = []) => (await pg.query(text, params)).rows })
  const d = await DB.getDb()
  const t0 = new Date(NOW)
  const origin = { ip: '203.0.113.9', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36', host: 'fungames.vercel.app', country: 'IN', region: 'MH', city: 'Pune', lat: 18.5, lon: 73.9 }
  const batch = (o) => S.parseBatch(JSON.stringify({ v: 1, ...o }), NOW + 60_000)

  await I.ingest(d, batch({ pid: id('p'), c: 'pending', view: { path: '/orbit/', ref: 'https://www.reddit.com/r/space/comments/x?utm=1', sw: 1920, sh: 1080, touch: false, lang: 'en-IN', tz: 'Asia/Kolkata' }, e: [{ n: 'game_start', t: NOW }] }), origin, t0)
  await I.ingest(d, batch({ pid: id('p'), vid: id('v'), c: 'na', e: [{ n: 'game_end', t: NOW + 30_000, p: { kind: 'win', score: '3' }, g: 'orbit' }, { n: 'share', t: NOW + 31_000, p: { outcome: 'shared' }, g: 'orbit' }], eng: { ms: 42_000, scroll: 60 } }), origin, new Date(NOW + 40_000))
  // The page's last batch arrives late, with a smaller engaged time than one already sent: the larger is kept.
  await I.ingest(d, batch({ pid: id('p'), vid: id('v'), e: [], eng: { ms: 1000, scroll: 10 } }), origin, new Date(NOW + 45_000))
  const [v] = await d.query('select * from views where pid = $1', [id('p')])
  check(v && v.game === 'orbit' && v.country === 'IN' && v.city === 'Pune' && v.device === 'desktop' && v.browser === 'Chrome', 'a view is stored with its game, place and device')
  check(v.ref_host === 'reddit.com' && v.ref_path === '/r/space/comments/x', 'its referrer, without the query')
  check(v.vid === id('v') && v.consent === 'na', 'an ID that came after the first batch is joined to the view, with the consent state')
  check(v.engaged_ms === 42000 && v.scroll === 60, 'engaged time and scroll only ever go up')
  const cols = (await d.query("select column_name from information_schema.columns where table_name in ('views', 'events')")).map((r) => r.column_name)
  check(!cols.some((c) => /^(ip|ua|user_agent|address)$/.test(c)), 'there is nowhere to keep an IP address or a user agent')
  check(!JSON.stringify(v).includes('203.0.113.9') && !JSON.stringify(v).includes('Windows NT'), 'and neither is kept anywhere in the row')
  const evs = await d.query('select name, game, props from events where pid = $1 order by ts', [id('p')])
  check(evs.length === 3 && evs[1].props.kind === 'win' && evs[2].game === 'orbit', 'its events are stored, with their props')

  // A second visitor, with no ID; a third, a test run.
  await I.ingest(d, batch({ pid: id('q'), c: 'no', view: { path: '/' }, e: [{ n: 'isl_dive', t: NOW, g: 'orbit', p: { from: 'map' } }] }), { ...origin, ip: '198.51.100.7', country: 'DE', city: 'Berlin' }, t0)
  await I.ingest(d, batch({ pid: id('t'), test: true, view: { path: '/orbit/' }, e: [{ n: 'game_start', t: NOW }] }), origin, t0)
  // Hostile props are only ever data.
  await I.ingest(d, batch({ pid: id('x'), view: { path: '/' }, e: [{ n: 'isl_search', t: NOW, p: { q: "'); drop table views; --" } }] }), origin, t0)
  check((await d.query('select count(*)::int as n from views'))[0].n === 4, 'a search for "drop table" is stored as words, and the table is still there')

  const r = { from: new Date(NOW - 864e5), to: new Date(NOW + 864e5), tz: 'Asia/Kolkata', bucket: 'hour' }
  const o = await Rp.overview(d, r)
  check(o.kpis.views === 3 && o.kpis.visitors === 3, 'the overview counts three views by three visitors (one by its ID, two by their daily hash), leaving the test run out')
  check(o.kpis.starts === 1 && o.kpis.ends === 1 && o.kpis.wins === 1 && o.kpis.shares === 1 && o.kpis.dives === 1, 'starts, endings, wins, shares and dives')
  const orbit = o.games.find((g) => g.game === 'orbit')
  check(orbit && orbit.views === 1 && orbit.starts === 1 && orbit.ends === 1 && orbit.dives === 1, 'a game’s row joins its own page’s views with the dives into it from the island')
  check(o.countries.some((c) => c.k === 'DE') && o.refs[0]?.k === 'reddit.com', 'countries and referrers')
  check(o.series.length >= 1 && o.series.reduce((a, s) => a + s.views, 0) === 3, 'the traffic series adds up to the views')
  check(o.live.now === 0, 'nobody is "here now" a day later')
  const live = await Rp.live(d, {}, new Date(NOW + 60_000))
  check(live.now >= 1, 'but they were, a minute after they arrived')
  let threw = false
  try { await Rp.top(d, 'path; drop table views', r) } catch { threw = true }
  check(threw, 'a column the report does not know is refused before any SQL is written')
  check(Rp.rangeOf(7, 'Asia/Kolkata').tz === 'Asia/Kolkata' && Rp.rangeOf(7, "x'; drop").tz === 'UTC' && Rp.rangeOf(9999, 'UTC').from.getTime() > Date.now() - 401 * 864e5, 'a range is clamped, and a timezone that is not one is UTC')

  // Web Vitals: the 75th percentile.
  for (let k = 1; k <= 8; k++) await I.ingest(d, batch({ pid: id('w'), view: k === 1 ? { path: '/' } : undefined, e: [{ n: 'vital', t: NOW, p: { metric: 'LCP', value: k * 1000 } }] }), origin, t0)
  const lcp = (await Rp.vitals(d, r)).find((x) => x.metric === 'LCP')
  check(lcp && lcp.n === 8 && Math.abs(lcp.p75 - 6250) < 1, `LCP at the 75th percentile of 1–8 s is 6.25 s (got ${lcp?.p75})`)

  // Every tab of the admin page, run for real.
  await I.ingest(d, batch({ pid: id('r'), vid: id('u'), c: 'yes', view: { path: '/orbit/', vw: 390, touch: true, dark: true, tz: 'Asia/Kolkata', lang: 'hi-IN', first_days: 0 }, e: [
    { n: 'game_start', t: NOW }, { n: 'game_end', t: NOW + 5000, p: { kind: 'lose', score: '1', ms: 5000 }, g: 'orbit' },
    { n: 'game_result', t: NOW + 5000, p: { score: 1, sheet: 'a4' }, g: 'orbit' }, { n: 'game_result', t: NOW + 6000, p: { score: 5, sheet: 'a4' }, g: 'orbit' },
    { n: 'game_level', t: NOW + 4000, p: { text: 'Halfway' }, g: 'orbit' }, { n: 'error', t: NOW, p: { msg: 'x is undefined', src: 'orbit.js', line: 3 } },
    { n: 'isl_poke', t: NOW, p: { kind: 'whale', first: true } }, { n: 'isl_session', t: NOW, p: { secs: 20, drags: 3, districts: 'harbour peaks', n_districts: 2, cards: 1 } },
    { n: 'isl_search', t: NOW, p: { q: 'zzz', results: 0 } }, { n: 'isl_fps', t: NOW, p: { fps: 58 } } ] }), { ...origin, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1' }, t0)
  const tabs = {}
  for (const t of ['games', 'island', 'audience', 'acquisition', 'retention', 'health', 'options']) {
    try { tabs[t] = await Rp[t](d, r) } catch (e) { tabs[t] = e }
  }
  try { tabs.game = await Rp.game(d, r, 'orbit') } catch (e) { tabs.game = e }
  const broken = Object.entries(tabs).filter(([, v]) => v instanceof Error).map(([k, v]) => k + ': ' + v.message)
  check(!broken.length, `every tab's SQL runs on a real Postgres${broken.length ? ' (' + broken.join('; ') + ')' : ''}`)
  if (!broken.length) {
    const g = tabs.game
    check(g.funnel.views === 2 && g.funnel.started === 2 && g.funnel.finished === 2 && g.funnel.won === 1, 'a game\u2019s funnel: page loads that saw it, started it, finished it, won it')
    const score = g.results.find((x) => x.k === 'score'), sheet = g.words.find((x) => x.k === 'sheet')
    check(score && score.count === 2 && score.min === 1 && score.max === 5 && score.bins.reduce((a, b) => a + b.n, 0) === 2, 'its numbers become a distribution')
    check(sheet && sheet.values[0].k === 'a4' && sheet.values[0].n === 2 && g.levels[0]?.k === 'Halfway', 'its words and levels become counts')
    check(g.duration.median === 5 && g.kinds.lose === 1, 'how long a game took, and how it ended')
    check(tabs.island.pokes[0]?.k === 'whale' && tabs.island.session.drags === 3 && tabs.island.districts.length === 2 && tabs.island.empties[0]?.k === 'zzz', 'the island: pokes, how it was explored, searches that found nothing')
    check(tabs.audience.devices.some((x) => x.k === 'phone') && tabs.audience.flags.dark === 1 && tabs.audience.langs.some((x) => x.k === 'hi') && tabs.audience.week.length >= 1, 'the audience: devices, dark mode, languages, the week')
    check(tabs.acquisition.kinds.some((x) => x.k === 'Social') && tabs.acquisition.refs.some((x) => x.k === 'reddit.com'), 'acquisition: where visits came from, by kind and by site')
    check(tabs.retention.ids.n === 2 && tabs.retention.consent.some((x) => x.k === 'yes'), 'retention: visitors with an ID, and the consent each came with')
    check(tabs.health.errors[0]?.msg === 'x is undefined' && tabs.health.fps.some((x) => x.k === 'phone' && x.median === 58), 'health: errors, and how smoothly the island drew on which device')
    check(tabs.options.countries.includes('IN') && tabs.options.games.includes('orbit'), 'the filter offers what has traffic')
    const ph = await Rp.games(d, { ...r, device: 'phone' })
    check(ph.length === 1 && ph[0].views === 1, 'a filter (phones only) narrows every number')
  }
  const fq = Rp.filterOf(new URLSearchParams('days=30&country=IN&device=phone&game=orbit&tz=Asia/Kolkata'))
  check(fq.country === 'IN' && fq.device === 'phone' && fq.game === 'orbit' && fq.bucket === 'day', 'the filter is read from the query string')
  const bad = Rp.filterOf(new URLSearchParams("country=India&device=fridge&game=../x&start=2026-01-01&end=2020-01-01"))
  check(!bad.country && !bad.device && !bad.game && bad.to.getTime() - bad.from.getTime() === 7 * 864e5, 'and anything that is not a country, a device, a game or a range is ignored')
  const custom = Rp.filterOf(new URLSearchParams('start=2026-09-01T00:00:00Z&end=2026-09-08T00:00:00Z'), new Date(NOW))
  check(custom.from.toISOString().startsWith('2026-09-01') && custom.bucket === 'day', 'a custom range')
  check(Rp.bucketsOf({ from: new Date(Date.UTC(2026, 9, 1)), to: new Date(Date.UTC(2026, 9, 8)), tz: 'UTC', bucket: 'day' }).length === 7 && Rp.bucketsOf({ from: new Date(NOW - 864e5), to: new Date(NOW), tz: 'UTC', bucket: 'hour' }).length === 24 && Rp.bucketsOf({ from: new Date(NOW - 864e5 + 1800e3), to: new Date(NOW + 1800e3), tz: 'UTC', bucket: 'hour' }).length === 25, 'every day (or hour) of a range has its place on the chart, empty or not')
  const C = await import('../src/lib/analytics/csv.ts')
  check(C.csvCell('=HYPERLINK("x")') === '"\'=HYPERLINK(""x"")"' && C.csvCell('a,b') === '"a,b"' && C.csvCell(null) === '' && C.toCsv([{ a: 1, b: 'x' }]).includes('a,b\r\n1,x'), 'CSV: quoted, and a visitor\u2019s formula is defused before a spreadsheet can run it')

  // The daily hash: the same address and browser are one visitor today, and someone else tomorrow.
  const h1 = await DB.dailyHash(d, '1.2.3.4', 'ua', new Date(NOW))
  const h2 = await DB.dailyHash(d, '1.2.3.4', 'ua', new Date(NOW + 3600_000))
  const h3 = await DB.dailyHash(d, '1.2.3.4', 'ua', new Date(NOW + 864e5))
  check(h1 === h2 && h1 !== h3 && h1.length === 16, 'the daily hash holds for a day and changes with it')
  check((await d.query('select count(*)::int as n from salts'))[0].n === 1, 'and yesterday’s salt is gone, so yesterday’s hashes cannot be made again')

  // Forget me.
  const gone = await I.forget(d, id('v'))
  check(gone === 1 && (await d.query('select count(*)::int as n from events where pid = $1', [id('p')]))[0].n === 0, 'Forget me deletes the visitor’s views and every event in them')
  check((await d.query('select count(*)::int as n from views'))[0].n === 5, 'and nobody else’s')

  // Thirteen months.
  await d.query("update views set ts = now() - interval '400 days' where pid = $1", [id('x')])
  await d.query("update events set ts = now() - interval '400 days' where pid = $1", [id('x')])
  await I.prune(d, new Date())
  check((await d.query('select count(*)::int as n from views where pid = $1', [id('x')]))[0].n === 0, 'records older than thirteen months are deleted')
  await d.query("update views set ts = now() - interval '3 days' where pid = $1", [id('t')])
  await I.prune(d, new Date())
  check((await d.query('select count(*)::int as n from views where pid = $1', [id('t')]))[0].n === 0 && (await d.query('select count(*)::int as n from views'))[0].n === 3, 'a test run older than two days is deleted, and nothing else is')
  await pg.close()
}

console.log('\nwhere a request is from')
{
  const Q = await import('../src/lib/analytics/request.ts')
  // Behind Vercel the function sees an internal URL; the forwarded host is the site's.
  const req = (origin, extra = {}) => new Request('https://internal-abc123.vercel.app/api/collect/', { method: 'POST', headers: { 'x-forwarded-host': 'fungames-mu.vercel.app', 'x-forwarded-proto': 'https', ...(origin ? { origin } : {}), ...extra } })
  check(!Q.foreign(req('https://fungames-mu.vercel.app')), 'the site’s own page is not foreign, though the function’s own URL names another host')
  check(Q.foreign(req('https://evil.example')) && !Q.foreign(req(null)), 'another site is; a request with no Origin (a beacon, a server) is let through to the other checks')
  check(Q.isHttps(req(null)) && !Q.isHttps(new Request('http://localhost:4321/x')), 'https is read from the forwarded protocol')
  const g = Q.geo(req(null, { 'x-vercel-ip-country': 'IN', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-vercel-ip-latitude': '18.52043', 'x-vercel-ip-longitude': 'nope' }))
  check(g.country === 'IN' && g.city === 'São Paulo' && g.lat === 18.5 && g.lon === null, 'Vercel’s location headers: decoded, rounded to a tenth of a degree, junk dropped')
}

console.log('\nthe admin’s session')
{
  const s = await A.signSession('correct horse', NOW)
  check(await A.verifySession('correct horse', s, NOW + 1000), 'a fresh session is good')
  check(!(await A.verifySession('correct horse', s, NOW + 31 * 864e5)), 'and is not after thirty days')
  check(!(await A.verifySession('another password', s, NOW + 1000)), 'changing the password signs every session out')
  const [exp, sig] = s.split('.')
  check(!(await A.verifySession('correct horse', `${Number(exp) + 864e5 * 365}.${sig}`, NOW)) && !(await A.verifySession('correct horse', `${exp}.${sig.slice(0, -2)}xx`, NOW)), 'a session whose expiry or signature has been altered is refused')
  check(!(await A.verifySession(undefined, s, NOW)) && !(await A.verifySession('correct horse', undefined, NOW)), 'with no password set, nobody is admin')
  check(await A.passwordMatches('correct horse', 'correct horse') && !(await A.passwordMatches('correct horse', 'correct hors')) && !(await A.passwordMatches(undefined, '')), 'the password is checked exactly')
  const c = A.cookieHeader(s, true)
  check(/HttpOnly/.test(c) && /SameSite=Strict/.test(c) && /Secure/.test(c) && /Path=\//.test(c), 'the cookie is HttpOnly, SameSite=Strict and Secure')
  check(A.readCookie(`a=1; ${A.COOKIE}=${s}; b=2`) === s && A.readCookie(null) === undefined, 'and is read back from a Cookie header')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
