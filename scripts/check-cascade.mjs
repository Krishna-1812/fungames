/**
 * Proves Rule Cascade can still be finished.
 *
 * Thirty rules, and several of them fight: the digits must add to exactly 25
 * while also containing a leap year, a chess square, the current hour and the
 * number of rules on screen; the length must be prime; the vowel count must be
 * prime; the Roman numerals must multiply to 50; and at rule 25 the game takes
 * a letter of the alphabet away from you permanently.
 *
 * Nobody can check that by hand, and an unsolvable form is the worst possible
 * bug for this game — it would look exactly like a hard game. So this builds an
 * actual solution: a constructed core that satisfies the word rules, then solves
 * the arithmetic for the pad directly. It does that for every hour of the day and
 * for every letter the sacrifice could take.
 *
 *   node scripts/check-cascade.mjs [--verbose]
 */
import {
  RULES, MONTHS, GREEK, SINS, COLOURS, PLANETS, SHAPES, NUMBER_WORDS,
  APOLOGIES, NOBLE_GASES, COUNTRY_CODES, chars, hour24, digitSum, vowelCount, isPrime,
} from '../src/lib/cascade-rules.ts'

const VERBOSE = process.argv.includes('--verbose')

const hasRoman = (w) => /[IVXLCDM]/.test(w)

/**
 * The part of the answer that satisfies every "must contain a ..." rule.
 *
 * Words are chosen lowercase and free of Roman-numeral letters so the product
 * rule is decided entirely by one deliberate numeral at the end — otherwise a
 * capital M in "March" quietly multiplies your total by a thousand.
 */
function core(hour, banned, count = RULES.length) {
  const free = (w) => !banned || !w.toLowerCase().includes(banned)
  // A word with a double letter in it — sorry, green, gluttony — can never
  // satisfy rule 18, and no amount of padding afterwards will rescue it.
  const single = (w) => !/(.)\1/i.test(w)
  const pick = (list, extra = () => true) => {
    const w = list.find((x) => free(x) && single(x) && extra(x))
    if (!w) throw new Error(`no option left in list once "${banned}" was banned`)
    return w
  }

  const parts = [
    pick(MONTHS), pick(GREEK), pick(SINS), pick(COLOURS),
    pick(PLANETS), pick(SHAPES), pick(NUMBER_WORDS), pick(APOLOGIES),
    pick(NOBLE_GASES, (w) => !hasRoman(w)),   // also the chemical element
    pick(COUNTRY_CODES, (w) => !hasRoman(w)), // also the uppercase letter
  ]

  // 50 outright, or 10 x 5 when the sacrifice takes the L.
  parts.push(banned === 'l' ? 'XV' : 'L')
  // A chess square: any free file, and a rank that keeps the digit sum low.
  parts.push(pick('abcdefgh'.split('')) + '1')
  // 2000 is a leap year, sums to only 2, and contains "000" — which is also
  // the palindrome rule, for free.
  parts.push('2000')
  parts.push(String(count))   // rule 23, which moves every time you satisfy it
  parts.push(hour24(hour))
  parts.push('🕷')            // the emoji, and the answer to the moth

  return parts.join('-')
}

const ctxFor = (hour, banned, count = RULES.length) => ({ hour, unlocked: count, banned })

const score = (s, ctx) => RULES.reduce((n, r) => n + (r.ok(s, ctx) ? 1 : 0), 0)

/** `count` digits that add up to `total`, or null if that is impossible. */
function digitsSumming(total, count) {
  if (total < 0 || total > 9 * count) return null
  const out = []
  let left = total
  for (let i = 0; i < count; i++) {
    const take = Math.min(9, left - 0 * (count - i - 1))
    out.push(take)
    left -= take
  }
  return left === 0 ? out : null
}

/** Lay `v` vowels among the digits so that no two of them end up adjacent. */
function weave(digits, v, vowel) {
  if (v > digits.length + 1) return null
  const out = []
  for (let i = 0; i < Math.max(digits.length, v); i++) {
    if (i < v) out.push(vowel)
    if (i < digits.length) out.push(String(digits[i]))
  }
  return out.join('')
}

/**
 * Build the pad that lands the arithmetic, rather than searching for it.
 *
 * Four constraints are coupled through the same characters — the digits must add
 * to exactly 25, there must be an even number of them, the whole thing must be a
 * prime number of characters long, and it must contain a prime number of vowels.
 * Random single-character edits move all four at once, which is why a hill-climb
 * stalls on this; solving for the counts directly does not.
 */
