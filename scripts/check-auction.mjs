/**
 * Checks src/lib/auction.ts.
 *
 * Two kinds of claim are being tested here. The first are arithmetic: the
 * bidding ladder, the buyer's premium, and the rule that no bidder ever bids
 * past their own limit or their own money. Those are exact.
 *
 * The second is the interesting one. The game claims the winner's curse falls
 * out of the model rather than being scripted — that when everybody values a
 * lot as the truth times their own taste, the person who wins is
 * disproportionately whoever most overrated it, and so pays more than the thing
 * is worth. Nothing in the code arranges that. This runs two thousand sales and
 * measures whether it actually happens.
 *
 *   node scripts/check-auction.mjs
 */
import {
  increment,
  nextBid,
  withPremium,
  affordableHammer,
  mulberry32,
  makeRivals,
  openLot,
  step,
  commit,
  ledger,
  PREMIUM,
} from '../src/lib/auction.ts'
import { dealLots, CATALOGUE } from '../src/data/lots.ts'

let failures = 0

function check(label, got, expected, tol = 0) {
  const ok = Array.isArray(expected)
    ? got !== null && got >= expected[0] && got <= expected[1]
    : typeof expected === 'string' || typeof expected === 'boolean'
      ? got === expected
      : Math.abs(got - expected) <= tol
  if (!ok) failures++
  const want = Array.isArray(expected) ? `${expected[0]}–${expected[1]}` : String(expected)
  const show = typeof got === 'number' ? (Number.isInteger(got) ? got : got.toFixed(4)) : String(got)
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${show} (expected ${want})`)
}

const money = (n) => '£' + Math.round(n).toLocaleString('en-GB')

/* -------------------------------------------------------------------------- */
/* The ladder and the premium                                                 */
/* -------------------------------------------------------------------------- */

console.log('\nbidding ladder')

check('£100 steps by', increment(100), 10)
check('£450 steps by', increment(450), 20)
check('£900 steps by', increment(900), 50)
check('£1,500 steps by', increment(1_500), 100)
check('£4,000 steps by', increment(4_000), 200)
check('£9,000 steps by', increment(9_000), 500)
check('£50,000 steps by', increment(50_000), 2_000)

// Climbing the whole ladder from a tenner must always go up, must never stall,
// and must land exactly on the band boundaries rather than straddling them.
let at = 10
let steps = 0
let monotone = true
const boundaries = new Set([200, 500, 1_000, 2_000, 5_000, 10_000, 20_000])
const hit = new Set()
while (at < 60_000 && steps < 5_000) {
  const up = nextBid(at)
  if (up <= at) monotone = false
  at = up
  steps++
  if (boundaries.has(at)) hit.add(at)
}
check('every step raises the price', monotone, true)
check('the ladder reaches £60,000', at >= 60_000, true)
check('and lands exactly on all 7 band boundaries', hit.size, 7)

console.log('\nbuyer’s premium')
check('premium is 25%', PREMIUM, 0.25)
check('£1,000 hammer costs', withPremium(1_000), 1_250)
check('£4,000 hammer costs', withPremium(4_000), 5_000)
// The two must agree, or a bidder with exactly enough money would be told they
// cannot afford the thing they can exactly afford.
let inverseOk = true
for (let cash = 100; cash <= 20_000; cash += 37) {
  const h = affordableHammer(cash)
  if (withPremium(h) > cash) inverseOk = false
  if (withPremium(h + 1) <= cash) inverseOk = false
}
check('affordableHammer is the exact inverse of withPremium', inverseOk, true)

/* -------------------------------------------------------------------------- */
/* Running the room                                                           */
/* -------------------------------------------------------------------------- */

console.log('\ninvariants over 2,000 sales')

const SALES = 2_000
let lotsRun = 0
let unsold = 0
let overLimit = 0
let overBudget = 0
let negativeBudget = 0
let snipedEarly = 0
let chandelierAboveReserve = 0
let stuck = 0

// The curse, measured rather than asserted into existence.
let wonLots = 0
let hammerSum = 0
let paidSum = 0
let valueSum = 0
const byBidder = new Map()

for (let sale = 0; sale < SALES; sale++) {
  const rng = mulberry32(1_000 + sale)
  const lots = dealLots(rng)
  const rivals = makeRivals()
  const startBudget = new Map(rivals.map((b) => [b.id, b.budget]))

  for (const lot of lots) {
    const s = openLot(lot, rivals, rng)
    const before = new Map(rivals.map((b) => [b.id, b.budget]))

    let guard = 0
    while (!s.over && guard++ < 2_000) {
      const callsBefore = s.calls
      const ev = step(s, rivals, rng)
      if (!ev) break
      if (ev.kind === 'bid' || ev.kind === 'jump') {
        // Nobody bids past what they said they would, or past their money.
        if (ev.amount > s.limits[ev.by] + 1e-9) overLimit++
        if (ev.amount > affordableHammer(before.get(ev.by))) overBudget++
        const style = rivals.find((b) => b.id === ev.by).style
        if (style === 'sniper' && callsBefore < 1) snipedEarly++
      }
      if (ev.kind === 'chandelier' && ev.amount > lot.reserve + nextBid(lot.reserve)) {
        // A bid off the wall exists to reach the reserve; it must never be used
        // to push a price that is already there.
        chandelierAboveReserve++
      }
    }
    if (guard >= 2_000) stuck++

    const out = commit(s, rivals)
    lotsRun++
    if (!out.sold) unsold++
    else {
      wonLots++
      hammerSum += out.hammer
      paidSum += withPremium(out.hammer)
      valueSum += lot.value
      const rec = byBidder.get(out.winner) ?? { lots: 0, paid: 0, value: 0 }
      rec.lots++
      rec.paid += withPremium(out.hammer)
      rec.value += lot.value
      byBidder.set(out.winner, rec)
    }
  }

  for (const b of rivals) {
    if (b.budget < 0) negativeBudget++
    if (b.budget > startBudget.get(b.id)) negativeBudget++
  }
}

check('every lot terminated', stuck, 0)
check('no bid above the bidder’s own limit', overLimit, 0)
check('no bid above the bidder’s remaining money', overBudget, 0)
check('no bidder ever went overdrawn', negativeBudget, 0)
check('a sniper never bid before "going once"', snipedEarly, 0)
check('no bid off the wall above the reserve', chandelierAboveReserve, 0)

// The reserve has to bite sometimes or it is decoration, but a sale where half
// the room goes home empty is not a sale.
const unsoldRate = unsold / lotsRun
check('unsold rate is plausible', unsoldRate, [0.01, 0.3])
console.log(`       ${lotsRun.toLocaleString('en-GB')} lots, ${unsold.toLocaleString('en-GB')} bought in`)

/* -------------------------------------------------------------------------- */
/* The winner's curse                                                         */
/* -------------------------------------------------------------------------- */

console.log('\nthe winner’s curse — is it real, or did I write it in?')

const hammerRatio = hammerSum / valueSum
const paidRatio = paidSum / valueSum
console.log(`       winners paid ${money(paidSum / wonLots)} on average for lots worth ${money(valueSum / wonLots)}`)
console.log(`       hammer alone was ${(hammerRatio * 100 - 100).toFixed(1)}% over appraised value`)
console.log(`       with the premium on top, ${(paidRatio * 100 - 100).toFixed(1)}% over`)

// The claim the game makes to the player. If this ever came back at or below 1
// the game would be lying to them, and the honest fix would be the text, not
// the threshold.
check('winners overpay once the premium is on', paidRatio > 1, true)
check('and the curse is not so extreme it stops being a game', paidRatio, [1.0, 1.6])

console.log('\n       who overpays most, by how much:')
const rows = [...byBidder.entries()]
  .map(([id, r]) => ({ id, over: r.paid / r.value, lots: r.lots }))
  .sort((a, b) => b.over - a.over)
for (const r of rows) {
  console.log(`         ${r.id.padEnd(10)} ${((r.over - 1) * 100).toFixed(1).padStart(6)}% over   ${r.lots} lots`)
}

// Petrov and Quill set their ceiling on the hammer and forget the 25%. That is
// stated in their character notes, so it had better show up in the results.
const forgetful = rows.filter((r) => r.id === 'petrov' || r.id === 'quill')
const careful = rows.filter((r) => r.id !== 'petrov' && r.id !== 'quill')
const mean = (a) => a.reduce((x, y) => x + y.over, 0) / a.length
check(
  'the two who forget the premium overpay more than the three who do not',
  mean(forgetful) > mean(careful),
  true,
)

// Five characters is only five characters if more than one of them ever wins.
// This guards the balance: at the spender's first settings he took 70% of the
// room and the other four were scenery.
const sold = rows.reduce((n, r) => n + r.lots, 0)
const top = Math.max(...rows.map((r) => r.lots)) / sold
const quiet = Math.min(...rows.map((r) => r.lots)) / sold
check('no single rival dominates the room', top, [0.15, 0.45])
check('and none of them is scenery', quiet, [0.05, 0.3])

/* -------------------------------------------------------------------------- */
/* The ledger                                                                 */
/* -------------------------------------------------------------------------- */

console.log('\nledger arithmetic')

const rng = mulberry32(7)
const lots = dealLots(rng)
const outcomes = [
  { lotId: lots[0].id, hammer: 400, winner: 'you', sold: true, chandelier: 1 },
  { lotId: lots[1].id, hammer: 1_000, winner: 'you', sold: true, chandelier: 0 },
  { lotId: lots[2].id, hammer: 900, winner: 'vance', sold: true, chandelier: 0 },
]
const l = ledger(outcomes, lots, 'you')
check('hammer total', l.hammerTotal, 1_400)
check('premium total', l.premiumTotal, 350)
check('paid total', l.paidTotal, 1_750)
check('lots won', l.lotsWon, 2)
check('value total', l.valueTotal, lots[0].value + lots[1].value)
check('net', l.net, 1_750 - (lots[0].value + lots[1].value))
check('chandelier hits counted', l.chandelierHits, 1)
check('catalogue size', CATALOGUE.length, 14)

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
