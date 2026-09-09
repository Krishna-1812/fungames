/**
 * Progress's model: every unit of time you are currently inside of.
 *
 * This used to live inline in the page, which meant the one genuinely tricky
 * part of Progress — the date arithmetic — was the one part nothing could
 * test. Weeks that start on Monday, months with real lengths, leap years,
 * days that are 23 or 25 hours long because a clock changed at 2am, a weekend
 * row that has to mean two different things depending on which side of
 * Saturday you are on: all of it was untested because it was unreachable.
 *
 * It is a module now, and `scripts/check-progress.mjs` walks a year of
 * instants through it in four timezones.
 *
 * ## The ladder
 *
 * UNITS is ordered strictly by span length, shortest first, and that ordering
 * is the page's whole argument: each unit contains the one before it. The dial
 * draws them as concentric rings from that order, so "further in is slower" is
 * not a decoration — it is the sort key.
 *
 * The one place the ordering is not exact is the lunar cycle sitting just
 * outside the calendar month. A lunation is 29.53 days: longer than February,
 * shorter than March. They cross twice a year, by about 5%, and no fixed order
 * can be right all the time. The checker allows that much and no more.
 */

const DAY = 86_400_000

export type Unit = {
  id: string
  /** A function where the name itself depends on the date — see `weekend`. */
  name: string | ((d: Date) => string)
  note?: string
  /** Epoch milliseconds, `[start, end)`, for the instance containing `d`. */
  span?: (d: Date) => [number, number]
  /**
   * An instant after which this unit is not a thing anyone is inside of.
   *
   * Only the 32-bit row has one, and only because it is the only row here that
   * happens once. Every other unit recurs, so "the instance containing `d`"
   * always exists; that one has a last instance, on 19 January 2038, after
   * which it would sit at 100.0000% reading "0 ms left" for ever — which is
   * exactly the fault the weekend row used to have every Saturday. `read()`
   * has nothing sensible to return past this point, so `liveUnits()` drops it
   * instead and the dial simply has fourteen rings.
   */
  until?: number
  /**
   * Rows with no start and no end. The Sun's figures are astronomy, not a
   * clock: `frac` is fixed and `seconds` is the real span, used only to place
   * it at the bottom of the ladder.
   */
  fixed?: { frac: number; seconds: number; left: string }
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

/** Midnight at the start of `d`'s day, in local time. */
function midnight(d: Date) {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  return s
}

/**
 * Floor an instant to the last `step`-boundary of the local clock.
 *
 * This exists because `setSeconds(0, 0)` and `setMinutes(0, 0, 0)` do not
 * survive the autumn clock change. They decompose the instant into local
 * wall-clock fields, edit them, and recompose — and during the repeated hour a
 * local wall-clock time names two different instants, so the recomposition
 * picks one and it is a coin flip which. Measured: at 2024-11-03T06:42:00Z in
 * New York, the minute containing that instant came back exactly one hour
 * earlier than the instant itself. The row would have sat at 0% or 100% for a
 * solid hour, once a year, in every zone that does this.
 *
 * Flooring in offset-shifted epoch space has no such step. The offset is read
 * *at the instant*, so it is whichever one is actually in force, and
 *   s = floor((t + off) / step) * step - off
 * satisfies s <= t < s + step for any offset at all — including the half-hour
 * and three-quarter-hour ones, which is why the hour cannot simply floor the
 * epoch. Kolkata is +5:30 and its hours do not start when UTC's do.
 */
function localFloor(d: Date, step: number) {
  const off = -d.getTimezoneOffset() * 60_000
  return Math.floor((+d + off) / step) * step - off
}

export const UNITS: Unit[] = [
  {
    id: 'second',
    name: 'This second',
    span: (d) => {
      const s = Math.floor(+d / 1000) * 1000
      return [s, s + 1000]
    },
  },
  {
    id: 'minute',
    name: 'This minute',
    span: (d) => {
      const s = localFloor(d, 60_000)
      return [s, s + 60_000]
    },
  },
  {
    id: 'hour',
    name: 'This hour',
    span: (d) => {
      const s = localFloor(d, 3_600_000)
      return [s, s + 3_600_000]
    },
  },
  {
    id: 'day',
    name: 'Today',
    /* Not `+midnight + DAY`. Twice a year a local day is 23 or 25 hours long,
       and on those two days a fixed 24-hour span puts the row an hour wrong
       all day and leaves it reading 95.8% or 104.2% at midnight. */
    span: (d) => {
      const s = midnight(d)
      const e = new Date(s)
      e.setDate(e.getDate() + 1)
      return [+s, +e]
    },
  },
  {
    id: 'weekend',
    /*
     * Two rows in one, because the single version was dead for two days out of
     * every seven. It ran Monday 00:00 to Saturday 00:00, so from the moment
     * the weekend started until Monday it sat at 100.0000% with "0.0 seconds
     * left" — the one row on the page you would look at on a Saturday, and the
     * only one that had stopped telling the truth.
     */
    name: (d) => (isWeekend(d) ? 'The weekend itself' : 'Until the weekend'),
    span: (d) => {
      const s = midnight(d)
      if (isWeekend(d)) {
        s.setDate(s.getDate() - (d.getDay() === 0 ? 1 : 0)) // back to Saturday
        const e = new Date(s)
        e.setDate(e.getDate() + 2) // Monday 00:00
        return [+s, +e]
      }
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7)) // Monday
      const e = new Date(s)
      e.setDate(e.getDate() + 5) // Saturday 00:00
      return [+s, +e]
    },
  },
  {
    id: 'week',
    name: 'This week',
    span: (d) => {
      const s = midnight(d)
      // Monday-first, matching most of the world.
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
      const e = new Date(s)
      e.setDate(e.getDate() + 7)
      return [+s, +e]
    },
  },
  {
    id: 'lunation',
    name: 'The current lunar cycle',
    note: '29.53 days — longer than February, shorter than March.',
    span: (d) => {
      // Synodic month, anchored to a known new moon (2000-01-06 18:14 UTC).
      const SYN = 29.530588853 * DAY
      const anchor = Date.UTC(2000, 0, 6, 18, 14)
      const k = Math.floor((+d - anchor) / SYN)
      return [anchor + k * SYN, anchor + (k + 1) * SYN]
    },
  },
  {
    id: 'month',
    name: 'This month',
    span: (d) => [
      +new Date(d.getFullYear(), d.getMonth(), 1),
      +new Date(d.getFullYear(), d.getMonth() + 1, 1),
    ],
  },
  {
    id: 'quarter',
    name: 'This quarter',
    span: (d) => {
      const q = Math.floor(d.getMonth() / 3) * 3
      return [+new Date(d.getFullYear(), q, 1), +new Date(d.getFullYear(), q + 3, 1)]
    },
  },
  {
    id: 'year',
    name: 'This year',
    span: (d) => [+new Date(d.getFullYear(), 0, 1), +new Date(d.getFullYear() + 1, 0, 1)],
  },
  {
    id: 'decade',
    name: 'This decade',
    span: (d) => {
      const y = Math.floor(d.getFullYear() / 10) * 10
      return [+new Date(y, 0, 1), +new Date(y + 10, 0, 1)]
    },
  },
  {
    id: 'y2038',
    name: 'Until 32-bit time runs out',
    note: 'The signed Unix timestamp overflows on 19 January 2038.',
    span: () => [+new Date(1970, 0, 1), 2_147_483_647_000],
    until: 2_147_483_647_000,
  },
  {
    id: 'century',
    name: 'This century',
    span: (d) => {
      const y = Math.floor(d.getFullYear() / 100) * 100
      return [+new Date(y, 0, 1), +new Date(y + 100, 0, 1)]
    },
  },
  {
    id: 'millennium',
    name: 'This millennium',
    span: (d) => {
      const y = Math.floor(d.getFullYear() / 1000) * 1000
      return [+new Date(y, 0, 1), +new Date(y + 1000, 0, 1)]
    },
  },
  {
    id: 'sun',
    name: "The Sun's life",
    /* Not "about five billion years left" — the row's own readout already says
       that, and a note that repeats the line above it is furniture. The two
       figures the percentage is made of are the thing that is not on screen. */
    note: 'Fixed figures: 4.6 billion years in, about 10 billion in total.',
    // Fixed astronomical figures: ~4.6 Gyr in, ~10 Gyr total.
    fixed: { frac: 4.6 / 10, seconds: 10e9 * 365.2425 * 86_400, left: 'about 5 billion years left' },
  },
]

