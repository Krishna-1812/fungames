/**
 * check-who-was-alive — the record, and the arithmetic over it.
 *
 * No checker can prove that Kepler really died in 1630; that is what
 * Britannica is for. What it can prove is everything built on top of the
 * years: that none of them is impossible, that the same person is not in the
 * list twice, that "alive in year Y" is inclusive at both ends, and that the
 * count, the oldest and the youngest for a given year are the ones somebody
 * worked out by hand for that year.
 *
 * The one piece of real arithmetic here is `yearsBetween`, which knows there
 * is no year zero. It found a bug: the first version of `ageIn` subtracted,
 * which made Augustus 77 years old at his death against a real 76 calendar
 * years between 63 BC and AD 14 — one wrong entry out of eighty-nine, in the
 * only span in the whole record that crosses the era boundary, which is
 * exactly the kind of thing that ships.
 *
 *   node scripts/check-who-was-alive.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  PEOPLE, CATEGORY_ORDER, CATEGORIES, categoryMeta, MIN_YEAR, maxYear, clampYear,
  yearsBetween, toAxis, fromAxis, formatYear, lifespanLabel, isAliveIn, peopleAliveIn,
  ageIn, lifespan, oldestAliveIn, youngestAliveIn, countByCategory, rosterFor,
  emptyStretches, nearestPopulatedYear, parseYearInput,
} = await import('../src/data/historical-figures.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

const NOW = maxYear()

/* ---- the record itself ---------------------------------------------------- */

console.log('the record')
{
  check(PEOPLE.length >= 80, `${PEOPLE.length} people in the record`)

  const names = PEOPLE.map((p) => p.name)
  const dupes = names.filter((n, i) => names.indexOf(n) !== i)
  check(dupes.length === 0, `no duplicate names${dupes.length ? `: ${[...new Set(dupes)].join(', ')}` : ''}`)

  let bad = 0
  for (const p of PEOPLE) {
    if (!Number.isInteger(p.birth)) { fail(`${p.name}: birth ${p.birth} is not a whole year`); bad++ }
    if (p.birth === 0 || p.death === 0) { fail(`${p.name}: year zero does not exist`); bad++ }
    if (p.death !== null && !Number.isInteger(p.death)) { fail(`${p.name}: death ${p.death} is not a whole year`); bad++ }
    if (p.death !== null && p.death < p.birth) { fail(`${p.name}: died (${p.death}) before being born (${p.birth})`); bad++ }
    if (p.birth > NOW) { fail(`${p.name}: born in ${p.birth}, which has not happened`); bad++ }
    if (p.death !== null && p.death > NOW) { fail(`${p.name}: died in ${p.death}, which has not happened`); bad++ }
    if (p.birth < -3000) { fail(`${p.name}: born in ${p.birth}, outside any plausible range for a named person`); bad++ }
    if (!CATEGORIES.includes(p.category)) { fail(`${p.name}: "${p.category}" is not one of the declared categories`); bad++ }
    if (!p.place || !p.place.trim()) { fail(`${p.name}: no place`); bad++ }
    if (!p.blurb || p.blurb.trim().length < 20) { fail(`${p.name}: blurb is missing or too short to say anything`); bad++ }
    if (p.blurb && !/[.!?]$/.test(p.blurb.trim())) { fail(`${p.name}: blurb is not a finished sentence`); bad++ }
  }
  check(bad === 0, 'every entry has a sane pair of years, a real category, a place and a sentence')

  // A life nobody could have lived is the one "impossible year" a typo in a
  // real dataset actually produces — 1809 for 1909 reads fine on its own.
  const tooLong = PEOPLE.filter((p) => lifespan(p, NOW) > 110)
  check(tooLong.length === 0, `nobody in the record lived past 110${tooLong.length ? `: ${tooLong.map((p) => p.name).join(', ')}` : ''}`)
  const tooShort = PEOPLE.filter((p) => p.death !== null && lifespan(p, NOW) < 5)
  check(tooShort.length === 0, 'nobody in the record died before they were five')

  const living = PEOPLE.filter((p) => p.death === null)
  check(living.length > 0 && living.every((p) => NOW - p.birth < 110),
    `${living.length} are still living, and none of them would be over 110`)
}

