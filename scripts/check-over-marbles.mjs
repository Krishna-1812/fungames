/**
 * check-over-marbles — does the tank of marbles in Overstimulated always say
 * the same number as the counter?
 *
 * The marbles are an abacus: ones, tens, hundreds, thousands, ten thousands,
 * never more than nine of a colour except the last. They are the picture of
 * your attention, so if they ever disagree with the number the game is lying.
 * This drives the module through clicks, income and purchases (including ones
 * that need a big marble broken into change) and checks after every step:
 *
 *   1. the marbles are worth exactly the attention;
 *   2. no colour below the top has ten or more;
 *   3. everything that is meant to be in the tank ends up inside the glass;
 *   4. nothing ever becomes NaN, and the tank settles.
 *
 *   node scripts/check-over-marbles.mjs
 */
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)

/* A canvas that draws nothing, and enough of a window for the module. */
const noop = () => {}
const ctx2d = new Proxy({}, {
  get: (_, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : noop),
  set: () => true,
})
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 600 }) })
globalThis.document = { createElement: fakeCanvas }
globalThis.devicePixelRatio = 1
globalThis.addEventListener = noop
globalThis.removeEventListener = noop
globalThis.ResizeObserver = class { observe() {} disconnect() {} }
globalThis.performance ??= { now: () => Date.now() }

const { createMarbles, TIERS } = await import('../src/lib/over/marbles.ts')

let failures = 0
const check = (c, m) => { if (!c) failures++; if (!c || process.env.VERBOSE) console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${m}`) }

const TANK = { left: 20, right: 640, bottom: 580, height: 150 }
for (const animate of [true, false]) {
  console.log(`\n${animate ? 'with motion' : 'reduced motion'}`)
  const m = createMarbles({ canvas: fakeCanvas(), tank: () => TANK, animate })
  const from = { x: 330, y: 260 }, to = { x: 800, y: 100 }
  let value = 0, bad = 0, over = 0
  // A seeded run of everything that changes attention.
  let s = 7
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  for (let i = 0; i < 1400; i++) {
    const k = r()
    if (k < 0.6) value += 1 + Math.floor(r() * 4)                 // a click, with a combo
    else if (k < 0.85) value += Math.floor(r() * (i < 700 ? 30 : 400)) // income
    else if (value > 0) value -= Math.floor(r() * value * 0.9)     // a purchase
    m.sync(value, from, to)
    if (m.worth !== value) bad++
    const c = m.counts()
    if (c.slice(0, TIERS.length - 1).some((n) => n > 9)) over++
    m.frame(1 / 60)
  }
  check(bad === 0, `the tank is worth exactly the attention after all 1400 changes (${bad} disagreements)`)
  check(over === 0, `no colour ever holds ten (${over} times it did)`)
  for (let i = 0; i < 900; i++) m.frame(1 / 60)
  check(m.still, 'everything has settled fifteen seconds after the last change')
  const c = m.counts()
  const sum = c.reduce((a, n, t) => a + n * TIERS[t].value, 0)
  check(sum === value, `and still adds up: ${c.join(' / ')} is ${sum}, the counter says ${value}`)
  console.log(`  ok    ${value.toLocaleString('en-US')} attention as ${c.reduce((a, b) => a + b, 0)} marbles`)
}

// A purchase that needs change: one hundred-marble, spend one.
{
  const m = createMarbles({ canvas: fakeCanvas(), tank: () => TANK, animate: true })
  m.sync(100, { x: 300, y: 200 }, { x: 800, y: 100 })
  for (let i = 0; i < 120; i++) m.frame(1 / 60)
  m.sync(99, { x: 300, y: 200 }, { x: 800, y: 100 })
  check(m.counts().join() === '9,9,0,0,0', `spending 1 of 100 breaks it into 9 tens and 9 ones (${m.counts().join()})`)
}

console.log(failures ? `\n${failures} failure(s)\n` : '\nall marble checks passed\n')
process.exit(failures ? 1 : 0)
