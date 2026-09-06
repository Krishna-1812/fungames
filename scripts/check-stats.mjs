/**
 * check-stats — does the thing that remembers your scores survive a hostile
 * browser?
 *
 * Persistence is the part of a site that fails on somebody else's machine and
 * never on yours. `localStorage` throws on *access* in Safari's private mode,
 * is absent in a sandboxed iframe, fills up, and holds whatever a previous
 * version of the code or another script on the origin left there. None of that
 * is reachable by playing the game in a normal browser, and all of it is
 * reachable by handing the module a store that misbehaves — which is the whole
 * reason the store is an argument rather than an assumption.
 *
 * So this runs the real module against six stores: a working one, one that
 * throws on read, one that throws on write, one that is full, one holding junk,
 * and none at all.
 *
 *   node scripts/check-stats.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/stats.ts')

let failures = 0
const fail = (m) => {
  failures++
  console.log(`  FAIL  ${m}`)
}
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

/** A localStorage that can be told to misbehave. */
function fakeStore(opts = {}) {
  const map = new Map(Object.entries(opts.seed ?? {}))
  return {
    map,
    getItem(k) {
      if (opts.throwOnRead) throw new DOMException('SecurityError')
      return map.has(k) ? map.get(k) : null
    },
    setItem(k, v) {
      if (opts.throwOnWrite) throw new DOMException('QuotaExceededError')
      if (opts.full && k !== `${S.KEY}:probe`) throw new DOMException('QuotaExceededError')
      map.set(k, v)
    },
    removeItem(k) {
      if (opts.throwOnWrite) throw new DOMException('SecurityError')
      map.delete(k)
    },
  }
}

/* ---- 1. it remembers ------------------------------------------------------ */

console.log('\nthe ordinary case')
{
  const store = fakeStore()
  S.setStore(store)
  const a = S.recordPlay('trolley', { position: 'Utilitarian', pulled: 21 }, {})
  check(a.plays === 1, 'a first ending is one play')
  const b = S.recordPlay('trolley', { position: 'Kantian', pulled: 4 }, {})
  check(b.plays === 2, 'a second is two')
  check(b.last.position === 'Kantian', 'the last result is the last one, not the first')
  check(S.readGame('powder') === null, 'a game never played has no record')
  check(Object.keys(S.readAll().games).length === 1, 'and does not get an empty one made for it')
  check(/^\d{4}-\d{2}-\d{2}$/.test(b.at), 'the date is a day, not an instant')
}

/* ---- 2. bests go one way -------------------------------------------------- */

console.log('\nbests')
{
  S.setStore(fakeStore())
  S.recordPlay('steady-hand', { rating: 6.2 }, { rating: 'high' })
  S.recordPlay('steady-hand', { rating: 8.7 }, { rating: 'high' })
  const worse = S.recordPlay('steady-hand', { rating: 3.1 }, { rating: 'high' })
  check(worse.bests.rating.value === 8.7, 'a worse round does not lower a best')
  check(worse.last.rating === 3.1, 'but it is still the last round')

  S.setStore(fakeStore())
  S.recordPlay('orbit', { seconds: 40 }, { seconds: 'low' })
  const faster = S.recordPlay('orbit', { seconds: 12 }, { seconds: 'low' })
  check(faster.bests.seconds.value === 12, "'low' means lower is better")

  S.setStore(fakeStore())
  const nan = S.recordPlay('powder', { score: Number.NaN }, { score: 'high' })
  check(!nan.bests.score, 'a NaN never becomes a best')
  const str = S.recordPlay('powder', { score: 'lots' }, { score: 'high' })
  check(!str.bests.score, 'and neither does a string')
}

/* ---- 3. one game cannot corrupt another ----------------------------------- */

console.log('\ngames stay out of each other')
{
  S.setStore(fakeStore())
  S.recordPlay('trolley', { position: 'Utilitarian' }, {})
  S.recordPlay('auction', { spent: 400 }, { spent: 'high' })
  const all = S.readAll()
  check(all.games.trolley.plays === 1 && all.games.auction.plays === 1, 'both are recorded')
  check(!all.games.trolley.bests.spent, "one game's best does not appear under another")
}

/* ---- 4. a hostile store --------------------------------------------------- */

/* Each of these is a real browser state, and none of them is reachable by
   playing the game in a normal one. */