function solve(hour, banned, count = RULES.length) {
  const ctx = ctxFor(hour, banned, count)
  const base = core(hour, banned, count) + '-'
  const vowel = 'aeiou'.split('').find((x) => x !== banned)

  const S0 = digitSum(base)
  const D0 = (base.match(/\d/g) || []).length
  const L0 = chars(base).length
  const V0 = vowelCount(base)
  const need = 25 - S0
  if (need < 0) return null

  for (let c = need > 0 ? 1 : 0; c <= 40; c++) {
    if ((D0 + c) % 2 !== 0) continue
    const digits = digitsSumming(need, c)
    if (!digits) continue
    for (let v = 0; v <= 20; v++) {
      if (!isPrime(V0 + v)) continue
      const pad = weave(digits, v, vowel)
      if (pad === null) continue
      /* Length needs a third, independent lever. The digit count is pinned by
         the sum and the even-digits rule, and the vowel count is pinned by the
         prime-vowels rule — and when those two land on the same parity as the
         core, the total length is always even and can never be prime. A
         hyphen is neither a letter, a digit nor a vowel, so it moves the length
         and nothing else. */
      for (let f = 0; f <= 12; f++) {
        if (!isPrime(L0 + c + v + f)) continue
        const s = base + pad + '-'.repeat(f)
        if (score(s, ctx) === RULES.length) return s
      }
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */

/* The solver, asked for one concrete answer instead of a verdict.
 *
 * Proving a solution exists for every hour and every sacrifice is not the same
 * as anyone having seen the ending. This flag hands over an actual username, so
 * the last screen can be reached and looked at:
 *
 *   node scripts/check-cascade.mjs --answer [hour] [sacrificed letter]
 *
 * The hour and the letter come from the running game, which picks the letter
 * itself. There is no single final answer, because rule 23 asks for the number
 * of rules on screen and satisfying it puts another one there: the game is a
 * ladder from 23 up to 30, and this prints every rung.
 */
if (process.argv.includes('--answer')) {
  const rest = process.argv.slice(process.argv.indexOf('--answer') + 1)
  const hour = rest[0] === undefined ? new Date().getHours() : Number(rest[0])
  const banned = rest[1] && rest[1] !== '-' ? rest[1] : null
  for (let n = 23; n <= RULES.length; n++) {
    const answer = solve(hour, banned, n)
    if (!answer) {
      console.error(`no solution at ${n} rules, hour ${hour}, ${banned ?? 'nothing'} taken`)
      process.exit(1)
    }
    console.log(`${n}\t${answer}`)
  }
  process.exit(0)
}

let failures = 0
const report = (label, ok, extra = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`)
}

console.log(`\n${RULES.length} rules\n`)

console.log('rule ids are unique and in order')
const ids = RULES.map((r) => r.id)
report('ids', ids.every((v, i) => v === i + 1), `1..${RULES.length}`)
report('every rule has text', RULES.every((r) => r.text(ctxFor(13, 'q')).length > 10))

/* --- solvable at every hour ---------------------------------------------- */

console.log('\nsolvable at every hour of the day, with nothing sacrificed')
let worstHour = null
for (let h = 0; h < 24; h++) {
  const s = solve(h, null)
  if (!s) {
    worstHour = h
    report(`${hour24(h)}:00`, false, 'no solution found')
  } else if (VERBOSE) {
    console.log(`  ok   ${hour24(h)}:00  ${s}`)
  }
}
if (worstHour === null) report('all 24 hours', true)

/* --- solvable whatever the sacrifice takes -------------------------------- */

console.log('\nsolvable after the sacrifice, for every letter it could take')
const lost = []
for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
  let ok = false
  try {
    const s = solve(13, letter)
    ok = !!s
    if (ok && VERBOSE) console.log(`  ok   without "${letter}"  ${s}`)
  } catch (e) {
    ok = false
    if (VERBOSE) console.log(`  FAIL without "${letter}": ${e.message}`)
  }
  if (!ok) lost.push(letter)
}
report(
  'all 26 letters',
  lost.length === 0,
  lost.length ? `unsolvable without: ${lost.join(', ')}` : '',
)

/* --- every rung of the ladder, not just the top -------------------------- */

/*
 * Rule 23 asks for the number of rules on screen, so satisfying it unlocks
 * another one and immediately makes it wrong again. The player has to climb
 * from 23 to 30 one rung at a time, re-balancing the digit sum, the digit
 * count, the length and the vowel count at every step. Proving only the final
 * state is solvable would prove nothing: a single impossible rung in the middle
 * makes the game unwinnable, and it would look exactly like being stuck.
 */
console.log('\nevery rung of the count ladder is solvable')
const stuck = []
for (let count = 23; count <= RULES.length; count++) {
  for (const [h, banned] of [[13, null], [0, null], [19, 'e'], [7, 'a']]) {
    if (!solve(h, banned, count)) stuck.push(`${count}@${hour24(h)}${banned ? '/-' + banned : ''}`)
  }
}
report(
  `rungs 23 to ${RULES.length}`,
  stuck.length === 0,
  stuck.length ? `stuck at: ${stuck.join(', ')}` : '',
)

/* --- and both at once ----------------------------------------------------- */

console.log('\nsolvable with a sacrifice at an awkward hour')
for (const [h, letter] of [[0, 'e'], [11, 'a'], [22, 'o'], [19, 'l'], [7, 'r'], [23, 's']]) {
  const s = solve(h, letter)
  report(`${hour24(h)}:00 without "${letter}"`, !!s, s ? `${chars(s).length} chars` : '')
}

/* --- the specific traps that make this fragile ---------------------------- */

console.log('\nthe traps')

// Hours 00, 11 and 22 repeat a digit. A no-repeats rule counting characters
// rather than letters would make the game unsolvable for three hours a day.
const doubled = RULES.find((r) => r.id === 18)
report(
  'a repeated digit is allowed, so 00:00 is playable',
  doubled.ok('aB00cd', ctxFor(0, null)) === true,
)
report('a repeated letter is still caught', doubled.ok('aabc', ctxFor(0, null)) === false)
report('and case does not launder it', doubled.ok('aAbc', ctxFor(0, null)) === false)

// The Roman product is a global constraint, so a stray capital anywhere breaks
// it. This is the trap that makes "March" unusable.
const product = RULES.find((r) => r.id === 7)
report('L alone multiplies to 50', product.ok('L', ctxFor(0, null)) === true)
report('X and V multiply to 50', product.ok('XV', ctxFor(0, null)) === true)
report('a capital M in "March" ruins it', product.ok('MarchL', ctxFor(0, null)) === false)

// Every word rule must survive losing any single letter, or the sacrifice can
// make the game impossible.
console.log('\nno word rule hangs on a single irreplaceable word')
const LISTS = {
  months: MONTHS, greek: GREEK, sins: SINS, colours: COLOURS, planets: PLANETS,
  shapes: SHAPES, numbers: NUMBER_WORDS, apologies: APOLOGIES,
  'noble gases': NOBLE_GASES.filter((w) => !hasRoman(w)),
  'country codes': COUNTRY_CODES.filter((w) => !hasRoman(w)),
}
for (const [name, list] of Object.entries(LISTS)) {
  const dead = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(
    (l) => !list.some((w) => !w.toLowerCase().includes(l)),
  )
  report(
    `${name} (${list.length})`,
    dead.length === 0,
    dead.length ? `wiped out by: ${dead.join(', ')}` : '',
  )
}

/* --- the live rules ------------------------------------------------------- */

console.log('\nthe three rules that do something')
const moth = RULES.find((r) => r.id === 24)
report('the moth is answered by a spider', moth.ok('a🕷b', ctxFor(0, null)) === true)
report('and not by anything else', moth.ok('a🦋b', ctxFor(0, null)) === false)

const sacrifice = RULES.find((r) => r.id === 25)
report('the sacrifice is inert before it fires', sacrifice.ok('aaa', ctxFor(0, null)) === true)
report('and absolute afterwards', sacrifice.ok('abc', ctxFor(0, 'b')) === false)
report('including capitals', sacrifice.ok('aBc', ctxFor(0, 'b')) === false)

const count = RULES.find((r) => r.id === 23)
report('the count rule tracks the rules on screen', count.ok('x23y', { hour: 0, unlocked: 23, banned: null }) === true)
report('and moves when another one arrives', count.ok('x23y', { hour: 0, unlocked: 24, banned: null }) === false)

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
