/**
 * check-cascade-deck — do Rule Cascade's cards always end up where they can
 * be read?
 *
 * The cards are bodies on springs (lib/cascade/deck.ts): tossed in, carried,
 * jolted, stamped. All of that is decoration on top of one promise: when the
 * motion stops, every card lies exactly where the layout put it, flat on the
 * desk, and nothing is left floating, spinning or NaN. This drives the deck
 * through a game's worth of arrivals and reshuffles, stepping the animation
 * frame by frame, and checks that promise after each one:
 *
 *   1. it comes to rest, within a few seconds;
 *   2. every card is on its spot (to half a pixel) and down on the desk;
 *   3. still-to-meet cards never overlap one another;
 *   4. the pile is the same every time for the same cards;
 *   5. with reduced motion, nothing moves at all: it is just there.
 *
 *   node scripts/check-cascade-deck.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

/* A frame clock we step by hand. */
let frames = []
let now = 0
globalThis.requestAnimationFrame = (f) => { frames.push(f); return frames.length }
globalThis.performance = { now: () => now }
globalThis.innerWidth = 1440
const run = (seconds) => {
  for (let i = 0; i < seconds * 60; i++) {
    now += 1000 / 60
    const f = frames; frames = []
    f.forEach((fn) => fn(now))
    if (!frames.length) return i / 60
  }
  return Infinity
}

const el = (h) => {
  const shadow = { style: {} }
  return { style: {}, offsetHeight: h, querySelector: () => shadow }
}
const tray = { clientWidth: 500, style: {}, getBoundingClientRect: () => ({ right: 1200 }) }

const { createDeck } = await import('../src/lib/cascade/deck.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

const heights = (id) => 84 + (id % 3) * 24
function game(animate) {
  let lands = 0
  const deck = createDeck({ tray, animate, onLand: () => lands++ })
  const ids = []
  let worstRest = 0, offSpot = 0, floating = 0, overlap = 0, nan = 0
  const met = []
  // Thirty-one rules arrive; each round some of what is met breaks again.
  for (let id = 1; id <= 31; id++) {
    ids.push(id)
    deck.add(id, el(heights(id)))
    if (id > 2 && id % 4 === 0) met.splice(0, 0, ...met.splice(met.length - 1, 1)) // reshuffle the pile
    if (id > 1) met.push(id - 1)
    const unmet = ids.filter((i) => !met.includes(i))
    // Sometimes a met rule breaks: back off the pile and into the column.
    if (id % 5 === 0 && met.length > 3) { const b = met.splice(1, 1)[0]; unmet.push(b); deck.jolt(b) }
    if (id % 3 === 0 && met.length) deck.press(met[met.length - 1])
    deck.layout(unmet.sort((a, b) => a - b), met)
    if (animate) deck.toss(deck.get(id))
    const t = animate ? run(12) : 0
    worstRest = Math.max(worstRest, t)
    for (const i of ids) {
      const c = deck.get(i)
      if (![c.x, c.y, c.r, c.z].every(Number.isFinite)) nan++
      if (Math.hypot(c.x - c.tx, c.y - c.ty) > 0.5 || Math.abs(c.r - c.tr) > 0.2) offSpot++
      if (c.z > 0.001) floating++
    }
    const col = unmet.map((i) => deck.get(i)).sort((a, b) => a.ty - b.ty)
    for (let k = 1; k < col.length; k++) if (col[k].ty < col[k - 1].ty + col[k - 1].h) overlap++
    met.length = 0
    met.push(...ids.filter((i) => !unmet.includes(i) || i === id).filter((i) => i !== id))
  }
  return { deck, worstRest, offSpot, floating, overlap, nan, lands }
}

console.log('\nwith motion')
const a = game(true)
check(a.worstRest < 6, `every toss and reshuffle comes to rest (slowest ${a.worstRest.toFixed(2)} s)`)
check(a.nan === 0, `nothing ever becomes NaN (${a.nan})`)
check(a.offSpot === 0, `every card ends exactly on its spot (${a.offSpot} were off)`)
check(a.floating === 0, `every card ends down on the desk (${a.floating} still in the air)`)
check(a.overlap === 0, `cards still to meet never overlap (${a.overlap})`)
check(a.lands > 20, `cards are heard landing (${a.lands} touchdowns)`)

console.log('\nreduced motion')
const b = game(false)
check(frames.length === 0, 'no animation frame is ever asked for')
check(b.offSpot === 0 && b.floating === 0, 'every card is simply where it belongs')

// The same cards make the same pile.
{
  const d1 = createDeck({ tray, animate: false }), d2 = createDeck({ tray, animate: false })
  for (let i = 1; i <= 12; i++) { d1.add(i, el(heights(i))); d2.add(i, el(heights(i))) }
  const pile = [3, 1, 7, 2, 9, 12, 5]
  d1.layout([4, 6], pile); d2.layout([4, 6], pile)
  check(pile.every((i) => d1.get(i).tx === d2.get(i).tx && d1.get(i).tr === d2.get(i).tr), 'the pile is scattered the same way every time')
  check(pile.every((i) => Math.abs(d1.get(i).tr) <= 3.3 && Math.abs(d1.get(i).tx) <= 8), 'and only roughly: no card turned more than 3°, or more than 8 px off')
  d1.setFanned(true); d1.layout([4, 6], pile)
  const ys = pile.map((i) => d1.get(i).ty)
  check(ys.every((y, k) => k === 0 || y - ys[k - 1] >= 60), 'spread out, every approved card shows a readable strip')
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall deck checks passed\n')
process.exit(failures ? 1 : 0)
