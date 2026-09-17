/**
 * check-printing-money — holds the arithmetic to account, not the salaries.
 *
 * The annual figures on this page are honestly soft (see the note on each
 * tier) and no checker can grade whether $69,544 is the right number for a
 * teacher — but the maths built on top of whatever number is there can be
 * proven: derivation, ordering, bill counts, the comparison ladder, the
 * formatter, and the custom-wage parser.
 *
 *   node scripts/check-printing-money.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

const {
  TIERS, dollarsPerHour, earnedSince, BILL_LENGTH_M, BILL_HEIGHT_M, billCount,
  billStripLengthM, LITERAL_RENDER_MAX_BILLS, LENGTH_LADDER, nearestComparison,
  describeComparison, formatMoney, parseWage, withCustomWage, WORK_YEAR_HOURS, CONTINUOUS_YEAR_HOURS,
} = await import('../src/lib/printing-money.ts')

let failures = 0
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`) }
const ok = (m) => console.log(`  ok    ${m}`)
const check = (c, m) => (c ? ok(m) : fail(m))
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

/* ---- data integrity --------------------------------------------------- */

console.log('data')
{
  const ids = TIERS.map((t) => t.id)
  check(new Set(ids).size === ids.length, 'every tier id is unique')
  check(TIERS.every((t) => t.annual > 0), 'every tier has a positive annual figure')
  check(TIERS.every((t) => t.hoursPerYear === WORK_YEAR_HOURS || t.hoursPerYear === CONTINUOUS_YEAR_HOURS),
    'every tier is on a real work-year (2,080h) or continuous year (8,760h)')
  const rates = TIERS.map(dollarsPerHour)
  const sorted = rates.every((r, i) => i === 0 || rates[i - 1] < r)
  check(sorted, 'the nine tiers are listed in strictly ascending $/hr order')
  check(TIERS.every((t) => t.note && t.note.length > 10), 'every tier documents what its figure is derived from')
  ok(`${TIERS.length} tiers, $${dollarsPerHour(TIERS[0]).toFixed(2)}/hr to $${Math.round(dollarsPerHour(TIERS.at(-1))).toLocaleString('en-US')}/hr`)
}

/* ---- derivation, not duplication ---------------------------------------- */

console.log('\nderivation')
{
  const minWage = TIERS.find((t) => t.id === 'min-wage')
  check(close(dollarsPerHour(minWage), 7.25), `minimum wage derives to exactly $7.25/hr (got $${dollarsPerHour(minWage).toFixed(4)})`)
  // Changing a tier's annual figure has to move its hourly rate — proving
  // dollarsPerHour is computed from `annual`/`hoursPerYear` and not a
  // separately-typed number that could silently disagree with them.
  const probe = { annual: 208_000, hoursPerYear: WORK_YEAR_HOURS }
  check(close(dollarsPerHour(probe), 100), 'dollarsPerHour(annual=208,000, 2,080h) = $100/hr exactly')
  const probe2 = { annual: 87_600, hoursPerYear: CONTINUOUS_YEAR_HOURS }
  check(close(dollarsPerHour(probe2), 10), 'dollarsPerHour(annual=87,600, 8,760h) = $10/hr exactly')
}

/* ---- earning over time --------------------------------------------------- */

console.log('\nearning over time')
{
  const minWage = TIERS.find((t) => t.id === 'min-wage')
  check(earnedSince(minWage, 0) === 0, 'nobody has earned anything at zero seconds')
  check(close(earnedSince(minWage, 3600), 7.25), 'minimum wage earns exactly $7.25 in one real hour')
  check(close(earnedSince(minWage, 7200), 14.5), 'and exactly double that in two hours — linear, not compounding')
  const spending = TIERS.find((t) => t.id === 'spending')
  check(earnedSince(spending, 1) > 100_000, 'the federal government spends over $100,000 in a single second')
}

/* ---- bills, and their real length ---------------------------------------- */

console.log('\nbills')
{
  check(close(BILL_LENGTH_M, 0.155956, 1e-4), `a $1 bill is really 6.14 inches long (${BILL_LENGTH_M.toFixed(4)}m)`)
  check(BILL_HEIGHT_M < BILL_LENGTH_M, 'the bill is wider than it is tall')
  check(billCount(0) === 0, 'zero dollars is zero bills')
  check(billCount(0.4) === 0, '40 cents rounds down to zero bills')
  check(billCount(0.5) === 1, 'fifty cents rounds up to one bill')
  check(billCount(7.25) === 7, '$7.25 is 7 bills, not 7.25 of one')
  check(billCount(-5) === 0, 'a negative amount is never a negative bill count')
  check(close(billStripLengthM(1), BILL_LENGTH_M), 'one bill is one bill-length long')
  check(close(billStripLengthM(100), 100 * BILL_LENGTH_M), 'a hundred bills is a hundred bill-lengths, exactly linear')

  const literal = TIERS.filter((t) => billCount(dollarsPerHour(t)) <= LITERAL_RENDER_MAX_BILLS)
  const compared = TIERS.filter((t) => billCount(dollarsPerHour(t)) > LITERAL_RENDER_MAX_BILLS)
  check(literal.length > 0 && compared.length > 0, `${literal.length} tiers render literally, ${compared.length} get a comparison instead — both groups exist`)
}