console.log('\nthe categories')
{
  const keys = CATEGORY_ORDER.map((c) => c.key)
  check(new Set(keys).size === keys.length, 'no category is listed twice')
  check(same([...keys].sort(), [...CATEGORIES].sort()), 'CATEGORIES and CATEGORY_ORDER describe the same set')
  check(CATEGORY_ORDER.every((c) => c.icon && c.label && c.note), 'every category has a label, a note and a drawn mark')
  const used = new Set(PEOPLE.map((p) => p.category))
  const unused = keys.filter((k) => !used.has(k))
  check(unused.length === 0, `every declared category is actually used${unused.length ? ` (idle: ${unused.join(', ')})` : ''}`)
  check(categoryMeta('ruler').label === 'Rulers', 'categoryMeta resolves a real key')
  check(categoryMeta('nonsense').key === keys[keys.length - 1], 'categoryMeta falls back rather than throwing')
  const icons = CATEGORY_ORDER.map((c) => c.icon)
  check(new Set(icons).size === icons.length, 'no two categories share a drawn mark')
}

/* ---- there is no year zero ------------------------------------------------ */

console.log('\nthere is no year zero')
{
  check(yearsBetween(1900, 1969) === 69, '1900 to 1969 is 69 years')
  check(yearsBetween(-551, -479) === 72, '551 BC to 479 BC is 72 years — both sides of the era, same sign')
  check(yearsBetween(-1, 1) === 1, '1 BC to AD 1 is ONE year, not two — the whole reason this function exists')
  check(yearsBetween(1, -1) === -1, 'and it is symmetric going backwards')
  check(yearsBetween(-63, 14) === 76, '63 BC to AD 14 is 76 years (a plain subtraction says 77)')
  check(yearsBetween(5, 5) === 0, 'a year is zero years from itself')
  check(yearsBetween(-5, -5) === 0, 'including a BC year')

  // The axis transform has to agree with the arithmetic, or the chart draws a
  // bar one year longer than the roster says it is.
  let drift = 0
  for (let a = -20; a <= 20; a++) {
    for (let b = -20; b <= 20; b++) {
      if (a === 0 || b === 0) continue
      if (toAxis(b) - toAxis(a) !== yearsBetween(a, b)) drift++
    }
  }
  check(drift === 0, 'toAxis and yearsBetween agree on all 1,600 pairs across the era boundary')
  check([-5, -1, 1, 7, 1969].every((y) => fromAxis(toAxis(y)) === y), 'fromAxis undoes toAxis')

  const augustus = PEOPLE.find((p) => p.name === 'Augustus')
  check(lifespan(augustus, NOW) === 76, `Augustus spans 76 calendar years (got ${lifespan(augustus, NOW)})`)
  check(ageIn(augustus, -63) === 0, 'and is age 0 in the year he is born')
  check(ageIn(augustus, 1) === 63, 'and 63 in AD 1')
}

console.log('\nformatting')
{
  const cases = [[-551, '551 BC'], [-1, '1 BC'], [1, 'AD 1'], [14, 'AD 14'], [999, 'AD 999'], [1000, '1000'], [1969, '1969']]
  let bad = 0
  for (const [y, want] of cases) if (formatYear(y) !== want) { fail(`formatYear(${y}) = "${formatYear(y)}", expected "${want}"`); bad++ }
  check(bad === 0, `all ${cases.length} year labels render exactly`)
  check(lifespanLabel(PEOPLE.find((p) => p.name === 'Elizabeth I')) === '1533 – 1603', "Elizabeth I's span renders as 1533 – 1603")
  check(lifespanLabel(PEOPLE.find((p) => p.name === 'Jane Goodall')) === '1934 – present', 'a living person ends in "present", not in this year')
  check(lifespanLabel(PEOPLE.find((p) => p.name === 'Confucius')) === '551 BC – 479 BC', 'a wholly-BC span labels both ends BC')
}

/* ---- alive, at the edges -------------------------------------------------- */

