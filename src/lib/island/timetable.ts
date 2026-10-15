/**
 * Tiny Island — what's on, and when.
 *
 * Everything on the island that keeps hours, as the noticeboard by the town
 * square lists it: the day's challenge, the parade (every five minutes, to
 * the day's game), the ferry (in and out every 48 seconds: it is a small
 * island), the bell on the hour that puts the pigeons up, the lighthouse lit
 * from dusk to dawn, fireworks on Friday nights and at New Year, the whale
 * that only comes up at dawn, and something at three in the morning that the
 * board will not name until you have seen it.
 *
 * All of it runs from the visitor's own clock, the same clock the island
 * uses, so what the board says is what the map does; no server. Pure, so
 * check-timetable.mjs can hold it to that at any hour of any day.
 */

export type Row = {
  key: 'today' | 'season' | 'parade' | 'ferry' | 'bells' | 'lighthouse' | 'fireworks' | 'whale' | 'three'
  title: string
  /** What it is, in a line. */
  line: string
  /** When: now, or next, and how long until. */
  when: string
  /** Happening right now. */
  now: boolean
}

/** The ferry's crossing, as its animation runs it (world.ts, FERRY_DUR and isl-ferry): at the jetty from 32% to 62% of each 48 seconds. */
export const FERRY = { every: 48, docks: 0.32, leaves: 0.62 }

/** Friday nights from eight to ten: fireworks. */
export const isFest = (d: Date) => d.getDay() === 5 && d.getHours() >= 20 && d.getHours() < 22
/** New Year's Eve and New Year's Day, after dark: fireworks too (and snow; see the page's seasons). */
const isNewYearNight = (d: Date) => ((d.getMonth() === 11 && d.getDate() === 31) || (d.getMonth() === 0 && d.getDate() === 1)) && (d.getHours() >= 18 || d.getHours() < 6)
/** The island's time of day by the clock (as the page's byClock). */
export const timeOf = (h: number) => (h >= 6 && h < 8 ? 'dawn' : h >= 8 && h < 18 ? 'day' : h >= 18 && h < 20 ? 'dusk' : 'night')

