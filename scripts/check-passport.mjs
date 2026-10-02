/**
 * check-passport — does the island's passport stamp the right things, once,
 * and survive a hostile browser?
 *
 * The passport is the one record on the site that is written on every game's
 * every page load, so it is the one most likely to meet a store that throws,
 * is full, or holds something an older version left. Like check-stats, this
 * runs the real module against stores that misbehave, and then checks the
 * small rules a book of stamps has to keep: a refresh is not a second visit,
 * a first day never moves, a stamp from before the passport existed does not
 * pretend to know its date.
 *
 *   node scripts/check-passport.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/stats.ts')
const P = await import('../src/lib/passport.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

function fakeStore(opts = {}) {
  const map = new Map(Object.entries(opts.seed ?? {}))
  return {
    map,
    getItem(k) { if (opts.throwOnRead) throw new DOMException('SecurityError'); return map.has(k) ? map.get(k) : null },
    setItem(k, v) {
      if (opts.throwOnWrite) throw new DOMException('QuotaExceededError')
      if (opts.full && k !== `${S.KEY}:probe`) throw new DOMException('QuotaExceededError')
      map.set(k, v)
    },
    removeItem(k) { if (opts.throwOnWrite) throw new DOMException('SecurityError'); map.delete(k) },
  }
}

/* ---- 1. stamping ---------------------------------------------------------- */

console.log('\nstamping')
{
  S.setStore(fakeStore())
  const a = P.recordVisit('orbit', '2026-10-02')
  check(a.first === '2026-10-02' && a.last === '2026-10-02' && a.days === 1, 'a first visit is one day')
  const b = P.recordVisit('orbit', '2026-10-02')
  check(b.days === 1, 'a refresh the same day is not a second visit')
  const c = P.recordVisit('orbit', '2026-10-05')
  check(c.days === 2 && c.first === '2026-10-02' && c.last === '2026-10-05', 'another day counts one more, and the first day stays')
  const d = P.recordVisit('orbit', '2026-10-03')
  check(d.days === 2 && d.last === '2026-10-05', 'a day between the two (a clock put back) changes nothing')
  const e = P.recordVisit('orbit', '2026-09-30')
  check(e.first === '2026-09-30' && e.days === 2, 'a day before the first moves the first back, without counting a day')
  P.recordVisit('scale', '2026-10-05')
  check(Object.keys(P.readPassport().visits).sort().join() === 'orbit,scale', 'two games, two stamps')
  check(/^\d{4}-\d{2}-\d{2}$/.test(P.localDay()), 'today is a day, not an instant')
  check(P.localDay(new Date(2026, 0, 3, 23, 50)) === '2026-01-03', 'and it is the visitor’s own day, late in the evening too')
}

/* ---- 2. the stamps the book has shown ------------------------------------- */

console.log('\nnew stamps')
{
  S.setStore(fakeStore())
  P.recordVisit('trolley', '2026-10-01')
  P.recordVisit('orbit', '2026-10-02')
  let f = P.readPassport()
  check(P.newStamps(f.visits, f.seen).join() === 'trolley,orbit', 'unseen stamps, oldest first')
  P.markSeen(['trolley', 'orbit'])
  f = P.readPassport()
  check(P.newStamps(f.visits, f.seen).length === 0, 'once seen, they are not new')
  P.recordVisit('orbit', '2026-10-09')
  f = P.readPassport()
  check(P.newStamps(f.visits, f.seen).length === 0, 'going back to a game is not a new stamp')
  P.markSeen(['orbit', 'orbit'])
  check(P.readPassport().seen.length === 2, 'seen is a set')
}

/* ---- 3. what was there before the passport -------------------------------- */

console.log('\nhistory from before the passport')
{
  const file = { v: 1, visits: { orbit: { first: '2026-10-02', last: '2026-10-02', days: 1 } }, seen: [] }
  const stats = { v: 1, games: { trolley: { plays: 2, at: '2026-08-14', bests: {}, last: {} }, orbit: { plays: 1, at: '2026-01-01', bests: {}, last: {} } } }
  const all = P.withHistory(file, stats, ['auction', 'orbit'])
  check(all.trolley?.old && all.trolley.first === '2026-08-14', 'a finished game counts, on the day it was finished')
  check(all.auction?.old && all.auction.first === '', 'a game with only a best counts, with no date claimed')
  check(all.orbit.first === '2026-10-02' && !all.orbit.old, 'a real stamp is never replaced by history')
  check(P.newStamps(all, []).join() === 'orbit', 'history does not land as new stamps')
  S.setStore(fakeStore({ seed: { [P.PASSPORT_KEY]: JSON.stringify({ v: 1, visits: { auction: { first: '2026-03-01', last: '2026-03-01', days: 1, old: true } }, seen: [] }) } }))
  const v = P.recordVisit('auction', '2026-10-02')
  check(!v.old && v.first === '2026-03-01' && v.days === 1, 'visiting a game known only from history makes it a real stamp')
}

