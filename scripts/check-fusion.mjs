import assert from 'node:assert/strict'
import worker from '../worker/fusion-worker.js'
import { pairKey } from '../src/lib/fusion-pair.js'
import { RECIPES, LOCAL } from '../src/lib/fusion-recipes.js'
import { loadState, restoreState, saveState } from '../src/lib/fusion-state.js'

const discovered = { text: 'Glass' }
const migrated = restoreState({ items: [discovered, discovered, null, { text: 42 }], recipes: { 'fire+sand': discovered } })
assert.equal(migrated.items.length, 5)
assert.ok(migrated.items.some((i) => i.text === 'Glass'))
assert.deepEqual(migrated.recipes, {})
let saved
assert.equal(saveState({ setItem(_, value) { saved = value } }, migrated), true)
assert.deepEqual(loadState({ getItem() { return saved } }), migrated)
const blockedStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('full') } }
assert.equal(loadState(blockedStorage).items.length, 4)
assert.equal(saveState(blockedStorage, migrated), false)
assert.equal(loadState({ getItem() { return '{broken' } }).items.length, 4)
const cacheKey = pairKey('Fire', 'Sand')
assert.deepEqual(restoreState({ version: 2, items: [], recipes: { [cacheKey]: discovered, '__proto__': {}, bad: discovered } }).recipes, { [cacheKey]: discovered })

assert.equal(RECIPES.length, 109)
assert.equal(Object.keys(LOCAL).length, RECIPES.length, 'duplicate recipe pair')
for (const [a, b, text] of RECIPES) {
  assert.equal(LOCAL[pairKey(a, b)].text, text)
  assert.equal(LOCAL[pairKey(b.toUpperCase(), ` ${a} `)].text, text)
}
const reached = new Set(['earth', 'fire', 'water', 'wind'])
let previous
do {
  previous = reached.size
  for (const [a, b, text] of RECIPES) {
    if (reached.has(a) && reached.has(b)) reached.add(text.toLowerCase())
  }
} while (reached.size !== previous)
for (const [, , text] of RECIPES) assert.ok(reached.has(text.toLowerCase()), `unreachable: ${text}`)
assert.notEqual(pairKey('a|b', 'c'), pairKey('a', 'b|c'))
assert.notEqual(pairKey('a+b', 'c'), pairKey('a', 'b+c'))

const edge = new Map(), kv = new Map(), pending = []
let calls = 0
globalThis.caches = { default: {
  async match(request) { return edge.get(request.url)?.clone() },
  async put(request, response) { edge.set(request.url, response.clone()) },
} }
const env = {
  ALLOWED_ORIGINS: 'https://games.test,https://other.test',
  FUSION: { async get(key) { return kv.get(key) }, async put(key, value) { kv.set(key, JSON.parse(value)) } },
  AI: { async run() { calls++; return { response: '{"result":"Cloud","unexpected":"field"}' } } },
}
const ctx = { waitUntil(promise) { pending.push(promise) } }
async function request(headers = { origin: 'https://games.test' }, first = 'Water', second = 'Wind', method = 'GET') {
  const response = await worker.fetch(new Request(`https://api.test/api/fusion/pair?first=${encodeURIComponent(first)}&second=${encodeURIComponent(second)}`, { headers, method }), env, ctx)
  await Promise.all(pending.splice(0))
  return response
}
for (const headers of [
  {}, { referer: 'not a URL' }, { origin: 'null' },
  { referer: 'https://games.test.evil.invalid/fusion/' },
  { referer: 'https://games.test@evil.invalid/fusion/' },
  { origin: 'https://evil.invalid', referer: 'https://games.test/fusion/' },
]) assert.equal((await request(headers)).status, 403)
assert.equal(calls, 0, 'denied requests must not spend model calls')
assert.equal((await request(undefined, '', 'Fire')).status, 400)
assert.equal((await request(undefined, 'a'.repeat(61), 'Fire')).status, 400)
assert.equal((await request(undefined, 'Water', 'Wind', 'POST')).status, 405)
assert.equal((await request(undefined, 'Water', 'Wind', 'OPTIONS')).status, 204)
const first = await request()
assert.equal(first.headers.get('access-control-allow-origin'), 'https://games.test')
assert.deepEqual(await first.json(), { result: 'Cloud' })
const second = await request({ origin: 'https://other.test' }, 'wind', 'water')
assert.equal(second.headers.get('access-control-allow-origin'), 'https://other.test')
assert.deepEqual(await second.json(), { result: 'Cloud' })
assert.equal(calls, 1, 'reversed pair must reuse edge answer')
edge.clear()
assert.equal((await request({ referer: 'https://games.test/fusion/' })).status, 200)
assert.equal(calls, 1, 'KV must survive an edge miss')
await request(undefined, 'a|b', 'c')
await request(undefined, 'a', 'b|c')
assert.equal(calls, 3, 'delimiter-containing pairs must not collide')
env.AI.run = async () => ({ response: '{"result":{}}' })
assert.equal((await request(undefined, 'Bad', 'Shape')).status, 502)
env.AI.run = async () => { throw new Error('offline') }
assert.equal((await request(undefined, 'No', 'Network')).status, 502)
// Hints: following them from the four starters, one at a time, finds the whole
// tree; each is makeable when given; the count reaches zero exactly at the end;
// and they lead outwards in order, never to something deeper than need be.
{
  const { within, hint, depths } = await import('../src/lib/fusion-hints.js')
  const seed = ['Water', 'Fire', 'Earth', 'Wind']
  const found = new Set(seed)
  const d = depths(seed)
  const all = new Set(RECIPES.map(([, , text]) => text.toLowerCase()))
  assert.equal(within(found).length, 10, 'ten things are one step from the start')
  let steps = 0, lastDepth = 0
  for (let h = hint(found, seed); h; h = hint(found, seed)) {
    assert.ok([...found].some((f) => f.toLowerCase() === h.a) && [...found].some((f) => f.toLowerCase() === h.b), `hint needs something not yet found: ${h.text}`)
    assert.ok(![...found].some((f) => f.toLowerCase() === h.text.toLowerCase()), `hint for something already found: ${h.text}`)
    assert.ok(d.get(h.text.toLowerCase()) >= lastDepth - 1, 'hints lead outwards')
    lastDepth = Math.max(lastDepth, d.get(h.text.toLowerCase()))
    found.add(h.text)
    assert.ok(++steps < 500)
  }
  assert.equal(found.size, all.size + seed.length, 'following hints finds every element')
  assert.equal(within(found).length, 0)
  assert.ok(Math.max(...d.values()) >= 8, 'the tree is deep, not only wide')
}

console.log(`Fusion: ${RECIPES.length} recipes reachable in both orders; origin, validation, cache and failure regressions passed.`)
