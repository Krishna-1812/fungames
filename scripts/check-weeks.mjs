/**
 * check-weeks — is Life in Weeks' board the life it says it is?
 *
 * The board is drawn by a shader this cannot run. What it can check is the
 * arithmetic the board is lit from, and the things round it that go wrong
 * without anything looking broken:
 *
 *   1. The squares. For a handful of birthdays (a leap day among them) every
 *      day of ninety years is in exactly one square, the squares run on from
 *      each other with no gap, each is a week give or take a day, every line
 *      of fifty-two starts on a birthday, and the last one ends on the
 *      ninetieth. A week counted as seven days and wrapped at fifty-two
 *      drifts a third of a line by the end; this is the check that it does
 *      not come back.
 *   2. The life: nothing lived at birth, everything lived at ninety, and the
 *      counts of what is left are right for a case worked by hand.
 *   3. The world's dates: real dates, in order, none twice, short enough for
 *      one line, and few enough for the board to mark every one.
 *   4. Privacy: the date of birth and the visitor's own dates are not among
 *      the keys a save code carries, and the page hands analytics neither.
 *   5. The shader and the page agree on what is handed across.
 *
 *   node scripts/check-weeks.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const L = await import('../src/lib/weeks-life.ts')
const S = await import('../src/lib/sync.ts')
const { YEARS, WEEKS, TOTAL, DAY_MS } = L

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const list = (a) => (a.length ? ' — ' + a.slice(0, 6).join(', ') : '')
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/* ---- 1: the squares ----------------------------------------------------- */
console.log('\nthe squares')
check(YEARS === 90 && WEEKS === 52 && TOTAL === 4680, 'ninety lines of fifty-two')
for (const born of ['1996-03-14', '2000-02-29', '1951-01-01', '1987-12-31', '2024-02-29']) {
  const dob = L.parseDay(born)
  const bad = []
  let prevEnd = +dob
  for (let i = 0; i < TOTAL; i++) {
    const { start, end } = L.cellSpan(dob, i)
    if (+start !== prevEnd) bad.push(`square ${i} does not start where ${i - 1} ends`)
    const days = Math.round((+end - +start) / DAY_MS)
    if (days < 6 || days > 8) bad.push(`square ${i} is ${days} days`)
    if (i % WEEKS === 0 && +start !== +L.birthday(dob, i / WEEKS)) bad.push(`line ${i / WEEKS} does not start on a birthday`)
    // Its first day and its last both belong to it, at noon, so a clock change cannot matter.
    const first = new Date(+start + DAY_MS / 2), last = new Date(+end - DAY_MS / 2)
    if (L.cellOf(dob, first) !== i || L.cellOf(dob, last) !== i) bad.push(`square ${i} does not own its own days`)
    prevEnd = +end
    if (bad.length > 6) break
  }
  if (prevEnd !== +L.birthday(dob, YEARS)) bad.push('the last square does not end on the ninetieth birthday')
  check(!bad.length, `born ${born}: every day in one square, lines start on birthdays${list(bad)}`)
}
check(L.parseDay('2023-02-29') === null && L.parseDay('nonsense') === null && L.parseDay('2024-02-29') !== null, 'a date that does not exist is refused')

/* ---- 2: the life -------------------------------------------------------- */
console.log('\nthe life')
{
  const dob = L.parseDay('1996-03-14')
  const atBirth = L.lifeAt(dob, new Date(1996, 2, 14, 9))
  check(atBirth.lived === 0 && atBirth.inside && atBirth.years === 0, 'nothing lived on the day of birth')
  const eve = L.lifeAt(dob, new Date(2086, 2, 13, 12))
  check(eve.lived === TOTAL - 1 && eve.inside && eve.years === 89, 'the day before ninety is the last square')
  const at90 = L.lifeAt(dob, new Date(2086, 2, 14, 12))
  check(at90.lived === TOTAL && !at90.inside && at90.left.weeks === 0 && at90.pct === 100, 'at ninety every square is lived and there is none to be in')
  const old = L.lifeAt(dob, new Date(2099, 5, 1))
  check(old.lived === TOTAL && old.left.newYears === 0 && old.left.moons === 0, 'past ninety nothing runs over')
  // Worked by hand: from 16 Nov 2026 to 14 Mar 2086 there are 60 first-of-Januaries
  // (2027..2086) and 15 leap days (2028, 2032 ... 2084).
  const now = L.lifeAt(dob, new Date(2026, 10, 16, 15))
  check(now.years === 30 && now.left.newYears === 60 && now.left.leapDays === 15, `what is left, against a case worked by hand (${now.left.newYears} New Years, ${now.left.leapDays} leap days)`)
  check(now.lived + now.left.weeks === TOTAL, 'lived and left make the whole board')
  const leap = L.parseDay('2000-02-29')
  check(L.ageAt(leap, new Date(2001, 1, 28, 12)) === 0 && L.ageAt(leap, new Date(2001, 2, 1, 12)) === 1, 'a leap-day birthday falls on 1 March in other years')
}

