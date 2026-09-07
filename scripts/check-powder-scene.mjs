import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { captureExperiment, readExperiment, restoreExperiment } = await import('../src/lib/powder-scene.ts')
const { createWorld, put, step, mulberry32 } = await import('../src/lib/powder-sim.ts')
const { SAND, WATER, FIRE, buildLookup } = await import('../src/lib/powder-rules.ts')
const w = createWorld(80, 60, mulberry32(42))
for (let x=10;x<65;x++) { put(w,x,15,SAND); put(w,x,30,WATER); }
put(w,40,45,FIRE)
const rx = buildLookup()
for(let i=0;i<12;i++) step(w,rx)
const saved = captureExperiment(w)
const parsed = readExperiment(JSON.parse(JSON.stringify(saved)))
assert.deepEqual(parsed, saved)
const restored = restoreExperiment(parsed, mulberry32(123))
w.rand = mulberry32(123)
for(let i=0;i<60;i++) { step(w,rx); step(restored,rx) }
assert.deepEqual(captureExperiment(restored), captureExperiment(w))
saved.grid[0] = 255
assert.notEqual(parsed.grid[0], 255)
for (const bad of [null, {}, {...parsed,v:2}, {...parsed,w:341}, {...parsed,frame:-1}, {...parsed,frame:Infinity},
  {...parsed,grid:[]}, {...parsed,life:parsed.life.map((x,i)=>i===0?-1:x)},
  {...parsed,shade:parsed.shade.map((x,i)=>i===0?1.2:x)}, {...parsed,fired:['invented']}]) assert.equal(readExperiment(bad),null)
assert.equal(readExperiment(saved),null)
console.log('Powder snapshots: exact round-trip, independent arrays, future simulation and malformed-save rejection passed.')
