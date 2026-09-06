/**
 * The auction engine.
 *
 * The point of the game is that you will overpay, and that there are four
 * specific mechanisms by which auction houses arrange for that to happen. All
 * four are modelled here rather than described:
 *
 *   1. The buyer's premium. You bid the hammer price and you pay 25% more.
 *   2. The bidding ladder. Increments are fixed and get coarser as the price
 *      climbs, so "one more bid" is never a small amount near the top.
 *   3. Chandelier bidding. Below the reserve the auctioneer may take bids off
 *      the wall — against you, from nobody — to lift the price. This is legal
 *      in the UK and in most US states, and the game discloses every one it
 *      took at the end.
 *   4. The winner's curse. Every bidder values a lot as the truth times their
 *      own taste, so the winner is disproportionately whoever most overrated
 *      it. Nothing scripts this; it falls out of the model, and
 *      scripts/check-auction.mjs measures that it really does.
 *
 * The engine is a pure state machine over plain data so the same code runs the
 * page and runs ten thousand headless auctions in the checker.
 */
import type { Category, Lot } from '../data/lots'

/** What the house adds to the hammer price. Real houses tier it; this is flat. */
export const PREMIUM = 0.25

/**
 * The bidding ladder. Real houses vary the middle steps (20 / 25 / 28 within a
 * band); this is the common simplification and it keeps the increment legible
 * on screen, which matters more here than matching one house exactly.
 */
const LADDER: [number, number][] = [
  [200, 10],
  [500, 20],
  [1_000, 50],
  [2_000, 100],
  [5_000, 200],
  [10_000, 500],
  [20_000, 1_000],
  [Infinity, 2_000],
]

export function increment(at: number): number {
  for (const [ceiling, step] of LADDER) if (at < ceiling) return step
  return 2_000
}

export function nextBid(at: number): number {
  return at + increment(at)
}

/**
 * Hammer price plus the house's cut — what actually leaves your account.
 *
 * Rounded up to the pound, the way a fee is. Rounding to nearest looks more
 * neutral and breaks the inverse below: at a hammer of £85 it charges £106,
 * while £106 of cash is told it can only afford £84. A bidder with exactly
 * enough money must never be told they are short.
 */
export function withPremium(hammer: number): number {
  return Math.ceil(hammer * (1 + PREMIUM))
}

/** Highest hammer price you can afford with `cash` left, premium included. */
export function affordableHammer(cash: number): number {
  return Math.floor(cash / (1 + PREMIUM))
}

/* -------------------------------------------------------------------------- */
/* Randomness                                                                 */
/* -------------------------------------------------------------------------- */

export type Rng = () => number

/** Seeded so the checker's numbers are reproducible and a bad run is a bug. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* -------------------------------------------------------------------------- */
/* Bidders                                                                    */
/* -------------------------------------------------------------------------- */

export type Style =
  /** Bids the minimum increment, every time, until their limit. */
  | 'grinder'
  /** Jumps two or three increments to make you feel it. */
  | 'jumper'
  /** Silent until "going twice", then arrives. */
  | 'sniper'
  /** No discipline. Their limit is well over what the thing is worth. */
  | 'spender'
  /** Wants a set. Each one they land makes the next one worth more to them. */
  | 'completionist'

export type Bidder = {
  id: string
  name: string
  /** One line of character, shown in the room. */
  note: string
  /** Cash left, in pounds, inclusive of premium. Depletes across the sale. */
  budget: number
  /** What they overrate. Anything unlisted is 1. */
  taste: Partial<Record<Category, number>>
  style: Style
  /**
   * True if they set their ceiling on the hammer price and forget the 25% on
   * top. Two of them do. It is the most common mistake in the room.
   */
  ignoresPremium: boolean
  /** What they have already landed. The category is what the completionist
   *  counts, so it is carried here rather than looked up from the sale. */
  won: { id: string; category: Category }[]
}

/**
 * The room.
 *
 * Every one of them is a different way of losing money, and the strategy of the
 * game is working out which one you are up against on a given lot.
 *
 * Budgets are deliberately uneven, and they run the opposite way to the
 * discipline: the two who forget the premium have the least money, so their
 * undiscipline empties their pockets early and the back half of the sale is
 * cheaper for whoever kept their nerve. That is the whole strategy of the game,
 * and it is the same reason the spender's ceiling had to come down — the
 * numbers below are tuned against scripts/check-auction.mjs, which fails if any
 * one of them wins more than 45% of the room or less than 5%.
 */
