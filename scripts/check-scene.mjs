import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { captureScene, readScene, sceneBodies, encodeScene, decodeScene, fitScene } = await import('../src/lib/orbit-scene.ts')
const { makeBody, step, circularV } = await import('../src/lib/orbit-sim.ts')

const original = [makeBody(450, 300, 0, 0, 1200), makeBody(610, 300, 0, circularV(1200, 160), 6, true)]
const scene = captureScene(original, 900, 600, true, 30)
const code = encodeScene(scene)
assert.ok(code)
assert.deepEqual(decodeScene(code), scene, 'link must preserve full simulation precision')
assert.equal(sceneBodies(scene)[1].mine, true, 'local scene keeps launch ownership')
assert.equal(sceneBodies(scene, true)[1].mine, false, 'shared scenes cannot import personal progress')
const restored = sceneBodies(scene)
assert.equal(new Set(restored.map(b => b.id)).size, restored.length)
let a = original, b = restored
for (let i = 0; i < 1200; i++) {
  a = step(a, .5, 900, 600).bodies
  b = step(b, .5, 900, 600).bodies
}
assert.deepEqual(captureScene(a, 900, 600, true, 30), captureScene(b, 900, 600, true, 30), 'restored future diverged')
for (const [w, h] of [[390, 720], [720, 390], [1440, 900]]) {
  const fit = fitScene(900, 600, w, h)
  assert.ok(fit.scale > 0 && fit.left >= 0 && fit.top >= 0)
  assert.ok(900 * fit.scale <= w + 1e-8 && 600 * fit.scale <= h + 1e-8)
  const x = 610, y = 300
  assert.ok(Math.abs((fit.left + x * fit.scale - fit.left) / fit.scale - x) < 1e-8)
  assert.ok(Math.abs((fit.top + y * fit.scale - fit.top) / fit.scale - y) < 1e-8)
}
for (const invalid of [null, {}, { ...scene, v: 2 }, { ...scene, w: 0 }, { ...scene, h: Infinity },
  { ...scene, mass: 999 }, { ...scene, trails: 1 }, { ...scene, bodies: Array(321).fill(scene.bodies[0]) },
  { ...scene, bodies: [[0, 0, NaN, 0, 6, 0]] }, { ...scene, bodies: [[0, 0, 0, 0, -1, 0]] },
  { ...scene, bodies: [[0, 0, 0, 0, 6, 2]] }, { ...scene, bodies: [[0, 0, 0, 0, 6]] }]) {
  assert.equal(readScene(invalid), null)
}
for (const bad of ['', '?', 'a'.repeat(8001), btoa('{}'), code.slice(0, -7)]) assert.equal(decodeScene(bad), null)
assert.deepEqual(readScene({ ...scene, bodies: [] }).bodies, [], 'empty scene is a valid saved choice')
const dense = captureScene(Array.from({ length: 320 }, (_, i) => makeBody(i + .123456789, i + .987654321, .345678912, .123456789, 6)), 900, 600, true, 6)
assert.equal(encodeScene(dense), null, 'oversized link must fail explicitly without losing the save')
assert.ok(readScene(dense), 'large scenes remain locally saveable')
console.log('Scenes: full-precision links, future trajectories, ownership, viewport fit, malformed data and size limits passed.')