/* ---- 4. ranks -------------------------------------------------------------- */

console.log('\nranks')
{
  check(P.rankFor(0, 32) === 'Just landed', 'nothing visited: just landed')
  check(P.rankFor(1, 32) === 'Day tripper', 'one game: a day tripper')
  check(P.rankFor(1, 300) === 'Day tripper', 'one game out of very many is still a day tripper')
  check(P.rankFor(31, 32) === 'Islander', 'all but one: an islander')
  check(P.rankFor(32, 32) === 'Keeper of the island', 'every one: the keeper')
  check(P.rankFor(40, 32) === 'Keeper of the island', 'more than all (a game removed) does not break it')
  let prev = -1, mono = true
  for (let n = 0; n <= 32; n++) { const i = P.RANKS.findIndex((r) => r.name === P.rankFor(n, 32)); if (i < prev) mono = false; prev = i }
  check(mono, 'ranks only ever go up')
  check(P.stampDate('2026-10-02') === '2 OCT 2026', 'a stamp prints the day the way a stamp does')
  check(P.stampDate('nope') === '' && P.stampDate('2026-13-01') === '', 'and prints nothing for a day that is not one')
}

/* ---- 5. hostile stores ----------------------------------------------------- */

console.log('\nstores that misbehave')
{
  for (const [what, store] of [['no store', null], ['throws on read', fakeStore({ throwOnRead: true })], ['throws on write', fakeStore({ throwOnWrite: true })], ['full', fakeStore({ full: true })]]) {
    S.setStore(store)
    let threw = false, v = null
    try { v = P.recordVisit('orbit', '2026-10-02'); P.markSeen(['orbit']); P.readPassport(); P.clearPassport() } catch { threw = true }
    check(!threw && v?.days === 1, `${what}: stamping does not throw, and the page still gets its visit`)
  }
  for (const [what, value] of [
    ['not JSON', 'nope{'],
    ['an array', '[1,2]'],
    ['no version', '{"visits":{"orbit":{"first":"2026-10-02"}}}'],
    ['a future version', `{"v":${P.PASSPORT_VERSION + 1},"visits":{"orbit":{"first":"2026-10-02","last":"2026-10-02","days":1}}}`],
    ['visits as an array', '{"v":1,"visits":[1,2]}'],
    ['a visit with a bad day', '{"v":1,"visits":{"orbit":{"first":"yesterday","days":3}}}'],
    ['days as a string', '{"v":1,"visits":{"orbit":{"first":"2026-10-02","last":"2026-10-02","days":"lots"}}}'],
    ['a last before its first', '{"v":1,"visits":{"orbit":{"first":"2026-10-09","last":"2026-10-02","days":2}}}'],
    ['seen with junk in it', '{"v":1,"visits":{},"seen":["orbit",4,null,"orbit"]}'],
  ]) {
    S.setStore(fakeStore({ seed: { [P.PASSPORT_KEY]: value } }))
    let f = null, threw = false
    try { f = P.readPassport() } catch { threw = true }
    if (threw) { fail(`${what}: threw`); continue }
    let bad = ''
    for (const [slug, v] of Object.entries(f.visits)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.first) || !/^\d{4}-\d{2}-\d{2}$/.test(v.last)) bad = `${slug} dates`
      if (typeof v.days !== 'number' || v.days < 1) bad = `${slug}.days`
      if (v.first > v.last) bad = `${slug} order`
    }
    if (!f.seen.every((s) => typeof s === 'string') || new Set(f.seen).size !== f.seen.length) bad = 'seen'
    check(!bad, `${what}: read back clean${bad ? ` (${bad})` : ''}`)
  }
}

/* ---- 6. one key ------------------------------------------------------------ */

console.log('\nblast radius')
{
  const store = fakeStore({ seed: { 'someone-elses': 'data', 'isl-found': '["sheep"]', 'paper:best:orbit': '{"value":1,"text":"1"}' } })
  S.setStore(store)
  S.recordPlay('trolley', { a: 1 }, {})
  P.recordVisit('trolley', '2026-10-02')
  check(S.readGame('trolley')?.plays === 1, 'stamping does not touch the stats')
  P.clearPassport()
  check(!store.map.has(P.PASSPORT_KEY), 'clearing removes the passport')
  check(store.map.has(S.KEY) && store.map.get('isl-found') === '["sheep"]' && store.map.has('paper:best:orbit') && store.map.get('someone-elses') === 'data',
    'and nothing else: finishes, secrets, bests and other scripts’ keys stay')
}

console.log(failures ? `\n${failures} failed.` : '\nAll passport checks passed.')
process.exitCode = failures ? 1 : 0