console.log('\nalive in a year, inclusive at both ends')
{
  const shakespeare = PEOPLE.find((p) => p.name === 'William Shakespeare')
  check(isAliveIn(shakespeare, 1564), 'alive in the year he is born')
  check(isAliveIn(shakespeare, 1616), 'alive in the year he dies')
  check(!isAliveIn(shakespeare, 1563), 'not alive the year before he is born')
  check(!isAliveIn(shakespeare, 1617), 'not alive the year after he dies')
  check(isAliveIn(shakespeare, 1590), 'alive somewhere in the middle')

  const goodall = PEOPLE.find((p) => p.name === 'Jane Goodall')
  check(isAliveIn(goodall, NOW), 'somebody with no death year is alive now')
  check(isAliveIn(goodall, 1934), 'and in the year they were born')
  check(!isAliveIn(goodall, 1933), 'and not the year before it')

  // Every person is alive in their own birth year and their own death year,
  // for all eighty-nine, not just the two spot checks above.
  const edges = PEOPLE.filter((p) => !isAliveIn(p, p.birth) || (p.death !== null && !isAliveIn(p, p.death)))
  check(edges.length === 0, `all ${PEOPLE.length} are alive in both of their own edge years`)
  const outside = PEOPLE.filter((p) => isAliveIn(p, p.birth - 1) || (p.death !== null && isAliveIn(p, p.death + 1)))
  check(outside.length === 0, 'and none of them is alive in either year just outside')
}

console.log('\npeopleAliveIn over five fixed years')
{
  // Hand-computed from the record, by reading it. Each of these is a real
  // claim: get the roster wrong and one of these five moves.
  const EXPECTED = {
    1600: ['Elizabeth I', 'Akbar the Great', 'William Shakespeare', 'Galileo Galilei', 'Johannes Kepler', 'René Descartes', 'Oliver Cromwell'],
    1789: ['Benjamin Franklin', 'George Washington', 'Thomas Jefferson', 'Marie Antoinette', 'Wolfgang Amadeus Mozart', 'Napoleon Bonaparte', 'Ludwig van Beethoven', 'Jane Austen', 'Simón Bolívar'],
    1900: ['Florence Nightingale', 'Leo Tolstoy', 'Nikola Tesla', 'Sigmund Freud', 'Marie Curie', 'Wilbur Wright', 'Mahatma Gandhi', 'Winston Churchill', 'Albert Einstein', 'Pablo Picasso', 'Franklin D. Roosevelt', 'Charlie Chaplin', 'Adolf Hitler', 'Mao Zedong'],
    2020: ['Queen Elizabeth II', 'Jane Goodall', 'David Attenborough', 'Bob Dylan', 'Buzz Aldrin', 'Malala Yousafzai', 'Serena Williams'],
  }
  for (const [year, want] of Object.entries(EXPECTED)) {
    const got = peopleAliveIn(Number(year)).map((p) => p.name)
    const missing = want.filter((n) => !got.includes(n))
    const extra = got.filter((n) => !want.includes(n))
    check(
      missing.length === 0 && extra.length === 0,
      `${year}: exactly the ${want.length} expected${missing.length ? ` — missing ${missing.join(', ')}` : ''}${extra.length ? ` — unexpected ${extra.join(', ')}` : ''}`,
    )
  }

  const COUNTS = { 1600: 7, 1789: 9, 1900: 14, 1969: 17, 2020: 7 }
  for (const [year, want] of Object.entries(COUNTS)) {
    const got = peopleAliveIn(Number(year)).length
    check(got === want, `${year}: ${got} alive, expected ${want}`)
  }

  // Sane, not total, not empty — the property that catches a filter that
  // silently degenerated into "everyone" or "nobody".
  for (const y of [1600, 1789, 1900, 1969, 2020]) {
    const n = peopleAliveIn(y).length
    if (n === 0 || n === PEOPLE.length) fail(`${y}: ${n} alive, which is all or nothing`)
  }
  ok('none of the five is empty and none is the whole record')

  // Sorted oldest first, every time, over the whole axis.
  let unsorted = 0
  for (let y = MIN_YEAR; y <= NOW; y += 7) {
    const a = peopleAliveIn(y)
    for (let i = 1; i < a.length; i++) if (a[i - 1].birth > a[i].birth) unsorted++
  }
  check(unsorted === 0, 'peopleAliveIn comes back oldest-first at every sampled year')
}

