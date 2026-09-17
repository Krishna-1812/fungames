/**
 * Printing Money — nine real rates of earning, from federal minimum wage to
 * the US government's own hourly rate of spending, all reduced to the same
 * question: how many one-dollar bills is that, laid end to end?
 *
 * Every tier stores an annual figure and the number of hours a year it
 * actually applies to — a person's 2,080-hour work-year, or a continuous
 * institution's real 8,760-hour year — and `dollarsPerHour` is *derived*
 * from those two rather than typed in separately, the same discipline Paper
 * Folds' fold limit and Space Elevator's live temperature use: two numbers
 * that have to agree are a bug waiting to happen, one number computed from
 * its real inputs cannot drift out of step with them.
 *
 * The annual figures themselves are honestly soft — average salaries and
 * government outlays move every year — so every tier carries a `note`
 * saying exactly what was divided by what, the same hedge Auction puts on
 * its own soft estimates. `scripts/check-printing-money.mjs` does not (and
 * cannot) grade whether $69,544 is the right number for a teacher's salary;
 * it grades the arithmetic built on top of whatever number is there.
 */

export type Tier = {
  id: string
  label: string
  /** The annual figure the rate is derived from, in dollars. */
  annual: number
  /** How many hours a year this figure actually spans: 2,080 for a person's
   *  standard full-time work-year, 8,760 for a continuous institution. */
  hoursPerYear: 2080 | 8760
  note: string
}

export const WORK_YEAR_HOURS = 2080
export const CONTINUOUS_YEAR_HOURS = 8760

export const TIERS: Tier[] = [
  {
    id: 'min-wage',
    label: 'Federal minimum wage',
    annual: 7.25 * WORK_YEAR_HOURS,
    hoursPerYear: WORK_YEAR_HOURS,
    note: '$7.25/hr, the US federal minimum wage — unchanged since July 2009.',
  },
  {
    id: 'median-worker',
    label: 'The median US worker',
    annual: 48_060,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'Approximate. The median annual wage across the whole US workforce, per the Bureau of Labor Statistics, over a standard 2,080-hour work-year.',
  },
  {
    id: 'teacher',
    label: 'A public school teacher',
    annual: 69_544,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'Approximate average public school teacher salary (National Education Association), over a standard 2,080-hour work-year — most teachers work well beyond it unpaid.',
  },
  {
    id: 'engineer',
    label: 'A software engineer',
    annual: 124_200,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'Approximate median US software engineer salary, over a standard 2,080-hour work-year.',
  },
  {
    id: 'physician',
    label: 'A physician',
    annual: 260_000,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'Approximate average US physician compensation across specialties, over a standard 2,080-hour work-year.',
  },
  {
    id: 'ceo',
    label: 'A Fortune 500 CEO',
    annual: 16_000_000,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'Approximate median total compensation for a Fortune 500 CEO, over the same 2,080-hour work-year everyone else on this page gets — the hours are not actually comparable, and that is rather the point.',
  },
  {
    id: 'nasa',
    label: "NASA's entire budget",
    annual: 25_000_000_000,
    hoursPerYear: CONTINUOUS_YEAR_HOURS,
    note: "Approximate recent NASA annual budget, spread over a continuous 8,760-hour year — the agency doesn't clock off.",
  },
  {
    id: 'deficit',
    label: 'The US federal deficit, growing',
    annual: 1_850_000_000_000,
    hoursPerYear: CONTINUOUS_YEAR_HOURS,
    note: 'Approximate recent annual US federal deficit (spending minus revenue), spread over a continuous 8,760-hour year.',
  },
  {
    id: 'spending',
    label: 'The US federal government, spending',
    annual: 6_750_000_000_000,
    hoursPerYear: CONTINUOUS_YEAR_HOURS,
    note: 'Approximate recent total annual US federal outlays, spread over a continuous 8,760-hour year.',
  },
]

export function dollarsPerHour(t: Tier): number {
  return t.annual / t.hoursPerYear
}

export function earnedSince(t: Tier, seconds: number): number {
  return (dollarsPerHour(t) / 3600) * seconds
}

/** A real US $1 bill: 6.14 x 2.61 inches, per the Bureau of Engraving and
 *  Printing's spec for all US currency since 1928. */
export const BILL_LENGTH_M = 6.14 * 0.0254
export const BILL_HEIGHT_M = 2.61 * 0.0254

/** How many $1 bills a dollar amount is. Rounds to the nearest whole bill —
 *  there is no such thing as 0.4 of a bill. */
export function billCount(dollars: number): number {
  return Math.max(0, Math.round(dollars))
}