/* ---- 3: the world's dates ----------------------------------------------- */
console.log('\nthe world')
{
  const W = L.WORLD
  const notDates = W.filter((e) => !L.parseDay(e.date)).map((e) => e.date)
  check(!notDates.length, `every date is a real one${list(notDates)}`)
  const unordered = W.filter((e, i) => i > 0 && e.date <= W[i - 1].date).map((e) => e.text)
  check(!unordered.length, `oldest first, no two on one day${list(unordered)}`)
  check(new Set(W.map((e) => e.text)).size === W.length, 'nothing twice')
  const long = W.filter((e) => e.text.length > 80 || e.text.length < 8 || /\.$/.test(e.text)).map((e) => e.text)
  check(!long.length, `each is one short line with no full stop${list(long)}`)
  const board = fs.readFileSync(path.join(root, 'src/lib/weeks-board.ts'), 'utf8')
  const pins = +(/BOARD_PINS = (\d+)/.exec(board)?.[1] ?? 0)
  check(pins > 0 && W.length <= pins - 3, `${W.length} dates, and the board can mark ${pins}: room for a few of the visitor's own`)
  // Whoever is looking, they get only what is on their board, each on its own square.
  const bad = []
  let fewest = Infinity
  for (let y = 1936; y <= 2026; y += 3) {
    const dob = new Date(y, 6, 1)
    const placed = L.worldFor(dob, new Date(2026, 10, 16))
    fewest = Math.min(fewest, placed.length)
    for (const e of placed) {
      if (+e.date < +dob || e.idx < 0 || e.idx >= TOTAL) bad.push(`${y}: ${e.text} is off the board`)
      const { start, end } = L.cellSpan(dob, e.idx)
      if (!(+start <= +e.date && +e.date < +end)) bad.push(`${y}: ${e.text} is on the wrong square`)
      if (e.ahead !== +e.date > +new Date(2026, 10, 16)) bad.push(`${y}: ${e.text} is on the wrong side of now`)
    }
  }
  check(!bad.length, `for births from 1936 to 2026, every date is on its own week${list(bad)}`)
  check(fewest >= 3, `nobody gets an empty list (fewest: ${fewest})`)
}

/* ---- 4: privacy --------------------------------------------------------- */
console.log('\nprivacy')
const page = fs.readFileSync(path.join(root, 'src/pages/life-in-weeks.astro'), 'utf8')
{
  check(!S.carried('life-in-weeks:dob') && !S.carried('life-in-weeks:mine'), 'a save code carries neither the date of birth nor the visitor\'s own dates')
  check(page.includes("'life-in-weeks:dob'") && page.includes("'life-in-weeks:mine'"), 'and those are the keys the page uses')
  // What the page tells analytics is a fixed phrase every time: no variable may ride along.
  const picks = [...page.matchAll(/shell\.pick\(([^)]*)\)/g)].map((m) => m[1])
  const loose = picks.filter((a) => !/^'[^']*', (?:'[^']*'|changedVia(?: \? '[^']*' : '[^']*')?)$/.test(a.trim()))
  check(picks.length >= 4 && !loose.length, `analytics is told how the board came up and nothing typed${list(loose)}`)
  check(/recordPlay\('life-in-weeks', \{ weeks: lived \}/.test(page), 'and the one number recorded is the week count')
  check(!/fetch\(|sendBeacon|XMLHttpRequest/.test(page), 'the page itself sends nothing')
}

/* ---- 5: the shader and the page ----------------------------------------- */
console.log('\nthe board')
{
  const board = fs.readFileSync(path.join(root, 'src/lib/weeks-board.ts'), 'utf8')
  const declared = [...board.matchAll(/^uniform\s+\w+\s+(u_\w+)/gm)].map((m) => m[1]).sort()
  const ret = /return \{ (u_lit:[^}]*) \}/.exec(page)?.[1] ?? ''
  const handed = [...ret.matchAll(/(u_\w+):/g)].map((m) => m[1]).sort()
  check(declared.length >= 6 && declared.join() === handed.join(), `the page hands over exactly what the shader asks for (${declared.join(', ')})`)
  const margin = /BOARD_MARGIN = ([\d.]+)/.exec(board)?.[1]
  check(margin === '0.5' && page.includes('aspect-ratio: 91 / 53') && page.includes('aspect-ratio: 53 / 91'), 'the board is cut to the lamps plus the rim the shader draws')
  check(!fs.existsSync(path.join(root, 'src/lib/weeks-grid.ts')) && !fs.existsSync(path.join(root, 'src/lib/weeks-field.ts')), 'the old grid and backdrop are gone')
}

console.log(failures ? `\n${failures} failed` : '\nall good')
process.exit(failures ? 1 : 0)