/** Rings the dial has room for. Fifteen today, with slack. */
export const MAX_UNITS = 16

/**
 * The units that are still something you are inside of, at `d`.
 *
 * Identical to UNITS until 19 January 2038 — see `until`. The page builds its
 * rings and its register from this rather than from UNITS, so the day the
 * 32-bit row expires the instrument quietly becomes a fourteen-ring
 * instrument instead of growing a dead one.
 */
export function liveUnits(d: Date): Unit[] {
  return UNITS.filter((u) => u.until === undefined || +d < u.until)
}

/**
 * A unit's real rate, in fraction-of-itself per second, mapped to 0..1.
 *
 * The raw rates span 1.0 (a second) to 3.2e-11 (a millennium), which is
 * unusable directly: linear, everything below "today" is stopped; and a plain
 * reciprocal makes the second a strobe and nothing else move at all. Log10
 * spreads them with the ordering intact.
 *
 * The window is twelve decades rather than the ten the list actually spans, so
 * that the slowest live row — the millennium, at 0.125 — is still visibly not
 * the same thing as stopped. A rate of exactly zero is reserved for the Sun,
 * whose figures do not change. That is the point of it.
 */
export function rateOf(seconds: number) {
  if (!(seconds > 0) || !isFinite(seconds)) return 0
  const decades = Math.log10(1 / seconds)
  return Math.min(1, Math.max(0, (decades + 12) / 12))
}