export function makeRivals(): Bidder[] {
  return [
    {
      id: 'holloway',
      name: 'Mrs Holloway',
      note: 'Front row, glasses on a chain. Bids ten pounds at a time and never once more than she meant to.',
      budget: 12_000,
      taste: { Ceramics: 1.5, Furniture: 1.25 },
      style: 'grinder',
      ignoresPremium: false,
      won: [],
    },
    {
      id: 'vance',
      name: 'Mr Vance',
      note: 'Standing at the back on the telephone. Jumps the bidding to make you feel the room turn.',
      budget: 15_000,
      taste: { Paintings: 1.45, Jewellery: 1.25 },
      style: 'jumper',
      ignoresPremium: false,
      won: [],
    },
    {
      id: 'okonkwo',
      name: 'Dr Okonkwo',
      note: 'Has not moved all afternoon. Comes in on "going twice", every time, and it works more often than it should.',
      budget: 13_000,
      taste: { Instruments: 1.5, Books: 1.3 },
      style: 'sniper',
      ignoresPremium: false,
      won: [],
    },
    {
      id: 'petrov',
      name: 'The Petrov Estate',
      note: 'Buying back the family collection and not counting. Sets the ceiling on the hammer and forgets the premium entirely.',
      budget: 8_500,
      taste: { Jewellery: 1.3, Curiosities: 1.25 },
      style: 'spender',
      ignoresPremium: true,
      won: [],
    },
    {
      id: 'quill',
      name: 'Quill',
      note: 'Wants a set. Every one he lands makes the next one worth more to him, which is not how value works.',
      budget: 8_000,
      taste: { Books: 1.3, Curiosities: 1.1 },
      style: 'completionist',
      ignoresPremium: true,
      won: [],
    },
  ]
}

export type LotOutcome = {
  lotId: string
  hammer: number
  /** null when the lot went unsold. */
  winner: string | null
  sold: boolean
  chandelier: number
}

/** What a bidder privately thinks a lot is worth, before any discipline. */
export function privateValue(b: Bidder, lot: Lot, rng: Rng): number {
  const taste = b.taste[lot.category] ?? 1
  // Everyone misjudges, and they misjudge by different amounts. This spread is
  // what produces the winner's curse further down.
  const noise = 0.78 + rng() * 0.5
  let v = lot.value * taste * noise
  // Tuned against the simulation, not by eye. At 1.35 the spender's ceiling was
  // 1.69x a disciplined bidder's once his ignored premium was folded in, and he
  // took seven lots in ten — a room with one bidder in it is not a room.
  if (b.style === 'spender') v *= 1.10
  if (b.style === 'completionist') {
    const owned = b.won.filter((w) => w.category === lot.category).length
    v *= 1 + 0.14 * owned
  }
  return v
}

/**
 * The most a bidder will let the hammer fall at.
 *
 * A disciplined bidder divides by 1.25 first, because the premium is coming
 * whether they thought about it or not. The two who don't spend a quarter more
 * than they meant to on everything they win.
 */
export function ceiling(b: Bidder, lot: Lot, rng: Rng): number {
  const v = privateValue(b, lot, rng)
  const disciplined = b.ignoresPremium ? v : v / (1 + PREMIUM)
  return Math.min(disciplined, affordableHammer(b.budget))
}

/* -------------------------------------------------------------------------- */
/* One lot                                                                    */
/* -------------------------------------------------------------------------- */

export type BidEvent = {
  kind: 'open' | 'bid' | 'jump' | 'chandelier' | 'call' | 'sold' | 'unsold'
  by?: string
  amount?: number
  /** 1 for "going once", 2 for "going twice". */
  call?: number
}

export type LotState = {
  lot: Lot
  current: number
  /** Bidder id holding the top bid; null means the auctioneer's own bid. */
  leader: string | null
  calls: number
  over: boolean
  sold: boolean
  chandelier: number
  /** Each rival's ceiling for this lot, rolled once when the lot opens. */
  limits: Record<string, number>
  events: BidEvent[]
}

/** Opens at roughly 60% of the low estimate, snapped down onto the ladder. */
export function openLot(lot: Lot, rivals: Bidder[], rng: Rng): LotState {
  const raw = lot.low * 0.6
  const step = increment(raw)
  const open = Math.max(step, Math.round(raw / step) * step)
  const limits: Record<string, number> = {}
  for (const b of rivals) limits[b.id] = ceiling(b, lot, rng)
  return {
    lot,
    current: open,
    leader: null,
    calls: 0,
    over: false,
    sold: false,
    chandelier: 0,
    limits,
    events: [{ kind: 'open', amount: open }],
  }
}

/**
 * What it costs to be the top bidder right now.
 *
 * The opening price is live: the first bidder in takes it as it stands rather
 * than being made to bid over the auctioneer's own opening number. Everyone
 * after that goes up one rung of the ladder. Both the room and the player have
 * to agree on this, so it is worked out in one place.
 */
export function askingPrice(s: LotState): number {
  return s.leader === null && s.events.length === 1 ? s.current : nextBid(s.current)
}

/** Place a bid for a named bidder. Returns false if it was not a legal bid. */
export function placeBid(s: LotState, id: string, amount: number): boolean {
  if (s.over || s.leader === id) return false
  const ask = askingPrice(s)
  if (amount < ask) return false
  s.current = amount
  s.leader = id
  s.calls = 0
  s.events.push({ kind: amount > ask ? 'jump' : 'bid', by: id, amount })
  return true
}

function settle(s: LotState) {
  s.over = true
  // A lot that never got past the reserve is bought in, whoever is nominally
  // holding it — including the auctioneer's own chandelier bid.
  s.sold = s.leader !== null && s.current >= s.lot.reserve
  s.events.push(
    s.sold
      ? { kind: 'sold', by: s.leader!, amount: s.current }
      : { kind: 'unsold', amount: s.current },
  )
}