/** "in 40 s", "in 4 min", "in 3 h", "in 2 days". */
export function until(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `in ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `in ${m} min`
  const h = Math.round(m / 60)
  if (h < 36) return `in ${h} h`
  return `in ${Math.round(h / 24)} days`
}
/** A clock time, the visitor's way of writing one. */
export const hhmm = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** The next moment after `from` at hour h (and minute 0) on a day that passes `ok`. */
function nextAt(from: Date, h: number, ok: (d: Date) => boolean = () => true): Date {
  const d = new Date(from)
  d.setHours(h, 0, 0, 0)
  for (let k = 0; k < 400; k++) { if (d > from && ok(d)) return d; d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0) }
  return d
}
/** Today, tomorrow, or the day's name: when something next happens, in words. */
function dayWord(now: Date, d: Date) {
  const a = new Date(now); a.setHours(0, 0, 0, 0)
  const b = new Date(d); b.setHours(0, 0, 0, 0)
  const n = Math.round((b.getTime() - a.getTime()) / 864e5)
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 7 ? DAYS[d.getDay()] : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function timetable(now: Date, o: {
  daily: { title: string; goal: string }
  parade: { on: boolean; next: Date; to: string }
  /** Where the ferry is in its crossing, 0..1 (null before the map has loaded). */
  ferry: number | null
  /** The time of day the island is showing (the visitor may have picked day or night by hand). */
  shown: string
  /** Whether the three o'clock visitor has been seen in this browser. */
  seenThree: boolean
  /** The island's season now (lib/island/seasons.ts), or the next one coming. */
  season?: { name: string; line: string; until: Date } | null
  next?: { name: string; line: string; from: Date } | null
}): Row[] {
  const rows: Row[] = []
  const t = now.getTime()
  // A new challenge at UTC midnight (data/game-meta.ts dailyFor), said on the visitor's own clock.
  const fresh = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  rows.push({ key: 'today', title: 'Today’s challenge', line: `${o.daily.title}: ${o.daily.goal}`, when: `A new one at ${hhmm(fresh)} · ${until(fresh.getTime() - t)}`, now: true })
  // The season: what the island is wearing now, and until when; or what is coming next.
  if (o.season) rows.push({ key: 'season', title: `${o.season.name} on the island`, line: o.season.line, when: `Until the end of ${dayWord(now, new Date(o.season.until.getTime() - 1))}`, now: true })
  else if (o.next) rows.push({ key: 'season', title: `Coming up: ${o.next.name}`, line: o.next.line, when: `From ${dayWord(now, o.next.from)}`, now: false })
  rows.push(o.parade.on
    ? { key: 'parade', title: 'The parade', line: `From the town square to ${o.parade.to} and back, band and all`, when: 'Marching now!', now: true }
    : { key: 'parade', title: 'The parade', line: `From the town square to ${o.parade.to}, every five minutes`, when: `Next at ${hhmm(o.parade.next)} · ${until(o.parade.next.getTime() - t)}`, now: false })
  if (o.ferry !== null) {
    const p = ((o.ferry % 1) + 1) % 1, E = FERRY.every
    const s = (x: number) => until(x * E * 1000)
    rows.push(p < FERRY.docks
      ? { key: 'ferry', title: 'The ferry', line: 'In and out of the harbour all day (it is a small island)', when: `Coming in · at the jetty ${s(FERRY.docks - p)}`, now: false }
      : p < FERRY.leaves
        ? { key: 'ferry', title: 'The ferry', line: 'In and out of the harbour all day (it is a small island)', when: `At the jetty now · leaves ${s(FERRY.leaves - p)}`, now: true }
        : { key: 'ferry', title: 'The ferry', line: 'In and out of the harbour all day (it is a small island)', when: `Out at sea · back ${s(1 - p + FERRY.docks)}`, now: false })
  }
  const bell = new Date(now); bell.setMinutes(0, 0, 0); bell.setHours(bell.getHours() + 1)
  const justRang = now.getMinutes() === 0 && now.getSeconds() < 30
  rows.push({ key: 'bells', title: 'The bell in the square', line: 'Rings the hour, and every pigeon on the square goes up', when: justRang ? 'Ringing now' : `Next at ${hhmm(bell)} · ${until(bell.getTime() - t)}`, now: justRang })
  const lit = o.shown === 'dusk' || o.shown === 'night'
  const dusk = nextAt(now, 18)
  rows.push({ key: 'lighthouse', title: 'The lighthouse', line: 'Lit from dusk until dawn, its beam going round', when: lit ? 'Lit now' : `Lights up at ${hhmm(dusk)} · ${until(dusk.getTime() - t)}`, now: lit })
  const fest = isFest(now) || isNewYearNight(now)
  const nextFri = nextAt(now, 20, (d) => d.getDay() === 5)
  const nextNye = nextAt(now, 18, (d) => d.getMonth() === 11 && d.getDate() === 31)
  const nextFw = nextNye < nextFri ? nextNye : nextFri
  rows.push({ key: 'fireworks', title: 'Fireworks', line: 'Friday nights, eight till ten, and all New Year', when: fest ? 'On now! Look up' : `Next ${dayWord(now, nextFw)} at ${hhmm(nextFw)} · ${until(nextFw.getTime() - t)}`, now: fest })
  const dawn = timeOf(now.getHours()) === 'dawn'
  const sunrise = nextAt(now, 6)
  rows.push({ key: 'whale', title: 'The big whale', line: 'Only comes up at dawn, out past the harbour', when: dawn ? 'Up now' : `Next at dawn, ${hhmm(sunrise)} · ${until(sunrise.getTime() - t)}`, now: dawn })
  const three = now.getHours() === 3
  const at3 = nextAt(now, 3)
  rows.push(o.seenThree
    ? { key: 'three', title: 'The visitor from above', line: 'Over Sky Peaks, at three in the morning', when: three ? 'Here now' : `Next ${dayWord(now, at3)} at ${hhmm(at3)}`, now: three }
    : { key: 'three', title: '███ ██ ███', line: 'Classified. Be up at three in the morning to find out.', when: three ? 'Now…' : `Next ${dayWord(now, at3)} at ${hhmm(at3)}`, now: three })
  return rows
}