export type Reading = {
  name: string
  /** 0..1 of the way through. */
  frac: number
  /** Milliseconds to the end, or null for a unit with no end. */
  remaining: number | null
  /** The whole span, in seconds. */
  seconds: number
  /** rateOf(seconds), or 0 for a fixed unit. */
  rate: number
  /** Ready-to-print "20.4 seconds left". */
  left: string
  /** Ready-to-print "65.95%". */
  pct: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "20.4 seconds left", "42m 20s left", "973.3 years left". */
export function human(ms: number) {
  if (!(ms > 0)) ms = 0
  // The seconds row would otherwise spend its whole life reading "0.4 seconds
  // left", which is a worse sentence than the number it is hiding.
  if (ms < 1000) return `${Math.round(ms / 10) * 10} ms left`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} seconds left`
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ${pad(Math.floor(s % 60))}s left`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ${pad(Math.floor(m % 60))}m left`
  const d = h / 24
  // Singular below two: the old version said "1 days, 9h left" every Saturday.
  const dn = Math.floor(d)
  if (d < 31) return `${dn} ${dn === 1 ? 'day' : 'days'}, ${Math.floor(h % 24)}h left`
  if (d < 400) return `${dn} days left`
  const y = d / 365.2425
  if (y < 1000) return `${y.toFixed(1)} years left`
  if (y < 1e6) return `${Math.round(y).toLocaleString('en-US')} years left`
  return `${(y / 1e9).toFixed(1)} billion years left`
}

/**
 * Decimals for the percentage.
 *
 * More of them where a whole percent would take years to move — the century
 * at two decimal places is a still image. Fewer where the digits are already a
 * blur. The 0.9999 case is the weekend at 23:59 on a Sunday: without it the
 * row reads a flat 100% for the last four seconds of the week, which is the
 * one moment it has something to say.
 */
export function decimals(frac: number, remaining: number | null, fixed: boolean) {
  if (fixed) return 1
  if (frac > 0.9999) return 4
  if (remaining !== null && remaining > DAY * 200) return 4
  return 2
}

/** Everything the page needs about one unit, right now. */
export function read(u: Unit, d: Date): Reading {
  const name = typeof u.name === 'function' ? u.name(d) : u.name

  if (u.fixed) {
    const { frac, seconds, left } = u.fixed
    return {
      name, frac, remaining: null, seconds, rate: 0, left,
      pct: (frac * 100).toFixed(decimals(frac, null, true)) + '%',
    }
  }

  const [s, e] = u.span!(d)
  const frac = Math.min(1, Math.max(0, (+d - s) / (e - s)))
  const remaining = e - +d
  const seconds = (e - s) / 1000
  return {
    name, frac, remaining, seconds,
    rate: rateOf(seconds),
    left: human(remaining),
    pct: (frac * 100).toFixed(decimals(frac, remaining, false)) + '%',
  }
}
