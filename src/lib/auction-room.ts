/**
 * The saleroom around the Auction Game's engine: who sits where, the paddle
 * each of them holds, the currency board on the wall and the catalogue's
 * photographs. Nothing here changes how anyone bids — that is all in
 * lib/auction.ts — it is what the room looks like while they do.
 */

/** Where a bidder is, and the paddle they raise. */
export type Seat = {
  paddle: string
  /** How they are bidding: in the room, on the telephone through the house, or online. */
  via: 'room' | 'phone' | 'online'
  /** Where, in words. */
  where: string
}

export const SEATS: Record<string, Seat> = {
  holloway: { paddle: '104', via: 'room', where: 'Front row, on the aisle' },
  vance: { paddle: '287', via: 'room', where: 'Standing at the back' },
  okonkwo: { paddle: '156', via: 'room', where: 'Third row, not moving' },
  petrov: { paddle: 'T1', via: 'phone', where: 'On the telephone, through the house' },
  quill: { paddle: 'W12', via: 'online', where: 'Bidding online' },
}

/** Your paddle. */
export const YOUR_PADDLE = '212'

/* -------------------------------------------------------------------------- */
/* The currency board                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A London saleroom's board shows the bid in sterling and five other
 * currencies, converted at the day's rates and marked "for guidance only".
 * The page fetches the European Central Bank's reference rates for today; if
 * that fails it falls back to these, which are the ECB's own for the date
 * given, so the board is never made up.
 */
export const BOARD: { code: string; sign: string; step: number }[] = [
  { code: 'USD', sign: 'US$', step: 1 },
  { code: 'EUR', sign: '€', step: 1 },
  { code: 'CHF', sign: 'CHF', step: 1 },
  { code: 'HKD', sign: 'HK$', step: 10 },
  { code: 'JPY', sign: '¥', step: 100 },
]

export const FALLBACK_RATES = {
  date: '2026-11-20',
  rates: { USD: 1.3125, EUR: 1.1942, CHF: 1.1015, HKD: 10.2884, JPY: 208.22 } as Record<string, number>,
}

/** Where today's rates come from: ECB reference rates, open to any page. */
export const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR,CHF,HKD,JPY'

/** Read the rates service's answer, or null if it is not one. */
export function parseRates(json: unknown): { date: string; rates: Record<string, number> } | null {
  const j = json as { date?: unknown; rates?: Record<string, unknown> } | null
  if (!j || typeof j.date !== 'string' || !j.rates) return null
  const rates: Record<string, number> = {}
  for (const { code } of BOARD) {
    const v = Number(j.rates[code])
    // A rate a long way from the fallback is a broken answer, not a crash.
    const ref = FALLBACK_RATES.rates[code]
    if (!(v > ref / 3 && v < ref * 3)) return null
    rates[code] = v
  }
  return { date: j.date, rates }
}

/** One bid in another currency, rounded the way a board shows it. */
export function convert(gbp: number, rate: number, step: number): number {
  return Math.round((gbp * rate) / step) * step
}

/** A whole number with thin thousands separators, as the board prints it. */
export const grouped = (n: number) => Math.round(n).toLocaleString('en-GB')

/** "20 Nov 2026" from an ISO date. */
export function rateDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`
}

/* -------------------------------------------------------------------------- */
/* Paddles and photographs                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A bidding paddle: a stiff white card with the number printed big, on a
 * turned hardwood handle. Drawn rather than photographed because it moves.
 */
export function paddleSvg(num: string, mine = false): string {
  const long = num.length > 3
  return `<svg viewBox="0 0 64 104" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="ph${num}" x1="0" x2="1"><stop offset="0" stop-color="#2b1f1a"/><stop offset=".45" stop-color="#5a4236"/><stop offset="1" stop-color="#22181400"/></linearGradient>
    <linearGradient id="pc${num}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mine ? '#eaf6ff' : '#fbfcfd'}"/><stop offset="1" stop-color="${mine ? '#c9dceb' : '#dfe4ea'}"/></linearGradient>
  </defs>
  <rect x="28" y="54" width="8" height="46" rx="3.5" fill="#2e221c"/>
  <rect x="28" y="54" width="8" height="46" rx="3.5" fill="url(#ph${num})"/>
  <rect x="27" y="58" width="10" height="3" rx="1.5" fill="#1d1511"/>
  <rect x="3" y="3" width="58" height="56" rx="7" fill="#0b0f14" opacity=".35"/>
  <rect x="2" y="1" width="58" height="56" rx="7" fill="url(#pc${num})" stroke="#9aa6b2" stroke-width=".8"/>
  <rect x="6" y="5" width="50" height="48" rx="4.5" fill="none" stroke="${mine ? '#3b6f9b' : '#1c2733'}" stroke-width="1.4"/>
  <text x="31" y="${long ? 36 : 38}" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="${long ? 18 : 23}" letter-spacing="-.5" fill="${mine ? '#173b5c' : '#121a22'}">${num}</text>
</svg>`
}

/** A lot's catalogue photograph (scripts/bake-auction.mjs), 1500 or 750 wide. */
export const lotPhoto = (id: string, small = false) => `auction/${id}${small ? '-s' : ''}.webp`
