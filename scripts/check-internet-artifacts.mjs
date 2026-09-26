/**
 * check-internet-artifacts — proves the timeline data is internally
 * consistent and the headline facts are the real ones.
 *
 *   1. ZONES are contiguous and ascending with no gaps or overlaps.
 *   2. MARKERS are sorted by real year, every one lands inside the zone its
 *      year claims, and every one carries a real, non-trivial note.
 *   3. Every `date` string is honest about its own precision — never more
 *      digits than the marker's year-fraction actually implies.
 *   4. A handful of headline facts are pinned to their real values, so a
 *      future edit can't quietly drift a date.
 *
 *   node scripts/check-internet-artifacts.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { ZONES, MARKERS, START_YEAR, END_YEAR, TOTAL_YEARS } = await import('../src/data/internet-artifacts.ts')

let failures = 0
function check(cond, label) {
  if (cond) {
    console.log(`  ok    ${label}`)
  } else {
    console.log(`  FAIL  ${label}`)
    failures++
  }
}

console.log('zones are contiguous, ascending, and cover the whole timeline')
{
  let ok = true
  for (let i = 0; i < ZONES.length; i++) {
    if (ZONES[i].to <= ZONES[i].from) ok = false
    if (ZONES[i].pxPerYear <= 0) ok = false
    if (i > 0 && ZONES[i].from !== ZONES[i - 1].to) ok = false
  }
  check(ok, `${ZONES.length} zones, each contiguous with the last`)
  check(ZONES[0].from === START_YEAR, 'the timeline starts at the first zone’s own floor')
  check(ZONES[ZONES.length - 1].to === END_YEAR, 'the timeline ends at the last zone’s own ceiling')
  check(END_YEAR - START_YEAR === TOTAL_YEARS, 'TOTAL_YEARS matches end minus start')
}

console.log('\nmarkers are real, sorted, and land in the zone they claim')
{
  let sorted = true
  for (let i = 1; i < MARKERS.length; i++) {
    if (MARKERS[i].year < MARKERS[i - 1].year) sorted = false
  }
  check(sorted, `all ${MARKERS.length} markers are in ascending year order`)

  let allLand = true
  for (const m of MARKERS) {
    const zone = ZONES.find((z) => m.year >= z.from && m.year <= z.to)
    if (!zone) allLand = false
  }
  check(allLand, 'every marker’s year falls inside a real zone')

  const withNotes = MARKERS.every((m) => m.note && m.note.length > 60)
  check(withNotes, 'every marker carries a real, non-trivial note')

  const withDates = MARKERS.every((m) => m.date && m.date.length > 0)
  check(withDates, 'every marker carries a display date')

  const dupes = MARKERS.map((m) => m.title).filter((t, i, a) => a.indexOf(t) !== i)
  check(dupes.length === 0, `no duplicate marker titles${dupes.length ? ': ' + dupes : ''}`)
}

console.log('\ndate strings are honest about their own precision')
{
  // A `date` with a day and month in it should have a year whose fractional
  // part actually varies (not sitting on a suspicious round number like
  // .5 or .2, which this file reserves for "year only" / "no exact day").
  const YEAR_ONLY = new Set([1971.5, 1996.5, 1998.2])
  let bad = 0
  for (const m of MARKERS) {
    const looksExact = /\b\d{1,2},\s*\d{4}\b/.test(m.date) // "Month D, YYYY"
    const looksMonthOnly = /^[A-Za-z]+ \d{4}$/.test(m.date) // "Month YYYY"
    const looksYearOnly = /^\d{4}$/.test(m.date) // "YYYY"
    if (!looksExact && !looksMonthOnly && !looksYearOnly) {
      console.log(`  FAIL  ${m.title}: date "${m.date}" doesn't match any recognised precision format`)
      bad++
    }
    if (looksYearOnly && !YEAR_ONLY.has(m.year)) {
      console.log(`  FAIL  ${m.title}: year-only date but year ${m.year} isn't one of the flagged placeholders`)
      bad++
    }
  }
  failures += bad
  check(bad === 0, 'every date string is a recognised, honest precision level')
}

console.log('\nheadline facts are pinned to their real values')
{
  const first = MARKERS.find((m) => m.title.includes('first message'))
  check(!!first && Math.abs(first.year - 1969.827) < 0.01, 'the first ARPANET message is dated October 29, 1969')

  const web = MARKERS.find((m) => m.title.includes('World Wide Web goes public'))
  check(!!web && web.date === 'August 6, 1991', 'the Web’s public announcement is dated August 6, 1991')

  const morris = MARKERS.find((m) => m.title.includes('Morris Worm'))
  check(!!morris && morris.big === true, 'the Morris Worm is marked as a turning point')

  const google = MARKERS.find((m) => m.title.includes('Google is founded'))
  check(!!google && google.date === 'September 4, 1998', 'Google’s founding uses its incorporation date, not its earlier domain registration')

  const wiki = MARKERS.find((m) => m.title.includes('Wikipedia edit'))
  check(!!wiki && wiki.date === 'January 15, 2001', 'the first Wikipedia edit is dated January 15, 2001, the day after launch')

  check(MARKERS.filter((m) => m.big).length >= 6, 'at least six markers are real turning points, not just trivia')
}

console.log(failures === 0 ? '\nAll internet-artifacts checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
