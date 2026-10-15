/**
 * check-daily — does the daily challenge's streak (src/lib/daily.ts) count
 * the way the page says it does?
 *
 * - days in a row, played to the end, beaten or not;
 * - today not played yet never breaks it;
 * - one missed day is forgiven, at most once in any seven, never two in a row;
 * - a beaten round is never undone by a later miss the same day;
 * - the longest streak is kept;
 * - storage that throws, is full, or holds junk never breaks the page;
 * - the share text has the day, the verdict, the streak and no spoilers;
 * - and every game that can be the daily challenge reports its rounds.
 *
 *   node scripts/check-daily.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./resolve-ts.mjs', import.meta.url)

const D = await import('../src/lib/daily.ts')
const M = await import('../src/data/game-meta.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

const T = '2026-10-15'
const ago = (n) => D.utcDay(Date.parse(T + 'T00:00:00Z') - n * 864e5)
/** Days ago that were played: 'w' beaten, 'p' played, '.' missed; index 0 is today. */
const hist = (s) => Object.fromEntries([...s].map((c, i) => [ago(i), c]).filter(([, c]) => c !== '.').map(([d, c]) => [d, { g: 'trolley', ok: c === 'w' }]))
const n = (s) => D.streakOf(hist(s), T).n

console.log('\nthe streak')
check(n('') === 0 && n('.') === 0, 'nothing played: no streak')
check(n('w') === 1 && n('p') === 1, 'played today, beaten or not: a streak of one')
check(n('wpw') === 3, 'three days in a row, one of them not beaten: three')
check(n('.www') === 3 && D.streakOf(hist('.www'), T).atRisk, 'today not played yet: the streak stands, at risk')
check(n('ww.ww') === 4 && D.streakOf(hist('ww.ww'), T).forgiven.length === 1, 'one missed day between played ones is forgiven (and not counted in)')
check(n('w..ww') === 1, 'two missed days in a row are not')
check(n('ww.ww.ww') === 4, 'a second missed day within seven days of the first is not forgiven')
check(n('ww.wwwwww.ww') === 10, 'one missed day a week, a week apart, is forgiven each time')
check(n('...ww') === 0, 'missing the two days before today ends it, whatever today brings')
check(n('.' + '.w') === 1 && D.streakOf(hist('..w'), T).atRisk, 'missing yesterday is forgiven while today is still open')

console.log('\nrecording a round')
{
  const mem = new Map()
  const s = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) }
  const at = (day, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00Z`)
  for (let i = 5; i >= 1; i--) D.recordDaily('trolley', true, at(ago(i)), s)
  let r = D.recordDaily('trolley', true, at(T, 9), s)
  check(r.streak.n === 6 && r.streak.best === 6 && r.first && r.beatenNow, 'six days in a row, recorded: a streak of six, the best yet')
  r = D.recordDaily('trolley', false, at(T, 10), s)
  check(r.streak.today.ok === true && !r.first && !r.beatenNow, 'a missed round later the same day does not undo a beaten one')
  D.recordDaily('trolley', true, at(ago(-3)), s)
  const f = D.readDaily(s)
  check(D.streakOf(f.days, ago(-3), f.best).n === 1 && f.best === 6, 'after two missed days it starts again, and the best is kept')
  const cal = D.calendar(f.days, ago(-3), [], 14)
  check(cal.length === 14 && cal[13].state === 'won' && cal[12].state === 'missed' && cal[10].state === 'won', 'the calendar: two weeks, oldest first, today last')
}

console.log('\nhostile storage')
{
  const throws = { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') } }
  const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError') } }
  const junk = (v) => ({ getItem: () => v, setItem() {} })
  check(D.readDaily(throws).best === 0 && D.recordDaily('trolley', true, new Date(), throws).streak.n === 1, 'storage that throws: nothing remembered, the round still counted on screen')
  check(D.recordDaily('trolley', true, new Date(), full).streak.n === 1, 'storage that is full: the same')
  check(D.readDaily(junk('{not json')).best === 0 && D.readDaily(junk('[1,2]')).best === 0 && D.readDaily(junk(JSON.stringify({ v: 99, days: {}, best: 3 }))).best === 0, 'junk, an array or a future version: read as empty')
  const odd = D.readDaily(junk(JSON.stringify({ v: 1, days: { [T]: { g: 'trolley', ok: 'yes' }, 'not-a-day': { g: 'x', ok: true }, [ago(1)]: { g: 'scale', ok: false } }, best: -4 })))
  check(Object.keys(odd.days).length === 1 && odd.days[ago(1)] && odd.best === 0, 'bad days and a bad best are dropped, good ones kept')
  check(D.readDaily(null).best === 0, 'no storage at all: empty')
}

console.log('\nthe clock and the share text')
{
  check(D.msToNext(new Date('2026-10-15T23:30:00Z')) === 30 * 60000, 'the next challenge comes at UTC midnight')
  check(D.inWords(30 * 60000) === '30m' && D.inWords(6 * 3600000 + 12 * 60000) === '6h 12m' && D.inWords(10000) === 'under a minute', 'and says so in words')
  const st = D.streakOf(hist('wwp.w'), T)
  const text = D.shareText({ title: 'Trolley', ok: true, streak: st, cal: D.calendar(hist('wwp.w'), T, st.forgiven), url: 'https://example.com/trolley/', now: new Date(T + 'T10:00:00Z') })
  check(text.includes('15 Oct') && text.includes('Trolley: beaten ✓') && text.includes(`Streak ${st.n}`) && text.includes('https://example.com/trolley/'), 'the share text: the day, the verdict, the streak and the link')
  check(!/\d+%|keystrokes|position/i.test(text), 'and no spoilers about how')
}

console.log('\nevery daily game reports its rounds')
{
  const slugs = new Set()
  for (let d = 0; d < 21; d++) slugs.add(M.dailyFor(new Date(Date.UTC(2026, 9, 1 + d))).slug)
  for (const slug of slugs) {
    const src = readFileSync(`src/pages/${slug}.astro`, 'utf8')
    check(/shell\.daily\(/.test(src) && !/Daily challenge beaten/.test(src), `${slug} calls shell.daily`)
  }
  check(slugs.size === 7, `seven games take turns (${[...slugs].join(', ')})`)
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good')
process.exitCode = failures ? 1 : 0
