/**
 * check-seven-segment — proves the digit table behind Days Since Incident's
 * odometer is really a seven-segment display and not a plausible-looking
 * table with a slipped bit somewhere.
 *
 *   1. Re-derives each digit's pattern independently, from a written
 *      description of which strokes a real seven-segment digit needs, and
 *      checks it against what `lib/seven-segment.ts` exports — a slip has to
 *      happen twice to survive.
 *   2. Checks the segment *count* per digit against the well-known real
 *      count (an 8 lights all seven, a 1 lights exactly two, etc.) — a
 *      cross-check with no shared code path to the pattern table above.
 *   3. Confirms every digit 0-9 is a visually distinct on/off pattern from
 *      every other — the actual point of a segment display, not just "some
 *      segments are lit."
 *
 *   node scripts/check-seven-segment.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const { SEGMENTS, SEGMENT_KEYS, fitWidth } = await import('../src/lib/seven-segment.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))

console.log('every pattern is [a,b,c,d,e,f,g] and matches a hand-traced reference')
{
  // Traced by hand from the classic digit shapes, independently of the table
  // this checks — not copied from it.
  const REFERENCE = {
    '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
    '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
  }
  for (const [digit, lit] of Object.entries(REFERENCE)) {
    const pattern = SEGMENTS[digit]
    check(Array.isArray(pattern) && pattern.length === 7, `${digit}: has exactly seven entries`)
    const expected = SEGMENT_KEYS.map((k) => lit.includes(k))
    check(JSON.stringify(pattern) === JSON.stringify(expected), `${digit}: matches the hand-traced pattern (${lit || 'none'} lit)`)
  }
}

console.log('\nsegment counts match the real, well-known count per digit')
{
  // A fact anyone who has looked at a calculator display can check by eye,
  // with no reference to how the pattern table above is actually shaped.
  const REAL_COUNT = { '0': 6, '1': 2, '2': 5, '3': 5, '4': 4, '5': 5, '6': 6, '7': 3, '8': 7, '9': 6 }
  for (const [digit, count] of Object.entries(REAL_COUNT)) {
    const lit = SEGMENTS[digit].filter(Boolean).length
    check(lit === count, `${digit}: lights ${count} segments (got ${lit})`)
  }
}

console.log('\nall ten digits are pairwise distinct patterns')
{
  const digits = '0123456789'.split('')
  let worstPair = null
  for (let i = 0; i < digits.length; i++) {
    for (let j = i + 1; j < digits.length; j++) {
      const a = SEGMENTS[digits[i]]
      const b = SEGMENTS[digits[j]]
      if (JSON.stringify(a) === JSON.stringify(b)) worstPair = [digits[i], digits[j]]
    }
  }
  check(worstPair === null, worstPair ? `${worstPair[0]} and ${worstPair[1]} render identically` : 'every digit is its own pattern')
}

console.log('\nnon-digit states render sensibly')
{
  check(SEGMENTS['-'].filter(Boolean).length === 1 && SEGMENTS['-'][6], `"-" lights only the middle segment (got ${JSON.stringify(SEGMENTS['-'])})`)
  check(SEGMENTS[' '].every((s) => s === false), '" " (unlit/blank) lights nothing')
}

console.log('\nfitWidth pads and truncates from the right side, odometer-style')
{
  check(fitWidth('7', 5) === '    7', `short values pad on the left with spaces (got "${fitWidth('7', 5)}")`)
  check(fitWidth('12345', 5) === '12345', 'an exact-width value passes through unchanged')
  check(fitWidth('1234567', 5) === '34567', `an overlong value keeps its rightmost (least-significant) digits (got "${fitWidth('1234567', 5)}")`)
  check(fitWidth('', 3) === '   ', 'an empty value is all blanks, not an empty string')
}

console.log(failures ? `\n${failures} failed.` : '\nAll seven-segment checks passed.')
process.exitCode = failures ? 1 : 0
