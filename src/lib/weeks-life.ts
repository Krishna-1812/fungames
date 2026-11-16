/**
 * Life in Weeks: the arithmetic, and the world the life happened in.
 *
 * A row of the board is one year of a life, birthday to birthday, cut into
 * fifty-two. So a square is a week and about half an hour, every row starts
 * on a birthday, and the ninetieth row ends on the ninetieth one. The older
 * page counted seven-day weeks from birth and wrapped them at fifty-two,
 * which is a 364-day year: by the last row the birthdays had slid a third of
 * the way across the board.
 *
 * No imports and nothing but erasable types, so the node check reads this
 * file as it is.
 */
export const YEARS = 90
export const WEEKS = 52
export const TOTAL = YEARS * WEEKS
export const DAY_MS = 86_400_000
const SYNODIC_DAYS = 29.530588853

/** A date typed as YYYY-MM-DD, at local midnight. Null if it is not a date. */
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  // Date rolls 31 February over into March rather than refusing it.
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null
  return d
}

/** The nth birthday. Someone born on 29 February has it on 1 March three years in four. */
export function birthday(dob: Date, n: number): Date {
  return new Date(dob.getFullYear() + n, dob.getMonth(), dob.getDate())
}

/** Whole years of age on a date. Negative before birth. */
export function ageAt(dob: Date, at: Date): number {
  let y = at.getFullYear() - dob.getFullYear()
  if (+birthday(dob, y) > +at) y--
  return y
}

/** Days in the nth year of this life, and where square k of it starts, in days from that birthday. */
const yearDays = (dob: Date, y: number) => Math.round((+birthday(dob, y + 1) - +birthday(dob, y)) / DAY_MS)
const edgeDay = (days: number, k: number) => Math.round((days * k) / WEEKS)

/** Which square a date falls in. Below zero before birth, TOTAL or more past ninety. */
export function cellOf(dob: Date, at: Date): number {
  const y = ageAt(dob, at)
  const D = yearDays(dob, y)
  // Half a day of slack swallows the hour a clock change moves midnight by.
  const day = Math.floor((+at - +birthday(dob, y)) / DAY_MS + 1 / 48)
  let w = Math.min(WEEKS - 1, Math.max(0, Math.floor((day * WEEKS) / D)))
  while (w < WEEKS - 1 && edgeDay(D, w + 1) <= day) w++
  while (w > 0 && edgeDay(D, w) > day) w--
  return y * WEEKS + w
}

/** The days a square covers: from `start` up to, not including, `end`. Whole days, both. */
export function cellSpan(dob: Date, idx: number): { start: Date; end: Date } {
  const y = Math.floor(idx / WEEKS)
  const w = idx - y * WEEKS
  const A = birthday(dob, y)
  const D = yearDays(dob, y)
  const edge = (k: number) => new Date(A.getFullYear(), A.getMonth(), A.getDate() + edgeDay(D, k))
  return { start: edge(w), end: edge(w + 1) }
}

export type Life = {
  /** Whole years of age. */
  years: number
  days: number
  /** Squares fully behind you, 0..TOTAL. The one you are in is `lived` itself. */
  lived: number
  /** True while there is still a square to be in. */
  inside: boolean
  /** 0..100. */
  pct: number
  left: { weeks: number; weekends: number; moons: number; newYears: number; leapDays: number }
}

export function lifeAt(dob: Date, now: Date): Life {
  const days = Math.floor((+now - +dob) / DAY_MS)
  const cell = cellOf(dob, now)
  const inside = cell < TOTAL
  const lived = Math.min(TOTAL, cell)
  const end = birthday(dob, YEARS)
  const daysLeft = Math.max(0, (+end - +now) / DAY_MS)
  let newYears = 0
  let leapDays = 0
  for (let y = now.getFullYear(); y <= end.getFullYear(); y++) {
    const jan1 = +new Date(y, 0, 1)
    if (jan1 > +now && jan1 <= +end) newYears++
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
    const feb29 = +new Date(y, 1, 29)
    if (leap && feb29 > +now && feb29 <= +end) leapDays++
  }
  return {
    years: ageAt(dob, now),
    days,
    lived,
    inside,
    pct: (lived / TOTAL) * 100,
    left: {
      weeks: TOTAL - lived,
      weekends: Math.floor(daysLeft / 7),
      moons: Math.floor(daysLeft / SYNODIC_DAYS),
      newYears,
      leapDays,
    },
  }
}

