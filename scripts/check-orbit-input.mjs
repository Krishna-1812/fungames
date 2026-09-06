import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { adjustAim } = await import('../src/lib/orbit-input.ts')
const original = { x0: 95, y0: 45, x1: 115, y1: 15 }
const moved = adjustAim(original, [1, 0], false, 100, 50)
assert.equal(moved.x0, 100)
assert.equal(moved.x1 - moved.x0, 20)
assert.equal(moved.y1 - moved.y0, -30)
assert.deepEqual(original, { x0: 95, y0: 45, x1: 115, y1: 15 })
const steered = adjustAim(original, [0, 1], true, 100, 50)
assert.equal(steered.x0, original.x0)
assert.equal(steered.y0, original.y0)
assert.equal(steered.y1 - steered.y0, -25)
let bounded = original
for (let i = 0; i < 1000; i++) bounded = adjustAim(bounded, [-1, 0], true, 100, 50)
assert.equal(bounded.x1 - bounded.x0, -300)
for (let i = 0; i < 1000; i++) bounded = adjustAim(bounded, [0, -1], false, 100, 50)
assert.equal(bounded.y0, 0)
assert.equal(bounded.y1 - bounded.y0, -30)
console.log('Keyboard launch: independent position/velocity, boundary preservation and speed limits passed.')
