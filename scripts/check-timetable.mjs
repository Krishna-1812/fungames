/**
 * check-timetable — does the island's noticeboard tell the truth?
 *
 * The board (lib/island/timetable.ts) says what is on now and next, by the
 * visitor's clock. Each of its lines is checked here at hours where the
 * answer is known by hand: the bell's next stroke, the lighthouse lit from
 * dusk, fireworks on a Friday night and at New Year and not on a Thursday,
 * the dawn whale, the three o'clock visitor kept a secret until it has been
 * seen, the ferry at each stage of its crossing; and the parade's own
 * timetable in lib/island/play.ts.
 *
 *   node scripts/check-timetable.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const T = await import('../src/lib/island/timetable.ts')
const { PARADE_EVERY } = await import('../src/lib/island/play.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const base = { daily: { title: 'Orbit', goal: 'Hold a moon in orbit for a minute.' }, parade: { on: false, next: new Date(2026, 9, 2, 12, 5), to: 'Orbit' }, ferry: 0.5, shown: 'day', seenThree: false }
const rows = (d, o = {}) => Object.fromEntries(T.timetable(d, { ...base, shown: T.timeOf(d.getHours()), ...o }).map((r) => [r.key, r]))

console.log('\nthe lines')
{
  // Friday 2 October 2026 is a Friday.
  const fri = new Date(2026, 9, 2, 12, 47, 10)
  check(fri.getDay() === 5, '(2 October 2026 is a Friday)')
  const r = rows(fri)
  check(Object.keys(r).join() === 'today,parade,ferry,bells,lighthouse,fireworks,whale,three', 'every line is on the board, in order')
  check(r.today.now && r.today.line.startsWith('Orbit:'), 'today’s challenge is there all day')
  check(/in 13 min/.test(r.bells.when) && !r.bells.now, 'at 12:47 the bell is next in 13 minutes')
  check(!r.lighthouse.now && /in 5 h/.test(r.lighthouse.when), 'the lighthouse is dark at noon, and lights in about five hours')
  check(!r.fireworks.now && /today/.test(r.fireworks.when), 'fireworks: not yet, but tonight (it is Friday)')
  check(!r.whale.now, 'no whale at noon')
  check(r.three.title.includes('█') && !/UFO|visitor/i.test(r.three.title + r.three.line), 'the three o’clock visitor is not named before it is seen')
  check(rows(fri, { seenThree: true }).three.title === 'The visitor from above', 'and is, once it has been')
}
{
  const r = rows(new Date(2026, 9, 2, 20, 30))
  check(r.fireworks.now && r.lighthouse.now, 'Friday at half past eight: fireworks on, the lighthouse lit')
  check(T.isFest(new Date(2026, 9, 2, 21, 59)) && !T.isFest(new Date(2026, 9, 2, 22, 0)) && !T.isFest(new Date(2026, 9, 1, 20, 30)), 'fireworks from eight to ten on Fridays, and not on a Thursday')
  const thu = rows(new Date(2026, 9, 1, 20, 30))
  check(!thu.fireworks.now && /tomorrow/.test(thu.fireworks.when), 'on Thursday night they are next tomorrow')
  check(rows(new Date(2026, 11, 31, 23, 0)).fireworks.now && rows(new Date(2027, 0, 1, 2, 0)).fireworks.now, 'and all New Year’s Eve night')
  check(rows(new Date(2026, 9, 3, 7, 0)).whale.now && !rows(new Date(2026, 9, 3, 8, 0)).whale.now, 'the whale is up from six to eight')
  const three = rows(new Date(2026, 9, 3, 3, 20))
  check(three.three.now, 'at twenty past three, the visitor is here')
  check(rows(new Date(2026, 9, 3, 14, 0, 10)).bells.now, 'on the hour the bell is ringing')
  check(rows(new Date(2026, 9, 3, 19, 0), { shown: 'day' }).lighthouse.now === false, 'the lighthouse follows what the island shows (day picked by hand at seven: dark)')
}
console.log('\nthe ferry')
{
  const at = (p) => T.timetable(new Date(2026, 9, 2, 12), { ...base, ferry: p }).find((r) => r.key === 'ferry')
  check(/Coming in.*in 12 s/.test(at(0.07).when), 'early in its crossing it is coming in (12 seconds to the jetty)')
  check(at(0.4).now && /leaves in 11 s/.test(at(0.4).when), 'at the jetty, it leaves in eleven seconds')
  check(/Out at sea.*in 25 s/.test(at(0.8).when), 'gone out again, it is back in 25 seconds')
  check(!T.timetable(new Date(), { ...base, ferry: null }).some((r) => r.key === 'ferry'), 'before the map has loaded, the ferry is not guessed at')
}
console.log('\nwords')
check(T.until(40_000) === 'in 40 s' && T.until(4 * 60_000) === 'in 4 min' && T.until(3 * 3600_000) === 'in 3 h' && T.until(3 * 864e5) === 'in 3 days', 'how long until, in plain words')
check(T.timeOf(6) === 'dawn' && T.timeOf(12) === 'day' && T.timeOf(19) === 'dusk' && T.timeOf(23) === 'night' && T.timeOf(3) === 'night', 'the time of day is the island’s')
check(PARADE_EVERY === 300 && (24 * 3600) % PARADE_EVERY === 0, 'the parade sets off every five minutes, on the same minutes every day')

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
