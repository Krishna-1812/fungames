/**
 * Where Does The Day Go — the pure math behind the day-bar.
 *
 * The trick this page is built around: your rough mental estimate of your
 * day ("8 hours at work, 8 at home, 8 asleep") already adds up to 24 — but
 * getting dressed, eating, and commuting were never separately accounted
 * for, even though they were always happening *inside* those two blocks.
 * Carving them out doesn't grow the day past 24 hours; it just makes the
 * same 24 hours honest. `computeDay` below carves morning routine and
 * dinner out of "home", and lunch and the commute (there and back) out of
 * "work" — the total across every segment it returns is always exactly
 * `workHours + homeHours + sleepHours`, whatever that happens to be. See
 * `scripts/check-day-model.mjs`, which checks that invariant directly
 * rather than trusting the arithmetic by eye.
 *
 * The other half — how much of the real "work" segment survives contact
 * with interruptions — rests on one cited, real figure rather than an
 * invented one: Gloria Mark's (UC Irvine) field studies of information
 * workers found an average of 23 minutes 15 seconds to fully return to a
 * task after an interruption. `REFOCUS_MINUTES` is that number, not a
 * slider — the thing a person controls here is how often they get
 * interrupted, not how expensive a real interruption is.
 */

export type DayInputs = {
  workHours: number
  homeHours: number
  sleepHours: number
  morningMin: number
  lunchMin: number
  dinnerMin: number
  commuteMin: number // one-way; the bar counts it there and back
  phoneIntervalMin: number
  extraDistractionsPerDay: number
}

export type Segment = { key: string; label: string; hours: number }

export type DayModel = {
  segments: Segment[]
  totalHours: number
  wakingHours: number
  nonSleepHours: number
  phoneChecks: number
  totalInterruptions: number
  /** Fraction of the way across the non-sleep span (0..1), one per interruption. */
  cuts: number[]
  pieceCountBefore: number
  pieceCountAfter: number
  perceivedWorkHours: number
  actualWorkHours: number
  lostWorkMinutes: number
}

/** Gloria Mark, UC Irvine — average time to fully refocus after an
 *  interruption, from field studies of information workers (2004; and the
 *  2008 CHI paper "The Cost of Interrupted Work: More Speed and Stress"). */
export const REFOCUS_MINUTES = 23.25

export const SOURCES = {
  refocus:
    'Gloria Mark (UC Irvine) found information workers took an average of 23 minutes 15 seconds to fully return to a task after being interrupted from it — "The Cost of Interrupted Work: More Speed and Stress" (CHI 2008).',
  phoneChecks:
    'How often people check their phones varies a great deal by study and methodology — published estimates run from roughly 80 to over 200 times a day. This page uses whatever number you pick rather than asserting one.',
}

const clampMin0 = (h: number) => Math.max(0, h)

/**
 * Fit `a` and `b` inside `bucket` without ever letting their sum exceed it.
 *
 * If they already fit, the bucket simply shrinks by both — the ordinary
 * case. If they don't (an 800-minute morning routine against a 2-hour
 * "home" slider is a real thing someone will drag a slider into), both are
 * scaled down proportionally so they exactly consume the bucket instead of
 * quietly growing the day past what it was told to be. This is what keeps
 * `computeDay`'s total honest for every input, not just the sane ones.
 */
function carve(bucket: number, a: number, b: number): { left: number; a: number; b: number } {
  const sum = a + b
  if (sum <= bucket) return { left: bucket - sum, a, b }
  if (sum <= 0) return { left: bucket, a: 0, b: 0 }
  const scale = bucket / sum
  return { left: 0, a: a * scale, b: b * scale }
}

export function computeDay(input: DayInputs): DayModel {
  const morningIn = clampMin0(input.morningMin) / 60
  const lunchIn = clampMin0(input.lunchMin) / 60
  const dinnerIn = clampMin0(input.dinnerMin) / 60
  const commuteIn = (clampMin0(input.commuteMin) * 2) / 60 // there and back

  // Carved out of "home" and "work" rather than added on top — the whole
  // point is that the day does not get any longer than you first said it
  // was. `carve` keeps that true even when the pieces you're carving out
  // don't actually fit inside the bucket they're supposed to come from.
  const homeSplit = carve(clampMin0(input.homeHours), morningIn, dinnerIn)
  const workSplit = carve(clampMin0(input.workHours), lunchIn, commuteIn)
  const { left: homeLeft, a: morningH, b: dinnerH } = homeSplit
  const { left: workLeft, a: lunchH, b: commuteH } = workSplit

  const segments: Segment[] = [
    { key: 'morning', label: 'Morning routine', hours: morningH },
    { key: 'commute', label: 'Commute (there and back)', hours: commuteH },
    { key: 'work', label: 'Work / school', hours: workLeft },
    { key: 'lunch', label: 'Lunch', hours: lunchH },
    { key: 'home', label: 'Home', hours: homeLeft },
    { key: 'dinner', label: 'Dinner', hours: dinnerH },
    { key: 'sleep', label: 'Sleep', hours: clampMin0(input.sleepHours) },
  ]

  const totalHours = segments.reduce((s, seg) => s + seg.hours, 0)
  const sleepHours = segments.find((s) => s.key === 'sleep')!.hours
  const nonSleepHours = totalHours - sleepHours
  // Waking hours is the segments' own non-sleep total, not a literal 24 —
  // that keeps phone-check math consistent with the bar even when someone's
  // three headline sliders don't happen to add to a real day.
  const wakingHours = nonSleepHours

  const phoneChecks =
    input.phoneIntervalMin > 0 ? Math.round((wakingHours * 60) / input.phoneIntervalMin) : 0
  const totalInterruptions = Math.max(0, phoneChecks + Math.round(clampMin0(input.extraDistractionsPerDay)))

  // Spread evenly across the non-sleep span for the tick marks — sleep gets
  // none, because nothing interrupts a day that is already over.
  const cuts: number[] = nonSleepHours > 0
    ? Array.from({ length: totalInterruptions }, (_, i) => (i + 0.5) / Math.max(1, totalInterruptions))
    : []

  const workShare = nonSleepHours > 0 ? workLeft / nonSleepHours : 0
  const interruptionsDuringWork = Math.round(totalInterruptions * workShare)
  const lostWorkMinutes = Math.min(workLeft * 60, interruptionsDuringWork * REFOCUS_MINUTES)
  const actualWorkHours = clampMin0(workLeft - lostWorkMinutes / 60)

  const nonZeroSegments = segments.filter((s) => s.hours > 0).length
  const pieceCountBefore = nonZeroSegments
  const pieceCountAfter = nonZeroSegments + totalInterruptions

  return {
    segments,
    totalHours,
    wakingHours,
    nonSleepHours,
    phoneChecks,
    totalInterruptions,
    cuts,
    pieceCountBefore,
    pieceCountAfter,
    perceivedWorkHours: workLeft,
    actualWorkHours,
    lostWorkMinutes,
  }
}

/** Hours left in the real day, from the real clock, for the closing line. */
export function hoursLeftToday(now: Date = new Date()): number {
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return (midnight.getTime() - now.getTime()) / 3_600_000
}
