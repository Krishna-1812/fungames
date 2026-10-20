import assert from 'node:assert/strict'
import { register } from 'node:module'
register('./resolve-ts.mjs', import.meta.url)
const { canvasTransforms } = await import('../src/lib/island/canvas-transform.ts')
const a = [], b = []
let context = { setTransform: (...m) => a.push(m) }
const cache = canvasTransforms(() => context)
const matrix = [1, 0, 0, 1, 2, 3]
assert(cache.set(matrix)); assert.equal(cache.set([...matrix]), false)
matrix[4] = 10
assert(cache.set(matrix)); assert.equal(a.length, 2, 'reusing a mutable matrix does not hide a change')
cache.invalidate() // a restore, clip callback, or outside renderer changed the context
assert(cache.set(matrix)); assert.equal(a.length, 3)
context = { setTransform: (...m) => b.push(m) }
assert(cache.set(matrix)); assert.equal(b.length, 1, 'an offscreen context needs its own transform')
assert.equal(cache.set(matrix), false)
console.log('PASS transforms: identical values skipped; mutations, restore and context changes respected')
