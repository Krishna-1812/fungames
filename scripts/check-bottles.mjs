/**
 * check-bottles — does the island keep count of its messages in bottles,
 * once each, and survive a hostile browser?
 *
 * A bottle is found by a tap on the map and written at once, so like the
 * passport it meets every kind of store: one that throws, one that is full,
 * one holding something an older version (or a curious visitor) left. This
 * runs the real module against each, and then checks the rules: a bottle is
 * only found once, a cover is earned at three, six, nine and twelve and only
 * worn once earned, and a browser that will not keep anything still counts
 * the bottles found this visit.
 *
 *   node scripts/check-bottles.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/stats.ts')
const B = await import('../src/lib/bottles.ts')

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
const fresh = (opts) => { B.clearBottles(); const s = fakeStore(opts); S.setStore(s); return s }

console.log('\nthe bottles themselves')
check(B.BOTTLE_COUNT === 12, 'there are twelve')
check(Object.keys(B.NOTES).length === B.BOTTLE_COUNT && Object.values(B.NOTES).every((n) => n.text.length > 20 && n.text.length <= 140 && n.from), 'each has a note, short enough to read over the map, and who it is from')
check(new Set(Object.values(B.NOTES).map((n) => n.text)).size === B.BOTTLE_COUNT, 'and no two notes are the same')
// The site keeps to cool colours: no orange or yellow glass.
const hue = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return null; const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360 }
check(B.GLASS.every((c) => { const h = hue(c); return h === null || (h >= 140 && h <= 290) }), 'the glass is all greens, blues and lilacs')
check(B.COVERS[0].need === 0 && B.COVERS.map((c) => c.need).join() === '0,3,6,9,12', 'covers come with the book, then at three, six, nine and twelve bottles')

console.log('\nfinding')
{
  fresh()
  const a = B.findBottle(5, '2026-10-03')
  check(a.first && a.total === 1 && !a.cover, 'the first bottle is found, one of twelve, and earns nothing yet')
  const b = B.findBottle(5, '2026-10-04')
  check(!b.first && b.total === 1, 'tapping it again is not finding it again')
  check(B.readBottles().found[5] === '2026-10-03', 'and the day it was found stays the first day')
  B.findBottle(1); const c = B.findBottle(9)
  check(c.first && c.total === 3 && c.cover?.key === 'lagoon', 'the third earns the first new cover')
  check(!B.findBottle(0).first && !B.findBottle(13).first && !B.findBottle(2.5).first && !B.findBottle(NaN).first, 'a bottle that does not exist cannot be found')
  for (const n of [2, 3, 4, 6, 7, 8, 10, 11]) B.findBottle(n)
  const last = B.findBottle(12)
  check(last.total === 12 && last.cover?.key === 'pearl', 'the twelfth earns the last cover')
  check(B.unlocked(12).length === B.COVERS.length && B.unlocked(2).length === 1, 'every cover is open with all twelve, and only the first with two')
}

console.log('\ncovers')
{
  fresh()
  check(B.readBottles().cover === 'navy', 'a new passport is navy')
  check(!B.wearCover('kelp'), 'a cover not yet earned cannot be put on')
  for (const n of [1, 2, 3, 4, 5, 6]) B.findBottle(n)
  check(B.wearCover('kelp') && B.readBottles().cover === 'kelp', 'one that has been can')
  check(!B.wearCover('gold') && B.readBottles().cover === 'kelp', 'a cover that does not exist changes nothing')
  // A record that says it wears a cover it has not earned (edited by hand) is navy.
  fresh({ seed: { [B.BOTTLES_KEY]: JSON.stringify({ v: 1, found: { 1: '2026-10-03' }, cover: 'pearl' }) } })
  check(B.readBottles().cover === 'navy', 'a cover it has not earned, written into the store by hand, is not worn')
}

console.log('\na hostile store')
{
  for (const [what, seed] of [['not JSON', '{nope'], ['an array', '[]'], ['a newer version', JSON.stringify({ v: 99, found: { 1: 'x' } })], ['found as a list', JSON.stringify({ v: 1, found: [1, 2] })]]) {
    fresh({ seed: { [B.BOTTLES_KEY]: seed } })
    const r = B.readBottles()
    check(B.count(r) === 0 && r.cover === 'navy', `a record that is ${what} reads as no bottles yet`)
  }
  fresh({ seed: { [B.BOTTLES_KEY]: JSON.stringify({ v: 1, found: { 1: '2026-10-03', 40: '2026-10-03', x: '2026-10-03', 2: 'yesterday', 3: 7 } }) } })
  const r = B.readBottles()
  check(Object.keys(r.found).sort().join() === '1,2,3' && r.found[2] === '' && r.found[3] === '', 'bottles that do not exist are dropped, and a day that is not a day is forgotten, not the bottle')

  fresh({ throwOnRead: true, throwOnWrite: true })
  S.setStore(null)
  let threw = false
  try { B.findBottle(4); B.readBottles(); B.wearCover('navy'); B.clearBottles() } catch { threw = true }
  check(!threw, 'with no store at all, nothing throws')
  B.clearBottles(); S.setStore(null)
  B.findBottle(4); B.findBottle(7)
  check(B.count(B.readBottles()) === 2, 'and the bottles found this visit are still counted')

  fresh({ full: true })
  B.findBottle(2)
  check(B.count(B.readBottles()) === 1, 'a full store: the bottle is found for the visit anyway')
  fresh({ throwOnRead: true })
  check(B.count(B.readBottles()) === 0, 'a store that throws on reading reads as none')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