/** Full moons in a number of days. */
export const moonsIn = (days: number) => days / SYNODIC_DAYS

/**
 * Things that happened, or are due, on a known day. Chosen to be things a
 * person might place themselves against rather than a history of the world:
 * mostly firsts, mostly science, nothing that is only a catastrophe.
 * `soon` marks the ones still ahead when this was written; the page decides
 * from the clock, not from this flag.
 */
export type WorldEvent = { date: string; text: string }

export const WORLD: WorldEvent[] = [
  { date: '1947-10-14', text: 'An aircraft flies faster than sound' },
  { date: '1953-04-25', text: 'The structure of DNA is published' },
  { date: '1953-05-29', text: 'Everest is climbed' },
  { date: '1954-05-06', text: 'A mile is run in under four minutes' },
  { date: '1957-10-04', text: 'Sputnik, the first satellite' },
  { date: '1961-04-12', text: 'The first person in space' },
  { date: '1967-12-03', text: 'The first human heart transplant' },
  { date: '1969-07-20', text: 'People land on the Moon' },
  { date: '1972-12-07', text: 'The Blue Marble photograph' },
  { date: '1977-09-05', text: 'Voyager 1 is launched' },
  { date: '1978-07-25', text: 'The first baby conceived by IVF is born' },
  { date: '1981-08-12', text: 'The IBM PC goes on sale' },
  { date: '1986-02-09', text: 'Halley’s comet swings past the Sun' },
  { date: '1987-07-11', text: 'Five billion people' },
  { date: '1989-11-09', text: 'The Berlin Wall opens' },
  { date: '1990-02-14', text: 'The Pale Blue Dot photograph' },
  { date: '1990-04-24', text: 'The Hubble telescope is launched' },
  { date: '1991-08-06', text: 'The World Wide Web goes public' },
  { date: '1992-12-03', text: 'The first text message' },
  { date: '1996-07-05', text: 'Dolly the sheep is born' },
  { date: '1997-05-11', text: 'A computer beats the world chess champion' },
  { date: '1998-09-04', text: 'Google is founded' },
  { date: '1999-10-12', text: 'Six billion people' },
  { date: '2000-11-02', text: 'A crew moves into the Space Station; someone has been in orbit ever since' },
  { date: '2001-01-15', text: 'Wikipedia starts' },
  { date: '2003-04-14', text: 'The human genome is declared read' },
  { date: '2004-02-04', text: 'Facebook starts' },
  { date: '2005-04-23', text: 'The first video on YouTube' },
  { date: '2006-08-24', text: 'Pluto stops being a planet' },
  { date: '2007-06-29', text: 'The first iPhone goes on sale' },
  { date: '2011-10-31', text: 'Seven billion people' },
  { date: '2012-07-04', text: 'The Higgs boson is found' },
  { date: '2012-08-25', text: 'Voyager 1 leaves the Sun’s bubble' },
  { date: '2015-07-14', text: 'A spacecraft flies past Pluto' },
  { date: '2015-09-14', text: 'Gravitational waves are detected' },
  { date: '2016-03-15', text: 'A computer beats a champion at Go' },
  { date: '2019-04-10', text: 'The first picture of a black hole' },
  { date: '2020-03-11', text: 'A pandemic is declared' },
  { date: '2021-04-19', text: 'A helicopter flies on Mars' },
  { date: '2021-12-25', text: 'The Webb telescope is launched' },
  { date: '2022-11-15', text: 'Eight billion people' },
  { date: '2022-11-30', text: 'ChatGPT is released' },
  { date: '2029-04-13', text: 'The asteroid Apophis passes closer than the TV satellites' },
  { date: '2038-01-19', text: 'Old 32-bit clocks run out of seconds' },
  { date: '2061-07-28', text: 'Halley’s comet comes back' },
]

export type Placed = { text: string; date: Date; idx: number; age: number; ahead: boolean }

/** The events that fall on this life's board, each on its square. */
export function worldFor(dob: Date, now: Date): Placed[] {
  const out: Placed[] = []
  for (const e of WORLD) {
    const date = parseDay(e.date)!
    const idx = cellOf(dob, date)
    if (+date < +dob || idx >= TOTAL) continue
    out.push({ text: e.text, date, idx, age: ageAt(dob, date), ahead: +date > +now })
  }
  return out
}
