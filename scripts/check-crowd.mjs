/**
 * check-crowd — are the crowd's figures (the "62% of 1,840 players chose the
 * same" the games show) true, and only what they should be?
 *
 * The server side (src/lib/analytics/crowd.ts, api/crowd) runs its real SQL
 * against a real Postgres (PGlite, in memory):
 *
 * - every answer counted once: the nightly summaries for the days they hold,
 *   raw events for the days after, never a day from both;
 * - test traffic left out;
 * - only the questions a game shows, and nothing for a game that shows none;
 * - a group with too few answers to mean anything left out entirely.
 *
 * And the page side (src/lib/crowd.ts): shares, standings and medians worked
 * out right, with no 0% or 100% that is not exactly that. Finally, every
 * question a game shows is one that game really asks (shell.pick), so a
 * renamed question cannot quietly leave a page with nothing to say.
 *
 *   node scripts/check-crowd.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const DB = await import('../src/lib/analytics/db.ts')
const CR = await import('../src/lib/analytics/crowd.ts')
const C = await import('../src/lib/crowd.ts')
const { PGlite } = await import('@electric-sql/pglite')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const pg = new PGlite()
DB.useDb({ query: async (t, p = []) => (await pg.query(t, p)).rows })
const d = await DB.getDb()

let pid = 0
async function answer(game, what, of, v, { ts = '2026-10-14T10:00:00Z', test = false } = {}) {
  const p = `p${++pid}`.padEnd(22, 'x')
  await d.query(`insert into views (pid, ts, dh, path, game, test) values ($1, $2, 'h', $3, $4, $5)`, [p, ts, `/${game}/`, game, test])
  await d.query(`insert into events (pid, ts, name, game, props) values ($1, $2, 'game_pick', $3, $4)`, [p, ts, game, JSON.stringify(of ? { what, v, of } : { what, v })])
}
const Q = 'Choice on each dilemma'

console.log('\nthe server')
{
  // Summaries through the 12th; raw events on the 12th (already summarised) and the 13th–14th.
  await d.query(`insert into meta (k, v, at) values ('rolled_through', '2026-10-12', now())`)
  await d.query(`insert into daily_props (day, name, game, k, of, v, n) values
    ('2026-10-11', 'game_pick', 'trolley', $1, 'The classic', 'Pull the lever', 30),
    ('2026-10-12', 'game_pick', 'trolley', $1, 'The classic', 'Do nothing', 10),
    ('2026-10-12', 'game_pick', 'trolley', 'Same answer to problem 1 twice', '', 'true', 50)`, [Q])
  for (let i = 0; i < 5; i++) await answer('trolley', Q, 'The classic', 'Pull the lever', { ts: '2026-10-12T09:00:00Z' })
  for (let i = 0; i < 6; i++) await answer('trolley', Q, 'The classic', 'Pull the lever', { ts: '2026-10-13T09:00:00Z' })
  for (let i = 0; i < 4; i++) await answer('trolley', Q, 'The classic', 'Do nothing')
  for (let i = 0; i < 40; i++) await answer('trolley', Q, 'The classic', 'Do nothing', { test: true })
  for (let i = 0; i < 9; i++) await answer('trolley', Q, 'The footbridge', 'Push them')
  for (let i = 0; i < 20; i++) await answer('asteroid', 'City hit', '', 'Tokyo')
  const c = await CR.crowdFor(d, 'trolley')
  const g = c[Q]?.['The classic']
  check(g && g['Pull the lever'] === 36 && g['Do nothing'] === 14, `each answer counted once: summaries to the 12th, raw events after (${JSON.stringify(g)})`)
  check(g && g['Do nothing'] === 14, 'test traffic is left out')
  check(!('Same answer to problem 1 twice' in c), 'a question the game does not show stays on the server')
  check(!c[Q]?.['The footbridge'], `a group with fewer than ${CR.MIN_N} answers is left out`)
  check(JSON.stringify(await CR.crowdFor(d, 'asteroid')) === '{}', 'a game that shows no crowd gets nothing')

  const api = await import('../src/pages/api/crowd.ts')
  const r404 = await api.GET({ url: new URL('http://x/api/crowd/?g=asteroid') })
  const r200 = await api.GET({ url: new URL('http://x/api/crowd/?g=trolley') })
  const body = await r200.json()
  check(r404.status === 404 && r200.status === 200 && body.q[Q]['The classic']['Do nothing'] === 14, 'the endpoint answers for a game that shows a crowd, and 404s for one that does not')
  check(/s-maxage=\d+/.test(r200.headers.get('cache-control') ?? ''), 'and its answer is kept at the edge, so a busy page is not a busy database')
}

console.log('\nthe page')
{
  const c = { [Q]: { 'The classic': { 'Pull the lever': 36, 'Do nothing': 14 } }, Score: { Circle: { 40: 10, 60: 20, 80: 10 } } }
  const s = C.share(c, Q, 'The classic', 'Pull the lever')
  check(s.pct === 72 && s.n === 50 && s.top === 'Pull the lever', 'a share: 36 of 50 is 72%, the top answer named')
  check(C.share(c, Q, 'The classic', 'Something else').pct === 0 && C.share(c, Q, 'Nope', 'x') === null, 'an answer nobody gave is 0%; a missing group is nothing')
  check(C.pct(1, 1000) === 1 && C.pct(999, 1000) === 99 && C.pct(0, 5) === 0 && C.pct(5, 5) === 100, 'never a 0% or 100% that is not exactly that')
  const st = C.standing(c, 'Score', 'Circle', 60)
  check(st.pct === 50 && st.n === 40, 'a standing: the middle of the crowd is beaten by half (ties count half)')
  check(C.standing(c, 'Score', 'Circle', 90).pct === 99 && C.standing(c, 'Score', 'Circle', 90, 'low').pct === 0, 'top of the crowd says 99%, never 100%; lower-is-better turns it round')
  check(C.median(c, 'Score', 'Circle').v === 60, 'a median')
  check(C.few(c, Q, 'The footbridge') && !C.few(null, Q, 'The footbridge') && !C.few(c, Q, 'The classic'), '"too few yet" only when the crowd answered and this group is missing')
  check(C.esc('<b>"x"</b>') === '&#60;b&#62;&#34;x&#34;&#60;/b&#62;', 'answers from the server are escaped before they are shown')
}

console.log('\nevery question a page shows, the page asks')
{
  for (const [game, qs] of Object.entries(CR.PUBLIC)) {
    const src = readFileSync(`src/pages/${game}.astro`, 'utf8')
    const asked = qs.every((q) => src.includes(`shell.pick('${q}'`))
    const shown = src.includes(`fillCrowd(`) && src.includes(`loadCrowd('${game}')`)
    check(asked && shown, `${game}: asks ${qs.map((q) => `"${q}"`).join(', ')} and shows the crowd`)
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