/* ---- the comparison ladder ------------------------------------------------ */

console.log('\nthe comparison ladder')
{
  const metresList = LENGTH_LADDER.map((r) => r.metres)
  check(new Set(metresList).size === metresList.length, 'no two rungs claim the same distance')
  check(LENGTH_LADDER.every((r) => r.metres > 0), 'every rung is a positive real distance')

  const belowBottom = nearestComparison(1)
  check(belowBottom.kind === 'fraction' && belowBottom.fraction < 1, 'a length shorter than the shortest rung is a fraction of it')

  const c1 = nearestComparison(2000)
  check(c1.kind === 'fraction' && close(c1.fraction, 0.5), `1,000m into a 4,000m rung reads as 50% (got ${(c1.fraction * 100).toFixed(1)}%)`)

  const top = [...LENGTH_LADDER].sort((a, b) => a.metres - b.metres).at(-1)
  const c2 = nearestComparison(top.metres * 2.5)
  check(c2.kind === 'multiple' && close(c2.multiple, 2.5), `past the top rung, it is a multiple of it (got ${c2.multiple.toFixed(2)}x)`)

  const c3 = nearestComparison(top.metres)
  check(c3.kind === 'fraction' && close(c3.fraction, 1), 'exactly at the top rung reads as a fraction (100%), not a multiple')
}

console.log('\ndescribing a comparison, in one sentence, for every rung')
{
  // Every rung label has to read correctly after a bare "of" or "x" —
  // "the distance to the Moon" broke the old "of the way across X" template
  // ("...across the distance to the Moon" is not a sentence), which is the
  // reason this is one shared function rather than the same string built
  // twice on the page.
  let bad = 0
  for (const rung of LENGTH_LADDER) {
    for (const c of [{ kind: 'fraction', rung, fraction: 0.412 }, { kind: 'multiple', rung, multiple: 2.5 }]) {
      const s = describeComparison(c)
      if (!/^That's (\d+(\.\d+)?%|[\d.]+x) /.test(s)) { fail(`describeComparison malformed: "${s}"`); bad++ }
      if (!s.endsWith(`${rung.label}.`)) { fail(`describeComparison doesn't end with the rung's own label: "${s}"`); bad++ }
    }
  }
  check(bad === 0, `every one of ${LENGTH_LADDER.length} rungs reads as a real sentence in both directions`)
  check(describeComparison({ kind: 'fraction', rung: { label: 'a marathon', metres: 1 }, fraction: 0.412 }) === "That's 41.2% of a marathon.",
    'a known fraction renders exactly')
  check(describeComparison({ kind: 'multiple', rung: { label: 'the distance to the Moon', metres: 1 }, multiple: 2.5 }) === "That's 2.50x the distance to the Moon.",
    'a known multiple renders exactly')
}

/* ---- formatting ------------------------------------------------------------ */

console.log('\nformatMoney')
{
  const cases = [
    [0.4, '40¢'], [0.5, '50¢'], [1, '$1.00'], [7.25, '$7.25'],
    [999, '$999.00'], [1000, '$1,000'], [999_999, '$999,999'],
    [1_000_000, '$1.00 million'], [2_500_000, '$2.50 million'],
    [999_999_999, '$1.00 billion'], [1_000_000_000, '$1.00 billion'],
    [1_850_000_000_000, '$1.85 trillion'], [-5, '-$5.00'],
  ]
  let bad = 0
  for (const [n, want] of cases) {
    const got = formatMoney(n)
    if (got !== want) { fail(`formatMoney(${n}) = "${got}", expected "${want}"`); bad++ }
  }
  check(bad === 0, `all ${cases.length} formatting cases match exactly`)
}

/* ---- the custom wage ---------------------------------------------------------- */

console.log('\nyour own wage')
{
  check(parseWage('') === null, 'an empty box parses to nothing')
  check(parseWage('abc') === null, 'text that is not a number parses to nothing')
  check(parseWage('0') === null, 'zero is rejected — nobody earns nothing an hour on this page')
  check(parseWage('-12') === null, 'a negative wage is rejected')
  check(parseWage('Infinity') === null, 'Infinity is rejected — it is not a real rate')
  check(parseWage('45.5') === 45.5, 'a plain decimal parses exactly')

  const withYou = withCustomWage(50)
  check(withYou.length === TIERS.length + 1, 'adding a custom wage adds exactly one tier')
  const rates = withYou.map(dollarsPerHour)
  const sorted = rates.every((r, i) => i === 0 || rates[i - 1] <= r)
  check(sorted, 'the inserted wage keeps the whole list sorted')
  const you = withYou.find((t) => t.id === 'you')
  check(close(dollarsPerHour(you), 50), 'the inserted tier really is $50/hr, not rounded or rescaled')

  const extreme = withCustomWage(1_000_000_000)
  check(dollarsPerHour(extreme.at(-1)) === dollarsPerHour(extreme.find((t) => t.id === 'you')),
    'an absurdly large custom wage still sorts to the top without throwing')
}

console.log(failures ? `\n${failures} failed.` : '\nAll printing-money checks passed.')
process.exitCode = failures ? 1 : 0