export function billStripLengthM(count: number): number {
  return count * BILL_LENGTH_M
}

/** Above this many bills, laying them out edge to edge on the page stops
 *  being a picture and starts being a several-kilometre scrollbar. Every
 *  tier under the line gets the real strip; every tier over it gets a
 *  comparison instead. */
export const LITERAL_RENDER_MAX_BILLS = 500

/** Real, named distances, ascending — the ladder a too-long strip is
 *  measured against instead of being drawn. */
export type LadderRung = { label: string; metres: number }

export const LENGTH_LADDER: LadderRung[] = [
  { label: 'a city block', metres: 100 },
  { label: 'Central Park, end to end', metres: 4_000 },
  { label: 'a marathon', metres: 42_195 },
  { label: 'the length of Manhattan Island', metres: 21_000 },
  { label: 'a drive from Boston to Washington, DC', metres: 640_000 },
  { label: 'a drive from New York to Los Angeles', metres: 3_940_000 },
  { label: "the Earth's circumference", metres: 40_075_000 },
  { label: 'the distance to the Moon', metres: 384_400_000 },
]

function sortedLadder(): LadderRung[] {
  return [...LENGTH_LADDER].sort((a, b) => a.metres - b.metres)
}

export type Comparison =
  | { kind: 'fraction'; rung: LadderRung; fraction: number }
  | { kind: 'multiple'; rung: LadderRung; multiple: number }

/**
 * Where a length sits against the ladder. If it hasn't reached the next
 * rung up yet, that is expressed as a fraction of it ("62% of the way
 * across Manhattan Island"); past the top of the ladder, as a multiple of
 * the biggest rung there is ("1.3x the distance to the Moon") — the same
 * two-sided shape Paper Folds' own scale ladder uses.
 */
export function nearestComparison(metres: number): Comparison {
  const ladder = sortedLadder()
  const above = ladder.find((r) => r.metres >= metres)
  if (above) return { kind: 'fraction', rung: above, fraction: metres / above.metres }
  const top = ladder[ladder.length - 1]
  return { kind: 'multiple', rung: top, multiple: metres / top.metres }
}

/** One sentence, in plain English, for either shape of comparison — kept
 *  here rather than duplicated in the page's own template strings, since
 *  every rung label ("the distance to the Moon", "a marathon", "Central
 *  Park, end to end") already reads correctly after a bare "of" or "x", and
 *  the two places on the page that render a comparison should not risk
 *  drifting into two different phrasings of the same fact. */
export function describeComparison(c: Comparison): string {
  return c.kind === 'fraction'
    ? `That's ${(c.fraction * 100).toFixed(1)}% of ${c.rung.label}.`
    : `That's ${c.multiple.toFixed(2)}x ${c.rung.label}.`
}

/** Largest-unit-first would round 999,999,999 to "1,000.00 million" instead
 *  of promoting to "1.00 billion" — checked for explicitly below by walking
 *  smallest-to-largest and taking the first unit whose rounded value stays
 *  under 1,000. */
const MONEY_UNITS: [number, string][] = [[1e6, 'million'], [1e9, 'billion'], [1e12, 'trillion']]

/** Real formatting for anything from a few cents to trillions of dollars. */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const v = Math.abs(n)
  if (v < 1) return `${sign}${Math.round(v * 100)}¢`
  if (v < 1000) return `${sign}$${v.toFixed(2)}`
  if (v < 1_000_000) return `${sign}$${Math.round(v).toLocaleString('en-US')}`
  const [div, suffix] = MONEY_UNITS.find(([d]) => v / d < 999.995) ?? MONEY_UNITS.at(-1)!
  const scaled = v / div
  return `${sign}$${scaled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`
}

/** A custom hourly wage, typed in. Rejects anything that isn't a real,
 *  positive, finite rate — an empty box, a negative number meant as a joke,
 *  or a pasted string that isn't a number at all. */
export function parseWage(input: string): number | null {
  const n = Number(input)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Inserts a custom wage into the sorted tier list at its real position,
 *  without mutating TIERS. */
export function withCustomWage(hourly: number): Tier[] {
  const custom: Tier = {
    id: 'you',
    label: 'You',
    annual: hourly * WORK_YEAR_HOURS,
    hoursPerYear: WORK_YEAR_HOURS,
    note: 'What you typed in, treated the same way as everyone else on this page: a standard 2,080-hour work-year.',
  }
  return [...TIERS, custom].sort((a, b) => dollarsPerHour(a) - dollarsPerHour(b))
}
