/**
 * check-quests — do the passport's quests (src/lib/quests.ts) count what
 * they say, from what the browser already keeps?
 *
 * A browser is played through them: games opened, finished and bested, days
 * of the daily challenge, bottles, sightings, a challenge sent and won. Each
 * quest is done exactly when its line says, announced once, and stays done.
 * Quest covers can only be worn once earned. Junk storage is read as nothing.
 *
 *   node scripts/check-quests.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/stats.ts')
const P = await import('../src/lib/passport.ts')
const Q = await import('../src/lib/quests.ts')
const B = await import('../src/lib/bottles.ts')
const G = await import('../src/data/games.ts')
const M = await import('../src/data/game-meta.ts')
const { PLACES } = await import('../src/lib/island/landmarks.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const mem = new Map()
const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
S.setStore(store)
globalThis.localStorage = store

const districtOf = Object.fromEntries(PLACES.map(([s, d]) => [s, d]))
const games = G.listedGames().map((g) => ({ slug: g.slug, cat: g.category, district: districtOf[g.slug] ?? '' }))
const done = () => new Set(Q.progress(Q.gather(games)).filter((p) => p.done).map((p) => p.q.id))
const at = (id) => Q.progress(Q.gather(games)).find((p) => p.q.id === id)

console.log('\nthe list')
{
  const ids = Q.QUESTS.map((q) => q.id)
  check(new Set(ids).size === ids.length && new Set(Q.QUESTS.map((q) => q.name)).size === ids.length, `${ids.length} quests, every id and name different`)
  check(Q.QUESTS.every((q) => /^[A-Z].*\.$/.test(q.line) && q.line.length < 110), 'every quest is one short sentence')
  check(games.every((g) => g.district), 'every listed game has a district for the grand tour')
  const covers = Q.QUESTS.filter((q) => q.cover).map((q) => q.cover)
  check(covers.length === B.QUEST_COVERS.length && B.QUEST_COVERS.every((c) => covers.includes(c.key) && Q.QUESTS.find((q) => q.id === c.quest)?.cover === c.key), 'every quest cover belongs to exactly the quest that names it')
  check(B.QUEST_COVERS.every((c) => !B.COVERS.some((x) => x.key === c.key)), 'and none is a bottle cover')
}

console.log('\na browser, played through')
{
  check(done().size === 0 && Q.sync(Q.gather(games)).length === 0, 'a new browser: nothing done, nothing to announce')
  for (const g of ['trolley', 'scale', 'deep-sea']) P.recordVisit(g, '2026-10-13')
  let fresh = Q.sync(Q.gather(games), '2026-10-13')
  check(fresh.map((q) => q.id).join() === 'landfall', 'three games opened: Landfall, announced once')
  check(Q.sync(Q.gather(games)).length === 0, 'and not again')
  P.recordVisit('trolley', '2026-10-14'); P.recordVisit('trolley', '2026-10-15')
  check(done().has('regular'), 'three different days: Regular')
  S.recordPlay('trolley', {}); S.recordPlay('dark-patterns', {})
  check(at('know-thyself').n === 2 && !done().has('know-thyself'), 'two of the three games that measure you: two of three')
  S.recordPlay('not-a-robot', {})
  check(done().has('know-thyself'), 'all three: Know thyself')
  for (const slug of ['steady-hand', 'auction', 'fusion', 'orbit']) store.setItem(M.bestKey(slug), JSON.stringify({ value: 5, text: '5' }))
  check(at('on-the-board').n === 4, 'four personal bests: four of five')
  store.setItem(M.bestKey('speed'), JSON.stringify({ value: 1, text: '1' }))
  check(done().has('on-the-board'), 'five: On the board')
  const sci = games.filter((g) => g.cat === 'science').slice(0, 6)
  for (const g of sci) P.recordVisit(g.slug, '2026-10-15')
  check(done().has('lab-notes'), 'six science games opened: Lab notes')
  const perDistrict = [...new Map(games.map((g) => [g.district, g.slug])).values()]
  for (const s of perDistrict) P.recordVisit(s, '2026-10-15')
  fresh = Q.sync(Q.gather(games), '2026-10-15')
  check(done().has('grand-tour') && fresh.some((q) => q.id === 'grand-tour'), 'a stamp in every district: Grand tour')
  check(Q.questCovers().has('aurora') && B.wearCover('aurora', Q.questCovers()) && B.readBottles().cover === 'aurora', 'and its cover can be worn, and stays on')
  check(!B.wearCover('opal', Q.questCovers()), 'a quest cover not yet earned cannot be')
  B.findBottle(1)
  check(B.readBottles().cover === 'aurora', 'finding a bottle does not take a quest cover off')
  Q.bump('sent')
  check(done().has('ambassador') && !done().has('champion'), 'a challenge sent: Ambassador')
  Q.bump('won')
  check(done().has('champion'), 'a challenge won: Champion')
  store.setItem('funsite:daily', JSON.stringify({ v: 1, days: {}, best: 3 }))
  check(done().has('three-in-a-row') && !done().has('a-whole-week'), 'a three-day streak: Three in a row, not A whole week')
  store.setItem('isl-found', JSON.stringify(['whale', 'sheep', 'bottle', 'kite', 'gull', 'crab', 'fountain', 'windmill', 'balloon', 'ufo', 'castaway']))
  check(at('keen-eye').n === 10 && done().has('keen-eye'), 'ten sightings (a bottle is not one): Keen eye')
  for (const g of games) P.recordVisit(g.slug, '2026-10-16')
  check(done().has('keeper'), 'every game stamped: Keeper of the island')
  Q.sync(Q.gather(games))
  P.clearPassport()
  check(done().has('keeper') && done().has('grand-tour'), 'a new passport does not undo a quest already done')
  check(Q.unseen().length > 5, 'quests done are new to the passport until it shows them')
  Q.markQuestsSeen()
  check(Q.unseen().length === 0, 'and then they are not')
}

console.log('\nhostile storage')
{
  for (const junk of ['{nope', '[1,2]', JSON.stringify({ v: 9, done: { landfall: '2026-01-01' } }), JSON.stringify({ v: 1, done: { landfall: 5, nonsense: '2026-01-01' }, seen: [1, 'landfall'], sent: -3, won: 'x' })]) {
    store.setItem(Q.QUESTS_KEY, junk)
    const f = Q.readQuests()
    check(f.sent >= 0 && f.won >= 0 && !('nonsense' in f.done) && Object.values(f.done).every((d) => d === '' || /^\d{4}/.test(d)), `junk read safely: ${junk.slice(0, 40)}`)
  }
  S.setStore({ getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') }, removeItem() {} })
  let threw = false
  try { Q.bump('sent'); Q.sync(Q.gather(games)); Q.readQuests() } catch { threw = true }
  check(!threw, 'storage that throws: nothing thrown')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