console.log('\nthe oldest and the youngest, worked out by hand')
{
  // 1600. The seven above; Elizabeth I is born 1533 (earliest) and Oliver
  // Cromwell 1599 (latest), so the ages are 67 and 1.
  const o = oldestAliveIn(1600)
  const y = youngestAliveIn(1600)
  check(o.person.name === 'Elizabeth I' && o.age === 67, `1600's oldest is Elizabeth I at 67 (got ${o.person.name} at ${o.age})`)
  check(y.person.name === 'Oliver Cromwell' && y.age === 1, `1600's youngest is Oliver Cromwell at 1 (got ${y.person.name} at ${y.age})`)

  const o2 = oldestAliveIn(1789)
  check(o2.person.name === 'Benjamin Franklin' && o2.age === 83, `1789's oldest is Benjamin Franklin at 83 (got ${o2.person.name} at ${o2.age})`)
  const y2 = youngestAliveIn(1789)
  check(y2.person.name === 'Simón Bolívar' && y2.age === 6, `1789's youngest is Simón Bolívar at 6 (got ${y2.person.name} at ${y2.age})`)

  const o4 = oldestAliveIn(1900)
  const y4 = youngestAliveIn(1900)
  check(o4.person.name === 'Florence Nightingale' && o4.age === 80, `1900's oldest is Florence Nightingale at 80 (got ${o4.person.name} at ${o4.age})`)
  check(y4.person.name === 'Mao Zedong' && y4.age === 7, `1900's youngest is Mao Zedong at 7 (got ${y4.person.name} at ${y4.age})`)

  const o3 = oldestAliveIn(1969)
  check(o3.person.name === 'Pablo Picasso' && o3.age === 88, `1969's oldest is Pablo Picasso at 88 (got ${o3.person.name} at ${o3.age})`)
  const y3 = youngestAliveIn(1969)
  check(y3.person.name === 'Diana, Princess of Wales' && y3.age === 8, `1969's youngest is Diana at 8 (got ${y3.person.name} at ${y3.age})`)

  check(oldestAliveIn(400) === null && youngestAliveIn(400) === null, 'AD 400 has nobody, and both ends come back null rather than throwing')

  // Whatever the year, the named oldest really is the earliest-born of the
  // people the roster shows, and the youngest the latest-born.
  let wrong = 0
  for (let year = MIN_YEAR; year <= NOW; year += 3) {
    const alive = peopleAliveIn(year)
    if (!alive.length) continue
    const old = oldestAliveIn(year)
    const young = youngestAliveIn(year)
    if (old.person.birth !== Math.min(...alive.map((p) => p.birth))) wrong++
    if (young.person.birth !== Math.max(...alive.map((p) => p.birth))) wrong++
    if (old.age !== yearsBetween(old.person.birth, year)) wrong++
    if (young.age > old.age) wrong++
  }
  check(wrong === 0, 'across the whole axis the named extremes really are the extremes, and the ages match yearsBetween')
}

console.log('\nthe roster the page actually renders')
{
  for (const year of [1600, 1789, 1900, 1969, 2020]) {
    const sections = rosterFor(year)
    const flat = sections.flatMap((s) => s.people)
    const alive = peopleAliveIn(year)
    const counts = countByCategory(year)
    const bad =
      flat.length !== alive.length ||
      sections.some((s) => s.people.some((p) => p.category !== s.key)) ||
      sections.some((s) => s.people.length !== counts[s.key]) ||
      sections.some((s) => s.people.length === 0) ||
      new Set(flat.map((p) => p.name)).size !== flat.length
    check(!bad, `${year}: the ${sections.length} sections hold all ${alive.length} of them, once each, in the right section`)
  }
  const total = Object.values(countByCategory(1900)).reduce((a, b) => a + b, 0)
  check(total === peopleAliveIn(1900).length, 'countByCategory sums back to the headline count')
  check(rosterFor(400).length === 0, 'a year with nobody produces no sections at all, not eleven empty ones')
}

/* ---- the holes ------------------------------------------------------------ */