/**
 * Advance the room by one action: a rival bids, the auctioneer takes one off
 * the wall, or the call count moves on. The human's bids arrive separately
 * through placeBid, which is what lets the page run this on a timer.
 */
export function step(s: LotState, rivals: Bidder[], rng: Rng): BidEvent | null {
  if (s.over) return null
  const asking = askingPrice(s)

  const willing = rivals.filter((b) => {
    if (b.id === s.leader) return false
    if (asking > s.limits[b.id]) return false
    if (asking > affordableHammer(b.budget)) return false
    // A sniper is not in this auction until it is nearly over.
    if (b.style === 'sniper' && s.calls < 1) return false
    return true
  })

  if (willing.length) {
    // Keenest first, most of the time — it is what makes the last two standing
    // feel like a duel rather than a raffle.
    willing.sort((a, b) => s.limits[b.id] - s.limits[a.id])
    const b = rng() < 0.62 ? willing[0] : willing[(rng() * willing.length) | 0]

    let amount = asking
    if (b.style === 'jumper' && rng() < 0.38) {
      let jumped = amount
      for (let k = 0; k < 1 + ((rng() * 2) | 0); k++) jumped = nextBid(jumped)
      if (jumped <= s.limits[b.id] && jumped <= affordableHammer(b.budget)) amount = jumped
    }

    const jump = amount > asking
    s.current = amount
    s.leader = b.id
    s.calls = 0
    const ev: BidEvent = { kind: jump ? 'jump' : 'bid', by: b.id, amount }
    s.events.push(ev)
    return ev
  }

  // Nobody wants it at the next step. Below the reserve the auctioneer is
  // allowed to bid against whoever is holding it, from nowhere, to lift the
  // price — up to twice here, and disclosed at the end.
  if (s.leader !== null && s.current < s.lot.reserve && s.chandelier < 2 && rng() < 0.65) {
    s.chandelier++
    s.current = nextBid(s.current)
    s.leader = null
    s.calls = 0
    const ev: BidEvent = { kind: 'chandelier', amount: s.current }
    s.events.push(ev)
    return ev
  }

  s.calls++
  if (s.calls > 2) {
    settle(s)
    return s.events[s.events.length - 1]
  }
  const ev: BidEvent = { kind: 'call', call: s.calls }
  s.events.push(ev)
  return ev
}

/** Charge the winner and record the lot against them. */
export function commit(s: LotState, all: Bidder[]): LotOutcome {
  const out: LotOutcome = {
    lotId: s.lot.id,
    hammer: s.current,
    winner: s.sold ? s.leader : null,
    sold: s.sold,
    chandelier: s.chandelier,
  }
  if (s.sold && s.leader) {
    const b = all.find((x) => x.id === s.leader)
    if (b) {
      b.budget -= withPremium(s.current)
      b.won.push({ id: s.lot.id, category: s.lot.category })
    }
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Headless                                                                   */
/* -------------------------------------------------------------------------- */

/** Run a whole lot with no human in the room. Used by the checker. */
export function runLot(lot: Lot, rivals: Bidder[], rng: Rng): LotOutcome {
  const s = openLot(lot, rivals, rng)
  // Generous ceiling: every step either raises the price along the ladder or
  // advances the call count, so this can only be hit by a genuine bug.
  for (let i = 0; i < 2_000 && !s.over; i++) step(s, rivals, rng)
  if (!s.over) settle(s)
  return commit(s, rivals)
}

export function runSale(lots: Lot[], rivals: Bidder[], rng: Rng): LotOutcome[] {
  return lots.map((lot) => runLot(lot, rivals, rng))
}

/* -------------------------------------------------------------------------- */
/* The reckoning                                                              */
/* -------------------------------------------------------------------------- */

export type Ledger = {
  hammerTotal: number
  premiumTotal: number
  paidTotal: number
  valueTotal: number
  /** Paid minus what the things are actually worth. Positive is a loss. */
  net: number
  lotsWon: number
  /** Lots where the winning bid alone was over the appraised value. */
  cursed: number
  /** Lots where a bid off the wall pushed the price up before you won it. */
  chandelierHits: number
}

export function ledger(outcomes: LotOutcome[], lots: Lot[], who: string): Ledger {
  const byId = new Map(lots.map((l) => [l.id, l]))
  let hammerTotal = 0
  let valueTotal = 0
  let cursed = 0
  let chandelierHits = 0

  for (const o of outcomes) {
    if (o.winner !== who) continue
    const lot = byId.get(o.lotId)!
    hammerTotal += o.hammer
    valueTotal += lot.value
    if (o.hammer > lot.value) cursed++
    if (o.chandelier > 0) chandelierHits++
  }

  const paidTotal = withPremium(hammerTotal)
  return {
    hammerTotal,
    premiumTotal: paidTotal - hammerTotal,
    paidTotal,
    valueTotal,
    net: paidTotal - valueTotal,
    lotsWon: outcomes.filter((o) => o.winner === who).length,
    cursed,
    chandelierHits,
  }
}
