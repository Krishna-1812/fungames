import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { Tracker } = await import('../src/lib/orbit-goals.ts')
const { makeBody } = await import('../src/lib/orbit-sim.ts')
const ev = { merges: [], escaped: [] }
for (const mine of [false, true]) {
  const tracker = new Tracker()
  const star = makeBody(500, 500, 0, 0, 1200)
  const moon = makeBody(650, 500, 0, 2, 6, mine)
  for (let i = 0; i <= 100; i++) {
    const a = i * Math.PI / 100
    moon.x = 500 + 150 * Math.cos(a); moon.y = 500 + 150 * Math.sin(a)
    tracker.observe([star, moon], ev)
  }
  assert.ok(Math.abs(tracker.liveLaps() - (mine ? .5 : 0)) < 1e-8)
  tracker.observe([star], ev)
  assert.equal(tracker.liveLaps(), 0)
  tracker.reset(); assert.equal(tracker.liveLaps(), 0)
}
console.log('Mission ownership, half-lap measurement, lost-body pruning and reset passed.')
