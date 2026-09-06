import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { FixedClock } = await import('../src/lib/fixed-clock.ts')
const { makeBody, resetIds, step, circularV } = await import('../src/lib/orbit-sim.ts')
const { Tracker } = await import('../src/lib/orbit-goals.ts')

function run(hz) {
  resetIds()
  let bodies = [makeBody(450, 300, 0, 0, 1200), makeBody(610, 300, 0, circularV(1200, 160), 2, true)]
  const clock = new FixedClock(), tracker = new Tracker()
  let ticks = 0
  for (let frame = 0; frame <= hz * 10; frame++) clock.advance(frame * 1000 / hz, () => {
    ticks++
    const events = { merges: [], escaped: [] }
    for (let sub = 0; sub < 2; sub++) {
      const result = step(bodies, .5, 900, 600)
      bodies = result.bodies
      events.merges.push(...result.events.merges)
      events.escaped.push(...result.events.escaped)
    }
    tracker.observe(bodies, events)
  })
  assert.equal(ticks, 600)
  assert.equal(bodies.length, 2)
  for (const body of bodies) assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y))
  return { bodies, progress: tracker.progress() }
}
const baseline = run(60)
assert.ok(baseline.progress.done.length > 0, 'fixture must exercise challenge progress')
for (const hz of [30, 90, 120, 144]) assert.deepEqual(run(hz), baseline, `${hz} Hz changed physics`)
const clock = new FixedClock()
let ticks = 0
const tick = () => ticks++
clock.advance(0, tick)
clock.advance(100, tick)
assert.equal(ticks, 5, 'catch-up is bounded')
clock.advance(60_000, tick)
assert.equal(ticks, 5, 'background gap must not fast-forward')
clock.reset()
clock.advance(90_000, tick)
assert.equal(ticks, 5, 'resume starts a new clock')
clock.advance(90_000 + 1000 / 60, tick)
assert.equal(ticks, 6)
console.log('Clock: equal Orbit physics at 30/60/90/120/144 Hz; pause and catch-up checks passed.')