console.log('\nstores that misbehave')
{
  S.setStore(null)
  check(S.readAll().games && Object.keys(S.readAll().games).length === 0, 'no store at all: reads empty')
  let threw = false
  try {
    S.recordPlay('trolley', { a: 1 }, {})
  } catch {
    threw = true
  }
  check(!threw, 'no store at all: recording does not throw')

  S.setStore(fakeStore({ throwOnRead: true }))
  check(Object.keys(S.readAll().games).length === 0, 'a store that throws on read: reads empty')

  S.setStore(fakeStore({ throwOnWrite: true }))
  const r = S.recordPlay('trolley', { a: 1 }, {})
  check(r.plays === 1, 'a store that throws on write: the caller still gets its result')

  const full = fakeStore({ full: true })
  S.setStore(full)
  S.recordPlay('trolley', { a: 1 }, {})
  check(!full.map.has(S.KEY), 'a full store: nothing is written')
  check(S.readGame('trolley') === null, 'a full store: and nothing is claimed to have been')
}

/* ---- 5. junk in the slot -------------------------------------------------- */

console.log('\nwhatever was already in the slot')
{
  for (const [what, value] of [
    ['not JSON at all', 'nope{'],
    ['a JSON string', '"hello"'],
    ['a JSON array', '[1,2,3]'],
    ['an object with no version', '{"games":{"trolley":{"plays":3}}}'],
    ['a version from the future', `{"v":${S.VERSION + 1},"games":{"trolley":{"plays":3}}}`],
    ['games that are not objects', `{"v":${S.VERSION},"games":{"trolley":7}}`],
    ['a play count that is a string', `{"v":${S.VERSION},"games":{"trolley":{"plays":"lots"}}}`],
    ['a best that is a string', `{"v":${S.VERSION},"games":{"t":{"plays":1,"bests":{"x":{"value":"9"}}}}}`],
  ]) {
    S.setStore(fakeStore({ seed: { [S.KEY]: value } }))
    let threw = false
    let out = null
    try {
      out = S.readAll()
    } catch (e) {
      threw = true
    }
    if (threw) {
      fail(`${what}: threw`)
      continue
    }
    // Nothing survives that is not the declared type.
    let bad = ''
    for (const [slug, g] of Object.entries(out.games)) {
      if (typeof g.plays !== 'number' || !Number.isFinite(g.plays)) bad = `${slug}.plays`
      for (const [k, b] of Object.entries(g.bests)) if (typeof b.value !== 'number') bad = `${slug}.bests.${k}`
    }
    check(!bad, `${what}: read back clean${bad ? ` (${bad} survived)` : ''}`)
  }

  // And a play recorded over junk starts from scratch rather than adding to it.
  S.setStore(fakeStore({ seed: { [S.KEY]: 'nope{' } }))
  check(S.recordPlay('trolley', {}, {}).plays === 1, 'recording over junk starts at one')
}

/* ---- 6. the old key ------------------------------------------------------- */

console.log('\nthe key Steady Hand wrote before any of this existed')
{
  for (const [what, raw, want] of [
    ['a bare number', '7.4', 7.4],
    ['a per-shape object', '{"line":8,"circle":9,"square":7,"spiral":6}', 7.5],
    ['nonsense', 'nope{', null],
    ['an empty object', '{}', null],
  ]) {
    const store = fakeStore({ seed: { 'steady-hand:best': raw } })
    S.setStore(store)
    S.migrateLegacy()
    const g = S.readGame('steady-hand')
    if (want === null) check(g === null, `${what}: not migrated`)
    else check(g && Math.abs(g.bests.rating.value - want) < 1e-9, `${what}: migrated as ${want}`)
    check(store.map.has('steady-hand:best'), `${what}: the old key is left alone`)
  }

  // Twice must not double it, and must not overwrite a newer real play.
  const store = fakeStore({ seed: { 'steady-hand:best': '7.4' } })
  S.setStore(store)
  S.migrateLegacy()
  S.recordPlay('steady-hand', { rating: 9.1 }, { rating: 'high' })
  S.migrateLegacy()
  const g = S.readGame('steady-hand')
  check(g.bests.rating.value === 9.1, 'migrating again does not undo a later, better round')
  check(g.plays === 2, 'and does not invent an extra play')
}

/* ---- 7. it owns one key --------------------------------------------------- */

console.log('\nblast radius')
{
  const store = fakeStore({ seed: { 'someone-elses': 'data', 'steady-hand:best': '7.4' } })
  S.setStore(store)
  S.recordPlay('trolley', { a: 1 }, {})
  S.clearAll()
  check(store.map.get('someone-elses') === 'data', 'clearing does not touch another script’s key')
  check(store.map.get('steady-hand:best') === '7.4', 'nor the old per-game one')
  check(!store.map.has(S.KEY), 'and does remove its own')
}

console.log(failures ? `\n${failures} failed.` : '\nAll stats checks passed.')
process.exitCode = failures ? 1 : 0