console.log('\nthe holes in the record')
{
  const gaps = emptyStretches()
  check(gaps.length > 0, `${gaps.length} stretches in which nobody in the record was alive`)
  let bad = 0
  for (const g of gaps) {
    if (toAxis(g.from) > toAxis(g.to)) { fail(`a gap runs backwards: ${formatYear(g.from)} to ${formatYear(g.to)}`); bad++ }
    for (const y of [g.from, g.to, Math.round((toAxis(g.from) + toAxis(g.to)) / 2)]) {
      const probe = typeof y === 'number' ? fromAxis(toAxis(y)) : y
      if (peopleAliveIn(probe).length) { fail(`${formatYear(probe)} is inside a declared gap but has ${peopleAliveIn(probe).length} people`); bad++ }
    }
    if (peopleAliveIn(fromAxis(toAxis(g.from) - 1)).length === 0) { fail(`the year before a gap is also empty — the gap is not maximal`); bad++ }
    if (peopleAliveIn(fromAxis(toAxis(g.to) + 1)).length === 0) { fail(`the year after a gap is also empty — the gap is not maximal`); bad++ }
  }
  check(bad === 0, 'every declared gap is really empty, and really maximal')

  const biggest = gaps.reduce((a, b) => (toAxis(b.to) - toAxis(b.from) > toAxis(a.to) - toAxis(a.from) ? b : a))
  check(
    biggest.from === 15 && biggest.to === 741,
    `the longest hole runs AD 15 to AD 741 — Augustus to Charlemagne (got ${formatYear(biggest.from)} to ${formatYear(biggest.to)})`,
  )
  ok(`that is ${toAxis(biggest.to) - toAxis(biggest.from) + 1} years the page has to say it cannot speak for`)

  check(nearestPopulatedYear(1900) === 1900, 'a populated year is its own nearest populated year')
  const near = nearestPopulatedYear(400)
  check(peopleAliveIn(near).length > 0, `AD 400's nearest populated year is ${formatYear(near)}, and somebody is alive in it`)
  // AD 400 sits inside the seven-century hole, 386 years past Augustus dying
  // and 342 short of Charlemagne being born — so the nearer edge is forward,
  // not back, which is the answer a "walk backwards to the last one"
  // implementation would get wrong.
  check(near === 742, `and it is AD 742 — Charlemagne's birth is 342 years away, Augustus's death 386 (got ${formatYear(near)})`)
  check(nearestPopulatedYear(100) === 14, 'AD 100 resolves backwards instead, to Augustus in AD 14')
}

/* ---- the axis and the box you type into ----------------------------------- */

console.log('\nthe axis')
{
  check(clampYear(-9999, NOW) === MIN_YEAR, 'nothing goes below 700 BC')
  check(clampYear(99999, NOW) === NOW, 'nothing goes past this year')
  check(clampYear(1492.6, NOW) === 1493, 'a fractional year rounds to a whole one')
  check(MIN_YEAR < Math.min(...PEOPLE.map((p) => p.birth)), 'the axis starts before the earliest birth in the record')
  check(NOW >= Math.max(...PEOPLE.map((p) => p.death ?? p.birth)), 'and ends at or after the latest year in it')
}

console.log('\ntyping a year in')
{
  const cases = [
    ['1492', 1492], ['  1492  ', 1492], ['44 BC', -44], ['44bc', -44], ['44 BCE', -44],
    ['-44', -44], ['AD 800', 800], ['800 CE', 800], ['800ad', 800], ['1', 1], ['-700', -700],
    ['1,492', 1492],
  ]
  let bad = 0
  for (const [raw, want] of cases) {
    const got = parseYearInput(raw, NOW)
    if (got !== want) { fail(`parseYearInput("${raw}") = ${got}, expected ${want}`); bad++ }
  }
  check(bad === 0, `all ${cases.length} readable forms parse exactly`)

  const rejects = ['', '   ', 'abc', '0', '-0', '3000', '-800', '12.5', '19 99', 'AD -44', '-44 BC', '1492x', 'MCMXCII']
  let leaked = 0
  for (const r of rejects) {
    const got = parseYearInput(r, NOW)
    if (got !== null) { fail(`parseYearInput("${r}") = ${got}, expected null`); leaked++ }
  }
  check(leaked === 0, `all ${rejects.length} unreadable or impossible inputs come back null`)
  check(parseYearInput(String(NOW), NOW) === NOW, 'this year is accepted')
  check(parseYearInput(String(NOW + 1), NOW) === null, 'next year is not')
}

console.log(failures ? `\n${failures} failed.\n` : `\nAll who-was-alive checks passed — ${PEOPLE.length} people, ${CATEGORY_ORDER.length} categories.\n`)
process.exitCode = failures ? 1 : 0
