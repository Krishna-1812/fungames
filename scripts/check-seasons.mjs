/**
 * check-seasons — does the island's calendar (src/lib/island/seasons.ts)
 * give every day of the year the right look?
 *
 * - each season starts and ends on the day it says, by the visitor's clock;
 * - the rarer one wins an overlap (New Year over winter);
 * - Diwali and Holi land on their published dates, every year listed;
 * - "until" is always the first day after the season, and "next" always a
 *   different season;
 * - every season has a weather layer or a festival to show for itself, and
 *   a line for the noticeboard;
 * - the seasons a browser has seen survive junk.
 *
 *   node scripts/check-seasons.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const S = await import('../src/lib/island/seasons.ts')
const M = await import('../src/lib/island/moves.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const on = (y, m, d) => S.seasonOn(new Date(y, m - 1, d, 12))?.key ?? null

console.log('\nthe calendar')
check(on(2026, 12, 1) === 'winter' && on(2027, 1, 6) === 'winter' && on(2027, 1, 7) === null, 'winter: the first of December to Twelfth Night')
check(on(2026, 12, 31) === 'newyear' && on(2027, 1, 1) === 'newyear' && on(2026, 12, 30) === 'winter', 'New Year’s Eve and Day win over winter')
check(on(2027, 7, 1) === 'monsoon' && on(2027, 8, 31) === 'monsoon' && on(2027, 6, 30) === null && on(2027, 9, 1) === null, 'monsoon: July and August')
check(on(2027, 10, 15) === null && on(2027, 11, 30) === null && on(2027, 12, 1) === 'winter', 'no autumn: October and November are plain (but for Diwali)')
check(on(2027, 4, 1) === 'spring' && on(2027, 4, 30) === 'spring' && on(2027, 5, 1) === null, 'spring: April')
for (const [y, md] of Object.entries(S.DIWALI)) {
  const [m, d] = md.split('-').map(Number)
  const c = new Date(+y, m - 1, d, 12), dd = (k) => S.seasonOn(new Date(c.getTime() + k * 864e5))?.key
  check(dd(-2) === 'diwali' && dd(0) === 'diwali' && dd(2) === 'diwali' && dd(-3) !== 'diwali' && dd(3) !== 'diwali', `Diwali ${y}: ${md}, two days either side`)
}
for (const [y, md] of Object.entries(S.HOLI)) {
  const [m, d] = md.split('-').map(Number)
  const c = new Date(+y, m - 1, d, 12), dd = (k) => S.seasonOn(new Date(c.getTime() + k * 864e5))?.key
  check(dd(-1) === 'holi' && dd(0) === 'holi' && dd(1) !== 'holi', `Holi ${y}: ${md} and the day before`)
}

console.log('\na whole year, day by day')
{
  let untilOk = true, nextOk = true, morning = true
  for (let k = 0; k < 366; k++) {
    const d = new Date(2027, 0, 1 + k, 12)
    const s = S.seasonOn(d)
    if (s) {
      const last = new Date(s.until.getTime() - 864e5 + 12 * 3600e3)
      if (S.seasonOn(last)?.key !== s.key || S.seasonOn(new Date(s.until.getTime() + 12 * 3600e3))?.key === s.key) untilOk = false
      if (s.until.getHours() !== 0) morning = false
    }
    const n = S.nextSeason(d)
    if (!n || n.season.key === s?.key || S.seasonOn(new Date(n.from.getTime() + 12 * 3600e3))?.key !== n.season.key) nextOk = false
  }
  check(untilOk, '"until" is always the first day the season is over')
  check(morning, 'and always midnight on the visitor’s clock')
  check(nextOk, '"coming up" is always a different season, and it really starts then')
  const keys = new Set(Array.from({ length: 366 }, (_, k) => S.seasonOn(new Date(2027, 0, 1 + k, 12))?.key).filter(Boolean))
  check(keys.size === Object.keys(S.SEASONS).length, `every season comes round in 2027 (${[...keys].join(', ')})`)
}

console.log('\nthe looks')
{
  const world = readFileSync('src/lib/island/world.ts', 'utf8')
  const shown = (k) => Object.values(M.LAYERS).some((L) => L?.when?.season?.includes(k))
  for (const k of Object.keys(S.SEASONS)) check(shown(k), `${k} switches a layer on (moves.ts LAYERS)`)
  check(['rain', 'lanterns', 'powder', 'snow', 'petals'].every((k) => world.includes(`'${k}'`)), 'world.ts draws every kind of weather')
  check(Object.values(S.SEASONS).every((s) => /^[A-Z].*\.$/.test(s.line) && s.line.length < 90), 'every season has a one-sentence line for the noticeboard')
}

console.log('\nseasons seen')
{
  const mem = new Map(), st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  check(S.seeSeason('winter', st) && !S.seeSeason('winter', st) && S.seeSeason('monsoon', st) && S.seasonsSeen(st).join() === 'winter,monsoon', 'a season is new once, then remembered')
  mem.set(S.SEEN_KEY, '["winter","bogus",3,"winter"]')
  check(S.seasonsSeen(st).join() === 'winter', 'junk and repeats are dropped')
  mem.set(S.SEEN_KEY, '{nope')
  check(S.seasonsSeen(st).length === 0 && S.seasonsSeen(null).length === 0, 'unreadable or absent: none')
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
